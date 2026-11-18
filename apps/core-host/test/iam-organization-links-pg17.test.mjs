import test from "node:test";
import assert from "node:assert/strict";
import {randomBytes,randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import pg from "pg";
import {PgOrganizationIdentityLinks} from "../dist/iam-organization-adapters.js";
import {OrganizationContextAdmissionPilot} from "../dist/iam-organization-context-pilot.js";

const raw=process.env.SYNDES_IAM04_PG_URL;
const safe=(()=>{
 if(process.env.SYNDES_IAM04_DISPOSABLE_PG!=="IAM04B_PG17_ONLY"||!raw)return false;
 try{
  const url=new URL(raw);
  return url.protocol==="postgresql:"&&url.hostname==="127.0.0.1"&&
    url.pathname==="/postgres"&&url.username==="postgres"&&
    url.password==="ci-only-disposable-iam-ci";
 }catch{return false;}
})();
const {Client,Pool}=pg;
const transition="SELECT public.transition_platform_keycloak_org_link("+[
 "$1::uuid","$2::uuid","$3","$4::uuid","$5","$6::bigint","$7::uuid","$8","$9"
].join(",")+") AS revision";
const orgA=randomUUID(),orgB=randomUUID(),orgC=randomUUID();
const tenantA=randomUUID(),tenantB=randomUUID(),tenantSuspended=randomUUID();
const kcA=randomUUID(),kcB=randomUUID(),kcC=randomUUID();
const cmd=(tenant,organization,kc,state="active",expected=0,request=randomUUID())=>
 [tenant,organization,"syndes-iam-lab-ci",kc,state,expected,request,"trusted-ci-operator","synthetic rehearsal"];

test("IAM-04B manual Control schema: PostgreSQL 17 ACL, 1:1, CAS, audit, concurrency and revoke",
 {skip:!safe},async t=>{
  const admin=new Client({connectionString:raw});await admin.connect();
  const name="syndes_iam04b_"+randomBytes(6).toString("hex");
  let created=false,scoped,pool;
  try{
    const version=Number((await admin.query("SHOW server_version_num")).rows[0].server_version_num);
    assert.ok(version>=170000&&version<180000,"requires PG17");
    await admin.query('CREATE DATABASE "'+name+'"');created=true;
    const u=new URL(raw);u.pathname="/"+name;
    scoped=new Client({connectionString:u.toString()});await scoped.connect();
    await scoped.query("DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='syndes_core') THEN CREATE ROLE syndes_core NOLOGIN; END IF; END $$");
    const load=async f=>readFile(fileURLToPath(new URL("../../../infra/postgres/bootstrap/"+f,import.meta.url)),"utf8");
    await scoped.query(await load("control.schema"));
    const ddl=await load("control-iam-org-links.schema");
    await scoped.query(ddl);await scoped.query(ddl);
    const tenant=async(id,state)=>{
      const token=id.replaceAll("-","");
      await scoped.query("INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state) VALUES ($1,$2,$3,$4)",
        [id,"syndes_tenant_"+token,"syndes_t_"+token,state]);
    };
    for(const id of [tenantA,tenantB])await tenant(id,"active");
    await tenant(tenantSuspended,"suspended");
    pool=new Pool({connectionString:u.toString(),max:4});
    // Execute the SQL function only as the dedicated NOLOGIN operator role.
    const operator=async args=>{
      const client=await pool.connect();
      try{
        await client.query("SET ROLE syndes_iam_link_operator");
        return (await client.query(transition,args)).rows[0].revision;
      }finally{
        await client.query("RESET ROLE").catch(()=>{});
        client.release();
      }
    };
    await t.test("concurrent retries share one audit row, unique mapping and revision",async()=>{
      const command=cmd(tenantA,orgA,kcA);
      const results=await Promise.all(Array.from({length:6},()=>operator(command)));
      assert.deepEqual(results.map(Number),[1,1,1,1,1,1]);
      assert.equal((await scoped.query("SELECT count(*)::int n FROM public.platform_keycloak_org_link_audit")).rows[0].n,1);
      const reader=new PgOrganizationIdentityLinks(scoped);
      const a=await reader.findPlatform(tenantA,orgA);
      const b=await reader.findKeycloak("syndes-iam-lab-ci",kcA);
      assert.equal(a.length,1);
      assert.deepEqual(a,b);
      assert.equal(a[0].state,"active");
    });
    await t.test("tenant B cannot reuse Keycloak org A, nor rebind platform org A",async()=>{
      await assert.rejects(operator(cmd(tenantB,orgB,kcA)),e=>e.code==="23505");
      await assert.rejects(operator(cmd(tenantA,orgA,kcB)),e=>e.code==="23505");
      const replayWithDifferentPayload=cmd(tenantA,orgA,kcA,"active",0);
      replayWithDifferentPayload[8]="different reason";
      replayWithDifferentPayload[6]=(await scoped.query(
        "SELECT request_id FROM public.platform_keycloak_org_link_audit LIMIT 1")).rows[0].request_id;
      await assert.rejects(operator(replayWithDifferentPayload),e=>e.code==="23505");
      assert.equal((await scoped.query("SELECT count(*)::int n FROM public.platform_keycloak_org_links")).rows[0].n,1);
    });
    await t.test("tenant may hold many Keycloak orgs but a suspended tenant cannot provision",async()=>{
      assert.equal(Number(await operator(cmd(tenantA,orgB,kcB))),1);
      assert.equal((await scoped.query("SELECT count(*)::int n FROM public.platform_keycloak_org_links WHERE tenant_id=$1",[tenantA])).rows[0].n,2);
      await assert.rejects(operator(cmd(tenantSuspended,orgC,kcC)),e=>e.code==="23514");
      assert.deepEqual(await new PgOrganizationIdentityLinks(scoped).findPlatform(tenantB,orgA),[]);
    });
    await t.test("revocation with optimistic revision denies stale CAS and stale replay",async()=>{
      const revoke=cmd(tenantA,orgA,kcA,"revoked",1);
      assert.equal(Number(await operator(revoke)),2);
      assert.equal(Number(await operator(revoke)),2);
      const reader=new PgOrganizationIdentityLinks(scoped);
      assert.equal((await reader.findPlatform(tenantA,orgA))[0].state,"revoked");
      await assert.rejects(operator(cmd(tenantA,orgA,kcA,"active",1)),e=>e.code==="40001");
      assert.equal(Number(await operator(cmd(tenantA,orgA,kcA,"active",2))),3);
      await assert.rejects(operator(revoke),e=>e.code==="23514");
      assert.equal((await reader.findKeycloak("syndes-iam-lab-ci",kcA))[0].revision,3);
    });
    await t.test("audit is durable and least-privilege reader cannot mutate or grant",async()=>{
      const audit=await scoped.query("SELECT operation,previous_state,result_state,result_revision,actor_id FROM public.platform_keycloak_org_link_audit WHERE organization_id=$1 ORDER BY id",[orgA]);
      assert.deepEqual(audit.rows.map(x=>x.operation),["provisioned","revoked","reactivated"]);
      assert.deepEqual(audit.rows.map(x=>Number(x.result_revision)),[1,2,3]);
      await scoped.query("SET ROLE syndes_core");
      try{
        assert.equal((await scoped.query("SELECT count(*)::int n FROM public.platform_keycloak_org_links")).rows[0].n,2);
        await assert.rejects(scoped.query("DELETE FROM public.platform_keycloak_org_links"),e=>e.code==="42501");
        await assert.rejects(scoped.query("UPDATE public.platform_keycloak_org_links SET state='active'"),e=>e.code==="42501");
        await assert.rejects(scoped.query(transition,cmd(tenantB,orgC,kcC)),e=>e.code==="42501");
      }finally{await scoped.query("RESET ROLE");}
      await scoped.query("SET ROLE syndes_iam_link_operator");
      try{
        await assert.rejects(scoped.query("SELECT * FROM public.platform_keycloak_org_links"),e=>e.code==="42501");
        await assert.rejects(scoped.query("DELETE FROM public.platform_keycloak_org_link_audit"),e=>e.code==="42501");
      }finally{await scoped.query("RESET ROLE");}
    });
    await t.test("real Control link participates in trusted admission; revocation blocks live session",async()=>{
      const workspace=randomUUID(),actorId=randomUUID(),bearer="Bearer synthetic.signed.token";
      let consultedTenantDB=0;
      const pilot=new OrganizationContextAdmissionPilot({
        realm:"syndes-iam-lab-ci",clientId:"syndes-inbox-ui",multiOrganizationEnabled:false,
        verifier:{verifyClient:async(value,client)=>{
          assert.equal(value,bearer);assert.equal(client,"syndes-inbox-ui");
          return {kind:"user",id:actorId};
        }},
        tenancy:{canAccessTenant:async({tenantId})=>tenantId===tenantA},
        moduleAccess:{canExecuteModule:async()=>true},
        links:new PgOrganizationIdentityLinks(scoped),
        keycloakMembers:{isActiveMember:async(realm,org,sub)=>
          realm==="syndes-iam-lab-ci"&&org===kcA&&sub===actorId},
        tenantDatabases:{resolve:async(id)=>{
          consultedTenantDB++;
          return {tenantId:id,query:async(sql,values)=>{
            assert.match(sql,/platform_org_memberships/);
            assert.match(sql,/platform_workspace_memberships/);
            assert.match(sql,/platform_legacy_backfill_runs/);
            assert.deepEqual(values,[tenantA,actorId,orgA,workspace,false]);
            return {rows:[{organization_id:orgA,workspace_id:workspace,scope_write_allowed:true}],rowCount:1};
          }};
        }},
        funnelOwnership:{isActiveInWorkspace:async()=>false},
      });
      const request={tenantId:tenantA,organizationId:orgA,workspaceId:workspace,
        capability:"inbox.message.send"};
      assert.equal((await pilot.resolve(bearer,request)).moduleId,"inbox");
      assert.equal(consultedTenantDB,1);
      assert.equal(Number(await operator(cmd(tenantA,orgA,kcA,"revoked",3))),4);
      await assert.rejects(pilot.resolve(bearer,request),e=>e.name==="AccessDeniedError");
      assert.equal(consultedTenantDB,1,"revoked control link denies before tenant SQL");
      assert.equal(Number(await operator(cmd(tenantA,orgA,kcA,"active",4))),5);
      assert.equal((await pilot.resolve(bearer,request)).realm,"syndes-iam-lab-ci");
    });
    console.log("IAM04B_DISPOSABLE_PG17_ACL_CONCURRENCY_AUDIT_PASS");
  }finally{
    if(pool)await pool.end();
    if(scoped)await scoped.end();
    if(created)await admin.query('DROP DATABASE "'+name+'" WITH (FORCE)');
    await admin.end();
  }
});
