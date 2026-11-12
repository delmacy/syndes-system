"""Module agent path isolation checks; shared code owners fail closed."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
SPEC=importlib.util.spec_from_file_location("verify_module_scope",ROOT/"scripts/docs/verify_module_scope.py")
guard=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(guard)

class ScopeGuardTests(unittest.TestCase):
    def test_whatsapp_can_edit_owned_gateway_and_docs_but_not_other_modules(self):
        u=guard.UNITS["P03"]
        own=["modules/whatsapp/src/plugin.ts","modules/whatsapp/gateway/whatsmeow/README.md",
             "docs/subprojects/P03-whatsapp/STATUS.md"]
        self.assertEqual(guard.verify_changed_paths(u,own),[])
        foreign=["modules/core-crm/src/contacts.ts","apps/core-host/src/host.ts",".github/workflows/syndes-ci.yml",
                 "docs/subprojects/P02-inbox/STATUS.md"]
        self.assertEqual(guard.verify_changed_paths(u,foreign),foreign)

    def test_shared_and_broad_source_roots_fail_closed(self):
        core=guard.UNITS["A04"]
        self.assertIn("apps/core-host/src/main.ts",
            guard.verify_changed_paths(core,["apps/core-host/src/main.ts"]))
        infra=guard.UNITS["I02"]
        self.assertIn("infra/postgres/bootstrap/001.sql",
            guard.verify_changed_paths(infra,["infra/postgres/bootstrap/001.sql"]))
        postgres=guard.UNITS["I04"]
        self.assertEqual(guard.verify_changed_paths(postgres,["infra/postgres/README.md"]),[])
        self.assertEqual(guard.verify_changed_paths(core,["docs/subprojects/A04-core-host/STATUS.md"]),[])

    def test_path_traversal_and_absolute_path_are_denied(self):
        u=guard.UNITS["P01"]
        self.assertEqual(len(guard.verify_changed_paths(u,["../modules/core-crm/src/a.ts",
                 "/modules/core-crm/src/b.ts","modules/core-crm/../inbox/x.ts"])),3)

if __name__=="__main__":unittest.main()
