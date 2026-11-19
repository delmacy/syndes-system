/**
 * UC-SIGNUP-01C: dedicated operator-only provider for a FIRST tenant DB.
 *
 * The HTTP Core TenantPgProvider intentionally refuses tenant_registry.state
 * 'provisioned'. This trusted provider must NOT be registered in Nest or
 * passed to a tenant API. Its only tenant identity comes from a founder-bound,
 * durable Control reservation; the connection factory gets canonical names,
 * never a DSN, name, role, or password from HTTP.
 */
import {
 AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TenantDatabase,type TenantTransaction,
 type TrustedTenantTransactionProvider,type TrustedTenantDatabaseProvider,
} from "@syndes/core-kernel";
import type {Pool} from "pg";
import type {SignupReservation} from "./signup-control-intents.js";
import {expectedTenantDatabase} from "./tenant-database.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type Query=Pick<Pool,"query">;
type Source=Readonly<{
 /** Operator factory retrieves the fixed tenant credential from its
  * protected secret source; no browser-supplied DSN or SQL superuser. */
 open(databaseName:string,roleName:string):Promise<Pool>;
}>;
const TX_BOUNDARY=/(?:^|;)\s*(?:BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|SET\s+ROLE)\b/i;

export class PgSignupProvisionedTenantProvider implements
 TrustedTenantTransactionProvider,TrustedTenantDatabaseProvider {
 private pool:Pool|null=null;
 private opening:Promise<Pool>|null=null;
 constructor(private readonly intent:SignupReservation,
  private readonly control:Query,private readonly source:Source){
  if(!intent||![intent.requestId,intent.founderId,intent.tenantId,
   intent.organizationId,intent.workspaceId].every(v=>UUID.test(v))||
   !control?.query||typeof source?.open!=="function")
   throw new AccessDeniedError();
 }
 private async authorized(tenantId:string):Promise<Readonly<{
  databaseName:string;roleName:string;
 }>>{
  if(tenantId!==this.intent.tenantId)throw new AccessDeniedError();
  const expected=expectedTenantDatabase(tenantId);
  const res=await this.control.query(`
   SELECT t.database_name,t.role_name,t.state AS tenant_state,
      i.state AS intent_state
   FROM public.platform_signup_intents i
   JOIN public.tenant_registry t ON t.tenant_id=i.tenant_id
   JOIN public.tenant_memberships m ON m.tenant_id=t.tenant_id
     AND m.principal_id=i.founder_id::text AND m.state='active'
   WHERE i.request_id=$1::uuid AND i.founder_id=$2::uuid
     AND i.tenant_id=$3::uuid AND i.organization_id=$4::uuid
     AND i.workspace_id=$5::uuid
     AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships bad
       WHERE bad.tenant_id=t.tenant_id
         AND bad.principal_id<>i.founder_id::text)
   LIMIT 2
  `,[this.intent.requestId,this.intent.founderId,this.intent.tenantId,
   this.intent.organizationId,this.intent.workspaceId]);
  if(res.rows.length!==1)throw new AccessDeniedError();
  const row=res.rows[0];
  if(row.database_name!==expected.database_name||
     row.role_name!==expected.role_name||
     !((row.tenant_state==="provisioned"&&
       ["reserved","reconcile_required"].includes(String(row.intent_state)))||
       (row.tenant_state==="active"&&row.intent_state==="ready")))
   throw new AccessDeniedError();
  return {databaseName:expected.database_name,roleName:expected.role_name};
 }
 private async poolFor(tenantId:string):Promise<Pool>{
  const names=await this.authorized(tenantId);
  if(this.pool)return this.pool;
  if(!this.opening){
   this.opening=(async()=>{
    const pool=await this.source.open(names.databaseName,names.roleName);
    if(!pool||typeof pool.connect!=="function"||
       typeof pool.query!=="function"||typeof pool.end!=="function")
     throw new AccessDeniedError();
    try{
     const identity=await pool.query(
      "SELECT current_database() AS database_name,current_user AS role_name");
     if(identity.rows.length!==1||
       identity.rows[0].database_name!==names.databaseName||
       identity.rows[0].role_name!==names.roleName)
      throw new AccessDeniedError();
     return pool;
    }catch(err){await pool.end().catch(()=>{});throw err}
   })();
  }
  try{this.pool=await this.opening;return this.pool}
  finally{this.opening=null}
 }
 async resolve(tenantId:string):Promise<TenantDatabase>{
  const pool=await this.poolFor(tenantId);
  return Object.freeze({
   tenantId,query:async(sql:string,values:readonly unknown[])=>{
    await this.authorized(tenantId);
    if(TX_BOUNDARY.test(sql))throw new AccessDeniedError();
    const result=await pool.query(sql,[...values]);
    return {rows:result.rows as Record<string,unknown>[],rowCount:result.rowCount};
   },
  });
 }
 async withTransaction<T>(tenantId:string,
  work:(tx:TenantTransaction)=>Promise<T>):Promise<T>{
  const pool=await this.poolFor(tenantId);
  const client=await pool.connect();
  let active=false;
  try{
   const identity=await client.query(
    "SELECT current_database() AS database_name,current_user AS role_name");
   const expected=expectedTenantDatabase(tenantId);
   if(identity.rows.length!==1||
      identity.rows[0].database_name!==expected.database_name||
      identity.rows[0].role_name!==expected.role_name)
    throw new AccessDeniedError();
   await this.authorized(tenantId);
   await client.query("BEGIN");
   active=true;
   const tx:TenantTransaction=Object.freeze({
    tenantId,[PINNED_TENANT_TRANSACTION]:true as const,
    query:async(sql:string,values:readonly unknown[])=>{
     if(!active||typeof sql!=="string"||TX_BOUNDARY.test(sql))
      throw new AccessDeniedError();
     // Prevent a suspended/replaced Control scope from entering a new write.
     await this.authorized(tenantId);
     const r=await client.query(sql,[...values]);
     return {rows:r.rows as Record<string,unknown>[],rowCount:r.rowCount};
    },
   });
   const result=await work(tx);
   await this.authorized(tenantId);
   active=false;
   await client.query("COMMIT");
   return result;
  }catch(error){
   if(active){
    active=false;
    await client.query("ROLLBACK").catch(()=>{});
   }
   throw error;
  }finally{client.release()}
 }
 async close():Promise<void>{
  if(this.opening)await this.opening.catch(()=>{});
  const current=this.pool;this.pool=null;
  if(current)await current.end();
 }
}
