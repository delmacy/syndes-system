import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {controlPlaneEventTypes,validateControlPlaneEvent} from "../dist/index.js";

const sample=()=>({
 eventId:randomUUID(),auditEventId:"9223372036854775807",tenantId:randomUUID(),
 moduleId:"crm",type:"platform.module.entitlement.changed.v1",version:1,
 operation:"entitlement.suspend",resultState:"suspended",correlationId:randomUUID(),
 payload:{auditEventId:"9223372036854775807"},
});
test("Control plane event catalog is separate from tenant business contracts",()=>{
 assert.deepEqual(controlPlaneEventTypes,[
  "platform.module.entitlement.changed.v1","platform.module.installation.changed.v1",
 ]);
});
test("Control Plane contract validates exact minimal audit reference and scope",()=>{
 const x=sample();
 assert.doesNotThrow(()=>validateControlPlaneEvent(x));
 assert.throws(()=>validateControlPlaneEvent({...x,tenantId:"invalid"}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,operation:"installation.enable"}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,version:2}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,resultState:"unknown"}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,auditEventId:"9223372036854775808",
  payload:{auditEventId:"9223372036854775808"}}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,auditEventId:"01",payload:{auditEventId:"01"}}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,payload:{...x.payload,reason:"Sensitive audit data"}}),/contract/);
 assert.throws(()=>validateControlPlaneEvent({...x,payload:{auditEventId:"1"}}),/contract/);
 const installation={...x,type:"platform.module.installation.changed.v1",
  operation:"installation.enable",resultState:"enabled"};
 assert.doesNotThrow(()=>validateControlPlaneEvent(installation));
});
