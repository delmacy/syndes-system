import assert from "node:assert/strict";
import test from "node:test";
import {AccessDeniedError} from "../../../packages/core-kernel/dist/index.js";
import {OrganizationContextAdmissionPilot} from "../dist/iam-organization-context-pilot.js";

const tenant="11111111-1111-4111-8111-111111111111";
const organization="22222222-2222-4222-8222-222222222222";
const workspace="33333333-3333-4333-8333-333333333333";
const identityOrg="44444444-4444-4444-8444-444444444444";
const actorId="55555555-5555-4555-8555-555555555555";
const other="66666666-6666-4666-8666-666666666666";
const link=Object.freeze({realm:"syndes",keycloakOrganizationId:identityOrg,
  tenantId:tenant,organizationId:organization,state:"active",revision:1});
const request={tenantId:tenant,organizationId:organization,workspaceId:workspace,
  capability:"inbox.conversation.read"};
const bearer="Bearer ci.signed.token";

function environment(overrides={}){
  const calls=[];
  const db={tenantId:tenant,query:async(sql,values)=>{
    calls.push("sql");
    assert.match(sql,/platform_org_memberships/);
    assert.match(sql,/platform_workspace_memberships/);
    assert.match(sql,/platform_legacy_backfill_runs/);
    assert.deepEqual(values,[tenant,actorId,organization,workspace,false]);
    return {rows:[{organization_id:organization,workspace_id:workspace,scope_write_allowed:true}],rowCount:1};
  }};
  const deps={
    realm:"syndes",clientId:"syndes-inbox-ui",multiOrganizationEnabled:false,
    verifier:{verifyClient:async(h,c)=>{
      calls.push("verify");assert.equal(h,bearer);assert.equal(c,"syndes-inbox-ui");
      return {id:actorId,kind:"user"};
    }},
    tenancy:{canAccessTenant:async(q)=>{
      calls.push("tenant");assert.equal(q.actor.id,actorId);assert.equal(q.tenantId,tenant);
      return true;
    }},
    moduleAccess:{canExecuteModule:async(q)=>{
      calls.push("module");assert.equal(q.tenantId,tenant);return true;
    }},
    links:{
      findPlatform:async(t,o)=>{calls.push("platform-link");assert.equal(t,tenant);assert.equal(o,organization);return [link];},
      findKeycloak:async(realm,id)=>{
        calls.push("identity-link");assert.equal(realm,"syndes");assert.equal(id,identityOrg);return [link];
      },
    },
    keycloakMembers:{isActiveMember:async(realm,org,sub)=>{
      calls.push("keycloak-member");
      assert.deepEqual([realm,org,sub],["syndes",identityOrg,actorId]);
      return true;
    }},
    tenantDatabases:{resolve:async(id)=>{calls.push("database");assert.equal(id,tenant);return db;}},
    funnelOwnership:{isActiveInWorkspace:async(q)=>{
      calls.push("funnel");
      assert.deepEqual(q,{tenantId:tenant,organizationId:organization,workspaceId:workspace,funnelId:other});
      return true;
    }},
  };
  // Overrides at boundary-level so test cases cannot skip the source contract.
  for(const [key,value] of Object.entries(overrides))deps[key]=value;
  return {calls,deps,pilot:new OrganizationContextAdmissionPilot(deps)};
}

async function denied(pilot,req=request){
  await assert.rejects(pilot.resolve(bearer,req),e=>e instanceof AccessDeniedError);
}

test("signed actor, tenant, module, reciprocal org link and live member precede tenant database",async()=>{
  const {pilot,calls}=environment();
  const result=await pilot.resolve(bearer,request);
  assert.deepEqual(calls,["verify","tenant","module","platform-link","identity-link",
    "keycloak-member","database","sql"]);
  assert.equal(result.actor.id,actorId);
  assert.equal(result.realm,"syndes");
  assert.equal(result.keycloakOrganizationId,identityOrg);
  assert.equal(result.moduleId,"inbox");
  assert.equal(result.resourceName,
    "syndes:v1:tenant:"+tenant+":org:"+organization+":workspace:"+workspace);
  assert.equal(result.scopeWriteAllowed,true);
  assert.ok(Object.isFrozen(result));
  assert.ok(!JSON.stringify(result).includes("ci.signed.token"));
});

test("service funnel requires write and business owner check in exact workspace",async()=>{
  const {pilot,calls}=environment();
  const result=await pilot.resolve(bearer,{...request,capability:"service.funnel.operate",funnelId:other});
  assert.equal(result.moduleId,"service");
  assert.ok(calls.includes("funnel"));
  assert.equal(result.resourceName,"syndes:v1:tenant:"+tenant+":org:"+organization+
    ":workspace:"+workspace+":funnel:"+other);
});

test("no tenant or module entitlement -> no identity mapping and no database read",async()=>{
  for(const what of ["tenancy","moduleAccess"]){
    const {pilot,calls}=environment({
      ...(what==="tenancy"?{tenancy:{canAccessTenant:async()=>false}}:
        {moduleAccess:{canExecuteModule:async()=>false}}),
    });
    await denied(pilot);
    assert.ok(!calls.includes("platform-link"));
    assert.ok(!calls.includes("database"));
  }
});

