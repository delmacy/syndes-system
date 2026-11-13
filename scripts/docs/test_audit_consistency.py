"""Audit plan counters and statuses derive from the catalog, never snapshots in tests."""
from pathlib import Path
import json
import shutil
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
from audit_consistency import audit_snapshot,validate

class AuditConsistencyTests(unittest.TestCase):
    def test_current_plan_agrees_with_all_statuses(self):
        snapshot,issues=validate(ROOT)
        self.assertEqual(issues,[])
        self.assertEqual(snapshot["total"],len(json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]))
        self.assertEqual(snapshot["audited"]+snapshot["baseline"],snapshot["total"])
        self.assertIn("C03",snapshot["ids"])

    def test_changing_status_detects_summary_and_plan_drift(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"docs/blueprint").mkdir(parents=True)
            (root/"docs/subprojects").mkdir(parents=True)
            shutil.copy2(ROOT/"docs/subprojects/index.json",root/"docs/subprojects/index.json")
            shutil.copy2(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md",root/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md")
            units=json.loads((root/"docs/subprojects/index.json").read_text())["units"]
            for unit in units:
                target=root/unit["status"]
                target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(ROOT/unit["status"],target)
            self.assertEqual(validate(root)[1],[])
            status=root/next(unit["status"] for unit in units if unit["id"]=="C04")
            status.write_text(status.read_text()+"\nAUDITORIA TÉCNICA PARCIAL\n")
            snapshot,issues=validate(root)
            self.assertTrue(issues)
            self.assertTrue(any("Audit count mismatch" in issue for issue in issues))
            self.assertTrue(any("Audited ID mismatch" in issue for issue in issues))

    def test_catalog_duplicate_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"docs/subprojects").mkdir(parents=True)
            units=json.loads((ROOT/"docs/subprojects/index.json").read_text())
            units["units"].append(dict(units["units"][0]))
            (root/"docs/subprojects/index.json").write_text(json.dumps(units))
            with self.assertRaisesRegex(ValueError,"Duplicate module IDs"):
                audit_snapshot(root)

if __name__=="__main__":unittest.main()
