#!/usr/bin/env python3
"""Minimum Mermaid coverage and accuracy guard for evidence-reviewed MVP docs."""
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
EXPECTED={
    "docs/blueprint/README.md":2,
    "docs/subprojects/P01-crm/chapters/05-contratos-e-interfaces-oferecidos-consumidos.md":2,
    "docs/subprojects/P01-crm/chapters/06-persistencia-migracoes-e-propriedade-de-schemas.md":1,
    "docs/subprojects/P02-inbox/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":2,
    "docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":2,
    "docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":3,
    "docs/subprojects/P01-crm/EVOLUCAO.md":1,
    "docs/subprojects/P02-inbox/EVOLUCAO.md":1,
    "docs/subprojects/P03-whatsapp/EVOLUCAO.md":1,
    "docs/subprojects/P14-platform-core/EVOLUCAO.md":1,
}

class MermaidDocsTests(unittest.TestCase):
    def test_diagrams_in_canonical_sources(self):
        self.assertEqual(sum(EXPECTED.values()),16)
        for rel,count in EXPECTED.items():
            with self.subTest(doc=rel):
                text=(ROOT/rel).read_text(encoding="utf-8")
                self.assertEqual(text.count("`" * 3 + "mermaid"),count)
                self.assertEqual(text.count("`" * 3),count*2)
                self.assertNotIn("Diagramas versionados: A ELABORAR",text)

    def test_diagrams_appear_inside_three_level_pages(self):
        from importlib.util import spec_from_file_location,module_from_spec
        spec=spec_from_file_location("site",ROOT/"scripts/docs/build_site.py")
        site=module_from_spec(spec)
        spec.loader.exec_module(site)
        import json
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        by_id={u["id"]:u for u in units}
        for id in ("P01","P02","P03","P14"):
            with self.subTest(unit=id):
                folder=ROOT/by_id[id]["scope"]
                self.assertTrue((folder.parent/"EVOLUCAO.md").exists())
                self.assertTrue((folder.parent/"ESCOPO.md").exists())
                for chapter in EXPECTED:
                    if chapter.startswith(folder.parent.as_posix()+"/chapters/"):
                        self.assertTrue((ROOT/chapter).exists())
        self.assertIn("embed_chapters_in_scopes", (ROOT/"scripts/docs/build_site.py").read_text())
        self.assertIn('{"Escopo":str(d/"ESCOPO.md")}',(ROOT/"scripts/docs/build_site.py").read_text())

    def test_reference_and_gates_stay_explicit(self):
        requirements={
          "docs/subprojects/P01-crm/chapters/05-contratos-e-interfaces-oferecidos-consumidos.md":["opt-in","whatsapp-identity-events.ts"],
          "docs/subprojects/P02-inbox/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":["opt-in","SSE"],
          "docs/subprojects/P03-whatsapp/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":["projection_path","legado"],
          "docs/subprojects/P14-platform-core/chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md":["não","worker"],
        }
        for path,terms in requirements.items():
            doc=(ROOT/path).read_text().lower()
            for term in terms:
                self.assertIn(term.lower(),doc)

if __name__=="__main__":
    unittest.main()
