import test from "node:test";
import assert from "node:assert/strict";
import {execFileSync,spawnSync} from "node:child_process";

test("module migration CLI enumerates and emits only installed package migrations",()=>{
 const cli="dist/migrations.js";
 const list=JSON.parse(execFileSync(process.execPath,[cli,"--list"],{encoding:"utf8"}));
 assert.deepEqual(list.map(m=>m.id),["crm","inbox","whatsapp"]);
 assert.equal(list[0].migrations.length,3);
 const sql=execFileSync(process.execPath,[cli,"--emit","crm","001_crm_foundation"],{encoding:"utf8"});
 assert.match(sql,/CREATE TABLE IF NOT EXISTS crm_people/);
 const inboxSql=execFileSync(process.execPath,[cli,"--emit","inbox","001_inbox_foundation"],{encoding:"utf8"});
 assert.match(inboxSql,/CREATE TABLE IF NOT EXISTS inbox_conversations/);
 const invalid=spawnSync(process.execPath,[cli,"--emit","crm","..\\secrets"],{encoding:"utf8"});
 assert.notEqual(invalid.status,0);
 assert.equal(invalid.stdout,"");
});
