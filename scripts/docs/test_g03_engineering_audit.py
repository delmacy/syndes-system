"""G03 audit regression: contracts, ownership, advisory guard, CI and status provenance."""
from pathlib import Path
import importlib.util
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
G03=ROOT/"docs/subprojects/G03-engenharia-e-git"
SOURCE_SHA="068954a21e3090c7f94d374e2a8486cec7c2537b"

class G03EngineeringAuditTests(unittest.TestCase):
    def test_governance_owner_and_no_runtime_contract(self):
        c=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        item=next(u for u in c if u["id"]=="G03")
        self.assertEqual(item["path"],"AGENTS.md")
        reference=(G03/"REFERENCIA-TECNICA.md").read_text()
        for phrase in ("não** possui runtime NestJS","G03 não expõe APIs HTTP","Nenhuma tabela ou migration pertence à G03"):
            self.assertIn(phrase,reference)

    def test_chapters_reconciled_and_source_files_exist(self):
        chapters=sorted((G03/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            self.assertNotRegex(chapter.read_text(),
                                r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        for source in ("AGENTS.md","scripts/docs/verify_module_scope.py",
                       "scripts/ci/plan.mjs","scripts/ci/parity.test.mjs",
                       "scripts/docs/sync_github_project.py","scripts/docs/build_site.py",
                       ".github/workflows/syndes-ci.yml",
                       ".github/workflows/syndes-docs-project-sync.yml"):
            with self.subTest(source=source):
                self.assertTrue((ROOT/source).is_file(),source)

    def test_advisory_scope_guard_must_not_be_promoted_to_sandbox(self):
        src=(ROOT/"scripts/docs/verify_module_scope.py").read_text()
        self.assertIn("Advisory enforcement",src)
        guardpath=ROOT/"scripts/docs/verify_module_scope.py"
        spec=importlib.util.spec_from_file_location("scopeguardG03",guardpath)
        mod=importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        unit=mod.UNITS["P03"]
        self.assertEqual(mod.verify_changed_paths(unit,["modules/whatsapp/src/plugin.ts"]),[])
        bad=mod.verify_changed_paths(unit,["modules/core-crm/src/service.ts",
                                           ".github/workflows/syndes-ci.yml"])
        self.assertEqual(len(bad),2)
        for name in ("04-contratos-e-dependencias-publicas.md","05-arquitetura-banco-interface-configuracao-e-diagramas.md"):
            t=(G03/"chapters"/name).read_text()
            self.assertIn("consultivo",t.lower())
            self.assertNotIn("sandbox garantido",t)

    def test_ci_and_project_sync_are_not_reported_as_accepted(self):
        status=(G03/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn(SOURCE_SHA,status)
        self.assertIn("43332115355",status)
        self.assertIn("não verificada",status.lower())
        self.assertIn("Mainline CI vermelho",status)
        workflow=(ROOT/".github/workflows/syndes-ci.yml").read_text()
        self.assertIn("Prove fail-closed test selection and removed-workflow parity",workflow)
        project=(ROOT/".github/workflows/syndes-docs-project-sync.yml").read_text()
        self.assertIn("vars.SYNDES_PROJECT_URL",project)
        self.assertIn("SYNDES_PROJECTS_PAT",project)

    def test_plan_maintains_57_units_and_7_partial_audits(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("12 STATUS",plan)
        self.assertIn("45 STATUS",plan)
        self.assertIn("G03 — Engenharia e Git",plan)
        self.assertIn("regras/CI e Projects inventariados; aprovação pendente",plan)

if __name__=="__main__":
    unittest.main()
