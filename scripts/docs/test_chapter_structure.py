#!/usr/bin/env python3
"""Integrity: every unit has unique canonical chapters and update handoff paths."""
import json
from pathlib import Path
import re
import unittest

ROOT=Path(__file__).resolve().parents[2]
UNITS=json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]

class ChapterStructureTests(unittest.TestCase):
    def test_all_subprojects_have_distinct_chapters(self):
        self.assertEqual(len(UNITS),57)
        for u in UNITS:
            with self.subTest(unit=u["id"]):
                d=(ROOT/u["scope"]).parent
                index=(d/"ESCOPO.md").read_text()
                chapters=list((d/"chapters").glob("*.md"))
                self.assertGreaterEqual(len(chapters),8)
                self.assertIn("SYNDES-DOCS-CHAPTER-INDEX:1",index)
                for ch in chapters:
                    self.assertIn("chapters/"+ch.name,index)
                    self.assertIn("## ",ch.read_text())
                self.assertTrue((d/"updates/README.md").is_file())
                self.assertTrue((d/"PROJECAO.md").is_file())
                self.assertTrue((d/"IMPLEMENTACAO.md").is_file())
                self.assertTrue((d/"ALTERACAO.md").is_file())
                self.assertEqual(u["promptAlteration"],(Path(u["scope"]).parent/"ALTERACAO.md").as_posix())
                for key in ("promptProjection","promptImplementation","promptAlteration"):
                    self.assertTrue((ROOT/u[key]).is_file())

    def test_capability_and_user_story_entry_points(self):
        for u in UNITS:
            d=(ROOT/u["scope"]).parent
            inbox=(d/"updates/README.md").read_text()
            self.assertIn("nova capacidade",inbox)
            links=re.findall(r"\]\((\.\./chapters/[^)]+)\)",inbox)
            self.assertGreaterEqual(len(links),2)
            for href in links:
                self.assertTrue((d/"updates"/href).exists(),href)

    def test_no_scaffold_approval_claims(self):
        for u in UNITS:
            d=(ROOT/u["scope"]).parent
            self.assertIn("Após aprovação explícita",(d/"PROJECAO.md").read_text())
            self.assertIn("não execute diretamente uma Issue bruta",(d/"IMPLEMENTACAO.md").read_text())
        self.assertTrue((ROOT/"docs/standards/TEMPLATE-ATUALIZACAO.md").is_file())
        self.assertTrue((ROOT/"docs/standards/TEMPLATE-PROMPT-INCREMENTO.md").is_file())

if __name__=="__main__":
    unittest.main()
