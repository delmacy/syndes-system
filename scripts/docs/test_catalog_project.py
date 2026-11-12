"""Contract tests for source registry and Projects synchronization without network calls."""
from pathlib import Path
import json
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts/docs"))
import code_inventory
import query_registry
import sync_github_project

UNITS={u["id"]:u for u in json.loads((ROOT/"docs/subprojects/index.json").read_text())["units"]}
class CatalogAndProjectTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.crm=code_inventory.open_source_symbols(UNITS["P01"])
        cls.wa=code_inventory.open_source_symbols(UNITS["P03"])
        cls.infra=code_inventory.open_source_symbols(UNITS["I02"])
    def test_source_inventory_distinguishes_public_and_internal(self):
        self.assertIn(".",self.crm["exports"])
        self.assertTrue(any(x["name"]=="CrmService" for x in self.crm["declared"]))
        self.assertTrue(any(x["exposure"]=="internal-declaration" for x in self.crm["declared"]))
        self.assertTrue(any(x["exposure"]=="entrypoint-candidate" for x in self.crm["declared"]))
        self.assertTrue(any(x["name"]=="crm_people" for f in self.crm["sql"] for x in f["tables"]))
        self.assertTrue(all((ROOT/x["file"]).is_file() for x in self.crm["declared"]))
    def test_gateway_and_frontend_are_scoped_to_whatsapp(self):
        self.assertGreater(len(self.wa["go"]),2)
        self.assertTrue(any("whatsmeow" in x["file"] for x in self.wa["go"]))
        self.assertTrue(any(x["app"]=="workspace-web" for x in self.wa["frontendCandidates"]))
        self.assertEqual(self.infra["filesScanned"],0)
        self.assertFalse(self.infra["declared"])
    def test_search_only_matches_named_symbols(self):
        units=list(UNITS.values())
        a=query_registry.search(units,module="P01",symbol="CrmService")
        self.assertEqual(len(a),1)
        self.assertTrue(any(x["name"]=="CrmService" for x in a[0]["matches"]["symbol"]))
        self.assertEqual(query_registry.search(units,module="P01",symbol="unlisted_imaginary_class"),[])
        self.assertEqual(query_registry.search(units,module="P03",method="dispatch"),[])
        self.assertEqual(len(query_registry.search(units,module="I09")),1) # exact ID may access legacy component
        self.assertEqual(len(query_registry.search(units,module="I09",include_components=True)),1)
    def test_search_splits_infrastructure_from_quality(self):
        infra=query_registry.search(list(UNITS.values()),area="infraestrutura")
        quality=query_registry.search(list(UNITS.values()),area="qualidade")
        self.assertTrue(infra and quality)
        self.assertTrue(all(x["moduleId"].startswith("I") for x in infra))
        self.assertTrue(all(not x["moduleId"].startswith("I") for x in quality))
        self.assertFalse({x["moduleId"] for x in infra}&{x["moduleId"] for x in quality})

    def test_human_homepages_have_fixed_anchors_and_legacy_preserved(self):
        self.assertEqual(len(UNITS),57)
        for uid,u in UNITS.items():
            with self.subTest(uid=uid):
                text=(ROOT/u["entry"]).read_text()
                self.assertIn("<!-- syndes:module-id="+uid+";",text)
                for heading in ("{#acessos}","{#capacidades}","{#stack}","{#evolucao}","{#agentes}"):
                    self.assertIn(heading,text)
                self.assertIn('??? info "Abrir instruções anteriores',text)
                self.assertIn("query_registry.py --module "+uid,text)
    def test_project_url_validation(self):
        self.assertEqual(sync_github_project.parse_project("https://github.com/users/delmacy/projects/7"),
                         ("users","delmacy",7))
        self.assertEqual(sync_github_project.parse_project("https://github.com/orgs/Syndes/projects/1"),
                         ("orgs","Syndes",1))
        for invalid in ("https://example.com/users/delmacy/projects/1","https://github.com/users/delmacy/projects/x",""):
            with self.assertRaises(ValueError):sync_github_project.parse_project(invalid)
    def test_project_cursor_pagination_and_repositories(self):
        link='<https://api.github.com/users/delmacy/projectsV2/1/items?per_page=100&after=abc>; rel="next"'
        self.assertEqual(sync_github_project.next_page_path(link),
                         "/users/delmacy/projectsV2/1/items?per_page=100&after=abc")
        self.assertIsNone(sync_github_project.next_page_path(""))
        with self.assertRaises(ValueError):
            sync_github_project.next_page_path('<https://evil.example/items>; rel="next"')
        seen=[]
        def pages(token,method,path,with_link=False):
            seen.append((method,path,with_link))
            if "after=abc" in path:return ([{"number":2}], "")
            return ([{"number":1}],link)
        with patch.object(sync_github_project,"api_request",side_effect=pages):
            self.assertEqual(len(sync_github_project.collect_pages("token","/users/delmacy/projectsV2/1/items")),2)
        self.assertEqual(len(seen),2)
        self.assertTrue(all(x[2] for x in seen))
        self.assertEqual(sync_github_project.issue_key({"content":{"number":108,"repository_url":
                         "https://api.github.com/repos/other/repo"}}),("other/repo",108))

    def test_idempotent_project_import(self):
        issues=[{"number":107,"title":"DOC-01"},{"number":108,"title":"DOC-02"}]
        existing=[{"content":{"type":"Issue","number":107,
                              "repository_url":"https://api.github.com/repos/delmacy/syndes-system"},"id":1},
                  {"content":{"type":"Issue","number":108,
                              "repository_url":"https://api.github.com/repos/other/repo"},"id":2}]
        calls=[]
        def pages(token,path):
            return issues if path.startswith("/repos/") else existing
        def api(token,method,path,payload=None):
            calls.append((method,path,payload))
            return {}
        with patch.object(sync_github_project,"collect_pages",side_effect=pages),patch.object(sync_github_project,"api_request",side_effect=api):
            self.assertEqual(sync_github_project.sync("delmacy/syndes-system","https://github.com/users/delmacy/projects/1","fake",dry_run=False),1)
        self.assertEqual(len(calls),1)
        self.assertEqual(calls[0][2]["number"],108)
        self.assertIn("projectsV2/1/items",calls[0][1])
        calls.clear()
        with patch.object(sync_github_project,"collect_pages",side_effect=pages),patch.object(sync_github_project,"api_request",side_effect=api):
            self.assertEqual(sync_github_project.sync("delmacy/syndes-system","https://github.com/users/delmacy/projects/1","fake",dry_run=True),1)
        self.assertEqual(calls,[])
if __name__=="__main__":unittest.main()
