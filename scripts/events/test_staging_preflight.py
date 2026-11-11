import importlib.util
import json
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

source = Path(__file__).with_name("staging_preflight.py")
spec = importlib.util.spec_from_file_location("syndes_events_preflight", source)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

TENANT = "12345678-1234-4234-8234-123456789abc"
DATABASE = "syndes_tenant_" + TENANT.replace("-", "")
ROW = {"tenant_id":TENANT,"database_name":DATABASE,"state":"active"}

def control(**updates):
    record = dict(database="syndes_control",version=170000,migration_ledger=False,
        module_catalog=False,module_entitlements=False,module_installs=False,
        outbox=False,deliveries=False,consumer_inbox=False,tenants=[ROW])
    record.update(updates)
    return record

def tenant(**updates):
    record = dict(database=DATABASE,version=170000,
        organizations=False,workspace=False,whatsapp=False,crm=False,
        inbox=False,outbox=False,deliveries=False,consumer_inbox=False,
        version_constraint=False)
    record.update(updates)
    return record

class ReadinessTests(unittest.TestCase):
    def test_tenant_name_is_derived_from_registered_uuid(self):
        self.assertEqual(mod.expected_database(ROW),DATABASE)
        for value in [{**ROW,"database_name":"syndes_control"},
                      {**ROW,"database_name":"syndes_tenant_foo"},
                      {**ROW,"tenant_id":"../escape"},
                      {**ROW,"database_name":"syndes_tenant_" + "0"*32}]:
            with self.assertRaisesRegex(ValueError,"mapping"):
                mod.expected_database(value)

    def test_psql_target_and_query_are_fixed_and_read_only(self):
        with self.assertRaisesRegex(ValueError,"Target"):
            mod.read_catalog("another-container","syndes_control",mod.CONTROL_SQL)
        with self.assertRaisesRegex(ValueError,"Target"):
            mod.read_catalog(mod.CONTAINER,"postgres",mod.CONTROL_SQL)
        with self.assertRaisesRegex(ValueError,"fixed"):
            mod.read_catalog(mod.CONTAINER,"syndes_control","DELETE FROM tenant_registry")
        proc = subprocess.CompletedProcess([],0,stdout='{"database":"syndes_control"}\n',stderr="")
        with patch.object(mod.subprocess,"run",return_value=proc) as mocked:
            actual = mod.read_catalog(mod.CONTAINER,"syndes_control",mod.CONTROL_SQL)
            self.assertEqual(actual["database"],"syndes_control")
            args=mocked.call_args
            self.assertIn("BEGIN TRANSACTION READ ONLY",args.kwargs["input"])
            self.assertIn("ROLLBACK;",args.kwargs["input"])
            self.assertNotIn("COMMIT;",args.kwargs["input"])
            self.assertEqual(args.args[0][0:3],["docker","exec","-i"])

    def test_previews_are_separate_from_activation(self):
        def fake_catalog(container,db,query):
            if query==mod.CONTROL_SQL: return control()
            self.assertEqual(db,DATABASE)
            return tenant()
        result=mod.inventory(catalog=fake_catalog,probe=lambda _:200)
        self.assertTrue(result["frontend_preview_available"])
        self.assertEqual(result["control"]["migrations_missing"],list(mod.MIGRATIONS))
        self.assertEqual(result["tenant_databases"]["checked"],1)
        self.assertEqual(result["tenant_databases"]["blocked"],1)
        self.assertFalse(result["operational_activation_ready"])
        serialized=json.dumps(result)
        self.assertNotIn(TENANT,serialized)
        self.assertNotIn(DATABASE,serialized)

    def test_even_schema_ready_does_not_invent_backup_or_fga_approval(self):
        def fake_catalog(container,db,query):
            if query==mod.CONTROL_SQL:
                return control(migration_ledger=True,module_catalog=True,
                    module_entitlements=True,module_installs=True,
                    outbox=True,deliveries=True,consumer_inbox=True)
            if query==mod.CONTROL_LEDGER_SQL: return list(mod.MIGRATIONS)
            return tenant(**{k:True for k in
                ("organizations","workspace","whatsapp","crm","inbox","outbox",
                 "deliveries","consumer_inbox","version_constraint")})
        result=mod.inventory(catalog=fake_catalog,probe=lambda _:200)
        self.assertEqual(result["control"]["state"],"schema_objects_and_keys_present_unverified")
        self.assertEqual(result["tenant_databases"]["ready"],1)
        self.assertEqual(result["deployment_gates"]["backup_and_restore"],"requires_operator_evidence")
        self.assertEqual(result["deployment_gates"]["legacy_projector_cutover"],"not_proven")
        self.assertFalse(result["operational_activation_ready"])

    def test_unknown_control_migration_or_invalid_tenant_fails_closed(self):
        def bad_migration(container,db,query):
            if query==mod.CONTROL_SQL:
                return control(migration_ledger=True)
            if query==mod.CONTROL_LEDGER_SQL:
                return [*mod.MIGRATIONS,"999_untrusted"]
            raise AssertionError
        result=mod.inventory(catalog=bad_migration,probe=lambda _:200)
        self.assertEqual(result["control"]["state"],"blocked")

        def bad_mapping(container,db,query):
            return control(tenants=[{**ROW,"database_name":"syndes_control"}])
        result=mod.inventory(catalog=bad_mapping,probe=lambda _:200)
        self.assertEqual(result["control"]["state"],"blocked")
        self.assertEqual(result["tenant_databases"]["checked"],0)

    def test_no_arbitrary_external_http_probe(self):
        with self.assertRaisesRegex(ValueError,"preapproved"):
            mod.local_http("https://example.com")

if __name__=="__main__":
    unittest.main()
