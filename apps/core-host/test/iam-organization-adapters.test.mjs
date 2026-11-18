import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp,writeFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {
  PgOrganizationIdentityLinks,KeycloakServiceAccountTokens,
  KeycloakOrganizationMembershipReader,
} from "../dist/iam-organization-adapters.js";

const tenant="11111111-1111-4111-8111-111111111111";
const org="22222222-2222-4222-8222-222222222222";
const kcorg="33333333-3333-4333-8333-333333333333";
const user="44444444-4444-4444-8444-444444444444";
const jwt="header.payload.signature";
const linkRow={realm:"syndes",keycloak_organization_id:kcorg,tenant_id:tenant,
  organization_id:org,state:"active",revision:"1"};

test("Control adapter reads reciprocal links, queries active tenant, never LIMIT 1",async()=>{
  const captured=[];
  const adapter=new PgOrganizationIdentityLinks({
    query:async(sql,args)=>{
      captured.push({sql,args});
      return {rows:[linkRow],rowCount:1};
    },
  });
  const a=await adapter.findPlatform(tenant,org),b=await adapter.findKeycloak("syndes",kcorg);
  assert.deepEqual(a,b);
  assert.equal(a[0].revision,1);
  assert.ok(Object.isFrozen(a[0]));
  assert.deepEqual(captured.map(x=>x.args),[[tenant,org],["syndes",kcorg]]);
  for(const q of captured){
    assert.match(q.sql,/tenant_registry/);
    assert.match(q.sql,/t.state='active'/);
    assert.doesNotMatch(q.sql,/LIMIT\s+1/i);
    assert.match(q.sql,/\$1/);
    assert.match(q.sql,/\$2/);
  }
  assert.deepEqual(await adapter.findPlatform("../x",org),[]);
  assert.deepEqual(await adapter.findKeycloak("bad realm",kcorg),[]);
});

test("malformed Control records fail closed; no silently truncated duplicate",async()=>{
  for(const row of [{...linkRow,revision:"9007199254740994"},
    {...linkRow,state:"disabled"},{...linkRow,keycloak_organization_id:"short"}]){
    const port=new PgOrganizationIdentityLinks({query:async()=>({rows:[row],rowCount:1})});
    await assert.rejects(port.findPlatform(tenant,org),/malformed/);
  }
  const port=new PgOrganizationIdentityLinks({query:async()=>({rows:[linkRow,linkRow],rowCount:2})});
  assert.equal((await port.findPlatform(tenant,org)).length,2);
  const down=new PgOrganizationIdentityLinks({query:async()=>{throw Error("Control offline")}});
  await assert.rejects(down.findPlatform(tenant,org));
});

test("Keycloak 26 Organization membership uses GET admin REST with service token, no claims",async()=>{
  const calls=[];
  const reader=new KeycloakOrganizationMembershipReader("http://127.0.0.1:18088/","syndes",
    {getToken:async()=>jwt},async(url,init)=>{
      calls.push({url:String(url),init});
      return new Response(JSON.stringify({id:user,enabled:true}),{status:200});
    });
  assert.equal(await reader.isActiveMember("syndes",kcorg,user),true);
  assert.equal(calls.length,1);
  assert.equal(calls[0].url,"http://127.0.0.1:18088/admin/realms/syndes/organizations/"+kcorg+"/members/"+user);
  assert.equal(calls[0].init.method,"GET");
  assert.equal(calls[0].init.headers.Authorization,"Bearer "+jwt);
  assert.equal(calls[0].init.redirect,"error");
  assert.equal(calls[0].init.cache,"no-store");
  assert.equal(await reader.isActiveMember("other",kcorg,user),false);
  assert.equal(await reader.isActiveMember("syndes",kcorg,"not-a-uuid"),false);
  assert.equal(calls.length,1);
});

test("revoked/absent/disabled/wrong-sub members deny and unexpected results fail closed",async()=>{
  for(const [status,body,want] of [
    [404,null,false],
    [200,{id:user,enabled:false},false],
    [200,{id:"55555555-5555-4555-8555-555555555555",enabled:true},false],
    [200,{id:user},false],
  ]){
    const reader=new KeycloakOrganizationMembershipReader("https://keycloak.example.invalid/","syndes",
      {getToken:async()=>jwt},async()=>new Response(body?JSON.stringify(body):"",{status}));
    assert.equal(await reader.isActiveMember("syndes",kcorg,user),want);
  }
  for(const [status,body] of [[403,"{}"],[500,"{}"],[302,"{}"],[200,"broken"]]){
    const reader=new KeycloakOrganizationMembershipReader("https://keycloak.example.invalid/","syndes",
      {getToken:async()=>jwt},async()=>new Response(body,{status}));
    await assert.rejects(reader.isActiveMember("syndes",kcorg,user));
  }
  for(const problem of [
    {getToken:async()=>{throw Error("vault unavailable")}},
    {getToken:async()=>""},
  ]){
    const reader=new KeycloakOrganizationMembershipReader("https://keycloak.example.invalid/",
      "syndes",problem,async()=>{throw Error("should never call")});
    await assert.rejects(reader.isActiveMember("syndes",kcorg,user));
  }
  const offline=new KeycloakOrganizationMembershipReader("https://keycloak.example.invalid/",
    "syndes",{getToken:async()=>jwt},async()=>{throw Error("socket timeout")});
  await assert.rejects(offline.isActiveMember("syndes",kcorg,user),/transport unavailable/);
});

test("service client_credentials only from protected file; response never leaks secret",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"syndes-iam-"));
  const secretPath=join(dir,"service");
  const secret="ci-only-nonoperational-secret-credential";
  try{
    await writeFile(secretPath,secret,{mode:0o600});
    let count=0;
    const source=new KeycloakServiceAccountTokens(
      "http://127.0.0.1:18088/","syndes","syndes-iam-membership-reader",secretPath,
      async(url,init)=>{
        count++;
        assert.equal(String(url),"http://127.0.0.1:18088/realms/syndes/protocol/openid-connect/token");
        assert.equal(init.method,"POST");
        const body=new URLSearchParams(init.body);
        assert.equal(body.get("grant_type"),"client_credentials");
        assert.equal(body.get("client_id"),"syndes-iam-membership-reader");
        assert.equal(body.get("client_secret"),secret);
        assert.equal(init.redirect,"error");
        return new Response(JSON.stringify({access_token:jwt}),{status:200});
      });
    assert.equal(await source.getToken(),jwt);
    assert.equal(await source.getToken(),jwt,"no cached service identity after revocation");
    assert.equal(count,2);
    const denied=new KeycloakServiceAccountTokens("https://id.example.invalid/","syndes",
      "syndes-iam-membership-reader",secretPath,async()=>new Response("{}",{status:403}));
    await assert.rejects(denied.getToken(),e=>!String(e).includes(secret));
  }finally{await rm(dir,{recursive:true,force:true});}
  assert.throws(()=>new KeycloakServiceAccountTokens("http://evil.example.invalid/","syndes",
    "syndes-iam-membership-reader","/run/secrets/id"),/Unsafe/);
  assert.throws(()=>new KeycloakServiceAccountTokens("https://id.example.invalid/","syndes",
    "syndes-master-admin","/run/secrets/id"),/Unsafe/);
  assert.throws(()=>new KeycloakOrganizationMembershipReader("http://evil.example.invalid/",
    "syndes",{getToken:async()=>jwt}),/Unsafe/);
});
