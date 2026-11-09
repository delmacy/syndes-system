#!/usr/bin/env bash
# Authorized operator only: scoped AppRole -> verified OpenBao TLS -> private tmpfs.
# Never put bearer tokens, AppRole IDs or DB passwords in Compose environment.
set -Eeuo pipefail
cd "$(dirname "$0")/../../../"
out=/run/syndes/platform-manager
auth=/run/syndes/approle/platform-manager
cert="${MASTER_BAO_CA_FILE:-$PWD/infra/security-access/openbao/tls/server.crt}"
if [[ "$EUID" -ne 0 ]]; then
  echo "Run as authorized root operator; do not bypass filesystem ACL" >&2
  exit 1
fi
if [[ "$(findmnt -T /run -no FSTYPE)" != tmpfs ]]; then
  echo "/run must be tmpfs" >&2
  exit 1
fi
if [[ ! -s "$auth/role-id" || ! -s "$auth/secret-id" || ! -s "$cert" ]]; then
  echo "Scoped AppRole and trusted OpenBao CA are required" >&2
  exit 1
fi
install -d -m 0700 -o root -g root "$out"
docker run --rm --network syndes-secrets \
  --security-opt no-new-privileges --cap-drop ALL --cap-add CHOWN \
  --read-only --tmpfs /tmp:rw,nosuid,nodev,noexec,size=8m \
  --mount "type=bind,src=$PWD/infra/master-admin/openbao/render-master.py,dst=/app/render-master.py,readonly" \
  --mount "type=bind,src=$auth,dst=/run/approle,readonly" \
  --mount "type=bind,src=$cert,dst=/etc/openbao/ca.crt,readonly" \
  --mount "type=bind,src=$out,dst=/mnt/runtime" \
  python:3.12-alpine python /app/render-master.py
test "$(stat -c %a "$out/master_db_url")" = 600
test "$(stat -c %u "$out/master_db_url")" = 1000
echo "Scoped Platform Manager runtime secret ready in tmpfs"
