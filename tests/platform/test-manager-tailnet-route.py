#!/usr/bin/env python3
"""Isolated tests of Platform Manager's immutable Tailnet routing boundary."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "infra" / "master-admin" / "check-tailnet-route.py"
spec = importlib.util.spec_from_file_location("manager_route_gate", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def config(port=9446, proxy="http://127.0.0.1:18085", routes=None):
    host = "fixture.tailnet.ts.net:" + str(port)
    return {
        "TCP": {str(port): {"HTTPS": True}},
        "Web": {host: {"Handlers": routes if routes is not None
                       else {"/": {"Proxy": proxy}}}},
    }


class ManagerRouteChecks(unittest.TestCase):
    def test_empty_configuration_allows_only_preflight(self):
        self.assertTrue(module.check({"TCP": {}, "Web": {}}, "free")[0])
        self.assertFalse(module.check({"TCP": {}, "Web": {}}, "active")[0])

    def test_exact_private_target_is_required(self):
        self.assertTrue(module.check(config(), "active")[0])
        self.assertFalse(module.check(config(), "free")[0])
        self.assertFalse(module.check(config(proxy="http://127.0.0.1:18086"), "active")[0])
        self.assertFalse(module.check(config(proxy="http://0.0.0.0:18085"), "active")[0])

    def test_foreign_route_and_ambiguous_mapping_are_rejected(self):
        self.assertFalse(module.check({"TCP": {"9446": {"HTTPS": True}}, "Web": {}}, "free")[0])
        self.assertFalse(module.check({"TCP": {}, "Web": config()["Web"]}, "free")[0])
        self.assertFalse(module.check({"TCP": {}, "Web": config()["Web"]}, "active")[0])
        other = config()
        other["Web"]["other.tailnet.ts.net:9446"] = other["Web"]["fixture.tailnet.ts.net:9446"]
        self.assertFalse(module.check(other, "active")[0])

    def test_no_extra_routes_no_funnel_no_http(self):
        paths = {"/": {"Proxy": "http://127.0.0.1:18085"},
                 "/admin": {"Proxy": "http://127.0.0.1:8888"}}
        self.assertFalse(module.check(config(routes=paths), "active")[0])
        no_https = config()
        no_https["TCP"]["9446"] = {"HTTP": True}
        self.assertFalse(module.check(no_https, "active")[0])
        public = config()
        public["AllowFunnel"] = {"fixture.tailnet.ts.net:9446": True}
        self.assertFalse(module.check(public, "active")[0])

    def test_invalid_input_never_passes(self):
        for malformed in (None, [], {"TCP": [], "Web": {}}, {"TCP": {}, "Web": []}):
            self.assertFalse(module.check(malformed, "free")[0])
            self.assertFalse(module.check(malformed, "active")[0])

    def test_cli_reads_json_and_does_not_leak_hostname(self):
        for mode, cfg, expected in (
            ("free", {"TCP": {}, "Web": {}}, 0),
            ("active", config(), 0),
            ("free", config(proxy="http://127.0.0.1:18086"), 2),
            ("active", config(proxy="http://127.0.0.1:18086"), 2),
        ):
            with self.subTest(mode=mode, expected=expected):
                run = subprocess.run(
                    [sys.executable, str(SCRIPT), "--mode", mode],
                    input=json.dumps(cfg), text=True, capture_output=True, check=False)
                self.assertEqual(run.returncode, expected, run.stdout + run.stderr)
                self.assertNotIn("fixture.tailnet.ts.net", run.stdout + run.stderr)


if __name__ == "__main__":
    unittest.main()
