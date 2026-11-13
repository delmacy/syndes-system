"""Q10: evidence-driven integrity gate without confusing it with product acceptance."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
Q10=ROOT/"docs/subprojects/Q10-quality-gates"
AUDITED_SHA="69670e27e5c8e22240642f5cde67986ac0e8376b"

class Q10AuditTests(unittest.TestCase):
    def test_q10_owner_and_runtime_limit(self):
        units=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        q10=next(u for u in units if u["id"]=="Q10")
        self.assertEqual(q10["path"],"tests/integrity")
        ref=(Q10/"REFERENCIA-TECNICA.md").read_text()
        for value in ("Q10 não oferece controller HTTP","Q10 não possui tabelas PostgreSQL",
                      "repository-structure.sh","check-work-units.mjs"):
            self.assertIn(value,ref)

    def test_chapters_and_evidence_sources(self):
        chapters=sorted((Q10/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            with self.subTest(chapter=chapter.name):
                self.assertNotRegex(chapter.read_text(),
                                    r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        for source in ("tests/integrity/AGENTS.md","tests/integrity/repository-structure.sh",
                       "scripts/architecture/check-work-units.mjs","scripts/ci/plan.mjs",
                       "scripts/ci/parity.test.mjs","scripts/ci/run-suite.sh",
                       ".github/workflows/syndes-ci.yml","docs/engineering/TEST-STRATEGY.md",
                       "docs/engineering/SYNDES-SUPPORT-RELEASE-GATE.md"):
            with self.subTest(source=source):
                self.assertTrue((ROOT/source).is_file(),source)

    def test_integrity_test_does_not_claim_full_business_coverage(self):
        s=(ROOT/"tests/integrity/repository-structure.sh").read_text()
        self.assertIn("set -euo pipefail",s)
        self.assertIn("scripts/architecture/check-work-units.mjs",s)
        self.assertIn("AGENTS.md",s)
        guide=(ROOT/"tests/integrity/AGENTS.md").read_text()
        self.assertIn("Não substituem lint/typecheck/unit/integration",guide)
        docs=(Q10/"chapters/01-missao-objetivos-e-fronteiras.md").read_text()
        self.assertIn("substituir testes unitários",docs.lower())
        planner=(ROOT/"scripts/ci/plan.mjs").read_text()
        self.assertIn("suite: 'crm'",planner)
        self.assertIn("suite: 'service-management'",planner)
        self.assertIn("service-management",(Q10/"STATUS.md").read_text())

    def test_current_ci_failure_is_a_blocker_not_approval(self):
        status=(Q10/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn(AUDITED_SHA,status)
        self.assertIn("43335397128",status)
        self.assertIn("Gate global não aprovado",status)
        workflow=(ROOT/".github/workflows/syndes-ci.yml").read_text()
        self.assertIn("Prove fail-closed test selection and removed-workflow parity",workflow)
        self.assertIn("Deny merge unless all required checks actually passed",workflow)

    def test_plan_separates_quality_status_from_implementation(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("10 STATUS",plan)
        self.assertIn("47 STATUS",plan)
        self.assertIn("integridade inventariada; CI Q07 recuperada, Product Gates pendentes",plan)
        statuses={u["id"]:u["status"] for u in json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]}
        partial={mid for mid,path in statuses.items() if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/path).read_text()}
        self.assertEqual(partial,{"G01","G02","G03","Q10","Q07","Q01","P14","P01","P02","P03"})

if __name__=="__main__":
    unittest.main()
