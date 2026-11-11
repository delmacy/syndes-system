import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {platformEventTypes,validatePlatformEvent} from "../dist/index.js";

const good=()=>{
 const tenantId=randomUUID(),organizationId=randomUUID(),personId=randomUUID();
 return {tenantId,organizationId,aggregateId:personId,aggregateType:"person",type:"crm.person.created.v1",
  producer:"crm",idempotencyKey:randomUUID(),correlationId:personId,payload:{personId}};
};
test("typed versioned event catalog stays explicit",()=>{
 assert.deepEqual(platformEventTypes,[
  "crm.person.created.v1","whatsapp.message.received.v1","whatsapp.message.received.v2","inbox.participant.observed.v1",
  "crm.person.resolved.v1","crm.person.review_required.v1",
 ]);
});
test("WhatsApp inbound v2 stores bigint as canonical decimal text, no personal message content",()=>{
 const x=good(),accountId=randomUUID(),inboundEventId="9223372036854775807";
 const wa={...x,type:"whatsapp.message.received.v2",producer:"whatsapp",aggregateId:accountId,
  payload:{inboundEventId,accountId}};
 assert.doesNotThrow(()=>validatePlatformEvent(wa));
 for(const bad of ["0","-1","01","9223372036854775808","1.2",1,null]){
  assert.throws(()=>validatePlatformEvent({...wa,payload:{inboundEventId:bad,accountId}}),/reference/);
 }
 assert.throws(()=>validatePlatformEvent({...wa,payload:{...wa.payload,body:"private text"}}),/payload/);
});
test("event envelope validates references, tenant and payload without PII",()=>{
 const x=good();
 assert.doesNotThrow(()=>validatePlatformEvent(x));
 assert.throws(()=>validatePlatformEvent({...x,organizationId:"../other"}),/identity/);
 assert.throws(()=>validatePlatformEvent({...x,producer:"inbox"}),/producer/);
 assert.throws(()=>validatePlatformEvent({...x,type:"crm.person.created.v2"}),/identity|producer/);
 assert.throws(()=>validatePlatformEvent({...x,payload:{personId:x.payload.personId,body:"sensitive message"}}),/payload/);
 assert.throws(()=>validatePlatformEvent({...x,payload:{personId:"invalid"}}),/reference/);
 assert.throws(()=>validatePlatformEvent({...x,idempotencyKey:"../bad"}),/identity/);
});
