/**
 * TOPO-03C: real PostgreSQL 17 TWO-CONNECTION transaction race.
 * Runs exclusively in disposable IAM06B tenant DB, AFTER multi-org
 * rollback-only topology test. Does not change schema or production.
 *
 * The existing IAM07D2 fixture provisions a transfer fence at epoch 1
 * for tenant's default organization/workspace; this lab tests the same
 * exact row, never relies on a second uncommitted fixture to mimic races.
 */
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
const TENANT="11111111-1111-4111-8111-111111111111";
const ORG="22222222-2222-4222-8222-222222222222";
const WS="44444444-4444-4444-8444-444444444444";
const CAP="inbox.conversation.transfer";
const select="SELECT epoch::text AS epoch,state FROM platform_iam_capability_fences"+
 " WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3"+
 " AND principal_id=$4 AND capability=$5";
const values=actor=>[TENANT,ORG,WS,actor,CAP];
const denyCode=e=>e?.code==="55P03";
const rollback=async client=>client.query("ROLLBACK").catch(()=>{});

export async function runIamRevocationConcurrentPg17Lab(f){
 assert.equal(process.env.CI_MASTER_REAL_PG,"1");
 assert.equal(process.env.SYNDES_IAM06B_REAL,"IAM06B_DISPOSABLE_ONLY");
 const a=await f.tenantDb.connect(),b=await f.tenantDb.connect();
 try{
  assert.notEqual(a.processID,b.processID,"Two independent physical PG sessions required");
  const actor=f.actorId,v=values(actor);
  const initial=await a.query(select,v);
  assert.equal(initial.rows.length,1);
  assert.deepEqual(initial.rows[0],{epoch:"1",state:"active"});
  await a.query("CREATE TABLE iam_topo03c_effects(id uuid PRIMARY KEY)");
  // Business writer gets a SHARE lock on the fence BEFORE its effect.
  // Concurrent revoke cannot skip that barrier.
  await a.query("BEGIN");
  await a.query("SET LOCAL lock_timeout='2000ms'");
  const admitted=await a.query(select+" AND state='active' FOR SHARE",v);
  assert.equal(admitted.rows.length,1);
  await a.query("INSERT INTO iam_topo03c_effects(id) VALUES($1)",[randomUUID()]);
  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout='2000ms'");
  await assert.rejects(b.query(select+" FOR UPDATE NOWAIT",v),denyCode,
   "Revoke writer must not overtake the business effect holding SHARE");
  await rollback(b);
  await a.query("COMMIT");
  assert.equal((await f.tenantDb.query(
   "SELECT count(*)::int AS n FROM iam_topo03c_effects")).rows[0].n,1);
  console.log("IAM_TOPO03C_PG17_WRITE_FIRST_LOCK_SERIALIZATION_PASS");

  // Revoke-first: UPDATE fence and enqueue durable outbox inside same
  // transaction. Until COMMIT, a different writer MUST NOT pass the row.
  const operation=randomUUID();
  await b.query("BEGIN");
  await b.query("SET LOCAL lock_timeout='2000ms'");
  const updated=await b.query(
   "UPDATE platform_iam_capability_fences"+
   " SET state='revoked',epoch=epoch+1,last_revoke_operation_id=$6,"+
   " changed_at=clock_timestamp() WHERE tenant_id=$1"+
   " AND organization_id=$2 AND workspace_id=$3 AND principal_id=$4"+
   " AND capability=$5 AND state='active' AND epoch=1"+
   " RETURNING epoch::text AS epoch",[...v,operation]);
  assert.deepEqual(updated.rows,[{epoch:"2"}]);
  await b.query(
   "INSERT INTO platform_iam_revocation_outbox"+
   "(operation_id,tenant_id,organization_id,workspace_id,principal_id,"+
   " capability,revoked_epoch) VALUES($1,$2,$3,$4,$5,$6,2)",
   [operation,...v]);
  await a.query("BEGIN");
  await a.query("SET LOCAL lock_timeout='2000ms'");
  await assert.rejects(a.query(select+" AND state='active' FOR SHARE NOWAIT",v),
   denyCode,"Business writer must not pass uncommitted tenant-first revoke");
  await rollback(a);
  // Independent reader cannot observe outbox before the fence commit.
  assert.equal((await a.query(
   "SELECT count(*)::int AS n FROM platform_iam_revocation_outbox"+
   " WHERE operation_id=$1",[operation])).rows[0].n,0);
  await b.query("COMMIT");
  await a.query("BEGIN");
  const stale=await a.query(select+" AND state='active' FOR SHARE",v);
  assert.equal(stale.rows.length,0,
   "Stale tickets must deny after committed revocation");
  const newEpoch=await a.query(select,v);
  assert.deepEqual(newEpoch.rows,[{epoch:"2",state:"revoked"}]);
  await a.query("COMMIT");
  const durable=await a.query(
   "SELECT revoked_epoch::text AS epoch,state FROM platform_iam_revocation_outbox"+
   " WHERE operation_id=$1",[operation]);
  assert.deepEqual(durable.rows,[{epoch:"2",state:"pending"}]);
  assert.equal((await a.query(
   "SELECT count(*)::int AS n FROM iam_topo03c_effects")).rows[0].n,1);
  const other=await a.query(
   "SELECT count(*)::int AS n FROM platform_iam_capability_fences"+
   " WHERE tenant_id=$1 AND organization_id=$2 AND workspace_id=$3"+
   " AND principal_id=$4 AND capability='inbox.conversation.claim'",
   [TENANT,ORG,WS,actor]);
  assert.equal(other.rows[0].n,1,
   "Different capability fence remains independent");
  console.log("IAM_TOPO03C_PG17_REVOKE_FIRST_STALE_WRITE_DENY_OUTBOX_ATOMIC_PASS");
 }finally{
  await rollback(a);await rollback(b);
  a.release();b.release();
 }
}
