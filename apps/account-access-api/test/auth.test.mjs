import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {createTokenVerifier,createFgaWriteAuthorizer,fgaObject} from "../src/auth.mjs";

test("real RS256 JWKS verification requires dedicated aud/azp/issuer and subject",async()=>{
 const {privateKey,publicKey}=await generateKeyPair("RS256");
 const jwk=await exportJWK(publicKey);
 Object.assign(jwk,{kid:"ci-account-rsa",use:"sig",alg:"RS256"});
 const jwks=createServer((req,res)=>{
  if(req.url!=="/certs"){res.writeHead(404).end();return;}
  res.setHeader("Content-Type","application/json");
  res.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise(resolve=>jwks.listen(0,"127.0.0.1",resolve));
 const issuer="https://identity.syndes.test/realms/syndes";
 const verify=createTokenVerifier({
  issuer,audience:"syndes-account-api",clientId:"syndes-workspace-ui",
  jwksUrl:"http://127.0.0.1:"+jwks.address().port+"/certs",
 });
 async function token(overrides={}){
  const sub=Object.prototype.hasOwnProperty.call(overrides,"sub")
   ?overrides.sub:"a-person-keycloak-sub";
  const payload={sub,azp:overrides.azp??"syndes-workspace-ui"};
  return "Bearer "+await new SignJWT(payload)
   .setProtectedHeader({alg:"RS256",kid:"ci-account-rsa"})
   .setIssuer(overrides.iss??issuer)
   .setAudience(overrides.aud??"syndes-account-api")
   .setIssuedAt().setExpirationTime("5m").sign(privateKey);
 }
 try{
  assert.deepEqual(await verify(await token()),{kind:"user",id:"a-person-keycloak-sub"});
  await assert.rejects(verify(await token({azp:"syndes-master-admin"})));
  await assert.rejects(verify(await token({azp:"syndes-other-workspace"})));
  await assert.rejects(verify(await token({aud:"syndes-master-api"})));
  await assert.rejects(verify(await token({iss:"https://wrong.invalid"})));
  await assert.rejects(verify(await token({sub:""})));
  await assert.rejects(verify("Bearer invalid"));
 }finally{await new Promise(resolve=>jwks.close(resolve));}
});

test("OpenFGA write checks tenant-bound account resource without trusting browser grants",async()=>{
 const T="11111111-1111-4111-8111-111111111111";
 const actor={id:"owner-sub",kind:"user"};
 const calls=[];
 const allow=createFgaWriteAuthorizer({endpoint:"http://127.0.0.1:8080",
  store:"ci-store",token:"ci-only-token",
  send:async(url,opts)=>{calls.push({url:url.href,opts});return {
   ok:true,json:async()=>({allowed:true}),
  };},
 });
 assert.equal(await allow(actor,T),true);
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,"http://127.0.0.1:8080/stores/ci-store/check");
 const data=JSON.parse(calls[0].opts.body);
 assert.deepEqual(data,{tuple_key:{
  user:"user:owner-sub",relation:"can_write",
  object:fgaObject(T,"account:roles"),
 }});
 assert.notEqual(fgaObject(T,"account:roles"),fgaObject(
  "22222222-2222-4222-8222-222222222222","account:roles"));
 const deny=createFgaWriteAuthorizer({endpoint:"http://127.0.0.1:8080",
  store:"ci",token:"ci",send:async()=>({ok:true,json:async()=>({allowed:false})})});
 assert.equal(await deny(actor,T),false);
 const broken=createFgaWriteAuthorizer({endpoint:"http://127.0.0.1:8080",
  store:"ci",token:"ci",send:async()=>({ok:false,status:503})});
 await assert.rejects(broken(actor,T),/OpenFGA unavailable/);
});
