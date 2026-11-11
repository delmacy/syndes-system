import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {PgModuleCatalog} from "../dist/module-catalog.js";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";
import {PgEffectiveModuleAccess} from "../dist/module-effective-access.js";

const raw=process.env.SYNDES_AK10_PG_URL;
const safe=(()=>{
 if(process.env.SYNDES_AK10_DISPOSABLE_PG!=="AK10_DISPOSABLE_ONLY"||!raw)return false;
 try{
  const u=new URL(raw);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password.startsWith("ci-only-disposable-");
 }catch{return false;}
})();
const {Client}=pg;
const defs=[
 {id:"platform",version:"0.1.0"},
 {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
 {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["platform","crm"]},
];
test("AK-10.04 Control attestation read model: deny unavailable, not enabled and cross tenant (PG17)",
 {skip:!safe},async t=>{
 const admin=new Client({connectionString:raw});await admin.connect();
 const name="syndes_ak1004_"+randomBytes(6).toString("hex");
 let scoped,created=false;
 try{
  const v=await admin.query("SELECT current_setting('server_version_num')::int AS n");
  assert.ok(v.rows[0].n>=170000&&v.rows[0].n<180000);
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  const u=new URL(raw);u.pathname="/"+name;
  scoped=new Client({connectionString:u.toString()});await scoped.connect();
  await scoped.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
  const read=async f=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+f,import.meta.url)),"utf8");
  for(const f of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema"]){
   await scoped.query(await read(f));
  }
  const A=randomUUID(),B=randomUUID(),C=randomUUID(),D=randomUUID();
  for(const [tenant,state] of [[A,"active"],[B,"active"],[C,"suspended"]]){
   const suffix=tenant.replaceAll("-","");
   await scoped.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,$4)",
    [tenant,"syndes_tenant_"+suffix,"syndes_t_"+suffix,state]);
  }
  await scoped.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm','crm'),('inbox','inbox')");
  await scoped.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES('crm','0.1.0',true,now(),'fixture'),('inbox','0.1.0',true,now(),'fixture')");
  await scoped.query("INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES('inbox','0.1.0','crm')");
  const insertEntitlement=async(tenant,module,state)=>
   scoped.query("INSERT INTO public.tenant_module_entitlements(tenant_id,module_id,state) VALUES($1,$2,$3)",[tenant,module,state]);
  for(const module of ["crm","inbox"])await insertEntitlement(A,module,"granted");
  await insertEntitlement(B,"crm","granted");
  await insertEntitlement(B,"inbox","suspended");
  const insertInstall=async(tenant,module,state)=>{
   await scoped.query("INSERT INTO public.tenant_module_installs(tenant_id,module_id,target_version,state,installed_version,verification_digest,verified_at) VALUES($1,$2,'0.1.0',$3,'0.1.0',$4,now())",
    [tenant,module,state,"a".repeat(64)]);
  };
  await insertInstall(A,"crm","enabled");
  await insertInstall(A,"inbox","enabled");
  await insertInstall(B,"crm","installed");
  const gate=new PgEffectiveModuleAccess(new PgModuleLifecycle(scoped,new PgModuleCatalog(scoped,defs)));
  const q=(tenant,module="crm")=>gate.canExecuteModule({actor:{kind:"user",id:"signed-user"},tenantId:tenant,moduleId:module});
  await t.test("A enabled modules pass, B has entitlement but only installed and C/D unavailable",async()=>{
   assert.equal(await q(A),true);
   assert.equal(await q(A,"inbox"),true);
   for(const [tenant,module] of [[B,"crm"],[B,"inbox"],[C,"crm"],[D,"crm"]]){
    assert.equal(await q(tenant,module),false);
   }
  });
  await t.test("dependency must itself be enabled and current in same tenant",async()=>{
   await scoped.query("UPDATE public.tenant_module_installs SET state='installed' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A,"inbox"),false);
   await scoped.query("UPDATE public.tenant_module_installs SET state='enabled' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A,"inbox"),true);
  });
  await t.test("suspension/revocation, expired terms and absent receipt deny immediately",async()=>{
   await scoped.query("UPDATE public.tenant_module_entitlements SET state='suspended' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A),false);
   assert.equal(await q(A,"inbox"),false);
   await scoped.query("UPDATE public.tenant_module_entitlements SET state='granted',valid_until=now()-interval '1 second' WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A),false);
   await scoped.query("UPDATE public.tenant_module_entitlements SET state='granted',valid_until=NULL WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A),true);
   await scoped.query("UPDATE public.tenant_module_installs SET state='suspended',installed_version=NULL,verification_digest=NULL,verified_at=NULL WHERE tenant_id=$1 AND module_id='crm'",[A]);
   assert.equal(await q(A),false);
  });
  await t.test("deapproved release removes availability and every dependent module",async()=>{
   await scoped.query("UPDATE public.module_catalog_versions SET approved=false,approved_at=NULL,approved_by=NULL WHERE module_id='crm'");
   assert.equal(await q(A),false);
   assert.equal(await q(A,"inbox"),false);
  });
 }finally{
  if(scoped)await scoped.end();
  if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
  await admin.end();
 }
});
