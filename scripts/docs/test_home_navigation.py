"""Navigation and home contracts for the approved Syndes Docs layout."""
from pathlib import Path
import json
import re
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
import build_site
import portal_views

UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
CATALOG=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]

class HomeNavigationTests(unittest.TestCase):
    def test_top_level_navigation_matches_approved_groups(self):
        nav=build_site.site_navigation(UNITS,CATALOG)
        self.assertEqual([next(iter(item)) for item in nav],[
            "Início","Projetos","Documentação","Módulos por área",
            "APIs e dados","Operações","Guias e colaboração"])
        self.assertEqual([next(iter(x)) for x in nav[1]["Projetos"]],[
            "Visão geral","WBS e workpackages","Roadmap"])
        self.assertEqual([next(iter(x)) for x in nav[2]["Documentação"]],[
            "Mapa técnico","Catálogo e busca","Arquitetura e contratos"])
        areas=nav[3]["Módulos por área"]
        self.assertEqual(len(areas),len(portal_views.SYSTEM_AREAS))
        ids=[next(iter(module)).split(" ",1)[0]
             for group in areas for modules in group.values() for module in modules]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertEqual(set(ids),{u["id"] for u in UNITS if not u.get("documentationParent")})
        self.assertIn("C03",ids)
        self.assertIn("C05",ids)
        self.assertIn("P03",ids)
        self.assertIn("P02",ids)
        self.assertIn("A02",ids)

    def test_home_has_exactly_four_direct_cards_and_accessible_targets(self):
        html=(ROOT/"docs/README.md").read_text()
        hrefs=re.findall(r'class="syndes-hub-card"\s+href="([^"]+)"',html)
        self.assertEqual(hrefs,[
            "blueprint/PROJETOS/",
            "blueprint/MAPA-TECNICO-POR-CAMADAS/",
            "blueprint/CATALOGO-MODULOS/",
            "blueprint/APIS/"])
        for href in hrefs:
            path=ROOT/"docs"/(href.rstrip("/")+".md")
            self.assertTrue(path.is_file(),path)
        self.assertNotIn("72%",html)
        for heading in ("Acesso rápido","Explore o conteúdo","Leitura e evolução versionadas"):
            self.assertIn(heading,html)

    def test_new_indexes_reference_evidence_not_fabricated_acceptance(self):
        for name in ("APIS.md","DADOS.md","ROADMAP.md"):
            doc=(ROOT/"docs/blueprint"/name).read_text()
            self.assertIn("não",doc.lower(),name)
            self.assertIn("CATALOGO-MODULOS.md",doc) if name!="ROADMAP.md" else self.assertIn("WBS",doc)
            self.assertNotIn("100%",doc)

if __name__=="__main__":
    unittest.main()
