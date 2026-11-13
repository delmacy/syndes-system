"""Ensure documentation audit ordering covers all real owners without inventing statuses."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
PLAN=ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md"

class AuditOrderTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text=PLAN.read_text(encoding="utf-8")
        cls.units={u["id"]:u for u in json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]}

    def test_complete_order_no_duplicates(self):
        rows=re.findall(r"^\|\s*(\d{2})\s*\|\s*\[([A-Z]\d{2})\s*—",self.text,re.M)
        self.assertEqual([int(n) for n,_ in rows],list(range(1,58)))
        self.assertEqual(set(mid for _,mid in rows),set(self.units))
        self.assertEqual(len(rows),57)
        self.assertEqual([mid for _,mid in rows][:7],["G01","G02","G03","Q10","Q07","Q01","P14"])

    def test_paths_and_status_evidence(self):
        for uid,entry in self.units.items():
            path=Path(entry["entry"]).parent.relative_to("docs")
            with self.subTest(uid=uid):
                self.assertIn(f"../{path}/STATUS.md",self.text)
                self.assertTrue((ROOT/entry["status"]).is_file())
        partial={uid for uid,entry in self.units.items()
                 if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/entry["status"]).read_text()}
        self.assertEqual(partial,{"G01","G02","G03","Q10","Q07","Q01","P14","I02","I04","C01","C03","P01","P02","P03"})
        self.assertIn("43 STATUS",self.text)
        self.assertIn("não auditado",self.text)

    def test_references_are_documented_not_completion_claims(self):
        self.assertIn("não afirmam implementação ou deploy",self.text)
        self.assertIn("não muda o Product Gate vigente",self.text)
        self.assertNotIn("| 100% |",self.text)
        self.assertIn("P01 CRM → P02 Inbox → P03 WhatsApp → P05",self.text)

if __name__=="__main__":
    unittest.main()
