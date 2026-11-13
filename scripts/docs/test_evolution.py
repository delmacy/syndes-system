#!/usr/bin/env python3
"""Validate module evolution indexes and their WBS/source traceability."""
import importlib.util
import json
from pathlib import Path
import unittest

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[1]
spec=importlib.util.spec_from_file_location("syndes_evolution",HERE/"init_evolution.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class EvolutionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.units=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]
        cls.source=json.loads((ROOT/"catalog/evolution-associations.json").read_text())
        cls.packages,cls.tasks=module.parse_master_wbs(ROOT/cls.source["source"])

    def test_master_wbs_parse(self):
        self.assertEqual(len(self.packages),12)
        self.assertEqual(len(self.tasks),102)
        self.assertEqual(self.packages["50"]["gate"],"G5 — fluxo Basic real")
        self.assertEqual(self.tasks["50.03"]["depends"],"50.01")
        self.assertEqual(self.tasks["55.05"]["aliases"],"SM-05")

    def test_every_unit_has_evolution_page_and_link(self):
        self.assertEqual(len(self.units),len(json.loads((ROOT/"catalog/work-units.json").read_text())["units"]))
        self.assertEqual(set(self.source["units"]),{x["id"] for x in self.units})
        for unit in self.units:
            with self.subTest(module=unit["id"]):
                path=ROOT/unit["evolution"]
                self.assertTrue(path.is_file(),unit["id"])
                text=path.read_text()
                self.assertIn("## Workpackages e tarefas existentes",text)
                self.assertIn("## Backlog local e novos workpackages",text)
                self.assertIn("## Próximo incremento e checkpoint",text)
                self.assertIn("SPRINT.md",text)
                self.assertIn("STATUS.md",text)
                self.assertIn("RASCUNHO DE VINCULAÇÃO",text)
                self.assertEqual(unit["evolution"],str(Path(unit["scope"]).parent/"EVOLUCAO.md"))
                self.assertIn("EVOLUCAO.md",(path.parent/"README.md").read_text())

    def test_task_associations_exist_and_cannot_expand_scope(self):
        self.assertEqual(sum(len(u["taskIds"]) for u in self.source["units"].values()),243)
        for unit in self.units:
            links=self.source["units"][unit["id"]]["taskIds"]
            page=(ROOT/unit["evolution"]).read_text()
            self.assertEqual(len(links),len(set(links)),unit["id"])
            for task_id in links:
                self.assertIn(task_id,self.tasks)
                self.assertIn(f"[**{task_id}**]",page)
            for related in self.source["units"][unit["id"]]["relatedPlans"]:
                self.assertTrue((ROOT/related).is_file(),related)
                self.assertIn(related,page)
            self.assertIn("não designações exclusivas de ownership",page)

    def test_initializer_does_not_overwrite_existing_pages(self):
        unit=self.units[0]
        page=ROOT/unit["evolution"]
        existing=page.read_text()
        self.assertTrue(existing.startswith("# "))
        # Only a manual separate command writes pages; the static site build
        # does not rewrite this source and agents can edit it independently.
        self.assertIn("if target.exists():continue",(HERE/"init_evolution.py").read_text())

if __name__=="__main__":
    unittest.main()
