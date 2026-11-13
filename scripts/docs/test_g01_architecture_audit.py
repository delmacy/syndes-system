"""G01 documentation audit guard: trace sources, keep release states honest."""
from pathlib import Path
import json
import re
import unittest

ROOT = Path(__file__).resolve().parents[2]
G01 = ROOT / "docs/subprojects/G01-arquitetura"
CAT = json.loads((ROOT / "catalog/work-units.json").read_text(encoding="utf-8"))

class G01AuditTests(unittest.TestCase):
    def test_g01_is_documentation_not_runtime_package(self):
        owner=next(u for u in CAT["units"] if u["id"]=="G01")
        self.assertEqual(owner["path"],"docs/engineering")
        reference=(G01/"REFERENCIA-TECNICA.md").read_text()
        self.assertIn("G01 não registra endpoints HTTP",reference)
        self.assertIn("nenhuma tabela/migration própria",reference)
        self.assertIn("não publica nem consome eventos",reference)

    def test_all_architecture_chapters_reconciled_with_sources(self):
        chapters=sorted((G01/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        for chapter in chapters:
            self.assertNotRegex(chapter.read_text(),r"A RECONCILIAR|A INVENTARIAR|A DEFINIR|A VALIDAR|A ELABORAR")
        scope=(G01/"chapters/01-missao-objetivos-e-fronteiras.md").read_text()
        for keyword in ("Kernel","Host","Control","Tenant","WhatsApp","Event Bus","front-shared"):
            self.assertIn(keyword,scope)

    def test_evidence_references_exist_without_owning_others(self):
        expected=[
            "packages/core-kernel/src/index.ts",
            "packages/core-kernel/src/contracts.ts",
            "packages/core-kernel/src/module-registry.ts",
            "apps/core-host/src/module-host.ts",
            "apps/core-host/config/modules.json",
            "modules/inbox/package.json",
            "docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md",
            "docs/engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md"
        ]
        for path in expected:
            with self.subTest(source=path):
                self.assertTrue((ROOT/path).is_file(),path)
        plugins=json.loads((ROOT/"apps/core-host/config/modules.json").read_text())
        self.assertEqual(len(plugins["modules"]),5)
        inbox=json.loads((ROOT/"modules/inbox/package.json").read_text())
        self.assertEqual(inbox["name"],"@syndes/core-inbox")
        self.assertNotIn("G01",plugins["modules"])

    def test_g01_status_is_partial_not_production_acceptance(self):
        status=(G01/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn("b73f42adf47a9b766790f399e13529b470aef171",status)
        for keyword in ("Sem runtime","Não aplicável","não foram executados","aprovação"):
            self.assertIn(keyword.lower(),status.lower())
        self.assertNotIn("G01: DONE",status)
        plan=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        self.assertIn("G01 — Arquitetura",plan)
        self.assertIn("Parcial — fontes/ADRs reconciliadas; aprovação pendente",plan)

if __name__=="__main__":
    unittest.main()
