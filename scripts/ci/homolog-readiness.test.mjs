import test from "node:test";
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {readFileSync} from "node:fs";

test("sanitized operational homologation inventory has isolated validation",()=>{
  const result=spawnSync("python3",["scripts/identity/test_homolog_readiness.py"],{encoding:"utf8"});
  assert.equal(result.status,0,result.stderr||result.stdout);
});

test("inventory has no operational mutations and uses only private subject",()=>{
  const source=readFileSync("scripts/identity/homolog-readiness.py","utf8");
  for(const guard of [
    "HOMOLOG_READONLY_NO_MUTATION=PASS",
    "HOMOLOG_DEDICATED_TENANT_ATTESTATION=NOT_AVAILABLE",
    "HOMOLOG_PRODUCT_GATE=OPEN",
    "tenant_memberships",
    "syndes-homolog-crm-inbox"
  ]) assert.ok(source.includes(guard),guard);
  assert.doesNotMatch(source,/docker (?:run|build|load|restart|compose)/);
});
