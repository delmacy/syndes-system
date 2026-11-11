import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes, randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {PgModuleCatalog} from "../dist/module-catalog.js";

const rawUrl=process.env.SYNDES_AK10_PG_URL;
const allowed=process.env.SYNDES_AK10_DISPOSABLE_PG === "AK10_DISPOSABLE_ONLY";
const safe=(()=>{
  if (!rawUrl || !allowed) return false;
  try {
    const u=new URL(rawUrl);
    return u.protocol==="postgresql:" && ["127.0.0.1","localhost"].includes(u.hostname) &&
      u.username==="postgres" && u.pathname==="/postgres" && u.password.startsWith("ci-only-disposable-");
  } catch {return false;}
})();
const {Client}=pg;
test("AK-10.02 catalog: PostgreSQL 17 isolated Control DB, ACL, repeatable DDL and negative cases",
  {skip:!safe}, async t=>{
    const admin=new Client({connectionString:rawUrl});
    await admin.connect();
    const dbName="syndes_ak10_test_"+randomBytes(7).toString("hex");
    const build=[
      {id:"platform",version:"0.1.0"},
      {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
      {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["platform","crm"]},
      {id:"whatsapp",version:"0.1.0",schema:"whatsapp",dependencies:["platform","crm","inbox"]},
    ];
    let databaseCreated=false;
    let scoped;
    try {
      const version=await admin.query("SELECT current_setting('server_version_num')::int AS number");
      assert.ok(version.rows[0].number>=170000 && version.rows[0].number<180000,"requires PG 17");
      await admin.query('CREATE DATABASE "'+dbName+'"');
      databaseCreated=true;
      const url=new URL(rawUrl);url.pathname="/"+dbName;
      scoped=new Client({connectionString:url.toString()});
      await scoped.connect();
      await scoped.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
      const base=await readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/control.schema",import.meta.url)),"utf8");
      const catalog=await readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/control-module-catalog.schema",import.meta.url)),"utf8");
      await scoped.query(base);
      await scoped.query(catalog);
      await scoped.query(catalog);
      await t.test("catalog SQL is idempotent, owned by Control DB and initially closed",async()=>{
        const result=await scoped.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'module_catalog%' ORDER BY table_name");
        assert.deepEqual(result.rows.map(x=>x.table_name),["module_catalog","module_catalog_dependencies","module_catalog_versions"]);
        assert.equal((await scoped.query("SELECT COUNT(*)::int AS n FROM public.module_catalog_versions")).rows[0].n,0);
      });
      const tenantA=randomUUID(),tenantB=randomUUID(),suspended=randomUUID();
      const insertTenant=async(id,state)=>{
        const token=id.replaceAll("-","");
        await scoped.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,$4)",
          [id,"syndes_tenant_"+token,"syndes_t_"+token,state]);
      };
      await insertTenant(tenantA,"active");
      await insertTenant(tenantB,"active");
      await insertTenant(suspended,"suspended");
      for (const id of ["crm","inbox","whatsapp"]) {
        await scoped.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES($1,$1)",[id]);
        await scoped.query("INSERT INTO public.module_catalog_versions(module_id,version) VALUES($1,'0.1.0')",[id]);
      }
      for (const [id,dependency] of [["inbox","crm"],["whatsapp","crm"],["whatsapp","inbox"]]) {
        await scoped.query("INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES($1,'0.1.0',$2)",[id,dependency]);
      }
      const port=new PgModuleCatalog(scoped,build);
      await t.test("unapproved and suspended tenants yield no build candidates",async()=>{
        for (const id of [tenantA,tenantB,suspended,randomUUID()]) assert.deepEqual(await port.listAvailableForTenant(id),[]);
      });
      const approve=async(id)=>{
        await scoped.query("UPDATE public.module_catalog_versions SET approved=true,approved_at=now(),approved_by='operator-fixture' WHERE module_id=$1",[id]);
      };
      await approve("crm");
      await t.test("only approved release visible; dependencies block unapproved children",async()=>{
        assert.deepEqual((await port.listAvailableForTenant(tenantA)).map(x=>x.id),["crm"]);
        assert.deepEqual((await port.listAvailableForTenant(tenantB)).map(x=>x.id),["crm"]);
        assert.deepEqual(await port.listAvailableForTenant(suspended),[]);
        await scoped.query("UPDATE public.module_catalog_versions SET approved=false,approved_at=NULL,approved_by=NULL WHERE module_id='crm'");
        assert.deepEqual(await port.listAvailableForTenant(tenantA),[]);
        await approve("crm");
      });
      await approve("whatsapp");
      await t.test("release cannot bypass unavailable dependency",async()=>{
        assert.deepEqual((await port.listAvailableForTenant(tenantA)).map(x=>x.id),["crm"]);
      });
      await approve("inbox");
      await t.test("build availability is not per-tenant entitlement",async()=>{
        assert.deepEqual((await port.listAvailableForTenant(tenantA)).map(x=>x.id),["crm","inbox","whatsapp"]);
        assert.deepEqual((await port.listAvailableForTenant(tenantB)).map(x=>x.id),["crm","inbox","whatsapp"]);
        assert.deepEqual(await port.listAvailableForTenant(suspended),[]);
      });
      await t.test("runtime role can read but cannot mutate release approval",async()=>{
        await scoped.query("SET ROLE syndes_core");
        try {
          const got=await scoped.query("SELECT COUNT(*)::int AS n FROM public.module_catalog_versions");
          assert.equal(got.rows[0].n,3);
          await assert.rejects(scoped.query("UPDATE public.module_catalog_versions SET approved=false WHERE module_id='crm'"),
            e=>e.code==="42501");
          await assert.rejects(scoped.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES('fake','fake')"),
            e=>e.code==="42501");
        } finally {await scoped.query("RESET ROLE");}
      });
      await t.test("constraints reject malformed IDs, duplicate schema and untracked approval",async()=>{
        const bad=[
          ["INSERT INTO public.module_catalog(module_id,schema_name) VALUES('crm;DROP','evil')", "23514"],
          ["INSERT INTO public.module_catalog(module_id,schema_name) VALUES('new','crm')", "23505"],
          ["INSERT INTO public.module_catalog(module_id,schema_name) VALUES('evil','public')", "23514"],
          ["INSERT INTO public.module_catalog_versions(module_id,version,approved) VALUES('crm','0.2.0',true)", "23514"],
          ["INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES('inbox','0.1.0','unknown')", "23503"],
        ];
        for (const [sql,code] of bad) await assert.rejects(scoped.query(sql),e=>e.code===code);
      });
      await t.test("catalog mismatch denies; reapplying SQL preserves approvals",async()=>{
        await scoped.query(catalog);
        assert.deepEqual((await port.listAvailableForTenant(tenantA)).map(x=>x.id),["crm","inbox","whatsapp"]);
        await scoped.query("UPDATE public.module_catalog SET schema_name='bad_schema' WHERE module_id='crm'");
        await assert.rejects(port.listAvailableForTenant(tenantA),/Access denied|AccessDenied/i);
      });
    } finally {
      if (scoped) await scoped.end();
      if (databaseCreated) await admin.query('DROP DATABASE "'+dbName+'" WITH (FORCE)');
      await admin.end();
    }
  });
