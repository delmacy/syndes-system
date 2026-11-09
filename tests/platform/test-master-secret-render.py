#!/usr/bin/env python3
"""Offline fail-closed tests of scoped OpenBao runtime secret delivery."""
import importlib.util
import io
import json
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import URLError

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "infra/master-admin/openbao/render-master.py"
spec = importlib.util.spec_from_file_location("master_secret_renderer", SRC)
renderer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(renderer)

class Response(io.BytesIO):
    def __enter__(self):
        return self
    def __exit__(self, *_):
        self.close()

class TestMasterSecrets(unittest.TestCase):
    def test_control_only_dsn_and_password_validation(self):
        value = renderer.build_dsn("A" * 42)
        self.assertEqual(value,
            "postgresql://syndes_master_api:" + "A" * 42 +
            "@syndes-control-postgres:5432/syndes_control?sslmode=disable\n")
        for invalid in ["abc", "x" * 31, "x" * 257, "x\nDROP TABLE", "x@" * 32, None]:
            with self.assertRaises(RuntimeError):
                renderer.build_dsn(invalid)

    def exercise(self, *, revoke_ok=True, valid=True):
        calls = []
        with tempfile.TemporaryDirectory() as root:
            dest = Path(root) / "master_db_url"
            def fetch(req, **_):
                route = req.full_url.split("8200", 1)[1]
                calls.append(route)
                if route.endswith("/login"):
                    return Response(json.dumps({"auth":{"client_token":"test-only"}}).encode())
                if route.endswith("/platform-manager"):
                    return Response(json.dumps({"data":{"data":{
                        "master_db_password": "X" * 44 if valid else "short"
                    }}}).encode())
                if route.endswith("/revoke-self"):
                    if not revoke_ok:
                        raise URLError("simulated revoke failure")
                    return Response(b"{}")
                raise AssertionError("Unexpected OpenBao endpoint: " + route)
            with patch.object(renderer, "DEST", dest), \
                 patch.object(renderer, "read_approle", return_value="ci-placeholder"), \
                 patch.object(renderer, "urlopen", side_effect=fetch), \
                 patch.object(renderer.ssl, "create_default_context", return_value=None), \
                 patch.object(renderer.os, "fchown", return_value=None, create=True):
                if valid and revoke_ok:
                    renderer.main()
                    self.assertTrue(dest.is_file())
                    if __import__("os").name != "nt":
                        self.assertEqual(stat.S_IMODE(dest.stat().st_mode), 0o600)
                    self.assertIn("syndes_control?sslmode=disable",dest.read_text())
                else:
                    with self.assertRaises((RuntimeError,URLError)):
                        renderer.main()
                    self.assertFalse(dest.exists(), "Fail-closed: never publish a leaked/stale credential")
        self.assertEqual(calls, [
            "/v1/auth/approle/login",
            "/v1/kv/data/production/platform-manager",
            "/v1/auth/token/revoke-self"
        ])

    def test_success_always_revokes(self):
        self.exercise()
    def test_failed_revoke_never_publishes(self):
        self.exercise(revoke_ok=False)
    def test_invalid_secret_always_revokes(self):
        self.exercise(valid=False)

    def test_policy_is_read_only_and_scoped(self):
        policy=(SRC.parent/"master-runtime.hcl").read_text()
        self.assertIn('kv/data/production/platform-manager',policy)
        self.assertIn('capabilities = ["read"]',policy)
        self.assertIn('auth/token/revoke-self',policy)
        self.assertNotIn('capabilities = ["create"',policy)
        self.assertNotIn('capabilities = ["list"',policy)
        self.assertNotIn('kv/data/production/core-host"',policy)

if __name__ == "__main__":
    unittest.main()
