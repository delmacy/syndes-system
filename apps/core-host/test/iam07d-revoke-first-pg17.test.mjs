/**
 * IAM-07D1: real, separate disposable PG17 Control+tenant databases.
 * Tests monotonic revoke-first epoch, pinned business effects, local fencing,
 * cross-capability isolation, Control outage and exact-operation retry.
 * Existing signed-JWT/Keycloak/FGA checks are exercised in IAM-06B/07C lab.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {PINNED_TENANT_TRANSACTION,AccessDeniedError} from "@syndes/core-kernel";
import {Iam07dRevokeFirstPilot} from "../dist/iam07d-revoke-first-pilot.js";

const require=createRequire(new URL("../package.json",import.meta.url));
const {Client,Pool}=require("pg");
const url=process.env.SYNDES_IAM04_PG_URL;
const safe=(()=>{
 try{
  const u=new URL(url);
  return process.env.SYNDES_IAM04_DISPOSABLE_PG==="IAM04B_PG17_ONLY"&&
   u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&
   u.port==="32779"&&u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password==="ci-only-disposable-iam-ci";
 }catch{return false}
})();
const file=rel=>readFile(new URL(rel,import.meta.url),"utf8");
const CAP="inbox.conversation.claim";
const TRANSFER="inbox.conversation.transfer";
const FUNNEL="service.funnel.operate";
const actor=randomUUID(),tenant=randomUUID(),org=randomUUID(),ws=randomUUID();
const permission=cap=>({
 tenantId:tenant,organizationId:org,workspaceId:ws,
 capability:cap,...(cap===FUNNEL?{funnelId:randomUUID()}:{}),
});
const cmd=(cap,epoch,operationId=randomUUID())=>({
 tenantId:tenant,organizationId:org,workspaceId:ws,
 principalId:actor,capability:cap,expectedEpoch:epoch,operationId,
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test("IAM07D PG17 tenant-first monotonic per-capability revocation and pinned SQL effect",{
 skip:!safe&&"requires existing disposable IAM04 PG17 runner",
},async t=>{
 const admin=new Client({connectionString:url});await admin.connect();
 const suffix=randomUUID().replaceAll("-","").slice(0,16);
 const names=["syndes_iam07d_control_"+suffix,"syndes_iam07d_tenant_"+suffix];
 let control,tenantDb,created=[];
 const dsn=name=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};
 try{
  const ver=Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
  assert.ok(ver>=170000&&ver<180000);
  for(const name of names){
   await admin.query('CREATE DATABASE "'+name+'"');created.push(name);
  }
  control=new Pool({connectionString:dsn(names[0]),max:4});
  tenantDb=new Pool({connectionString:dsn(names[1]),max:6});
  for(const path of [
   "../../../modules/organizations/sql/001_account_hierarchy.sql",
   "../../../modules/organizations/sql/002_legacy_single_context_gate.sql",
   "../../../modules/organizations/sql/008_iam07d_revoke_first_candidate.sql",
  ])await tenantDb.query(await file(path));
  await control.query(await file("../../../infra/postgres/bootstrap/control-iam07d-revocation-receipts.schema"));
  await tenantDb.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'IAM07D CI',true)",[tenant,org]);
  await tenantDb.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'CI Workspace','ci',true)",[tenant,ws,org]);
  await tenantDb.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,$3,'editor')",[tenant,org,actor]);
  await tenantDb.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,$4,'editor')",[tenant,org,ws,actor]);
  for(const cap of [CAP,TRANSFER,FUNNEL])
   await tenantDb.query(
    "INSERT INTO platform_iam_capability_fences(tenant_id,organization_id,workspace_id,principal_id,capability,epoch,state) "+
    "VALUES($1,$2,$3,$4,$5,1,'active')",[tenant,org,ws,actor,cap]);

  await tenantDb.query("CREATE TABLE iam07d_effects(id UUID PRIMARY KEY,capability TEXT NOT NULL)");
  const tickets=[];
  let policyAvailable=true,controlAvailable=true,admissionAvailable=true;
  const provider={
   resolve:async id=>{
    if(id!==tenant)throw Error("unregistered tenant");
    return {tenantId:id,query:(sql,values)=>tenantDb.query(sql,[...values])};
   },
   withTransaction:async(id,fn)=>{
    if(id!==tenant)throw Error("unregistered tenant");
    const client=await tenantDb.connect();
    try{
     await client.query("BEGIN");
     const tx={tenantId:id,[PINNED_TENANT_TRANSACTION]:true,
      query:(sql,values)=>client.query(sql,[...(values??[])])};
     const result=await fn(tx);
     await client.query("COMMIT");
     return result;
    }catch(e){await client.query("ROLLBACK").catch(()=>{});throw e}
    finally{client.release()}
   },
  };
  const pilot=new Iam07dRevokeFirstPilot({
   resolve:async(bearer,requested)=>{
    if(!admissionAvailable||bearer!=="Bearer signed-and-verified-upstream"||
       requested.tenantId!==tenant||
       requested.organizationId!==org||
       requested.workspaceId!==ws)
     throw Error("invalid verified admission");
    return {
     actor:{kind:"user",id:actor},tenantId:tenant,
     organizationId:org,workspaceId:ws,
     moduleId:requested.capability===FUNNEL?"service":"inbox",
     keycloakOrganizationId:randomUUID(),realm:"syndes-iam-lab-ci",
     capability:requested.capability,scopeWriteAllowed:true,
     resourceName:"ci-trusted",
    };
   },
  },{canPerform:async(ctx,cap)=>{
    tickets.push(cap);
    return policyAvailable&&ctx.actor.id===actor&&[CAP,TRANSFER,FUNNEL].includes(cap);
  }},provider,{query:async(sql,values)=>{
    if(!controlAvailable)throw Error("Control PG17 deliberately offline");
    return control.query(sql,values);
  }});
  const issue=cap=>pilot.issue("Bearer signed-and-verified-upstream",permission(cap));
  const effect=async(ticket,id=randomUUID())=>pilot.execute(ticket,async(tx,grant)=>{
    await tx.query("INSERT INTO iam07d_effects(id,capability) VALUES($1::uuid,$2)",
     [id,grant.capability]);
    return id;
  });
  const count=async(cap)=>(await tenantDb.query(
    "SELECT count(*)::int AS n FROM iam07d_effects WHERE capability=$1",[cap])).rows[0].n;

  await t.test("requires exact independently authorized capability and trusted ticket",async()=>{
   policyAvailable=false;
   await assert.rejects(issue(CAP),AccessDeniedError);
   policyAvailable=true;
   admissionAvailable=false;
   await assert.rejects(issue(CAP),AccessDeniedError);
   admissionAvailable=true;
   await assert.rejects(pilot.issue("Bearer decoded-payload-only",permission(CAP)),AccessDeniedError);
   await assert.rejects(pilot.issue("Bearer signed-and-verified-upstream",{
    ...permission(CAP),capability:"inbox.message.send",
   }),AccessDeniedError);
   const issued=await issue(CAP);
   assert.equal(issued.epoch,1);
   await assert.rejects(pilot.execute({...issued},async()=>true),AccessDeniedError,
    "Callers cannot mint tickets by cloning objects");
   assert.ok(tickets.every(c=>[CAP,TRANSFER,FUNNEL].includes(c)));
  });

  await t.test("effect locked first COMMITs before revocation acknowledges",async()=>{
   const ticket=await issue(TRANSFER);
   let entered;
   const enteredPromise=new Promise(resolve=>{entered=resolve});
   let finish;
   const untilFinish=new Promise(resolve=>{finish=resolve});
   const effectId=randomUUID();
   const business=pilot.execute(ticket,async(tx)=>{
    await tx.query("INSERT INTO iam07d_effects(id,capability) VALUES($1,$2)",
      [effectId,TRANSFER]);
    entered();
    await untilFinish;
    return effectId;
   });
   await enteredPromise;
   let settled=false;
   const revokeCommand=cmd(TRANSFER,1);
   const revocation=pilot.revoke(revokeCommand);
   revocation.then(()=>{settled=true},()=>{settled=true});
   await sleep(150);
   assert.equal(settled,false,"External revoke cannot ACK while an earlier effect holds the tenant row lock");
   finish();
   assert.equal(await business,effectId);
   assert.equal(await revocation,2);
   assert.equal(await count(TRANSFER),1);
   const row=(await control.query(
    "SELECT tenant_revoked_epoch,state FROM platform_iam07d_revocation_receipts WHERE operation_id=$1",
    [revokeCommand.operationId])).rows[0];
   assert.equal(Number(row.tenant_revoked_epoch),2);
   assert.equal(row.state,"revoked");
   await assert.rejects(effect(ticket),AccessDeniedError,"old ticket fenced after revocation");
   await assert.rejects(issue(TRANSFER),AccessDeniedError,"new ticket cannot be issued for revoked action");
   assert.equal(await count(TRANSFER),1);
  });

  await t.test("revocation lock first forces pending effect to deny without audit",async()=>{
   const ticket=await issue(CAP);
   const revoker=await tenantDb.connect();
   let inTx=false,execution;
   try{
    await revoker.query("BEGIN");inTx=true;
    await revoker.query(
     "UPDATE platform_iam_capability_fences SET state='revoked',epoch=2,"+
     "last_revoke_operation_id=$6::uuid WHERE tenant_id=$1 AND organization_id=$2"+
     " AND workspace_id=$3 AND principal_id=$4 AND capability=$5",
     [tenant,org,ws,actor,CAP,randomUUID()]);
    let done=false;
    execution=effect(ticket);
    execution.then(()=>{done=true},()=>{done=true});
    await sleep(150);
    assert.equal(done,false,"effect waits for committed revocation transaction");
    await revoker.query("COMMIT");inTx=false;
    await assert.rejects(execution,AccessDeniedError);
    execution=undefined;
    assert.equal(await count(CAP),0);
    // A separate typed action remains unaffected by unrelated revocation.
    assert.equal((await issue(FUNNEL)).capability,FUNNEL);
   }finally{
    if(inTx)await revoker.query("ROLLBACK");
    if(execution)await execution.catch(()=>{});
    revoker.release();
   }
  });

  await t.test("Control outage after tenant-first revoke cannot reopen action; retries are idempotent",async()=>{
   const ticket=await issue(FUNNEL);
   const command=cmd(FUNNEL,1);
   controlAvailable=false;
   await assert.rejects(pilot.revoke(command),AccessDeniedError);
   assert.equal((await tenantDb.query(
    "SELECT state,epoch FROM platform_iam_capability_fences WHERE capability=$1",
    [FUNNEL])).rows[0].state,"revoked");
   await assert.rejects(effect(ticket),AccessDeniedError);
   assert.equal(await count(FUNNEL),0);
   controlAvailable=true;
   assert.equal(await pilot.revoke(command),2,"same operation reconciles Control exactly once");
   assert.equal(await pilot.revoke(command),2);
   await assert.rejects(pilot.revoke({...command,operationId:randomUUID()}),AccessDeniedError);
   assert.equal((await control.query(
    "SELECT count(*)::int AS n FROM platform_iam07d_revocation_receipts WHERE capability=$1",
    [FUNNEL])).rows[0].n,1);
   const other=await control.query(
    "SELECT count(*)::int AS n FROM platform_iam07d_revocation_receipts");
   assert.equal(other.rows[0].n,2,
    "Only successful tenant-first revocations enter Control receipts");
  });

  await t.test("capability types cannot be swapped; missing fence is fail-closed",async()=>{
   await assert.rejects(pilot.issue("Bearer signed-and-verified-upstream",{
    ...permission(FUNNEL),funnelId:undefined,
   }),AccessDeniedError);
   await assert.rejects(pilot.issue("Bearer signed-and-verified-upstream",{
    ...permission(CAP),workspaceId:randomUUID(),
   }),AccessDeniedError);
   assert.equal(await count(CAP),0);
   assert.equal(await count(FUNNEL),0);
   console.log("IAM07D_PG17_REVOKE_FIRST_EPOCH_LOCK_CONTROL_OUTAGE_REPLAY_PASS");
   console.log("IAM07D_FINE_CAPABILITY_NO_COARSE_GRANT_FALLBACK_PASS");
  });
 }finally{
  if(control)await control.end();
  if(tenantDb)await tenantDb.end();
  for(const name of created.reverse())await admin.query('DROP DATABASE "'+name+'"');
  await admin.end();
 }
});
