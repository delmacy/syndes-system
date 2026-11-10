#!/usr/bin/env python3
"""Offline security regressions for one-time OpenBao Manager provisioning.

No admin token, live OpenBao, root privileges or PostgreSQL mutations used.
"""
import importlib.util
from io import StringIO
import ipaddress
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch, Mock

SRC = Path(__file__).resolve().parents[2] / "infra/master-admin/openbao/operator-provision.py"
spec = importlib.util.spec_from_file_location("manager_operator_provision", SRC)
unit = importlib.util.module_from_spec(spec)
spec.loader.exec_module(unit)


class OperatorProvisionTests(unittest.TestCase):
    def test_only_safe_random_base64url_sql_password_is_accepted(self):
        value = "aB123_-xyz" * 5
        self.assertEqual(unit.checked_password(value), value)
        sql = unit.sql_password_change(value)
        self.assertEqual(sql, "ALTER ROLE syndes_master_api PASSWORD '" + value + "';\n")
        self.assertNotIn("tenant", sql)
        for invalid in ("", "short", None, "A" * 257, "x'--" * 10,
                        "x" * 20 + "\n" + "y" * 20, "é" * 40,
                        "X" * 36 + ";"):
            with self.subTest(invalid=str(invalid)[:12]):
                with self.assertRaises(ValueError):
                    unit.sql_password_change(invalid)

    def test_sql_password_only_sent_to_child_stdin_not_arguments(self):
        password = "S" * 44
        called = []
        def child(argv, **kwargs):
            called.append((argv, kwargs))
            return Mock(returncode=0)
        with patch.object(unit.subprocess, "run", side_effect=child), \
             patch.object(unit, "pg_scalar", return_value="true"):
            unit.postgres_set_password(password)
        args, opts = called[0]
        self.assertNotIn(password, repr(args))
        self.assertIn(password, opts["input"])
        self.assertTrue(opts["capture_output"])
        self.assertEqual(args[0:3], ["docker", "exec", "-i"])

    def test_runtime_uses_exact_dedicated_roles_and_paths(self):
        self.assertEqual(unit.APPROLE_NAME, "syndes-platform-manager")
        self.assertEqual(unit.POLICY_NAME, "syndes-platform-manager-runtime")
        self.assertEqual(unit.KV_PATH, "/v1/kv/data/production/platform-manager")
        self.assertEqual(unit.AUTH_DIR.as_posix(), "/run/syndes/approle/platform-manager")
        self.assertEqual(unit.RUNTIME_DIR.as_posix(), "/run/syndes/platform-manager")
        template=(SRC.parent/"master-runtime.hcl").read_text(encoding="utf-8")
        self.assertIn('path "kv/data/production/platform-manager"', template)
        self.assertIn('capabilities = ["read"]', template)
        for prohibited in ('path "kv/data/production/core-host',
                           'path "kv/data/production/tenant',
                           'path "kv/data/production/keycloak',
                           'path "kv/data/production/openfga',
                           "syndes_account_api", 'capabilities = ["create"]'):
            self.assertNotIn(prohibited, template)

    def test_preflight_requires_internal_bridge_and_single_openbao(self):
        expected = [{"Internal": True, "Containers": {
            "1": {"Name": "syndes-security-access-openbao-1", "IPv4Address": "172.22.0.2/16"},
            "2": {"Name": "syndes-security-access-keycloak-1", "IPv4Address": "172.22.0.3/16"}}}]
        with patch.object(unit, "docker_output", return_value=json.dumps(expected)):
            self.assertEqual(unit.trusted_openbao_ip(), "172.22.0.2")
        for invalid in (
            [{"Internal": False, "Containers": expected[0]["Containers"]}],
            [{"Internal": True, "Containers": {}}],
            [{"Internal": True, "Containers": {"1": {"Name": "syndes-security-access-openbao-1", "IPv4Address": "8.8.8.8/32"}}}],
            [{"Internal": True, "Containers": {"1": {"Name": "syndes-security-access-openbao-1", "IPv4Address": "172.22.0.2/16"},
                                                    "2": {"Name": "syndes-security-access-openbao-1", "IPv4Address": "172.22.0.3/16"}}}]
        ):
            with patch.object(unit, "docker_output", return_value=json.dumps(invalid)):
                with self.assertRaises(RuntimeError):
                    unit.trusted_openbao_ip()

    def test_transport_pins_sni_and_token_in_https_header(self):
        events = {}
        class FakeContext:
            def wrap_socket(self, socket, server_hostname):
                events["server_hostname"] = server_hostname
                return Mock()
        class FakeConn:
            def __init__(self, host, port, context, timeout):
                events["endpoint"] = (host, port)
            def request(self, method, path, body, headers):
                events["method"] = method
                events["path"] = path
                events["header"] = headers
            def getresponse(self):
                return Mock(status=403, read=lambda: b'{"error":"SENSITIVE_PAYLOAD"}')
            def close(self):
                pass
        with patch.object(unit.ssl, "create_default_context", return_value=FakeContext()), \
             patch.object(unit.socket, "create_connection", return_value=Mock()), \
             patch.object(unit.http.client, "HTTPSConnection", FakeConn):
            client = unit.Bao("172.22.0.2", Path("/safe/ca.crt"), "TEST_ADMIN_SECRET")
            with self.assertRaises(RuntimeError) as context:
                client.request("GET", "/v1/sys/auth")
        self.assertEqual(events["server_hostname"], "openbao")
        self.assertEqual(events["endpoint"], ("openbao", 8200))
        self.assertEqual(events["header"]["X-Vault-Token"], "TEST_ADMIN_SECRET")
        self.assertNotIn("TEST_ADMIN_SECRET", str(context.exception))
        self.assertNotIn("SENSITIVE_PAYLOAD", str(context.exception))

    def test_secret_files_create_only_and_do_not_overwrite(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/"secret-id"
            unit.private_file(path, "TEST_ONLY_SECRET_ID")
            self.assertEqual(path.read_text(), "TEST_ONLY_SECRET_ID\n")
            with self.assertRaises(FileExistsError):
                unit.private_file(path, "OVERWRITE_ATTEMPT")
            self.assertEqual(path.read_text(), "TEST_ONLY_SECRET_ID\n")
            for bad in ("", "a\nb", "a" * 513):
                with self.assertRaises(RuntimeError):
                    unit.private_file(Path(directory)/"other-id", bad)
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777, 0o600)

    def test_audit_is_create_once_and_never_contains_secret_values(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)/"audit"
            root.mkdir(mode=0o700)
            record = root/"bootstrap-audit.json"
            with patch.object(unit, "AUDIT_DIR", root), patch.object(unit, "AUDIT_PATH", record), \
                 patch.object(unit, "ensure_private", lambda p: None):
                unit.write_audit({"operation": "ci-only", "state": "started"}, initial=True)
                with self.assertRaises(FileExistsError):
                    unit.write_audit({"operation": "ci-only", "state": "overwritten"}, initial=True)
                unit.write_audit({"operation": "ci-only", "state": "complete"})
                self.assertEqual(json.loads(record.read_text())["state"], "complete")
                self.assertFalse((root/".bootstrap-audit.pending").exists())

    def test_preflight_does_not_request_operator_token(self):
        with patch.object(unit, "operator_preflight", return_value="172.22.0.2"), \
             patch.object(unit.getpass, "getpass", side_effect=AssertionError("no token prompt expected")), \
             patch.object(sys, "argv", ["program", "--preflight"]):
            unit.main()


if __name__ == "__main__":
    unittest.main()
