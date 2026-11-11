-- CRM-WA-01: solely read-only, totals only. No PII, auto-create or UPDATE.
-- Never run on syndes_control; use the verified tenant database.
BEGIN READ ONLY;
WITH contacts AS (
 SELECT c.id,c.tenant_id,c.platform_organization_id,c.crm_person_id,
    r.recipient_external_id,r.phone_e164,
    count(*) OVER(PARTITION BY c.tenant_id,c.platform_organization_id,r.phone_e164) AS route_phone_count,
    EXISTS(SELECT 1 FROM crm_people old WHERE old.tenant_id=c.tenant_id
      AND old.platform_organization_id=c.platform_organization_id
      AND r.phone_e164 IS NOT NULL AND old.phone=r.phone_e164
      AND old.archived_at IS NOT NULL) AS archived_person_match,
    EXISTS(SELECT 1 FROM crm_people p WHERE p.tenant_id=c.tenant_id
      AND p.id=c.crm_person_id AND p.archived_at IS NULL
      AND p.platform_organization_id=c.platform_organization_id) AS linked_valid,
    COALESCE((SELECT array_agg(DISTINCT ci.person_id) FROM crm_channel_identities ci
       JOIN crm_people p ON p.tenant_id=ci.tenant_id AND p.id=ci.person_id
       WHERE ci.tenant_id=c.tenant_id AND ci.platform_organization_id=c.platform_organization_id
        AND p.platform_organization_id=c.platform_organization_id AND p.archived_at IS NULL
        AND ci.channel='whatsapp'
        AND (ci.external_id=r.recipient_external_id OR
         (r.phone_e164 IS NOT NULL AND ci.external_id=substring(r.phone_e164 FROM 2)||'@s.whatsapp.net'))),
       ARRAY[]::uuid[]) AS ci_persons,
    COALESCE((SELECT array_agg(DISTINCT p.id) FROM crm_people p
       WHERE p.tenant_id=c.tenant_id AND p.platform_organization_id=c.platform_organization_id
        AND p.archived_at IS NULL AND r.phone_e164 IS NOT NULL AND p.phone=r.phone_e164),
       ARRAY[]::uuid[]) AS phone_persons
 FROM inbox_conversations c
 JOIN whatsapp_conversation_routes r ON r.tenant_id=c.tenant_id AND r.conversation_id=c.id
 JOIN whatsapp_accounts a ON a.tenant_id=r.tenant_id AND a.id=r.account_id
 WHERE c.channel='whatsapp' AND c.is_group=false
  AND c.platform_organization_id=a.platform_organization_id
),
decisions AS (
 SELECT CASE
  WHEN platform_organization_id IS NULL THEN 'review_missing_organization'
  WHEN crm_person_id IS NOT NULL AND
     (NOT linked_valid OR
      EXISTS(SELECT 1 FROM unnest(ci_persons||phone_persons) AS x(pid)
        WHERE x.pid<>crm_person_id)) THEN 'review_conflicting_link'
  WHEN crm_person_id IS NOT NULL THEN 'already_linked'
  WHEN (SELECT count(DISTINCT pid) FROM unnest(ci_persons||phone_persons) AS x(pid))>1
    THEN 'review_ambiguous'
  WHEN (SELECT count(DISTINCT pid) FROM unnest(ci_persons||phone_persons) AS x(pid))=1
    THEN 'link_existing'
  WHEN route_phone_count>1 OR archived_person_match THEN 'review_ambiguous'
  WHEN phone_e164 IS NULL THEN 'review_missing_identity'
  ELSE 'propose_provisional'
 END AS decision FROM contacts
)
SELECT decision,count(*)::bigint FROM decisions GROUP BY decision ORDER BY decision;
COMMIT;
