import {AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TenantTransaction,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import type {WhatsAppGatewayClient} from "./gateway-client.js";
import {WhatsAppReplyQueue} from "./outbound-reply.js";

type Scope={tenantId:string;organizationId:string;workspaceId:string};
export interface HistoryCommandAuthorization {
 executeHistoryCommand<T>(scope:Scope,principalId:string,epoch:string,
  effect:(tx:TenantTransaction)=>Promise<T>):Promise<T>;
}

export class WhatsAppHistoryCommandWorker {
 private readonly routes:WhatsAppReplyQueue;
 constructor(private readonly pools:TrustedTenantDatabaseProvider,
  private readonly authorization:HistoryCommandAuthorization,
  private readonly gateway:Pick<WhatsAppGatewayClient,"requestHistory">){
  this.routes=new WhatsAppReplyQueue(pools);
 }
 async deliverNext(tenantId:string):Promise<boolean>{
  const db=await this.pools.resolve(tenantId);
  if(db.tenantId!==tenantId)throw new AccessDeniedError();
  const {rows:[command]}=await db.query(`
   SELECT id::text,organization_id::text,workspace_id::text,conversation_id::text,
    account_id::text,principal_id,epoch::text,anchor_message_id
   FROM whatsapp_history_commands WHERE tenant_id=$1::uuid AND state='pending'
   ORDER BY created_at,id LIMIT 1
  `,[tenantId]);
  if(!command)return false;
  const id=String(command.id);
  const scope={tenantId,organizationId:String(command.organization_id),workspaceId:String(command.workspace_id)};
  const principalId=String(command.principal_id);
  const setState=(from:string,to:string)=>db.query(`
   UPDATE whatsapp_history_commands SET state=$4,updated_at=clock_timestamp()
   WHERE tenant_id=$1::uuid AND id=$2::uuid AND state=$3
  `,[tenantId,id,from,to]);
  let reference;
  try{
   reference=await this.authorization.executeHistoryCommand(scope,principalId,String(command.epoch),async tx=>{
    if(tx.tenantId!==tenantId||tx[PINNED_TENANT_TRANSACTION]!==true)throw new AccessDeniedError();
    const anchor=await this.routes.historyReference({...scope,actor:{id:principalId}},String(command.conversation_id),tx,true);
    if(!anchor||anchor.accountId!==command.account_id||anchor.messageId!==command.anchor_message_id)
     return null;
    // Commit the sole possible attempt before crossing the provider boundary.
    // An interrupted or ambiguous attempt must never cause another request.
    const claim=await tx.query(`
     UPDATE whatsapp_history_commands SET state='attempted',updated_at=clock_timestamp()
     WHERE tenant_id=$1::uuid AND id=$2::uuid AND state='pending'
      AND created_at > clock_timestamp()-interval '2 minutes' RETURNING id
    `,[tenantId,id]);
    return claim.rows.length===1?anchor:null;
   });
  }catch(error){
   if(!(error instanceof AccessDeniedError))throw error;
   await setState("pending","cancelled");
   return true;
  }
  if(!reference){
   await setState("pending","cancelled");
   return true;
  }
  const {accountId,...request}=reference;
  try{
   const result=await this.gateway.requestHistory(tenantId,accountId,request);
   if(result.requested!==true)throw Error("History request not acknowledged");
  }catch{
   await setState("attempted","uncertain");
   return true;
  }
  await setState("attempted","accepted");
  return true;
 }
}
