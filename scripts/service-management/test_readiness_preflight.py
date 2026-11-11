#!/usr/bin/env python3
"""Service Management staging-readiness safety tests (no Docker required)."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

SOURCE=Path(__file__).with_name("readiness_preflight.py")
spec=importlib.util.spec_from_file_location("syndes_service_readiness",SOURCE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

TENANT="12345678-1234-4234-8234-123456789abc"
DATABASE="syndes_tenant_"+TENANT.replace("-","")
ROW={"tenant_id":TENANT,"database_name":DATABASE,"state":"active"}

def control(*,rows=None,**patches):
    value=dict(database=mod.CONTROL_DB,version=170005,catalog=True,versions=True,
               entitlements=True,installs=True,tenants=rows if rows is not None else [ROW])
    value.update(patches)
    return value

def tenant(**patches):
    value=dict(database=DATABASE,version=170005,runtime_superuser=False,
               **{k:True for k in mod.TENANT_FLAGS})
    value.update(patches)
    return value


class PreflightTests(unittest.TestCase):
    def test_actual_source_is_compatible_but_activating_it_remains_blocked(self):
        source=mod.source_contract()
        self.assertEqual(source["module_version"],"0.3.0")
        self.assertEqual(source["module_id"],"service")
        self.assertTrue(source["source_compatible"],source["blockers"])
        self.assertEqual(source["blockers"],[])
        self.assertTrue(all(source["checks"].values()))
        self.assertIn("to_regclass(\'service.service_attendances\')",mod.TENANT_SQL)
        self.assertIn("schemaname=\'service\'",mod.TENANT_SQL)
        self.assertNotIn("to_regclass(\'public.service_attendances\')",mod.TENANT_SQL)
        self.assertFalse(mod.inventory()["safe_to_install_or_enable"])

    def test_repaired_source_is_recognized_without_mutating_repo(self):
        with tempfile.TemporaryDirectory() as tmp:
            r=Path(tmp)
            paths=(
                "modules/service-management/src/service.ts",
                "modules/service-management/src/plugin.ts",
                "modules/service-management/package.json",
                "modules/service-management/package-lock.json",
                "apps/core-host/src/module-installer.ts",
                "apps/core-host/src/module-host.ts",
                "apps/core-host/config/modules.json",
                "infra/postgres/bootstrap/control-module-catalog.schema",
            )
            for path in paths:
                (r/path).parent.mkdir(parents=True,exist_ok=True)
                text=(mod.ROOT/path).read_text()
                if path.endswith("service.ts"):
                    text=text.replace('moduleId:"service"','moduleId:"service"')
                    text=text.replace('id:"service"','id:"service"')
                if path.endswith("plugin.ts"):
                    text=text.replace('{resource:"service-management:','{resource:"service:')
                if path.endswith("package.json") and "package-lock" not in path:
                    text=text.replace('"name": "@syndes/service"',
                                      '"name": "@syndes/service"')
                (r/path).write_text(text)
            sql_dir=r/"modules/service-management/sql"
            sql_dir.mkdir(parents=True,exist_ok=True)
            for migration in mod.EXPECTED_MIGRATIONS:
                (sql_dir/(migration+".sql")).write_text(
                    "\n".join("CREATE TABLE IF NOT EXISTS service."+name+
                              " (id UUID);" for name in mod.SERVICE_TABLES))
            compatible=mod.source_contract(r)
            self.assertTrue(compatible["source_compatible"],compatible["blockers"])
            self.assertEqual(compatible["module_id"],"service")
            (sql_dir/(mod.EXPECTED_MIGRATIONS[0]+".sql")).write_text(
                "BEGIN;\nCREATE TABLE IF NOT EXISTS service.service_funnels(id UUID);\nCOMMIT;")
            self.assertIn("installer_transaction_safe",mod.source_contract(r)["blockers"])
            (r/"apps/core-host/config/modules.json").write_text(
                '{"modules":["@syndes/service/plugin"]}')
            self.assertIn("runtime_plugin_deliberately_unmounted",
                          mod.source_contract(r)["blockers"])
            (r/"apps/core-host/config/modules.json").write_text('{"modules":[]}')
            (r/"modules/service-management/package.json").write_text(
              (r/"modules/service-management/package.json").read_text()
              .replace('"@syndes/service"','"@syndes/foreign"'))
            self.assertIn("host_package_id_matches_descriptor",
                          mod.source_contract(r)["blockers"])

    def test_readonly_exec_is_fixed_no_arbitrary_sql_or_database(self):
        for target in ("postgres","syndes_control; DROP DATABASE foo","syndes_tenant_bad"):
            with self.assertRaisesRegex(ValueError,"target"):
                mod.read_catalog(mod.CONTAINER,target,mod.TENANT_SQL)
        with self.assertRaisesRegex(ValueError,"target"):
            mod.read_catalog("unknown-container",mod.CONTROL_DB,mod.CONTROL_SQL)
        with self.assertRaisesRegex(ValueError,"statement"):
            mod.read_catalog(mod.CONTAINER,mod.CONTROL_DB,"DELETE FROM tenant_registry")
        with self.assertRaisesRegex(ValueError,"statement"):
            mod.read_catalog(mod.CONTAINER,mod.CONTROL_DB,mod.TENANT_SQL)
        with self.assertRaisesRegex(ValueError,"statement"):
            mod.read_catalog(mod.CONTAINER,DATABASE,mod.CONTROL_SQL)
        fake=subprocess.CompletedProcess([],0,stdout='{"database":"syndes_control"}\n',stderr="")
        with patch.object(mod.subprocess,"run",return_value=fake) as invoked:
            data=mod.read_catalog(mod.CONTAINER,mod.CONTROL_DB,mod.CONTROL_SQL)
            self.assertEqual(data["database"],mod.CONTROL_DB)
            args=invoked.call_args
            self.assertEqual(args.args[0][0:3],["docker","exec","-i"])
            self.assertIn("BEGIN TRANSACTION READ ONLY",args.kwargs["input"])
            self.assertIn("ROLLBACK;",args.kwargs["input"])
            self.assertNotIn("COMMIT;",args.kwargs["input"])
            self.assertNotIn("DELETE",args.kwargs["input"])
            self.assertEqual(args.kwargs["timeout"],12)

    def test_failure_never_prints_db_stderr_or_connection_details(self):
        fake=subprocess.CompletedProcess([],3,stdout="",stderr="secret://password@host")
        with patch.object(mod.subprocess,"run",return_value=fake):
            with self.assertRaisesRegex(RuntimeError,"unavailable") as e:
                mod.read_catalog(mod.CONTAINER,mod.CONTROL_DB,mod.CONTROL_SQL)
            self.assertNotIn("secret",str(e.exception))

    def test_no_operator_access_by_default(self):
        def should_not_call(*args):
            raise AssertionError("offline mode attempted PostgreSQL")
        result=mod.inventory(catalog=should_not_call)
        self.assertEqual(result["mode"],"offline_source_only")
        self.assertEqual(result["tenants"]["checked"],0)
        self.assertFalse(result["safe_to_install_or_enable"])
        self.assertEqual(result["gates"]["physical_migrations"],"not_authorized")

    def test_valid_tenant_mapping_and_untrusted_input_fail_closed(self):
        self.assertEqual(mod.expected_database(ROW),DATABASE)
        for invalid in (
            {**ROW,"tenant_id":"../secrets"},
            {**ROW,"database_name":"syndes_control"},
            {**ROW,"database_name":"syndes_tenant_"+"0"*32},
            {**ROW,"database_name":"syndes_tenant_x"},
        ):
            with self.assertRaisesRegex(ValueError,"mapping"):
                mod.expected_database(invalid)

    def test_live_inventory_flags_and_nonpii_output(self):
        calls=[]
        def catalog(container,db,sql):
            calls.append((db,sql))
            if sql==mod.CONTROL_SQL:return control()
            self.assertEqual(db,DATABASE)
            return tenant()
        report=mod.inventory(catalog=catalog,operational=True)
        self.assertEqual(report["control"]["state"],"schema_present_unverified")
        self.assertEqual(report["tenants"]["checked"],1)
        self.assertEqual(report["tenants"]["schema_inventory_complete"],1)
        self.assertEqual(len(calls),2)
        self.assertFalse(report["safe_to_install_or_enable"])
        serialized=json.dumps(report)
        self.assertNotIn(DATABASE,serialized)
        self.assertNotIn(TENANT,serialized)

    def test_missing_workforce_or_runtime_role_blocks_even_with_tables(self):
        for faulty in (tenant(workforce_roles=False),tenant(runtime_superuser=True),
                       tenant(runtime_superuser=None),tenant(module_ledger=False)):
            report=mod.inventory(operational=True,catalog=lambda c,db,sql:
                control() if sql==mod.CONTROL_SQL else faulty)
            self.assertEqual(report["tenants"]["blocked"],1)
            self.assertFalse(report["safe_to_install_or_enable"])

    def test_invalid_control_mapping_aborts_before_tenant_query(self):
        calls=[]
        def catalog(container,db,sql):
            calls.append(db)
            return control(rows=[ROW,{**ROW,"database_name":"syndes_control"}])
        result=mod.inventory(operational=True,catalog=catalog)
        self.assertEqual(calls,[mod.CONTROL_DB])
        self.assertEqual(result["control"]["state"],"blocked")
        self.assertFalse(result["safe_to_install_or_enable"])
        self.assertNotIn(TENANT,json.dumps(result))

    def test_duplicate_tenant_registry_database_rejected(self):
        result=mod.inventory(operational=True,catalog=lambda c,db,sql:
            control(rows=[ROW,ROW]))
        self.assertEqual(result["control"]["state"],"blocked")
        self.assertEqual(result["tenants"]["checked"],0)

    def test_unavailable_database_fails_closed_without_secrets(self):
        def catalog(container,db,sql):
            if db==mod.CONTROL_DB:return control()
            raise RuntimeError("secret-connection-string")
        report=mod.inventory(operational=True,catalog=catalog)
        self.assertEqual(report["tenants"]["blocked"],1)
        self.assertNotIn("secret",json.dumps(report))
        self.assertNotIn(DATABASE,json.dumps(report))

    def test_all_present_does_not_forge_real_backup_or_fga_evidence(self):
        result=mod.inventory(operational=True,catalog=lambda c,db,sql:
            control() if db==mod.CONTROL_DB else tenant())
        self.assertEqual(result["gates"]["backup_restore_real"],"not_proven")
        self.assertEqual(result["gates"]["keycloak_and_openfga_grants"],"not_proven")
        self.assertFalse(result["safe_to_install_or_enable"])

    def test_cli_operational_probe_requires_both_optin_flags(self):
        for args in (["--local-read-only"],["--ack-catalog"]):
            with patch.object(sys,"argv",["readiness_preflight.py",*args]):
                with contextlib.redirect_stderr(io.StringIO()):
                    with self.assertRaises(SystemExit) as exc:
                        mod.main()
                self.assertEqual(exc.exception.code,2)

    def test_strict_mode_fails_closed_even_offline(self):
        with patch.object(sys,"argv",["readiness_preflight.py","--json","--strict"]):
            with contextlib.redirect_stdout(io.StringIO()) as output:
                self.assertEqual(mod.main(),2)
        report=json.loads(output.getvalue())
        self.assertFalse(report["safe_to_install_or_enable"])
        self.assertTrue(report["read_only"])


if __name__=="__main__":
    unittest.main()
