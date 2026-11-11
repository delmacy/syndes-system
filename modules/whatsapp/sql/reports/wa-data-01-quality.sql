-- WA-DATA-01: read-only tenant quality audit. Never print PII or message bodies.
-- Run with psql -X -v ON_ERROR_STOP=1 against an explicitly selected tenant DB.
BEGIN READ ONLY;
SELECT 'whatsapp_accounts' AS metric,count(*)::bigint AS value FROM whatsapp_accounts
UNION ALL SELECT 'whatsapp_direct_threads',count(*) FROM inbox_conversations WHERE channel='whatsapp' AND NOT is_group
UNION ALL SELECT 'whatsapp_group_threads',count(*) FROM inbox_conversations WHERE channel='whatsapp' AND is_group
UNION ALL SELECT 'whatsapp_direct_linked_crm',count(*) FROM inbox_conversations WHERE channel='whatsapp' AND NOT is_group AND crm_person_id IS NOT NULL
UNION ALL SELECT 'whatsapp_routes_without_verified_phone',count(*) FROM whatsapp_conversation_routes r JOIN inbox_conversations c ON c.tenant_id=r.tenant_id AND c.id=r.conversation_id WHERE c.channel='whatsapp' AND NOT c.is_group AND r.phone_e164 IS NULL
UNION ALL SELECT 'whatsapp_direct_generic_titles',count(*) FROM inbox_conversations WHERE channel='whatsapp' AND NOT is_group AND (subject LIKE 'WhatsApp · %' OR subject IN ('Contato sem número disponível','Número não disponível'))
UNION ALL SELECT 'whatsapp_messages_live',count(*) FROM inbox_messages WHERE source='live'
UNION ALL SELECT 'whatsapp_messages_history',count(*) FROM inbox_messages WHERE source='history'
UNION ALL SELECT 'whatsapp_inbound_pending',count(*) FROM whatsapp_inbound_events WHERE processed_at IS NULL AND failed_at IS NULL
UNION ALL SELECT 'whatsapp_inbound_failed',count(*) FROM whatsapp_inbound_events WHERE failed_at IS NOT NULL
UNION ALL SELECT 'whatsapp_events_body_over_inbox_limit',count(*) FROM whatsapp_inbound_events WHERE event_type='whatsapp.message.received' AND length(payload #>> '{message,body}') > 5000
UNION ALL SELECT 'whatsapp_events_body_over_contract_limit',count(*) FROM whatsapp_inbound_events WHERE event_type='whatsapp.message.received' AND length(payload #>> '{message,body}') > 10000
ORDER BY metric;
SELECT event_type,
 count(*)::bigint AS observed,
 count(*) FILTER (WHERE processed_at IS NOT NULL)::bigint AS processed,
 count(*) FILTER (WHERE failed_at IS NOT NULL)::bigint AS failed,
 count(*) FILTER (WHERE processed_at IS NULL AND failed_at IS NULL)::bigint AS pending
FROM whatsapp_inbound_events GROUP BY event_type ORDER BY event_type;
COMMIT;
