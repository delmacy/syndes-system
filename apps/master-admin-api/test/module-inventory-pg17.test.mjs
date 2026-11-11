import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {readTenantModuleInventory} from "../src/modules/tenant-module-inventory.mjs";

const raw=process.env.SYNDES_AK20_PG_URL;
const safe=(()=>{
 if(process.env.SYNDES_AK20_DISPOSABLE_PG!=="AK20_DISPOSABLE_ONLY"||!raw)return false;
 try{
  const u=new URL(raw);
  return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)&&
   u.pathname==="/postgres"&&u.username==="postgres"&&
   u.password.startsWith("ci-only-disposable-");
 }catch{return false;}
})();
const {Client}=pg;
test("Manager Control Plane inventory PG17: per-tenant states and read-only SQL role",
 {skip:!safe},async t=>{
 const admin=new Client({connectionString:raw});
 await admin.connect();
 const name="syndes_ak20_mgmt_"+randomBytes(6).toString("hex");
 let created=false,scoped;
 try{
  const v=await admin.query("SELECT current_setting('server_version_num')::int AS n");
  assert.ok(v.rows[0].n>=170000&&v.rows[0].n<180000);
  await admin.query('CREATE DATABASE "'+name+'"');created=true;
  const url=new URL(raw);url.pathname="/"+name;
  scoped=new Client({connectionString:url.toString()});await scoped.connect();
  await scoped.query("DO $$ BEGIN IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; IF NOT EXISTS(SELECT FROM pg_roles WHERE rolname='syndes_master_api') THEN CREATE ROLE syndes_master_api NOLOGIN; END IF; END $$");
  const read=async f=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+f,import.meta.url)),"utf8");
  for(const file of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema","control-module-manager-readonly.schema"]){
   await scoped.query(await read(file));
  }
  await scoped.query(await read("control-module-manager-readonly.schema"));
  await scoped.query("GRANT SELECT ON public.tenant_registry TO syndes_master_api");
  const A=randomUUID(),B=randomUUID();
  for(const [tenant,state] of [[A,"active"],[B,"suspended"]]){
   const slug=tenant.replaceAll("-","");
   await scoped.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,$4)",
    [tenant,"syndes_tenant_"+slug,"syndes_t_"+slug,state]);
  }
  await scoped.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm','crm'),('inbox','inbox')");
  await scoped.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES('crm','0.1.0',true,now(),'operator-test'),('inbox','0.1.0',false,null,null)");
  await scoped.query("INSERT INTO public.tenant_module_entitlements(tenant_id,module_id,state) VALUES($1,'crm','granted'),($2,'crm','suspended')",[A,B]);
  await scoped.query("INSERT INTO public.tenant_module_installs(tenant_id,module_id,target_version,state) VALUES($1,'crm','0.1.0','requested')",[A]);
  await t.test("read-only role sees A/B distinct entitlements and no unapproved release",async()=>{
   await scoped.query("SET ROLE syndes_master_api");
   try{
    const a=await readTenantModuleInventory(scoped,A);
    const b=await readTenantModuleInventory(scoped,B);
    assert.deepEqual(a.items.map(x=>[x.moduleId,x.entitled,x.installationState]),[
     ["crm",true,"requested"],["inbox",false,null],
    ]);
    assert.deepEqual(b.items.map(x=>[x.moduleId,x.entitled,x.installationState]),[
     ["crm",false,null],["inbox",false,null],
    ]);
    assert.deepEqual(a.items[1].approvedVersions,[]);
    assert.deepEqual(b.items[0].approvedVersions,["0.1.0"]);
    assert.equal(b.tenantStatus,"suspended");
   }finally{await scoped.query("RESET ROLE");}
  });
  await t.test("Manager SQL role cannot access audit or mutate entitlement or installation",async()=>{
   await scoped.query("SET ROLE syndes_master_api");
   try{
    for(const sql of [
     "SELECT * FROM public.tenant_module_audit",
     "UPDATE public.tenant_module_entitlements SET state='granted'",
     "UPDATE public.tenant_module_installs SET state='enabled'",
     "SELECT public.transition_tenant_module_entitlement($1::uuid,'crm','grant',$2::uuid,'person','reason')",
    ]){
     await assert.rejects(scoped.query(sql,sql.includes("$1")?[B,randomUUID()]:[]),
      e=>e.code==="42501",sql);
    }
   }finally{await scoped.query("RESET ROLE");}
  });
  await t.test("no schema or tenant DB queries and absent tenant is not fabricated",async()=>{
   const r=await readTenantModuleInventory(scoped,randomUUID());
   assert.equal(r,null);
   const list=await scoped.query("SELECT nspname FROM pg_namespace WHERE nspname='crm'");
   assert.equal(list.rowCount,0);
  });
 }finally{
  if(scoped)await scoped.end();
  if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
  await admin.end();
 }
});
