#!/usr/bin/env bash
# CI-only stage real IdP + FGA + Control + tenant proof; never operational/gateway.
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply ]] || exit 2
[[ "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
[[ "$SYNDES_STAGE_REAL_IDENTITY_APPROVAL" == CI_APPROVED_GREENFIELD_IDP_FGA ]] || exit 2
[[ "$SYNDES_STAGE_REAL_IDENTITY_SHA" =~ ^[0-9a-f]{40}$ ]] || exit 2
for exe in docker openssl python3 sha256sum stat; do command -v "$exe" >/dev/null || exit 3; done
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status || { echo 'MO_REAL_IDENTITY_BLOCKED=artifact_digest';exit 4; }
for file in stage-greenfield-keycloak-fga.mjs fga-model.json greenfield-stage-first-user.sql greenfield-stage-membership.sql; do
 [[ -f "$file" && ! -L "$file" ]] || exit 4
done
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/secrets" && ! -L "$root" && ! -L "$root/secrets"
  && "$(stat -c %a "$root")" == 700
  && "$(stat -c %a "$root/secrets")" == 700 ]] || exit 4
[[ -f "$root/secrets/keycloak-admin" && ! -L "$root/secrets/keycloak-admin"
  && "$(stat -c %a "$root/secrets/keycloak-admin")" == 600 ]] || exit 4
one(){
 local component="$1" cid
 cid="$(docker ps --no-trunc -q \
  --filter label=com.docker.compose.project=syndes-multiorg-staging \
  --filter label=syndes.environment=multi-org-staging \
  --filter "label=syndes.component=$component")"
 [[ "$cid" =~ ^[a-f0-9]{64}$ ]] || { echo "MO_REAL_IDENTITY_BLOCKED=component_$component";return 4; }
 [[ "$(docker inspect -f '{{.State.Running}}' "$cid")" == true ]] || return 4
 printf '%s\n' "$cid"
}
pg="$(one control-postgres)" || exit 4
kc="$(one keycloak)" || exit 4
fga="$(one openfga)" || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$pg")" == postgres:17-alpine ]] || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$kc")" == quay.io/keycloak/keycloak:26.8.1 ]] || exit 4
[[ "$(docker inspect -f '{{.Config.Image}}' "$fga")" == openfga/openfga:v1.22.1 ]] || exit 4
[[ "$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/openfga/config.yaml"}}persistent{{end}}{{end}}' "$fga")" == persistent ]] || exit 4
tenant=syndes_tenant_1f5a8ce93f0148cca0132198d99e7510
tid=1f5a8ce9-3f01-48cc-a013-2198d99e7510
uuid_regex='^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
inventory="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$tenant" -c "SELECT
 (SELECT count(*) FROM platform_organizations)::text||':'||
 (SELECT count(*) FROM platform_workspaces)::text||':'||
 (SELECT count(*) FROM service.service_funnels WHERE state='published'
 AND id::text ~ '$uuid_regex')::text||':'||
 (SELECT count(*) FROM service.service_funnel_stages WHERE id::text ~ '$uuid_regex')::text||':'||
 (SELECT count(*) FROM whatsapp_accounts)::text||':'||
 (SELECT count(*) FROM inbox_conversations)::text")" || exit 4
[[ "$inventory" == 2:4:8:16:0:0 ]] || {
 echo 'MO_REAL_IDENTITY_BLOCKED=greenfield_inventory';exit 4;
}
funnel_a="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$tenant" -c "SELECT id FROM service.service_funnels WHERE organization_id='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1' AND workspace_id='cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001' AND code='vendas'")"
funnel_b="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$tenant" -c "SELECT id FROM service.service_funnels WHERE organization_id='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2' AND workspace_id='cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2001' AND code='vendas'")"
[[ "$funnel_a" =~ ^[a-f0-9-]{36}$ && "$funnel_b" =~ ^[a-f0-9-]{36}$ ]] || exit 4
for name in pilot-founder-password pilot-b-only-password;do
 file="$root/secrets/$name"
 if [[ ! -e "$file" && ! -L "$file" ]];then
  tmp="$(mktemp "$root/secrets/.pilot.XXXXXXXX")"
  openssl rand -hex 32 > "$tmp"
  chmod 0600 "$tmp"
  mv -n "$tmp" "$file"
  [[ ! -e "$tmp" ]] || { rm -f "$tmp";exit 4; }
 fi
 [[ -f "$file" && ! -L "$file" && "$(stat -c %a "$file")" == 600 ]] || exit 4
