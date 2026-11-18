import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {createRequire} from "node:module";
import {PgInboxRepository} from "../dist/postgres.js";

const require=createRequire(new URL("../../../apps/core-host/package.json",import.meta.url));
const {Client}=require("pg");
const uri=process.env.SYNDES_INBOX_SCOPE_TEST_PG_URL;
const safe=(()=>{
 try{
  const u=new URL(uri);
  return u.hostname==="127.0.0.1"&&u.port==="54339"&&
   u.pathname==="/postgres"&&u.username==="postgres";
 }catch{return false}
})();
const migrations=[
 "../../core-crm/sql/001_crm_foundation.sql",
 "../../core-crm/sql/002_crm_tags_notes.sql",
 "../../core-crm/sql/003_crm_employees_channels.sql",
 "../sql/001_inbox_foundation.sql",
 "../../whatsapp/sql/001_whatsapp_accounts.sql",
 "../../whatsapp/sql/002_whatsapp_inbound.sql",
 "../../whatsapp/sql/003_whatsapp_outbound_inbox.sql",
 "../../whatsapp/sql/004_whatsapp_conversation_phone.sql",
 "../../whatsapp/sql/005_whatsapp_history.sql",
 "../../whatsapp/sql/006_whatsapp_contact_names.sql",
 "../../whatsapp/sql/007_whatsapp_delivery_receipts.sql",
 "../../organizations/sql/001_account_hierarchy.sql",
 "../../organizations/sql/002_legacy_single_context_gate.sql",
 "../../organizations/sql/003_legacy_ownership.sql",
 "../../organizations/sql/004_whatsapp_route_owner_guard.sql",
 "../../organizations/sql/005_scoped_relationship_integrity.sql",
];
const strip=s=>s.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const read=p=>readFile(new URL(p,import.meta.url),"utf8");

test("IAM-07C PG17 Inbox transfer: destination revocation is fenced until effect/audit",{
 skip:!safe&&"Only disposable Inbox PostgreSQL loopback 54339 is permitted",
},async()=>{
 const tenant=randomUUID(),org=randomUUID(),source=randomUUID(),
  destination=randomUUID(),conversation=randomUUID();
 const schema="inbox_iam07c_"+randomUUID().replaceAll("-","").slice(0,16);
 const setup=new Client({connectionString:uri});
 const revoker=new Client({connectionString:uri});
 const transfer=new Client({connectionString:uri});
 let schemaCreated=false,tx=false,pending=null;
 await Promise.all([setup.connect(),revoker.connect(),transfer.connect()]);
 try{
  await setup.query("CREATE SCHEMA "+schema);
  schemaCreated=true;
  for(const client of [setup,revoker,transfer])
   await client.query("SET search_path TO "+schema);
  for(const path of migrations)await setup.query(strip(await read(path)));
  // The operating SQL002 is never changed. This ISOLATED disposable
  // schema intentionally lifts the multi-workspace index for a racing test.
  await setup.query("DROP INDEX platform_legacy_single_workspace");
  await setup.query(`INSERT INTO platform_organizations
   (tenant_id,id,display_name,is_default) VALUES($1,$2,'IAM07C org',true)`,
   [tenant,org]);
  await setup.query(`INSERT INTO platform_workspaces
   (tenant_id,id,organization_id,name,slug,is_default)
   VALUES($1,$2,$3,'Source','src',true),($1,$4,$3,'Destination','dst',false)`,
   [tenant,source,org,destination]);
  await setup.query(`INSERT INTO platform_org_memberships
   (tenant_id,organization_id,principal_id,role)
   VALUES($1,$2,'trusted-operator','admin')`,[tenant,org]);
  await setup.query(`INSERT INTO platform_workspace_memberships
   (tenant_id,organization_id,workspace_id,principal_id,role)
   VALUES($1,$2,$3,'trusted-operator','admin'),
    ($1,$2,$4,'trusted-operator','editor')`,
   [tenant,org,source,destination]);
  await setup.query(`INSERT INTO inbox_conversations
   (tenant_id,id,subject,channel,platform_organization_id,
    platform_origin_workspace_id,platform_current_workspace_id)
   VALUES($1,$2,'Fence test','simulation',$3,$4,$4)`,
   [tenant,conversation,org,source]);
  const repo=new PgInboxRepository({
   tenantId:tenant,query:async(sql,values)=>{
    const r=await transfer.query(sql,[...values]);
    return {rows:r.rows,rowCount:r.rowCount};
   },
  },{organizationId:org,workspaceId:source});
  await revoker.query("BEGIN");
  tx=true;
  await revoker.query(`UPDATE platform_workspace_memberships
   SET state='revoked' WHERE tenant_id=$1 AND organization_id=$2
   AND workspace_id=$3 AND principal_id='trusted-operator'`,
   [tenant,org,destination]);
  let settled=false;
  pending=repo.transferWorkspace(tenant,conversation,"trusted-operator",destination);
  pending.then(()=>{settled=true},()=>{settled=true});
  await new Promise(done=>setTimeout(done,160));
  assert.equal(settled,false,
   "Transfer must not commit while destination membership revoke is pending");
  await revoker.query("COMMIT");
  tx=false;
  assert.equal(await pending,null,
   "Transfer must recheck membership after revocation commits");
  pending=null;
  assert.equal((await setup.query(`SELECT platform_current_workspace_id AS ws
   FROM inbox_conversations WHERE tenant_id=$1 AND id=$2`,
   [tenant,conversation])).rows[0].ws,source);
  assert.equal((await setup.query(`SELECT count(*)::int AS n FROM inbox_events
   WHERE tenant_id=$1 AND conversation_id=$2
    AND action='workspace_transferred'`,
   [tenant,conversation])).rows[0].n,0);
  await setup.query(`UPDATE platform_workspace_memberships SET state='active'
   WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3
    AND principal_id='trusted-operator'`,[tenant,org,destination]);
  assert.equal((await repo.transferWorkspace(tenant,conversation,
   "trusted-operator",destination))?.id,conversation);
  assert.equal((await setup.query(`SELECT count(*)::int AS n FROM inbox_events
   WHERE tenant_id=$1 AND conversation_id=$2
    AND action='workspace_transferred'`,
   [tenant,conversation])).rows[0].n,1);
  console.log("IAM07C_PG17_INBOX_TRANSFER_DESTINATION_REVOKE_FENCE_PASS");
 }finally{
  if(tx)await revoker.query("ROLLBACK").catch(()=>{});
  if(pending)await pending.catch(()=>{});
  await Promise.all([setup.end(),revoker.end(),transfer.end()]);
  if(schemaCreated){
   const clean=new Client({connectionString:uri});
   await clean.connect();
   try{await clean.query("DROP SCHEMA "+schema+" CASCADE")}
   finally{await clean.end()}
  }
 }
});
