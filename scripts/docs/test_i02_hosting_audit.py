"""I02: environment evidence is dated, redacted and not mistaken for production."""
from pathlib import Path
import json
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
I02=ROOT/"docs/subprojects/I02-server02"
BASE="9ac228e8cb21cb37f5c6892063dfdbc3d0238f20"
PARTIAL={"G01","G02","G03","Q10","Q07","Q01","P14","I02","P01","P02","P03"}

class I02HostingEvidenceAudit(unittest.TestCase):
    def test_catalog_owner_and_no_saas_api(self):
        units=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]
        i02=next(x for x in units if x["id"]=="I02")
        self.assertEqual(i02["path"],"infra")
        self.assertEqual(i02["maturity"],"unverified")
        self.assertIn("I02 não possui frontend ou API de produto",
                      (I02/"chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md").read_text())

    def test_real_sources_and_observed_versus_declared(self):
        for path in ("infra/README.md","infra/postgres/compose.yaml",
                     "infra/security-access/compose.yaml","infra/master-admin/compose.yaml",
                     "apps/core-host/compose.yaml","modules/whatsapp/deploy/compose.yaml",
                     "docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md",
                     "scripts/events/disposable_restore_drill.py"):
            with self.subTest(path=path):
                self.assertTrue((ROOT/path).is_file(),path)
        doc=(I02/"REFERENCIA-TECNICA.md").read_text()
        for token in ("16 em estado Up","8 projetos Compose","2 avulsos",
                      "**13** ao todo","**19 volumes**","2 healthy",
                      "NÃO VERIFICADO","43350764378","secrets",
                      "somente leitura","{#ambientes-e-hospedagem}",BASE):
            with self.subTest(token=token):
                self.assertIn(token,doc)

    def test_no_unverified_production_or_secret_leak(self):
        status=(I02/"STATUS.md").read_text()
        self.assertIn("AUDITORIA TÉCNICA PARCIAL",status)
        self.assertIn("offline no conector",status)
        self.assertIn("NÃO VERIFICADOS",status)
        self.assertIn("não apagar nem migrar automaticamente",status)
        self.assertIn("docker",status.lower())
        pages=[I02/"REFERENCIA-TECNICA.md",I02/"STATUS.md",
               *sorted((I02/"chapters").glob("*.md"))]
        for page in pages:
            s=page.read_text()
            with self.subTest(page=page.name):
                self.assertNotRegex(s,r"(?<!\d)(?:\d{1,3}\.){3}\d{1,3}(?!\d)")
                self.assertNotRegex(s,r"(?i)postgres(?:ql)?://[^\s]+")
                self.assertNotIn("A INVENTARIAR",s)
                self.assertNotIn("A RECONCILIAR",s)

    def test_legacy_names_are_reconciled_without_path_changes(self):
        self.assertTrue((I02/"README.md").is_file())
        for name in ("SPRINT.md","EVOLUCAO.md","HISTORICO.md","updates/README.md"):
            with self.subTest(name=name):
                self.assertTrue((I02/name).read_text().startswith("# I02 — Hospedagem e ambientes"))
        chapters=sorted((I02/"chapters").glob("*.md"))
        self.assertEqual(len(chapters),8)
        operations=(I02/"OPERACAO.md").read_text()
        self.assertIn("docker ps --format",operations)
        self.assertIn("não",operations.lower())

    def test_planning_has_unique_ids_and_exact_partial_count(self):
        text=(ROOT/"docs/blueprint/PLANO-ATUALIZACAO-MODULOS.md").read_text()
        rows=re.findall(r"^\|\s*(\d+)\s*\|\s*\[([A-Z]\d{2})\s",text,re.M)
        self.assertEqual(len(rows),57)
        self.assertEqual(len(set(uid for _,uid in rows)),57)
        self.assertEqual(sum(uid=="I01" for _,uid in rows),1)
        self.assertEqual([int(n) for n,_ in rows],list(range(1,58)))
        self.assertIn("11 STATUS",text)
        self.assertIn("46 STATUS",text)
        self.assertIn("16 containers DevServer01 observados",text)
        units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        self.assertEqual(len(units),57)
        partial={x["id"] for x in units
                 if "AUDITORIA TÉCNICA PARCIAL" in (ROOT/x["status"]).read_text()}
        self.assertEqual(partial,PARTIAL)

if __name__=="__main__":
    unittest.main()
