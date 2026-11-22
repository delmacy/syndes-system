#!/usr/bin/env bash
# Prepare only the exact, already post-cutover, synthetic stage tenant.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "${SYNDES_STAGE_HISTORY_SCHEMA_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_HISTORY_SCHEMA ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status
checksum="$(sha256sum 009_whatsapp_history_commands.sql | cut -d ' ' -f1)"
[[ "$checksum" =~ ^[a-f0-9]{64}$ ]] || exit 3
project=syndes-multiorg-staging
pg="$(docker ps --no-trunc -q --filter "label=com.docker.compose.project=$project" --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=control-postgres)"
[[ "$pg" =~ ^[a-f0-9]{64}$ && "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 3
tenant=1f5a8ce9-3f01-48cc-a013-2198d99e7510
db=syndes_tenant_1f5a8ce93f0148cca0132198d99e7510
role=syndes_t_1f5a8ce93f0148cca0132198d99e7510
registered="$(docker exec "$pg" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT count(*) FROM tenant_registry WHERE tenant_id='$tenant' AND database_name='$db' AND role_name='$role' AND state='active'")"
[[ "$registered" == 1 ]] || exit 4
{
 cat <<'SQL'
SELECT pg_advisory_xact_lock(hashtextextended('whatsapp-history-staging-schema',0));
DO $guard$
BEGIN
 IF current_database() <> 'syndes_tenant_1f5a8ce93f0148cca0132198d99e7510'
    OR current_setting('server_version_num')::int NOT BETWEEN 170000 AND 179999
    OR EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname IN
      ('platform_legacy_single_organization','platform_legacy_single_workspace'))
    OR (SELECT count(*) FROM public.platform_organizations
        WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510') <> 2
    OR NOT EXISTS (SELECT 1 FROM _syndes.module_migrations
        WHERE module_id='whatsapp' AND migration_id='008_whatsapp_projection_owner')
 THEN RAISE EXCEPTION 'Stage history schema preflight failed';
 END IF;
END
$guard$;
SET LOCAL search_path TO public,pg_catalog;
SQL
 cat 009_whatsapp_history_commands.sql
 cat <<'SQL'
SELECT 1 / ((to_regclass('public.whatsapp_history_commands') IS NOT NULL
 AND to_regclass('public.whatsapp_history_commands_pending') IS NOT NULL
 AND to_regclass('public.whatsapp_history_commands_anchor') IS NOT NULL)::int);
SELECT 1 / ((NOT EXISTS (
 SELECT 1 FROM _syndes.stage_bootstrap_receipts
 WHERE module_id='whatsapp' AND migration_id='009_whatsapp_history_commands'
   AND (checksum<>:'checksum' OR verification_mode<>'stage_prepared_before_activation')
))::int);
INSERT INTO _syndes.stage_bootstrap_receipts (module_id,migration_id,checksum,verification_mode)
 VALUES ('whatsapp','009_whatsapp_history_commands',:'checksum','stage_prepared_before_activation')
 ON CONFLICT (module_id,migration_id) DO NOTHING;
SQL
} | docker exec -i "$pg" psql -Xq --single-transaction -v ON_ERROR_STOP=1 -v "checksum=$checksum" -U postgres -d "$db" -f - >/dev/null
printf 'STAGE_WHATSAPP_HISTORY_009_PREPARED_SHA256=%s\n' "$checksum"
gateway="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=syndes.environment=multi-org-staging --filter label=syndes.component=whatsapp-gateway)"
if [[ -n "$gateway" ]]; then echo STAGE_WHATSAPP_HISTORY_GATEWAY_CONTAINER_PRESENT; else echo STAGE_WHATSAPP_HISTORY_GATEWAY_CONTAINER_ABSENT; fi
echo STAGE_WHATSAPP_HISTORY_SCHEMA_PREPARED_RUNTIME_FLAG_PENDING
