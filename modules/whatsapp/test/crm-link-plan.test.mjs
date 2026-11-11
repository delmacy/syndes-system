import test from "node:test";
import assert from "node:assert/strict";
import {decideCrmLink,summarizeCrmPlans,WhatsAppCrmReconciliation} from "../dist/crm-link-plan.js";
const tenantId="10000000-0000-4000-8000-000000000001";
const org="20000000-0000-4000-8000-000000000001";
const personA="30000000-0000-4000-8000-000000000001";
const personB="30000000-0000-4000-8000-000000000002";
const base={
 conversation_id:"40000000-0000-4000-8000-000000000001",
 organization_id:org,crm_person_id:null,recipient_external_id:"5511999999999@s.whatsapp.net",
 phone_e164:"+5511999999999",link_owner_valid:false,identity_matches:[],phone_matches:[],
};
const decision=values=>decideCrmLink({...base,...values});
test("exact matching channel identity or normalized phone can link an existing CRM person",()=>{
 assert.equal(decision({identity_matches:[personA]}).candidatePersonId,personA);
 assert.equal(decision({phone_matches:[personA]}).decision,"link_existing");
 assert.equal(decision({identity_matches:[personA],phone_matches:[personA]}).decision,"link_existing");
});
test("conflicting matches never link or merge users by a convenient guess",()=>{
 for(const row of [
  {identity_matches:[personA],phone_matches:[personB]},
  {identity_matches:[personA,personB]},
  {identity_matches:[personA],phone_matches:[personA,personB]},
 ])assert.equal(decision(row).decision,"review_ambiguous");
});
test("duplicate phone routes or archived matches require review before provisional creation",()=>{
 assert.equal(decision({route_phone_count:2}).decision,"review_ambiguous");
 assert.equal(decision({archived_person_match:true}).decision,"review_ambiguous");
 assert.equal(decision({route_phone_count:2,phone_matches:[personA]}).decision,"link_existing");
});
test("an existing link must belong to an active person in the same Organization",()=>{
 assert.equal(decision({crm_person_id:personA,link_owner_valid:true}).decision,"already_linked");
 assert.equal(decision({crm_person_id:personA,link_owner_valid:false}).decision,"review_conflicting_link");
 assert.equal(decision({crm_person_id:personA,link_owner_valid:true,phone_matches:[personB]}).decision,"review_conflicting_link");
});
test("unverified LID and missing organization do not create a provisional CRM person",()=>{
 assert.equal(decision({phone_e164:null,recipient_external_id:"1234567890123@lid"}).decision,"review_missing_identity");
 assert.equal(decision({phone_e164:"5551999999999"}).decision,"review_missing_identity");
 assert.equal(decision({organization_id:null}).decision,"review_missing_organization");
 assert.equal(decision({}).decision,"propose_provisional");
});
test("reconciliation is strictly scoped SELECT-only and produces a sanitized summary",async()=>{
 let count=0;
 const planner=new WhatsAppCrmReconciliation({resolve:async id=>{
  assert.equal(id,tenantId);
  return {tenantId,query:async(sql,params)=>{
   count++;assert.match(sql,/^\s*SELECT /);assert.doesNotMatch(sql,/\b(INSERT|UPDATE|DELETE|ALTER|DROP)\s+/i);
   assert.match(sql,/p\.platform_organization_id=c\.platform_organization_id/);
   assert.deepEqual(params,[tenantId,5000]);
   return {rows:[base,{...base,conversation_id:"40000000-0000-4000-8000-000000000002",phone_matches:[personA]}],rowCount:2};
  }};
 }});
 const plan=await planner.plan(tenantId);
 assert.equal(count,1);
 assert.deepEqual(summarizeCrmPlans(plan),{
  total:2,already_linked:0,link_existing:1,propose_provisional:1,
  review_ambiguous:0,review_conflicting_link:0,review_missing_identity:0,review_missing_organization:0,
 });
 await assert.rejects(planner.plan("invalid"),/Invalid/);
});
test("wrong tenant database mapping cannot be queried",async()=>{
 const planner=new WhatsAppCrmReconciliation({resolve:async()=>({
  tenantId:"another",query:async()=>assert.fail("must not query"),
 })});
 await assert.rejects(planner.plan(tenantId),/Tenant database mismatch/);
});
