import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {PgModuleCatalog} from "../dist/module-catalog.js";
import {PgModuleLifecycle} from "../dist/module-lifecycle.js";

const rawUrl=process.env.SYNDES_AK10_PG_URL;
const safe=(()=>{
  if (!rawUrl || process.env.SYNDES_AK10_DISPOSABLE_PG!=="AK10_DISPOSABLE_ONLY")return false;
  try {
    const u=new URL(rawUrl);
    return u.protocol==="postgresql:" && ["127.0.0.1","localhost"].includes(u.hostname) &&
      u.username==="postgres" && u.pathname==="/postgres" &&
      u.password.startsWith("ci-only-disposable-");
  }catch{return false;}
})();
const {Client}=pg;
const defs=[
  {id:"platform",version:"0.1.0"},
  {id:"crm",version:"0.1.0",schema:"crm",dependencies:["platform"]},
  {id:"inbox",version:"0.1.0",schema:"inbox",dependencies:["platform","crm"]},
  {id:"whatsapp",version:"0.1.0",schema:"whatsapp",dependencies:["platform","crm","inbox"]},
];
test("AK-10.03 Control DB lifecycle and immutable audit (PG17 disposable)",
  {skip:!safe},async t=>{
    const admin=new Client({connectionString:rawUrl});
    await admin.connect();
    const name="syndes_ak1003_"+randomBytes(7).toString("hex");
    let scoped,created=false;
    try{
      const ver=await admin.query("SELECT current_setting('server_version_num')::int AS n");
      assert.ok(ver.rows[0].n>=170000 && ver.rows[0].n<180000,"PG17 required");
      await admin.query('CREATE DATABASE "'+name+'"');created=true;
      const u=new URL(rawUrl);u.pathname="/"+name;
      scoped=new Client({connectionString:u.toString()});await scoped.connect();
      await scoped.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
      const read=async rel=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+rel,import.meta.url)),"utf8");
      for (const file of ["control.schema","control-module-catalog.schema","control-module-lifecycle.schema"]){
        await scoped.query(await read(file));
      }
      await scoped.query(await read("control-module-lifecycle.schema"));
      const A=randomUUID(),B=randomUUID(),C=randomUUID();
      for(const [id,state] of [[A,"active"],[B,"active"],[C,"suspended"]]){
        const slug=id.replaceAll("-","");
        await scoped.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,$4)",
          [id,"syndes_tenant_"+slug,"syndes_t_"+slug,state]);
      }
      for(const module of ["crm","inbox","whatsapp"]){
        await scoped.query("INSERT INTO public.module_catalog(module_id,schema_name) VALUES($1,$1)",[module]);
        await scoped.query("INSERT INTO public.module_catalog_versions(module_id,version,approved,approved_at,approved_by) VALUES($1,'0.1.0',true,now(),'fixture-owner')",[module]);
      }
      for(const [module,dep] of [["inbox","crm"],["whatsapp","crm"],["whatsapp","inbox"]]){
        await scoped.query("INSERT INTO public.module_catalog_dependencies(module_id,version,dependency_id) VALUES($1,'0.1.0',$2)",[module,dep]);
      }
      const lifecycle=new PgModuleLifecycle(scoped,new PgModuleCatalog(scoped,defs));
      const act=async(action,tenant,module,cmd,{key=randomUUID(),expiry=null,actor="verified-admin",reason="fixture-change",version="0.1.0"}={})=>{
        const sql=action==="entitlement"
          ?"SELECT public.transition_tenant_module_entitlement($1::uuid,$2,$3,$4::uuid,$5,$6,$7::timestamptz) AS result"
          :"SELECT public.transition_tenant_module_install_intent($1::uuid,$2,$3,$4,$5::uuid,$6,$7) AS result";
        const args=action==="entitlement"?
          [tenant,module,cmd,key,actor,reason,expiry]:
          [tenant,module,version,cmd,key,actor,reason];
        await scoped.query("SET ROLE syndes_module_operator");
        try{
          const res=await scoped.query(sql,args);
          return res.rows[0].result;
        }finally{await scoped.query("RESET ROLE");}
      };
      const ent=(tenant,module,cmd,opts)=>act("entitlement",tenant,module,cmd,opts);
      const intent=(tenant,module,cmd,opts)=>act("installation",tenant,module,cmd,opts);
      const count=async()=>Number((await scoped.query("SELECT COUNT(*) AS n FROM public.tenant_module_audit")).rows[0].n);
      await t.test("first run and reapplication keep no implicit grants, no installation",async()=>{
        assert.deepEqual((await lifecycle.listModuleStates(A)).map(x=>x.entitled),[false,false,false]);
        assert.deepEqual(await lifecycle.listModuleStates(C),[]);
        const r=await scoped.query("SELECT COUNT(*)::int AS n FROM public.tenant_module_audit");
        assert.equal(r.rows[0].n,0);
      });
      await t.test("operator has functions only; runtime role cannot alter grants, install or audit",async()=>{
        await scoped.query("SET ROLE syndes_core");
        try{
          await assert.rejects(scoped.query("SELECT public.transition_tenant_module_entitlement($1,'crm','grant',$2,'x','reason')",[A,randomUUID()]),e=>e.code==="42501");
          await assert.rejects(scoped.query("INSERT INTO public.tenant_module_entitlements(tenant_id,module_id,state) VALUES($1,'crm','granted')",[A]),e=>e.code==="42501");
          await assert.rejects(scoped.query("SELECT * FROM public.tenant_module_audit"),e=>e.code==="42501");
        }finally{await scoped.query("RESET ROLE");}
        await scoped.query("SET ROLE syndes_module_operator");
        try{
          await assert.rejects(scoped.query("UPDATE public.tenant_module_entitlements SET state='granted'"),e=>e.code==="42501");
          await assert.rejects(scoped.query("INSERT INTO public.tenant_module_installs(tenant_id,module_id,target_version,state) VALUES($1,'crm','0.1.0','enabled')",[A]),e=>e.code==="42501");
        }finally{await scoped.query("RESET ROLE");}
      });
      await t.test("tenant A has granted modules; B receives only CRM and C none",async()=>{
        for(const module of ["crm","inbox","whatsapp"])
          assert.equal(await ent(A,module,"grant"),"granted");
        assert.equal(await ent(B,"crm","grant"),"granted");
        assert.deepEqual((await lifecycle.listModuleStates(A)).map(x=>[x.moduleId,x.entitled]),[
          ["crm",true],["inbox",true],["whatsapp",true],
        ]);
        assert.deepEqual((await lifecycle.listModuleStates(B)).map(x=>[x.moduleId,x.entitled]),[
          ["crm",true],["inbox",false],["whatsapp",false],
        ]);
        assert.deepEqual(await lifecycle.listModuleStates(C),[]);
        await assert.rejects(ent(C,"crm","grant"),e=>e.code==="23514");
      });
      await t.test("request key replay is immutable and cannot rebind intent, even after subsequent state",async()=>{
        const key=randomUUID();
        const first=await ent(A,"crm","suspend",{key});
        assert.equal(first,"suspended");
        assert.equal(await ent(A,"crm","resume"),"granted");
        const before=await count();
        assert.equal(await ent(A,"crm","suspend",{key}),"suspended");
        assert.equal(await count(),before);
        await assert.rejects(ent(A,"crm","revoke",{key}),e=>e.code==="23505");
        await assert.rejects(ent(A,"inbox","suspend",{key}),e=>e.code==="23505");
        assert.equal((await lifecycle.listModuleStates(A))[0].entitled,true);
      });
      await t.test("concurrent identical requests serialize to one mutation and one audit",async()=>{
        const key=randomUUID();
        const before=await count();
        const u=new URL(rawUrl);u.pathname="/"+name;
        const clients=[new Client({connectionString:u.toString()}),new Client({connectionString:u.toString()})];
        try{
          await Promise.all(clients.map(c=>c.connect()));
          await Promise.all(clients.map(c=>c.query("SET ROLE syndes_module_operator")));
          const args=[A,"crm","grant",key,"verified-admin","fixture-change",null];
          const results=await Promise.all(clients.map(c=>c.query(
            "SELECT public.transition_tenant_module_entitlement($1::uuid,$2,$3,$4::uuid,$5,$6,$7::timestamptz) AS result",args)));
          assert.deepEqual(results.map(r=>r.rows[0].result),["granted","granted"]);
          assert.equal(await count(),before+1);
        }finally{await Promise.all(clients.map(c=>c.end()));}
      });
      await t.test("expiry and revocation deny without deleting old audit or other tenants",async()=>{
        const future=new Date(Date.now()+180_000).toISOString();
        await ent(A,"inbox","grant",{expiry:future});
        assert.equal((await lifecycle.listModuleStates(A))[1].entitled,true);
        await ent(A,"inbox","suspend");
        assert.equal((await lifecycle.listModuleStates(A))[1].entitled,false);
        await ent(A,"inbox","resume");
        assert.equal((await lifecycle.listModuleStates(A))[1].entitled,true);
        await ent(A,"inbox","revoke");
        assert.equal((await lifecycle.listModuleStates(A))[1].entitled,false);
        await assert.rejects(ent(A,"inbox","resume"),e=>e.code==="23514");
        await assert.rejects(ent(A,"inbox","grant",{expiry:"2020-01-01T00:00:00Z"}),e=>e.code==="23514");
        await ent(A,"inbox","grant",{expiry:future});
        // Simulate time passing with privileged test fixture; the read uses DB clock.
        await scoped.query("UPDATE public.tenant_module_entitlements SET valid_until=now()-interval '1 second' WHERE tenant_id=$1 AND module_id='inbox'",[A]);
        assert.equal((await lifecycle.listModuleStates(A))[1].entitled,false);
        assert.equal((await lifecycle.listModuleStates(B))[0].entitled,true);
      });
      await t.test("installer intent requires granted current entitlement and approved release",async()=>{
        assert.equal(await intent(A,"crm","request"),"requested");
        await assert.rejects(intent(B,"inbox","request"),e=>e.code==="23514");
        await assert.rejects(intent(C,"crm","request"),e=>e.code==="23514");
        await assert.rejects(intent(A,"inbox","request"),e=>e.code==="23514");
        await assert.rejects(intent(A,"crm","request",{version:"9.9.9"}),e=>e.code==="23514");
        const a=(await lifecycle.listModuleStates(A))[0];
        assert.equal(a.installState,"requested");assert.equal(a.hasVerificationMetadata,false);
        assert.equal(a.entitled,true);
      });
      await t.test("tenant dependency entitlement is required before install intent",async()=>{
        // Inbox is expired for A after the prior test: WhatsApp intent must not
        // bypass that even though WhatsApp itself remains granted.
        await assert.rejects(intent(A,"whatsapp","request"),e=>e.code==="23514");
        // The tenant B has only CRM, so no Inbox intent even if a release
        // is approved globally.
        await assert.rejects(intent(B,"inbox","request"),e=>e.code==="23514");
        const future=new Date(Date.now()+180_000).toISOString();
        await ent(A,"inbox","grant",{expiry:future});
        assert.equal(await intent(A,"whatsapp","request"),"requested");
      });
      await t.test("suspend, resume and retire intent; no enable/installed bypass",async()=>{
        await assert.rejects(intent(A,"crm","suspend",{version:"9.9.9"}),e=>e.code==="23514");
        assert.equal(await intent(A,"crm","suspend"),"suspended");
        assert.equal(await intent(A,"crm","resume"),"requested");
        await assert.rejects(intent(A,"crm","enable"),e=>e.code==="22023");
        await assert.rejects(intent(A,"crm","installed"),e=>e.code==="22023");
        const key=randomUUID();
        assert.equal(await intent(A,"crm","retire",{key}),"retired");
        const before=await count();
        assert.equal(await intent(A,"crm","retire",{key}),"retired");
        assert.equal(await count(),before);
        await assert.rejects(intent(A,"crm","request"),e=>e.code==="23514");
        const a=(await lifecycle.listModuleStates(A))[0];
        assert.equal(a.installState,"retired");
      });
      await t.test("audit append-only, per-tenant and reason/actor validated",async()=>{
        const audit=await scoped.query("SELECT tenant_id,module_id,operation,actor_id,reason,previous_state,result_state,result_revision FROM public.tenant_module_audit ORDER BY event_id");
        assert.ok(audit.rowCount>=12);
        assert.ok(audit.rows.every(r=>r.actor_id==="verified-admin"&&r.reason==="fixture-change"));
        assert.ok(audit.rows.some(r=>r.tenant_id===B && r.module_id==="crm"));
        assert.ok(audit.rows.some(r=>r.tenant_id===A && r.operation==="installation.retire"));
        await assert.rejects(scoped.query("UPDATE public.tenant_module_audit SET reason='changed'"),e=>e.code==="42501");
        await assert.rejects(scoped.query("DELETE FROM public.tenant_module_audit"),e=>e.code==="42501");
        await assert.rejects(ent(B,"crm","suspend",{reason:""}),e=>e.code==="22023");
        await assert.rejects(ent(B,"crm","suspend",{actor:""}),e=>e.code==="22023");
        await assert.rejects(ent(B,"crm;DROP","grant"),e=>e.code==="22023");
      });
      await t.test("suspended tenants can revoke and retire but cannot create new grants",async()=>{
        assert.equal(await ent(B,"crm","revoke"),"revoked");
        await assert.rejects(intent(B,"crm","request"),e=>e.code==="23514");
        await scoped.query("UPDATE public.tenant_registry SET state='suspended' WHERE tenant_id=$1",[B]);
        assert.deepEqual(await lifecycle.listModuleStates(B),[]);
        assert.equal(await ent(B,"crm","revoke"),"revoked");
        await assert.rejects(ent(B,"crm","grant"),e=>e.code==="23514");
      });
    }finally{
      if(scoped)await scoped.end();
      if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
      await admin.end();
    }
  });
