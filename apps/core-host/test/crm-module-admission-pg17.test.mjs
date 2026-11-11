import "reflect-metadata";
import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {NestFactory} from "@nestjs/core";
import {Global,Module} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {CrmController,CrmHost} from "@syndes/core-crm/plugin";
import {PgModuleCatalog} from "../dist/module-catalog.js";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";
import {PgEffectiveModuleAccess} from "../dist/module-effective-access.js";

const raw=process.env.SYNDES_AK10_PG_URL;
const safe=(()=>{
 if(!raw||process.env.SYNDES_AK10_DISPOSABLE_PG!=="AK10_DISPOSABLE_ONLY")return false;
 try{
  const url=new URL(raw);
  return url.protocol==="postgresql:"&&["127.0.0.1","localhost"].includes(url.hostname)
   &&url.username==="postgres"&&url.pathname==="/postgres"
   &&url.password.startsWith("ci-only-disposable-");
 }catch{return false}
})();
const {Client}=pg;
const definitions=[
 {id:"platform",version:"0.1.0"},
 {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
];
const scopedOrg=randomUUID(),scopedWorkspace=randomUUID();

test("FC-02.02 HTTP CRM admission: true PostgreSQL17 Control state + trusted Nest runtime",
 {skip:!safe},async t=>{
 const admin=new Client({connectionString:raw});
 let db,created=false,closed=false,app;
 const name="syndes_fc0202_"+randomBytes(5).toString("hex");
 const tenantA=randomUUID(),tenantB=randomUUID(),tenantC=randomUUID();
 const dbLeases=[];
 try{
  await admin.connect();
  const v=await admin.query("SELECT current_setting('server_version_num')::int AS n");
  assert.ok(v.rows[0].n>=170000&&v.rows[0].n<180000,"test requires isolated PG17");
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  const u=new URL(raw);u.pathname="/"+name;
  db=new Client({connectionString:u.toString()});await db.connect();
  await db.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
  const read=async filename=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+filename,import.meta.url)),"utf8");
  for(const schema of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema"])
   await db.query(await read(schema));
  for(const tenant of [tenantA,tenantB]){
   const suffix=tenant.replaceAll("-","");
   await db.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'active')",
    [tenant,"syndes_tenant_"+suffix,"syndes_t_"+suffix]);
  }
  await db.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm','crm')");
  await db.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES('crm','0.1.0',true,now(),'fc0202-disposable')");
  for(const tenant of [tenantA,tenantB])
   await db.query("INSERT INTO public.tenant_module_entitlements(tenant_id,module_id,state) VALUES($1,'crm','granted')",[tenant]);
  const receipt="a".repeat(64);
  for(const [tenant,state] of [[tenantA,"enabled"],[tenantB,"installed"]]){
   await db.query("INSERT INTO public.tenant_module_installs(tenant_id,module_id,target_version,state,installed_version,verification_digest,verified_at) VALUES($1,'crm','0.1.0',$2,'0.1.0',$3,now())",
    [tenant,state,receipt]);
  }
  const gate=new PgEffectiveModuleAccess(new PgModuleLifecycle(db,new PgModuleCatalog(db,definitions)));
  const kernel=new CoreKernel({
   modules:definitions,
   moduleAccess:gate,
   tenancy:{canAccessTenant:async ({tenantId,actor})=>
    [tenantA,tenantB].includes(tenantId)&&actor.id==="signed-user"},
   authorization:{canAccess:async ({actor,resource})=>
    actor.id==="signed-user"&&resource.startsWith("crm:")},
  });
  await kernel.start();
  const pools={resolve:async tenantId=>{
   dbLeases.push(tenantId);
   return {tenantId,query:async (sql,values)=>{
    if(sql.includes("FROM platform_organizations o")){
     return {rows:[{organization_id:scopedOrg,workspace_id:scopedWorkspace}]};
    }
    // Tenant data DB is a fake in this test; only the Control DB runs on PG17.
    return {rows:[]};
   }};
  }};
  const runtime={
   kernel,crmModuleGateMode:"enforce",
   verifier:{verify:async bearer=>{
    if(bearer!=="Bearer signed-user")throw Error("Invalid JWT");
    return {id:"signed-user",kind:"user"};
   }}
  };
  class Runtime{}
  Global()(Runtime);
  Module({providers:[
   {provide:"SYNDES_CORE_API",useValue:runtime},
   {provide:"SYNDES_TENANT_DB",useValue:pools},
  ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
  class App{}
  Module({imports:[Runtime],controllers:[CrmController],providers:[CrmHost]})(App);
  app=await NestFactory.create(App,{logger:false});
  await app.listen(0,"127.0.0.1");
  const base=await app.getUrl();
  const api=(tenant,path="/people")=>base+"/v1/tenants/"+tenant+"/crm"+path;
  const headers={authorization:"Bearer signed-user"};
  const request=(tenant,path="/people")=>fetch(api(tenant,path),{headers});
  const forbidAll=async (tenant)=>{
   const before=dbLeases.length;
   for(const path of ["/people","/capabilities","/exports/csv"]){
    assert.equal((await request(tenant,path)).status,403,path);
   }
   const write=await fetch(api(tenant,"/people"),{
    method:"POST",headers:{...headers,"content-type":"application/json"},
    body:JSON.stringify({name:"Forbidden write"})
   });
   assert.equal(write.status,403);
   assert.equal(dbLeases.length,before,"no module-denied route may resolve a tenant DB");
  };
  await t.test("no token => 401, out-of-tenant => 403 without tenant DB",async()=>{
   assert.equal((await fetch(api(tenantA))).status,401);
   await forbidAll(tenantC);
   assert.deepEqual(dbLeases,[]);
  });
  await t.test("tenant A ENABLED works; tenant B INSTALLED-only is denied",async()=>{
   assert.equal((await request(tenantA)).status,200);
   assert.equal((await request(tenantA,"/capabilities")).status,200);
   assert.ok(dbLeases.length>=2,"allowed tenant proceeds to verified scoped DB");
   await forbidAll(tenantB);
  });
  await t.test("suspend, expire and revoke A without restarting Nest; each denies",async()=>{
   await db.query("UPDATE public.tenant_module_entitlements SET state='suspended' WHERE tenant_id=$1",[tenantA]);
   await forbidAll(tenantA);
   await db.query("UPDATE public.tenant_module_entitlements SET state='granted',valid_until=now()-interval '1 second' WHERE tenant_id=$1",[tenantA]);
   await forbidAll(tenantA);
   await db.query("UPDATE public.tenant_module_entitlements SET state='granted',valid_until=NULL WHERE tenant_id=$1",[tenantA]);
   assert.equal((await request(tenantA)).status,200);
   await db.query("UPDATE public.tenant_module_installs SET state='suspended',installed_version=NULL,verification_digest=NULL,verified_at=NULL WHERE tenant_id=$1",[tenantA]);
   await forbidAll(tenantA);
  });
  await t.test("B transitions from INSTALLED to ENABLED, then suspension denies immediately",async()=>{
   await db.query("UPDATE public.tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='crm'",[tenantB]);
   assert.equal((await request(tenantB)).status,200,"verified B is now active");
   await db.query("UPDATE public.tenant_module_entitlements SET state='suspended' WHERE tenant_id=$1 AND module_id='crm'",[tenantB]);
   await forbidAll(tenantB);
  });
  await t.test("deapproving the compiled CRM release denies even an installed ENABLED module",async()=>{
   await db.query("UPDATE public.tenant_module_installs SET state='enabled',installed_version='0.1.0',verification_digest=$2,verified_at=now() WHERE tenant_id=$1 AND module_id='crm'",[tenantA,receipt]);
   assert.equal((await request(tenantA)).status,200);
   await db.query("UPDATE public.module_catalog_versions SET approved=false,approved_at=NULL,approved_by=NULL WHERE module_id='crm' AND version='0.1.0'");
   await forbidAll(tenantA);
   await db.query("UPDATE public.module_catalog_versions SET approved=true,approved_at=now(),approved_by='fc0202-disposable' WHERE module_id='crm' AND version='0.1.0'");
   assert.equal((await request(tenantA)).status,200);
  });
  await t.test("Control DB query outage fails closed without a tenant DB lease",async()=>{
   await db.end();closed=true;
   await forbidAll(tenantA);
  });
 }finally{
  if(app)await app.close();
  if(db&&!closed)await db.end();
  if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
  await admin.end().catch(()=>{});
 }
});
