import test from "node:test";
import assert from "node:assert/strict";
import {validContactEnvelope} from "../dist/inbound-contract.js";
const tenantId="00000000-0000-4000-8000-000000000001";
const accountId="00000000-0000-4000-8000-000000000011";
const evt={version:"1",type:"whatsapp.contact.name",tenantId,accountId,
 contact:{accountId,contactExternalId:"5551999999999@s.whatsapp.net",name:"Maria Agenda"}};
test("accepts tenant- and account-scoped contact sync",()=>{
 assert.equal(validContactEnvelope(tenantId,evt),true);
 for(const bad of [
  {...evt,tenantId:"00000000-0000-4000-8000-000000000002"},
  {...evt,contact:{...evt.contact,accountId:"00000000-0000-4000-8000-000000000012"}},
  {...evt,contact:{...evt.contact,contactExternalId:"120363012345678901@g.us"}},
  {...evt,contact:{...evt.contact,name:" "}},
  {...evt,contact:{...evt.contact,name:"a".repeat(161)}},
 ]) assert.equal(validContactEnvelope(tenantId,bad),false);
});
