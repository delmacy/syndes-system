import importlib.util
from pathlib import Path
import unittest

source = Path(__file__).with_name("homolog-readiness.py")
spec = importlib.util.spec_from_file_location("homolog_readiness", source)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class HomologReadinessTests(unittest.TestCase):
    def test_client_must_use_code_pkce_and_https_exact_origins(self):
        good = {"enabled":True, "publicClient":True, "standardFlowEnabled":True,
                "implicitFlowEnabled":False, "directAccessGrantsEnabled":False,
                "serviceAccountsEnabled":False,
                "attributes":{"pkce.code.challenge.method":"S256"},
                "redirectUris":["https://homolog.example.invalid/callback"],
                "webOrigins":["https://homolog.example.invalid"]}
        self.assertTrue(mod.valid_client(good))
        for field, value in (("directAccessGrantsEnabled",True),
                             ("redirectUris",["https://homolog.example.invalid/*"]),
                             ("redirectUris",["http://localhost/callback"]),
                             ("webOrigins",["*"]),
                             ("implicitFlowEnabled",True),
                             ("attributes",{})):
            self.assertFalse(mod.valid_client({**good,field:value}))

    def test_no_write_api_or_operational_mutation(self):
        data = source.read_text()
        for token in ("INSERT INTO", "UPDATE tenant_", "DELETE FROM",
                      "docker run", "docker compose", "docker restart",
                      "docker build", "/stores/", "reset-password",
                      "set-password", "CREATE DATABASE"):
            self.assertNotIn(token, data)
        self.assertIn("HOMOLOG_READONLY_NO_MUTATION=PASS",data)
        self.assertIn("HOMOLOG_DEDICATED_TENANT_ATTESTATION=NOT_AVAILABLE",data)

if __name__ == "__main__":
    unittest.main()
