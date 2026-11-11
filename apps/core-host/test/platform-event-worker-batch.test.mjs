import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {TenantEventWorkerBatch} from "../dist/platform-event-worker-batch.js";

test("bounded worker batch never starts itself and preserves every outcome count",async()=>{
 const tenantId=randomUUID();
 const outcomes=["delivered","already_processed","retry","suspended","dead","empty"];
 const calls=[];
 const worker=new TenantEventWorkerBatch({
  routePending:async(id,limit)=>{calls.push(["route",id,limit]);return 5},
  processNext:async id=>{calls.push(["next",id]);return outcomes.shift()??"empty"},
 });
 assert.equal(calls.length,0);
 const report=await worker.run(tenantId,9);
 assert.deepEqual(report,{routed:5,attempted:5,delivered:1,alreadyProcessed:1,
  retried:1,suspended:1,dead:1,empty:true});
 assert.equal(calls.length,7);
 assert.deepEqual(calls[0],["route",tenantId,9]);
 assert.equal(Object.isFrozen(report),true);
});

test("max batch is bounded: no hidden timer or infinite drain",async()=>{
 const tenantId=randomUUID();let seen=0;
 const worker=new TenantEventWorkerBatch({
  routePending:async()=>101,
  processNext:async()=>{seen++;return "suspended"},
 });
 const report=await worker.run(tenantId,100);
 assert.equal(seen,100);
 assert.equal(report.attempted,100);
 assert.equal(report.suspended,100);
 assert.equal(report.empty,false);
});

test("input validation blocks arbitrary tenant path and invalid max",async()=>{
 let calls=0;
 const worker=new TenantEventWorkerBatch({
  routePending:async()=>{calls++;return 0},
  processNext:async()=>{calls++;return "empty"},
 });
 for(const [id,limit] of [
  ["postgres",10],[randomUUID(),0],[randomUUID(),101],
  [randomUUID(),1.1],[randomUUID(),NaN],
 ]){
  await assert.rejects(worker.run(id,limit),/Invalid trusted/);
 }
 assert.equal(calls,0);
});

test("dispatcher transport failure propagates instead of pretending success",async()=>{
 const worker=new TenantEventWorkerBatch({
  routePending:async()=>{throw Error("tenant registry down")},
  processNext:async()=>{throw Error("unexpected")},
 });
 await assert.rejects(worker.run(randomUUID()),/tenant registry down/);
});
