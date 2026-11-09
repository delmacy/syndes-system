import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import pg from "pg";
import {OrganizationService} from "../dist/service.js";

const url=process.env.SYNDES_ORG_TEST_PG_URL;
const tenantA="11111111-1111-4111-8111-111111111111";
const tenantB="22222222-2222-4222-8222-222222222222";
const ctx=(tenantId,user)=>({tenantId,actor:{id:user,kind:"user"}});
test("Postgres migrations twice, defaults, org/workspace isolation, unit links and audit",{
  skip:!url&&"requires a disposable PostgreSQL database URL"
},async()=>{
  const client=new pg.Client({connectionString:url});
  await client.connect();
  const schema="org_test_"+randomUUID().replaceAll("-","").slice(0,15);
  const sql=await readFile(new URL("../sql/001_account_hierarchy.sql",import.meta.url),"utf8");
  const gate=await readFile(new URL("../sql/002_legacy_single_context_gate.sql",import.meta.url),"utf8");
  try{
    await client.query("BEGIN");
    await client.query("CREATE SCHEMA "+schema);
    await client.query("SET LOCAL search_path TO "+schema);
    await client.query(sql);
    await client.query(sql);
    // Installing this guard on an already multi-org tenant must fail closed
    // without deleting data (full rollback to the savepoint).
    const previousOrg=randomUUID(),secondPreviousOrg=randomUUID();
    await client.query("SAVEPOINT before_gate");
    await client.query("INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES ($1,$2,'Company A'),($1,$3,'Company B')",
      [tenantA,previousOrg,secondPreviousOrg]);
    await assert.rejects(client.query(gate),error=>error.code==="23505");
    await client.query("ROLLBACK TO SAVEPOINT before_gate");
    await client.query(gate);
    await client.query(gate);
    const dbFor=t=>({tenantId:t,async query(text,params){const r=await client.query(text,params);return {rows:r.rows,rowCount:r.rowCount};}});
    const requests=[];
    const kernel={async execute(q,fn){requests.push(q);return fn();}};
    const svc=new OrganizationService(kernel,{resolve:async t=>dbFor(t)});
    const alice=ctx(tenantA,"alice"),bob=ctx(tenantA,"bob"),mallory=ctx(tenantB,"mallory");
    assert.deepEqual(await svc.bootstrap(alice),{initialized:true});
    assert.deepEqual(await svc.bootstrap(alice),{initialized:false});
    assert.deepEqual(await svc.bootstrap(bob),{initialized:false});
    const [org]=await svc.listOrganizations(alice);
    assert.equal(org.is_default,true);
    assert.equal((await svc.listOrganizations(bob)).length,0,"bootstrap retry cannot confer role");
    assert.equal((await svc.listOrganizations(mallory)).length,0,"other tenant must not see org");
    const [ws]=await svc.listWorkspaces(alice,org.id);
    assert.equal(ws.is_default,true);
    assert.equal((await svc.listWorkspaces(bob,org.id)).length,0);
    assert.equal((await svc.listWorkspaces(mallory,org.id)).length,0);
    await client.query("UPDATE platform_org_memberships SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2 AND principal_id='alice'",[tenantA,org.id]);
    assert.equal((await svc.listWorkspaces(alice,org.id)).length,0,"revoked org membership must block workspace even if workspace grant remains");
    await client.query("UPDATE platform_org_memberships SET state='active' WHERE tenant_id=$1 AND organization_id=$2 AND principal_id='alice'",[tenantA,org.id]);
    const unit=await svc.createUnit(alice,org.id,{name:"Matriz",kind:"headquarters"});
    assert.equal(unit.name,"Matriz");
    assert.equal(await svc.createUnit(bob,org.id,{name:"Foreign",kind:"branch"}),null);
    assert.equal((await svc.listUnits(alice,org.id)).length,1);
    assert.equal((await svc.listUnits(bob,org.id)).length,0);
    await client.query(
      "INSERT INTO platform_workspace_units(tenant_id,organization_id,workspace_id,unit_id) VALUES($1,$2,$3,$4)",
      [tenantA,org.id,ws.id,unit.id]);
    async function expectDatabaseDenial(sql,params,code){
      await client.query("SAVEPOINT isolation_check");
      await assert.rejects(client.query(sql,params),error=>error.code===code);
      await client.query("ROLLBACK TO SAVEPOINT isolation_check");
    }
    const secondOrg=randomUUID(),secondWs=randomUUID();
    await expectDatabaseDenial(
      "INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,'Second company')",
      [tenantA,secondOrg],"23505");
    await expectDatabaseDenial(
      "INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug) VALUES($1,$2,$3,'Other','other')",
      [tenantA,secondWs,org.id],"23505");
    // A second tenant still gets its own default organization and unit.
    assert.deepEqual(await svc.bootstrap(mallory),{initialized:true});
    const [orgB]=await svc.listOrganizations(mallory);
    const unitB=await svc.createUnit(mallory,orgB.id,{name:"Remote office",kind:"branch"});
    await expectDatabaseDenial(
      "INSERT INTO platform_workspace_units(tenant_id,organization_id,workspace_id,unit_id) VALUES($1,$2,$3,$4)",
      [tenantA,org.id,ws.id,unitB.id],"23503");
    assert.equal((await svc.listWorkspaces(alice,orgB.id)).length,0);
    assert.equal((await svc.listUnits(alice,orgB.id)).length,0);
    const audit=await client.query("SELECT event,actor_id FROM platform_org_audit ORDER BY id");
    assert.deepEqual(audit.rows.map(x=>x.event),["default_context_initialized","unit_created"]);
    assert.equal(audit.rows[0].actor_id,"alice");
    assert.equal(requests.every(q=>q.tenantId===tenantA||q.tenantId===tenantB),true);
  }finally{
    await client.query("ROLLBACK");
    await client.end();
  }
});
