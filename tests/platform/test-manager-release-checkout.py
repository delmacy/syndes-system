#!/usr/bin/env python3
"""Fail-closed contract for Manager's two explicitly approved release checkouts.

No privileged command is executed. The existing homolog checkout remains
available, and an immutable release worktree can be prepared independently.
"""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
DEPLOY=(ROOT/"infra/master-admin/homolog-deploy.sh").read_text()
STOP=(ROOT/"infra/master-admin/homolog-stop.sh").read_text()
APPROVED=("/home/delmacy/syndes-platform-manager-homolog",
          "/home/delmacy/syndes-platform-manager-release")


class DedicatedCheckoutTests(unittest.TestCase):
    def test_root_is_canonical_and_exactly_whitelisted(self):
        self.assertIn('repo="$(pwd -P)"',DEPLOY)
        self.assertIn('case "$repo" in',DEPLOY)
        self.assertIn('case "$(pwd -P)" in',STOP)
        for name in APPROVED:
            with self.subTest(name=name):
                self.assertIn(name,DEPLOY)
                self.assertIn(name,STOP)
        for script in (DEPLOY,STOP):
            self.assertIn("*) ",script)
            self.assertNotIn("syndes-platform-manager-*",script)

    def test_deploy_preflight_checks_before_any_runtime_mutation(self):
        self.assertLess(DEPLOY.index('case "$repo" in'),DEPLOY.index('docker build'))
        self.assertLess(DEPLOY.index('source_sha='),DEPLOY.index('docker build'))
        self.assertLess(DEPLOY.index('git -c safe.directory='),DEPLOY.index('docker build'))
        self.assertIn('check-tailnet-route.py',DEPLOY)
        self.assertIn('--mode free',DEPLOY)
        self.assertIn('source_sha',DEPLOY)
        self.assertIn('master_db_url',DEPLOY)

    def test_stop_requires_ownership_before_disabling_route(self):
        self.assertIn('check-tailnet-route.py',STOP)
        self.assertIn('--mode active',STOP)
        self.assertIn('--mode free',STOP)
        self.assertIn('refusing blind shutdown',STOP)
        self.assertLess(STOP.index('case "$(pwd -P)" in'),STOP.index('docker compose'))


if __name__=="__main__":
    unittest.main()
