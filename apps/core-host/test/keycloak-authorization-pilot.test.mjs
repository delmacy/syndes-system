import assert from "node:assert/strict";
import test from "node:test";
import {KeycloakUmaAuthorizationPilot,pilotResourceName} from "../dist/keycloak-authorization-pilot.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="95911ac4-b793-4283-97b2-f118974bb8b0";
const C="2f48e5a9-a0dd-41b4-8d5e-5a36622b2c10";
const D="a877dd36-89ed-4088-8fc7-de2fd334c8e0";
const token="eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJzYW1wbGUifQ.signature";
const endpoint="https://iam.example.invalid/realms/syndes/protocol/openid-connect/token";
const workspace={tenantId:A,organizationId:B,workspaceId:C,kind:"workspace"};
const funnel={...workspace,kind:"funnel",funnelId:D};
const resource={id:A,scopeId:B,name:pilotResourceName(workspace),scopeName:"inbox.conversation.read"};
const input={verifiedAccessToken:token,context:workspace,capability:"inbox.conversation.read",keycloakResource:resource};
const mk=(send)=>new KeycloakUmaAuthorizationPilot(endpoint,"syndes-policy-api",send);

test("derives tenant/org/workspace/funnel-bound names, never global names",()=>{
  const parent=pilotResourceName(workspace);
  assert.equal(parent,"syndes:v1:tenant:"+A+":org:"+B+":workspace:"+C);
  assert.equal(pilotResourceName(funnel),parent+":funnel:"+D);
  assert.notEqual(pilotResourceName({...workspace,tenantId:D}),parent);
  assert.notEqual(pilotResourceName({...workspace,organizationId:D}),parent);
  assert.throws(()=>pilotResourceName({...workspace,workspaceId:"other-tenant"}),/Invalid/);
  assert.throws(()=>pilotResourceName({...workspace,kind:"workspace",funnelId:D}),/Unsupported/);
  assert.throws(()=>pilotResourceName({...workspace,kind:"funnel"}),/Unsupported/);
});

test("uses exact UMA ticket and one scope, no client or admin secret",async()=>{
  let requests=0;
  const adapter=mk(async(url,options)=>{
    requests++;
    assert.equal(url,endpoint);
    assert.equal(options.method,"POST");
    assert.equal(options.headers.Authorization,"Bearer "+token);
    assert.equal(options.redirect,"error");
    assert.equal(options.cache,"no-store");
    const form=new URLSearchParams(options.body);
    assert.deepEqual([...form.keys()].sort(),["audience","grant_type","permission","response_mode","submit_request"]);
    assert.equal(form.get("grant_type"),"urn:ietf:params:oauth:grant-type:uma-ticket");
    assert.equal(form.get("audience"),"syndes-policy-api");
    assert.equal(form.get("response_mode"),"decision");
    assert.equal(form.get("submit_request"),"false");
    assert.equal(form.get("permission"),A+"#"+B);
    return new Response(JSON.stringify({result:true}),{status:200});
  });
  assert.equal(await adapter.check(input),true);
  assert.equal(requests,1);
});

test("rejects wrong scope, unknown capability, invalid context or token before network",async()=>{
  let called=false;
  const adapter=mk(async()=>{called=true;return new Response(JSON.stringify({result:true}))});
  assert.equal(await adapter.check({...input,capability:"service.funnel.operate"}),false);
  assert.equal(await adapter.check({...input,capability:"service:admin"}),false);
  assert.equal(await adapter.check({...input,context:{...workspace,tenantId:"bogus"}}),false);
  assert.equal(await adapter.check({...input,verifiedAccessToken:"not-jwt"}),false);
  assert.equal(await adapter.check({...input,keycloakResource:{...resource,id:"not-uuid"}}),false);
  assert.equal(await adapter.check({...input,keycloakResource:{...resource,name:pilotResourceName({...workspace,tenantId:D})}}),false);
  assert.equal(await adapter.check({...input,keycloakResource:{...resource,scopeName:"inbox.message.send"}}),false);
  assert.equal(called,false);
});

test("checks a particular funnel without authorizing other funnels",async()=>{
  const permissions=[];
  const funnelResource={id:D,scopeId:B,name:pilotResourceName(funnel),scopeName:"service.funnel.operate"};
  const adapter=mk(async(_url,options)=>{
    permissions.push(new URLSearchParams(options.body).get("permission"));
    return new Response(JSON.stringify({result:true}),{status:200});
  });
  assert.equal(await adapter.check({...input,context:funnel,capability:"service.funnel.operate",keycloakResource:funnelResource}),true);
  assert.equal(permissions[0],D+"#"+B);
  assert.equal(await adapter.check({...input,context:{...funnel,funnelId:A},capability:"service.funnel.operate",keycloakResource:funnelResource}),false);
});

test("403, explicit false, malformed responses and outages never grant access",async()=>{
  const forbidden=mk(async()=>new Response(JSON.stringify({error:"access_denied"}),{status:403}));
  assert.equal(await forbidden.check(input),false);
  const denied=mk(async()=>new Response(JSON.stringify({result:false}),{status:200}));
  assert.equal(await denied.check(input),false);
  for (const result of [{allowed:true},{result:"true"},{result:true,extra:1},[],null]) {
    const adapter=mk(async()=>new Response(JSON.stringify(result),{status:200}));
    await assert.rejects(adapter.check(input),/response invalid/);
  }
  await assert.rejects(mk(async()=>new Response("x",{status:500})).check(input),/status unavailable/);
  await assert.rejects(mk(async()=>{throw new Error("secret credential leak")}).check(input),
    /Keycloak UMA request unavailable/);
});

test("rejects unsafe endpoint configuration",()=>{
  for (const url of ["http://identity.example.invalid/realms/syndes/protocol/openid-connect/token",
    "https://user:pass@iam.example.invalid/realms/syndes/protocol/openid-connect/token",
    "https://iam.example.invalid/admin/realms/syndes/users",
    "https://iam.example.invalid/realms/syndes/protocol/openid-connect/token?x=1"]) {
    assert.throws(()=>new KeycloakUmaAuthorizationPilot(url,"syndes-policy-api"),/Unsafe/);
  }
  assert.throws(()=>new KeycloakUmaAuthorizationPilot(endpoint,"???"),/Unsafe/);
});
