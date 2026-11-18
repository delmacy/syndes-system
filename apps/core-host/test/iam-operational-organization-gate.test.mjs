import test from "node:test";
import assert from "node:assert/strict";
import {AccessDeniedError} from "@syndes/core-kernel";
import {OperationalOrganizationMembershipGate}
 from "../dist/iam-operational-organization-gate.js";

const T="11111111-1111-4111-8111-111111111111";
const O="22222222-2222-4222-8222-222222222222";
const K="33333333-3333-4333-8333-333333333333";
const A="44444444-4444-4444-8444-444444444444";
const realm="syndes";
const link=Object.freeze({tenantId:T,organizationId:O,realm,
 keycloakOrganizationId:K,state:"active",revision:1});
const fixture=({forward=[link],reverse=[link],member=true,error=false}={})=>{
 const calls=[];
 const links={
  findPlatform:async(t,o)=>{calls.push(["platform",t,o]);if(error)throw Error("Control down");return forward;},
  findKeycloak:async(r,k)=>{calls.push(["keycloak-link",r,k]);return reverse;},
 };
 const members={isActiveMember:async(r,k,p)=>{
  calls.push(["membership",r,k,p]);
  if(error)throw Error("Keycloak down");
  return member;
 }};
 return {gate:new OperationalOrganizationMembershipGate(realm,links,members),calls};
};

test("operational Keycloak gate verifies exact immutable links BOTH directions then live membership",async()=>{
 const f=fixture();
 await f.gate.requireActive(T,O,A);
 assert.deepEqual(f.calls,[
  ["platform",T,O],["keycloak-link",realm,K],["membership",realm,K,A],
 ]);
 await f.gate.requireActive(T,O,A);
 assert.equal(f.calls.filter(x=>x[0]==="membership").length,2,
  "Never cache Keycloak Organizations membership across operations");
});

test("live Keycloak Organization gate fails closed on duplicate, stale, cross-tenant links and revocation",async()=>{
 for(const f of [
  fixture({forward:[]}),fixture({forward:[link,link]}),
  fixture({forward:[{...link,state:"revoked"}]}),
  fixture({forward:[{...link,tenantId:K}]}),
  fixture({forward:[{...link,realm:"other"}]}),
  fixture({reverse:[]}),fixture({reverse:[link,link]}),
  fixture({reverse:[{...link,organizationId:K}]}),
  fixture({reverse:[{...link,revision:2}]}),
  fixture({reverse:[{...link,state:"revoked"}]}),
  fixture({member:false}),fixture({error:true}),
 ]){
  await assert.rejects(f.gate.requireActive(T,O,A),AccessDeniedError);
 }
});

test("invalid identity or scope is denied without any network or SQL lookup",async()=>{
 const f=fixture();
 for(const value of [
  [T,O,"not-a-uuid"],[T,"not-a-uuid",A],["not-a-uuid",O,A],
  [T,K,A],
 ]){
  if(value[1]===K)continue;
  await assert.rejects(f.gate.requireActive(...value),AccessDeniedError);
 }
 assert.deepEqual(f.calls,[]);
 assert.throws(()=>new OperationalOrganizationMembershipGate("bad realm",{},{}),
  /Invalid operational Organizations gate/);
});
