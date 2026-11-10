import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import {createHash} from "node:crypto";

const dir=new URL("../sql/schema-v2/",import.meta.url);
const scripts=new URL("../scripts/render-schema-v2.mjs",import.meta.url);
const sha256=s=>createHash("sha256").update(s).digest("hex");

test("AK-40.01 candidate is deterministic, checksummed, inactive and not a second installer",async()=>{
 assert.match(execFileSync(process.execPath,[scripts.pathname,"--check"],{encoding:"utf8"}),
   /verified \(inactive\)/);
 const manifest=JSON.parse(await readFile(new URL("SOURCE-MANIFEST.json",dir),"utf8"));
 assert.equal(manifest.owner,"organizations");
 assert.equal(manifest.activated,false);
 assert.equal(manifest.operationalInstaller,false);
 assert.deepEqual(manifest.files.map(f=>f.migration.slice(0,3)),
   ["001","002","003","004","005","006","007"]);
 for(const entry of manifest.files){
  const source=await readFile(new URL("../"+entry.migration,dir),"utf8");
  const prepared=await readFile(new URL(entry.migration,dir),"utf8");
  assert.equal(sha256(source),entry.sourceSha256);
  assert.equal(sha256(prepared),entry.candidateSha256);
  assert.ok(!prepared.includes("DROP SCHEMA"));
  assert.ok(!prepared.includes("SET search_path=pg_catalog,public"));
  assert.ok(!prepared.includes("schemaname=current_schema()"));
 }
 const gate=await readFile(new URL("002_legacy_single_context_gate.sql",dir),"utf8");
 assert.match(gate,/CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_organization/);
 assert.match(gate,/CREATE UNIQUE INDEX IF NOT EXISTS platform_legacy_single_workspace/);
 const manual=await readFile(new URL("../manual/activate_multiple_organizations.sql",dir),"utf8");
 assert.match(manual,/DROP INDEX platform_legacy_single_workspace/);
 const plugin=await readFile(new URL("../../src/plugin.ts",dir),"utf8");
 assert.ok(!plugin.includes("schema-v2/"),"Legacy plugin must not expose inactive candidate");
 assert.ok(!plugin.includes("007_staff_roles_pre_release"),"Workforce stays manual and gated");
});
