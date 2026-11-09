import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {ActorVerifier} from "../dist/adapters.js";

test("signed Master Admin tokens cannot enter tenant Core even with broad audience",async()=>{
 const {privateKey,publicKey}=await generateKeyPair("RS256");
 const jwk=await exportJWK(publicKey);
 jwk.alg="RS256";jwk.use="sig";jwk.kid="shared-keycloak";
 const server=createServer((req,res)=>{
  if(req.url!=="/jwks"){res.writeHead(404);res.end();return;}
  res.writeHead(200,{"content-type":"application/json"});
  res.end(JSON.stringify({keys:[jwk]}));
 });
 await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
 const issuer="https://keycloak.example.test/realms/syndes";
 const verifier=new ActorVerifier(issuer,"syndes-core",
  "http://127.0.0.1:"+server.address().port+"/jwks","syndes-master-admin");
 async function token(azp,aud="syndes-core"){
  return "Bearer "+await new SignJWT({sub:"same-subject",azp})
   .setProtectedHeader({alg:"RS256",kid:"shared-keycloak"})
   .setIssuer(issuer).setAudience(aud)
   .setIssuedAt().setExpirationTime("5m").sign(privateKey);
 }
 try{
  assert.deepEqual(await verifier.verify(await token("syndes-workspace")),
   {id:"same-subject",kind:"user"});
  await assert.rejects(verifier.verify(await token("syndes-master-admin")),
   /Master Admin token cannot access tenant APIs/);
  const defaultVerifier=new ActorVerifier(issuer,"syndes-core",
   "http://127.0.0.1:"+server.address().port+"/jwks");
  await assert.rejects(defaultVerifier.verify(await token("syndes-master-admin")),
   /Master Admin token cannot access tenant APIs/,
   "The tenant API must deny the dedicated master client even without an optional environment variable");
  await assert.rejects(verifier.verify(await token("syndes-workspace","syndes-master-api")));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
