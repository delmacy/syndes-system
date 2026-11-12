"""Verify the four evidence-backed MVP snapshots do not invent operational gates."""
from pathlib import Path
import importlib.util
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
SPEC=importlib.util.spec_from_file_location(
    "syndes_reconcile_mvp",ROOT/"scripts/docs/reconcile_mvp_baseline_20261112.py")
SNAP=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(SNAP)

class ReconciledMvpTests(unittest.TestCase):
    def test_four_priority_statuses(self):
        expected={"P01":"29 PASS","P02":"34 PASS","P03":"69 PASS","P14":"63 PASS"}
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        owners={x["id"]:x for x in units}
        self.assertEqual(set(SNAP.D),set(expected))
        for uid,marker in expected.items():
            with self.subTest(unit=uid):
                base=ROOT/Path(owners[uid]["scope"]).parent
                status=(base/"STATUS.md").read_text()
                evolution=(base/"EVOLUCAO.md").read_text()
                sprint=(base/"SPRINT.md").read_text()
                self.assertIn(marker,status)
                self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
                self.assertIn("sem implantação",status)
                self.assertIn("gates",evolution.lower())
                self.assertIn(uid+"-WP-VAL",evolution)
                self.assertIn("NÃO ATRIBUÍDA",evolution)
                self.assertIn("Ainda não iniciada",sprint)
                self.assertIn("NÃO INICIADA",sprint)
                for path in SNAP.D[uid]["files"]:
                    self.assertTrue((ROOT/path).exists(),path)
                for task,_,_,_,_ in SNAP.D[uid]["tasks"]:
                    self.assertIn(task,evolution)
                self.assertIn("## Checkpoint da auditoria",status)

    def test_core_host_skips_are_explicit(self):
        status=(ROOT/"docs/subprojects/P14-platform-core/STATUS.md").read_text()
        self.assertIn("19 SKIP",status)
        self.assertIn("NÃO é pacote runtime próprio",status)

    def test_source_code_remains_unmodified_by_baseline(self):
        script=(ROOT/"scripts/docs/reconcile_mvp_baseline_20261112.py").read_text()
        self.assertIn("if \"## Situação revalidada\" not in old",script)
        self.assertIn("if f\"## Reconciliação técnica — {DATE}\" not in old",script)
        self.assertIn("if \"## Próxima sprint candidata",script)

if __name__=="__main__":
    unittest.main()
