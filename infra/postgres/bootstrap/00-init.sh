#!/bin/bash
set -Eeuo pipefail
for variable in PG_KEYCLOAK_PASSWORD PG_OPENFGA_PASSWORD PG_CORE_PASSWORD; do
  if [[ -z "${!variable:-}" ]]; then echo "Missing $variable" >&2; exit 1; fi
done
# psql variables read secrets from environment, not from command-line arguments.
psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres <<'SQL'
\getenv keycloak_pwd PG_KEYCLOAK_PASSWORD
\getenv openfga_pwd PG_OPENFGA_PASSWORD
\getenv core_pwd PG_CORE_PASSWORD
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_keycloak', :'keycloak_pwd')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='syndes_keycloak') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_openfga', :'openfga_pwd')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='syndes_openfga') \gexec
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', 'syndes_core', :'core_pwd')
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
