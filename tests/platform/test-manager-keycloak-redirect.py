#!/usr/bin/env python3
"""No-live-account regression for the approved Manager OIDC port migration."""
import importlib.util
from pathlib import Path
import tempfile
import json
import unittest

SOURCE = Path(__file__).resolve().parents[2] / "infra/master-admin/keycloak-redirect-migrate.py"
spec = importlib.util.spec_from_file_location("redirect_migration", SOURCE)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def client(origin):
    return {
        "clientId": "syndes-master-admin", "enabled": True, "publicClient": True,
        "standardFlowEnabled": True, "implicitFlowEnabled": False,
        "directAccessGrantsEnabled": False, "serviceAccountsEnabled": False,
        "attributes": {"pkce.code.challenge.method": "S256"},
        "redirectUris": [origin + "/"], "webOrigins": [origin]
    }


class RedirectMigrationTests(unittest.TestCase):
    def test_exact_tailnet_port_pair(self):
        a, b = module.origins("devserver.example.ts.net.")
        self.assertEqual(a, "https://devserver.example.ts.net:9446")
        self.assertEqual(b, "https://devserver.example.ts.net:9447")

    def test_public_origins_and_invalid_names_denied(self):
        for hostname in ("example.com", "evil.ts.net/@", "evil.ts.net:9446", "",
                         "BAD.ts.net", "x.ts.net;rm -rf /", "../x.ts.net"):
            with self.subTest(hostname=hostname):
                with self.assertRaises(ValueError):
                    module.origins(hostname)

    def test_migration_requires_the_exact_existing_client(self):
        old, new = module.origins("devserver.example.ts.net")
        self.assertTrue(module.verify_client(client(old), old))
        self.assertFalse(module.verify_client(client(old), new))
        self.assertTrue(module.verify_client(client(new), new))
        other = client(old)
        other["clientId"] = "syndes-workspace-ui"
        self.assertFalse(module.verify_client(other, old))

    def test_redirect_cannot_move_to_occupied_real_manager_port(self):
        preview = {"TCP": {"9446": {"HTTPS": True}},
                   "Web": {"preview.ts.net:9446": {"Handlers": {"/": {"Proxy": "http://127.0.0.1:18086"}}}}}
        self.assertTrue(module.destination_unallocated(preview))
        preview["TCP"]["9447"] = {"HTTPS": True}
        self.assertFalse(module.destination_unallocated(preview))
        preview["TCP"].pop("9447")
        preview["Web"]["another.ts.net:9447"] = {"Handlers": {}}
        self.assertFalse(module.destination_unallocated(preview))
        self.assertFalse(module.destination_unallocated({"TCP": [], "Web": {}}))
        self.assertFalse(module.destination_unallocated({"TCP": {}, "Web": []}))

    def test_unsafe_auth_changes_are_rejected(self):
        old, _ = module.origins("devserver.example.ts.net")
        for key, value in (("publicClient", False),
                           ("standardFlowEnabled", False),
                           ("implicitFlowEnabled", True),
                           ("directAccessGrantsEnabled", True),
                           ("serviceAccountsEnabled", True)):
            with self.subTest(key=key):
                value_copy = client(old)
                value_copy[key] = value
                self.assertFalse(module.verify_client(value_copy, old))
        stale = client(old)
        stale["attributes"]["pkce.code.challenge.method"] = "plain"
        self.assertFalse(module.verify_client(stale, old))
        broad = client(old)
        broad["redirectUris"] = [old + "/", "https://evil.test/"]
        self.assertFalse(module.verify_client(broad, old))

    def test_private_audit_creation_and_atomic_update(self):
        with tempfile.TemporaryDirectory() as root:
            record = Path(root) / "redirect-migration.json"
            module.audit_write(record, {"state": "pending"}, create=True)
            self.assertEqual(json.loads(record.read_text())["state"], "pending")
            with self.assertRaises(FileExistsError):
                module.audit_write(record, {"state": "committed"}, create=True)
            module.audit_write(record, {"state": "committed"})
            self.assertEqual(json.loads(record.read_text())["state"], "committed")
            self.assertFalse((Path(root) / ".redirect-migration.json.tmp").exists())


if __name__ == "__main__":
    unittest.main()
