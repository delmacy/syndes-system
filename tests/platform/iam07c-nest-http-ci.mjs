/**
 * IAM-07C real Nest HTTP entry -> signed Keycloak JWT -> live membership,
 * Control PG17 module/link -> tenant PG17 SQL002 -> real OpenFGA.
 * Uses only the established loopback-only disposable IAM-06B lab.
 * No operational Inbox route or business data is exposed.
 */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {Iam07cHttpAdmissionController,IAM07C_HTTP_DEPS}
  from "../../apps/core-host/dist/iam07c-http-admission-pilot.js";

const require=createRequire(new URL("../../apps/core-host/package.json",import.meta.url));
require("reflect-metadata");
const {NestFactory}=require("@nestjs/core");
const {Module}=require("@nestjs/common");
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const WRONG="33333333-3333-4333-8333-333333333333";

export async function runIam07cNestHttpLab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 assert.equal(f?.bearer,"Bearer "+f.userToken);
 const dependencies=Object.freeze({
  verifier:f.verifier,admission:f.admission,fga:f.fgaAdapter,
 });
 class DisposableIamHttpModule{}
 Module({controllers:[Iam07cHttpAdmissionController],providers:[
  {provide:IAM07C_HTTP_DEPS,useValue:dependencies},
 ]})(DisposableIamHttpModule);
 const app=await NestFactory.create(DisposableIamHttpModule,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 assert.ok(base.startsWith("http://127.0.0.1:"));
 const route=tenant=>"/__ci/iam07c/tenants/"+tenant+"/inbox/conversations/read";
 const headers=(bearer,org=ORG,ws=WS)=>({
  ...(bearer?{authorization:bearer}:{}),
  "x-syndes-organization-id":org,
  "x-syndes-workspace-id":ws,
 });
 const send=async(token=f.bearer,tenant=TENANT,org=ORG,ws=WS)=>{
  const response=await fetch(base+route(tenant),{
   method:"GET",headers:headers(token,org,ws),
   redirect:"error",signal:AbortSignal.timeout(11000),
   cache:"no-store",
  });
  const result=await response.text();
  assert.ok(!result.includes(f.userToken),
   "No JWT may appear in response or logs");
  return {status:response.status,body:result};
 };
 try{
  assert.equal((await send()).status,200);
  assert.deepEqual(JSON.parse((await send()).body),{authorized:true});
  assert.equal((await send(null)).status,401);
  assert.equal((await send("Bearer invalid")).status,401);
  assert.equal((await send("Bearer "+f.otherOrgToken)).status,403);
  assert.equal((await send("Bearer "+f.managerToken)).status,401);
  assert.equal((await send(f.bearer,WRONG)).status,403);
  assert.equal((await send(f.bearer,TENANT,WRONG)).status,403);
  assert.equal((await send(f.bearer,TENANT,ORG,WRONG)).status,403);
  assert.equal((await send(f.bearer,TENANT,ORG,"missing")).status,403);
  // SAME bearer, SESSION and HTTP endpoint. A local membership revocation
  // must deny a previously working request and restore only after re-add.
  await f.tenantDb.query("UPDATE platform_workspace_memberships SET state='revoked'"+
   " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,f.alice]);
  try{assert.equal((await send()).status,403)}
  finally{await f.tenantDb.query(
   "UPDATE platform_workspace_memberships SET state='active'"+
   " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,f.alice])}
  assert.equal((await send()).status,200);
  await f.control.query("UPDATE tenant_module_entitlements SET state='suspended'"+
   " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]);
  try{assert.equal((await send()).status,403)}
  finally{await f.control.query(
   "UPDATE tenant_module_entitlements SET state='granted'"+
   " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT])}
  assert.equal((await send()).status,200);
  await f.fgaWrite("POST","/stores/"+f.storeId+"/write",
   {deletes:{tuple_keys:[f.readTuple]}});
  try{assert.equal((await send()).status,403)}
  finally{await f.fgaWrite("POST","/stores/"+f.storeId+"/write",
   {writes:{tuple_keys:[f.readTuple]}})}
  assert.equal((await send()).status,200);
  await f.changeMembership("DELETE",f.orgId,f.alice,f.adminToken);
  try{assert.equal((await send()).status,403)}
  finally{await f.changeMembership("POST",f.orgId,f.alice,f.adminToken)}
  assert.equal((await send()).status,200);
  console.log("IAM07C_REAL_NEST_HTTP_SIGNED_JWT_PG17_FGA_DENY_REVOKE_RESTORE_PASS");
 }finally{
  await app.close();
 }
}
