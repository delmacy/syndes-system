/**
 * Real HTTP/Nest module-mount contract, backed by disposable PostgreSQL.
 * Run only under modules/inbox/test/postgres-integration.sh, never in the
 * ordinary Host unit suite (which has no PostgreSQL service).
 */
import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {NestFactory} from "@nestjs/core";
import {Module,Global} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "../dist/module-host.js";

const require=createRequire(new URL("../package.json",import.meta.url));
const {Pool}=require("pg");
const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const resource="/v1/tenants/";
const pool=new Pool({connectionString:"postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres",max:4});
const trace=[];
const auth={
 alice:"Bearer ci-alice",
 bob:"Bearer ci-bob",
 readonly:"Bearer ci-readonly",
 outsider:"Bearer ci-outsider",
 invalid:"Bearer invalid"
};
const memberships={alice:A,bob:B,readonly:A};
const tenantDatabaseResolutions=[];
// Deterministic fault injection, reset in each test and never used in production.
const faults={fga:false,resolve:false,mismatchedLease:false,query:false};
async function startHost(){
 const installed=await loadInstalledPlugins();
 assert.deepEqual(installed.map(p=>p.definition.id),["crm","inbox","whatsapp","organizations"],
   "Host must register CRM, Inbox, WhatsApp and Organizations in dependency order");
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},...installed.map(p=>p.definition)],
  tenancy:{canAccessTenant:async({actor,tenantId})=>memberships[actor.id]===tenantId},
  authorization:{canAccess:async({actor,resource,action})=>{
   if(faults.fga)throw Error("Injected OpenFGA connectivity failure: private details");
   return resource.startsWith("inbox:")&&(actor.id!=="readonly"||action==="read");
  }}
 });
 await kernel.start();
 const provider={resolve:async tenantId=>{
  tenantDatabaseResolutions.push(tenantId);
  if(faults.resolve)throw Error("Injected OpenBao/tenant registry failure: private details");
  return {tenantId:faults.mismatchedLease?B:tenantId,query:async(sql,values)=>{
   if(faults.query)throw Error("Injected PostgreSQL query failure: private details");
   const data=await pool.query(sql,values);
   return {rows:data.rows,rowCount:data.rowCount};
  }};
 }};
 const verifier={verify:async header=>{
  const id=Object.keys(auth).find(k=>auth[k]===header&&k!=="invalid");
  if(!id)throw Error("Invalid token");
  return {id,kind:"user"};
 }};
 class Runtime{}
 Global()(Runtime);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{kernel,verifier}},
  {provide:"SYNDES_TENANT_DB",useValue:provider},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(Runtime);
 class HttpApp{}
 Module({imports:[Runtime,...installed.map(p=>p.apiModule)]})(HttpApp);
 const app=await NestFactory.create(HttpApp,{logger:false});
 installModuleAssets(app,installed);
 await app.listen(0,"127.0.0.1");
 return {app,base:await app.getUrl()};
}
async function seedAuthorizedDefaultContexts(){
 for(const [tenant,principals] of [[A,["alice","readonly"]],[B,["bob"]]]){
  const org=randomUUID(),ws=randomUUID();
  await pool.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'CI Default',true)",[tenant,org]);
  await pool.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Primary','primary',true)",[tenant,ws,org]);
  for(const principal of principals){
   await pool.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,$3,'admin')",[tenant,org,principal]);
   await pool.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,$4,'admin')",[tenant,org,ws,principal]);
  }
  const backfill=await pool.query("SELECT * FROM platform_backfill_legacy_ownership($1::uuid,$2)",[tenant,principals[0]]);
  assert.equal(backfill.rows.length,5,"all legacy owner categories must be considered");
 }
}
async function request(base,tenant,path,{method="GET",token=auth.alice,body}={}){
 const res=await fetch(base+resource+tenant+"/inbox"+path,{
  method,headers:{...(token?{authorization:token}:{}),...(body===undefined?{}:{"content-type":"application/json"})},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 const response=await res.json().catch(()=>null);
 trace.push({method,path,tenant:tenant===A?"A":tenant===B?"B":"invalid",status:res.status});
 return {status:res.status,body:response};
}
function expect(result,status){
 assert.equal(result.status,status,JSON.stringify(result));
 return result.body;
}
async function call(base,tenant,path,opts,status){
 return expect(await request(base,tenant,path,opts),status);
}

test("Core Host loads Inbox plugin and runs its HTTP contract against real tenant-scoped PostgreSQL",async t=>{
 let app;
 try{
  await seedAuthorizedDefaultContexts();
  const host=await startHost();
  app=host.app;
  const {base}=host;

  await t.test("module registration, assets and exact routes",async()=>{
   for(const [route,part] of [["/inbox","Core Inbox"],["/inbox/app.js","code_challenge_method"],["/inbox/styles.css","queue"]]){
    const r=await fetch(base+route);
    assert.equal(r.status,200,route);
    assert.match(await r.text(),new RegExp(part));
    assert.equal(r.headers.get("x-content-type-options"),"nosniff");
    assert.match(r.headers.get("content-security-policy")??"",/default-src 'none'/);
   }
   assert.equal((await fetch(base+"/inbox/app.js",{method:"HEAD"})).status,200);
   assert.equal((await fetch(base+"/inbox",{method:"POST"})).status,405);
   assert.equal((await fetch(base+"/inbox/unregistered")).status,404);
  });

  await t.test("401/403/400 fail closed before the Host selects tenant database",async()=>{
   const before=tenantDatabaseResolutions.length;
   const path="/conversations";
   await call(base,A,path,{token:null},401);
   await call(base,A,path,{token:auth.invalid},401);
   await call(base,A,path,{token:auth.outsider},403);
   await call(base,B,path,{token:auth.alice},403);
   await call(base,"../bad",path,{token:auth.alice},404); // URL router normalization; no tenant route matched
   await call(base,"invalid-tenant",path,{token:auth.alice},400);
   await call(base,A,path,{token:auth.readonly,method:"POST",body:{subject:"Denied"}},403);
   assert.equal(tenantDatabaseResolutions.length,before+1,
    "Invalid bearer/foreign tenant deny before DB; same-tenant readonly POST checks default context before write FGA denial");
  });

  await t.test("input validation maps to HTTP 400 without allocating a tenant database",async()=>{
   const before=tenantDatabaseResolutions.length;
   for(const bad of [
    {subject:""},
    {subject:"  "},
    {subject:"a".repeat(161)},
    {subject:"\u0000"},
    {subject:"Normal",crmPersonId:"../../other"},
    {subject:"Normal",externalThreadId:"<unsafe>"}
   ])await call(base,A,"/conversations",{method:"POST",body:bad},400);
   for(const query of ["status=invalid","limit=0","limit=101","limit=NaN","limit=2.5"]){
    await call(base,A,"/conversations?"+query,{},400);
   }
   await call(base,A,"/conversations/not-a-uuid",{},400);
   assert.equal(tenantDatabaseResolutions.length-before,12,
    "Authenticated invalid requests resolve only the default context gate; no Inbox business SQL runs");
  });

  const P=randomUUID();
  await pool.query("INSERT INTO crm_people(id,tenant_id,name) VALUES($1,$2,$3)",[P,A,"HTTP CI Person"]);
  const subject="Inbox PG HTTP "+randomUUID();
  let conversation;
  await t.test("create/list/get and CRM tenant-qualified foreign key",async()=>{
   conversation=await call(base,A,"/conversations",{method:"POST",body:{
    subject:"  "+subject+"  ",crmPersonId:P,externalThreadId:"http-"+randomUUID()
   }},201);
   assert.equal(conversation.tenantId,A);
   assert.equal(conversation.subject,subject);
   assert.equal(conversation.crmPersonId,P);
   assert.equal((await call(base,A,"/conversations",{},200)).some(x=>x.id===conversation.id),true);
   assert.equal((await call(base,A,"/conversations?status=resolved",{},200)).some(x=>x.id===conversation.id),false);
   assert.equal((await call(base,A,"/conversations/"+conversation.id,{},200)).id,conversation.id);
   const fk=await request(base,B,"/conversations",{method:"POST",token:auth.bob,
    body:{subject:"Cannot attach tenant A contact",crmPersonId:P}});
   expect(fk,400);
   const cB=await call(base,B,"/conversations",{method:"POST",token:auth.bob,body:{subject:"Private B"}},201);
   assert.equal(cB.tenantId,B);
   assert.equal((await call(base,B,"/conversations",{token:auth.bob},200)).some(x=>x.id===conversation.id),false);
   await call(base,B,"/conversations/"+conversation.id,{token:auth.bob},404);
   await call(base,B,"/conversations/"+conversation.id+"/messages",{token:auth.bob},404);
   const unknown=randomUUID();
   await call(base,A,"/conversations/"+unknown,{},404);
   await call(base,A,"/conversations/"+unknown+"/messages",{},404);
   await call(base,A,"/conversations/"+unknown+"/assignment",{method:"PATCH",body:{assigneeId:"alice"}},404);
  });

  await t.test("dedup conflict, assignment, permissions and status transitions via HTTP",async()=>{
   const id=conversation.id;
   const root="/conversations/"+id;
   const initial=await call(base,A,"/metrics",{},200);
   assert.ok(initial.open>=1);
   await call(base,A,root+"/replies",{method:"POST",body:{body:"Cannot reply before assignment"}},404);
   await call(base,A,root+"/notes",{method:"POST",body:{body:"Cannot note before assignment"}},404);
   await call(base,A,root+"/assignment",{method:"PATCH",body:{assigneeId:"<script>"}},400);
   await call(base,A,root+"/status",{method:"PATCH",body:{status:"unrecognized"}},400);
   await call(base,A,root+"/handoff",{method:"PATCH",body:{mode:"invalid"}},400);
   await call(base,A,root+"/replies",{method:"POST",body:{body:""}},400);
   await call(base,A,root+"/notes",{method:"POST",body:{body:"x".repeat(5001)}},400);
   await call(base,A,root+"/simulator/inbound",{method:"POST",body:{body:"abc",externalMessageId:""}},400);
   await call(base,A,root+"/simulator/inbound",{method:"POST",body:{body:"abc",externalMessageId:"invalid space"}},400);
   await call(base,A,root+"/assignment",{method:"PATCH",body:{assigneeId:"alice"}},200);
   const outbound=await call(base,A,root+"/replies",{method:"POST",body:{body:"Human reply"}},201);
   assert.equal(outbound.direction,"outbound");
   const note=await call(base,A,root+"/notes",{method:"POST",body:{body:"Internal note"}},201);
   assert.equal(note.direction,"internal");
   const inboundId="retry-"+randomUUID();
   const payload={body:"Inbound message",externalMessageId:inboundId};
   const received=await call(base,A,root+"/simulator/inbound",{method:"POST",body:payload},201);
   const repeat=await call(base,A,root+"/simulator/inbound",{method:"POST",body:payload},201);
   assert.equal(repeat.id,received.id,"duplicate external messages must return the original record");
   await call(base,A,root+"/simulator/inbound",{method:"POST",
    body:{...payload,body:"Different payload"}},409);
   assert.deepEqual((await call(base,A,root+"/messages",{},200)).map(x=>x.body),
    ["Human reply","Internal note","Inbound message"]);
   await call(base,A,root+"/messages?limit=0",{},400);
   await call(base,A,root+"/messages?limit=101",{},400);
   await call(base,A,root+"/status",{method:"PATCH",body:{status:"pending"}},200);
   assert.equal((await call(base,A,"/conversations?status=pending",{},200)).some(x=>x.id===id),true);
   await call(base,A,root+"/status",{method:"PATCH",body:{status:"resolved"}},200);
   await call(base,A,root+"/replies",{method:"POST",body:{body:"Forbidden after resolving"}},404);
   await call(base,A,root+"/simulator/inbound",{method:"POST",
    body:{body:"New request reopens",externalMessageId:"reopen-"+randomUUID()}},201);
   assert.equal((await call(base,A,root,{},200)).status,"open");
   await call(base,A,root+"/handoff",{method:"PATCH",body:{mode:"bot"}},200);
   await call(base,A,root+"/replies",{method:"POST",body:{body:"Handoff denies reply"}},404);
   await call(base,A,root+"/handoff",{method:"PATCH",body:{mode:"human"}},200);
   await call(base,A,root+"/assignment",{method:"PATCH",body:{assigneeId:"other-agent"}},200);
   await call(base,A,root+"/replies",{method:"POST",body:{body:"Not owner anymore"}},404);
   const audit=await pool.query(
    "SELECT action FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY id",
    [A,id]);
   assert.deepEqual(audit.rows.map(r=>r.action),[
    "created","assigned","reply","note","inbound","pending","resolved","inbound","handoff","handoff","assigned"
   ]);
  });


  await t.test("HTTP failure injection: FGA, tenant leasing, mismatched tenant and SQL errors fail closed as 503",async()=>{
   const before=tenantDatabaseResolutions.length;
   const cases=[
    ["fga",0],
    ["resolve",1],
    ["mismatchedLease",1],
    ["query",1],
   ];
   for(const [fault,expectedLeases] of cases){
    const baseline=tenantDatabaseResolutions.length;
    try{
     faults[fault]=true;
     const response=await request(base,A,"/conversations");
     expect(response,503);
     assert.equal(response.body.message.includes("private details"),false,
       "internal infrastructure errors must not leak into HTTP responses");
     assert.equal(tenantDatabaseResolutions.length-baseline,expectedLeases,
       "unexpected DB lease before fail-closed response for "+fault);
    }finally{faults[fault]=false;}
    await call(base,A,"/conversations?limit=1",{},200);
   }
   assert.ok(tenantDatabaseResolutions.length>before,"recovery requests must select a tenant DB");
  });

  await t.test("HTTP pagination boundaries and latest-first message window",async()=>{
   const root="/conversations";
   for(let i=0;i<3;i++){
    await call(base,A,root,{method:"POST",body:{subject:"Page window "+i+" "+randomUUID()}},201);
   }
   const page1=await call(base,A,root+"?limit=1",{},200);
   const page2=await call(base,A,root+"?limit=2",{},200);
   const page100=await call(base,A,root+"?limit=100",{},200);
   assert.equal(page1.length,1);
   assert.equal(page2.length,2);
   assert.ok(page100.length>=3);
   assert.deepEqual(page2.slice(0,1),page1);
   assert.equal(new Set(page100.map(c=>c.id)).size,page100.length);
   for(const invalid of ["0","101","-1","NaN","1.5",""]){
    await call(base,A,root+"?limit="+invalid,{},400);
   }
   const c=await call(base,A,root,{method:"POST",body:{subject:"Message page "+randomUUID()}},201);
   const mpath=root+"/"+c.id;
   const messages=["primeira","segunda","terceira"];
   for(const value of messages){
    await call(base,A,mpath+"/simulator/inbound",{method:"POST",
     body:{body:value,externalMessageId:"page-"+randomUUID()}},201);
   }
   const last=await call(base,A,mpath+"/messages?limit=1",{},200);
   assert.deepEqual(last.map(m=>m.body),["terceira"]);
   const latestTwo=await call(base,A,mpath+"/messages?limit=2",{},200);
   assert.deepEqual(latestTwo.map(m=>m.body),["segunda","terceira"]);
   const full=await call(base,A,mpath+"/messages?limit=100",{},200);
   assert.deepEqual(full.map(m=>m.body),messages);
   for(const invalid of ["0","101","-1","NaN","2.1",""]){
    await call(base,A,mpath+"/messages?limit="+invalid,{},400);
   }
  });

  await t.test("HTTP parallel retries use one inbound message, distinct IDs keep distinct events",async()=>{
   const conversation=await call(base,A,"/conversations",{method:"POST",
    body:{subject:"Parallel idempotency "+randomUUID()}},201);
   const path="/conversations/"+conversation.id+"/simulator/inbound";
   const externalMessageId="parallel-"+randomUUID();
   const duplicated={body:"Mesma mensagem",externalMessageId};
   const parallel=await Promise.all(Array.from({length:12},()=>
    request(base,A,path,{method:"POST",body:duplicated})));
   for(const result of parallel)expect(result,201);
   assert.equal(new Set(parallel.map(x=>x.body.id)).size,1,
     "parallel retries must return the same persisted message");
   const distinct=await Promise.all(Array.from({length:8},(_,i)=>
    request(base,A,path,{method:"POST",
     body:{body:"Unique "+i,externalMessageId:"parallel-"+randomUUID()}})));
   for(const result of distinct)expect(result,201);
   const history=await call(base,A,"/conversations/"+conversation.id+"/messages?limit=100",{},200);
   assert.equal(history.length,9);
   assert.equal(new Set(history.map(m=>m.externalMessageId)).size,9);
   const events=await pool.query(
    "SELECT count(*)::int AS count FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 AND action='inbound'",
    [A,conversation.id]);
   assert.equal(events.rows[0].count,9,"replayed external messages must not duplicate audit events");
  });
 }finally{
  if(app)await app.close();
  await pool.end();
  console.log("INBOX_HOST_HTTP_TRACE "+JSON.stringify(trace));
 }
});
