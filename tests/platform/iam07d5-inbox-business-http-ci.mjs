/** IAM-07D5: real Nest HTTP -> real Keycloak JWT -> real Inbox claim. */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {Iam07d5InboxClaimController,IAM07D5_HTTP_DEPS}
 from "../../apps/core-host/dist/iam07d5-inbox-http-pilot.js";

const require=createRequire(new URL("../../apps/core-host/package.json",import.meta.url));
require("reflect-metadata");
const {NestFactory}=require("@nestjs/core");
const {Module}=require("@nestjs/common");
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const OTHER="33333333-3333-4333-8333-333333333333";

export async function runIam07d5InboxBusinessHttpLab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 class DisposableBusinessModule{}
 Module({controllers:[Iam07d5InboxClaimController],providers:[
  {provide:IAM07D5_HTTP_DEPS,useValue:{verifier:f.verifier,business:f.business}},
 ]})(DisposableBusinessModule);
 const app=await NestFactory.create(DisposableBusinessModule,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 assert.ok(base.startsWith("http://127.0.0.1:"));
 const send=async({token=f.bearer,tenant=TENANT,org=ORG,ws=WS,chat=f.chat}={})=>{
  const response=await fetch(base+"/__ci/iam07d5/tenants/"+tenant+
   "/inbox/conversations/"+chat+"/claim",{
   method:"POST",headers:{
    ...(token?{authorization:token}:{}),
    "x-syndes-organization-id":org,"x-syndes-workspace-id":ws,
   },redirect:"error",signal:AbortSignal.timeout(11000),cache:"no-store",
  });
  const body=await response.text();
  assert.ok(!body.includes(f.userToken),"JWT must never be returned");
  return {status:response.status,body};
 };
 try{
  assert.equal((await send({token:null})).status,401);
  assert.equal((await send({token:"Bearer invalid"})).status,401);
  assert.equal((await send({token:"Bearer "+f.managerToken})).status,401);
  assert.equal((await send({token:"Bearer "+f.otherOrgToken})).status,403);
  assert.equal((await send({tenant:OTHER})).status,403);
  assert.equal((await send({org:OTHER})).status,403);
  assert.equal((await send({ws:OTHER})).status,403);
  assert.equal((await send({chat:"invalid"})).status,403);
  await f.control.query("UPDATE tenant_module_entitlements SET state='suspended'"+
   " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]);
  try{assert.equal((await send()).status,403);}
  finally{await f.control.query(
   "UPDATE tenant_module_entitlements SET state='granted'"+
   " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]);}
  await f.changeMembership("DELETE",f.orgId,f.actorId,f.adminToken);
  try{assert.equal((await send()).status,403);}
  finally{await f.changeMembership("POST",f.orgId,f.actorId,f.adminToken);}
  assert.equal((await send()).status,200);
  assert.equal((await send()).status,403,"Claim cannot be repeated");
  assert.equal((await f.tenantDb.query(
   "SELECT assigned_to FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",
   [TENANT,f.chat])).rows[0].assigned_to,f.actorId);
  assert.equal((await f.tenantDb.query(
   "SELECT count(*)::int AS n FROM inbox_events"+
   " WHERE tenant_id=$1 AND conversation_id=$2 AND action='assigned'",
   [TENANT,f.chat])).rows[0].n,1);
  console.log("IAM07D5_REAL_NEST_HTTP_JWT_ORG_CONTROL_PG17_FINE_FGA_CLAIM_AUDIT_PASS");
 }finally{await app.close();}
}
