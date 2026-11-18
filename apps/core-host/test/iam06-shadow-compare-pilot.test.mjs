import test from "node:test";
import assert from "node:assert/strict";
import {
  Iam06ShadowComparePilot,
} from "../dist/iam06-shadow-compare-pilot.js";

const tenant="11111111-1111-4111-8111-111111111111";
const org="22222222-2222-4222-8222-222222222222";
const workspace="33333333-3333-4333-8333-333333333333";
const keycloakOrg="44444444-4444-4444-8444-444444444444";
const user="55555555-5555-4555-8555-555555555555";
const resourceId="66666666-6666-4666-8666-666666666666";
const scopeId="77777777-7777-4777-8777-777777777777";
const token="header.payload.signature";
const name="syndes:v1:tenant:"+tenant+":org:"+org+":workspace:"+workspace;
const context=Object.freeze({
  actor:Object.freeze({kind:"user",id:user}),
  tenantId:tenant,organizationId:org,workspaceId:workspace,
  keycloakOrganizationId:keycloakOrg,realm:"syndes-iam-lab-ci",
  capability:"inbox.conversation.read",moduleId:"inbox",
  resourceName:name,scopeWriteAllowed:true,
});
const mapped={id:resourceId,name,scopeId,scopeName:"inbox.conversation.read"};

function fixture(overrides={}){
  const metrics=[],calls=[];
  const deps={
    realm:"syndes-iam-lab-ci",
    fga:{canAccess:async(q)=>{
      calls.push({authority:"FGA",...q});
      return true;
    }},
    resources:{resolve:async(scope,capability)=>{
      calls.push({authority:"CATALOG",scope,capability});
      return {...mapped,scopeName:capability};
    }},
    uma:{check:async(q)=>{
      calls.push({authority:"UMA",...q});
      return true;
    }},
    metrics:{increment:category=>metrics.push(category)},
    timeoutMs:1000,
    maxPending:16,
    ...overrides,
  };
  return {calls,metrics,pilot:new Iam06ShadowComparePilot(deps)};
}

test("FGA alone controls allow; UMA is scheduled strictly AFTER the FGA decision",async()=>{
  const {pilot,calls,metrics}=fixture();
  assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),true);
  assert.equal(calls[0].authority,"FGA");
  await pilot.drainForTests();
  assert.deepEqual(calls.map(x=>x.authority),["FGA","CATALOG","UMA"]);
  assert.deepEqual(calls[0],{authority:"FGA",actor:context.actor,tenantId:tenant,
    resource:"inbox:conversations",action:"read"});
  assert.equal(calls[2].verifiedAccessToken,token);
  assert.deepEqual(calls[2].context,{tenantId:tenant,organizationId:org,
    workspaceId:workspace,kind:"workspace"});
  assert.deepEqual(metrics,["legacy_coarse_agree_allow"]);
  assert.equal(JSON.stringify(metrics).includes(token),false);
  assert.equal(JSON.stringify(metrics).includes(tenant),false);
});

test("four positive/negative matrices use fixed diagnostic categories only",async()=>{
  for(const [fga,uma,want] of [
    [true,true,"legacy_coarse_agree_allow"],
    [false,false,"legacy_coarse_agree_deny"],
    [true,false,"legacy_coarse_fga_allow_uma_deny"],
    [false,true,"legacy_coarse_fga_deny_uma_allow"],
  ]){
    const {pilot,metrics}=fixture({
      fga:{canAccess:async()=>fga},uma:{check:async()=>uma},
    });
    assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),fga,
      "UMA is never an effective authorization authority");
    await pilot.drainForTests();
    assert.deepEqual(metrics,[want]);
  }
});

test("UMA outage and malicious metric sink cannot alter an FGA allow or deny",async()=>{
  for(const effective of [true,false]){
    const {pilot,calls}=fixture({
      fga:{canAccess:async()=>{calls.push({authority:"FGA"});return effective;}},
      uma:{check:async()=>{throw Error("sensitive token secret");}},
      metrics:{increment:()=>{throw Error("sink down");}},
    });
    assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),effective);
    await pilot.drainForTests();
  }
});

