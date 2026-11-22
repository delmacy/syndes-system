import {Inject,Injectable,Optional,OnModuleDestroy,OnModuleInit} from "@nestjs/common";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppInboxProjection} from "./dispatch.js";
import {WhatsAppOutboundRelay} from "./outbound-relay.js";
import {WhatsAppHistoryCommandWorker,type HistoryCommandAuthorization} from "./history-command-worker.js";
import {WhatsAppGatewayClient} from "./gateway-client.js";
type Registry={db:{query(sql:string,values?:readonly unknown[]):Promise<{rows:Record<string,unknown>[]}>}};
@Injectable()
export class WhatsAppDispatchWorker implements OnModuleInit,OnModuleDestroy{
 private timer:ReturnType<typeof setInterval>|undefined;
 private working=false;
 private readonly projection:WhatsAppInboxProjection;
 private readonly outbound:WhatsAppOutboundRelay;
 private readonly history?:WhatsAppHistoryCommandWorker;
 constructor(@Inject("SYNDES_CORE_API")private readonly registry:Registry,
 @Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider,
 @Optional() @Inject("SYNDES_INBOX_EVENTS")private readonly inboxEvents?:{
  publish(scope:{tenantId:string;organizationId:string;workspaceId:string}):void
 },
 @Optional() @Inject("SYNDES_IAM07D_OPS") historyAuthorization?:HistoryCommandAuthorization){
  this.projection=new WhatsAppInboxProjection(pools,scope=>this.inboxEvents?.publish(scope));
  const gateway=new WhatsAppGatewayClient();
  this.outbound=new WhatsAppOutboundRelay(pools,gateway);
  if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"&&process.env.SYNDES_MULTI_ORG_HISTORY_SYNC==="true"){
   if(!historyAuthorization||process.env.WHATSAPP_DISPATCH_ENABLED!=="true"||
      !process.env.WHATSAPP_GATEWAY_URL||!process.env.WHATSAPP_WHATSMEOW_TOKEN)
    throw Error("Multi-org history sync requires the authorized worker and a configured WhatsApp gateway");
   this.history=new WhatsAppHistoryCommandWorker(pools,historyAuthorization,gateway);
  }
 }
 onModuleInit(){
  if(process.env.WHATSAPP_DISPATCH_ENABLED!=="true")return;
  this.timer=setInterval(()=>{void this.tick()},2000);
  this.timer.unref?.();
 }
 onModuleDestroy(){if(this.timer)clearInterval(this.timer)}
 async tick(){
  if(this.working)return;
  this.working=true;
  try{
   const tenants=await this.registry.db.query("SELECT tenant_id::text AS tenant_id FROM tenant_registry WHERE state='active' ORDER BY tenant_id LIMIT 500");
   for(const tenant of tenants.rows){
    if(typeof tenant.tenant_id!=="string")continue;
    try{for(let i=0;i<20;i++){const state=await this.projection.deliverNext(tenant.tenant_id);if(state==="empty")break}
     for(let i=0;i<20;i++){const state=await this.outbound.deliverNext(tenant.tenant_id);if(state==="empty"||state==="retry")break}
     await this.history?.deliverNext(tenant.tenant_id);}
    catch{/* Tenant failures remain pending and are retried in the next cycle. */}
   }
  }catch{/* Registry unavailable; retry on next scheduled tick. */}finally{this.working=false}
 }
}
