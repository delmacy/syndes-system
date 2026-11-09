import test from "node:test";
import assert from "node:assert/strict";
import {readConfig,beginLogin,autoLoginAllowed,markSignedOut} from "../src/auth.ts";
const T="11111111-1111-4111-8111-111111111111";
const cfg={issuer:"https://identity.example/realms/syndes",clientId:"syndes-support-ui",tenantId:T,tenantLabel:"Syndes"};
test("runtime config is mandatory, separate OIDC client, valid tenant and HTTPS",async()=>{
 const original=globalThis.fetch;
 try{
  globalThis.fetch=async()=>Response.json(cfg);
  assert.deepEqual(await readConfig(),cfg);
  for(const bad of [{...cfg,clientId:"syndes-workspace-ui"},{...cfg,issuer:"http://idp.test"},{...cfg,tenantId:"arbitrary"}]){
   globalThis.fetch=async()=>Response.json(bad);
   await assert.rejects(readConfig(),/Identidade ou tenant/);
  }
  globalThis.fetch=async()=>Response.json({}, {status:404});
  await assert.rejects(readConfig(),/indisponível/);
 }finally{globalThis.fetch=original;}
});
test("login uses PKCE S256, isolated session key and sign-out state",async()=>{
 const old={sessionStorage:globalThis.sessionStorage,window:globalThis.window};
 const data=new Map(),redirects=[];
 globalThis.sessionStorage={
  getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),
  removeItem:k=>data.delete(k)
 };
 globalThis.window={location:{origin:"https://support.syndes.example",assign:x=>redirects.push(new URL(x))}};
 try{
  markSignedOut();assert.equal(autoLoginAllowed(),false);
  await beginLogin(cfg);assert.equal(autoLoginAllowed(),true);
  assert.equal(redirects.length,1);
  assert.equal(redirects[0].searchParams.get("client_id"),"syndes-support-ui");
  assert.equal(redirects[0].searchParams.get("code_challenge_method"),"S256");
  assert.equal(redirects[0].searchParams.get("redirect_uri"),"https://support.syndes.example/");
  assert.equal(data.has("syndes.workspace.pkce"),false);
  assert.equal(data.has("syndes.support.pkce"),true);
 }finally{
  for(const [k,v] of Object.entries(old))if(v===undefined)delete globalThis[k];else globalThis[k]=v;
 }
});
