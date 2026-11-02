import {createHash,randomUUID} from "node:crypto";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {validIncomingEnvelope} from "./inbound-contract.js";

// This projection is invoked by a trusted host worker, never from the public HTTP API.
// A single PostgreSQL statement atomically creates the conversation, writes the
// inbound message and acknowledges delivery. Failed statements keep the event pending.
export class WhatsAppInboxProjection{
 constructor(private readonly pools:TrustedTenantDatabaseProvider){}
 async deliverNext(tenantId:string):Promise<"delivered"|"empty"|"invalid">{
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
  const pending=await db.query(`SELECT id,payload FROM whatsapp_inbound_events
    WHERE tenant_id=$1::uuid AND processed_at IS NULL AND failed_at IS NULL ORDER BY id LIMIT 1`,[tenantId]);
  const row=pending.rows[0] as {id?:unknown;payload?:unknown}|undefined;
  if(!row)return "empty";
  if(!validIncomingEnvelope(tenantId,row.payload)){
   await db.query("UPDATE whatsapp_inbound_events SET failed_at=clock_timestamp(),last_error=$3 WHERE tenant_id=$1::uuid AND id=$2 AND processed_at IS NULL AND failed_at IS NULL",[tenantId,row.id,"invalid envelope"]);
   return "invalid";
  }
  const event=row.payload;
  // Include both the sending number and remote sender to prevent thread merging.
  const thread=createHash("sha256").update(event.accountId+"|"+event.message.senderExternalId).digest("hex");
  const externalId=createHash("sha256").update(event.accountId+"|"+event.message.externalMessageId).digest("hex");
  const subject="WhatsApp · "+event.message.senderExternalId.slice(0,100);
  const inboxBody=event.message.body.slice(0,5000);
  const result=await db.query(`
   WITH incoming AS (
     SELECT e.id,e.tenant_id,e.account_id
     FROM whatsapp_inbound_events e
     WHERE e.tenant_id=$1::uuid AND e.id=$2 AND e.processed_at IS NULL
     FOR UPDATE
   ), thread AS (
     INSERT INTO inbox_conversations(tenant_id,id,subject,channel,external_thread_id)
     SELECT tenant_id,$3::uuid,$4,'whatsapp',$5 FROM incoming
     ON CONFLICT(tenant_id,channel,external_thread_id) WHERE external_thread_id IS NOT NULL
     DO UPDATE SET updated_at=inbox_conversations.updated_at
     RETURNING tenant_id,id
   ), inserted AS (
     INSERT INTO inbox_messages(tenant_id,id,conversation_id,direction,body,author_id,external_message_id)
     SELECT tenant_id,$6::uuid,id,'inbound',$7,$8,$9 FROM thread
     ON CONFLICT(tenant_id,conversation_id,external_message_id) WHERE external_message_id IS NOT NULL
     DO NOTHING RETURNING tenant_id,conversation_id
   ), acknowledged AS (
     UPDATE whatsapp_inbound_events e SET processed_at=clock_timestamp()
     FROM incoming
     WHERE e.id=incoming.id AND e.tenant_id=incoming.tenant_id
       AND EXISTS(SELECT 1 FROM thread)
       AND (EXISTS(SELECT 1 FROM inserted) OR EXISTS (
         SELECT 1 FROM inbox_messages m JOIN thread t ON t.tenant_id=m.tenant_id
         AND t.id=m.conversation_id
         WHERE m.external_message_id=$9 AND m.body=$7 AND m.direction='inbound'
       ))
     RETURNING e.id
   )
   SELECT id FROM acknowledged
   `,[tenantId,row.id,randomUUID(),subject,thread,randomUUID(),inboxBody,
      event.message.senderExternalId,externalId]);
  return result.rows.length===1?"delivered":"invalid";
 }
}
