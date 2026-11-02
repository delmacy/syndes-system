import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppAccounts} from "../dist/accounts.js";
const t1="00000000-0000-4000-8000-000000000001";
const t2="00000000-0000-4000-8000-000000000002";
const accountId="00000000-0000-4000-8000-000000000011";
const row={id:accountId,tenant_id:t1,display_name:"Principal",phone_external_id:"+5551999",device_jid:null,connection_status:"connected",service_enabled:true};
test("all queries carry trusted tenant and never lookup other tenant account",async()=>{
 const calls=[];
 const store={query:async(sql,params)=>{calls.push({sql,params});return {rows:params[0]===t1?[row]:[]}}};
 const repo=new WhatsAppAccounts(async()=>store);
 assert.equal((await repo.list({tenantId:t1})).length,1);
 assert.equal(await repo.get({tenantId:t2},accountId),null);
 assert.deepEqual(calls.map(c=>c.params[0]),[t1,t2]);
 assert.match(calls[1].sql,/tenant_id=\$1 AND id=\$2/);
});
test("disabled or missing accounts reject operational access",async()=>{
 const repo=new WhatsAppAccounts(async()=>({query:async()=>({rows:[]})}));
 await assert.rejects(repo.requireEnabled({tenantId:t2},accountId),/not found or disabled/);
});
test("reject invalid names before database access",async()=>{
 const repo=new WhatsAppAccounts(async()=>{throw Error("unexpected connection")});
 await assert.rejects(repo.create({tenantId:t1}," "),/Invalid account display name/);
});
