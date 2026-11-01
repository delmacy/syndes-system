# Syndes infrastructure: three independently managed stacks

Deploy order is **PostgreSQL → Security and Access (Keycloak + OpenFGA + OpenBao) → Core Host** (even though the implementation follows Core Host first).

1. Copy `infra/.env.example` to `infra/.env`; replace every placeholder with unique random credentials. Do not commit secrets.
2. PostgreSQL: `docker compose --env-file infra/.env -f infra/postgres/compose.yaml up -d`. This creates **syndes_control**, **syndes_keycloak**, **syndes_openfga** on the first initialization only.
3. Security and Access: provision an internal TLS certificate for `openbao` as documented in `infra/security-access/openbao/README.md`, then run `docker compose --env-file infra/.env -f infra/security-access/compose.yaml up -d`. **Initialize and unseal OpenBao separately**; never run it in development mode. The OpenFGA migration job runs before its API. Keycloak requires trusted Traefik HTTPS ingress for `KEYCLOAK_PUBLIC_URL`.
4. Configure a Keycloak `syndes` realm, token audience `syndes-core`, OIDC clients and roles. Create an OpenFGA store and publish the versioned model, then set `CORE_OPENFGA_STORE_ID`. **None are created automatically by Compose**.
5. Core Host: `docker compose --env-file infra/.env -f apps/core-host/compose.yaml up -d --build` after the above configuration.

## Data isolation

The single PostgreSQL **server** has separate **databases** for the control plane, Keycloak, OpenFGA and every tenant. **OpenBao does not use PostgreSQL**; it uses its own encrypted, persistent Raft storage volume under the same Security and Access Compose project. No schema per tenant and no tenant database in the identity stack. `syndes_core` only receives SELECT access to the control registry and memberships; no tenant database superuser credential is given to Core Host.

Tenant DB creation is an explicit privileged operation. Run from an authorized operator shell with a unique secret already loaded from a vault or secrets manager:

```sh
export TENANT_ID=4ab44379-d557-4df6-a2be-d44e121a8077
# Load TENANT_DB_PASSWORD from a protected secret store; never paste into shell history.
docker compose --env-file infra/.env -f infra/postgres/compose.yaml exec -T \
  -e TENANT_ID -e TENANT_DB_PASSWORD postgres bash /opt/syndes/provision-tenant.sh
unset TENANT_DB_PASSWORD
```

The script creates a dedicated tenant DB role and `syndes_tenant_<uuid-without-hyphens>`, then registers the mapping as `provisioned` in `syndes_control`. Repeating the same tenant operation is idempotent. Do not use a shared password among tenants.

No tenant is activated or granted membership automatically. Activation and FGA tuple assignments must occur only through a separately audited onboarding workflow. Control DB IDs are canonical: never choose a tenant database using client-input strings.

## Operations

- Avoid publishing PostgreSQL, OpenFGA APIs, Keycloak admin port or Core Host directly to the internet.
- PostgreSQL runs on the dedicated private `syndes-data` Docker network. Keycloak and OpenFGA share `syndes-security-access`. OpenBao is restricted to the separate internal `syndes-secrets` network; no OpenBao ports are published.
- Pin version tags, avoid `latest`, and review security updates periodically.
- Back up ALL databases using consistent `pg_dump` snapshots, including roles, and test restoration; one database per tenant does not mean one PostgreSQL server failure cannot affect everyone.
- Set conservative memory pools; monitor actual RSS under realistic load before setting replica counts.
- Docker initialization scripts run only with a new volume. Do not rely on them as a migrations engine for an existing PostgreSQL volume.
- GitHub Actions validates syntax and a disposable PostgreSQL instance; production auth bootstrap and external Keycloak HTTPS integration remain separate acceptance gates.

## OpenFGA resource identities

The Core Host maps (tenant UUID, domain resource name) to a stable SHA-256 hex key. An OpenFGA resource object is `resource:<sha256(tenantUUID + "|" + resource)>`, not a raw `resource:<tenant>:<domain>:<id>` tuple. This avoids invalid OpenFGA object IDs, prevents accidental resource collisions between tenants, and keeps identifiers opaque. Use the same mapping in onboarding tuple writers, and test it before releasing any module.

## Secrets migration status

The OpenBao service is added without root tokens, unseal shares or database credentials in its Compose environment. **Core Host now loads its two sensitive runtime credentials directly from OpenBao** using a tightly scoped AppRole file secret and verified TLS. PostgreSQL, Keycloak and OpenFGA still receive their own startup passwords through temporary Compose environment variables from the existing `.env` workflow. Do not deploy those placeholders into production; complete the remaining three services' file/Agent delivery with per-service policies and workload identities. Never place unseal keys or OpenBao root tokens in `.env`, source control, GitHub Actions artifacts, container environment or Komodo configuration.
