#!/usr/bin/env bash
# Runs only inside a BRAND-NEW staging PG17 volume; never connect to Syndes
# operational data. Compose mounts this in docker-entrypoint-initdb.d.
set -Eeuo pipefail
[[ "${POSTGRES_DB:-}" == postgres && "${POSTGRES_USER:-}" == postgres ]] || exit 3
[[ -r /run/secrets/staging_kc_db_password ]] || exit 3
password="$(cat /run/secrets/staging_kc_db_password)"
[[ ${#password} -ge 32 && "$password" =~ ^[[:alnum:]]+$ ]] || exit 3
# Quote variables through PostgreSQL's own SQL literal formatter; never shell
# interpolate an identity or password into SQL. Do not print credentials.
psql --no-psqlrc --set=ON_ERROR_STOP=1 --username postgres --dbname postgres \
  --set=kc_password="$password" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L',
 'syndes_staging_keycloak', :'kc_password') \gexec
SELECT format('CREATE DATABASE %I OWNER %I',
 'syndes_staging_keycloak', 'syndes_staging_keycloak') \gexec
CREATE DATABASE syndes_staging_control;
SQL
unset password
echo 'MO_REL04_STAGING_PG17_DATABASES_INITIALIZED'
