import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {createRequire} from "node:module";
import {PgInboxRepository} from "../dist/postgres.js";

const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Client}=require("pg");
const url=process.env.SYNDES_INBOX_SCOPE_TEST_PG_URL;

test("P02-ASSIGN-01 serializes parallel assignments and a concurrent membership revocation",{
 skip:!url&&"requires isolated PostgreSQL 17"
},async()=>{
 const tenant=randomUUID(),org=randomUUID(),ws=randomUUID(),chat=randomUUID();
 const a=new Client({connectionString:url}),b=new Client({connectionString:url}),setup=new Client({connectionString:url});
 let inTransaction=false,pending=null;
 await Promise.all([a.connect(),b.connect(),setup.connect()]);
 const lease=client=>({tenantId:tenant,query:async(sql,values)=>{
  const result=await client.query(sql,[...values]);
  return {rows:result.rows,rowCount:result.rowCount};
 }});
 try{
  await setup.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Race test',true)",[tenant,org]);
  await setup.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Primary','primary',true)",[tenant,ws,org]);
  await setup.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,'agent-a','editor'),($1,$2,'agent-b','editor')",[tenant,org]);
  await setup.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,'agent-a','editor'),($1,$2,$3,'agent-b','editor')",[tenant,org,ws]);
  await setup.query("INSERT INTO inbox_conversations(tenant_id,id,subject,channel,platform_organization_id,platform_origin_workspace_id,platform_current_workspace_id) VALUES($1,$2,'Concurrent assignment','simulation',$3,$4,$4)",[tenant,chat,org,ws]);

  const scope={organizationId:org,workspaceId:ws};
  const ra=new PgInboxRepository(lease(a),scope);
  const rb=new PgInboxRepository(lease(b),scope);

  // Both requests may start at once. Conversation row lock must serialize
  // them without a SHARE->UPDATE deadlock or a duplicate/missing audit.
  const [one,two]=await Promise.all([
   ra.assign(tenant,chat,"supervisor","agent-a"),
   rb.assign(tenant,chat,"supervisor","agent-b")
  ]);
  assert.equal(one.assignedTo,"agent-a");
  assert.equal(two.assignedTo,"agent-b");
  let rows=(await setup.query("SELECT action FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 AND action='assigned'",[tenant,chat])).rows;
  assert.equal(rows.length,2,"Two different successful assignments produce two audits");
  // Competing calls are concurrent: completion order does not determine commit order.
  // Preserve the actual committed assignee as the baseline for the denied call below.
  const prior=(await setup.query("SELECT assigned_to FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",[tenant,chat])).rows[0].assigned_to;
  assert.ok(["agent-a","agent-b"].includes(prior),"Both successful racing targets are eligible");

  // Revocation obtains an exclusive lock first. The second connection
  // must await it, then re-evaluate the state instead of authorizing from
  // an obsolete snapshot, even if the current assignee is the same.
  await a.query("BEGIN");
  inTransaction=true;
  await a.query("UPDATE platform_workspace_memberships SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3 AND principal_id='agent-b'",[tenant,org,ws]);
  let settled=false;
  pending=rb.assign(tenant,chat,"supervisor","agent-b");
  pending.then(()=>{settled=true},()=>{settled=true});
  await new Promise(done=>setTimeout(done,130));
  assert.equal(settled,false,"Assignment must wait for the competing membership state change");
  await a.query("COMMIT");
  inTransaction=false;
  assert.equal(await pending,null,"Revoked target cannot be reassigned or acknowledged as a valid no-op");
  const current=await setup.query("SELECT assigned_to FROM inbox_conversations WHERE tenant_id=$1 AND id=$2",[tenant,chat]);
  assert.equal(current.rows[0].assigned_to,prior,"Denied call must not mutate the previous assignment");
  rows=(await setup.query("SELECT action FROM inbox_events WHERE tenant_id=$1 AND conversation_id=$2 AND action='assigned'",[tenant,chat])).rows;
  assert.equal(rows.length,2,"Denied call cannot add audit");

  assert.equal((await ra.assign(tenant,chat,"supervisor",null)).assignedTo,null,"Release remains available");
 }finally{
  if(inTransaction)await a.query("ROLLBACK");
  if(pending)await pending.catch(()=>{});
  try{
   await setup.query("DELETE FROM inbox_events WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM inbox_messages WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM inbox_conversations WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM platform_workspace_memberships WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM platform_org_memberships WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM platform_workspaces WHERE tenant_id=$1",[tenant]);
   await setup.query("DELETE FROM platform_organizations WHERE tenant_id=$1",[tenant]);
  }finally{
   await Promise.all([a.end(),b.end(),setup.end()]);
  }
 }
});
