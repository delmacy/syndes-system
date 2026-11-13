"""C04 contract evidence tests: model relationships, adapter symbols and gate honesty."""
from pathlib import Path
import json
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
from source_evidence import validate as validate_witnesses
from audit_consistency import validate as validate_audit

DOC=ROOT/"docs/subprojects/C04-authorization-openfga"

class C04AuditTests(unittest.TestCase):
    def test_model_types_and_service_separation(self):
        model=json.loads((ROOT/"infra/security-access/fga-model.json").read_text())
        self.assertEqual(model["schema_version"],"1.1")
        types={entry["type"]:entry for entry in model["type_definitions"]}
        self.assertGreaterEqual(set(types),{"user","service","tenant","resource","event_delivery"})
        self.assertEqual(types["event_delivery"]["metadata"]["relations"]["processor"]["directly_related_user_types"],[{"type":"service"}])
        self.assertEqual(types["event_delivery"]["relations"]["can_process"],{"computedUserset":{"object":"","relation":"processor"}})
        self.assertNotIn("can_process",types["resource"]["relations"])
        self.assertIn("can_read",types["resource"]["relations"])
        self.assertIn("can_write",types["resource"]["relations"])

    def test_source_witnesses_enforced_and_owner_preserved(self):
        refs=json.loads((ROOT/"docs/evidence/contract-witnesses.json").read_text())["witnesses"]
        c04=[entry for entry in refs if entry["module"]=="C04"]
        self.assertGreaterEqual(len(c04),6)
        self.assertEqual(validate_witnesses(ROOT),[])
        self.assertTrue(all(entry["owner"] in {"A04","A06"} for entry in c04))
        self.assertTrue(all(entry["document"]=="docs/subprojects/C04-authorization-openfga/REFERENCIA-TECNICA.md" for entry in c04))

    def test_documentation_is_partial_not_operational(self):
        self.assertEqual(validate_audit(ROOT)[1],[])
        status=(DOC/"STATUS.md").read_text()
        technical=(DOC/"REFERENCIA-TECNICA.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn("NÃO HOMOLOGADO",status)
        self.assertIn("tuples reais",status)
        self.assertIn("C04.SEC.01",status)
        self.assertIn("C05",status)
        self.assertIn("OpenFgaServiceEventGrant.canProcess",technical)
        self.assertIn("FgaPermission.canAccess",technical)
        self.assertIn("createFgaWriteAuthorizer",technical)
        self.assertEqual(technical.count("```mermaid"),1)
        self.assertEqual(len(list((DOC/"chapters").glob("*.md"))),8)
        for page in [DOC/"STATUS.md",DOC/"REFERENCIA-TECNICA.md",DOC/"OPERACAO.md",*(DOC/"chapters").glob("*.md")]:
            content=page.read_text()
            for marker in ("A INVENTARIAR","A RECONCILIAR","A ELABORAR","A DEFINIR","A VALIDAR"):
                self.assertNotIn(marker,content)
            self.assertNotRegex(content,r"(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)")

if __name__=="__main__":
    unittest.main()
