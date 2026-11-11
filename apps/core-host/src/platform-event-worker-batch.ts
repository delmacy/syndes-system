import type {TenantEventDispatcher} from "./platform-event-dispatcher.js";
import {tenantUUID} from "./adapters.js";

export type EventWorkerBatchReport=Readonly<{
 routed:number;attempted:number;delivered:number;alreadyProcessed:number;
 retried:number;suspended:number;dead:number;empty:boolean;
}>;

/** One bounded, explicitly invoked tenant tick. No timers, tenant discovery,
 * daemon or Nest bootstrap. Business effects still pass the dispatcher gate.
 * Counts contain no event body, phone, name or JID. */
export class TenantEventWorkerBatch {
 constructor(private readonly dispatcher:Pick<TenantEventDispatcher,"routePending"|"processNext">){}
 async run(tenantId:string,limit=25):Promise<EventWorkerBatchReport>{
  if(!tenantUUID(tenantId)||!Number.isInteger(limit)||limit<1||limit>100)
   throw Error("Invalid trusted worker batch scope");
  const routed=await this.dispatcher.routePending(tenantId,limit);
  const counts={routed,attempted:0,delivered:0,alreadyProcessed:0,
   retried:0,suspended:0,dead:0,empty:false};
  for(let i=0;i<limit;i++){
   const outcome=await this.dispatcher.processNext(tenantId);
   if(outcome==="empty"){counts.empty=true;break}
   counts.attempted++;
   switch(outcome){
    case "delivered":counts.delivered++;break;
    case "already_processed":counts.alreadyProcessed++;break;
    case "retry":counts.retried++;break;
    case "suspended":counts.suspended++;break;
    case "dead":counts.dead++;break;
    default:throw Error("Unexpected worker delivery result");
   }
  }
  return Object.freeze(counts);
 }
}
