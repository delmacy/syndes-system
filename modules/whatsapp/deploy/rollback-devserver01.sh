#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/../../.."
# Stop higher-priority Traefik routers, keeping both original Compose containers untouched.
docker compose -p syndes-whatsapp-cutover -f modules/whatsapp/deploy/devserver01-cutover.compose.yaml stop
printf '%s\n' 'Original Core Host and Workspace Traefik routers are active again.'
printf '%s\n' 'Gateway callback still needs a compatible Core Host or should be paused before WhatsApp messaging resumes.'
