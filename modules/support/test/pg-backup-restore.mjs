/**
 * CI ONLY: full Support backup -> restore exercise on disposable PostgreSQL.
 * Guard is intentionally exact; never accepts production DSNs or a caller-selected database.
 * No customer data, no external service calls, no destructive production SQL.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {readFile} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import pg from "pg";

const allowed="postgresql://postgres:ci-only-disposable@localhost:5432/postgres";
if(process.env.GITHUB_ACTIONS!=="true"||
 process.env.SYNDES_DISPOSABLE_RESTORE_REHEARSAL!=="true"||
 process.env.SYNDES_SUPPORT_TEST_PG_URL!==allowed)
 throw new Error("Support backup/restore can only run on the explicit disposable CI Postgres fixture");
const id=randomUUID().replaceAll("-","").slice(0,12);
const SOURCE="syndes_ci_support_source_"+id;
const RECOVERY="syndes_ci_support_recovered_"+id;
const T="11111111-1111-4111-8111-111111111111";
const person=randomUUID(),conversation=randomUUID(),caseId=randomUUID();
const migrations=[
 "../../core-crm/sql/001_crm_foundation.sql",
 "../../core-crm/sql/002_crm_tags_notes.sql",
 "../../core-crm/sql/003_crm_employees_channels.sql",
 "../../inbox/sql/001_inbox_foundation.sql",
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
 "../../organizations/sql/006_context_creation_audit.sql",
 "../sql/001_support_cases.sql"
];
const source=path=>readFile(new URL(path,import.meta.url),"utf8");
const strip=sql=>sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const dbFor=name=>new pg.Client({connectionString:allowed.replace(/\/postgres$/, "/"+name)});
function dockerPg(args,input){
 const proc=spawnSync("docker",[
  "run","--rm","--network","host",
  "--read-only","-e","PGPASSWORD=ci-only-disposable",
  "postgres:16",...args
 ],{input,encoding:null,maxBuffer:32*1024*1024,timeout:120_000});
 if(proc.error||proc.status!==0)throw new Error("Disposable postgres image command failed: "+
   (proc.error?.message??proc.stderr?.toString("utf8").slice(-1200)??proc.status));
 return proc.stdout;
}
const admin=new pg.Client({connectionString:allowed});
let origin,recovered;
try{
 await admin.connect();
 for(const dbName of [SOURCE,RECOVERY])await admin.query('CREATE DATABASE "'+dbName+'"');
 origin=dbFor(SOURCE);await origin.connect();
 await origin.query("BEGIN");
 try{
  for(const migration of migrations)await origin.query(strip(await source(migration)));
  await origin.query("INSERT INTO support_queue_memberships(tenant_id,queue_code,principal_id,role,granted_by) VALUES($1,'it_infra','ci-agent','agent','ci-operator')",[T]);
  await origin.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Fixture only')",[T,person]);
  await origin.query("INSERT INTO inbox_conversations(tenant_id,id,subject,channel,crm_person_id) VALUES($1,$2,'Fixture conversation','simulation',$3)",[T,conversation,person]);
  await origin.query("INSERT INTO support_cases(tenant_id,id,kind,channel,requester_id,queue_code,priority,status) VALUES($1,$2,'internal','form','ci-employee','it_infra','critical','new')",[T,caseId]);
  await origin.query("INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,next_status,body) VALUES($1,$2,'ci-employee','created','new','Synthetic case for restore')",[T,caseId]);
  await origin.query("INSERT INTO support_case_events(tenant_id,case_id,actor_id,action,body) VALUES($1,$2,'ci-agent','internal_note','Synthetic private note for backup')",[T,caseId]);
  await origin.query("COMMIT");
 }catch(e){await origin.query("ROLLBACK");throw e;}
 await origin.end();origin=null;
 const dump=dockerPg(["pg_dump","-h","127.0.0.1","-U","postgres","-d",SOURCE,"-Fc","--no-owner","--no-acl"]);
 assert.ok(dump.byteLength>1000,"Snapshot is unexpectedly empty");
 dockerPg(["pg_restore","-h","127.0.0.1","-U","postgres","-d",RECOVERY,
   "--exit-on-error","--no-owner","--no-acl"],dump);
 recovered=dbFor(RECOVERY);await recovered.connect();
 const invariant=async(db)=>{
  const facts=await db.query(`SELECT
    (SELECT count(*)::int FROM support_cases WHERE tenant_id=$1 AND id=$2) cases,
    (SELECT count(*)::int FROM support_case_events WHERE tenant_id=$1 AND case_id=$2) events,
    (SELECT count(*)::int FROM support_queue_membership_audit WHERE tenant_id=$1) grants,
    (SELECT count(*)::int FROM pg_indexes WHERE indexname LIKE 'platform_legacy_single_%') legacy_indexes,
    (SELECT count(*)::int FROM support_case_events WHERE action='internal_note'
      AND body='Synthetic private note for backup') private_notes`,[T,caseId]);
  return facts.rows[0];
 };
 const expectFacts={cases:1,events:2,grants:1,legacy_indexes:2,private_notes:1};
 assert.deepEqual(await invariant(recovered),expectFacts,"Restore must preserve Support state, notes, audit and SQL 002");
 assert.equal((await recovered.query("SELECT status FROM support_cases WHERE tenant_id=$1 AND id=$2",[T,caseId])).rows[0].status,"new");
 // Rehearse transactional rollback AFTER restore, proving state/events cannot be lost.
 await recovered.query("BEGIN");
 await recovered.query("UPDATE support_cases SET status='closed' WHERE tenant_id=$1 AND id=$2",[T,caseId]);
 await recovered.query("DELETE FROM support_case_events WHERE tenant_id=$1 AND case_id=$2",[T,caseId]);
 await recovered.query("ROLLBACK");
 assert.deepEqual(await invariant(recovered),expectFacts,"Rollback must undo destructive rehearsal without removing notes");
 assert.equal((await recovered.query("SELECT status FROM support_cases WHERE tenant_id=$1 AND id=$2",[T,caseId])).rows[0].status,"new");
 console.log("Support full migrations, synthetic snapshot, restore, private notes, membership audit and transaction rollback: PASS");
}finally{
 if(origin)await origin.end().catch(()=>{});
 if(recovered)await recovered.end().catch(()=>{});
 for(const dbName of [SOURCE,RECOVERY]){
  if(admin._connected)await admin.query('DROP DATABASE IF EXISTS "'+dbName+'"').catch(()=>{});
 }
 await admin.end().catch(()=>{});
}
