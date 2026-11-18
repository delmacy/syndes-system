/**
 * IAM-07B disposable network-fault gate. The SAME live composite admission
 * is exercised with a selected dependency sent to a CLOSED loopback port,
 * then restored to the REAL Keycloak/Control/tenant/OpenFGA service.
 *
 * This tests individual transport failure/reconnect (not server crash,
 * DNS/TLS or production HA). The old SSE stays CLOSED after recovery.
 */
import assert from "node:assert/strict";
import {setTimeout as delay} from "node:timers/promises";
import {createRequire} from "node:module";
import {PgOrganizationIdentityLinks,KeycloakOrganizationMembershipReader}
  from "../../apps/core-host/dist/iam-organization-adapters.js";
import {OrganizationContextAdmissionPilot}
  from "../../apps/core-host/dist/iam-organization-context-pilot.js";
import {Iam07SseSessionPilot}
  from "../../apps/core-host/dist/iam07-sse-session-pilot.js";
import {FgaPermission} from "../../apps/core-host/dist/adapters.js";
import {InboxChangeBus} from "../../modules/inbox/dist/index.js";

const require=createRequire(new URL("../../apps/core-host/package.json",import.meta.url));
const {Pool}=require("pg");
const REALM="syndes-iam-lab-ci";
const KC="http://127.0.0.1:18088";
const FGA="http://127.0.0.1:18089";
const DEAD="http://127.0.0.1:18998";
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";

async function until(predicate,label){
 for(let i=0;i<100;i++){
  if(predicate())return;
  await delay(25);
 }
 throw Error("IAM07B_"+label+"_TIMEOUT");
}
export async function runIam07bProviderRecoveryLab(fixture){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 const {verifier,tenancy,moduleGate,control,tenantDb,
  provider,source,storeId,links,memberReader,
  bearer,actorId}=fixture;
 assert.match(bearer,/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
 assert.ok(typeof actorId==="string"&&actorId.length===36);
 assert.ok(typeof storeId==="string"&&storeId.length>8);
 assert.ok(typeof source?.getToken==="function");
 const dead=new Pool({connectionString:
  "postgresql://postgres:ci-only-disposable@127.0.0.1:18998/postgres",
  connectionTimeoutMillis:250,max:1});
 const fault={keycloak:false,control:false,tenant:false,fga:false};
 const broken=(url,init)=>fetch(fault.keycloak?DEAD:url,init);
 const brokenFga=(url,init)=>fetch(fault.fga?DEAD:url,init);
 const keycloak=new KeycloakOrganizationMembershipReader(KC,REALM,source,broken);
 const fga=new FgaPermission(FGA,storeId,"ci-disposable-only",brokenFga);
 const linksAdapter=new PgOrganizationIdentityLinks({
  query:(sql,params)=>fault.control?dead.query(sql,params):control.query(sql,params),
 });
 const tenantProvider={
  resolve:async(tenantId)=>{
   const real=await provider.resolve(tenantId);
   return {tenantId:real.tenantId,query:async(sql,params)=>{
    if(fault.tenant)return dead.query(sql,params);
    return tenantDb.query(sql,params);
   }};
  },
 };
 const admission=new OrganizationContextAdmissionPilot({
  realm:REALM,clientId:"syndes-iam-lab-ui",multiOrganizationEnabled:false,
  verifier,tenancy,moduleAccess:moduleGate,
  links:linksAdapter,keycloakMembers:keycloak,
  tenantDatabases:tenantProvider,
  funnelOwnership:{isActiveInWorkspace:async()=>false},
 });
 const pilot=new Iam07SseSessionPilot(admission,fga);
 const req=Object.freeze({
  tenantId:TENANT,organizationId:ORG,workspaceId:WS,
  capability:"inbox.conversation.read",
 });
 const names=["keycloak","control","tenant","fga"];
 try{
  const original=await pilot.open(bearer,req);
  assert.equal(original.address.tenantId,TENANT);
  assert.equal(await original.revalidate(),true);
  assert.equal((await links.findPlatform(TENANT,ORG)).length,1);
  assert.equal(await memberReader.isActiveMember(REALM,
   (await links.findPlatform(TENANT,ORG))[0].keycloakOrganizationId,actorId),true);

  for(const name of names){
   const session=await pilot.open(bearer,req);
   const bus=new InboxChangeBus(1);
   const frames=[];
   const sink={
    setHeader:()=>{},write:s=>{frames.push(s);return true;},
    end:()=>frames.push("END"),on:()=>{},
   };
   bus.connect(session.address,sink,session.revalidate,10000,3000);
   await until(()=>frames.filter(s=>s.startsWith("event: changed")).length===1,
    name+"_INITIAL");
   assert.equal(bus.count(session.address),1);
   const before=frames.filter(s=>s.startsWith("event: changed")).length;
   try{
    fault[name]=true;
    bus.publish(session.address);
    await until(()=>frames.includes("END"),name+"_DENY");
    assert.equal(frames.filter(s=>s.startsWith("event: changed")).length,before,
      "No disclosure after "+name+" transport failure");
    assert.equal(bus.count(session.address),0);
    await assert.rejects(pilot.open(bearer,req),/admission denied/,
     name+" outage denies new sessions");
   }finally{
    fault[name]=false;
   }
   // Recovery: a fresh signed-session admission can be created. The old
   // revoked listener remains terminated and never rejoins automatically.
   assert.equal(await session.revalidate(),true);
   assert.equal((await pilot.open(bearer,req)).address.workspaceId,WS);
   bus.publish(session.address);
   await delay(30);
   assert.equal(frames.filter(s=>s.startsWith("event: changed")).length,before);
  }
  console.log("IAM07B_REAL_KEYCLOAK_CONTROL_TENANT_FGA_TRANSPORT_FAULT_RECOVERY_PASS");
 }finally{
  await dead.end();
 }
}
