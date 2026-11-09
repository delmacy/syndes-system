import test from "node:test";
import assert from "node:assert/strict";
import {SupportInputError,internalRequest,externalRequest,validateQueue,validUuid,validStatus,validPriority,allowedPreviousStates,validateNote,validAssignee,parseList} from "../dist/domain.js";
const U="11111111-1111-4111-8111-111111111111";
test("internal input is strict, bounded and queue-isolated",()=>{
 assert.deepEqual(internalRequest({queue:"it_infra",priority:"normal",description:" Solicitação "}),{queue:"it_infra",priority:"normal",description:"Solicitação"});
 for(const bad of [{queue:"external_general",priority:"normal",description:"x"},{queue:"it_infra",priority:"urgent",description:"x"},{queue:"it_infra",priority:"high",description:" "},{queue:"it_infra",priority:"high",description:"x".repeat(5001)},{queue:"it_infra",priority:"high",description:"test",requesterId:"forged"}]){
  assert.throws(()=>internalRequest(bad),SupportInputError);
 }
});
test("external input accepts only authorized Inbox UUID and priority",()=>{
 assert.deepEqual(externalRequest({conversationId:U,priority:"high"}),{conversationId:U,priority:"high"});
 for(const bad of [{conversationId:"../../x",priority:"high"},{conversationId:U,priority:"invalid"},{conversationId:U,priority:"high",tenantId:U},{conversationId:U,priority:"high",commercialTenantRef:U}])assert.throws(()=>externalRequest(bad),SupportInputError);
});
test("queue and UUID types are independent",()=>{
 assert.equal(validateQueue("internal","product"),"product");
 assert.equal(validateQueue("external","external_general"),"external_general");
 assert.throws(()=>validateQueue("internal","external_general"),SupportInputError);
 assert.throws(()=>validateQueue("external","it_infra"),SupportInputError);
 assert.equal(validUuid(U),true);assert.equal(validUuid("1234"),false);
});
test("transition graph is explicit",()=>{
 assert.deepEqual(allowedPreviousStates("triage"),["new","resolved","closed"]);
 assert.deepEqual(allowedPreviousStates("resolved"),["in_progress","waiting_customer"]);
 assert.equal(allowedPreviousStates("new").length,0);
 assert.throws(()=>allowedPreviousStates("unknown"),SupportInputError);
 assert.equal(validStatus("closed"),true);
 assert.equal(validPriority("critical"),true);assert.equal(validPriority("urgent"),false);
});
test("notes, assignees and filters reject overlong and forged input",()=>{
 assert.equal(validateNote(" Nota interna "),"Nota interna");
 assert.equal(validAssignee("agent-1"),"agent-1");
 assert.throws(()=>validateNote(""),SupportInputError);
 assert.throws(()=>validateNote("x".repeat(5001)),SupportInputError);
 assert.throws(()=>validAssignee("a\nb"),SupportInputError);
 assert.deepEqual(parseList("internal",{queue:"product",priority:"high",status:"triage",limit:"10",offset:"0"}),{kind:"internal",queue:"product",priority:"high",status:"triage",limit:10,offset:0});
 assert.throws(()=>parseList("external",{queue:"it_infra"}),SupportInputError);
 assert.throws(()=>parseList("internal",{limit:"999"}),SupportInputError);
 assert.throws(()=>parseList("internal",{status:"archived"}),SupportInputError);
});
