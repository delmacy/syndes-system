/**
 * TOPO-04: two REAL Keycloak Organizations, same human signed JWT,
 * one disposable PG17 tenant database (two Platform Organizations),
 * Control org links, module entitlement, SQL membership and exact FGA.
 * Only a CI-local Nest GET admission; no business effect or production route.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {OrganizationContextAdmissionPilot}
 from "../../apps/core-host/dist/iam-organization-context-pilot.js";
import {OpenFgaFineCapabilityPolicy,iam07dFineObject}
 from "../../apps/core-host/dist/iam07d-fine-fga-policy.js";
import {IamTopologyMultiOrgHttpController,IAM_TOPOLOGY_HTTP_DEPS}
 from "../../apps/core-host/dist/iam-topology-multiorg-http-pilot.js";
import {PgMembership} from "../../apps/core-host/dist/adapters.js";
import {PINNED_TENANT_TRANSACTION} from "../../packages/core-kernel/dist/index.js";
import {Iam07dRevokeFirstPilot}
 from "../../apps/core-host/dist/iam07d-revoke-first-pilot.js";
import {Iam07dInboxBusinessPilot}
 from "../../apps/core-host/dist/iam07d-inbox-business-pilot.js";
import {IamTopologyInboxClaimController,IAM_TOPOLOGY_CLAIM_DEPS}
 from "../../apps/core-host/dist/iam-topology-inbox-claim-http-pilot.js";

const require=createRequire(new URL("../../apps/core-host/package.json",import.meta.url));
require("reflect-metadata");
const {Module}=require("@nestjs/common");
const {NestFactory}=require("@nestjs/core");
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG_A="22222222-2222-4222-8222-222222222222";
const WS_A1="44444444-4444-4444-8444-444444444444";
const REALM="syndes-iam-lab-ci";
const FGA="http://127.0.0.1:18089";
const CAP="inbox.conversation.claim";

export async function runIamMultiOrgKeycloakFgaHttpLab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 assert.equal(f.bearer,"Bearer "+f.atAlice);
 assert.ok(f.orgA&&f.orgB&&f.orgA!==f.orgB);
 // LAST composite test only: this whole PG17 tenant is deleted in finally.
 // Both SQL002 guards are removed together in a disposable transaction.
 const cutover=await f.tenantDb.connect();
 try{
  await cutover.query("BEGIN");
  await cutover.query("DROP INDEX platform_legacy_single_organization");
  await cutover.query("DROP INDEX platform_legacy_single_workspace");
  await cutover.query("COMMIT");
 }catch(e){await cutover.query("ROLLBACK").catch(()=>{});throw e}
 finally{cutover.release()}
 // A pinned connection performs the SQL002 cutover ONLY in the disposable
 // CI tenant database, which the enclosing IAM06B fixture drops in finally.
 const orgB=randomUUID(),wsA2=randomUUID(),wsB1=randomUUID(),wsB2=randomUUID();
 await f.tenantDb.query(
  "INSERT INTO platform_organizations(tenant_id,id,display_name)"+
  " VALUES($1,$2,'CI multi-org B')",[TENANT,orgB]);
 for(const [org,ws,label] of [
  [ORG_A,wsA2,"a2"],[orgB,wsB1,"b1"],[orgB,wsB2,"b2"],
 ]){
  await f.tenantDb.query(
   "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug)"+
   " VALUES($1,$2,$3,$4,$5)",
   [TENANT,ws,org,"CI "+label,"topo-"+label]);
 }
 await f.tenantDb.query(
  "INSERT INTO platform_org_memberships"+
  "(tenant_id,organization_id,principal_id,role)"+
  " VALUES($1,$2,$3,'editor')",[TENANT,orgB,f.actorId]);
 for(const [org,ws] of [[ORG_A,wsA2],[orgB,wsB1],[orgB,wsB2]]){
  await f.tenantDb.query(
   "INSERT INTO platform_workspace_memberships"+
   "(tenant_id,organization_id,workspace_id,principal_id,role)"+
   " VALUES($1,$2,$3,$4,'editor')",[TENANT,org,ws,f.actorId]);
 }
 // Link each Platform Organization to its own immutable Keycloak Org,
 // never a tenant-wide link; the link writes go through operator role.
 const link=(state,revision)=>[
  TENANT,orgB,REALM,f.orgB,state,revision,randomUUID(),
  "ci-trusted-operator","TOPO-04 dual organization membership probe",
 ];
 assert.equal(await f.linkTransition(f.control,link("active",0)),1);
 assert.equal((await f.links.findPlatform(TENANT,ORG_A)).length,1);
 assert.equal((await f.links.findPlatform(TENANT,orgB)).length,1);
 assert.equal((await f.links.findKeycloak(REALM,f.orgB))[0].organizationId,orgB);
 await f.changeMembership("POST",f.orgA,f.actorId,f.adminToken);
 await f.changeMembership("POST",f.orgB,f.actorId,f.adminToken);
 assert.equal(await f.members.isActiveMember(REALM,f.orgA,f.actorId),true);
 assert.equal(await f.members.isActiveMember(REALM,f.orgB,f.actorId),true);
 const admission=new OrganizationContextAdmissionPilot({
  realm:REALM,clientId:"syndes-iam-lab-ui",multiOrganizationEnabled:true,
  verifier:f.verifier,tenancy:new PgMembership(f.control),
  links:f.links,keycloakMembers:f.members,moduleAccess:f.moduleGate,
  tenantDatabases:f.provider,
  funnelOwnership:{isActiveInWorkspace:async()=>false},
 });
 const scope=(org,ws)=>({tenantId:TENANT,organizationId:org,
  workspaceId:ws,capability:CAP});
 const ctxA=await admission.resolve(f.bearer,scope(ORG_A,WS_A1));
 const ctxB=await admission.resolve(f.bearer,scope(orgB,wsB1));
 assert.equal(ctxA.keycloakOrganizationId,f.orgA);
 assert.equal(ctxB.keycloakOrganizationId,f.orgB);
 const model=JSON.parse(await readFile(new URL(
  "../../infra/security-access/fga-model-iam07d2-candidate.json",
  import.meta.url),"utf8"));
 const store=await f.fgaWrite("POST","/stores",{
  name:"topo04-dual-org-"+randomUUID()});
 await f.fgaWrite("POST","/stores/"+store.id+"/authorization-models",model);
 const fine=new OpenFgaFineCapabilityPolicy(FGA,store.id,"ci-disposable-fga-only");
 const tuple=ctx=>({user:"user:"+f.actorId,relation:"grantee",
  object:iam07dFineObject(ctx,CAP)});
 const tupleA=tuple(ctxA),tupleB=tuple(ctxB);
 assert.notEqual(tupleA.object,tupleB.object);
 assert.equal(await fine.canPerform(ctxA,CAP),false);
 assert.equal(await fine.canPerform(ctxB,CAP),false);
 await f.fgaWrite("POST","/stores/"+store.id+"/write",{
  writes:{tuple_keys:[tupleA,tupleB]}});
 // Actual business writes in BOTH organizations, through IAM07D pinned
 // transaction and exact per-workspace FGA, after SQL002 lab-only cutover.
 const tenantProvider={
  resolve:async id=>{
   if(id!==TENANT)throw Error("Wrong tenant");
   return {tenantId:id,query:(sql,params)=>f.tenantDb.query(sql,params)};
  },
  withTransaction:async(id,work)=>{
   if(id!==TENANT)throw Error("Wrong tenant");
   const client=await f.tenantDb.connect();
   try{
    await client.query("BEGIN");
    const tx={tenantId:id,[PINNED_TENANT_TRANSACTION]:true,
     query:(sql,params)=>client.query(sql,params??[])};
    const result=await work(tx);
    await client.query("COMMIT");
    return result;
   }catch(error){
    await client.query("ROLLBACK").catch(()=>{});
    throw error;
   }finally{client.release()}
  },
 };
 const protectedIam=new Iam07dRevokeFirstPilot(
  admission,fine,tenantProvider,f.control);
 const business=new Iam07dInboxBusinessPilot(protectedIam);
 for(const [org,ws] of [[ORG_A,WS_A1],[orgB,wsB1]]){
  await f.tenantDb.query("INSERT INTO platform_iam_capability_fences"+
   "(tenant_id,organization_id,workspace_id,principal_id,capability,epoch,state)"+
   " VALUES($1,$2,$3,$4,$5,1,'active')",
   [TENANT,org,ws,f.actorId,CAP]);
 }
 const chatA=randomUUID(),chatB=randomUUID(),crossChat=randomUUID();
 for(const [chat,org,ws] of [
  [chatA,ORG_A,WS_A1],[chatB,orgB,wsB1],[crossChat,orgB,wsB1],
 ]){
  await f.tenantDb.query("INSERT INTO inbox_conversations"+
   "(tenant_id,id,subject,channel,platform_organization_id,"+
   "platform_origin_workspace_id,platform_current_workspace_id)"+
   " VALUES($1,$2,'TOPO04B real claim','simulation',$3,$4,$4)",
   [TENANT,chat,org,ws]);
 }
 class DisposableTopologyHttpModule{}
 Module({controllers:[IamTopologyMultiOrgHttpController,IamTopologyInboxClaimController],providers:[
  {provide:IAM_TOPOLOGY_HTTP_DEPS,useValue:{verifier:f.verifier,admission,fine}},
  {provide:IAM_TOPOLOGY_CLAIM_DEPS,useValue:{verifier:f.verifier,business}},
 ]})(DisposableTopologyHttpModule);
 const app=await NestFactory.create(DisposableTopologyHttpModule,{logger:false});
 await app.listen(0,"127.0.0.1");
 const base=await app.getUrl();
 assert.ok(base.startsWith("http://127.0.0.1:"));
 const url=base+"/__ci/iam-topology/tenants/"+TENANT+
  "/inbox/conversations/claim-admission";
 const send=async(token=f.bearer,org=ORG_A,ws=WS_A1)=>{
  const response=await fetch(url,{
   method:"GET",headers:{
    ...(token?{authorization:token}:{}),
    "x-syndes-organization-id":org,
    "x-syndes-workspace-id":ws,
   },signal:AbortSignal.timeout(11000),cache:"no-store",redirect:"error",
  });
  const body=await response.text();
  assert.ok(!body.includes(f.atAlice));
  return response.status;
 };
 try{
  assert.equal(await send(),200);
  assert.equal(await send(f.bearer,orgB,wsB1),200);
  assert.equal(await send(f.bearer,ORG_A,wsA2),403);
  assert.equal(await send(f.bearer,orgB,wsB2),403);
  assert.equal(await send(f.bearer,ORG_A,wsB1),403);
  assert.equal(await send(f.bearer,orgB,WS_A1),403);
  assert.equal(await send(null),401);
  assert.equal(await send("Bearer invalid"),401);
  assert.equal(await send("Bearer "+f.managerToken),401);
  assert.equal(await send("Bearer "+f.otherUserToken,orgB,wsB1),403);
  // Identical signed JWT, two active Organizations. Revoking Org B must not
  // affect Org A's admission; the old JWT alone cannot revive Org B.
  await f.changeMembership("DELETE",f.orgB,f.actorId,f.adminToken);
  try{
   assert.equal(await send(f.bearer,orgB,wsB1),403);
   assert.equal(await send(f.bearer,ORG_A,WS_A1),200);
  }finally{await f.changeMembership("POST",f.orgB,f.actorId,f.adminToken)}
  assert.equal(await send(f.bearer,orgB,wsB1),200);
  // An FGA tuple for A cannot imply B, nor vice versa.
  await f.fgaWrite("POST","/stores/"+store.id+"/write",{
   deletes:{tuple_keys:[tupleA]}});
  try{
   assert.equal(await send(f.bearer,ORG_A,WS_A1),403);
   assert.equal(await send(f.bearer,orgB,wsB1),200);
  }finally{await f.fgaWrite("POST","/stores/"+store.id+"/write",{
   writes:{tuple_keys:[tupleA]}})}
  // SQL membership in B is not an identity and cannot grant access if
  // revoked; A continues to operate.
  await f.tenantDb.query("UPDATE platform_workspace_memberships"+
   " SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2"+
   " AND workspace_id=$3 AND principal_id=$4",
   [TENANT,orgB,wsB1,f.actorId]);
  try{
   assert.equal(await send(f.bearer,orgB,wsB1),403);
   assert.equal(await send(f.bearer,ORG_A,WS_A1),200);
  }finally{
   await f.tenantDb.query("UPDATE platform_workspace_memberships"+
    " SET state='active' WHERE tenant_id=$1 AND organization_id=$2"+
    " AND workspace_id=$3 AND principal_id=$4",
    [TENANT,orgB,wsB1,f.actorId]);
  }
  // Control link revision CAS revocation is independent by Organization.
  assert.equal(await f.linkTransition(f.control,link("revoked",1)),2);
  try{
   assert.equal(await send(f.bearer,orgB,wsB1),403);
   assert.equal(await send(f.bearer,ORG_A,WS_A1),200);
  }finally{assert.equal(await f.linkTransition(f.control,link("active",2)),3)}
  assert.equal(await send(f.bearer,orgB,wsB1),200);
  const claimUrl=chat=>base+"/__ci/iam-topology/tenants/"+TENANT+
   "/inbox/conversations/"+chat+"/claim";
  const claim=async(chat,org,ws,token=f.bearer)=>{
   const response=await fetch(claimUrl(chat),{
    method:"POST",headers:{
     ...(token?{authorization:token}:{}),
     "x-syndes-organization-id":org,"x-syndes-workspace-id":ws,
    },redirect:"error",cache:"no-store",signal:AbortSignal.timeout(11000),
   });
   const body=await response.text();
   assert.ok(!body.includes(f.atAlice));
   return response.status;
  };
  // Cross-organization conversation ID and workspace substitution are
  // rejected BEFORE any business mutation or audit event.
  assert.equal(await claim(chatB,ORG_A,WS_A1),403);
  assert.equal(await claim(chatA,orgB,wsB1),403);
  assert.equal(await claim(chatB,orgB,wsB2),403);
  assert.equal(await claim(chatB,orgB,wsB1,"Bearer invalid"),401);
  assert.equal(await claim(chatB,orgB,wsB1,"Bearer "+f.managerToken),401);
  assert.equal(await claim(chatB,orgB,wsB1,"Bearer "+f.otherUserToken),403);
  assert.equal(await claim(chatA,ORG_A,WS_A1),200);
  assert.equal(await claim(chatB,orgB,wsB1),200);
  assert.equal(await claim(chatA,ORG_A,WS_A1),403);
  for(const chat of [chatA,chatB]){
   const own=await f.tenantDb.query(
    "SELECT assigned_to FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",
    [TENANT,chat]);
   assert.equal(own.rows[0].assigned_to,f.actorId);
   const audit=await f.tenantDb.query(
    "SELECT count(*)::int AS n FROM inbox_events"+
    " WHERE tenant_id=$1 AND conversation_id=$2 AND action='assigned'",
    [TENANT,chat]);
   assert.equal(audit.rows[0].n,1);
  }
  assert.equal((await f.tenantDb.query(
   "SELECT assigned_to FROM inbox_conversations WHERE id=$1",[crossChat]))
   .rows[0].assigned_to,null);
  assert.equal((await f.tenantDb.query(
   "SELECT count(*)::int AS n FROM inbox_events WHERE conversation_id=$1",
   [crossChat])).rows[0].n,0);
  // Tenant-first scoped revocation B cannot block a DIFFERENT org A.
  const op=randomUUID();
  const revoke=await protectedIam.revoke({
   operationId:op,tenantId:TENANT,organizationId:orgB,
   workspaceId:wsB1,principalId:f.actorId,capability:CAP,expectedEpoch:1,
  });
  assert.equal(revoke,2);
  assert.equal(await claim(crossChat,orgB,wsB1),403);
  const chatA2=randomUUID();
  await f.tenantDb.query("INSERT INTO inbox_conversations"+
   "(tenant_id,id,subject,channel,platform_organization_id,"+
   "platform_origin_workspace_id,platform_current_workspace_id)"+
   " VALUES($1,$2,'TOPO04B post revoke','simulation',$3,$4,$4)",
   [TENANT,chatA2,ORG_A,WS_A1]);
  assert.equal(await claim(chatA2,ORG_A,WS_A1),200);
  assert.equal((await f.tenantDb.query(
   "SELECT state FROM platform_iam_capability_fences"+
   " WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3"+
   " AND principal_id=$4 AND capability=$5",
   [TENANT,ORG_A,WS_A1,f.actorId,CAP])).rows[0].state,"active");
  assert.equal((await f.tenantDb.query(
   "SELECT count(*)::int AS n FROM platform_iam_revocation_outbox"+
   " WHERE operation_id=$1 AND organization_id=$2",
   [op,orgB])).rows[0].n,1);
  console.log("IAM_TOPO04B_REAL_MULTI_ORG_INBOX_CLAIM_SQL_AUDIT_AND_SCOPED_REVOKE_PASS");
  console.log("IAM_TOPO04_REAL_TWO_KC_ORGS_SAME_TENANT_HTTP_FINE_FGA_ISOLATION_PASS");
  console.log("IAM_TOPO04_REAL_KC_ORG_B_REVOKE_A_STAYS_ACTIVE_PASS");
 }finally{
  await app.close();
 }
}
