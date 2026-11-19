/** Session-pinned PostgreSQL advisory lock for a single signup request.
 * Holds a DEDICATED client for the entire cross-system saga; never run a
 * session advisory lock using pool.query(), and never fall back on lost lease.
 */
import type {Pool} from "pg";
import {AccessDeniedError} from "@syndes/core-kernel";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOCK_SQL="hashtextextended($1::text,20261119)";
export class PgFirstTenantSignupLock{
 constructor(private readonly control:Pick<Pool,"connect">){}
 async withRequestLock<T>(requestId:string,
  work:(assertHeld:()=>Promise<void>)=>Promise<T>):Promise<T>{
  if(!UUID.test(requestId)||typeof work!=="function")throw new AccessDeniedError();
  const key="syndes/signup/"+requestId.toLowerCase();
  const client=await this.control.connect();
  let held=false,broken=false,pid:number|undefined;
  try{
   const begin=await client.query(
    "SELECT pg_backend_pid()::int AS pid,pg_try_advisory_lock("+LOCK_SQL+") AS locked",[key]);
   if(begin.rows.length!==1||begin.rows[0].locked!==true||
      !Number.isSafeInteger(begin.rows[0].pid))throw new AccessDeniedError();
   held=true;pid=begin.rows[0].pid;
   const assertHeld=async()=>{
    if(!held||broken)throw new AccessDeniedError();
    // Reentrant acquire/unlock is a same-session continuity check, not
    // a second long-lived lock. A dead session can never issue this query.
    const again=await client.query(
     "SELECT pg_backend_pid()::int AS pid,pg_try_advisory_lock("+LOCK_SQL+") AS locked",[key]);
    if(again.rows.length!==1||again.rows[0].pid!==pid||again.rows[0].locked!==true){
     broken=true;throw new AccessDeniedError();
    }
    const inner=await client.query("SELECT pg_advisory_unlock("+LOCK_SQL+") AS unlocked",[key]);
    if(inner.rows.length!==1||inner.rows[0].unlocked!==true){
     broken=true;throw new AccessDeniedError();
    }
   };
   await assertHeld();
   const result=await work(assertHeld);
   await assertHeld();
   return result;
  }catch(error){
   // The caller sees an error even if some external step succeeded; its
   // durable intent must be reconciled on a retry.
   if(held)broken=broken||false;
   throw error;
  }finally{
   try{
    if(held&&!broken){
     const release=await client.query(
      "SELECT pg_advisory_unlock("+LOCK_SQL+") AS unlocked",[key]);
     if(release.rows.length!==1||release.rows[0].unlocked!==true)broken=true;
    }
   }catch{broken=true}
   client.release(broken);
  }
 }
}
