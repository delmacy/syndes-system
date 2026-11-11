import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID,randomBytes,createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {PgModuleInstaller,PgControlInstallAttestor} from "../dist/module-installer.js";

const rawUrl=process.env.SYNDES_AK30_PG_URL;
const safe=(()=>{
  if (!rawUrl || process.env.SYNDES_AK30_DISPOSABLE_PG!=="AK30_DISPOSABLE_ONLY")return false;
  try {
    const u=new URL(rawUrl);
    return u.protocol==="postgresql:"&&["localhost","127.0.0.1"].includes(u.hostname)&&
      u.pathname==="/postgres"&&u.username==="postgres"&&
      u.password.startsWith("ci-only-disposable-");
  }catch{return false;}
})();
const hash=text=>createHash("sha256").update(text).digest("hex");
const release=(id,deps,migrations)=>({
  id,version:"0.1.0",schema:id,dependencies:deps,
  imageDigest:"sha256:"+hash("ci-fixture-image/"+id),
  migrations:migrations.map(([suffix,sql,relations])=>({
    id:suffix,version:"0.1.0",sql,checksum:hash(sql),expectedRelations:relations,
  })),
});
const releases=[
  release("crm",[],[
    ["001_people","CREATE TABLE crm.people (id UUID PRIMARY KEY, name TEXT NOT NULL)",["crm.people"]],
    ["002_activities","CREATE TABLE crm.activities (id UUID PRIMARY KEY, person_id UUID NOT NULL REFERENCES crm.people(id))",["crm.activities"]],
  ]),
  release("inbox",["crm"],[
    ["001_conversations","CREATE TABLE inbox.conversations (id UUID PRIMARY KEY, person_id UUID NOT NULL REFERENCES crm.people(id))",["inbox.conversations"]],
  ]),
  release("broken",[],[
    ["001_failure","CREATE TABLE broken.records (id UUID PRIMARY KEY); SELECT 1/0",["broken.records"]],
  ]),
];
const {Client,Pool}=pg;
const fixtureSql=async path=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+path,import.meta.url)),"utf8");
const testDb=(adminUrl,name)=>{const u=new URL(adminUrl);u.pathname="/"+name;return u.toString();};

