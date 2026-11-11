import type {TenantTransaction,TransactionalEventPublisher,StoredPlatformEvent} from "@syndes/core-kernel";

export type CrmWhatsAppIdentityContext=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;conversationId:string;
 providerJid:string;phoneE164:string|null;linkedPersonId:string|null;
}>;
export type CrmIdentityScope=Readonly<{
 tenantId:string;organizationId:string;workspaceId:string;conversationId:string;
}>;
export interface CrmWhatsAppIdentitySource {
 loadIdentity(tx:TenantTransaction,scope:CrmIdentityScope):Promise<CrmWhatsAppIdentityContext>;
}
export type CrmIdentityDecision=Readonly<{
 personId:string|null;review:"ambiguous"|"missing_identity"|"conflicting_link"|null;
}>;

/** One conservative CRM-owned decision shared by the event consumer and
 * the final Inbox link validation; never derives phone from an LID. */
export class CrmWhatsAppIdentityPolicy {
 constructor(private readonly source:CrmWhatsAppIdentitySource){}
 async decide(tx:TenantTransaction,scope:CrmIdentityScope):Promise<CrmIdentityDecision>{
  if(tx.tenantId!==scope.tenantId)throw Error("Cross-tenant CRM identity policy");
  const route=await this.source.loadIdentity(tx,scope);
  if(route.tenantId!==scope.tenantId||route.organizationId!==scope.organizationId||
   route.workspaceId!==scope.workspaceId||route.conversationId!==scope.conversationId)
   throw Error("CRM identity source scope mismatch");
  const pn=route.phoneE164?
   route.phoneE164.substring(1)+"@s.whatsapp.net":null;
  const identities=await tx.query(`
   SELECT DISTINCT p.id::text AS id
   FROM crm_channel_identities ci
   JOIN crm_people p ON p.tenant_id=ci.tenant_id AND p.id=ci.person_id
   WHERE ci.tenant_id=$1::uuid AND ci.platform_organization_id=$2::uuid
     AND p.platform_organization_id=$2::uuid AND p.archived_at IS NULL
     AND ci.channel='whatsapp'
     AND (ci.external_id=$3 OR ($4::text IS NOT NULL AND ci.external_id=$4))
  `,[scope.tenantId,scope.organizationId,route.providerJid,pn]);
  const phones=route.phoneE164?await tx.query(`
   SELECT DISTINCT p.id::text AS id FROM crm_people p
   WHERE p.tenant_id=$1::uuid AND p.platform_organization_id=$2::uuid
     AND p.phone=$3 AND p.archived_at IS NULL
  `,[scope.tenantId,scope.organizationId,route.phoneE164]):{rows:[]};
  const ids=[...new Set([...identities.rows,...phones.rows].map(r=>String(r.id)))];
  let linkedValid=false;
  if(route.linkedPersonId){
   const linked=await tx.query(`
    SELECT 1 FROM crm_people WHERE tenant_id=$1::uuid AND id=$2::uuid
      AND platform_organization_id=$3::uuid AND archived_at IS NULL
   `,[scope.tenantId,route.linkedPersonId,scope.organizationId]);
   linkedValid=linked.rows.length===1;
  }
  if(route.linkedPersonId&&(!linkedValid||
      (ids.length>0&&!ids.includes(route.linkedPersonId))))
   return {personId:null,review:"conflicting_link"};
  if(ids.length>1)return {personId:null,review:"ambiguous"};
  if(ids.length===1)return {personId:ids[0]!,review:null};
  if(route.linkedPersonId&&linkedValid)
   return {personId:route.linkedPersonId,review:null};
  return {personId:null,review:"missing_identity"};
 }
 /** Re-run the identical identity policy immediately before Inbox writes. */
 async validateLink(tx:TenantTransaction,scope:CrmIdentityScope & Readonly<{
  personId:string;
 }>):Promise<boolean>{
  const decision=await this.decide(tx,scope);
  return decision.personId===scope.personId&&decision.review===null;
 }
}

/** CRM owns resolution and publication, but never writes Inbox or WhatsApp. */
export class CrmWhatsAppIdentityConsumer{
 constructor(private readonly policy:CrmWhatsAppIdentityPolicy,
  private readonly publisher:TransactionalEventPublisher){}
 async handle(tx:TenantTransaction,event:StoredPlatformEvent):Promise<void>{
  if(tx.tenantId!==event.tenantId||event.type!=="inbox.participant.observed.v1"||
   !event.workspaceId||typeof event.payload.conversationId!=="string")
   throw Error("Unexpected CRM participant event scope");
  const conversationId=event.payload.conversationId;
  const decision=await this.policy.decide(tx,{
   tenantId:event.tenantId,organizationId:event.organizationId,
   workspaceId:event.workspaceId,conversationId,
  });
  if(decision.personId){
   await this.publisher.publish(tx,{
    tenantId:event.tenantId,organizationId:event.organizationId,workspaceId:event.workspaceId,
    type:"crm.person.resolved.v1",producer:"crm",aggregateType:"person",
    aggregateId:decision.personId,idempotencyKey:"identity-resolved:"+event.eventId,
    correlationId:event.correlationId,causationId:event.eventId,
    payload:{conversationId,personId:decision.personId},
   });
  }else{
   await this.publisher.publish(tx,{
    tenantId:event.tenantId,organizationId:event.organizationId,workspaceId:event.workspaceId,
    type:"crm.person.review_required.v1",producer:"crm",aggregateType:"conversation",
    aggregateId:conversationId,idempotencyKey:"identity-review:"+event.eventId,
    correlationId:event.correlationId,causationId:event.eventId,
    payload:{conversationId,reason:decision.review??"missing_identity"},
   });
  }
 }
}
