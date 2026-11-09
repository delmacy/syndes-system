import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync,spawnSync} from "node:child_process";

test("module migration CLI enumerates and emits only installed package migrations",()=>{
 const cli="dist/migrations.js";
 const list=JSON.parse(execFileSync(process.execPath,[cli,"--list"],{encoding:"utf8"}));
 assert.deepEqual(list.map(m=>m.id),["crm","inbox","whatsapp","organizations"]);
 assert.deepEqual(list[3].migrations,["001_account_hierarchy","002_legacy_single_context_gate","003_legacy_ownership","004_whatsapp_route_owner_guard","005_scoped_relationship_integrity"]);
 const ownershipSql=execFileSync(process.execPath,[cli,"--emit","organizations","003_legacy_ownership"],{encoding:"utf8"});
 assert.match(ownershipSql,/CREATE OR REPLACE FUNCTION platform_backfill_legacy_ownership/);
 assert.match(ownershipSql,/ALTER TABLE inbox_conversations ADD COLUMN IF NOT EXISTS platform_current_workspace_id/);
 assert.match(ownershipSql,/platform_legacy_backfill_runs/);
 const gateSql=execFileSync(process.execPath,[cli,"--emit","organizations","002_legacy_single_context_gate"],{encoding:"utf8"});
 assert.match(gateSql,/platform_legacy_single_organization/);
 assert.match(gateSql,/platform_legacy_single_workspace/);
 const orgSql=execFileSync(process.execPath,[cli,"--emit","organizations","001_account_hierarchy"],{encoding:"utf8"});
 assert.match(orgSql,/CREATE TABLE IF NOT EXISTS platform_organizations/);
 assert.match(orgSql,/CREATE TABLE IF NOT EXISTS platform_units/);
 assert.equal(list[0].migrations.length,3);
 const sql=execFileSync(process.execPath,[cli,"--emit","crm","001_crm_foundation"],{encoding:"utf8"});
 assert.match(sql,/CREATE TABLE IF NOT EXISTS crm_people/);
 const inboxSql=execFileSync(process.execPath,[cli,"--emit","inbox","001_inbox_foundation"],{encoding:"utf8"});
 assert.match(inboxSql,/CREATE TABLE IF NOT EXISTS inbox_conversations/);
 const invalid=spawnSync(process.execPath,[cli,"--emit","crm","..\\secrets"],{encoding:"utf8"});
 assert.notEqual(invalid.status,0);
 assert.equal(invalid.stdout,"");
});
