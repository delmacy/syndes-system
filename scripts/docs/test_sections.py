#!/usr/bin/env python3
"""Fast integrity tests for the page-local issue editor."""
import importlib.util
import pathlib
import unittest

MODULE = pathlib.Path(__file__).with_name("build_site.py")
spec = importlib.util.spec_from_file_location("syndes_build_site", MODULE)
site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(site)

class TopicsTest(unittest.TestCase):
    def test_nested_sections_are_scoped(self):
        source = "# Book\n\n## Scope\nfirst\n\n### Case\ncase body\n\n## Status\nstatus body\n"
        a = site.markdown_sections(source)
        self.assertEqual([x["heading"] for x in a], ["Scope", "Case", "Status"])
        self.assertIn("### Case", a[0]["markdown"])
        self.assertNotIn("## Status", a[0]["markdown"])
        self.assertNotIn("## Status", a[1]["markdown"])

    def test_headings_inside_code_are_not_topics(self):
        source = "# Manual\n\n## Real\n\n```md\n## Not real\n```\n\n### Actual\ntext\n"
        a = site.markdown_sections(source)
        self.assertEqual([x["heading"] for x in a], ["Real", "Actual"])
        self.assertIn("## Not real", a[0]["markdown"])

    def test_single_heading_page_still_has_editor(self):
        a = site.markdown_sections("# Only\nA page.\n")
        self.assertEqual(len(a), 1)
        self.assertEqual(a[0]["markdown"], "# Only\nA page.\n")

if __name__ == "__main__":
    unittest.main()
