import {createHash,timingSafeEqual} from "node:crypto";
import {Body,Controller,Headers,HttpException,Inject,Injectable,Module,Param,Post} from "@nestjs/common";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {validIncomingEnvelope,validChatEnvelope,validContactEnvelope,validReceiptEnvelope,type IncomingWhatsAppEnvelope,type IncomingWhatsAppChatEnvelope,type IncomingWhatsAppContactEnvelope,type IncomingWhatsAppReceiptEnvelope} from "./inbound-contract.js";

export function verifyWebhookToken(configured:string|undefined,header:string|undefined):boolean{
 if(!configured||!header?.startsWith("Bearer "))return false;
 const provided=header.slice(7);
 const a=createHash("sha256").update(provided).digest();
 const b=createHash("sha256").update(configured).digest();
 return provided.length===configured.length&&timingSafeEqual(a,b);
}
export class WhatsAppInboundStore{
 constructor(private readonly pools:TrustedTenantDatabaseProvider){}
 async persist(tenantId:string,event:IncomingWhatsAppEnvelope|IncomingWhatsAppChatEnvelope|IncomingWhatsAppContactEnvelope|IncomingWhatsAppReceiptEnvelope){
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
  // Account membership and insertion are enforced together, avoiding a check/write race.
  const result=await db.query(`INSERT INTO whatsapp_inbound_events
    (tenant_id,account_id,external_message_id,event_type,payload)
    SELECT a.tenant_id,a.id,$3,$4,$5::jsonb FROM whatsapp_accounts a
    WHERE a.tenant_id=$1::uuid AND a.id=$2::uuid AND a.service_enabled=true
      AND a.platform_organization_id IS NOT NULL
    ON CONFLICT(tenant_id,account_id,external_message_id) DO NOTHING
    RETURNING id`,[tenantId,event.accountId,
     event.type==="whatsapp.chat.snapshot"?"chat:"+createHash("sha256").update(
       event.chat.chatExternalId+"|"+(event.chat.name??"")+"|"+String(event.chat.unreadCount??0)+"|"+String(event.chat.archived??false)).digest("hex"):
     event.type==="whatsapp.message.receipt"?"receipt:"+createHash("sha256").update(event.receipt.providerMessageId+"|"+event.receipt.status).digest("hex"):
     event.type==="whatsapp.contact.name"?"contact:"+createHash("sha256").update(event.contact.contactExternalId+"|"+event.contact.name).digest("hex"):
     event.message.externalMessageId,
     event.type,JSON.stringify(event)]);
  if(result.rows.length===1)return {accepted:true,duplicate:false};
  const existing=await db.query(`SELECT 1 FROM whatsapp_inbound_events WHERE tenant_id=$1::uuid
   AND account_id=$2::uuid AND external_message_id=$3
     AND EXISTS (SELECT 1 FROM whatsapp_accounts a WHERE a.tenant_id=whatsapp_inbound_events.tenant_id AND a.id=whatsapp_inbound_events.account_id AND a.service_enabled=true AND a.platform_organization_id IS NOT NULL)`,[tenantId,event.accountId,
     event.type==="whatsapp.chat.snapshot"?"chat:"+createHash("sha256").update(
       event.chat.chatExternalId+"|"+(event.chat.name??"")+"|"+String(event.chat.unreadCount??0)+"|"+String(event.chat.archived??false)).digest("hex"):
     event.type==="whatsapp.message.receipt"?"receipt:"+createHash("sha256").update(event.receipt.providerMessageId+"|"+event.receipt.status).digest("hex"):
     event.type==="whatsapp.contact.name"?"contact:"+createHash("sha256").update(event.contact.contactExternalId+"|"+event.contact.name).digest("hex"):
     event.message.externalMessageId]);
  if(existing.rows.length===1)return {accepted:true,duplicate:true};
  throw new HttpException("WhatsApp account unavailable",404);
 }
}
@Injectable()
export class WhatsAppInboundService{
 private readonly store:WhatsAppInboundStore;
 constructor(@Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider){this.store=new WhatsAppInboundStore(pools)}
 async receive(tenantId:string,event:IncomingWhatsAppEnvelope|IncomingWhatsAppChatEnvelope|IncomingWhatsAppContactEnvelope|IncomingWhatsAppReceiptEnvelope){return this.store.persist(tenantId,event)}
}
@Controller("api/v1/internal/whatsapp/events")
export class WhatsAppInboundController{
 constructor(private readonly service:WhatsAppInboundService){}
 @Post(":tenantId")
 async receive(@Param("tenantId")tenantId:string,@Headers("authorization")header:string|undefined,@Body()event:unknown){
  if(!verifyWebhookToken(process.env.WHATSAPP_WEBHOOK_TOKEN,header))throw new HttpException("Unauthorized",401);
  if(!validIncomingEnvelope(tenantId,event)&&!validChatEnvelope(tenantId,event)&&!validContactEnvelope(tenantId,event)&&!validReceiptEnvelope(tenantId,event))throw new HttpException("Invalid inbound event",400);
  try{return await this.service.receive(tenantId,event)}
  catch(error){if(error instanceof HttpException)throw error;throw new HttpException("Inbound storage unavailable",503)}
 }
}
@Module({providers:[WhatsAppInboundService],controllers:[WhatsAppInboundController]})
export class WhatsAppInboundHttpModule{}
