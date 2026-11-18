/**
 * IAM07D2: real signed Keycloak bearer + Organizations + Control PG17 +
 * tenant PG17 SQL002 + dedicated candidate OpenFGA model/store.
 * ALL services are disposable loopback, not operational IAM.
 */
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {PINNED_TENANT_TRANSACTION,AccessDeniedError} from "../../packages/core-kernel/dist/index.js";
import {Iam07dRevokeFirstPilot}
 from "../../apps/core-host/dist/iam07d-revoke-first-pilot.js";
import {Iam07dRevocationOutboxDispatcher}
 from "../../apps/core-host/dist/iam07d-revocation-dispatcher.js";
import {OpenFgaFineCapabilityPolicy,OpenFgaFineGrantRevoker,iam07dFineObject}
 from "../../apps/core-host/dist/iam07d-fine-fga-policy.js";
import {pilotResourceName}
 from "../../apps/core-host/dist/keycloak-authorization-pilot.js";

const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const FGA="http://127.0.0.1:18089";
const CAP="inbox.conversation.claim";
const TRANSFER="inbox.conversation.transfer";
const FUNNEL="service.funnel.operate";

export async function runIam07d2FineFgaLiveLab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 assert.equal(f.bearer,"Bearer "+f.atAlice);
 const model=JSON.parse(await readFile(new URL(
  "../../infra/security-access/fga-model-iam07d2-candidate.json",
  import.meta.url),"utf8"));
 assert.ok(model.type_definitions.some(x=>x.type==="iam_capability"));
 const store=await f.fgaWrite("POST","/stores",{
  name:"iam07d2-exact-caps-"+randomUUID(),
 });
 const installed=await f.fgaWrite("POST","/stores/"+store.id+"/authorization-models",model);
 assert.ok(installed.authorization_model_id);
 const fine=new OpenFgaFineCapabilityPolicy(FGA,store.id,"disposable-only-fga-ci");
 const request=cap=>({tenantId:TENANT,organizationId:ORG,workspaceId:WS,capability:cap});
 const claimContext=await f.admission.resolve(f.bearer,request(CAP));
 const transferContext=await f.admission.resolve(f.bearer,request(TRANSFER));
 const claimObject=iam07dFineObject(claimContext,CAP);
 const transferObject=iam07dFineObject(transferContext,TRANSFER);
 assert.notEqual(claimObject,transferObject);
 const claimTuple={user:"user:"+f.actorId,relation:"grantee",object:claimObject};
 assert.equal(await fine.canPerform(claimContext,CAP),false);
 assert.equal(await fine.canPerform(transferContext,TRANSFER),false);
 await f.fgaWrite("POST","/stores/"+store.id+"/write",{
  writes:{tuple_keys:[claimTuple]},
 });
 assert.equal(await fine.canPerform(claimContext,CAP),true);
 assert.equal(await fine.canPerform(transferContext,TRANSFER),false,
  "Claim grant must not imply transfer, despite legacy can_write grant");
 await assert.rejects(fine.canPerform({...claimContext,
  capability:TRANSFER},CAP));
 await assert.rejects(fine.canPerform({...claimContext,
  resourceName:claimContext.resourceName+":funnel:"+randomUUID()},CAP));
 for(const altered of [
  {...claimContext,tenantId:randomUUID()},
  {...claimContext,organizationId:randomUUID()},
  {...claimContext,workspaceId:randomUUID()},
  {...claimContext,actor:{kind:"user",id:randomUUID()}},
 ]){
  const ok=await fine.canPerform({...altered,
    resourceName:pilotResourceName({
     tenantId:altered.tenantId,organizationId:altered.organizationId,
     workspaceId:altered.workspaceId,kind:"workspace",
    })},CAP);
  assert.equal(ok,false,"Exact fine grant must not leak across contexts");
 }
 const funnelA=randomUUID(),funnelB=randomUUID();
 const funnelContext=(funnelId)=>({
  ...claimContext,moduleId:"service",capability:FUNNEL,
  resourceName:pilotResourceName({
   tenantId:TENANT,organizationId:ORG,workspaceId:WS,kind:"funnel",funnelId,
  }),
 });
 const fa=funnelContext(funnelA),fb=funnelContext(funnelB);
 const funnelTuple={user:claimTuple.user,relation:"grantee",
  object:iam07dFineObject(fa,FUNNEL)};
 await f.fgaWrite("POST","/stores/"+store.id+"/write",{
  writes:{tuple_keys:[funnelTuple]},
 });
 assert.equal(await fine.canPerform(fa,FUNNEL),true);
 assert.equal(await fine.canPerform(fb,FUNNEL),false,
  "Grant for funnel A must NOT operate funnel B");
 assert.equal(await fine.canPerform(transferContext,TRANSFER),false);
 // On the same disposable tenant database: real identity admission +
 // exact fine model + SQL epoch. The effect and audit use the pinned lease.
 await f.tenantDb.query(await readFile(new URL(
  "../../modules/organizations/sql/008_iam07d_revoke_first_candidate.sql",
  import.meta.url),"utf8"));
 for(const cap of [CAP,TRANSFER])await f.tenantDb.query(
  "INSERT INTO platform_iam_capability_fences"+
  "(tenant_id,organization_id,workspace_id,principal_id,capability,epoch,state)"+
  " VALUES($1,$2,$3,$4,$5,1,'active')",
  [TENANT,ORG,WS,f.actorId,cap]);
 await f.tenantDb.query("CREATE TABLE iam07d2_live_effects"+
  "(id uuid primary key,capability text not null)");
 const tenantProvider={
  resolve:async id=>{
   if(id!==TENANT)throw Error("Unknown tenant");
   return {tenantId:id,query:(sql,params)=>f.tenantDb.query(sql,[...params])};
  },
  withTransaction:async(id,work)=>{
   if(id!==TENANT)throw Error("Unknown tenant");
   const client=await f.tenantDb.connect();
   try{
    await client.query("BEGIN");
    const tx={
     tenantId:id,[PINNED_TENANT_TRANSACTION]:true,
     query:(sql,params)=>client.query(sql,[...(params??[])]),
    };
    const result=await work(tx);
    await client.query("COMMIT");
    return result;
   }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
   finally{client.release()}
  },
 };
 await f.control.query(await readFile(new URL(
  "../../infra/postgres/bootstrap/control-iam07d-revocation-receipts.schema",
  import.meta.url),"utf8"));
 let controlAvailable=true;
 const controlled=new Iam07dRevokeFirstPilot(
  f.admission,fine,tenantProvider,{query:(sql,params)=>{
   if(!controlAvailable)throw Error("Control transport deliberately unavailable");
   return f.control.query(sql,params);
  }},
 );
 const ticket=await controlled.issue(f.bearer,request(CAP));
 assert.equal(ticket.epoch,1);
 await assert.rejects(controlled.issue(f.bearer,request(TRANSFER)),AccessDeniedError);
 const one=randomUUID();
 await controlled.execute(ticket,async tx=>{
  await tx.query("INSERT INTO iam07d2_live_effects(id,capability) VALUES($1,$2)",[one,CAP]);
 });
 assert.equal((await f.tenantDb.query(
  "SELECT count(*)::int AS n FROM iam07d2_live_effects")).rows[0].n,1);
 // A direct OpenFGA change is detected on the next admission, but an already
 // issued ticket is NOT globally fenced unless revocation passes tenant first.
 await f.fgaWrite("POST","/stores/"+store.id+"/write",{
  deletes:{tuple_keys:[claimTuple]},
 });
 assert.equal(await fine.canPerform(claimContext,CAP),false);
 await assert.rejects(controlled.issue(f.bearer,request(CAP)),AccessDeniedError);
 await assert.rejects(controlled.execute(ticket,async tx=>{
  await tx.query("INSERT INTO iam07d2_live_effects(id,capability) VALUES($1,$2)",
   [randomUUID(),CAP]);
 }),AccessDeniedError,"A signed ticket is rechecked against live fine FGA on execute");
 assert.equal((await f.tenantDb.query(
  "SELECT count(*)::int AS n FROM iam07d2_live_effects")).rows[0].n,1);
 // Restore the specific tuple for the trusted administrator test.
 await f.fgaWrite("POST","/stores/"+store.id+"/write",{
  writes:{tuple_keys:[claimTuple]},
 });
 const preRevocation=await controlled.issue(f.bearer,request(CAP));
 // A direct Keycloak membership revocation, once observed, must deny
 // execution even if the signed JWT and fine FGA tuple remain valid.
 await f.changeMembership("DELETE",f.orgId,f.actorId,f.adminToken);
 try{
  await assert.rejects(controlled.execute(preRevocation,async tx=>{
   await tx.query("INSERT INTO iam07d2_live_effects(id,capability) VALUES($1,$2)",
    [randomUUID(),CAP]);
  }),AccessDeniedError);
 }finally{
  await f.changeMembership("POST",f.orgId,f.actorId,f.adminToken);
 }
 assert.equal((await f.tenantDb.query(
  "SELECT count(*)::int AS n FROM iam07d2_live_effects")).rows[0].n,1);
 assert.equal(await fine.canPerform(claimContext,CAP),true);
 // Registration is an independently reviewed reconciliation list, never
 // a grant. A missing catalog entry cannot authorize a dispatcher ACK.
 await f.tenantDb.query(
  "INSERT INTO platform_iam_fga_grant_targets"+
  "(tenant_id,organization_id,workspace_id,principal_id,capability,"+
  "resource_name,fga_object) VALUES($1,$2,$3,$4,$5,$6,$7)",
  [TENANT,ORG,WS,f.actorId,CAP,claimContext.resourceName,claimObject]);
 const command={
  operationId:randomUUID(),tenantId:TENANT,organizationId:ORG,
  workspaceId:WS,principalId:f.actorId,capability:CAP,expectedEpoch:1,
 };
 controlAvailable=false;
 await assert.rejects(controlled.revoke(command),AccessDeniedError,
  "Control outage follows committed tenant deny and outbox");
 assert.equal((await f.tenantDb.query(
  "SELECT state FROM platform_iam_capability_fences WHERE capability=$1",
  [CAP])).rows[0].state,"revoked");
 const queued=await f.tenantDb.query(
  "SELECT state FROM platform_iam_revocation_outbox WHERE operation_id=$1",
  [command.operationId]);
 assert.equal(queued.rows[0].state,"pending");
 await assert.rejects(controlled.execute(preRevocation,async tx=>{
  await tx.query("INSERT INTO iam07d2_live_effects(id,capability) VALUES($1,$2)",
   [randomUUID(),CAP]);
 }),AccessDeniedError);
 assert.equal(await fine.canPerform(claimContext,CAP),true,
  "Remote tuple may remain ALLOW, but tenant fence blocks business writes");
 const deadFga=new OpenFgaFineGrantRevoker(
  "http://127.0.0.1:18998",store.id,"disposable-only-fga-ci");
 controlAvailable=true;
 const failing=new Iam07dRevocationOutboxDispatcher(
  tenantProvider,deadFga,command=>controlled.revoke(command));
 await assert.rejects(failing.deliver(TENANT,command.operationId),AccessDeniedError);
 assert.equal((await f.tenantDb.query(
  "SELECT state FROM platform_iam_revocation_outbox WHERE operation_id=$1",
  [command.operationId])).rows[0].state,"pending");
 const liveRevoker=new OpenFgaFineGrantRevoker(
  FGA,store.id,"disposable-only-fga-ci");
 const dispatcher=new Iam07dRevocationOutboxDispatcher(
  tenantProvider,liveRevoker,command=>controlled.revoke(command));
 assert.equal(await dispatcher.deliver(TENANT,command.operationId),"delivered");
 assert.equal(await dispatcher.deliver(TENANT,command.operationId),"already_delivered");
 assert.equal(await fine.canPerform(claimContext,CAP),false);
 assert.equal((await f.tenantDb.query(
  "SELECT state FROM platform_iam_revocation_outbox WHERE operation_id=$1",
  [command.operationId])).rows[0].state,"delivered");
 assert.equal((await f.control.query(
  "SELECT count(*)::int AS n FROM platform_iam07d_revocation_receipts"+
  " WHERE operation_id=$1",[command.operationId])).rows[0].n,1);
 const dead=new OpenFgaFineCapabilityPolicy(
  "http://127.0.0.1:18998",store.id,"disposable-only-fga-ci");
 await assert.rejects(controlled.issue(f.bearer,request(TRANSFER)),AccessDeniedError);
 await assert.rejects(dead.canPerform(claimContext,CAP));
 console.log("IAM07D2_REAL_KEYCLOAK_SIGNED_JWT_PG17_OPENFGA_EXACT_CAPABILITY_PASS");
 console.log("IAM07D2_REAL_FGA_FUNNEL_A_B_AND_COARSE_GRANT_ISOLATION_PASS");
 console.log("IAM07D2_REAL_TENANT_FIRST_OUTBOX_FGA_RECOVERY_CONTROL_RECONCILE_PASS");
}
