import {runIam07d2FineFgaLiveLab} from "./iam07d2-fine-fga-live-ci.mjs";
import {runIam07cNestHttpLab} from "./iam07c-nest-http-ci.mjs";
import {runIam07bProviderRecoveryLab} from "./iam07b-provider-recovery-ci.mjs";
import {runIam07SseLiveLab} from "./iam07-sse-live-ci.mjs";
/**
 * IAM-06B: ONE verified HUMAN bearer + live Keycloak Org membership + real
 * PG17 Control / separately selected tenant DB + real OpenFGA v1.22 + UMA.
 * Disposable CI only. No Host runtime wiring or operational realm migration.
 */
import assert from "node:assert/strict";
import {mkdtemp,readFile,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createRequire} from "node:module";
import {randomUUID} from "node:crypto";
import {fileURLToPath} from "node:url";
import {ActorVerifier,PgMembership,FgaPermission,fgaResourceObject}
  from "../../apps/core-host/dist/adapters.js";
import {PgOrganizationIdentityLinks,KeycloakServiceAccountTokens,
  KeycloakOrganizationMembershipReader}
  from "../../apps/core-host/dist/iam-organization-adapters.js";
import {OrganizationContextAdmissionPilot}
  from "../../apps/core-host/dist/iam-organization-context-pilot.js";
import {KeycloakUmaAuthorizationPilot,pilotResourceName}
  from "../../apps/core-host/dist/keycloak-authorization-pilot.js";
import {Iam06ShadowComparePilot}
  from "../../apps/core-host/dist/iam06-shadow-compare-pilot.js";
import {PgModuleCatalog} from "../../apps/core-host/dist/module-catalog.js";
import {PgModuleLifecycle} from "../../apps/core-host/dist/module-lifecycle.js";
import {PgEffectiveModuleAccess} from "../../apps/core-host/dist/module-effective-access.js";
import {resolveRegistry,expectedTenantDatabase}
  from "../../apps/core-host/dist/tenant-database.js";

const require=createRequire(new URL("../../apps/core-host/package.json",import.meta.url));
const {Pool}=require("pg");
const CONTROL="postgresql://postgres:ci-only-disposable@127.0.0.1:15432/syndes_control";
const ROOT="http://127.0.0.1:18088";
const FGA="http://127.0.0.1:18089";
const REALM="syndes-iam-lab-ci";
const ISSUER="https://id.ci.syndes.invalid/realms/"+REALM;
const CLIENT="syndes-iam-lab-ui";
const POLICY="syndes-policy-api";
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const transition="SELECT public.transition_platform_keycloak_org_link("+
  "$1::uuid,$2::uuid,$3,$4::uuid,$5,$6::bigint,$7::uuid,$8,$9) AS revision";

function disposableOnly(args){
  assert.equal(process.env.CI_MASTER_REAL_PG,"1");
  assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
  assert.equal(args.base,ROOT);
  assert.equal(args.realm,REALM);
  assert.equal(args.policyClient,POLICY);
  assert.equal(args.uiClient,CLIENT);
  assert.equal(args.tenant,TENANT);
  assert.equal(args.alpha,ORG);
  assert.equal(args.workspaceA,WS);
  assert.ok(args.orgs?.a&&args.orgs?.b);
  assert.match(args.alice,/^[a-f0-9-]{36}$/);
  assert.match(args.atAlice,/^[\w-]+\.[\w-]+\.[\w-]+$/);
  assert.ok(typeof args.readerSecret==="string"&&args.readerSecret.length>12);
}

