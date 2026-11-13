"""Q01 test-platform audit: preserve coverage provenance and environment boundaries."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
Q01=ROOT/"docs/subprojects/Q01-plataforma-de-testes"
SHA="bd0aa69349879485156ce05ffcb211904d34c206"

class Q01AuditTests(unittest.TestCase):
    def test_distributed_owner_and_eight_chapters(self):
        units=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        q01=next(u for u in units if u["id"]=="Q01")
        self.assertEqual(q01["path"],"tests")
        self.assertEqual(q01["maturity"],"distributed")
        chapters=sorted((Q01/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            with self.subTest(chapter=chapter.name):
                self.assertNotRegex(chapter.read_text(),
                                    r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        ref=(Q01/"REFERENCIA-TECNICA.md").read_text()
        self.assertIn("não publica endpoints HTTP",ref)
        self.assertIn("não existe um `package.json` central",ref)

    def test_sources_are_real_and_strategic_dirs_are_not_test_runners(self):
        for p in ("tests/AGENTS.md","tests/integration/AGENTS.md",
                  "tests/security/AGENTS.md","tests/performance/AGENTS.md",
                  "tests/integrity/repository-structure.sh",
                  "tests/platform/postgres-smoke.sh",
                  "tests/platform/openfga-smoke.sh",
                  "tests/platform/openbao-smoke.sh",
                  "tests/platform/platform-manager-keycloak-ci.mjs",
                  "tests/platform/core-host-runtime-smoke.sh",
                  "tests/platform/ci-secret-fixtures.py",
                  ".github/workflows/syndes-ci.yml",
                  "scripts/ci/plan.mjs"):
            with self.subTest(p=p):
                self.assertTrue((ROOT/p).is_file(),p)
        for d in ("tests/integration","tests/security","tests/performance"):
            with self.subTest(directory=d):
                self.assertEqual({p.name for p in (ROOT/d).iterdir() if p.is_file()},{"AGENTS.md"})
        self.assertIn("GITHUB_ACTIONS", (ROOT/"tests/platform/core-host-runtime-smoke.sh").read_text())

    def test_test_env_must_not_be_reported_as_deployment(self):
        status=(Q01/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn(SHA,status)
        self.assertIn("43340637846",status)
        self.assertIn("24/24 jobs",status)
        self.assertIn("não",status.lower())
        self.assertIn("não foram executadas suites destrutivas",status.lower())
        text=(Q01/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text()
        self.assertIn("CI_RUNTIME_SMOKE",text)
        self.assertIn("/run/syndes/runtime",text)
        self.assertIn("Q01 não cria database",text)
        self.assertIn("**Esta auditoria não o executou localmente.**",text)

    def test_all_57_units_preserved_and_q10_status_not_falsified(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("13 STATUS",plan)
        self.assertIn("44 STATUS",plan)
        self.assertIn("CI Q07 recuperada, Product Gates pendentes",plan)
        self.assertIn("suites/ambientes identificados, CI verde por SHA; RC pendente",plan)
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        partial={u["id"] for u in units
                 if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/u["status"]).read_text()}
        self.assertEqual(partial,{"G01","G02","G03","Q10","Q07","Q01","P14","I02","I04","C01","P01","P02","P03"})

if __name__=="__main__":
    unittest.main()
