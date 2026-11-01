#!/bin/bash
set -Eeuo pipefail
# PostgreSQL superuser reads role bootstrap passwords only from Docker Secrets.
# No passwords are injected into Compose environment variables or psql argv.
for file in /run/secrets/pg_keycloak_password /run/secrets/pg_openfga_password /run/secrets/pg_core_password; do
  if [[ ! -s "$file" ]]; then echo "Missing required PostgreSQL secret" >&2; exit 1; fi
done
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_keycloak', trim(pg_read_file('/run/secrets/pg_keycloak_password'), E'\n'))
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='syndes_keycloak') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_openfga', trim(pg_read_file('/run/secrets/pg_openfga_password'), E'\n'))
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='syndes_openfga') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_core', trim(pg_read_file('/run/secrets/pg_core_password'), E'\n'))
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='syndes_core') \gexec
SELECT 'CREATE DATABASE syndes_keycloak OWNER syndes_keycloak'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='syndes_keycloak') \gexec
SELECT 'CREATE DATABASE syndes_openfga OWNER syndes_openfga'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='syndes_openfga') \gexec
SELECT 'CREATE DATABASE syndes_control OWNER postgres'
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname='syndes_control') \gexec
REVOKE CONNECT ON DATABASE syndes_keycloak FROM PUBLIC;
REVOKE CONNECT ON DATABASE syndes_openfga FROM PUBLIC;
REVOKE CONNECT ON DATABASE syndes_control FROM PUBLIC;
GRANT CONNECT ON DATABASE syndes_keycloak TO syndes_keycloak;
GRANT CONNECT ON DATABASE syndes_openfga TO syndes_openfga;
GRANT CONNECT ON DATABASE syndes_control TO syndes_core;
SQL
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d syndes_control -f /opt/syndes/control.schema
