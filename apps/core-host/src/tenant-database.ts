import {readFile} from "node:fs/promises";
import {Inject,Injectable,OnModuleDestroy} from "@nestjs/common";
import {Pool} from "pg";
import type {TrustedTenantDatabaseProvider,TenantDatabase} from "@syndes/core-kernel";
import {tenantUUID} from "./adapters.js";

export type ControlQuery=Pick<Pool,"query">;
export interface CoreApi { readonly db:Pool;readonly kernel:import("@syndes/core-kernel").CoreKernel;
  readonly verifier:import("./adapters.js").ActorVerifier; }

type Registry=Readonly<{database_name:string;role_name:string}>;
type LoginFiles=Readonly<{role:string;secret:string}>;

/** A trusted server-side registry must be queried for every tenant lookup.
 * This provider never accepts a database host, DSN or username from HTTP. */
export function expectedTenantDatabase(id:string):Registry{
  if(!tenantUUID(id))throw new Error("Invalid tenant identifier");
  const suffix=id.replace(/-/g,"").toLowerCase();
  return {database_name:"syndes_tenant_"+suffix,role_name:"syndes_t_"+suffix};
}
export async function resolveRegistry(control:ControlQuery,id:string):Promise<Registry>{
  const expected=expectedTenantDatabase(id);
  const r=await control.query(`SELECT database_name,role_name FROM tenant_registry
    WHERE tenant_id=$1::uuid AND state='active' LIMIT 1`,[id]);
  const row=r.rows[0];
  if(!row||row.database_name!==expected.database_name||row.role_name!==expected.role_name)
    throw new Error("Tenant database unavailable");
  return expected;
}

export class TenantCredentialSource {
  constructor(
    private readonly address=process.env.CORE_OPENBAO_URL??"https://openbao:8200",
    private readonly files:LoginFiles={
      role:process.env.CORE_TENANT_ROLE_ID_FILE??"/run/secrets/core_tenant_role_id",
      secret:process.env.CORE_TENANT_SECRET_ID_FILE??"/run/secrets/core_tenant_secret_id",
    },
    private readonly send:typeof fetch=fetch,
  ){}
  async password(id:string,expectedUser:string):Promise<string>{
    expectedTenantDatabase(id);
    const u=new URL(this.address);
    if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")
      throw new Error("Invalid OpenBao URL");
    const role=(await readFile(this.files.role,"utf8")).trim();
    const secret=(await readFile(this.files.secret,"utf8")).trim();
    if(!role||!secret)throw new Error("Missing tenant credential identity");
    const req=async (path:string,init:RequestInit)=>{
      const response=await this.send(new URL(path,u),{
        ...init,redirect:"error",signal:AbortSignal.timeout(5000),
      });
      if(!response.ok)throw new Error("OpenBao authorization unavailable");
      return response;
    };
    const login=await req("/v1/auth/approle/login",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({role_id:role,secret_id:secret}),
    });
    const loginBody:unknown=await login.json();
    const token=(loginBody as {auth?:{client_token?:unknown}})?.auth?.client_token;
    if(typeof token!=="string"||!token)throw new Error("OpenBao token missing");
    try{
      const response=await req("/v1/kv/data/production/tenants/"+encodeURIComponent(id),{
        method:"GET",headers:{"X-Vault-Token":token},
      });
      const result:unknown=await response.json();
      const value=(result as {data?:{data?:{username?:unknown;password?:unknown}}})?.data?.data;
      if(value?.username!==expectedUser||typeof value.password!=="string"||value.password.length<20)
        throw new Error("Tenant credential mismatch");
      return value.password;
    }finally{
      const revoked=await req("/v1/auth/token/revoke-self",{
        method:"POST",headers:{"X-Vault-Token":token},
      });
      if(!revoked.ok)throw new Error("OpenBao revocation failed");
    }
  }
}

@Injectable()
export class TenantPgProvider implements TrustedTenantDatabaseProvider,OnModuleDestroy{
  private readonly pools=new Map<string,{pool:Pool;last:number}>();
  private readonly source=new TenantCredentialSource();
  constructor(@Inject("SYNDES_CORE_API") private readonly core:CoreApi){}
  async resolve(tenantId:string):Promise<TenantDatabase>{
    const mapping=await resolveRegistry(this.core.db,tenantId);
    let entry=this.pools.get(tenantId);
    // Refresh idle pools periodically, so rotated credentials are eventually reread.
    if(entry&&Date.now()-entry.last>120000){
      this.pools.delete(tenantId);
      await entry.pool.end();
      entry=undefined;
    }
    if(!entry){
      const password=await this.source.password(tenantId,mapping.role_name);
      const pool=new Pool({
        host:"syndes-postgres",port:5432,user:mapping.role_name,
        password,database:mapping.database_name,max:2,
        connectionTimeoutMillis:3000,idleTimeoutMillis:10000,
      });
      // Connection must work BEFORE a pool can be cached for this tenant.
      try{await pool.query("SELECT 1")}catch(e){await pool.end();throw e}
      if(this.pools.size>=8){
        const oldest=[...this.pools].sort((a,b)=>a[1].last-b[1].last)[0];
        if(oldest){this.pools.delete(oldest[0]);await oldest[1].pool.end()}
      }
      entry={pool,last:Date.now()};
      this.pools.set(tenantId,entry);
    }
    entry.last=Date.now();
    return Object.freeze({
      tenantId,
      query:async(sql:string,values:readonly unknown[])=>{
        const r=await entry.pool.query(sql,[...values]);
        return {rows:r.rows as Record<string,unknown>[],rowCount:r.rowCount};
      },
    });
  }
  async onModuleDestroy():Promise<void>{
    await Promise.all([...this.pools.values()].map(x=>x.pool.end()));
    this.pools.clear();
  }
}
