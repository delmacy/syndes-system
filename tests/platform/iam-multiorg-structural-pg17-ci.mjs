/**
 * Disposable PostgreSQL 17 cardinality probe: two orgs, two workspaces per
 * org and two Service funnels per workspace. Always rollback SQL002 removal.
 * This test is NOT a multi-org production cutover or a Keycloak/FGA grant.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {resolveSelectedOperationalScope,AccessDeniedError}
 from "../../packages/core-kernel/dist/index.js";

const TENANT="11111111-1111-4111-8111-111111111111";
const ORG_A="22222222-2222-4222-8222-222222222222";
const WS_A1="44444444-4444-4444-8444-444444444444";
const generated=()=>randomUUID();

export async function runIamMultiOrgTopologyPg17Lab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 const conn=await f.tenantDb.connect();
 let started=false;
 try{
  await conn.query("BEGIN");started=true;
  // Both indexes must be removed TOGETHER, only inside this rollbackable
  // transaction and the disposable tenant DB. Real SQL002 stays installed.
  await conn.query("DROP INDEX platform_legacy_single_organization");
  await conn.query("DROP INDEX platform_legacy_single_workspace");
  const orgB=generated(),wsA2=generated(),wsB1=generated(),wsB2=generated();
  const actor=f.actorId;
  await conn.query("INSERT INTO platform_organizations"+
   "(tenant_id,id,display_name) VALUES($1,$2,'Disposable org B')",[TENANT,orgB]);
  for(const [org,ws,name] of [
   [ORG_A,wsA2,"A2"],[orgB,wsB1,"B1"],[orgB,wsB2,"B2"],
  ])await conn.query("INSERT INTO platform_workspaces"+
   "(tenant_id,id,organization_id,name,slug)"+
   " VALUES($1,$2,$3,$4,$5)",[TENANT,ws,org,"Lab "+name,"lab-"+name.toLowerCase()]);
  await conn.query("INSERT INTO platform_org_memberships"+
   "(tenant_id,organization_id,principal_id,role)"+
   " VALUES($1,$2,$3,'editor')",[TENANT,orgB,actor]);
  for(const [org,ws] of [[ORG_A,wsA2],[orgB,wsB1]]){
   await conn.query("INSERT INTO platform_workspace_memberships"+
    "(tenant_id,organization_id,workspace_id,principal_id,role)"+
    " VALUES($1,$2,$3,$4,'editor')",[TENANT,org,ws,actor]);
  }
  const database={tenantId:TENANT,query:(sql,args)=>conn.query(sql,args)};
  const principal={kind:"user",id:actor};
  for(const [org,ws] of [[ORG_A,WS_A1],[ORG_A,wsA2],[orgB,wsB1]]){
   const ok=await resolveSelectedOperationalScope(
    database,TENANT,principal,{organizationId:org,workspaceId:ws},true);
   assert.equal(ok.organizationId,org);
   assert.equal(ok.workspaceId,ws);
   assert.equal(ok.scopeWriteAllowed,true);
  }
  await assert.rejects(
   resolveSelectedOperationalScope(database,TENANT,principal,
    {organizationId:orgB,workspaceId:wsB2},true),AccessDeniedError);
  await assert.rejects(
   resolveSelectedOperationalScope(database,TENANT,principal,
    {organizationId:orgB,workspaceId:wsA2},true),AccessDeniedError);
  await assert.rejects(
   resolveSelectedOperationalScope(database,TENANT,principal,
    {organizationId:orgB,workspaceId:wsB1},false),AccessDeniedError);
  // Install Service v0.3.0 original SQL inside the transaction only.
  const exists=await conn.query("SELECT to_regclass('service.service_funnels') AS rel");
  if(exists.rows[0].rel==null){
   await conn.query("CREATE SCHEMA IF NOT EXISTS service");
   await conn.query(await readFile(new URL(
    "../../modules/service-management/sql/001_service_funnels.sql",import.meta.url),"utf8"));
  }
  const contexts=[[ORG_A,WS_A1],[ORG_A,wsA2],[orgB,wsB1],[orgB,wsB2]];
  const created=[];
  for(const [org,ws] of contexts){
   for(const n of [1,2]){
    const id=generated();
    await conn.query("INSERT INTO service.service_funnels"+
     "(tenant_id,organization_id,workspace_id,id,code,name,created_by)"+
     " VALUES($1,$2,$3,$4,$5,$6,$7)",
     [TENANT,org,ws,id,"funnel_"+n,"Lab funnel "+n,actor]);
    created.push({org,ws,id});
   }
  }
  const counts=await conn.query("SELECT organization_id::text AS org,"+
   "workspace_id::text AS ws,count(*)::int AS n"+
   " FROM service.service_funnels WHERE tenant_id=$1"+
   " GROUP BY organization_id,workspace_id",[TENANT]);
  assert.equal(counts.rows.length,4);
  assert.ok(counts.rows.every(row=>row.n===2));
  // A funnel cannot claim another organization's workspace.
  await conn.query("SAVEPOINT cross_scope");
  await assert.rejects(conn.query(
   "INSERT INTO service.service_funnels"+
   "(tenant_id,organization_id,workspace_id,id,code,name,created_by)"+
   " VALUES($1,$2,$3,$4,'invalid','Cross organization', $5)",
   [TENANT,orgB,WS_A1,generated(),actor]),error=>error.code==="23503");
  await conn.query("ROLLBACK TO SAVEPOINT cross_scope");
  await conn.query("RELEASE SAVEPOINT cross_scope");
  const all=await conn.query("SELECT count(*)::int AS n"+
   " FROM service.service_funnels WHERE tenant_id=$1",[TENANT]);
  assert.equal(all.rows[0].n,8);
  console.log("IAM_TOPOLOGY_PG17_TWO_ORGS_FOUR_WORKSPACES_EIGHT_FUNNELS_PASS");
 }finally{
  if(started)await conn.query("ROLLBACK").catch(()=>{});
  conn.release();
 }
 // Both SQL002 unique indexes remain after the rollback and neither new
 // organization nor its workspaces survived.
 const barriers=await f.tenantDb.query("SELECT indexname FROM pg_indexes"+
  " WHERE schemaname=current_schema() AND indexname IN"+
  " ('platform_legacy_single_organization','platform_legacy_single_workspace')");
 assert.equal(barriers.rows.length,2);
 console.log("IAM_TOPOLOGY_SQL002_ROLLBACK_BARRIER_PRESERVED_PASS");
}
