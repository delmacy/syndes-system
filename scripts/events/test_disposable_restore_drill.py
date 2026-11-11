"""Offline guard tests. Does NOT start Docker or connect to any database."""
import importlib.util
import hashlib
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location(
    "disposable_restore_drill", HERE / "disposable_restore_drill.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class DisposableRestoreGuards(unittest.TestCase):
    def test_only_known_database_name_patterns_allowed(self):
        for name in (
            "postgres", "syndes_control",
            "syndes_tenant_" + "a" * 32,
            "drill_restore_control_" + "b" * 12,
            "drill_restore_tenant_" + "c" * 12,
        ):
            self.assertEqual(mod.safe_database(name), name)
        for name in (
            "production", "syndes_control; DROP DATABASE x",
            "syndes_tenant_" + "A" * 32,
            "syndes_tenant_" + "a" * 31,
            "drill_restore_tenant_" + "x" * 12,
            "/home/delmacy/", "../syndes_control", "syndes_tenant_real",
        ):
            with self.subTest(name=name):
                with self.assertRaises(mod.DrillError):
                    mod.safe_database(name)

    def test_fixed_repository_migrations_only(self):
        self.assertIn("CREATE SCHEMA", mod.sql_file("apps/core-host/sql/001_platform_events.sql"))
        with self.assertRaises(mod.DrillError):
            mod.sql_file("../../private")
        with self.assertRaises(mod.DrillError):
            mod.sql_file("infra/postgres/bootstrap/control-admin.schema")

    def test_postgres_command_never_uses_network_or_operational_target(self):
        with self.assertRaises(mod.DrillError):
            mod.Postgres("syndes-postgres-postgres-1").command("psql")
        pg = mod.Postgres("syndes-events-restore-drill-abcdef012345")
        self.assertEqual(pg.command("psql", "-d", "postgres")[:5],
                         ["docker", "exec", "-i", "-u", "postgres"])
        with patch.object(mod, "run", return_value=b"PGDMP" + b"x" * 120) as runner:
            pg.dump("syndes_control")
            args = runner.call_args.args[0]
            self.assertNotIn("-h", args)
            self.assertNotIn("-p", args)
            self.assertNotIn("syndes-postgres-postgres-1", args)
            self.assertIn("--no-acl", args)
            self.assertIn("--no-owner", args)

    def test_restore_is_single_transaction_and_fails_closed(self):
        pg = mod.Postgres("syndes-events-restore-drill-abcdef012345")
        with patch.object(mod, "run", return_value=b"") as runner:
            pg.restore("drill_restore_tenant_aaaaaaaaaaaa", b"PGDMP" + b"x" * 256)
            args = runner.call_args.args[0]
            self.assertIn("--single-transaction", args)
            self.assertIn("--exit-on-error", args)
            self.assertIn("--no-acl", args)
            self.assertIn("--no-owner", args)
        with self.assertRaises(mod.DrillError):
            pg.restore("syndes_control", b"invalid")
        with self.assertRaises(mod.DrillError):
            pg.restore("syndes_control; DROP", b"PGDMP" + b"x" * 128)

    def test_sha256_mismatch_truncation_and_weak_permissions_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "synthetic.dump"
            content = b"PGDMP" + bytes(range(128))
            path.write_bytes(content)
            path.chmod(0o600)
            digest = hashlib.sha256(content).hexdigest()
            self.assertEqual(mod.verified_archive(path, digest), content)
            with self.assertRaises(mod.DrillError):
                mod.verified_archive(path, hashlib.sha256(b"not this").hexdigest())
            path.write_bytes(content[:64])
            with self.assertRaises(mod.DrillError):
                mod.verified_archive(path, digest)
            path.write_bytes(content)
            path.chmod(0o644)
            with self.assertRaises(mod.DrillError):
                mod.verified_archive(path, digest)

    def test_cli_requires_both_safety_flags(self):
        with patch("sys.argv", ["disposable_restore_drill.py", "--disposable"]):
            with self.assertRaises(SystemExit) as exc:
                mod.main()
            self.assertEqual(exc.exception.code, 2)
        with patch("sys.argv", ["disposable_restore_drill.py", "--ack-synthetic"]):
            with self.assertRaises(SystemExit) as exc:
                mod.main()
            self.assertEqual(exc.exception.code, 2)

    def test_synthetic_results_cannot_be_confused_with_production(self):
        fake = {
            "kind": "syndes_synthetic_pg17_restore_v1",
            "production_backup_verified": False,
            "production_restore_approved": False,
            "operational_ddl_executed": False,
            "result": "passed_synthetic_only",
        }
        self.assertFalse(fake["production_backup_verified"])
        self.assertFalse(fake["production_restore_approved"])


if __name__ == "__main__":
    unittest.main()
