"""Read-only C05 security contract and documentation audit regression gates."""
from pathlib import Path
import json
import re
import sys
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
from audit_consistency import validate as audit
from source_evidence import validate as evidence

BASE=ROOT/"docs/subprojects/C05-secrets-openbao"

class C05AuditTests(unittest.TestCase):
    def test_openbao_server_has_private_raft_and_tls_configuration(self):
        compose=(ROOT/"infra/security-access/compose.yaml").read_text()
        config=(ROOT/"infra/security-access/openbao/config.hcl").read_text()
        self.assertIn("openbao/openbao:2.7.0",compose)
        self.assertIn("openbao_raft",compose)
        self.assertIn("syndes-secrets",compose)
        self.assertIn("tls_cert_file",config)
        self.assertIn("tls_key_file",config)
        self.assertNotIn('tls_disable = true',config)

    def test_core_host_fail_closed_and_renderer_safety_hooks_exist(self):
        core=(ROOT/"apps/core-host/src/secrets.ts").read_text()
        renderer=(ROOT/"infra/security-access/openbao/render_runtime.py").read_text()
        for marker in ("loadCoreSecrets", "roleIdFile", "secretIdFile", "revoke-self",
                       "HTTPS root endpoint", "revocation failed"):
            self.assertIn(marker,core)
        for marker in ("ssl.create_default_context","tempfile.mkstemp",
                       "os.replace","revoke-self","/mnt/runtime"):
            self.assertIn(marker,renderer)
        for policy in ("core-host","core-tenant-db","keycloak","openfga","runtime-delivery"):
            self.assertTrue((ROOT/f"infra/security-access/openbao/policies/{policy}.hcl").is_file())

    def test_c05_witnesses_link_python_and_typescript_to_docs(self):
        self.assertEqual(evidence(ROOT),[])
        manifest=json.loads((ROOT/"docs/evidence/contract-witnesses.json").read_text())
        witnesses=[x for x in manifest["witnesses"] if x["module"]=="C05"]
        self.assertGreaterEqual(len(witnesses),5)
        self.assertTrue(any(x["symbolKind"]=="python-function" for x in witnesses))
        self.assertTrue(all((ROOT/x["source"]).is_file() and (ROOT/x["document"]).is_file()
                            for x in witnesses))

    def test_scope_and_status_are_partial_not_production(self):
        self.assertEqual(audit(ROOT)[1],[])
        status=(BASE/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn("NÃO HOMOLOGADOS",status)
        self.assertIn("C05.SEC.01",status)
        self.assertIn("A06",status)
        self.assertIn("OpenBao", (BASE/"REFERENCIA-TECNICA.md").read_text())
        for p in (BASE/"STATUS.md",BASE/"REFERENCIA-TECNICA.md",BASE/"OPERACAO.md",*(BASE/"chapters").glob("*.md")):
            data=p.read_text()
            for placeholder in ("A INVENTARIAR","A RECONCILIAR","A DEFINIR","A VALIDAR","A ELABORAR"):
                self.assertNotIn(placeholder,data)
            self.assertNotRegex(data,r"(?<!\d)\d{1,3}(?:\.\d{1,3}){3}(?!\d)")
        self.assertEqual(len(list((BASE/"chapters").glob("*.md"))),8)

if __name__=="__main__":unittest.main()
