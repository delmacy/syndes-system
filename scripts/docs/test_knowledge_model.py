#!/usr/bin/env python3
"""Contract tests for Syndes Docs six-page knowledge/project/history portal."""
from pathlib import Path
import json
import sys
import unittest

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
sys.path.insert(0,str(HERE))
import build_site

class KnowledgePortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        cls.catalog=json.loads((ROOT/"catalog/work-units.json").read_text())["units"]

    def test_57_modules_6_page_navigation(self):
        nav=build_site.navigation_tree(self.units,self.catalog)
        self.assertEqual(len(nav),5)
        names=["Visão geral","Especificação","Referência técnica","Evolução","Histórico","Operação"]
        seen=set()
        for area in nav:
            modules=next(iter(area.values()))
            for module in modules:
                name,pages=next(iter(module.items()))
                uid=name.split(" ",1)[0]
                self.assertNotIn(uid,seen)
                seen.add(uid)
                self.assertEqual([next(iter(p)) for p in pages],names)
                for page in pages:
                    rel=Path(next(iter(page.values())))
                    path=build_site.DOCS/rel
                    if path.name=="index.md":
                        path=path.with_name("README.md")
                    self.assertTrue(path.is_file(),path)
        self.assertEqual(seen,{u["id"] for u in self.units})

    def test_all_sources_and_legacy_paths_preserved(self):
        self.assertEqual(len(self.units),57)
        for unit in self.units:
            with self.subTest(uid=unit["id"]):
                base=ROOT/Path(unit["entry"]).parent
                self.assertTrue((ROOT/unit["source"]).exists())
                for field in ("entry","scope","status","sprint","evolution","promptProjection","promptImplementation","promptAlteration",
                              "technicalReference","history","operation"):
                    self.assertTrue((ROOT/unit[field]).is_file(),field)
                self.assertIn("## Mapa documental integrado",(base/"README.md").read_text())
                self.assertIn("## Acompanhamento no GitHub e histórico comprovado",(base/"EVOLUCAO.md").read_text())

    def test_existing_audited_technical_references_untouched(self):
        for uid in ("P01","P04","A04","A08"):
            unit=next(u for u in self.units if u["id"]==uid)
            text=(ROOT/unit["technicalReference"]).read_text()
            self.assertNotIn("INVENTÁRIO DOCUMENTAL NÃO AUDITADO",text)

    def test_trace_links_validate_and_missing_proofs_are_null(self):
        grouped=build_site.read_traceability(self.units)
        total=sum(len(v) for v in grouped.values())
        self.assertEqual(total,4)
        data=json.loads((ROOT/"catalog/traceability-links.json").read_text())
        for record in data["records"]:
            for field in ("issue","pullRequest","commit","testEvidence","deployment","acceptance"):
                self.assertIsNone(record[field],"Do not invent evidence")
            self.assertIn(record["moduleId"],grouped)
            self.assertIn(record,grouped[record["moduleId"]])

    def test_git_commit_history_not_fake_and_bounded(self):
        commits=build_site.tracked_commits(ROOT/"docs/subprojects/P01-crm",3)
        self.assertLessEqual(len(commits),3)
        for item in commits:
            self.assertRegex(item["sha"],r"^[0-9a-f]{40}$")
            self.assertRegex(item["date"],r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")
        self.assertEqual(build_site.tracked_commits(ROOT/"definitely-absent-reference"),[])

    def test_history_and_operation_disclaimers(self):
        for unit in self.units:
            with self.subTest(uid=unit["id"]):
                hist=(ROOT/unit["history"]).read_text()
                ops=(ROOT/unit["operation"]).read_text()
                self.assertIn("<!-- SYNDES-HISTORY-GENERATED -->",hist)
                self.assertIn("<!-- SYNDES-TRACE-GENERATED -->",hist)
                self.assertIn("não",hist.lower())
                self.assertIn("STATUS.md",ops)
                self.assertIn("SPRINT.md",ops)
                self.assertIn("PROJECAO.md",ops)
                self.assertIn("IMPLEMENTACAO.md",ops)
                self.assertIn("ALTERACAO.md",ops)

if __name__=="__main__":
    unittest.main()
