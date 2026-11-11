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
import {InboxController,InboxHost} from "@syndes/core-inbox/plugin";
import {InboxChangeBus} from "@syndes/core-inbox";
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
 }catch{return false;}
})();
const {Client}=pg;
const definitions=[
 {id:"platform",version:"0.1.0"},
 {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
 {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["platform","crm"]},
];
const organizationId=randomUUID(),workspaceId=randomUUID();

test("FC-02.02 Inbox HTTP/SSE: real disposable PG17 Control, Nest routes, revoke live stream",
 {skip:!safe},async t=>{
 const admin=new Client({connectionString:raw});
 const dbname="syndes_inbox_gate_"+randomBytes(5).toString("hex");
 let db,created=false,closed=false,app;
 const A=randomUUID(),B=randomUUID(),C=randomUUID(),receipt="a".repeat(64);
 const leases=[],requests=[];
 const bus=new InboxChangeBus();
 // Fast interval only in disposable test; production uses 5s with 3s timeout.
 const defaultConnect=bus.connect.bind(bus);
 bus.connect=(scope,res,check)=>defaultConnect(scope,res,check,35);
 let moduleChecks=0;
 let actorEnabled=true;
 try{
  await admin.connect();
  const v=await admin.query("SELECT current_setting('server_version_num')::int AS n");
  assert.ok(v.rows[0].n>=170000&&v.rows[0].n<180000);
  await admin.query('CREATE DATABASE "'+dbname+'"');created=true;
  const uri=new URL(raw);uri.pathname="/"+dbname;
  db=new Client({connectionString:uri.toString()});await db.connect();
  await db.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
  const sql=async name=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+name,import.meta.url)),"utf8");
  for(const name of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema"])
   await db.query(await sql(name));
  for(const tenant of [A,B]){
   const suffix=tenant.replaceAll("-","");
   await db.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'active')",
    [tenant,"syndes_tenant_"+suffix,"syndes_t_"+suffix]);
  }
  await db.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm','crm'),('inbox','inbox')");
  await db.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES('crm','0.1.0',true,now(),'fixture'),('inbox','0.1.0',true,now(),'fixture')");
  await db.query("INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES('inbox','0.1.0','crm')");
  for(const tenant of [A,B])for(const module of ["crm","inbox"]){
   await db.query("INSERT INTO public.tenant_module_entitlements(tenant_id,module_id,state) VALUES($1,$2,'granted')",[tenant,module]);
   await db.query("INSERT INTO public.tenant_module_installs(tenant_id,module_id,target_version,state,installed_version,verification_digest,verified_at) VALUES($1,$2,'0.1.0',$3,'0.1.0',$4,now())",
    [tenant,module,tenant===A?"enabled":module==="crm"?"enabled":"installed",receipt]);
  }
  const gate=new PgEffectiveModuleAccess(new PgModuleLifecycle(db,new PgModuleCatalog(db,definitions)));
  const kernel=new CoreKernel({
   modules:definitions,
   moduleAccess:{canExecuteModule:async request=>{
    moduleChecks++;return gate.canExecuteModule(request);
   }},
   tenancy:{canAccessTenant:async({tenantId,actor})=>
    [A,B].includes(tenantId)&&actor.id==="inbox-agent"},
   authorization:{canAccess:async({resource,actor})=>
    actor.id==="inbox-agent"&&resource.startsWith("inbox:")},
  });
  await kernel.start();
  const provider={resolve:async tenantId=>{
   leases.push(tenantId);
   return {tenantId,query:async (sql,values)=>{
    requests.push({tenantId,sql,values});
    if(sql.includes("FROM platform_organizations o"))
     return {rows:[{organization_id:organizationId,workspace_id:workspaceId}]};
    return {rows:[]};
   }};
  }};
  const runtime={kernel,inboxModuleGateMode:"enforce",
   verifier:{verify:async bearer=>{
    if(bearer!=="Bearer inbox-agent"||!actorEnabled)throw Error("JWT expired/invalid");
    return {id:"inbox-agent",kind:"user"};
   }}};
  class Runtime{}
  Global()(Runtime);
  Module({providers:[
   {provide:"SYNDES_CORE_API",useValue:runtime},
   {provide:"SYNDES_TENANT_DB",useValue:provider},
  ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
  class App{}
  Module({imports:[Runtime],controllers:[InboxController],providers:[
   InboxHost,{provide:"SYNDES_INBOX_EVENTS",useValue:bus}
  ]})(App);
  app=await NestFactory.create(App,{logger:false});
  await app.listen(0,"127.0.0.1");
  const url=await app.getUrl();
  const api=(tenant,part="/conversations")=>url+"/v1/tenants/"+tenant+"/inbox"+part;
  const headers={authorization:"Bearer inbox-agent"};
  const get=(tenant,part)=>fetch(api(tenant,part),{headers});
  const noLease=async tenant=>{
   const before=leases.length;
   for(const part of ["/conversations","/metrics","/events"]){
    const response=await get(tenant,part);
    assert.equal(response.status,403,part);
    await response.body?.cancel();
   }
   const mutation=await fetch(api(tenant,"/conversations"),{
    method:"POST",headers:{...headers,"content-type":"application/json"},
    body:JSON.stringify({subject:"Not authorized"})
   });
   assert.equal(mutation.status,403);
   assert.equal(leases.length,before,"denied HTTP/SSE must not resolve tenant DB");
  };
  await t.test("JWT required, unauthorized tenant denied before tenant DB",async()=>{
   assert.equal((await fetch(api(A))).status,401);
   await noLease(C);
   assert.equal(leases.length,0);
  });
  await t.test("A ENABLED serves Inbox; B INSTALLED-only denies all routes",async()=>{
   const a=await get(A);
   assert.equal(a.status,200);
   assert.deepEqual(await a.json(),[]);
   await noLease(B);
  });
  await t.test("B transitions ENABLED and back to suspended without restart",async()=>{
   await db.query("UPDATE public.tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='inbox'",[B]);
   assert.equal((await get(B)).status,200);
   await db.query("UPDATE public.tenant_module_entitlements SET state='suspended' WHERE tenant_id=$1 AND module_id='inbox'",[B]);
   await noLease(B);
  });
  await t.test("dependency CRM, entitlement expiry and release deapproval close gate",async()=>{
   await db.query("UPDATE public.tenant_module_installs SET state='installed' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   await noLease(A);
   await db.query("UPDATE public.tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal((await get(A)).status,200);
   await db.query("UPDATE public.tenant_module_entitlements SET valid_until=clock_timestamp()-interval '1 second' WHERE tenant_id=$1 AND module_id='inbox'",[A]);
   await noLease(A);
   await db.query("UPDATE public.tenant_module_entitlements SET valid_until=NULL WHERE tenant_id=$1 AND module_id='inbox'",[A]);
   await db.query("UPDATE public.module_catalog_versions SET approved=false,approved_at=NULL,approved_by=NULL WHERE module_id='inbox'");
   await noLease(A);
   await db.query("UPDATE public.module_catalog_versions SET approved=true,approved_at=now(),approved_by='fixture' WHERE module_id='inbox'");
   assert.equal((await get(A)).status,200);
  });
  await t.test("SSE actively terminates after ENABLED revoked, without waiting for 60s reconnect",async()=>{
   const controller=new AbortController();
   try{
    const sse=await fetch(api(A,"/events"),{headers,signal:controller.signal});
    assert.equal(sse.status,200);
    const reader=sse.body.getReader();
    const first=await reader.read();
    assert.equal(first.done,false);
    assert.match(new TextDecoder().decode(first.value),/inbox-connected/);
    const scope={tenantId:A,organizationId,workspaceId};
    assert.equal(bus.count(scope),1);
    const admitted=moduleChecks;
    await new Promise(resolve=>setTimeout(resolve,155));
    assert.ok(moduleChecks>admitted,"stream is revalidated before suspension");
    assert.equal(bus.count(scope),1,"SSE stays active while module ENABLED");
    const start=Date.now();
    await db.query("UPDATE public.tenant_module_entitlements SET state='suspended' WHERE tenant_id=$1 AND module_id='inbox'",[A]);
    const ended=await Promise.race([
     (async()=>{
      while(true){
       const event=await reader.read();
       if(event.done)return true;
      }
     })(),
     new Promise(resolve=>setTimeout(()=>resolve(false),9500))
    ]);
    assert.equal(ended,true,"SSE must end after periodic revalidation");
    assert.ok(Date.now()-start<9500,"SSE closes before its 60-second expiry");
    assert.equal(bus.count(scope),0,"revocation unsubscribes scope");
   }finally{controller.abort();}
  });
  await t.test("Control DB outage denies Inbox before opening tenant DB",async()=>{
   await db.end();closed=true;
   await noLease(A);
  });
 }finally{
  if(app)await app.close();
  if(db&&!closed)await db.end();
  if(created)await admin.query('DROP DATABASE "'+dbname+'"');
  await admin.end().catch(()=>{});
 }
});