test("AK-30 versioned installer: Control DB plus 2 separate PG17 tenant databases, all disposable",
  {skip:!safe},async t=>{
    const admin=new Client({connectionString:rawUrl});
    await admin.connect();
    const prefix="syndes_ak30_"+randomBytes(6).toString("hex");
    const controlName=prefix+"_control";
    const A=randomUUID(),B=randomUUID(),C=randomUUID();
    const mapping=id=>"syndes_tenant_"+id.replaceAll("-","");
    const dbNames=[controlName,mapping(A),mapping(B)];
    const created=[];
    let control,operator,attestorClient;
    const pools=[];
    try{
      const version=await admin.query("SELECT current_setting('server_version_num')::int AS n");
      assert.ok(version.rows[0].n>=170000&&version.rows[0].n<180000,"PG17 required");
      for(const dbName of dbNames){await admin.query('CREATE DATABASE "'+dbName+'"');created.push(dbName);}
      control=new Client({connectionString:testDb(rawUrl,controlName)});
      await control.connect();
      await control.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
      for(const script of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema","control-module-attestation.schema"]){
        await control.query(await fixtureSql(script));
      }
      await control.query(await fixtureSql("control-module-attestation.schema"));
      const poolsByTenant=new Map();
      for(const id of [A,B]){
        const pool=new Pool({connectionString:testDb(rawUrl,mapping(id)),max:3});
        pools.push(pool);poolsByTenant.set(id,pool);
        await pool.query(await fixtureSql("tenant-module-ledger.schema"));
        await pool.query(await fixtureSql("tenant-module-ledger.schema"));
      }
      operator=new Client({connectionString:testDb(rawUrl,controlName)});await operator.connect();
      await operator.query("SET ROLE syndes_module_operator");
      attestorClient=new Client({connectionString:testDb(rawUrl,controlName)});await attestorClient.connect();
      await attestorClient.query("SET ROLE syndes_module_installer");
      for(const id of [A,B,C]){
        const suffix=id.replaceAll("-","");
        await control.query(
          "INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'active')",
          [id,mapping(id),"syndes_t_"+suffix]);
      }
      for(const item of releases){
        await control.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES($1,$2)",
          [item.id,item.schema]);
        await control.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES($1,$2,true,now(),'fixture-operator')",
          [item.id,item.version]);
        for(const dep of item.dependencies){
          await control.query("INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES($1,$2,$3)",
            [item.id,item.version,dep]);
        }
      }
      const command=async(tenant,module,kind)=>{
        const requestId=randomUUID();
        const args=kind==="grant"?
          [tenant,module,"grant",requestId,"installer-fixture","fixture-request",null]:
          [tenant,module,"0.1.0","request",requestId,"installer-fixture","fixture-request"];
        const sql=kind==="grant"?
          "SELECT public.transition_tenant_module_entitlement($1::uuid,$2,$3,$4::uuid,$5,$6,$7)":
          "SELECT public.transition_tenant_module_install_intent($1::uuid,$2,$3,$4,$5::uuid,$6,$7)";
        return operator.query(sql,args);
      };
      for(const module of ["crm","inbox","broken"]){await command(A,module,"grant");await command(A,module,"request");}
      await command(B,"crm","grant");await command(B,"crm","request");
      const resolver=async id=>{
        const pool=poolsByTenant.get(id);
        if(!pool)throw Error("No installer provider for tenant");
        return pool;
      };
      const trustedAttestor=new PgControlInstallAttestor(attestorClient);
      const installer=new PgModuleInstaller(control,resolver,releases,trustedAttestor);
      const unattested=new PgModuleInstaller(control,resolver,releases);

      await t.test("plan is read-only, tenant-specific and only for approved requested release",async()=>{
        const plan=await installer.plan(A,"crm");
        assert.equal(plan.databaseName,mapping(A));
        assert.deepEqual(plan.migrations.map(x=>x.status),["pending","pending"]);
        const n=await poolsByTenant.get(A).query("SELECT COUNT(*)::int AS n FROM _syndes.module_migrations");
        assert.equal(n.rows[0].n,0);
        await assert.rejects(installer.plan(B,"inbox"),/Access denied/);
        await assert.rejects(installer.plan(C,"crm"),/Access denied/);
        await assert.rejects(installer.plan(A,"../crm"),/Access denied/);
      });
      await t.test("runtime SQL role cannot tamper with protected tenant ledger",async()=>{
        const client=await poolsByTenant.get(A).connect();
        try{
          await client.query("SET ROLE syndes_core");
          await assert.rejects(client.query("SELECT * FROM _syndes.module_migrations"),e=>e.code==="42501");
          await assert.rejects(client.query("INSERT INTO _syndes.module_migrations(module_id,migration_id,version,checksum,image_digest) VALUES('crm','999_bad','0.1.0',$1,$2)",
            ["0".repeat(64),"sha256:"+"0".repeat(64)]),e=>e.code==="42501");
        }finally{await client.query("RESET ROLE");client.release();}
      });
      await t.test("dependency must be installed in same tenant before Inbox migration",async()=>{
        await assert.rejects(installer.plan(A,"inbox"),/Access denied/);
        await assert.rejects(installer.apply(A,"inbox"),/Access denied/);
        const exists=await poolsByTenant.get(A).query("SELECT to_regclass('inbox.conversations') IS NOT NULL AS present");
        assert.equal(exists.rows[0].present,false);
      });
      await t.test("apply atomic CRM then verify physical ledger, without pretending Control installed",async()=>{
        const result=await unattested.apply(A,"crm");
        assert.equal(result.controlState,"requested");
        assert.ok(result.verified.verified);
        assert.deepEqual(result.plan.migrations.map(m=>m.status),["applied","applied"]);
        const state=await control.query("SELECT state FROM public.tenant_module_installs WHERE tenant_id=$1 AND module_id='crm'",[A]);
        assert.equal(state.rows[0].state,"requested");
        const count=await poolsByTenant.get(A).query("SELECT COUNT(*)::int AS n FROM _syndes.module_migrations");
        assert.equal(count.rows[0].n,2);
      });
      await t.test("retry after Control DB outage reuses tenant ledger, creates one install attestation",async()=>{
        const before=await control.query("SELECT COUNT(*)::int AS n FROM public.tenant_module_audit WHERE tenant_id=$1 AND operation='installation.attest'",[A]);
        assert.equal(before.rows[0].n,0);
        const facts={requestId:randomUUID(),actorId:"verified-installer-fixture",reason:"verified-ledger"};
        const first=await installer.apply(A,"crm",facts);
        assert.equal(first.controlState,"installed");
        const row=await control.query("SELECT installed_version,verification_digest,state FROM public.tenant_module_installs WHERE tenant_id=$1 AND module_id='crm'",[A]);
        assert.equal(row.rows[0].installed_version,"0.1.0");
        assert.equal(row.rows[0].verification_digest,first.verified.receipt);
        assert.equal(row.rows[0].state,"installed");
        const count=await poolsByTenant.get(A).query("SELECT COUNT(*)::int AS n FROM _syndes.module_migrations");
        assert.equal(count.rows[0].n,2);
        const again=await installer.apply(A,"crm",facts);
        assert.equal(again.controlState,"installed");
        assert.deepEqual(again.plan.migrations.map(m=>m.status),["applied","applied"]);
        const after=await control.query("SELECT COUNT(*)::int AS n FROM public.tenant_module_audit WHERE tenant_id=$1 AND operation='installation.attest'",[A]);
        assert.equal(after.rows[0].n,1);
      });
      await t.test("Inbox installs only for tenant A with verified CRM; B remains CRM only",async()=>{
        const run=await installer.apply(A,"inbox",{
          requestId:randomUUID(),actorId:"verified-installer-fixture",reason:"approved-inbox",
        });
        assert.equal(run.controlState,"installed");
        assert.equal((await poolsByTenant.get(A).query("SELECT to_regclass('inbox.conversations') IS NOT NULL AS yes")).rows[0].yes,true);
        assert.equal((await poolsByTenant.get(B).query("SELECT to_regclass('inbox.conversations') IS NOT NULL AS yes")).rows[0].yes,false);
        const before=(await control.query("SELECT state FROM public.tenant_module_installs WHERE tenant_id=$1 AND module_id='inbox'",[B])).rows;
        assert.deepEqual(before,[]);
      });
      await t.test("tenant B CRM install is independent and has no optional Inbox schema",async()=>{
        const result=await installer.apply(B,"crm",{
          requestId:randomUUID(),actorId:"verified-installer-fixture",reason:"approved-crm",
        });
        assert.equal(result.controlState,"installed");
        const b=await poolsByTenant.get(B).query("SELECT COUNT(*)::int AS n FROM _syndes.module_migrations");
        assert.equal(b.rows[0].n,2);
        const schemas=await poolsByTenant.get(B).query("SELECT nspname FROM pg_namespace WHERE nspname IN ('crm','inbox')");
        assert.deepEqual(schemas.rows.map(x=>x.nspname),["crm"]);
      });
      await t.test("wrong database provider never installs cross tenant",async()=>{
        const wrong=new PgModuleInstaller(control,async()=>poolsByTenant.get(B),releases);
        await assert.rejects(wrong.plan(A,"crm"),/Access denied/);
        await assert.rejects(wrong.apply(A,"crm"),/Access denied/);
      });
      await t.test("invalid checksum, image digest, unexpected SQL and path fail before running",async()=>{
        const invalid={...releases[0],migrations:[{...releases[0].migrations[0],sql:"SELECT 1"}]};
        assert.throws(()=>new PgModuleInstaller(control,resolver,[invalid]),/migration|checksum/i);
        const destructive=release("crm",[],[
          ["001_bad","DROP TABLE crm.people CASCADE",["crm.people"]],
        ]);
        assert.throws(()=>new PgModuleInstaller(control,resolver,[destructive]),/Disallowed/);
      });
      await t.test("failed migration rolls back schema and ledger in tenant A without Control attestation",async()=>{
        await assert.rejects(installer.apply(A,"broken"),/division by zero/i);
        const db=poolsByTenant.get(A);
        assert.equal((await db.query("SELECT to_regclass('broken.records') IS NOT NULL AS yes")).rows[0].yes,false);
        assert.equal((await db.query("SELECT COUNT(*)::int AS n FROM _syndes.module_migrations WHERE module_id='broken'")).rows[0].n,0);
        const state=await control.query("SELECT state FROM public.tenant_module_installs WHERE tenant_id=$1 AND module_id='broken'",[A]);
        assert.equal(state.rows[0].state,"requested");
      });
      await t.test("ledger drift refuses verify, repair/replay attempts do not overwrite it",async()=>{
        const db=poolsByTenant.get(A);
        const before=await db.query("SELECT checksum FROM _syndes.module_migrations WHERE module_id='crm' AND migration_id='001_people'");
        await db.query("UPDATE _syndes.module_migrations SET checksum=$1 WHERE module_id='crm' AND migration_id='001_people'",["f".repeat(64)]);
        await assert.rejects(installer.verify(A,"crm"),/Access denied/);
        await assert.rejects(installer.apply(A,"crm"),/Access denied/);
        await db.query("UPDATE _syndes.module_migrations SET checksum=$1 WHERE module_id='crm' AND migration_id='001_people'",[before.rows[0].checksum]);
        assert.equal((await installer.verify(A,"crm")).verified,true);
      });
      await t.test("Control attestation is role-isolated and refuses non-requested transitions",async()=>{
        await operator.query("SELECT 1");
        await assert.rejects(operator.query(
          "SELECT public.attest_tenant_module_install($1,'crm','0.1.0',$2,$3,'imposter','wrong-role')",
          [A,"f".repeat(64),randomUUID()]),e=>e.code==="42501");
        await assert.rejects(trustedAttestor.attestInstallation({
          tenantId:A,moduleId:"crm",version:"0.1.0",
          receipt:"f".repeat(64),requestId:randomUUID(),actorId:"verified-installer-fixture",reason:"forged-receipt",
        }),e=>e.code==="23514");
      });
      await t.test("physical relation loss denies verify even when ledger says applied",async()=>{
        const db=poolsByTenant.get(B);
        await db.query("DROP TABLE crm.activities");
        await assert.rejects(installer.verify(B,"crm"),/Access denied/);
        await assert.rejects(installer.apply(B,"crm"),/Access denied/);
      });
    }finally{
      if(operator)await operator.end();
      if(attestorClient)await attestorClient.end();
      if(control)await control.end();
      await Promise.all(pools.map(pool=>pool.end()));
      for(const db of created.reverse())await admin.query('DROP DATABASE "'+db+'" WITH (FORCE)');
      await admin.end();
    }
  });
