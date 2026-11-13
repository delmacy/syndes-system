"""P14 architecture audit: protect ownership, exact contracts and CMP planning."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[2]
P14=ROOT/"docs/subprojects/P14-platform-core"
SHA="e2c5194a97d48d8a809231d7088be668604725fb"

class P14ContractAudit(unittest.TestCase):
    def test_contract_only_owner_and_no_executable_package(self):
        units=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        p14=next(x for x in units if x["id"]=="P14")
        self.assertEqual(p14["path"],"modules/platform-core")
        self.assertEqual(p14["maturity"],"contract")
        self.assertEqual({p.name for p in (ROOT/"modules/platform-core").iterdir() if p.is_file()},{"AGENTS.md"})
        ref=(P14/"REFERENCIA-TECNICA.md").read_text()
        for item in ("P14 é uma fronteira contratual", "sem package, classes, banco, HTTP ou app",
                     "A08", "A04"):
            self.assertIn(item,ref)

    def test_kernel_public_contracts_are_real_and_private(self):
        kernel=json.loads((ROOT/"packages/core-kernel/package.json").read_text())
        self.assertTrue(kernel["private"])
        self.assertEqual(kernel["name"],"@syndes/core-kernel")
        self.assertEqual(list(kernel["exports"]),["."])
        public=(ROOT/"packages/core-kernel/src/index.ts").read_text()
        for word in ("CoreKernel","ModuleRegistry","defineSyndesModule",
                     "TrustedTenantTransactionProvider","validatePlatformEvent"):
            self.assertIn(word,public)
        ref=(P14/"REFERENCIA-TECNICA.md").read_text()
        self.assertIn("CoreKernel.executeModule",ref)
        self.assertIn("exports[\".\"]",ref)

    def test_host_uses_fixed_trusted_plugins_and_service_not_mounted(self):
        config=json.loads((ROOT/"apps/core-host/config/modules.json").read_text())
        self.assertEqual(config["modules"],[
            "@syndes/core-crm/plugin","@syndes/core-inbox/plugin",
            "@syndes/whatsapp/plugin","@syndes/core-organizations/plugin",
            "@syndes/core-support/plugin"])
        deps=json.loads((ROOT/"apps/core-host/package.json").read_text())["dependencies"]
        self.assertIn("@syndes/service",deps)
        loader=(ROOT/"apps/core-host/src/module-host.ts").read_text()
        for f in ("loadInstalledPlugins","ModuleRegistry","Conflicting module asset routes"):
            self.assertIn(f,loader)
        status=(P14/"STATUS.md").read_text()
        self.assertIn("dependência do Host",status)
        self.assertIn("não está em `config/modules.json`",status)

    def test_documented_history_is_not_claimed_as_current_runtime(self):
        chapters=sorted((P14/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            self.assertNotRegex(chapter.read_text(),
                                r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        status=(P14/"STATUS.md").read_text()
        for phrase in ("AUDITORIA TÉCNICA PARCIAL",SHA,"63 PASS",
                       "19 SKIP","35 PASS","sem implantação",
                       "NÃO é pacote runtime próprio","43345095065"):
            self.assertIn(phrase,status)
        self.assertEqual((P14/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text().count("```mermaid"),3)
        self.assertIn("CMP-01/02",(P14/"STATUS.md").read_text())

    def test_program_counts_stable(self):
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("13 STATUS",plan)
        self.assertIn("44 STATUS",plan)
        self.assertIn("Parcial — contratos/owners reconciliados; perfis CMP não implementados",plan)
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        partial={x["id"] for x in units if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/x["status"]).read_text()}
        self.assertEqual(partial,{"G01","G02","G03","Q10","Q07","Q01","P14","I02","I04","C01","P01","P02","P03"})

if __name__=="__main__":
    unittest.main()
