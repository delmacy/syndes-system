/**
 * IAM-07B / IAM-09 pre-implementation gate: actual RS256 JWT verification
 * with disposable local JWK, expiry DURING an Inbox SSE session, and
 * impersonation/claim substitution negatives. No operational Keycloak.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {once} from "node:events";
import {setTimeout as delay} from "node:timers/promises";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import {ActorVerifier} from "../dist/adapters.js";
import {Iam07SseSessionPilot} from "../dist/iam07-sse-session-pilot.js";
import {pilotResourceName} from "../dist/keycloak-authorization-pilot.js";
import {InboxChangeBus} from "@syndes/core-inbox";

const REALM="syndes-iam-lab-ci";
const ISSUER="https://id.ci.syndes.invalid/realms/"+REALM;
const CLIENT="syndes-iam-lab-ui";
const AUDIENCE="syndes-core";
const SUB="11111111-1111-4111-8111-111111111111";
const TENANT="22222222-2222-4222-8222-222222222222";
const ORG="33333333-3333-4333-8333-333333333333";
const WS="44444444-4444-4444-8444-444444444444";
const KEYCLOAK_ORG="55555555-5555-4555-8555-555555555555";
const requested=Object.freeze({
  tenantId:TENANT,organizationId:ORG,workspaceId:WS,
  capability:"inbox.conversation.read",
});
const context=Object.freeze({
  actor:Object.freeze({id:SUB,kind:"user"}),
  tenantId:TENANT,organizationId:ORG,workspaceId:WS,
  keycloakOrganizationId:KEYCLOAK_ORG,realm:REALM,moduleId:"inbox",
  capability:"inbox.conversation.read",scopeWriteAllowed:false,
  resourceName:pilotResourceName({
    tenantId:TENANT,organizationId:ORG,workspaceId:WS,kind:"workspace",
  }),
});

async function fixture(run){
  const key=await generateKeyPair("RS256");
  const alien=await generateKeyPair("RS256");
  const jwk=await exportJWK(key.publicKey);
  Object.assign(jwk,{alg:"RS256",kid:"iam07b-ci-only",use:"sig"});
  const server=createServer((req,res)=>{
    if(req.url!=="/jwks"){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"Content-Type":"application/json","Cache-Control":"no-store"});
    res.end(JSON.stringify({keys:[jwk]}));
  });
  server.listen(0,"127.0.0.1");
  await once(server,"listening");
  try{
    const port=server.address()?.port;
    assert.ok(Number.isInteger(port)&&port>0);
    const verifier=new ActorVerifier(ISSUER,AUDIENCE,"http://127.0.0.1:"+port+"/jwks");
    const sign=async(override={},using=key.privateKey)=>{
      const now=Math.floor(Date.now()/1000);
      const {issuer=ISSUER,audience=AUDIENCE,azp=CLIENT,subject=SUB,
        exp=now+120,nbf=now-1}=override;
      return new SignJWT({azp})
        .setProtectedHeader({alg:"RS256",kid:"iam07b-ci-only"})
        .setIssuer(issuer).setAudience(audience).setSubject(subject)
        .setIssuedAt(now).setNotBefore(nbf).setExpirationTime(exp)
        .sign(using);
    };
    return await run({verifier,sign,alien:alien.privateKey});
  }finally{
    await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));
  }
}

test("IAM07B_RS256: signed audience/issuer/client/sub and all tampering vectors deny",async()=>{
  await fixture(async({verifier,sign,alien})=>{
    const valid=await sign();
    assert.deepEqual(await verifier.verifyClient("Bearer "+valid,CLIENT),
      {id:SUB,kind:"user"});
    const now=Math.floor(Date.now()/1000);
    const denied=[
      ["absent",undefined],
      ["wrong audience","Bearer "+await sign({audience:"other-api"})],
      ["wrong issuer","Bearer "+await sign({issuer:"https://id.invalid/realms/syndes"})],
      ["wrong azp","Bearer "+await sign({azp:"syndes-master-admin"})],
      ["wrong frontend","Bearer "+await sign({azp:"unexpected-client"})],
      ["expired","Bearer "+await sign({exp:now-5})],
      ["future nbf","Bearer "+await sign({nbf:now+300,exp:now+600})],
      ["foreign subject","Bearer "+await sign({subject:""})],
      ["foreign RS256 key","Bearer "+await sign({},alien)],
      ["tampered signature","Bearer "+valid.slice(0,-2)+"zz"],
    ];
    for(const [label,token] of denied)
      await assert.rejects(verifier.verifyClient(token,CLIENT),
        undefined,"IAM07B token must deny "+label);
    console.log("IAM07B_SIGNED_JWT_EXP_NBF_AUD_ISS_AZP_SIGNATURE_DENY_PASS");
  });
});

test("IAM07B_SSE: the SAME initially valid signed token expires while stream is connected",async()=>{
  await fixture(async({verifier,sign})=>{
    const expiresAt=Math.floor(Date.now()/1000)+3;
    const bearer="Bearer "+await sign({exp:expiresAt});
    let fgaCalls=0,resolveCalls=0;
    const admission={resolve:async(header,requestedScope)=>{
      resolveCalls++;
      const principal=await verifier.verifyClient(header,CLIENT);
      assert.equal(principal.id,SUB);
      assert.deepEqual(requestedScope,requested);
      return context;
    }};
    const fga={canAccess:async req=>{
      fgaCalls++;
      assert.equal(req.actor.id,SUB);
      assert.equal(req.tenantId,TENANT);
      assert.equal(req.resource,"inbox:conversations");
      assert.equal(req.action,"read");
      return true;
    }};
    const gate=new Iam07SseSessionPilot(admission,fga);
    const session=await gate.open(bearer,requested);
    const bus=new InboxChangeBus();
    const output=[];
    const sink={
      setHeader:()=>{},
      write:data=>{output.push(data);return true;},
      end:()=>output.push("END"),
      on:()=>{},
    };
    bus.connect(session.address,sink,session.revalidate,10000,3000);
    for(let tries=0;tries<25&&!output.some(s=>s.startsWith("event: changed"));tries++)
      await delay(10);
    assert.equal(output.filter(s=>s.startsWith("event: changed")).length,1);
    assert.equal(bus.count(session.address),1);
    const before=output.filter(s=>s.startsWith("event: changed")).length;
    // A real clock is intentional here: the JWKS verifier sees an expired
    // RS256 JWT without any helper flags, mocks or synthetic revocation.
    await delay(Math.max(0,(expiresAt+1)*1000-Date.now()));
    bus.publish(session.address);
    for(let tries=0;tries<60&&!output.includes("END");tries++)await delay(10);
    assert.equal(output.at(-1),"END");
    assert.equal(output.filter(s=>s.startsWith("event: changed")).length,before);
    assert.equal(bus.count(session.address),0);
    assert.ok(resolveCalls>=3);
    assert.equal(fgaCalls,2,"expired JWT must deny before FGA gets called");
    await assert.rejects(gate.open(bearer,requested),/admission denied/);
    console.log("IAM07B_SIGNED_JWT_EXPIRES_DURING_LIVE_SSE_PASS");
  });
});