done
identity="$(docker run --rm --network syndes-multiorg-staging_staging_internal \
 --read-only --tmpfs /tmp:rw,noexec,nosuid --cap-drop ALL \
 --security-opt no-new-privileges \
 --mount "type=bind,src=$bundle/stage-greenfield-keycloak-fga.mjs,dst=/app/pilot.mjs,readonly" \
 --mount "type=bind,src=$bundle/fga-model.json,dst=/app/fga-model.json,readonly" \
 --mount "type=bind,src=$root/secrets/keycloak-admin,dst=/run/secrets/kc-admin,readonly" \
 --mount "type=bind,src=$root/secrets/pilot-founder-password,dst=/run/secrets/founder-password,readonly" \
 --mount "type=bind,src=$root/secrets/pilot-b-only-password,dst=/run/secrets/restricted-password,readonly" \
 -e "PILOT_A_FUNNEL_ID=$funnel_a" -e "PILOT_B_FUNNEL_ID=$funnel_b" \
 node:22-alpine node /app/pilot.mjs)" || {
 echo 'MO_REAL_IDENTITY_BLOCKED=keycloak_or_fga';exit 5;
}
read -r founder restricted kc_a kc_b store_id < <(
 printf '%s' "$identity" | python3 -c '
import json,re,sys
d=json.load(sys.stdin)
uuid=re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$")
for k in ("founder","restricted","kcA","kcB"):
 if not isinstance(d.get(k),str) or not uuid.fullmatch(d[k]):
  raise SystemExit(4)
if d.get("realm")!="syndes-pilot" or d.get("client")!="syndes-pilot-staging-login":
 raise SystemExit(4)
if not isinstance(d.get("storeId"),str) or not re.fullmatch(r"[A-Za-z0-9_-]{8,128}",d["storeId"]):
 raise SystemExit(4)
print(d["founder"],d["restricted"],d["kcA"],d["kcB"],d["storeId"])
')
[[ "$founder" =~ ^[0-9a-f-]{36}$ && "$restricted" =~ ^[0-9a-f-]{36}$
 && "$kc_a" =~ ^[0-9a-f-]{36}$ && "$kc_b" =~ ^[0-9a-f-]{36}$ ]] || exit 5
state="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT state FROM tenant_registry WHERE tenant_id='$tid'")"
if [[ "$state" == provisioned ]];then
 docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 \
 -v "founder=$founder" -v "restricted=$restricted" -v "kc_a=$kc_a" -v "kc_b=$kc_b" \
 -U postgres -d syndes_staging_control < greenfield-stage-first-user.sql >/dev/null || {
 echo 'MO_REAL_IDENTITY_BLOCKED=control_activation';exit 5;
 }
elif [[ "$state" != active ]];then
 echo 'MO_REAL_IDENTITY_BLOCKED=control_state';exit 5
fi
control_ok="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d syndes_staging_control -c "SELECT CASE WHEN
 (SELECT count(*) FROM tenant_memberships WHERE tenant_id='$tid' AND state='active'
 AND principal_id IN ('$founder','$restricted'))=2
 AND (SELECT count(*) FROM platform_keycloak_org_links WHERE tenant_id='$tid' AND state='active'
 AND ((organization_id='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1' AND keycloak_organization_id='$kc_a')
 OR (organization_id='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2' AND keycloak_organization_id='$kc_b')))=2
 AND (SELECT count(*) FROM platform_signup_intents WHERE tenant_id='$tid' AND founder_id='$founder' AND state='ready')=1
 AND (SELECT count(*) FROM tenant_registry WHERE tenant_id='$tid' AND state='active')=1
 THEN 'PASS' ELSE 'BLOCKED' END")"
[[ "$control_ok" == PASS ]] || {echo 'MO_REAL_IDENTITY_BLOCKED=control_verification';exit 5;}
membership="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$tenant" -c "SELECT
 (SELECT count(*) FROM platform_org_memberships)::text||':'||
 (SELECT count(*) FROM platform_workspace_memberships)::text")"
if [[ "$membership" == 0:0 ]];then
 docker exec -i "$pg" psql --no-psqlrc -X -q -v ON_ERROR_STOP=1 \
 -v "founder=$founder" -v "restricted=$restricted" \
 -U postgres -d "$tenant" < greenfield-stage-membership.sql >/dev/null || {
 echo 'MO_REAL_IDENTITY_BLOCKED=tenant_membership';exit 5;
 }
elif [[ "$membership" != 3:6 ]];then
 echo 'MO_REAL_IDENTITY_BLOCKED=partial_membership';exit 5
fi
tenant_ok="$(docker exec "$pg" psql -X -At -v ON_ERROR_STOP=1 -U postgres -d "$tenant" -c "SELECT CASE WHEN
 (SELECT count(*) FROM platform_org_memberships WHERE principal_id='$founder' AND state='active' AND role='admin')=2
 AND (SELECT count(*) FROM platform_org_memberships WHERE principal_id='$restricted' AND state='active'
 AND organization_id='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2' AND role='editor')=1
 AND (SELECT count(*) FROM platform_org_memberships WHERE principal_id='$restricted'
 AND organization_id='a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1')=0
 AND (SELECT count(*) FROM platform_workspace_memberships WHERE principal_id='$founder' AND state='active')=4
 AND (SELECT count(*) FROM platform_workspace_memberships WHERE principal_id='$restricted' AND state='active'
 AND organization_id='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2')=2
 AND (SELECT count(*) FROM whatsapp_accounts)=0
 AND (SELECT count(*) FROM inbox_conversations)=0
 THEN 'PASS' ELSE 'BLOCKED' END")"
[[ "$tenant_ok" == PASS ]] || { echo 'MO_REAL_IDENTITY_BLOCKED=tenant_verification';exit 5; }
store_file="$root/secrets/pilot-fga-store-id"
if [[ ! -e "$store_file" && ! -L "$store_file" ]];then
 tmp="$(mktemp "$root/secrets/.pilot-fga.XXXXXXXX")"
 printf '%s\n' "$store_id" > "$tmp"
 chmod 0600 "$tmp"
 mv -n "$tmp" "$store_file"
 [[ ! -e "$tmp" ]] || {rm -f "$tmp";exit 5;}
fi
[[ -f "$store_file" && ! -L "$store_file"
 && "$(stat -c %a "$store_file")" == 600
 && "$(cat "$store_file")" == "$store_id" ]] || exit 5
echo 'MO_REAL_IDENTITY_STAGE_KC26_TWO_SIGNED_USERS_TWO_ORGS_MEMBERSHIP_PASS'
echo 'MO_REAL_IDENTITY_STAGE_FGA_EXACT_FUNNEL_ALLOW_CROSS_ORG_DENY_PASS'
echo 'MO_REAL_IDENTITY_STAGE_CONTROL_READY_TWO_ORGS_SCOPED_PG17_PASS'
echo 'MO_REAL_IDENTITY_STAGE_LEGACY_WHATSAPP_AND_PRODUCTION_UNTOUCHED'
