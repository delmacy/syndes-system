#!/usr/bin/env python3
"""Technical-reference pilot, ERP-proposal and wide-reader integration guard."""
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
PILOTS={
  "A08-core-kernel":{"methods":["executeModule","ModuleRegistry","start()"],"data":["nenhuma tabela/migration de ownership","Tenant DB"]},
  "A04-core-host":{"methods":["loadInstalledPlugins","installModuleAssets","CoreService"],"data":["Control/Manager DB","Tenant DB"]},
  "P01-crm":{"methods":["createPerson","createOrganization","CrmService"],"data":["crm_people","crm_organizations","crm_employees"]},
  "P04-organizations-workforce":{"methods":["WorkforceService","bindEmployee","createTeam"],"data":["platform_organizations","platform_staff_teams","007_staff_roles_pre_release.sql"]},
}

class TechReferenceTests(unittest.TestCase):
    def test_pilots_have_public_contracts_frontend_and_storage(self):
        for folder,checks in PILOTS.items():
            with self.subTest(folder=folder):
                doc=ROOT/"docs/subprojects"/folder/"REFERENCIA-TECNICA.md"
                self.assertTrue(doc.is_file())
                text=doc.read_text(encoding="utf-8")
                for term in checks["methods"]+checks["data"]:
                    self.assertIn(term,text)
                self.assertIn("Frontend",text)
                self.assertIn("Contrat",text)
                self.assertIn("https://github.com/delmacy/syndes-system/",text)

    def test_erp_is_proposal_and_not_a_new_operational_unit(self):
        doc=(ROOT/"docs/blueprint/PROPOSTA-ERP-LITE-E-REFERENCIA-TECNICA.md").read_text()
        for phrase in ["NÃO APROVADA","NÃO IMPLEMENTADA","ERP Lite","crm_employees",
                       "platform_organizations","Tenant DB","Control/Manager DB","DOM-01","ERP-01","DOC-01"]:
            self.assertIn(phrase,doc)
        catalog=json.loads((ROOT/"catalog/work-units.json").read_text())
        self.assertEqual(len(catalog["units"]),57)
        self.assertFalse(any(u["name"]=="ERP Lite" for u in catalog["units"]))

    def test_material_layout_configuration(self):
        src=(ROOT/"scripts/docs/build_site.py").read_text()
        css=(ROOT/"docs/assets/syndes.css").read_text()
        self.assertIn('"toc.integrate"',src)
        self.assertNotIn('"navigation.indexes"',src)
        self.assertIn('max-width: 1340px',css)
        self.assertIn('.md-grid',css)

    def test_template_and_blueprint_links(self):
        self.assertTrue((ROOT/"docs/standards/TEMPLATE-REFERENCIA-TECNICA.md").is_file())
        b=(ROOT/"docs/blueprint/README.md").read_text()
        self.assertIn("PROPOSTA-ERP-LITE-E-REFERENCIA-TECNICA.md",b)
        for folder in PILOTS:self.assertIn(folder+"/REFERENCIA-TECNICA.md",b)

if __name__=="__main__":
    unittest.main()
