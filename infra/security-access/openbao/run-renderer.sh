#!/usr/bin/env bash
# Operator-triggered one-shot OpenBao -> Docker Secrets transfer.
# Run on the authorized Linux Docker host AFTER unsealing OpenBao.
set -Eeuo pipefail
cd "$(dirname "$0")/../../.."
out="/run/syndes/runtime"
auth="/run/syndes/approle/runtime-delivery"
cert="$PWD/infra/security-access/openbao/tls/server.crt"
if [[ ! -r "$cert" || ! -s "$auth/role-id" || ! -s "$auth/secret-id" ]]; then
  echo "Missing TLS trust or provisioner identity; aborting." >&2
  exit 1
fi
# Credentials must never be written to the root filesystem or a named volume.
if [[ "$(findmnt -T /run -no FSTYPE)" != "tmpfs" ]]; then
  echo "/run is not tmpfs; refusing to render plaintext secrets." >&2
  exit 1
fi
sudo install -d -m 0700 -o root -g root /run/syndes "$out"
docker run --rm --network syndes-secrets \
  --mount "type=bind,src=$PWD/infra/security-access/openbao/render_runtime.py,dst=/app/render_runtime.py,readonly" \
  --mount "type=bind,src=$auth,dst=/run/approle,readonly" \
  --mount "type=bind,src=$out,dst=/mnt/runtime" \
  --mount "type=bind,src=$cert,dst=/etc/openbao/ca.crt,readonly" \
  --security-opt no-new-privileges \
  --cap-drop ALL \
  python:3.12-alpine python /app/render_runtime.py
echo "Six runtime secret files are ready on protected /run tmpfs."
