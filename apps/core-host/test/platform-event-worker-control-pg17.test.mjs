import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import pg from "pg";
import {PgEffectiveModuleAccess} from "../dist/module-effective-access.js";
import {PgModuleCatalog} from "../dist/module-catalog.js";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";
import {TenantEventWorkerAdmission} from "../dist/platform-event-worker-admission.js";

const url=process.env.SYNDES_EVENTS_PG_URL;
const safe=(()=>{
 if(!url||process.env.SYNDES_EVENTS_DISPOSABLE!=="EVENTS_TEST_ONLY")return false;
 try{
  const u=new URL(url);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)
   &&u.pathname==="/postgres"&&u.username==="postgres"
   &&u.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const file=path=>readFile(new URL(path,import.meta.url),"utf8");
const dsn=name=>{const u=new URL(url);u.pathname="/"+name;return u.toString()};

test("PG17 disposable: Control module ledger is real admission prerequisite (not a mock)",
 {skip:!safe},async t=>{
 const admin=new pg.Client({connectionString:url});
 await admin.connect();
 const version=(await admin.query("SELECT current_setting('server_version_num')::int AS n")).rows[0].n;
 assert.ok(version>=170000&&version<180000);
 const controlDb="syndes_eventworker_control_"+randomBytes(6).toString("hex");
 const A=randomUUID(),B=randomUUID(),org=randomUUID(),workspace=randomUUID();
 let pool,created=false;
 try{
  await admin.query('CREATE DATABASE "'+controlDb+'"');
  created=true;
  pool=new pg.Pool({connectionString:dsn(controlDb),max:4});
  await pool.query(`DO $role$ BEGIN
   IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_core')
   THEN CREATE ROLE syndes_core NOLOGIN; END IF;
  END $role$`);
  for(const migration of [
    "../../../infra/postgres/bootstrap/control.schema",
    "../../../infra/postgres/bootstrap/control-module-catalog.schema",
    "../../../infra/postgres/bootstrap/control-module-lifecycle.schema",
  ])await pool.query(await file(migration));
  for(const id of [A,B]){
   const suffix=id.replaceAll("-","");
   await pool.query(`
    INSERT INTO tenant_registry(tenant_id,database_name,role_name,state)
    VALUES($1,$2,$3,'active')
   `,[id,"syndes_tenant_"+suffix,"syndes_t_"+suffix]);
  }
  await pool.query("INSERT INTO module_catalog(module_id,schema_name) VALUES('crm','crm'),('inbox','inbox')");
  await pool.query(`
    INSERT INTO module_catalog_versions(module_id,version,approved,approved_at,approved_by)
    VALUES('crm','0.1.0',true,clock_timestamp(),'fixture'),
          ('inbox','0.1.0',true,clock_timestamp(),'fixture');
    INSERT INTO module_catalog_dependencies(module_id,version,dependency_id)
    VALUES('inbox','0.1.0','crm');
  `);
  for(const mod of ["crm","inbox"]){
   await pool.query(`
    INSERT INTO tenant_module_entitlements(tenant_id,module_id,state)
    VALUES($1,$2,'granted')
   `,[A,mod]);
   await pool.query(`
    INSERT INTO tenant_module_installs(
      tenant_id,module_id,target_version,state,installed_version,verification_digest,verified_at)
    VALUES($1,$2,'0.1.0','enabled','0.1.0',$3,clock_timestamp())
   `,[A,mod,"f".repeat(64)]);
  }
  const trusted=[
   {id:"crm",version:"0.1.0",schema:"crm",dependencies:[]},
   {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["crm"]},
  ];
  const gate=new PgEffectiveModuleAccess(
   new PgModuleLifecycle(pool,new PgModuleCatalog(pool,trusted)));
  const actor={kind:"service",id:"syndes-events-service"};
  const request={
   actor,tenantId:A,organizationId:org,workspaceId:workspace,
   moduleId:"inbox",consumerId:"inbox.observed",
   eventType:"whatsapp.message.received.v2",
  };
  let grantCalls=0,scopeCalls=0,grantEnabled=true;
  const admission=new TenantEventWorkerAdmission(gate,{
   active:async()=>{scopeCalls++;return true},
  },{
   canProcess:async()=>{grantCalls++;return grantEnabled},
  },actor.id);
  await t.test("verified enabled CRM dependency and Inbox grant passes",async()=>{
   assert.equal(await gate.canExecuteModule({actor,tenantId:A,moduleId:"crm"}),true);
   assert.equal(await gate.canExecuteModule({actor,tenantId:A,moduleId:"inbox"}),true);
   assert.equal(await admission.authorize(request),"enabled");
   assert.equal(scopeCalls,1);
   assert.equal(grantCalls,1);
  });
  await t.test("unentitled tenant cannot borrow another tenant's enablement",async()=>{
   scopeCalls=grantCalls=0;
   assert.equal(await admission.authorize({...request,tenantId:B}),"suspended");
   assert.equal(scopeCalls,0);assert.equal(grantCalls,0);
  });
  await t.test("disabled CRM dependency suspends Inbox before tenant/FGA",async()=>{
   await pool.query("UPDATE tenant_module_installs SET state='installed' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await gate.canExecuteModule({actor,tenantId:A,moduleId:"crm"}),false);
   assert.equal(await admission.authorize(request),"suspended");
   await pool.query("UPDATE tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await admission.authorize(request),"enabled");
  });
  await t.test("expired entitlement and deapproved release block worker",async()=>{
   await pool.query(`
    UPDATE tenant_module_entitlements SET valid_until=clock_timestamp()-interval '1 second'
    WHERE tenant_id=$1 AND module_id='inbox'
   `,[A]);
   assert.equal(await admission.authorize(request),"suspended");
   await pool.query("UPDATE tenant_module_entitlements SET valid_until=NULL WHERE tenant_id=$1 AND module_id='inbox'",[A]);
   await pool.query(`
    UPDATE module_catalog_versions SET approved=false,approved_at=NULL,approved_by=NULL
    WHERE module_id='inbox'
   `);
   assert.equal(await admission.authorize(request),"suspended");
   await pool.query(`
    UPDATE module_catalog_versions SET approved=true,approved_at=clock_timestamp(),approved_by='fixture'
    WHERE module_id='inbox'
   `);
   assert.equal(await admission.authorize(request),"enabled");
  });
  await t.test("a real Control pool outage is recoverable, never auto-authorized",async()=>{
   await pool.end();
   pool=null;
   assert.equal(await admission.authorize(request),"suspended");
  });
 }finally{
  if(pool)await pool.end().catch(()=>{});
  if(created)await admin.query('DROP DATABASE "'+controlDb+'" WITH (FORCE)');
  await admin.end();
 }
});
