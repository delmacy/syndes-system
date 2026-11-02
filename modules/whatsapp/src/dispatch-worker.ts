import {Inject,Injectable,OnModuleDestroy,OnModuleInit} from "@nestjs/common";
import type {TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppInboxProjection} from "./dispatch.js";
type Registry={db:{query(sql:string,values?:readonly unknown[]):Promise<{rows:Record<string,unknown>[]}>}};
@Injectable()
export class WhatsAppDispatchWorker implements OnModuleInit,OnModuleDestroy{
 private timer:ReturnType<typeof setInterval>|undefined;
 private working=false;
 private readonly projection:WhatsAppInboxProjection;
 constructor(@Inject("SYNDES_CORE_API")private readonly registry:Registry,
 @Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider){
  this.projection=new WhatsAppInboxProjection(pools);
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
    try{for(let i=0;i<20;i++){const state=await this.projection.deliverNext(tenant.tenant_id);if(state!=="delivered")break}}
    catch{/* Tenant failures remain pending and are retried in the next cycle. */}
   }
  }finally{this.working=false}
 }
}
