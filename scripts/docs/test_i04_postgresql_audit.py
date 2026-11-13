"""I04: DB audit must distinguish catalog evidence, SQL contracts and release gates."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
I04=ROOT/"docs/subprojects/I04-postgresql"
BASE="13955974bc0702f4c7fcb5717ee2d7cb243f5f08"
PARTIAL={"G01","G02","G03","Q10","Q07","Q01","P14","I02","I04","P01","P02","P03"}

class I04PostgreSQLAudit(unittest.TestCase):
    def test_catalog_and_real_source_paths(self):
        i04=next(x for x in json.loads((ROOT/"catalog/work-units.json").read_text())["units"] if x["id"]=="I04")
        self.assertEqual(i04["path"],"infra/postgres")
        self.assertEqual(i04["maturity"],"verified")
        for p in ("infra/postgres/compose.yaml",
                  "infra/postgres/bootstrap/00-init.sh",
                  "infra/postgres/bootstrap/control.schema",
                  "infra/postgres/bootstrap/control-admin.schema",
                  "infra/postgres/bootstrap/provision-tenant.sh",
                  "infra/postgres/bootstrap/tenant-module-ledger.schema",
                  "infra/postgres/bootstrap/migrate-modules-tenant.sh",
                  "infra/postgres/bootstrap/support-migration-gate.sh",
                  "scripts/control/module_migrations.py",
                  "tests/platform/postgres-smoke.sh",
                  "modules/organizations/sql/002_legacy_single_context_gate.sql",
                  "modules/support/sql/001_support_cases.sql",
                  "apps/core-host/sql/001_platform_events.sql"):
            with self.subTest(source=p):
                self.assertTrue((ROOT/p).is_file(),p)

    def test_code_matches_documented_security_contracts(self):
        init=(ROOT/"infra/postgres/bootstrap/00-init.sh").read_text()
        self.assertIn("REVOKE CONNECT ON DATABASE syndes_control FROM PUBLIC",init)
        provision=(ROOT/"infra/postgres/bootstrap/provision-tenant.sh").read_text()
        self.assertIn("REVOKE CONNECT ON DATABASE",provision)
        self.assertIn("'provisioned'",provision)
        self.assertIn("TENANT_DB_PASSWORD",provision)
        plan=(ROOT/"scripts/control/module_migrations.py").read_text()
        for flag in ("--plan","--apply","reconcile(","--backup-id",
                     "--restore-test-id","SYNDES_CONTROL_MIGRATION_APPLY"):
            self.assertIn(flag,plan)
        self.assertIn("PLAN ONLY: no Control DB changes",plan)

    def test_status_distinguishes_real_instance_and_migration_plan(self):
        status=(I04/"STATUS.md").read_text()
        ref=(I04/"REFERENCIA-TECNICA.md").read_text()
        for term in ("AUDITORIA TÉCNICA PARCIAL",BASE,"43355545663",
                     "BEGIN READ ONLY","PENDING","NÃO VERIFICADO",
                     "não executar", "sem DDL", "tenant"):
            with self.subTest(term=term):
                self.assertIn(term.lower(),(status+"\n"+ref).lower())
        self.assertIn("public.control_module_schema_migrations",ref)
        self.assertIn("sem CONNECT",status)
        self.assertIn("outbox",ref.lower())
        self.assertIn("não possui package.json",ref.lower())
        self.assertEqual(len(list((I04/"chapters").glob("*.md"))),8)

    def test_no_sensitive_catalog_identifiers_or_new_go_live_claims(self):
        files=[I04/"REFERENCIA-TECNICA.md",I04/"STATUS.md",
               *sorted((I04/"chapters").glob("*.md"))]
        for p in files:
            s=p.read_text()
            with self.subTest(file=p.name):
                self.assertNotRegex(s,r"(?i)(postgresql|postgres)://[^\s]+")
                self.assertNotRegex(s,r"(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)")
                for placeholder in ("A INVENTARIAR","A RECONCILIAR","A ELABORAR","A VALIDAR","A DEFINIR"):
                    self.assertNotIn(placeholder,s)
        op=(I04/"OPERACAO.md").read_text()
        self.assertIn("--plan",op)
        self.assertIn("Não usar `--apply`",op)
        self.assertIn("não",op.lower())
        diagrams=(I04/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text()
        self.assertEqual(diagrams.count("```mermaid"),3)

    def test_program_baseline_and_exact_57_unit_ids(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("12 STATUS",plan)
        self.assertIn("45 STATUS",plan)
        self.assertIn("Control com 6 migrations pendentes",plan)
        ids=re.findall(r"^\|\s*\d+\s*\|\s*\[([A-Z]\d{2})\s",plan,re.M)
        self.assertEqual(len(ids),57)
        self.assertEqual(len(set(ids)),57)
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        partial={x["id"] for x in units
                 if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/x["status"]).read_text()}
        self.assertEqual(partial,PARTIAL)

if __name__=="__main__":
    unittest.main()
