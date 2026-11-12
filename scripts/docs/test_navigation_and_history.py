#!/usr/bin/env python3
"""Navigation, topic revision and public workflow UI integrity."""
import importlib.util
import json
from pathlib import Path
import unittest

MODULE=Path(__file__).with_name("build_site.py")
spec=importlib.util.spec_from_file_location("syndes_build_site",MODULE)
site=importlib.util.module_from_spec(spec)
spec.loader.exec_module(site)

class NavigationTests(unittest.TestCase):
    def test_navigation_covers_57_units_exactly_once(self):
        units=json.loads((site.DOCS/"subprojects/index.json").read_text())["units"]
        canonical=json.loads((site.ROOT/"catalog/work-units.json").read_text())["units"]
        nav=site.navigation_tree(units,canonical)
        self.assertEqual(len(nav),5)
        # Exactly 3 levels: area > module > page, with headings in document body.
        for area in nav:
            modules=next(iter(area.values()))
            self.assertIsInstance(modules,list)
            for module in modules:
                pages=next(iter(module.values()))
                self.assertEqual(len(pages),9)
                self.assertEqual([next(iter(page)) for page in pages],
                                 ["Visão geral","Escopo","Evolução","Status","Sprint","Atualizações","Projeção / Planejamento","Implementação","Alteração rápida"])
                self.assertTrue(all(isinstance(next(iter(page.values())),str) for page in pages))
        flat=str(nav)
        for unit in units:
            self.assertEqual(flat.count(unit["id"]+" · "+unit["name"]),1)

    def test_invalid_unit_or_group_fails(self):
        units=json.loads((site.DOCS/"subprojects/index.json").read_text())["units"]
        canonical=json.loads((site.ROOT/"catalog/work-units.json").read_text())["units"]
        with self.assertRaises(ValueError):
            site.navigation_tree(units[:-1],canonical)

    def test_topics_have_distinct_git_timestamps(self):
        text="# Overview\n\n## Scope\nold\n\n### Detail\nrecent\n\n## Status\nunchanged\n"
        sections=site.markdown_sections(text)
        self.assertEqual([x["heading"] for x in sections],["Scope","Detail","Status"])
        old="a"*40
        new="b"*40
        revisions=[(100,old)]*len(text.splitlines())
        revisions[6]=(200,new)
        result=site.annotate_revisions(sections,text,revisions)
        self.assertEqual(result[0]["lastCommit"],new)
        self.assertEqual(result[1]["lastCommit"],new)
        self.assertEqual(result[2]["lastCommit"],old)
        self.assertNotIn("endLine",result[0])

    def test_missing_git_history_must_be_explicit(self):
        result=site.annotate_revisions(site.markdown_sections("## Title\nhello\n"),"## Title\nhello\n",[])
        self.assertIsNone(result[0]["lastModified"])
        self.assertIsNone(result[0]["lastCommit"])

if __name__=="__main__":
    unittest.main()
