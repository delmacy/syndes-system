import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {PgInboxRepository,InboxConflictError} from "../dist/index.js";
const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Pool}=require("pg");
const A="4ab44379-d557-4df6-a2be-d44e121a8077",B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const P="cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const KEY="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const pool=new Pool({connectionString:"postgres://postgres:ci-inbox-only@127.0.0.1:54339/postgres",max:2});
let session;
const lease=t=>({tenantId:t,query:async(sql,values)=>{const r=await session.query(sql,values);return {rows:r.rows,rowCount:r.rowCount}}});
test("PostgreSQL real migrations, CRM FK, tenant scoping and message idempotency",async()=>{
 // The next Core Host HTTP suite uses the SAME disposable DB. Always roll
 // back this test's organizations, workspaces and conversations, even on failure.
 session=await pool.connect();
 try{
  await session.query("BEGIN");
  // P02-ASSIGN-01 requires a real current org/workspace and active recipient.
  const OA="a1111111-1111-4111-8111-111111111111",OB="b2222222-2222-4222-8222-222222222222";
  const WA="a3333333-3333-4333-8333-333333333333",WB="b4444444-4444-4444-8444-444444444444";
  await session.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Tenant A',true),($3,$4,'Tenant B',true)",[A,OA,B,OB]);
  await session.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'A Workspace','main',true),($4,$5,$6,'B Workspace','main',true)",[A,WA,OA,B,WB,OB]);
  await session.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'alice','admin'),($3,$4,'bob','admin')",[A,OA,B,OB]);
  await session.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'alice','admin'),($4,$5,$6,'bob','admin')",[A,OA,WA,B,OB,WB]);
  await session.query("INSERT INTO crm_people(id,tenant_id,name,platform_organization_id) VALUES($1,$2,'Test Person',$3)",[P,A,OA]);
  const a=new PgInboxRepository(lease(A),{organizationId:OA,workspaceId:WA}),b=new PgInboxRepository(lease(B),{organizationId:OB,workspaceId:WB});
  const c=await a.create(A,"alice",{id:KEY,subject:"Teste Inbox",crmPersonId:P,externalThreadId:"sim-case"});
  assert.equal(c.crmPersonId,P);
  assert.equal(await b.get(B,KEY),null);
  assert.equal(await b.messages(B,KEY,10),null);
  await assert.rejects(b.create(B,"bob",{id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    subject:"FK mismatch",crmPersonId:P,externalThreadId:null}),/Invalid CRM reference/);
  assert.deepEqual((await b.list(B,null,50)),[]);
  assert.equal(await b.append(B,KEY,"bob",{id:"c26d5055-814b-41b5-a427-8d0c21e2cdf9",direction:"inbound",body:"no",externalMessageId:"x"}),null);
  assert.equal(await a.assign(A,KEY,"alice","ghost"),null);
  assert.equal((await a.get(A,KEY)).assignedTo,null,"Invalid recipient is never stored");
  await a.assign(A,KEY,"alice","alice");
  assert.equal((await a.list(A,null,100,"mine","alice")).length,1);
  assert.deepEqual(await a.list(A,null,100,"mine","bob"),[]);
  assert.deepEqual(await a.list(A,null,100,"unassigned","alice"),[]);
  assert.deepEqual(await b.list(B,null,100,"mine","alice"),[]);
  const msg={id:"87f34471-aaac-4d67-b4e6-e15c910632aa",direction:"inbound",body:"Olá",externalMessageId:"rx-001"};
  const first=await a.append(A,KEY,"sim",msg);
  assert.equal(first.direction,"inbound");
  const replay=await a.append(A,KEY,"sim",{...msg,id:"32f40b0c-c6aa-48b1-9f09-c4b17ba8136b"});
  assert.equal(replay.id,first.id);
  await assert.rejects(a.append(A,KEY,"sim",{...msg,id:"998cb831-110b-4560-b4a9-b11c2271834d",body:"Alterado"}),InboxConflictError);
  assert.equal((await a.messages(A,KEY,100)).length,1);
  const sent=await a.append(A,KEY,"alice",{id:"839d48f6-236b-476f-93b1-a6b0367490af",direction:"outbound",body:"Oi",externalMessageId:null});
  assert.equal(sent.direction,"outbound");
  assert.equal(await a.append(A,KEY,"other",{id:"c26d5055-814b-41b5-a427-8d0c21e2cdf9",direction:"outbound",body:"Not owner",externalMessageId:null}),null);
  await a.status(A,KEY,"alice","resolved");
  assert.equal(await a.append(A,KEY,"alice",{id:"c26d5055-814b-41b5-a427-8d0c21e2cdf9",direction:"outbound",body:"closed",externalMessageId:null}),null);
  await a.append(A,KEY,"sim",{id:"89b4e81e-b429-4393-be54-6814898e9102",direction:"inbound",body:"Reabertura",externalMessageId:"rx-002"});
  assert.equal((await a.get(A,KEY)).status,"open");
  assert.equal((await a.metrics(A)).open,1);
  assert.equal((await b.metrics(B)).open,0);
  const audit=await session.query("SELECT action FROM inbox_events WHERE tenant_id=$1 ORDER BY id",[A]);
  assert.deepEqual(audit.rows.map(x=>x.action),["created","assigned","inbound","reply","resolved","inbound"]);
  const history=await a.messages(A,KEY,100);
  assert.equal(history.length,3);
  assert.deepEqual(history.map(x=>x.body),["Olá","Oi","Reabertura"]);
 }finally{
  try{await session.query("ROLLBACK")}
  finally{session.release();await pool.end()}
 }
});
