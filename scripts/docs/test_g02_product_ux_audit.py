"""G02 product/UX audit: enforce canonical scope, owners and evidence boundaries."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
G02=ROOT/"docs/subprojects/G02-produto-e-ux"
SOURCE_SHA="36b7ebeabee236196e71b2f43f2ee92a4e0b49c9"

class G02ProductAuditTests(unittest.TestCase):
    def test_governance_unit_has_no_runtime_surface(self):
        unit=next(u for u in json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
                  if u["id"]=="G02")
        self.assertEqual(unit["path"],"docs/product")
        ref=(G02/"REFERENCIA-TECNICA.md").read_text()
        for phrase in ("não registra endpoint HTTP","não possui database","não exporta classes/métodos"):
            self.assertIn(phrase,ref)
        self.assertNotIn("G02 DONE",ref)

    def test_all_chapters_are_reconciled_and_links_are_grounded(self):
        chapters=sorted((G02/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            s=chapter.read_text()
            self.assertNotRegex(s,r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        for source in (
            "MVP-SCOPE.md","MODULE-ORDER.md","PRD-003A-GESTAO-ATENDIMENTOS-MVP.md",
            "PRD-FUNNELS-AND-TEMPLATES-PROPOSAL.md","CORE-CRM-MVP-ACCEPTANCE.md",
            "CORE-CRM-FRONTEND-COMPLETION.md","PRD-002-INBOX-ACCEPTANCE.md",
            "INBOX-FRONTEND-PROGRESS.md","PRD-SYNDES-SUPPORT.md",
        ):
            with self.subTest(source=source):
                self.assertTrue((ROOT/"docs/product"/source).is_file())
        self.assertIn("não cria novos requisitos aprovados",(G02/"chapters/02-requisitos-historias-e-casos-de-uso.md").read_text())

    def test_approved_basic_and_advanced_funnel_scope_remain_distinct(self):
        basic=(ROOT/"docs/product/PRD-003A-GESTAO-ATENDIMENTOS-MVP.md").read_text()
        proposal=(ROOT/"docs/product/PRD-FUNNELS-AND-TEMPLATES-PROPOSAL.md").read_text()
        self.assertIn("aprovada em 2026-11-11",basic)
        self.assertIn("pós-MVP",proposal)
        scope=(G02/"chapters/03-capabilities.md").read_text()
        self.assertIn("PRD-003A",scope)
        self.assertIn("F0–F8",scope)
        self.assertIn("Product Gate final pendente",scope)

    def test_frontend_sources_exist_under_owners(self):
        files=(
            "apps/workspace-web/src/features/crm.tsx",
            "apps/workspace-web/src/features/inbox.tsx",
            "apps/workspace-web/src/features/whatsapp-accounts.tsx",
            "apps/master-admin-web/src/app/ManagerShell.tsx",
            "apps/support-web/src/App.tsx",
            "packages/front-shared/package.json",
        )
        for p in files:
            with self.subTest(path=p):
                self.assertTrue((ROOT/p).is_file(),p)
        text=(G02/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text()
        self.assertIn("Platform Organization",text)
        self.assertIn("CRM Organization",text)
        self.assertIn("não tem database",text)

    def test_partial_documentation_and_six_units_in_baseline(self):
        status=(G02/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn(SOURCE_SHA,status)
        self.assertIn("Product Gates",status)
        self.assertIn("Não foram executados",status)
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("11 STATUS",plan)
        self.assertIn("46 STATUS",plan)
        self.assertIn("G02 — Produto e UX",plan)
        self.assertIn("PRDs/UX reconciliados; Product Gates pendentes",plan)

if __name__=="__main__":
    unittest.main()
