import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {execFileSync} from "node:child_process";
import pg from "pg";
import {CoreKernel,PINNED_TENANT_TRANSACTION,AccessDeniedError}
 from "@syndes/core-kernel";
import {ServiceFunnelService,ServiceFunnelConflictError,ServiceFunnelInputError}
 from "../dist/index.js";

const URL_RAW=process.env.SYNDES_FUNNEL_PG_URL;
const safe=(()=>{
 if(process.env.SYNDES_FUNNEL_DISPOSABLE!=="FUNNEL_PG17_ONLY"||!URL_RAW)return false;
 try{const u=new URL(URL_RAW);
  return u.protocol==="postgresql:"&&u.hostname==="127.0.0.1"&&u.port==="32772"&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password.startsWith("ci-only-disposable-funnel-");
 }catch{return false}
})();
const sql=path=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=name=>{const u=new URL(URL_RAW);u.pathname="/"+name;return u.toString()};
const migrations=[
 "../../../modules/organizations/sql/001_account_hierarchy.sql",
 "../../../modules/organizations/sql/002_legacy_single_context_gate.sql",
 "../../../modules/core-crm/sql/001_crm_foundation.sql",
 "../../../modules/core-crm/sql/002_crm_tags_notes.sql",
 "../../../modules/core-crm/sql/003_crm_employees_channels.sql",
 "../../../modules/inbox/sql/001_inbox_foundation.sql",
 "../../../modules/whatsapp/sql/001_whatsapp_accounts.sql",
 "../../../modules/organizations/sql/003_legacy_ownership.sql",
 "../sql/001_service_funnels.sql",
];
const roles=["owner-a","agent-a","viewer-a","revoked-a"];
const inserts=async(pool,{tenantId,orgId,workspaceId,conversationId},people)=>{
 await pool.query(`INSERT INTO platform_organizations(tenant_id,id,display_name,is_default)
 VALUES($1,$2,'Fixture organization',true)`,[tenantId,orgId]);
 await pool.query(`INSERT INTO platform_workspaces(
  tenant_id,id,organization_id,name,slug,is_default)
 VALUES($1,$2,$3,'Fixture workspace','fixture',true)`,
  [tenantId,workspaceId,orgId]);
 for(const [id,role,state] of people){
  await pool.query(`INSERT INTO platform_org_memberships(
   tenant_id,organization_id,principal_id,role,state)
   VALUES($1,$2,$3,$4,$5)`,[tenantId,orgId,id,role,state]);
  await pool.query(`INSERT INTO platform_workspace_memberships(
   tenant_id,organization_id,workspace_id,principal_id,role,state)
   VALUES($1,$2,$3,$4,$5,$6)`,[tenantId,orgId,workspaceId,id,role,state]);
 }
 await pool.query(`INSERT INTO inbox_conversations
 (tenant_id,id,subject,channel,platform_organization_id,
  platform_origin_workspace_id,platform_current_workspace_id)
 VALUES($1,$2,'Fixture conversation','simulation',$3,$4,$4)`,
  [tenantId,conversationId,orgId,workspaceId]);
};

