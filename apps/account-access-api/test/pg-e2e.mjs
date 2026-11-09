/* Integration: real HTTP server, real RS256 verification, FGA HTTP fixture
 * and disposable PostgreSQL 17 with dedicated EXECUTE-only runtime role.
 * Only invoked by the dedicated CI job, never by npm test or DevServer01.
 */
import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,writeFile,unlink} from "node:fs/promises";
import {spawn} from "node:child_process";
import {fileURLToPath} from "node:url";
import {generateKeyPair,exportJWK,SignJWT} from "jose";
import pg from "pg";

if(process.env.CI_ACCOUNT_PG!=="1")throw Error("CI_ACCOUNT_PG=1 is mandatory for disposable DB integration");
const root=new URL("../../../",import.meta.url);
const fromRoot=(p)=>fileURLToPath(new URL(p,root));
const control=process.env.CI_PG_ADMIN_URL;
if(!control||!control.includes("127.0.0.1:15433"))
 throw Error("Refusing integration outside disposable localhost PostgreSQL 15433");
const admin=new pg.Pool({connectionString:control,connectionTimeoutMillis:3000});
const runtime=new pg.Pool({
 connectionString:"postgresql://syndes_account_api:ci-account-runtime-only-secret-2026@127.0.0.1:15433/syndes_control",
 connectionTimeoutMillis:3000,
});
const TENANT_A="11111111-1111-4111-8111-111111111111";
const TENANT_B="22222222-2222-4222-8222-222222222222";
const ORIGIN="https://workspace.ci.syndes.invalid";
const ID1="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID2="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID3="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ID4="dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const keyFile="/run/secrets/ci-account-db-url";
const fgaFile="/run/secrets/ci-account-fga-token";
let proc,keys,fga;
let fgaAllowed=true;
const sql=(p)=>readFile(fromRoot(p),"utf8");
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const listen=(server)=>new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const close=(server)=>new Promise(resolve=>server.close(resolve));
async function setup(){
 const superdb=new pg.Client({connectionString:control.replace("/syndes_control","/postgres")});
 await superdb.connect();
 try{
  await superdb.query("CREATE ROLE syndes_core NOLOGIN");
  await superdb.query("CREATE ROLE syndes_account_api LOGIN PASSWORD 'ci-account-runtime-only-secret-2026'");
 }finally{await superdb.end();}
 await admin.query(await sql("infra/postgres/bootstrap/control.schema"));
 await admin.query(await sql("infra/postgres/bootstrap/control-account-roles.schema"));
 await admin.query(await sql("infra/postgres/bootstrap/control-account-delegation.schema"));
 await admin.query("GRANT syndes_account_delegate TO syndes_account_api");
 await admin.query(`
  INSERT INTO tenant_registry(tenant_id,database_name,role_name,state) VALUES
  ('${TENANT_A}','syndes_tenant_11111111111141118111111111111111',
   'syndes_t_11111111111141118111111111111111','active'),
  ('${TENANT_B}','syndes_tenant_22222222222242228222222222222222',
   'syndes_t_22222222222242228222222222222222','active');
  INSERT INTO tenant_memberships(tenant_id,principal_id,state) VALUES
   ('${TENANT_A}','owner-a','active'),
   ('${TENANT_A}','backup-a','active'),
   ('${TENANT_A}','target-a','active'),
   ('${TENANT_A}','other-a','active'),
   ('${TENANT_B}','owner-b','active'),
   ('${TENANT_B}','target-b','active');
  INSERT INTO tenant_account_role_grants(tenant_id,principal_id,role,granted_by,updated_by) VALUES
   ('${TENANT_A}','owner-a','owner','ci-dba','ci-dba'),
   ('${TENANT_A}','backup-a','owner','ci-dba','ci-dba'),
   ('${TENANT_B}','owner-b','owner','ci-dba','ci-dba');
 `);
 await assert.rejects(runtime.query("SELECT * FROM tenant_account_role_grants"),e=>e.code==="42501");
 await assert.rejects(runtime.query("UPDATE tenant_account_role_grants SET role='owner'"),e=>e.code==="42501");
 await assert.rejects(runtime.query("SELECT * FROM tenant_account_delegation_requests"),e=>e.code==="42501");
}

