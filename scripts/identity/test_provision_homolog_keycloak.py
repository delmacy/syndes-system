import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

script = Path(__file__).with_name("provision-homolog-keycloak.py")
spec = importlib.util.spec_from_file_location("syndes_homolog_keycloak", script)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class HomologIdentityTest(unittest.TestCase):
    def test_existing_user_must_match_exact_marker_and_have_no_credentials(self):
        valid = {"username": mod.USER, "enabled": True,
                 "requiredActions": ["UPDATE_PASSWORD"],
                 "email": "syndes-homolog-crm-inbox@example.invalid",
                 "firstName": "Syndes", "lastName": "Homologacao",
                 "attributes": {"syndes-homolog-purpose": [mod.PURPOSE]}}
        mod.assert_identity(valid, [])
        with self.assertRaisesRegex(RuntimeError, "Credentials"):
            mod.assert_identity(valid, [{"type": "password"}])
        with self.assertRaisesRegex(RuntimeError, "dedicated"):
            mod.assert_identity({**valid, "attributes": {}}, [])
        original = {**valid, "attributes": {}, "createdTimestamp": 1794962994000}
        mod.assert_identity(original, [])
        with self.assertRaisesRegex(RuntimeError, "dedicated"):
            mod.assert_identity({**original, "createdTimestamp": 1794960000000}, [])
        with self.assertRaisesRegex(RuntimeError, "dedicated"):
            mod.assert_identity({**original, "email": "collision@example.invalid"}, [])
        with self.assertRaisesRegex(RuntimeError, "dedicated"):
            mod.assert_identity({**valid, "enabled": False}, [])

    def test_check_mode_never_creates_audit_directory(self):
        with patch.object(mod, "RECORD_DIR", Path("/nonexistent/identity-audit-syndes/test")):
            with patch.object(mod, "RECORD_FILE", Path("/nonexistent/identity-audit-syndes/test/user.json")):
                mod.private_record("subject", "check")

    def test_no_password_or_tenant_grants_built_into_provisioner(self):
        source = script.read_text()
        self.assertIn('"requiredActions": ["UPDATE_PASSWORD"]', source)
        self.assertIn('syndes-homolog-purpose', source)
        self.assertIn('os.O_EXCL', source)
        self.assertIn('HOMOLOG_TENANT_MEMBERSHIP_FGA_NOT_PROVISIONED', source)
        for forbidden in ("INSERT INTO tenant_memberships", "CREATE ROLE",
                          "/stores/", '"credentials": [{"type": "password"',
                          "directAccessGrantsEnabled", "docker compose up"):
            self.assertNotIn(forbidden, source)

if __name__ == "__main__":
    unittest.main()
