import {randomUUID} from "node:crypto";
import type {WhatsAppAccount} from "./contracts/index.js";

export interface SqlQuery {
 query<T extends Record<string,unknown>>(sql:string,params:readonly unknown[]):Promise<{rows:T[]}>;
}
export interface TenantContext {readonly tenantId:string}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function uuid(value:string):string {
 if(!UUID.test(value))throw new Error("Invalid account or tenant identifier");
 return value;
}
type AccountRow={id:string;tenant_id:string;display_name:string;phone_external_id:string|null;device_jid:string|null;connection_status:WhatsAppAccount["state"];service_enabled:boolean};
export interface WhatsAppAccountView extends WhatsAppAccount {
 readonly displayName:string; readonly phoneExternalId:string|null; readonly deviceJid:string|null;
}
function view(row:AccountRow):WhatsAppAccountView {
 return {id:row.id,tenantId:row.tenant_id,displayName:row.display_name,phoneExternalId:row.phone_external_id,deviceJid:row.device_jid,state:row.connection_status,serviceEnabled:row.service_enabled};
}
/** Database is resolved by trusted host tenant context. NEVER resolve from request body. */
export class WhatsAppAccounts {
 constructor(private readonly forTenant:(tenantId:string)=>Promise<SqlQuery>){}
 async list(ctx:TenantContext):Promise<WhatsAppAccountView[]> {
  const tenant=uuid(ctx.tenantId),db=await this.forTenant(tenant);
  const result=await db.query<AccountRow>("SELECT id,tenant_id,display_name,phone_external_id,device_jid,connection_status,service_enabled FROM whatsapp_accounts WHERE tenant_id=$1 ORDER BY created_at,id",[tenant]);
  return result.rows.map(view);
 }
 async get(ctx:TenantContext,accountId:string):Promise<WhatsAppAccountView|null> {
  const tenant=uuid(ctx.tenantId),id=uuid(accountId),db=await this.forTenant(tenant);
  const result=await db.query<AccountRow>("SELECT id,tenant_id,display_name,phone_external_id,device_jid,connection_status,service_enabled FROM whatsapp_accounts WHERE tenant_id=$1 AND id=$2",[tenant,id]);
  return result.rows[0]?view(result.rows[0]):null;
 }
 async create(ctx:TenantContext,displayName:string):Promise<WhatsAppAccountView> {
  const tenant=uuid(ctx.tenantId),name=displayName.trim();
  if(!name||name.length>100)throw new Error("Invalid account display name");
  const db=await this.forTenant(tenant),id=randomUUID();
  const result=await db.query<AccountRow>("INSERT INTO whatsapp_accounts(id,tenant_id,display_name) VALUES($1,$2,$3) RETURNING id,tenant_id,display_name,phone_external_id,device_jid,connection_status,service_enabled",[id,tenant,name]);
  if(!result.rows[0])throw new Error("Account creation failed");
  return view(result.rows[0]);
 }
 async setEnabled(ctx:TenantContext,accountId:string,enabled:boolean):Promise<WhatsAppAccountView|null> {
  const tenant=uuid(ctx.tenantId),id=uuid(accountId),db=await this.forTenant(tenant);
  const result=await db.query<AccountRow>("UPDATE whatsapp_accounts SET service_enabled=$3,connection_status=CASE WHEN $3 THEN connection_status ELSE 'disconnected' END,updated_at=now() WHERE tenant_id=$1 AND id=$2 RETURNING id,tenant_id,display_name,phone_external_id,device_jid,connection_status,service_enabled",[tenant,id,enabled]);
  return result.rows[0]?view(result.rows[0]):null;
 }
 async requireEnabled(ctx:TenantContext,accountId:string):Promise<WhatsAppAccountView> {
  const account=await this.get(ctx,accountId);
  if(!account||!account.serviceEnabled)throw new Error("Account not found or disabled");
  return account;
 }
}
