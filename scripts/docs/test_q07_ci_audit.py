"""Evidence-based regression gates for Q07 source, pipeline and audit status."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
Q07=ROOT/"docs/subprojects/Q07-ci-cd"
BASE_SHA="9521919178bcc0341c4d187492f9d027d188a6bd"

class Q07CIGovernanceTests(unittest.TestCase):
    def test_owner_and_document_sections(self):
        catalog=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        unit=next(u for u in catalog if u["id"]=="Q07")
        self.assertEqual(unit["path"],"scripts/ci/plan.mjs")
        chapters=sorted((Q07/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            with self.subTest(chapter=chapter.name):
                self.assertNotRegex(chapter.read_text(),
                                    r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        ref=(Q07/"REFERENCIA-TECNICA.md").read_text()
        for x in ("não publica API HTTP","selectSuites(changedPaths, available, mode)",
                  "installedSuites(base)","mainlineEvents(source)","service-management"):
            self.assertIn(x,ref)

    def test_service_suite_is_in_planner_and_runner(self):
        planner=(ROOT/"scripts/ci/plan.mjs").read_text()
        runner=(ROOT/"scripts/ci/run-suite.sh").read_text()
        parity=(ROOT/"scripts/ci/parity.test.mjs").read_text()
        self.assertIn("suite: 'service-management'",planner)
        self.assertIn("modules/service-management/package-lock.json",planner)
        self.assertIn("modules/service-management/'))",planner)
        for token in ("  service-management)","postgres:","funnel-mvp-pg17",
                      "SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY","npm run check"):
            self.assertIn(token,runner)
        for token in ("syndes-docs-pages.yml","syndes-docs-project-sync.yml",
                      "assert.deepEqual(names,expectedWorkflows)",
                      "assert.deepEqual(mainlineEvents(main)"):
            self.assertIn(token,parity)
        self.assertTrue((ROOT/"modules/service-management/test/service-funnels-pg17.test.mjs").is_file())

    def test_documentation_reports_old_failure_without_claiming_release(self):
        status=(Q07/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn(BASE_SHA,status)
        self.assertIn("43337290670",status)
        self.assertIn("19/19",status)
        self.assertIn("CI central pós-correção",status)
        self.assertIn("24/24 jobs success",status)
        self.assertIn("43339625873",status)
        self.assertIn("ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f",status)
        self.assertIn("não habilita P05",status)
        self.assertNotIn("Q07: DONE",status)
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("12 STATUS",plan)
        self.assertIn("45 STATUS",plan)
        self.assertIn("Parcial — CI mainline validada (24/24 no SHA ec688ce)",plan)

if __name__=="__main__":
    unittest.main()
