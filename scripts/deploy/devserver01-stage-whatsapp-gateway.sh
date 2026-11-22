#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
[[ "$#" == 2 && "$1" == apply && "${SYNDES_STAGE_WHATSAPP_APPROVAL:-}" == ACTIONS_APPROVED_STAGE_WHATSAPP ]] || exit 2
[[ "${SOURCE_SHA:-}" =~ ^[a-f0-9]{40}$ && "$(id -un)" == delmacy && "$(hostname -s)" == DevServer01 ]] || exit 2
bundle="$2"
[[ -d "$bundle" && ! -L "$bundle" && "$(stat -c %a "$bundle")" == 700 ]] || exit 3
cd "$bundle"
sha256sum -c MANIFEST.sha256 --status
root=/home/delmacy/.local/share/syndes-multiorg-staging
[[ -d "$root/runtime" && -d "$root/secrets" && "$(stat -c %a "$root")" == 700 ]] || exit 3
project=syndes-multiorg-staging
one(){
 local cid
 cid="$(docker ps -q --filter "label=com.docker.compose.project=$project" --filter label=syndes.environment=multi-org-staging --filter "label=syndes.component=$1")"
 [[ "$cid" =~ ^[a-f0-9]{12}$ ]] || return 3
 printf '%s\n' "$cid"
}
core="$(one core-host)"
pg="$(one control-postgres)"
[[ "$(docker network inspect -f '{{.Internal}}' "${project}_staging_internal")" == true ]] || exit 3
[[ "$(docker exec "$pg" psql -XAt -v ON_ERROR_STOP=1 -U postgres -d syndes_tenant_1f5a8ce93f0148cca0132198d99e7510 -c "SELECT to_regclass('public.whatsapp_history_commands') IS NOT NULL")" == t ]] || exit 3

export STAGE_WHATSAPP_IMAGE="syndes/whatsapp-gateway:stage-$SOURCE_SHA"
docker load -i gateway.tar >/dev/null
[[ "$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$STAGE_WHATSAPP_IMAGE")" == "$SOURCE_SHA" ]] || exit 3
[[ "$(docker image inspect -f '{{.Config.User}}' "$STAGE_WHATSAPP_IMAGE")" == 10001:10001 ]] || exit 3
secret_dir="$root/secrets"
if [[ ! -e "$secret_dir/whatsapp-db.env" ]];then
 (set -o noclobber; { printf "POSTGRES_PASSWORD="; openssl rand -hex 32; } > "$secret_dir/whatsapp-db.env")
fi
[[ -f "$secret_dir/whatsapp-db.env" && ! -L "$secret_dir/whatsapp-db.env" && "$(stat -c %a "$secret_dir/whatsapp-db.env")" == 600 ]] || exit 3
store_password="$(< "$secret_dir/whatsapp-db.env")"
store_password="${store_password#POSTGRES_PASSWORD=}"
[[ "$store_password" =~ ^[0-9a-f]{64}$ ]] || exit 3
if [[ ! -e "$secret_dir/whatsapp-gateway.env" ]];then
 service_token="$(openssl rand -hex 32)"
 webhook_token="$(openssl rand -hex 32)"
 (set -o noclobber; printf 'WHATSAPP_STORE_DSN=postgresql://whatsapp_stage:%s@whatsapp-db:5432/whatsapp_stage?sslmode=disable\nWHATSAPP_WHATSMEOW_TOKEN=%s\nWHATSAPP_WEBHOOK_TOKEN=%s\n' "$store_password" "$service_token" "$webhook_token" > "$secret_dir/whatsapp-gateway.env")
fi
[[ -f "$secret_dir/whatsapp-gateway.env" && ! -L "$secret_dir/whatsapp-gateway.env" && "$(stat -c %a "$secret_dir/whatsapp-gateway.env")" == 600 ]] || exit 3
unset store_password service_token webhook_token
install -m 600 whatsapp-compose.yaml "$root/runtime/whatsapp-compose.yaml"
compose=(docker compose --project-name "$project" -f "$root/compose.yaml" -f "$root/runtime/whatsapp-compose.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" up -d --wait --wait-timeout 100 whatsapp-db whatsapp-gateway >/dev/null
gateway="$(one whatsapp-gateway)"
[[ "$(docker inspect -f '{{.Image}}' "$gateway")" == "$(docker image inspect -f '{{.Id}}' "$STAGE_WHATSAPP_IMAGE")" ]] || exit 4
[[ -z "$(docker port "$gateway")" ]] || exit 4
for n in $(seq 1 30);do
 if docker exec "$core" node -e "fetch('http://whatsapp-gateway:19083/healthz',{signal:AbortSignal.timeout(2000)}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))" >/dev/null 2>&1;then break;fi
 [[ "$n" != 30 ]] || exit 5
 sleep 2
done
echo STAGE_WHATSAPP_GATEWAY_PRIVATE_HEALTH_PASS_PAIRING_PENDING
