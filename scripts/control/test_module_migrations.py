import hashlib
import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

path = Path(__file__).with_name("module_migrations.py")
spec = importlib.util.spec_from_file_location("syndes_control_migrations", path)
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class ControlMigrationTests(unittest.TestCase):
    def test_pinned_scripts_have_stable_order_and_sha(self):
        files = migration.release_files()
        self.assertEqual([entry[0] for entry in files], [
            "001_catalog", "002_lifecycle", "003_attestation",
            "004_activation", "005_manager_readonly",
        ])
        for _, name, expected, body in files:
            self.assertEqual(expected, hashlib.sha256((migration.BOOT / name).read_bytes()).hexdigest())
            self.assertTrue(body.strip())

    def test_apply_is_transactional_and_version_pinned(self):
        text = migration.apply_sql(migration.release_files(), "a" * 40)
        self.assertLess(text.index("BEGIN;"), text.index("CREATE TABLE IF NOT EXISTS"))
        self.assertIn("SET LOCAL lock_timeout='5s'", text)
        self.assertIn("pg_advisory_xact_lock", text)
        self.assertTrue(text.strip().endswith("SELECT 'CONTROL_MODULE_MIGRATIONS_COMMITTED' AS marker;"))
        self.assertEqual(text.count("\\if :migrate_"), 5)
        self.assertEqual(text.count("\\endif"), 5)
        offsets = [text.index("VALUES('" + entry[0] + "'") for entry in migration.release_files()]
        self.assertEqual(offsets, sorted(offsets))

    def test_checksum_drift_fails_closed(self):
        meta = {"ledger_exists": True, "existing_module_tables": [], "tenants": 0}
        rows = [{"migration_key": "001_catalog", "sha256": "f" * 64}]
        with patch.object(migration, "inventory", return_value=(meta, rows)):
            with self.assertRaisesRegex(RuntimeError, "checksum drift"):
                migration.reconcile("fixture", migration.release_files())

    def test_unexpected_migration_blocks(self):
        meta = {"ledger_exists": True, "existing_module_tables": [], "tenants": 0}
        rows = [{"migration_key": "999_outside", "sha256": "f" * 64}]
        with patch.object(migration, "inventory", return_value=(meta, rows)):
            with self.assertRaisesRegex(RuntimeError, "Unexpected Control migration key"):
                migration.reconcile("fixture", migration.release_files())

    def test_partial_preledger_control_schema_requires_manual_reconciliation(self):
        meta = {"ledger_exists": False, "existing_module_tables": ["module_catalog"], "tenants": 1}
        with patch.object(migration, "inventory", return_value=(meta, [])):
            with self.assertRaisesRegex(RuntimeError, "without migration history"):
                migration.reconcile("fixture", migration.release_files())

    def test_empty_ledger_with_existing_module_tables_blocks(self):
        meta = {"ledger_exists": True, "existing_module_tables": ["module_catalog"], "tenants": 1}
        with patch.object(migration, "inventory", return_value=(meta, [])):
            with self.assertRaisesRegex(RuntimeError, "without migration history"):
                migration.reconcile("fixture", migration.release_files())

    def test_out_of_order_history_blocks(self):
        files = migration.release_files()
        meta = {"ledger_exists": True, "existing_module_tables": [], "tenants": 0}
        rows = [
            {"migration_key": files[0][0], "sha256": files[0][2]},
            {"migration_key": files[2][0], "sha256": files[2][2]},
        ]
        with patch.object(migration, "inventory", return_value=(meta, rows)):
            with self.assertRaisesRegex(RuntimeError, "Out-of-order"):
                migration.reconcile("fixture", files)

    def test_database_and_container_identity_cannot_be_supplied_arbitrarily(self):
        for container, database in [
            ("x; rm -rf /", "syndes_control"),
            ("syndes-ak-fixture", "syndes_tenant_001"),
        ]:
            with self.assertRaisesRegex(ValueError, "Invalid container"):
                migration.psql(container, "SELECT 1", database)

    def test_dedicated_ledger_has_no_runtime_grants(self):
        self.assertIn("REVOKE ALL ON public.control_module_schema_migrations FROM PUBLIC,syndes_core", migration.MIGRATION_SCHEMA)
        self.assertNotIn("GRANT INSERT", migration.MIGRATION_SCHEMA)


if __name__ == "__main__":
    unittest.main()
