import assert from "node:assert/strict";
import test from "node:test";
import {defineUsageMeter,validateUsageEvent} from "../dist/index.js";

const meter={
 id:"whatsapp.outbound_messages",moduleId:"whatsapp",unit:"message",aggregation:"sum",
 description:"Confirmed outbound provider messages",source:"whatsapp.outbound.confirmed"
};
const event={eventId:"01",tenantId:"tenant-A",meterId:meter.id,occurredAt:"2026-11-10T15:00:00Z",quantity:1,sourceEventId:"provider-message-1"};
test("meter definitions are immutable, scoped and price-agnostic",()=>{
 const m=defineUsageMeter(meter);
 assert.equal(m.moduleId,"whatsapp");
 assert.equal(Object.isFrozen(m),true);
 assert.equal("price" in m,false);
 assert.throws(()=>defineUsageMeter({...meter,id:"crm.people"}),/Invalid/);
 assert.throws(()=>defineUsageMeter({...meter,aggregation:"eval"}),/Invalid/);
 assert.throws(()=>defineUsageMeter({...meter,unit:"messages;DROP"}),/Invalid/);
});
test("event shape supports stable deduplication and rejects invalid consumption",()=>{
 const e=validateUsageEvent(event);
 assert.equal(e.sourceEventId,"provider-message-1");
 assert.equal(Object.isFrozen(e),true);
 assert.throws(()=>validateUsageEvent({...event,quantity:-1}),/Invalid/);
 assert.throws(()=>validateUsageEvent({...event,quantity:0.1}),/Invalid/);
 assert.throws(()=>validateUsageEvent({...event,sourceEventId:""}),/Invalid/);
 assert.throws(()=>validateUsageEvent({...event,occurredAt:"yesterday"}),/Invalid/);
});
