"""C03 Identity/Keycloak docs must distinguish signed-token code from live auth acceptance."""
from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
DOC = ROOT / "docs/subprojects/C03-identity-keycloak"
BASE = "ac8deb8c538f59364c6247964a5b0d42e5fbae2e"

class C03IdentityKeycloakAudit(unittest.TestCase):
    def test_catalog_and_sources_are_real(self):
        units = json.loads((ROOT / "catalog/work-units.json").read_text())["units"]
        identity = next(unit for unit in units if unit["id"] == "C03")
        self.assertEqual(identity["path"], "infra/security-access")
        self.assertEqual(identity["maturity"], "distributed")
        for relative in (
            "infra/security-access/compose.yaml",
            "infra/security-access/openbao/policies/keycloak.hcl",
            "apps/master-admin-web/src/auth.ts",
            "apps/workspace-web/src/lib/auth.ts",
            "apps/master-admin-api/src/auth.mjs",
            "apps/account-access-api/src/auth.mjs",
            "apps/core-host/src/adapters.ts",
            "infra/master-admin/keycloak-homolog.py",
            "infra/master-admin/keycloak-redirect-migrate.py",
            "tests/platform/platform-manager-keycloak-ci.mjs",
            "tests/platform/test-manager-keycloak-redirect.py",
        ):
            with self.subTest(relative=relative):
                self.assertTrue((ROOT / relative).is_file())
        compose = (ROOT / "infra/security-access/compose.yaml").read_text()
        self.assertIn("quay.io/keycloak/keycloak:26.8.1", compose)
        self.assertIn("syndes_keycloak", compose)
        self.assertIn("keycloak.conf", compose)

    def test_documented_token_boundaries_match_implementation(self):
        manager = (ROOT / "apps/master-admin-api/src/auth.mjs").read_text()
        self.assertIn("createMasterTokenVerifier", manager)
        self.assertIn("payload.azp!==clientId", manager)
        self.assertIn('algorithms:["RS256"]', manager)
        host = (ROOT / "apps/core-host/src/adapters.ts").read_text()
        self.assertIn("verifyClient(", host)
        self.assertIn("this.verifyToken(header,clientId)", host)
        self.assertIn("this.verifyToken(header);", host)
        for path in ("apps/master-admin-web/src/auth.ts", "apps/workspace-web/src/lib/auth.ts"):
            self.assertIn("code_challenge_method", (ROOT / path).read_text())
        ref = (DOC / "REFERENCIA-TECNICA.md").read_text()
        for term in ("PKCE S256", "azp", "iss", "aud", "sub", "OpenFGA",
                     "syndes_keycloak", "verifyClient", "actorFromToken",
                     "não verifica assinatura", "não há `package.json`"):
            with self.subTest(term=term):
                self.assertIn(term.lower(), ref.lower())

    def test_doc_status_not_confused_with_live_realm(self):
        status = (DOC / "STATUS.md").read_text()
        operation = (DOC / "OPERACAO.md").read_text()
        for term in ("AUDITORIA TÉCNICA PARCIAL", "não verificados", "C03.SEC.01",
                     "C03.SEC.02", "E2E", "Up", "C04", BASE):
            self.assertIn(term.lower(), status.lower())
        self.assertIn("não autoriza", operation.lower())
        self.assertIn("não** foi executado teste HTTP OIDC".lower(), operation.lower())
        self.assertIn("Direct Access Grants", operation)
        self.assertEqual(len(list((DOC / "chapters").glob("*.md"))), 8)
        self.assertEqual((DOC / "chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text().count("```mermaid"),1)

    def test_no_placeholders_or_private_material(self):
        for path in [DOC / "STATUS.md", DOC / "REFERENCIA-TECNICA.md", DOC / "OPERACAO.md",
                     *sorted((DOC / "chapters").glob("*.md"))]:
            s = path.read_text()
            with self.subTest(page=path.name):
                for term in ("A INVENTARIAR", "A RECONCILIAR", "A DEFINIR",
                             "A ELABORAR", "A VALIDAR", "NÃO AUDITADO"):
                    self.assertNotIn(term, s)
                self.assertNotRegex(s, r"(?i)(?:postgres(?:ql)?|https?)://[^\s`]+:[^\s`]+@")
                self.assertNotRegex(s, r"(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)")

    def test_plan_and_summary_exact_counts(self):
        plan = (ROOT / "docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("C03 — Identity Keycloak", plan)
        self.assertIn("C03 — Identity Keycloak", plan)
        rows = re.findall(r"^\|\s*\d+\s*\|\s*\[([A-Z]\d{2})\s", plan, re.M)
        self.assertEqual(len(rows),len(json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]))
        self.assertEqual(len(set(rows)),len(rows))

if __name__ == "__main__":
    unittest.main()