test("realistic writing maps inbox.message.send to message write without widening claim or transfer",async()=>{
  const {pilot,calls,metrics}=fixture();
  const write=Object.freeze({...context,capability:"inbox.message.send"});
  assert.equal(await pilot.authorize({context:write,verifiedAccessToken:token}),true);
  await pilot.drainForTests();
  assert.equal(calls[0].resource,"inbox:messages");
  assert.equal(calls[0].action,"write");
  assert.equal(calls[2].capability,"inbox.message.send");
  assert.deepEqual(metrics,["legacy_coarse_agree_allow"]);
  // Read-only org/workspace membership must not become a write grant even if FGA allowed.
  const readOnly=Object.freeze({...write,scopeWriteAllowed:false});
  assert.equal(await pilot.authorize({context:readOnly,verifiedAccessToken:token}),false);
  assert.equal(calls.filter(x=>x.authority==="FGA").length,1);
  assert.equal(metrics.at(-1),"not_comparable");
});

test("PROPOSED claim/transfer/funnel cannot silently borrow coarse FGA write/read",async()=>{
  const {pilot,calls,metrics}=fixture();
  for(const capability of [
    "inbox.conversation.claim","inbox.conversation.transfer",
    "service.funnel.operate",
  ]){
    const selected=Object.freeze({...context,capability,
      ...(capability.startsWith("service.")?{moduleId:"service"}:{})});
    assert.equal(await pilot.authorize({context:selected,verifiedAccessToken:token}),false);
  }
  assert.deepEqual(calls,[]);
  assert.deepEqual(metrics,Array(3).fill("not_comparable"));
});

test("invalid or cross-org resource mapping cannot trigger UMA",async()=>{
  const {pilot,calls,metrics}=fixture({
    resources:{resolve:async()=>({...mapped,name:"syndes:v1:tenant:"+tenant+
      ":org:99999999-9999-4999-8999-999999999999:workspace:"+workspace})},
  });
  assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),true);
  await pilot.drainForTests();
  assert.ok(calls.every(x=>x.authority!=="UMA"));
  assert.deepEqual(metrics,["catalog_unmapped"]);
});

test("spoofed manager/client/token/tenant/actor or wrong workspace scope denies before FGA",async()=>{
  const {pilot,calls,metrics}=fixture();
  for(const candidate of [
    {...context,actor:{kind:"service",id:user}},
    {...context,actor:{kind:"user",id:"not-a-uuid"}},
    {...context,tenantId:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"},
    {...context,realm:"other"},
    {...context,resourceName:"syndes:v1:tenant:"+tenant+":org:"+org+
      ":workspace:88888888-8888-4888-8888-888888888888"},
    {...context,moduleId:"service"},
    {...context,actor:{kind:"user",id:"not-uuid"}},
  ]){
    assert.equal(await pilot.authorize({
      context:Object.freeze(candidate),verifiedAccessToken:token,
    }),false);
  }
  assert.equal(await pilot.authorize({context,verifiedAccessToken:"garbage"}),false);
  assert.deepEqual(calls,[]);
  assert.deepEqual(metrics,Array(8).fill("not_comparable"));
});

test("FGA failure or malformed FGA decision denies, never calls UMA",async()=>{
  for(const bad of [undefined,true]){
    const {pilot,metrics,calls}=fixture({
      fga:{canAccess:async()=>{if(bad)throw Error("FGA network unavailable");return {allowed:true};}},
    });
    assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),false);
    await pilot.drainForTests();
    assert.deepEqual(metrics,["fga_error"]);
    assert.deepEqual(calls,[]);
  }
});

test("UMA slow/outage: authorization returns immediately and shadow deadline contains hang",async()=>{
  const {pilot,metrics}=fixture({
    timeoutMs:25,
    resources:{resolve:async()=>new Promise(()=>{})},
  });
  assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),true);
  await pilot.drainForTests();
  assert.deepEqual(metrics,["shadow_error"]);
});

test("bounded async capacity skips observation, never changes effective FGA authorization",async()=>{
  let release;
  const parked=new Promise(resolve=>{release=resolve});
  const {pilot,calls,metrics}=fixture({
    maxPending:1,
    resources:{resolve:async()=>parked.then(()=>mapped)},
  });
  assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),true);
  assert.equal(await pilot.authorize({context,verifiedAccessToken:token}),true);
  assert.equal(calls.filter(x=>x.authority==="FGA").length,2);
  assert.deepEqual(metrics,["shadow_capacity_skipped"]);
  release();
  await pilot.drainForTests();
  assert.deepEqual(metrics,["shadow_capacity_skipped","legacy_coarse_agree_allow"]);
});

test("configuration rejects invalid realm and unbounded pending/timeout budgets",()=>{
  assert.throws(()=>fixture({realm:"bad realm"}),/configuration invalid/);
  assert.throws(()=>fixture({maxPending:10000}),/configuration invalid/);
  assert.throws(()=>fixture({timeoutMs:100000}),/configuration invalid/);
});
