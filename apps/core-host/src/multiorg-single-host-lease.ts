/**
 * Multi-org single Core Host deployment lease.
 *
 * The Inbox SSE invalidation bus is in-process. Until a shared broker is
 * installed, exactly ONE serving Core Host may run against a Control DB.
 * PostgreSQL session advisory lock serializes all Core replicas; losing the
 * pinned connection is fatal so a partitioned second instance cannot serve.
 */
import type {Pool,PoolClient} from "pg";

const LOCK_A=20506,LOCK_B=20261118;
type Control=Pick<Pool,"connect">;
export class MultiOrgSingleHostLease{
 private client?:PoolClient;
 private pending?:Promise<void>;
 private lost=false;
 constructor(private readonly control:Control,
  private readonly onLost:()=>void=()=>{}){}
 async acquire():Promise<void>{
  if(this.lost)throw Error("Multi-org singleton lease previously lost");
  if(this.client)return;
  if(this.pending)return this.pending;
  const task=this.take();
  this.pending=task;
  try{await task}finally{if(this.pending===task)this.pending=undefined}
 }
 private async take():Promise<void>{
  const client=await this.control.connect();
  try{
   const result=await client.query(
    "SELECT pg_try_advisory_lock($1::int,$2::int) AS acquired",
    [LOCK_A,LOCK_B]);
   if(result.rows.length!==1||result.rows[0].acquired!==true)
    throw Error("Another Core Host already owns multi-org singleton lease");
   // A session-level lock cannot be held by an ordinary pool.query.
   // Never release this client into the pool while serving requests.
   this.client=client;
   client.on("error",()=>{
    this.lost=true;
    this.client=undefined;
    try{this.onLost()}catch{/* Core process handles fatal exit */}
   });
  }catch(error){
   client.release(true);
   throw error;
  }
 }
 assertHeld():void{
  if(this.lost||!this.client)throw Error("Multi-org singleton unavailable");
 }
 async close():Promise<void>{
  const pending=this.pending;
  if(pending)await pending.catch(()=>{});
  const client=this.client;
  this.client=undefined;
  if(!client)return;
  try{
   await client.query("SELECT pg_advisory_unlock($1::int,$2::int)",
    [LOCK_A,LOCK_B]);
  }catch{/* connection may have been lost already */}
  finally{client.release(true)}
 }
}
