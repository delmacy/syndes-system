import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {iam07dFineObject,iam07dFineObjectForScope,
 OpenFgaFineCapabilityPolicy,OpenFgaFineGrantRevoker}
 from "../dist/iam07d-fine-fga-policy.js";

const tenant=randomUUID(),org=randomUUID(),ws=randomUUID(),actor=randomUUID(),kc=randomUUID();
const claim="inbox.conversation.claim",transfer="inbox.conversation.transfer",
 funnel="service.funnel.operate";
const resource="syndes:v1:tenant:"+tenant+":org:"+org+":workspace:"+ws;
const context=cap=>({
 actor:{id:actor,kind:"user"},tenantId:tenant,
 organizationId:org,workspaceId:ws,
 keycloakOrganizationId:kc,realm:"syndes-iam-lab-ci",
 scopeWriteAllowed:true,capability:cap,
 moduleId:cap===funnel?"service":"inbox",resourceName:resource,
});
test("IAM07D2 fine resource is scope- and capability-complete; no coarse aliases",()=>{
 const claimObject=iam07dFineObject(context(claim),claim);
 assert.match(claimObject,/^iam_capability:[0-9a-f]{64}$/);
 assert.equal(claimObject,iam07dFineObjectForScope({
  tenantId:tenant,organizationId:org,workspaceId:ws,
  resourceName:resource,capability:claim,
 }));
 const transferObject=iam07dFineObject(context(transfer),transfer);
 assert.notEqual(claimObject,transferObject);
 const a=randomUUID(),b=randomUUID();
 const f=ctx=>({...context(funnel),resourceName:resource+":funnel:"+ctx});
 assert.notEqual(iam07dFineObject(f(a),funnel),iam07dFineObject(f(b),funnel));
 assert.throws(()=>iam07dFineObject(context(claim),transfer));
 assert.throws(()=>iam07dFineObject({...context(claim),scopeWriteAllowed:false},claim));
 assert.throws(()=>iam07dFineObject({...context(claim),resourceName:resource+":funnel:"+a},claim));
 assert.throws(()=>iam07dFineObject(context(funnel),funnel));
 assert.throws(()=>iam07dFineObjectForScope({
  tenantId:tenant,organizationId:org,workspaceId:ws,
  resourceName:resource,capability:funnel,
 }));
 assert.notEqual(claimObject,iam07dFineObject({
  ...context(claim),organizationId:randomUUID(),
  resourceName:"syndes:v1:tenant:"+tenant+":org:"+randomUUID()+":workspace:"+ws,
 },claim));
});

test("IAM07D2 exact fine FGA check never accepts legacy permission, provider error or malformed reply",async()=>{
 const seen=[];
 let answer={allowed:true},httpStatus=200;
 const fake=async(url,options)=>{
  seen.push({url:String(url),body:JSON.parse(options.body),method:options.method});
  return {status:httpStatus,json:async()=>answer};
 };
 const grant=new OpenFgaFineCapabilityPolicy(
  "http://127.0.0.1:18089","candidate_store","candidate_token",fake);
 assert.equal(await grant.canPerform(context(claim),claim),true);
 const key=seen.at(-1).body.tuple_key;
 assert.equal(key.relation,"can_execute");
 assert.equal(key.object,iam07dFineObject(context(claim),claim));
 assert.equal(key.user,"user:"+actor);
 assert.notEqual(key.relation,"can_write");
 assert.equal(seen.at(-1).method,"POST");
 answer={allowed:false};
 assert.equal(await grant.canPerform(context(claim),claim),false);
 answer={allowed:"true"};
 await assert.rejects(grant.canPerform(context(claim),claim));
 httpStatus=503;
 await assert.rejects(grant.canPerform(context(claim),claim));
 assert.throws(()=>new OpenFgaFineCapabilityPolicy(
  "http://untrusted.example/","candidate_store","candidate_token"));
});

test("IAM07D2 exact revoker uses only tuple grantee and verifies actual removal",async()=>{
 const calls=[];
 let present=true,broken=false;
 const fake=async(url,options)=>{
  const req=JSON.parse(options.body);
  calls.push({url:String(url),req});
  if(broken)return {status:503,json:async()=>({})};
  if(String(url).endsWith("/check"))
   return {status:200,json:async()=>({allowed:present})};
  assert.deepEqual(req.deletes.tuple_keys,[{
   user:"user:"+actor,relation:"grantee",
   object:iam07dFineObject(context(claim),claim),
  }]);
  present=false;
  return {status:200,json:async()=>({})};
 };
 const admin=new OpenFgaFineGrantRevoker(
  "http://127.0.0.1:18089","candidate_store","candidate_token",fake);
 const object=iam07dFineObject(context(claim),claim);
 assert.equal(await admin.revokeExact(actor,object),"removed");
 assert.equal(await admin.revokeExact(actor,object),"absent");
 assert.equal(calls.filter(x=>x.url.endsWith("/write")).length,1);
 await assert.rejects(admin.revokeExact(actor,"resource:legacy"));
 broken=true;
 await assert.rejects(admin.revokeExact(actor,object));
});
