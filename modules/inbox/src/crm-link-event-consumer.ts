import type {TenantTransaction,StoredPlatformEvent} from "@syndes/core-kernel";

export interface InboxCrmLinkValidator {
 validateLink(tx:TenantTransaction,scope:Readonly<{
  tenantId:string;organizationId:string;workspaceId:string;
  conversationId:string;personId:string;
 }>):Promise<boolean>;
}

/** Inbox owns the link. Do not trust the event alone: recheck CRM's current
 * conservative identity policy under the same pinned transaction. */
export class InboxCrmPersonResolvedConsumer {
 constructor(private readonly identity:InboxCrmLinkValidator){}
 async handle(tx:TenantTransaction,event:StoredPlatformEvent):Promise<void>{
  if(tx.tenantId!==event.tenantId||event.type!=="crm.person.resolved.v1"||
    !event.workspaceId||typeof event.payload.conversationId!=="string"||
    typeof event.payload.personId!=="string")
   throw Error("Invalid resolved CRM link event");
  const tenantId=event.tenantId,organizationId=event.organizationId,
   workspaceId=event.workspaceId,conversationId=event.payload.conversationId,
   personId=event.payload.personId;
  const result=await tx.query(`
   SELECT crm_person_id::text
   FROM inbox_conversations
   WHERE tenant_id=$1::uuid AND id=$2::uuid
    AND platform_organization_id=$3::uuid
    AND platform_current_workspace_id=$4::uuid AND channel='whatsapp' AND is_group=false
   FOR UPDATE
  `,[tenantId,conversationId,organizationId,workspaceId]);
  if(result.rows.length!==1)
   throw Error("Inbox conversation no longer in authorized scope");
  const current=result.rows[0]!.crm_person_id;
  if(typeof current==="string"){
   if(current===personId)return;
   throw Error("Inbox CRM link conflict: never overwrite an existing person");
  }
  if(!await this.identity.validateLink(tx,{
   tenantId,organizationId,workspaceId,conversationId,personId,
  }))throw Error("CRM identity changed after resolution; link refused");
  const linked=await tx.query(`
   UPDATE inbox_conversations SET crm_person_id=$5::uuid
   WHERE tenant_id=$1::uuid AND id=$2::uuid AND platform_organization_id=$3::uuid
    AND platform_current_workspace_id=$4::uuid AND crm_person_id IS NULL
   RETURNING id::text
  `,[tenantId,conversationId,organizationId,workspaceId,personId]);
  if(linked.rows.length!==1)throw Error("Inbox CRM link changed concurrently");
  await tx.query(`
   INSERT INTO inbox_events(tenant_id,conversation_id,actor_id,action,detail)
   VALUES($1::uuid,$2::uuid,$3,'crm_identity_linked',$4::jsonb)
  `,[tenantId,conversationId,"service:crm-link",JSON.stringify({personId})]);
 }
}
