import type {TenantDatabase,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";

export type CrmLinkDecision="already_linked"|"link_existing"|"propose_provisional"|
 "review_ambiguous"|"review_conflicting_link"|"review_missing_identity"|"review_missing_organization";
export type CrmLinkPlan=Readonly<{
 conversationId:string;organizationId:string|null;decision:CrmLinkDecision;
 candidatePersonId:string|null;phoneE164:string|null;providerJid:string;
}>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const e164=/^\+[1-9][0-9]{9,14}$/;
function uniqueIds(value:unknown):string[] {
 if(!Array.isArray(value)||value.some(x=>typeof x!=="string"||!uuid.test(x)))
  throw Error("Invalid CRM identity aggregate");
 return [...new Set(value as string[])];
}
/** Never match by names, never derive a phone from LID, never cross Organization. */
export function decideCrmLink(row:Record<string,unknown>):CrmLinkPlan{
 const conversationId=String(row.conversation_id??"");
 const organizationId=typeof row.organization_id==="string"?row.organization_id:null;
 const providerJid=typeof row.recipient_external_id==="string"?row.recipient_external_id:"";
 const phoneE164=typeof row.phone_e164==="string"&&e164.test(row.phone_e164)?row.phone_e164:null;
 const linked=typeof row.crm_person_id==="string"?row.crm_person_id:null;
 if(!uuid.test(conversationId)||!providerJid)throw Error("Invalid route candidate");
 const base={conversationId,organizationId,providerJid,phoneE164};
 if(!organizationId||!uuid.test(organizationId))
  return {...base,decision:"review_missing_organization",candidatePersonId:null};
 const ids=[...new Set([...uniqueIds(row.identity_matches),...uniqueIds(row.phone_matches)])];
 if(linked&&(!uuid.test(linked)||row.link_owner_valid!==true||(ids.length>0&&!ids.includes(linked))))
  return {...base,decision:"review_conflicting_link",candidatePersonId:null};
 if(linked)return {...base,decision:"already_linked",candidatePersonId:linked};
 if(ids.length>1)return {...base,decision:"review_ambiguous",candidatePersonId:null};
 if(ids.length===1)return {...base,decision:"link_existing",candidatePersonId:ids[0]};
 // Never propose multiple provisional people for the same trusted phone,
 // or recreate a CRM person whose previous registration was archived.
 if(Number(row.route_phone_count)>1||row.archived_person_match===true)
  return {...base,decision:"review_ambiguous",candidatePersonId:null};
 if(!phoneE164)return {...base,decision:"review_missing_identity",candidatePersonId:null};
 return {...base,decision:"propose_provisional",candidatePersonId:null};
}
export function summarizeCrmPlans(plans:readonly CrmLinkPlan[]){
 const counts:Record<CrmLinkDecision,number>={
  already_linked:0,link_existing:0,propose_provisional:0,review_ambiguous:0,
  review_conflicting_link:0,review_missing_identity:0,review_missing_organization:0,
 };
 for(const item of plans)counts[item.decision]++;
 return {total:plans.length,...counts};
}
/** Safe, scoped SELECT-only simulation: NEVER creates or modifies any CRM data. */
export class WhatsAppCrmReconciliation{
 constructor(private readonly provider:TrustedTenantDatabaseProvider){}
 async plan(tenantId:string,limit=5000):Promise<readonly CrmLinkPlan[]>{
  if(!uuid.test(tenantId)||!Number.isInteger(limit)||limit<1||limit>5000)
   throw Error("Invalid tenant/limit");
  const db:TenantDatabase=await this.provider.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant database mismatch");
  const result=await db.query(`
   SELECT c.id::text AS conversation_id,c.platform_organization_id::text AS organization_id,
    c.crm_person_id::text AS crm_person_id,r.recipient_external_id,r.phone_e164,
    count(*) OVER(PARTITION BY c.tenant_id,c.platform_organization_id,r.phone_e164) AS route_phone_count,
    EXISTS(SELECT 1 FROM crm_people old WHERE old.tenant_id=c.tenant_id
      AND old.platform_organization_id=c.platform_organization_id
      AND r.phone_e164 IS NOT NULL AND old.phone=r.phone_e164
      AND old.archived_at IS NOT NULL) AS archived_person_match,
    EXISTS(SELECT 1 FROM crm_people existing
      WHERE existing.tenant_id=c.tenant_id AND existing.id=c.crm_person_id
       AND existing.platform_organization_id=c.platform_organization_id
       AND existing.archived_at IS NULL) AS link_owner_valid,
    COALESCE((
      SELECT jsonb_agg(DISTINCT ci.person_id::text)
      FROM crm_channel_identities ci
      JOIN crm_people p ON p.tenant_id=ci.tenant_id AND p.id=ci.person_id
      WHERE ci.tenant_id=c.tenant_id AND ci.platform_organization_id=c.platform_organization_id
       AND p.platform_organization_id=c.platform_organization_id AND p.archived_at IS NULL
       AND ci.channel='whatsapp' AND
       (ci.external_id=r.recipient_external_id OR
        (r.phone_e164 IS NOT NULL AND ci.external_id=substring(r.phone_e164 FROM 2)||'@s.whatsapp.net'))
    ),'[]'::jsonb) AS identity_matches,
    COALESCE((
      SELECT jsonb_agg(DISTINCT p.id::text)
      FROM crm_people p WHERE p.tenant_id=c.tenant_id
       AND p.platform_organization_id=c.platform_organization_id AND p.archived_at IS NULL
       AND r.phone_e164 IS NOT NULL AND p.phone=r.phone_e164
    ),'[]'::jsonb) AS phone_matches
   FROM whatsapp_conversation_routes r
   JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id
   JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
   WHERE c.tenant_id=$1::uuid AND c.channel='whatsapp' AND c.is_group=false
     AND c.platform_organization_id=a.platform_organization_id
   ORDER BY c.created_at,c.id LIMIT $2
  `,[tenantId,limit]);
  return result.rows.map(decideCrmLink);
 }
}
