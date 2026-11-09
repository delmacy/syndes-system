import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {createMasterTokenVerifier} from "../src/auth.mjs";

test("Keycloak audience AND authorized party isolate master tokens from tenant client",async()=>{
 const {privateKey,publicKey}=await generateKeyPair("RS256");
 const publicJwk=await exportJWK(publicKey);
 publicJwk.kid="platform-key";
 publicJwk.alg="RS256";
 publicJwk.use="sig";
 const server=createServer((req,res)=>{
  if(req.url==="/jwks"){
   res.writeHead(200,{"Content-Type":"application/json"});
   res.end(JSON.stringify({keys:[publicJwk]}));
  }else{res.writeHead(404);res.end();}
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const jwksUrl="http://127.0.0.1:"+server.address().port+"/jwks";
 const issuer="https://keycloak.example.test/realms/syndes";
 const verify=createMasterTokenVerifier({
  jwksUrl,issuer,audience:"syndes-master-api",clientId:"syndes-master-admin",
 });
 const sign=async(overrides={})=>
  "Bearer "+await new SignJWT({
   sub:"immutable-keycloak-sub",
   azp:"syndes-master-admin",
   ...overrides
  }).setProtectedHeader({alg:"RS256",kid:"platform-key"})
   .setIssuedAt().setExpirationTime("10m")
   .setIssuer(issuer).setAudience("syndes-master-api").sign(privateKey);
 try{
  const valid=await sign();
  assert.equal(await verify(valid),"immutable-keycloak-sub");
  await assert.rejects(verify(await sign({azp:"syndes-workspace"})),
   /Wrong OIDC client/,"Tenant frontend's OIDC client cannot log in to Master");
  await assert.rejects(verify(await sign({azp:"other-master"})),/Wrong OIDC client/);
  await assert.rejects(verify(await sign({sub:""})),/Wrong OIDC client/);
  const notMasterAudience="Bearer "+await new SignJWT({
   sub:"immutable-keycloak-sub",azp:"syndes-master-admin"
  }).setProtectedHeader({alg:"RS256",kid:"platform-key"})
   .setIssuedAt().setExpirationTime("10m").setIssuer(issuer)
   .setAudience("syndes-core").sign(privateKey);
  await assert.rejects(verify(notMasterAudience));
  assert.match(await sign(),/^Bearer /);
  await assert.rejects(verify("Bearer invalid.jwt.signature"));
  await assert.rejects(verify(undefined));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