async function fga(method,path,body){
  const response=await fetch(FGA+path,{
    method,headers:{"Content-Type":"application/json"},
    body:body===undefined?undefined:JSON.stringify(body),
    signal:AbortSignal.timeout(5000),redirect:"error",cache:"no-store",
  });
  if(!response.ok)throw Error("IAM06B_FGA_HTTP_"+response.status);
  return response.status===204?{}:response.json();
}
async function keycloakMemberChange(action,org,user,token){
  const path="/admin/realms/"+REALM+"/organizations/"+org+"/members"+
    (action==="DELETE"?"/"+user:"");
  const response=await fetch(ROOT+path,{
    method:action,headers:{
      Authorization:"Bearer "+token,Accept:"application/json",
      ...(action==="POST"?{"Content-Type":"application/json"}:{}),
    },
    body:action==="POST"?JSON.stringify(user):undefined,
    signal:AbortSignal.timeout(10000),redirect:"error",cache:"no-store",
  });
  if(![200,201,204].includes(response.status))
    throw Error("IAM06B_KC_LAB_MEMBERSHIP_HTTP_"+response.status);
}
async function op(control,args){
  const client=await control.connect();
  try{
    await client.query("BEGIN");
    await client.query("SET LOCAL ROLE syndes_iam_link_operator");
    const result=await client.query(transition,args);
    await client.query("COMMIT");
    return Number(result.rows[0].revision);
  }catch{
    await client.query("ROLLBACK").catch(()=>{});
    throw Error("IAM06B_CONTROL_LINK_TRANSITION_DENIED");
  }finally{client.release();}
}
export async function runIam06bLab(args){
  disposableOnly(args);
  const dbName=expectedTenantDatabase(TENANT).database_name;
  const tenantUrl="postgresql://postgres:ci-only-disposable@127.0.0.1:15432/"+dbName;
  const control=new Pool({connectionString:CONTROL,max:4});
  const admin=new Pool({
    connectionString:"postgresql://postgres:ci-only-disposable@127.0.0.1:15432/postgres",
  });
  let tenantDb;
  let created=false;
  const temp=await mkdtemp(join(tmpdir(),"syndes-iam06b-ci-"));
  try{
    assert.equal(Number((await control.query("SHOW server_version_num")).rows[0].server_version_num)>=170000,true);
    // Only disposable CI Control DB; schema explicitly MANUAL in production.
    const root=fileURLToPath(new URL("../../infra/postgres/bootstrap/",import.meta.url));
    for(const path of [
      "control-iam-org-links.schema",
      "control-module-catalog.schema",
      "control-module-lifecycle.schema",
    ]){
      await control.query(await readFile(join(root,path),"utf8"));
    }

    await admin.query('CREATE DATABASE "'+dbName+'"');
    created=true;
    tenantDb=new Pool({connectionString:tenantUrl,max:4});
    const tenantSql=fileURLToPath(new URL("../../modules/organizations/sql/",import.meta.url));
    for(const path of ["001_account_hierarchy.sql","002_legacy_single_context_gate.sql"]){
      await tenantDb.query(await readFile(join(tenantSql,path),"utf8"));
    }
    // Exact backfill ledger DDL lifted from existing migration 003; the full
    // CRM/Inbox/WhatsApp ownership migration is NOT claimed as exercised.
    const migration003=await readFile(join(tenantSql,"003_legacy_ownership.sql"),"utf8");
    const ledger=migration003.match(/CREATE TABLE IF NOT EXISTS platform_legacy_backfill_runs\([\s\S]*?\);\s*CREATE INDEX IF NOT EXISTS platform_legacy_backfill_runs_by_tenant[\s\S]*?;/);
    assert.ok(ledger,"IAM06B_BACKFILL_LEDGER_CONTRACT_MISSING");
    await tenantDb.query(ledger[0]);

    const expected=expectedTenantDatabase(TENANT);
    await control.query(
      "INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) VALUES($1,$2,$3,'active')",
      [TENANT,expected.database_name,expected.role_name]);
    await control.query("INSERT INTO tenant_memberships(tenant_id,principal_id,state) VALUES"+
      "($1,$2,'active'),($1,$3,'active')",[TENANT,args.alice,args.bob]);

    const trusted=[{id:"inbox",version:"0.1.0",schema:"inbox",dependencies:[]}];
    await control.query("INSERT INTO module_catalog(module_id,schema_name) VALUES('inbox','inbox')");
    await control.query("INSERT INTO module_catalog_versions(module_id,version,approved,approved_at,approved_by)"+
      " VALUES('inbox','0.1.0',true,now(),'disposable-ci')");
    await control.query("INSERT INTO tenant_module_entitlements(tenant_id,module_id,state)"+
      " VALUES($1,'inbox','granted')",[TENANT]);
    await control.query("INSERT INTO tenant_module_installs(tenant_id,module_id,target_version,state,"+
      "installed_version,verification_digest,verified_at) VALUES($1,'inbox','0.1.0','enabled',"+
      "'0.1.0',$2,now())",[TENANT,"a".repeat(64)]);
    const moduleGate=new PgEffectiveModuleAccess(new PgModuleLifecycle(
      control,new PgModuleCatalog(control,trusted)));

    await tenantDb.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default)"+
      " VALUES($1,$2,'CI Organization',true)",[TENANT,ORG]);
    await tenantDb.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default)"+
      " VALUES($1,$2,$3,'CI Workspace','default',true)",[TENANT,WS,ORG]);
    for(const [principal,role] of [[args.alice,"editor"],[args.bob,"viewer"]]){
      await tenantDb.query("INSERT INTO platform_org_memberships"+
        "(tenant_id,organization_id,principal_id,role) VALUES($1,$2,$3,$4)",
        [TENANT,ORG,principal,role]);
      await tenantDb.query("INSERT INTO platform_workspace_memberships"+
        "(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,$4,$5)",
        [TENANT,ORG,WS,principal,role]);
    }
    await tenantDb.query("INSERT INTO platform_legacy_backfill_runs"+
      "(tenant_id,organization_id,actor_id,counts) VALUES($1,$2,'disposable-ci','{}'::jsonb)",
      [TENANT,ORG]);
    // SQL002 remains ACTIVE: a second org in the same tenant is refused by PG.
    await assert.rejects(tenantDb.query(
      "INSERT INTO platform_organizations(tenant_id,id,display_name) VALUES($1,$2,'Forbidden')",
      [TENANT,randomUUID()]),e=>e.code==="23505");

    const linkRequest=(state,rev)=>[
      TENANT,ORG,REALM,args.orgs.a,state,rev,randomUUID(),
      "ci-trusted-operator","IAM06B synthetic linkage",
    ];
    assert.equal(await op(control,linkRequest("active",0)),1);
    const links=new PgOrganizationIdentityLinks(control);
    assert.equal((await links.findPlatform(TENANT,ORG))[0].state,"active");

    const secretPath=join(temp,"read-only-service");
    await writeFile(secretPath,args.readerSecret,{mode:0o600});
    const source=new KeycloakServiceAccountTokens(ROOT,REALM,
      args.readerClient,secretPath);
    const members=new KeycloakOrganizationMembershipReader(ROOT,REALM,source);
    const verifier=new ActorVerifier(ISSUER,"syndes-core",
      ROOT+"/realms/"+REALM+"/protocol/openid-connect/certs");
    // IAM03 previously revoked Alice; re-add only in the disposable realm.
    await keycloakMemberChange("POST",args.orgs.a,args.alice,args.adminToken);

    const provider={resolve:async id=>{
      const registry=await resolveRegistry(control,id);
      assert.equal(registry.database_name,dbName);
      const database=await tenantDb.query("SELECT current_database() AS name");
      assert.equal(database.rows[0].name,dbName);
      return {tenantId:id,query:async(sql,values)=>{
        const r=await tenantDb.query(sql,[...values]);
        return {rows:r.rows,rowCount:r.rowCount};
      }};
    }};
    const admission=new OrganizationContextAdmissionPilot({
      realm:REALM,clientId:CLIENT,multiOrganizationEnabled:false,
      verifier,tenancy:new PgMembership(control),links,keycloakMembers:members,
      moduleAccess:moduleGate,tenantDatabases:provider,
      funnelOwnership:{isActiveInWorkspace:async()=>false},
    });
    const request=(capability="inbox.conversation.read")=>({
      tenantId:TENANT,organizationId:ORG,workspaceId:WS,capability,
    });
    const bearer="Bearer "+args.atAlice;
    assert.equal((await admission.resolve(bearer,request())).actor.id,args.alice);
    assert.equal((await admission.resolve(bearer,request("inbox.message.send"))).scopeWriteAllowed,true);
    await assert.rejects(admission.resolve("Bearer "+args.atBob,request()),
      e=>e.name==="AccessDeniedError",
      "Bob is a SQL viewer and tenant member but not a Keycloak Alpha org member");
    await assert.rejects(admission.resolve("Bearer "+args.adminAccess,request()),
      e=>e.name==="AccessDeniedError",
      "A Master token with different issuer cannot cross into tenant IAM");
    await assert.rejects(admission.resolve(bearer,{
      ...request(),organizationId:"33333333-3333-4333-8333-333333333333",
    }),e=>e.name==="AccessDeniedError");

    const store=await fga("POST","/stores",{name:"iam06b-ephemeral-"+randomUUID()});
    assert.ok(typeof store.id==="string"&&store.id.length>8);
    const model=JSON.parse(await readFile(fileURLToPath(
      new URL("../../infra/security-access/fga-model.json",import.meta.url)),"utf8"));
    const installed=await fga("POST","/stores/"+store.id+"/authorization-models",model);
    assert.ok(installed.authorization_model_id);
    const tuples=[
      {user:"user:"+args.alice,relation:"viewer",
        object:fgaResourceObject(TENANT,"inbox:conversations")},
      {user:"user:"+args.alice,relation:"editor",
        object:fgaResourceObject(TENANT,"inbox:messages")},
    ];
    await fga("POST","/stores/"+store.id+"/write",{writes:{tuple_keys:tuples}});
    const fgaAdapter=new FgaPermission(FGA,store.id,"ci-disposable-only");
    const uma=new KeycloakUmaAuthorizationPilot(
      ROOT+"/realms/"+REALM+"/protocol/openid-connect/token",POLICY);
    const trustedName=pilotResourceName({
      tenantId:TENANT,organizationId:ORG,workspaceId:WS,kind:"workspace"});
    const resources={resolve:async(scope,cap)=>{
      if(pilotResourceName(scope)!==trustedName)return null;
      const id=args.resources[trustedName],scopeId=args.scopes[cap];
      return id&&scopeId?{id,name:trustedName,scopeId,scopeName:cap}:null;
    }};
    const counters=[];
    const shadow=new Iam06ShadowComparePilot({
      realm:REALM,fga:fgaAdapter,uma,resources,
      metrics:{increment:category=>counters.push(category)},
    });
    const authorize=async(capability="inbox.conversation.read")=>{
      const verified=await admission.resolve(bearer,request(capability));
      const allowed=await shadow.authorize({context:verified,
        verifiedAccessToken:args.atAlice});
      await shadow.drainForTests();
      return allowed;
    };
    assert.equal(await authorize(),true);
    assert.equal(await authorize("inbox.message.send"),true);
    assert.deepEqual(counters.slice(-2),[
      "legacy_coarse_agree_allow","legacy_coarse_agree_allow"]);

    // IAM-07A: same signed Keycloak user, real SSE event bus + source
    // revalidation against Keycloak, Control, tenant PG17 and OpenFGA.
    await runIam07SseLiveLab({
      admission,fgaAdapter,bearer,request:request(),
      control,tenantDb,alice:args.alice,
      memberOrgId:args.orgs.a,adminToken:args.adminToken,
      tuples,storeId:store.id,fgaWrite:fga,
      linkTransition:op,linkRequest,changeMembership:keycloakMemberChange,
    });
    // IAM-07B qualification: individually force each real provider transport
    // to a closed loopback port and restore it. The old SSE never resurrects.
    await runIam07bProviderRecoveryLab({
      verifier,tenancy:new PgMembership(control),moduleGate,
      control,tenantDb,provider,source,storeId:store.id,
      links,memberReader:members,bearer,actorId:args.alice,
    });
    // IAM-07C: genuine Nest HTTP ingress, identical signed bearer, live
    // Keycloak Organizations, Control/tenant PostgreSQL, and real FGA.
    // Read-only candidate endpoint lives in a disposable-only Nest module;
    // it is never registered on the operational Core Host.
    await runIam07cNestHttpLab({
      bearer,userToken:args.atAlice,otherOrgToken:args.atBob,
      managerToken:args.adminAccess,verifier,admission,fgaAdapter,
      tenantDb,control,alice:args.alice,storeId:store.id,
      readTuple:tuples[0],fgaWrite:fga,
      orgId:args.orgs.a,adminToken:args.adminToken,
      changeMembership:keycloakMemberChange,
    });
    // IAM-07D2: independent fine OpenFGA resource with no coarse inheritance.
    // Same signed Keycloak bearer, Control/tenant PG17 and SQL002 fixture.
    await runIam07d2FineFgaLiveLab({
      bearer,atAlice:args.atAlice,actorId:args.alice,
      verifier,userToken:args.atAlice,otherOrgToken:args.atBob,
      managerToken:args.adminAccess,
      admission,tenantDb,control,fgaWrite:fga,
      changeMembership:keycloakMemberChange,orgId:args.orgs.a,
      adminToken:args.adminToken,
    });

    // Real FGA revoke while UMA user policy remains ALLOW: the request DENIES.
    await fga("POST","/stores/"+store.id+"/write",
      {deletes:{tuple_keys:[tuples[0]]}});
    assert.equal(await authorize(),false);
    assert.equal(counters.at(-1),"legacy_coarse_fga_deny_uma_allow");
    await fga("POST","/stores/"+store.id+"/write",
      {writes:{tuple_keys:[tuples[0]]}});

    // Real SQL viewer downgrade denies writing BEFORE FGA/UMA; can still read.
    await tenantDb.query("UPDATE platform_workspace_memberships SET role='viewer'"+
      " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,args.alice]);
    await assert.rejects(admission.resolve(bearer,request("inbox.message.send")),
      e=>e.name==="AccessDeniedError");
    assert.equal(await authorize(),true);
    await tenantDb.query("UPDATE platform_workspace_memberships SET role='editor'"+
      " WHERE tenant_id=$1 AND principal_id=$2",[TENANT,args.alice]);

    // Real module entitlement disable, then re-enable.
    await control.query("UPDATE tenant_module_entitlements SET state='suspended'"+
      " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]);
    await assert.rejects(admission.resolve(bearer,request()),
      e=>e.name==="AccessDeniedError");
    await control.query("UPDATE tenant_module_entitlements SET state='granted'"+
      " WHERE tenant_id=$1 AND module_id='inbox'",[TENANT]);

    // Real immutable link revocation, then operator-driven reactivation.
    // IAM-07 may also have exercised revocation in this same disposable
    // Control database, so use the actual current revision rather than
    // assuming the initial IAM-06B candidate has never been modified.
    const priorRevision=(await links.findPlatform(TENANT,ORG))[0].revision;
    assert.equal(await op(control,linkRequest("revoked",priorRevision)),priorRevision+1);
    await assert.rejects(admission.resolve(bearer,request()),
      e=>e.name==="AccessDeniedError");
    assert.equal(await op(control,linkRequest("active",priorRevision+1)),priorRevision+2);

    // Real revocation DURING THE SAME VALID USER JWT session: no SQL read or
    // FGA check is allowed to revive membership. UMA grant may still be TRUE.
    await keycloakMemberChange("DELETE",args.orgs.a,args.alice,args.adminToken);
    assert.equal(await members.isActiveMember(REALM,args.orgs.a,args.alice),false);
    await assert.rejects(admission.resolve(bearer,request()),
      e=>e.name==="AccessDeniedError");
    const resource={id:args.resources[trustedName],name:trustedName,
      scopeId:args.scopes["inbox.conversation.read"],
      scopeName:"inbox.conversation.read"};
    assert.equal(await uma.check({
      verifiedAccessToken:args.atAlice,
      context:{tenantId:TENANT,organizationId:ORG,workspaceId:WS,kind:"workspace"},
      capability:"inbox.conversation.read",keycloakResource:resource,
    }),true,"Policy-alone UMA may stay ALLOW after removing membership");
    assert.ok(counters.length>=4);
    assert.ok(counters.every(c=>typeof c==="string"&&!c.includes(TENANT)&&
      !c.includes(args.alice)&&!c.includes(args.atAlice)));
    console.log("IAM06B_REAL_JWT_CONTROL_PG17_TENANT_SQL002_OPENFGA_KEYCLOAK_PASS");
    console.log("IAM06B_REAL_FGA_DENY_UMA_ALLOW_AND_LIVE_REVOCATION_PASS");
  }finally{
    if(tenantDb)await tenantDb.end();
    // IAM-07 uses long-lived SSE rechecks. Never FORCE-kill idle PostgreSQL
    // clients at teardown: doing so can emit an unhandled pool 'error' and
    // hide an open lease. Plain DROP fails visibly if a session leaked.
    if(created)await admin.query('DROP DATABASE "'+dbName+'"');
    await admin.end();
    await control.end();
    await rm(temp,{force:true,recursive:true});
  }
}