test("wrong or unverified actor/manager token cannot enter",async()=>{
  for(const actor of [{id:"",kind:"user"},{id:other,kind:"service"},{id:"other",kind:"user"}]){
    const {pilot,calls}=environment({verifier:{verifyClient:async()=>actor}});
    await denied(pilot);
    assert.equal(calls.includes("database"),false);
  }
  const {pilot}=environment({verifier:{verifyClient:async()=>{throw Error("JWT verification failed")}}});
  await denied(pilot);
  assert.throws(()=>new OrganizationContextAdmissionPilot({
    ...environment().deps,clientId:"syndes-master-admin"
  }),/configuration invalid/);
});

test("identity binding is reciprocal, immutable, unique and ACTIVE",async()=>{
  for(const forged of [
    {...link,state:"revoked"}, {...link,tenantId:other}, {...link,organizationId:other},
    {...link,realm:"another"}, {...link,keycloakOrganizationId:"short"},
    {...link,revision:0}, {...link,revision:2},
  ]){
    const {pilot,calls}=environment({
      links:{
        findPlatform:async()=>{calls.push("platform-link");return [forged];},
        findKeycloak:async()=>{calls.push("identity-link");return [link];},
      }
    });
    await denied(pilot);
    assert.equal(calls.includes("database"),false);
  }
  for(const records of [[],[link,link]]){
    const {pilot,calls}=environment({links:{
      findPlatform:async()=>records,findKeycloak:async()=>[link]}});
    await denied(pilot);
    assert.equal(calls.includes("database"),false);
  }
  for(const records of [[],[link,link],[{...link,tenantId:other}],
    [{...link,revision:2}]]){
    const {pilot,calls}=environment({links:{
      findPlatform:async()=>[link],findKeycloak:async()=>records}});
    await denied(pilot);
    assert.equal(calls.includes("database"),false);
  }
});

test("revoked Keycloak Organization member denies before tenant DB even with retained UMA grants",async()=>{
  const {pilot,calls}=environment({
    keycloakMembers:{isActiveMember:async()=>{calls.push("keycloak-member");return false;}}
  });
  await denied(pilot);
  assert.equal(calls.includes("database"),false);
  const unavailable=environment({
    keycloakMembers:{isActiveMember:async()=>{throw Error("Keycloak unreachable");}}
  });
  await denied(unavailable.pilot);
});

test("viewer can read but cannot send, claim or transfer",async()=>{
  const {deps}=environment();
  const readonlyDB={
    ...deps.tenantDatabases,
    resolve:async()=>({tenantId:tenant,query:async()=>({
      rows:[{organization_id:organization,workspace_id:workspace,scope_write_allowed:false}],
      rowCount:1
    })})
  };
  const {pilot}=environment({tenantDatabases:readonlyDB});
  assert.equal((await pilot.resolve(bearer,request)).scopeWriteAllowed,false);
  for(const capability of ["inbox.message.send","inbox.conversation.claim",
    "inbox.conversation.transfer"]){
    await denied(pilot,{...request,capability});
  }
});

test("missing or foreign workspace, tenant database mismatch and SQL outage deny",async()=>{
  const failDB=async(db)=>environment({tenantDatabases:{resolve:async()=>db}});
  await denied((await failDB({tenantId:other,query:async()=>({rows:[],rowCount:0})})).pilot);
  await denied((await failDB({tenantId:tenant,query:async()=>({rows:[],rowCount:0})})).pilot);
  await denied((await failDB({tenantId:tenant,query:async()=>{throw Error("SQL unavailable")}})).pilot);
  await denied((await failDB({tenantId:tenant,query:async()=>({
    rows:[{organization_id:other,workspace_id:workspace,scope_write_allowed:true}],
    rowCount:1
  })})).pilot);
});

test("funnel is mandatory and must belong to active organization/workspace",async()=>{
  const {pilot,calls}=environment();
  await denied(pilot,{...request,capability:"service.funnel.operate"});
  await denied(pilot,{...request,capability:"service.funnel.operate",funnelId:"not-uuid"});
  await denied(pilot,{...request,funnelId:other});
  assert.equal(calls.includes("database"),false);
  await denied(environment({
    funnelOwnership:{isActiveInWorkspace:async()=>false}
  }).pilot,{...request,capability:"service.funnel.operate",funnelId:other});
});

test("malformed resource identifiers and unknown capabilities fail without contacting providers",async()=>{
  for(const changed of [
    {...request,tenantId:"../evil"},
    {...request,organizationId:""},
    {...request,workspaceId:"other"},
    {...request,capability:"inbox.privilege.admin"},
    null,
  ]){
    const {pilot,calls}=environment();
    await denied(pilot,changed);
    assert.deepEqual(calls,[]);
  }
});

test("provider failures fail closed and do not return or log JWT",async()=>{
  for(const key of ["tenancy","moduleAccess","links","tenantDatabases"]){
    const failing={
      tenancy:{canAccessTenant:async()=>{throw Error("secret-internal");}},
      moduleAccess:{canExecuteModule:async()=>{throw Error("secret-internal");}},
      links:{findPlatform:async()=>{throw Error("secret-internal");}},
      tenantDatabases:{resolve:async()=>{throw Error("secret-internal");}},
    };
    await denied(environment({[key]:failing[key]}).pilot);
  }
});
