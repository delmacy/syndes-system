import {randomUUID} from "node:crypto";
import type {TenantContext,SqlQuery} from "./accounts.js";
import type {WhatsAppOutbound} from "./contracts/index.js";
import {WhatsAppAccounts} from "./accounts.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export interface OutboundIntent {id:string;status:"pending"|"processing"|"sent"|"failed"}
export interface TransactionalSql extends SqlQuery {
 transaction?<T>(fn:(db:SqlQuery)=>Promise<T>):Promise<T>;
}
/** Enqueues only after checking ownership and enabled state from trusted tenant context. */
export class WhatsAppOutbox {
 constructor(private readonly accounts:WhatsAppAccounts,private readonly forTenant:(tenantId:string)=>Promise<SqlQuery>){}
 async enqueue(ctx:TenantContext,message:WhatsAppOutbound):Promise<OutboundIntent> {
  if(!UUID.test(ctx.tenantId)||!UUID.test(message.accountId))throw new Error("Invalid identifier");
  if(!message.idempotencyKey||message.idempotencyKey.length>160)throw new Error("Invalid idempotency key");
  if(!message.recipientExternalId||message.recipientExternalId.length>256)throw new Error("Invalid recipient");
  if(!message.body||message.body.length>10000)throw new Error("Invalid message");
  await this.accounts.requireEnabled(ctx,message.accountId);
  const db=await this.forTenant(ctx.tenantId);
  const inserted=await db.query<{id:string;status:OutboundIntent["status"]}>(`INSERT INTO whatsapp_outbox
(id,tenant_id,account_id,idempotency_key,recipient_external_id,body)
SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS
(SELECT 1 FROM whatsapp_accounts WHERE tenant_id=$2 AND id=$3 AND service_enabled=true)
ON CONFLICT (tenant_id,account_id,idempotency_key) DO UPDATE
SET idempotency_key=EXCLUDED.idempotency_key
WHERE whatsapp_outbox.recipient_external_id=EXCLUDED.recipient_external_id
  AND whatsapp_outbox.body=EXCLUDED.body
RETURNING id,status`,
[randomUUID(),ctx.tenantId,message.accountId,message.idempotencyKey,message.recipientExternalId,message.body]);
  const row=inserted.rows[0];
  if(!row)throw new Error("Account disabled or idempotency payload conflict");
  return row;
 }
}
/** SQL to execute inside a transaction holding the same connection.
 * A reservation of zero means wait; never dispatch directly from request handlers.
 * A database clock and row lock serialize concurrent workers per account per minute.
 */
export const RESERVE_ACCOUNT_SEND_SQL=`
WITH account_lock AS (
 SELECT id FROM whatsapp_accounts
 WHERE id=$1 AND tenant_id=$2 AND service_enabled=true
 FOR UPDATE
), slot AS (
 INSERT INTO whatsapp_outbound_send_windows(account_id,window_start,reserved_count)
 SELECT id,date_trunc('minute',clock_timestamp()),1 FROM account_lock
 ON CONFLICT (account_id,window_start) DO UPDATE
 SET reserved_count=whatsapp_outbound_send_windows.reserved_count+1
 WHERE whatsapp_outbound_send_windows.reserved_count<40
 RETURNING reserved_count
)
SELECT reserved_count FROM slot`;