async function run(){
 await setup();
 const {privateKey,publicKey}=await generateKeyPair("RS256");
 const jwk=await exportJWK(publicKey);
 Object.assign(jwk,{kid:"syndes-ci-account",use:"sig",alg:"RS256"});
 keys=createServer((req,res)=>{
  if(req.url!=="/certs"){res.writeHead(404).end();return;}
  res.setHeader("content-type","application/json");
  res.end(JSON.stringify({keys:[jwk]}));
 });
 fga=createServer(async(req,res)=>{
  if(req.method!=="POST"||req.url!=="/stores/ci-store/check"){
   res.writeHead(404).end();return;
  }
  const body=[];
  for await(const c of req)body.push(c);
  const json=JSON.parse(Buffer.concat(body).toString("utf8"));
  assert.equal(json.tuple_key.relation,"can_write");
  assert.match(json.tuple_key.object,/^resource:[0-9a-f]{64}$/);
  res.setHeader("content-type","application/json");
  res.end(JSON.stringify({allowed:fgaAllowed}));
 });
 await listen(keys);await listen(fga);
 await writeFile(keyFile,"postgresql://syndes_account_api:ci-account-runtime-only-secret-2026@127.0.0.1:15433/syndes_control\n",{mode:0o600});
 await writeFile(fgaFile,"ci-fga-bearer-ephemeral",{mode:0o600});
 const keyUrl="http://127.0.0.1:"+keys.address().port+"/certs";
 const fgaUrl="http://127.0.0.1:"+fga.address().port;
 const port=18086;
 const app="http://127.0.0.1:"+port;
 const issuer="https://id.ci.syndes.invalid/realms/syndes";
 proc=spawn(process.execPath,["src/main.mjs"],{
  cwd:fromRoot("apps/account-access-api/"),stdio:"ignore",
  env:{...process.env,
   ACCOUNT_DB_URL_FILE:keyFile,
   ACCOUNT_OIDC_ISSUER:issuer,
   ACCOUNT_OIDC_AUDIENCE:"syndes-account-api",
   ACCOUNT_OIDC_CLIENT_ID:"syndes-workspace-ui",
   ACCOUNT_OIDC_JWKS_URL:keyUrl,
   ACCOUNT_OPENFGA_URL:fgaUrl,
   ACCOUNT_OPENFGA_STORE_ID:"ci-store",
   ACCOUNT_OPENFGA_TOKEN_FILE:fgaFile,
   ACCOUNT_ALLOWED_ORIGIN:ORIGIN,
   ACCOUNT_PORT:String(port),
  }
 });
 let ready=false;
 for(let i=0;i<40;i++){
  if(proc.exitCode!==null)throw Error("Dedicated API exited before readiness");
  try{ready=(await fetch(app+"/readyz")).status===200;}catch{}
  if(ready)break;
  await sleep(200);
 }
 assert.equal(ready,true,"Dedicated API readiness");
 async function token(sub,{azp="syndes-workspace-ui",aud="syndes-account-api"}={}){
  return new SignJWT({sub,azp}).setProtectedHeader({alg:"RS256",kid:"syndes-ci-account"})
   .setIssuer(issuer).setAudience(aud).setIssuedAt().setExpirationTime("5m")
   .sign(privateKey);
 }
 const ownerA=await token("owner-a");
 const ownerB=await token("owner-b");
 const adminA=await token("target-a");
 const wrongClient=await token("owner-a",{azp:"syndes-master-admin"});
 const wrongAud=await token("owner-a",{aud:"syndes-master-api"});
 const path=t=>"/v1/accounts/"+t+"/access/delegations";
 async function act(tenant,authorization,body,id=ID1,origin=ORIGIN){
  return fetch(app+path(tenant),{
   method:"POST",headers:{
    origin,authorization:authorization?"Bearer "+authorization:"",
    "idempotency-key":id,"content-type":"application/json",
   },body:JSON.stringify(body),
  });
 }
 const grant={operation:"grant",principalId:"target-a",role:"admin"};
 assert.equal((await act(TENANT_A,null,grant)).status,401);
 assert.equal((await act(TENANT_A,wrongClient,grant)).status,401);
 assert.equal((await act(TENANT_A,wrongAud,grant)).status,401);
 assert.equal((await act(TENANT_A,ownerA,grant,ID1,"https://evil.invalid")).status,403);

 fgaAllowed=false;
 assert.equal((await act(TENANT_A,ownerA,grant)).status,403);
 fgaAllowed=true;
 let response=await act(TENANT_A,ownerA,grant);
 assert.equal(response.status,200);
 assert.deepEqual(await response.json(),{role:"admin",state:"active",alreadyApplied:false});
 response=await act(TENANT_A,ownerA,grant);
 assert.equal(response.status,200);
 assert.equal((await response.json()).alreadyApplied,true);
 assert.equal((await act(TENANT_A,ownerA,{...grant,role:"owner"})).status,409);
 assert.equal((await act(TENANT_A,adminA,{operation:"grant",principalId:"other-a",role:"owner"},ID2)).status,403);
 // Even misconfigured FGA allows all, SQL owner check still blocks cross-tenant.
 assert.equal((await act(TENANT_B,ownerA,{operation:"grant",principalId:"target-b",role:"admin"},ID2)).status,403);
 assert.equal((await act(TENANT_A,ownerB,grant,ID3)).status,403);
 assert.equal((await act(TENANT_A,ownerA,{operation:"grant",principalId:"owner-a",role:"owner"},ID4)).status,403);
 assert.equal((await act(TENANT_A,ownerA,{operation:"grant",principalId:"missing",role:"admin"},ID3)).status,403);
 // Target membership may be deactivated independently; revocation must still work.
 await admin.query("UPDATE tenant_memberships SET state='revoked' WHERE tenant_id=$1 AND principal_id='target-a'",[TENANT_A]);
 const revoked=await act(TENANT_A,ownerA,{operation:"revoke",principalId:"target-a",role:"admin"},ID2);
 assert.equal(revoked.status,200);
 assert.equal((await revoked.json()).state,"revoked");
 assert.equal((await act(TENANT_A,adminA,grant,ID3)).status,403);
 // Membership bypass against the last owner must not be possible.
 await assert.rejects(admin.query("UPDATE tenant_memberships SET state='revoked' WHERE tenant_id=$1 AND principal_id='owner-b'",[TENANT_B]),e=>e.code==="23514");
 const audited=await admin.query("SELECT event FROM tenant_account_role_audit WHERE tenant_id=$1 AND principal_id='target-a' ORDER BY id",[TENANT_A]);
 assert.deepEqual(audited.rows.map(x=>x.event),["granted","revoked"]);
 const idempotency=await admin.query("SELECT count(*) AS n FROM tenant_account_delegation_requests WHERE tenant_id=$1",[TENANT_A]);
 assert.equal(Number(idempotency.rows[0].n),2);
 console.log("E2E PASS: RS256, dedicated audience/azp, FGA deny, DB owner grant, cross-tenant deny, idempotency, revocation and audit");
}
try{await run();}
catch(e){console.error("E2E FAIL:",e.message);process.exitCode=1;}
finally{
 if(proc){proc.kill("SIGTERM");await sleep(250);if(proc.exitCode===null)proc.kill("SIGKILL");}
 if(keys)await close(keys);
 if(fga)await close(fga);
 await admin.end().catch(()=>{});
 await runtime.end().catch(()=>{});
 await unlink(keyFile).catch(()=>{});
 await unlink(fgaFile).catch(()=>{});
}
