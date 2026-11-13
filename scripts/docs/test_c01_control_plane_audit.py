"""C01 Control Plane audit: independent tenant/module states and source evidence."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
DOC=ROOT/"docs/subprojects/C01-control-plane"
BASE="ac8deb8c538f59364c6247964a5b0d42e5fbae2e"
PARTIAL={"G01","G02","G03","Q10","Q07","Q01","P14","I02","I04","C01","C03","P01","P02","P03"}

class C01ControlAudit(unittest.TestCase):
    def test_catalog_and_actual_sources(self):
        units=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        c=next(x for x in units if x["id"]=="C01")
        self.assertEqual(c["path"],"infra/postgres/bootstrap")
        self.assertEqual(c["maturity"],"distributed")
        for path in ("infra/postgres/bootstrap/control.schema",
                     "infra/postgres/bootstrap/control-admin.schema",
                     "infra/postgres/bootstrap/control-account-roles.schema",
                     "infra/postgres/bootstrap/control-module-catalog.schema",
                     "infra/postgres/bootstrap/control-module-lifecycle.schema",
                     "infra/postgres/bootstrap/control-module-attestation.schema",
                     "infra/postgres/bootstrap/control-module-activation.schema",
                     "infra/postgres/bootstrap/control-module-manager-readonly.schema",
                     "infra/postgres/bootstrap/control-module-events.schema",
                     "scripts/control/module_migrations.py",
                     "apps/core-host/src/module-catalog.ts",
                     "apps/core-host/src/module-lifecycle.ts",
                     "apps/core-host/src/module-effective-access.ts",
                     "apps/master-admin-api/src/modules/tenant-module-inventory.mjs",
                     "packages/core-kernel/src/control-plane-events.ts",
                     "docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md"):
            with self.subTest(path=path):
                self.assertTrue((ROOT/path).is_file(),path)

    def test_sql_migrations_and_contracts_are_not_claimed_live(self):
        script=(ROOT/"scripts/control/module_migrations.py").read_text()
        self.assertIn("006_control_events",script)
        self.assertIn("PLAN ONLY: no Control DB changes",script)
        self.assertIn("SYNDES_CONTROL_MIGRATION_APPLY",script)
        self.assertIn("checksum drift",script)
        api=(ROOT/"apps/master-admin-api/src/modules/tenant-module-inventory.mjs").read_text()
        for term in ("public.module_catalog_versions","public.tenant_module_entitlements",
                     "public.tenant_module_installs"):
            self.assertIn(term,api)
        status=(DOC/"STATUS.md").read_text()
        for term in ("AUDITORIA TÉCNICA PARCIAL","6 PENDING",
                     "control_module_schema_migrations",BASE,
                     "13/11/2026","CP-G01",
                     "active","AUSENTES"):
            self.assertIn(term.lower(),status.lower())

    def test_ownership_and_negative_evidence(self):
        ref=(DOC/"REFERENCIA-TECNICA.md").read_text()
        for term in ("PgModuleCatalog","PgModuleLifecycle",
                     "PgEffectiveModuleAccess","ModuleCatalogPort",
                     "GET /v1/platform/admin/tenants/:id/modules",
                     "A06", "control_events.outbox_events",
                     "24/24", "somente leitura"):
            self.assertIn(term.lower(),ref.lower())
        self.assertIn("não tem `package.json`",ref)
        self.assertIn("sem `INSERT`",ref)
        self.assertIn("podem causar 503",ref)
        self.assertIn("não significa entitlement",ref)
        self.assertIn("não executou",ref)
        chapters=sorted((DOC/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        diagram=(DOC/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text()
        self.assertEqual(diagram.count("```mermaid"),3)

    def test_no_placeholders_or_exposed_runtime_details(self):
        for path in [DOC/"STATUS.md",DOC/"REFERENCIA-TECNICA.md",*sorted((DOC/"chapters").glob("*.md"))]:
            s=path.read_text()
            with self.subTest(page=path.name):
                for placeholder in ("A INVENTARIAR","A RECONCILIAR",
                                    "A DEFINIR","A ELABORAR","A VALIDAR"):
                    self.assertNotIn(placeholder,s)
                self.assertNotRegex(s,r"(?i)postgres(?:ql)?://[^\s]+")
                self.assertNotRegex(s,r"(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)")
        op=(DOC/"OPERACAO.md").read_text()
        self.assertIn("--plan",op)
        self.assertIn("não autoriza",op)
        self.assertIn("não autoriza ddl",op.lower())

    def test_counts_and_exact_order(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("14 STATUS",plan)
        self.assertIn("43 STATUS",plan)
        self.assertIn("seis migrations Control PENDING",plan)
        ids=re.findall(r"^\|\s*\d+\s*\|\s*\[([A-Z]\d{2})\s",plan,re.M)
        self.assertEqual(len(ids),57)
        self.assertEqual(len(set(ids)),57)
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        partial={x["id"] for x in units if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/x["status"]).read_text()}
        self.assertEqual(partial,PARTIAL)

if __name__=="__main__":
    unittest.main()
