"""Regression for the exact-subject reset and private delivery contract."""
from contextlib import redirect_stdout
from io import StringIO
from pathlib import Path
import runpy
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
RESET = runpy.run_path(str(ROOT / "scripts/identity/reset-manager-demo-password.py"))
SUBJECT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"


class DemoPasswordResetTests(unittest.TestCase):
    def check_reset(self, *, grant=True, username="syndes-manager"):
        with tempfile.TemporaryDirectory() as directory:
            runtime = Path(directory).resolve()
            delivery = runtime / RESET["DELIVERY"]
            updates = []

            def request(_base, route, _token, **options):
                if "/users?" in route:
                    self.assertIn("username=syndes-manager", route)
                    return [{"username": username, "enabled": True, "id": SUBJECT}]
                if route.endswith("/reset-password"):
                    self.assertIn(SUBJECT, route)
                    self.assertEqual(options["method"], "PUT")
                    updates.append(options["payload"])
                    return None
                return {"id": SUBJECT, "requiredActions": ["UPDATE_PASSWORD"]}

            def command(*args):
                self.assertIn(SUBJECT, args[-1])
                return "1" if grant else "0"

            identity = {"command": command, "request": request}
            reset = RESET["reset_password"]
            if not grant or username != "syndes-manager":
                with self.assertRaises(RuntimeError):
                    reset(identity, "fixture", "synthetic-admin-token", runtime)
                self.assertFalse(delivery.exists())
                self.assertFalse(updates)
                return

            output = StringIO()
            with redirect_stdout(output):
                reset(identity, "fixture", "synthetic-admin-token", runtime)
            self.assertEqual(len(updates), 1)
            self.assertIs(updates[0]["temporary"], True)
            self.assertEqual(delivery.read_text().strip(), updates[0]["value"])
            self.assertEqual(delivery.stat().st_mode & 0o777, 0o600)
            self.assertEqual(output.getvalue(), "MANAGER_DEMO_PASSWORD_RESET=PASS\n")
            with self.assertRaisesRegex(RuntimeError, "already exists"):
                reset(identity, "fixture", "synthetic-admin-token", runtime)
            self.assertEqual(len(updates), 1)

    def test_exact_owner_and_private_delivery(self):
        self.check_reset()

    def test_unauthorized_and_wrong_account_denied(self):
        self.check_reset(grant=False)
        self.check_reset(username="different-account")


if __name__ == "__main__":
    unittest.main()
