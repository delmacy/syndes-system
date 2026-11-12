"""Contract tests for the functional taxonomy, per-module reader and honest WBS registry."""
import importlib.util
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
SPEC=importlib.util.spec_from_file_location("syndes_portal_views",ROOT/"scripts/docs/portal_views.py")
portal=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(portal)
INDEX=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
ASSOCIATIONS=json.loads((ROOT/"catalog/evolution-associations.json").read_text())

class PortalViewsTests(unittest.TestCase):
    def test_functional_areas_cover_every_visible_unit_without_duplication(self):
        nav=portal.grouped_navigation(INDEX, lambda u:u["name"])
        observed=[item.split(" ")[0] for group in nav for unit in next(iter(group.values())) for item in unit]
        self.assertEqual(len(observed),49)
        self.assertEqual(set(observed),{u["id"] for u in INDEX if not u.get("documentationParent")})
        self.assertEqual(len(observed),len(set(observed)))
        self.assertIn("C03",next(iter(dict((k, [next(iter(v))[:3] for v in vals]) for group in nav for k,vals in group.items())["Segurança e acesso"])))
        self.assertEqual(portal.AREA_BY_ID["P03"],"Canais e comunicações")
        self.assertEqual(portal.AREA_BY_ID["P02"],"Atendimento")

    def test_tabs_preserve_canonical_pages_and_prompt_scope(self):
        unit=next(u for u in INDEX if u["id"]=="P03")
        html=portal.module_tabs(unit,"ESCOPO.md")
        for item in ("../APIS/","../DADOS/","../CONTRATOS/","../CODIGO/",
                     "../DEPENDENCIAS/","../TESTES/","../EVOLUCAO/","../OPERACAO/",
                     "../PROMPTS/","../HISTORICO/"):
            self.assertIn(item,html)
        self.assertIn('aria-current="page"',html)
        prompt=portal.scoped_prompts_page(unit,"WhatsApp")
        self.assertIn("modules/whatsapp",prompt)
        self.assertIn("P03",prompt)
        self.assertIn("não sandbox de segurança",prompt)
        self.assertIn("PROJECAO.md",prompt)
        self.assertIn("IMPLEMENTACAO.md",prompt)
        self.assertIn("ALTERACAO.md",prompt)
        self.assertIn("Não contornar",prompt)

    def test_wbs_registry_has_evidence_links_but_no_invented_percentages(self):
        payload=portal.project_registry(INDEX,ASSOCIATIONS,lambda u:u["name"],"a"*40,
            "https://delmacy.github.io/syndes-system/")
        self.assertEqual(payload["state"],"planning-associations-only")
        self.assertEqual(len(payload["units"]),49)
        for u in payload["units"]:
            source=ASSOCIATIONS["units"].get(u["id"],{})
            self.assertEqual(u["taskIds"],source.get("taskIds",[]))
            self.assertNotIn("progress",u)
            self.assertNotIn("status",u)
            self.assertIn("/EVOLUCAO/",u["links"]["wbs"])
            self.assertIn("/STATUS/",u["links"]["status"])
        wa=next(u for u in payload["units"] if u["id"]=="P03")
        self.assertTrue(wa["taskIds"])
        self.assertIn("Canais e comunicações",wa["area"])

    def test_invalid_registry_fails_closed(self):
        invalid=dict(ASSOCIATIONS)
        invalid["mappingType"]="status-estimate"
        with self.assertRaises(ValueError):
            portal.project_registry(INDEX,invalid,lambda u:u["name"],"test","/")

if __name__=="__main__":
    unittest.main()
