import {readFileSync} from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";
import {WhatsAppOutbox,RESERVE_ACCOUNT_SEND_SQL} from "../dist/outbox.js";
const tenantId="00000000-0000-4000-8000-000000000001",accountId="00000000-0000-4000-8000-000000000011";
const payload={accountId,idempotencyKey:"inbox-msg-01",recipientExternalId:"+555199999",body:"hello"};
test("persist intent in outbox scoped by tenant, account and idempotency key",async()=>{
 const calls=[];
 const repo=new WhatsAppOutbox({requireEnabled:async()=>({id:accountId})},async()=>({query:async(sql,params)=>{calls.push([sql,params]);return {rows:[{id:"outbox-1",status:"pending"}]}}}));
 assert.deepEqual(await repo.enqueue({tenantId},payload),{id:"outbox-1",status:"pending"});
 assert.match(calls[0][0],/ON CONFLICT \(tenant_id,account_id,idempotency_key\)/);
 assert.match(calls[0][0],/service_enabled=true/);
 assert.deepEqual(calls[0][1].slice(1,4),[tenantId,accountId,"inbox-msg-01"]);
});
test("disabled account cannot enqueue",async()=>{
 const repo=new WhatsAppOutbox({requireEnabled:async()=>{throw Error("disabled")}},async()=>{throw Error("should not query")});
 await assert.rejects(repo.enqueue({tenantId},payload),/disabled/);
});
test("rate reservation locks account and caps at forty",()=>{
 assert.match(RESERVE_ACCOUNT_SEND_SQL,/FOR UPDATE/);
 assert.match(RESERVE_ACCOUNT_SEND_SQL,/reserved_count<40/);
 assert.match(RESERVE_ACCOUNT_SEND_SQL,/date_trunc\('minute'/);
});
test("conflicting idempotency payload is rejected by SQL predicate",()=>{
 const source=readFileSync(new URL("../dist/outbox.js",import.meta.url),"utf8");
 assert.match(source,/whatsapp_outbox\.recipient_external_id=EXCLUDED\.recipient_external_id/);
 assert.match(source,/whatsapp_outbox\.body=EXCLUDED\.body/);
});
