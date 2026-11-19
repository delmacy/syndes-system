import test from "node:test";
import assert from "node:assert/strict";
import {MultiOrgSingleHostLease} from "../dist/multiorg-single-host-lease.js";

function fake(){
 let owner=null,seq=0;
 const pool={connect:async()=>{
  const id=++seq,events=new Map();
  return {
   async query(sql,params){
    assert.deepEqual(params,[20506,20261118]);
    if(sql.includes("pg_try_advisory_lock")){
     const acquired=owner===null||owner===id;
     if(acquired)owner=id;
     return {rows:[{acquired}],rowCount:1};
    }
    if(sql.includes("pg_advisory_unlock")){
     if(owner===id)owner=null;
     return {rows:[{pg_advisory_unlock:true}],rowCount:1};
    }
    throw Error("Unexpected lease SQL");
   },
   on(name,fn){events.set(name,fn)},
   release(){if(owner===id)owner=null},
   simulateLoss(){if(owner===id)owner=null;events.get("error")?.(Error("connection lost"))},
   simulateEnd(){if(owner===id)owner=null;events.get("end")?.()},
  };
 }};
 return pool;
}
test("only one Core Host can own a multi-org PostgreSQL session lease",async()=>{
 const pool=fake(),first=new MultiOrgSingleHostLease(pool),
  second=new MultiOrgSingleHostLease(pool);
 await Promise.all([first.acquire(),first.acquire(),first.acquire()]);
 first.assertHeld();
 await assert.rejects(second.acquire(),/Another Core Host/);
 await first.close();
 await second.acquire();
 second.assertHeld();
 await second.close();
});
test("lost singleton session fails closed and cannot silently reacquire",async()=>{
 const pool=fake(),clients=[];
 const logged={n:0};
 const original=pool.connect;
 pool.connect=async()=>{const c=await original();clients.push(c);return c};
 const first=new MultiOrgSingleHostLease(pool,()=>logged.n++);
 await first.acquire();
 clients[0].simulateLoss();
 assert.equal(logged.n,1);
 assert.throws(()=>first.assertHeld(),/singleton unavailable/);
 await assert.rejects(first.acquire(),/previously lost/);
 await first.close();
});

test("a graceful but UNEXPECTED PostgreSQL session end also revokes singleton readiness",async()=>{
 const pool=fake(),clients=[];
 const connect=pool.connect;
 pool.connect=async()=>{const c=await connect();clients.push(c);return c};
 let lost=0;
 const lease=new MultiOrgSingleHostLease(pool,()=>lost++);
 await lease.acquire();
 clients[0].simulateEnd();
 assert.equal(lost,1);
 assert.throws(()=>lease.assertHeld(),/singleton unavailable/);
 await assert.rejects(lease.acquire(),/previously lost/);
 await lease.close();
});
