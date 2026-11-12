"""Hard regression gates: module subject tabs are pages, not anchors in one giant reference."""
import json
from pathlib import Path
import re
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
from build_site import markdown_sections
from code_inventory import open_source_symbols,render
from portal_views import module_tabs
from topic_views import TAB_SPECS,normalize,reference_topic,topic_views

UNITS={u["id"]:u for u in json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]}

class IsolatedModuleTabsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        unit=UNITS["P01"]
        doc=(ROOT/unit["technicalReference"]).read_text()
        inventory=render(open_source_symbols(unit))
        cls.views=topic_views("P01","CRM",unit["technicalReference"],
                              markdown_sections(doc),markdown_sections(inventory),
                              "a"*40,unit["source"])

    def test_every_tab_has_an_independent_route_not_an_anchor(self):
        tabs=module_tabs(UNITS["P01"],"APIS.md")
        targets=re.findall(r'<a href="([^"]+)"',tabs)
        self.assertEqual(len(targets),12)
        self.assertEqual(len(set(targets)),12)
        self.assertTrue(all("#" not in value for value in targets))
        self.assertIn('href="../APIS/" aria-current="page"',tabs)
        self.assertIn('href="../DADOS/"',tabs)
        self.assertIn('href="../CONTRATOS/"',tabs)
        self.assertIn('href="../CODIGO/"',tabs)
        self.assertIn('href="../DEPENDENCIAS/"',tabs)
        self.assertNotIn("REFERENCIA-TECNICA/#",tabs)

    def test_crm_apis_exclude_other_technical_topics(self):
        body,metadata=self.views["APIS.md"]
        self.assertIn("Endpoints HTTP anotados",body)
        self.assertIn("Decorator e fonte",body)
        self.assertNotIn("## 2. Classes e métodos",body)
        self.assertNotIn("## 5. Schemas",body)
        self.assertNotIn("## Contratos públicos declarados pelo pacote",body)
        self.assertNotIn("## Métodos de classes",body)
        self.assertNotIn("## Dependências declaradas no manifesto",body)
        self.assertIn("APIs",body.splitlines()[0])
        self.assertEqual(metadata["source"],UNITS["P01"]["technicalReference"])
        endpoints=[x for x in metadata["sections"] if "Endpoints HTTP" in x["heading"]]
        self.assertEqual(len(endpoints),1)
        self.assertTrue(endpoints[0]["generated"])
        self.assertEqual(endpoints[0]["codeSource"],UNITS["P01"]["source"])
        self.assertEqual(endpoints[0]["position"],0)

    def test_domains_and_contracts_are_independent_and_editable_at_source(self):
        cases={
            "CODIGO.md":("## 2. Classes e métodos","## Classes, interfaces"),
            "CONTRATOS.md":("## 3. Contratos públicos","## Contratos públicos declarados"),
            "DADOS.md":("## 5. Schemas","## Schemas e arquivos SQL"),
            "DEPENDENCIAS.md":("## Dependências declaradas no manifesto",),
        }
        for path,headings in cases.items():
            with self.subTest(page=path):
                body,metadata=self.views[path]
                for heading in headings: self.assertIn(heading,body)
                self.assertNotIn("## Endpoints HTTP anotados",body)
                self.assertTrue(metadata["sections"])
                for section in metadata["sections"]:
                    self.assertEqual(section["source"],UNITS["P01"]["technicalReference"])
                    if section.get("generated"):
                        self.assertIn("codeSource",section)


    def test_nested_export_tables_are_not_mixed_into_code(self):
        unit=UNITS["P02"]
        pages=topic_views("P02","Inbox",unit["technicalReference"],
                         markdown_sections((ROOT/unit["technicalReference"]).read_text()),
                         markdown_sections(render(open_source_symbols(unit))),
                         "b"*40,unit["source"])
        code,_=pages["CODIGO.md"]
        contracts,metadata=pages["CONTRATOS.md"]
        self.assertNotIn("### Exports declarados no manifesto",code)
        self.assertNotIn("## Exports declarados no manifesto",code)
        self.assertIn("## Exports declarados no manifesto",contracts)
        self.assertTrue(any("Exports declarados" in x["heading"] for x in metadata["sections"]))

    def test_original_reference_and_legacy_heading_anchors_are_preserved(self):
        unit=UNITS["P01"]
        text=(ROOT/unit["technicalReference"]).read_text()
        self.assertIn("## 2. Classes e métodos",text)
        self.assertIn("## 5. Schemas",text)
        self.assertEqual(len(self.views),len(TAB_SPECS))
        self.assertEqual(normalize("Endpoints HTTP anotados {{#endpoints-http}}"),
                         normalize("Endpoints HTTP anotados"))
        self.assertEqual(reference_topic("3. Contratos públicos"),"CONTRATOS.md")

if __name__=="__main__":
    unittest.main()
