#!/usr/bin/env python3
"""No-live-credentials unit tests for one-time first-owner bootstrap."""
import importlib.util
from io import BytesIO
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SRC=Path(__file__).resolve().parents[2]/"infra/master-admin/bootstrap-owner.py"
spec=importlib.util.spec_from_file_location("platform_owner_bootstrap",SRC)
unit=importlib.util.module_from_spec(spec)
spec.loader.exec_module(unit)

SUB="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"

class Stream(BytesIO):
    def __enter__(self): return self
    def __exit__(self,*_): self.close()

class BootstrapTests(unittest.TestCase):
    def test_sub_must_be_immutable_lowercase_uuid(self):
        self.assertEqual(unit.validate_sub(SUB),SUB)
        for value in ["",None,"a","' OR 1=1 --","1"*60,"\n"+SUB,
                      SUB.upper(),"00000000-0000-0000-0000-000000000000"]:
            with self.assertRaises(ValueError):
                unit.validate_sub(value)

    def test_transaction_is_one_time_and_serialized(self):
        script=unit.sql_for_bootstrap(SUB)
        self.assertIn("BEGIN;",script)
        self.assertIn("LOCK TABLE platform_operator_access IN EXCLUSIVE MODE",script)
        self.assertIn("IF EXISTS (SELECT 1 FROM platform_operator_access)",script)
        self.assertIn("VALUES ('"+SUB+"','owner','active')",script)
        self.assertIn("COMMIT;",script)
        self.assertNotIn("tenant_memberships",script)
        with self.assertRaises(ValueError):
            unit.sql_for_bootstrap("x');DROP TABLE platform_operator_access;--")

    def test_keycloak_identity_proof(self):
        requests=[]
        def request(req,**_):
            requests.append(req.full_url)
            if "/token" in req.full_url:
                return Stream(json.dumps({"access_token":"signed-ci-fixture"}).encode())
            return Stream(json.dumps({"id":SUB,"enabled":True}).encode())
        with patch.object(unit,"urlopen",side_effect=request):
            self.assertTrue(unit.keycloak_active(SUB,18080,{"bootstrap-admin-username":"ci-admin","bootstrap-admin-password":"ci-secret"}))
        self.assertIn("/admin/realms/syndes/users/"+SUB,requests[-1])
        self.assertTrue(requests[0].startswith("http://127.0.0.1:18080/"))
        with patch.object(unit,"urlopen",side_effect=[
            Stream(json.dumps({"access_token":"ci"}).encode()),
            Stream(json.dumps({"id":SUB,"enabled":False}).encode())
        ]):
            self.assertFalse(unit.keycloak_active(SUB,18080,{"bootstrap-admin-username":"ci-admin","bootstrap-admin-password":"ci-secret"}))

    def test_audit_record_atomic_and_private(self):
        with tempfile.TemporaryDirectory() as root:
            path=Path(root)/"audit.json"
            path.write_text('{"status":"pending"}')
            unit.audit_update(path,{"status":"committed","keycloak_sub":SUB})
            self.assertEqual(json.loads(path.read_text())["status"],"committed")
            self.assertFalse((Path(root)/".audit.json.new").exists())
            if os.name != "nt":
                self.assertEqual(path.stat().st_mode & 0o777,0o600)

if __name__=="__main__":
    unittest.main()
