#!/usr/bin/env python3
"""TEST ONLY: create disposable file secrets from throwaway CI fixtures."""
import json
from pathlib import Path
from urllib.parse import quote

env = {}
for line in Path("infra/.env.ci").read_text().splitlines():
    if line and not line.startswith("#") and "=" in line:
        key, value = line.split("=", 1)
        env[key] = value
root = Path("/run/syndes/runtime")
root.mkdir(parents=True, exist_ok=True)
root.chmod(0o700)
passwords = {
    "pg_admin_password": env["POSTGRES_SUPERUSER_PASSWORD"],
    "pg_keycloak_password": env["PG_KEYCLOAK_PASSWORD"],
    "pg_openfga_password": env["PG_OPENFGA_PASSWORD"],
    "pg_core_password": env["PG_CORE_PASSWORD"],
}
db_uri = "postgres://syndes_openfga:" + quote(env["PG_OPENFGA_PASSWORD"], safe="") + "@syndes-postgres:5432/syndes_openfga?sslmode=disable"
values = {**{k:v+"\n" for k,v in passwords.items()},
          "keycloak.conf":"db-password="+env["PG_KEYCLOAK_PASSWORD"]+"\nbootstrap-admin-username="+env["KEYCLOAK_BOOTSTRAP_ADMIN_USERNAME"]+"\nbootstrap-admin-password="+env["KEYCLOAK_BOOTSTRAP_ADMIN_PASSWORD"]+"\n",
          "openfga.yaml":json.dumps({"datastore":{"engine":"postgres","uri":db_uri},
                                     "authn":{"method":"preshared","preshared":{"keys":[env["OPENFGA_PRESHARED_KEY"]]}},
                                     "playground":{"enabled":False},"log":{"format":"json"}})+"\n"}
for name, contents in values.items():
    p = root / name
    p.write_text(contents, encoding="utf-8")
    p.chmod(0o644)
print("Disposable CI secret files created; no values logged")
