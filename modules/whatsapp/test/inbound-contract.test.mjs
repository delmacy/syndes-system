import test from 'node:test';
import assert from 'node:assert/strict';
import {validIncomingEnvelope} from '../dist/inbound-contract.js';
const tenantId='00000000-0000-4000-8000-000000000001';
const accountId='00000000-0000-4000-8000-000000000011';
const event={version:'1',type:'whatsapp.message.received',tenantId,accountId,message:{accountId,externalMessageId:'m1',senderExternalId:'5511@s.whatsapp.net',body:'olá',occurredAt:'2026-11-02T19:00:00Z'}};
test('accepts a valid versioned event',()=>assert.equal(validIncomingEnvelope(tenantId,event),true));
test('rejects tenant and account mismatches',()=>{assert.equal(validIncomingEnvelope('00000000-0000-4000-8000-000000000002',event),false);assert.equal(validIncomingEnvelope(tenantId,{...event,message:{...event.message,accountId:tenantId}}),false)});
test('rejects unsupported versions and invalid payloads',()=>{assert.equal(validIncomingEnvelope(tenantId,{...event,version:'2'}),false);assert.equal(validIncomingEnvelope(tenantId,{...event,message:{...event.message,body:''}}),false)});