test("PG17 disposable service management: tenant/workspace scope, funnel and protocol",
 {skip:!safe},async t=>{
 const container=JSON.parse(execFileSync("docker",["inspect","syndes-funnel-pg17-20261111"],
  {encoding:"utf8",timeout:5000}))[0];
 assert.equal(container.Config.Image,"postgres:17-alpine");
 assert.equal(container.Config.Labels["syndes.disposable"],"funnel-mvp-pg17");
 assert.ok(container.NetworkSettings.Ports["5432/tcp"].some(p=>
  p.HostIp==="127.0.0.1"&&p.HostPort==="32772"));
 const admin=new pg.Client({connectionString:URL_RAW});
 await admin.connect();
 const ver=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
 assert.ok(ver>=170000&&ver<180000);
 const tenants=[
  {tenantId:randomUUID(),orgId:randomUUID(),workspaceId:randomUUID(),conversationId:randomUUID()},
  {tenantId:randomUUID(),orgId:randomUUID(),workspaceId:randomUUID(),conversationId:randomUUID()},
 ];
 const dbNames=tenants.map(x=>"syndes_tenant_"+x.tenantId.replaceAll("-",""));
 const pools=new Map(),created=[];
 try{
  for(const [i,x] of tenants.entries()){
   const name=dbNames[i];
   await admin.query('CREATE DATABASE "'+name+'"');created.push(name);
   const pool=new pg.Pool({connectionString:dsn(name),max:5});
   pools.set(x.tenantId,pool);
   for(const migration of migrations)await pool.query(await sql(migration));
   await inserts(pool,x,i===0?
     [["owner-a","admin","active"],["agent-a","editor","active"],
      ["viewer-a","viewer","active"],["revoked-a","editor","revoked"]]:
     [["owner-b","admin","active"]]);
   // Re-apply the migration to verify that it does not rewrite existing data.
   await pool.query(await sql("../sql/001_service_funnels.sql"));
  }
  const canTenant=(actor,tenantId)=>tenantId===tenants[0].tenantId?
   roles.includes(actor.id):actor.id==="owner-b";
  let authAllowed=true;
  let moduleEnabled=true;
  const kernel=new CoreKernel({modules:[{id:"platform",version:"0.1.0"},
    {id:"service-management",version:"0.1.0",dependencies:["platform"]}],
   moduleAccess:{canExecuteModule:async()=>moduleEnabled},
   tenancy:{canAccessTenant:async({actor,tenantId})=>canTenant(actor,tenantId)},
   authorization:{canAccess:async()=>authAllowed},
  });
  await kernel.start();
  const providers={resolve:async tenantId=>{
   if(!pools.has(tenantId))throw Error("Tenant database unavailable");
   return {tenantId,query:(sql,params=[])=>pools.get(tenantId).query(sql,params)};
  },withTransaction:async(tenantId,callback)=>{
   const pool=pools.get(tenantId);
   if(!pool)throw Error("Unregistered tenant");
   const client=await pool.connect();
   try{
    await client.query("BEGIN");
    const tx={tenantId,[PINNED_TENANT_TRANSACTION]:true,
      query:(statement,params=[])=>client.query(statement,params)};
    const out=await callback(tx);
    await client.query("COMMIT");
    return out;
   }catch(e){await client.query("ROLLBACK");throw e}
   finally{client.release()}
  }};
  const service=new ServiceFunnelService(kernel,providers);
  const ctx=(i,id)=>({
   tenantId:tenants[i].tenantId,organizationId:tenants[i].orgId,
   workspaceId:tenants[i].workspaceId,actor:{id,kind:"user"},
  });
  let funnel,attendance,secondStage,thirdStage;

  await t.test("admin can publish custom 3-stage funnel; published stages immutable",async()=>{
   funnel=await service.publishSimpleFunnel(ctx(0,"owner-a"),{
    code:"suporte_cliente",name:"Atendimento personalizado",
    stages:[{code:"entrada",label:"Recebido"},{code:"trabalho",label:"Em execução"},
     {code:"concluido",label:"Pronto para fechamento"}],
   });
   assert.equal(funnel.state,"published");
   const pool=pools.get(tenants[0].tenantId);
   const publishedList=await service.listFunnels(ctx(0,"viewer-a"));
   assert.equal(publishedList.length,1);
   assert.equal(publishedList[0].code,"suporte_cliente");
   assert.deepEqual(publishedList[0].stages.map(s=>s.position),[1,2,3]);
   const steps=(await pool.query(`SELECT id::text,position,terminal
    FROM service_funnel_stages WHERE funnel_id=$1 ORDER BY position`,[funnel.id])).rows;
   assert.deepEqual(steps.map(x=>x.position),[1,2,3]);
   assert.deepEqual(steps.map(x=>x.terminal),[false,false,true]);
   [,{id:secondStage},{id:thirdStage}]=steps;
   await assert.rejects(pool.query(`UPDATE service_funnel_stages
    SET label='Reescrever' WHERE funnel_id=$1`,[funnel.id]),e=>e.code==="23514");
   await assert.rejects(service.publishSimpleFunnel(ctx(0,"viewer-a"),{
    code:"outro",name:"Não autorizado",stages:[
     {code:"one",label:"First step"},{code:"two",label:"Final step"}],
   }),AccessDeniedError);
  });

  await t.test("open real protocol linked to Inbox; no message/history mutation",async()=>{
   const before=Number((await pools.get(tenants[0].tenantId).query(
    "SELECT count(*)::int AS n FROM inbox_conversations")).rows[0].n);
   attendance=await service.open(ctx(0,"agent-a"),{
    funnelId:funnel.id,conversationId:tenants[0].conversationId,
    idempotencyKey:"browser-command-open-20261111",
   });
   const repeated=await service.open(ctx(0,"agent-a"),{
    funnelId:funnel.id,conversationId:tenants[0].conversationId,
    idempotencyKey:"browser-command-open-20261111",
   });
   assert.equal(repeated.id,attendance.id);
   assert.equal(repeated.protocol,attendance.protocol);
   await assert.rejects(service.open(ctx(0,"owner-a"),{
    funnelId:funnel.id,conversationId:tenants[0].conversationId,
    idempotencyKey:"browser-command-open-20261111",
   }),ServiceFunnelConflictError);
   assert.equal(Number((await pools.get(tenants[0].tenantId).query(
    "SELECT count(*)::int AS n FROM service_attendances")).rows[0].n),1);
   assert.match(attendance.protocol,/^ATD-\d+$/);
   assert.equal(attendance.version,1);
   assert.equal(attendance.conversationId,tenants[0].conversationId);
   assert.equal((await service.get(ctx(0,"viewer-a"),attendance.id)).id,attendance.id);
   assert.equal((await service.board(ctx(0,"viewer-a"),funnel.id)).length,1);
   assert.equal(Number((await pools.get(tenants[0].tenantId).query(
    "SELECT count(*)::int AS n FROM inbox_conversations")).rows[0].n),before);
   assert.equal((await service.history(ctx(0,"agent-a"),attendance.id))[0].action,"created");
  });

  await t.test("assignment rejects outsider/revoked and stamps actor in same transaction",async()=>{
   await assert.rejects(service.assign(ctx(0,"agent-a"),{
    attendanceId:attendance.id,assigneeId:"revoked-a",expectedVersion:1,
   }),ServiceFunnelConflictError);
   attendance=await service.assign(ctx(0,"agent-a"),{
    attendanceId:attendance.id,assigneeId:"agent-a",expectedVersion:1,
   });
   assert.equal(attendance.version,2);
   assert.equal(attendance.assignedTo,"agent-a");
   const history=await service.history(ctx(0,"agent-a"),attendance.id);
   assert.deepEqual(history.map(x=>x.action),["created","assigned"]);
   assert.deepEqual(history.map(x=>x.actorId),["agent-a","agent-a"]);
  });

  await t.test("stage changes are adjacent + CAS; only terminal stage can close",async()=>{
   await assert.rejects(service.advance(ctx(0,"agent-a"),{
    attendanceId:attendance.id,nextStageId:thirdStage,expectedVersion:2,
   }),ServiceFunnelConflictError);
   await assert.rejects(service.close(ctx(0,"agent-a"),{
    attendanceId:attendance.id,expectedVersion:2,result:"Finalizado",
   }),ServiceFunnelConflictError);
   attendance=await service.advance(ctx(0,"agent-a"),{
    attendanceId:attendance.id,nextStageId:secondStage,expectedVersion:2,
   });
   assert.equal(attendance.version,3);
   await assert.rejects(service.advance(ctx(0,"agent-a"),{
    attendanceId:attendance.id,nextStageId:thirdStage,expectedVersion:2,
   }),ServiceFunnelConflictError);
   attendance=await service.advance(ctx(0,"agent-a"),{
    attendanceId:attendance.id,nextStageId:thirdStage,expectedVersion:3,
   });
   attendance=await service.close(ctx(0,"agent-a"),{
    attendanceId:attendance.id,expectedVersion:4,result:"Atendido com sucesso",
   });
   assert.equal(attendance.state,"closed");
   assert.equal(attendance.version,5);
   assert.equal((await service.board(ctx(0,"owner-a"),funnel.id)).length,0);
   const history=await service.history(ctx(0,"owner-a"),attendance.id);
   assert.deepEqual(history.map(x=>x.action),[
    "created","assigned","stage_changed","stage_changed","closed",
   ]);
   assert.deepEqual(history.map(x=>x.version),[1,2,3,4,5]);
  });

  await t.test("SQL audit append-only; no direct mutation without trusted tx actor",async()=>{
   const pool=pools.get(tenants[0].tenantId);
   await assert.rejects(pool.query(`UPDATE service_attendance_events SET
    action='created' WHERE attendance_id=$1`,[attendance.id]),e=>e.code==="23514");
   await assert.rejects(pool.query("DELETE FROM service_attendance_events"),e=>e.code==="23514");
   await assert.rejects(pool.query("TRUNCATE service_attendance_events"),e=>e.code==="23514");
   await assert.rejects(pool.query(`UPDATE service_attendances
    SET version=version+1 WHERE id=$1`,[attendance.id]),e=>e.code==="23514");
  });

  await t.test("tenant B and foreign Workspace/Organization cannot see or alter A",async()=>{
   const other=await service.publishSimpleFunnel(ctx(1,"owner-b"),{
    code:"atendimento",name:"Outro cliente",stages:[
     {code:"inicio",label:"Entrada"},{code:"fim",label:"Conclusão"}],
   });
   assert.equal((await service.board(ctx(1,"owner-b"),funnel.id)).length,0);
   assert.deepEqual(await service.history(ctx(1,"owner-b"),attendance.id),[]);
   await assert.rejects(service.open(ctx(1,"owner-b"),{
    funnelId:funnel.id,conversationId:tenants[0].conversationId,
    idempotencyKey:"foreign-tenant-case-20261111",
   }),ServiceFunnelConflictError);
   await assert.rejects(service.open({...ctx(0,"agent-a"),
    organizationId:tenants[1].orgId}, {funnelId:funnel.id,
    idempotencyKey:"wrong-organization-case"}),AccessDeniedError);
   await assert.rejects(service.open({...ctx(0,"agent-a"),
    workspaceId:tenants[1].workspaceId},{funnelId:funnel.id,
    idempotencyKey:"wrong-workspace-case"}),AccessDeniedError);
   assert.equal(other.state,"published");
  });

  await t.test("viewer/revoked/FGA-down are rejected before business writes",async()=>{
   await assert.rejects(service.open(ctx(0,"viewer-a"),{funnelId:funnel.id,
    idempotencyKey:"viewer-denied-case"}),AccessDeniedError);
   await assert.rejects(service.open(ctx(0,"revoked-a"),{funnelId:funnel.id,
    idempotencyKey:"revoked-denied-case"}),AccessDeniedError);
   authAllowed=false;
   await assert.rejects(service.board(ctx(0,"agent-a"),funnel.id),AccessDeniedError);
   authAllowed=true;
   moduleEnabled=false;
   await assert.rejects(service.board(ctx(0,"agent-a"),funnel.id),AccessDeniedError);
   await assert.rejects(service.open(ctx(0,"agent-a"),{
    funnelId:funnel.id,idempotencyKey:"module-suspended-case-20261111",
   }),AccessDeniedError);
   moduleEnabled=true;
   const count=Number((await pools.get(tenants[0].tenantId).query(
    "SELECT count(*)::int AS n FROM service_attendances")).rows[0].n);
   assert.equal(count,1);
  });

  await t.test("input errors are rejected before any query or mutation",async()=>{
   await assert.rejects(service.publishSimpleFunnel(ctx(0,"owner-a"),{
    code:"invalido",name:"Invalido",stages:[
     {code:"dup",label:"Primeira"},{code:"dup",label:"Segunda"}],
   }),ServiceFunnelInputError);
   await assert.rejects(service.advance(ctx(0,"agent-a"),{
    attendanceId:attendance.id,nextStageId:"../../../",expectedVersion:6,
   }),ServiceFunnelInputError);
  });
 }finally{
  for(const [,pool] of pools)await pool.end().catch(()=>{});
  for(const name of created)await admin.query('DROP DATABASE "'+name+'"');
  await admin.end();
 }
});
