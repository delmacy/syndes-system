# Syndes Infrastructure — PostgreSQL + Security and Access + Core Host

There are **three independent Compose projects**, not one container per module:
- `syndes-postgres`: one PostgreSQL server, databases `syndes_control`, `syndes_keycloak`, `syndes_openfga`, plus independently provisioned `syndes_tenant_<uuid>` databases.
- `syndes-security-access`: OpenBao (its own Raft volume), Keycloak, OpenFGA.
- Core Host (NestJS): one process for the business modules, built on `@syndes/core-kernel`.

## Bootstrap without persistent password environment files

OpenBao must be **started alone and unsealed before** any service that requires a password is launched. This avoids a database/secret-manager startup cycle.

1. On the authorized Linux host, provision private TLS cert/key with DNS SAN `openbao`, under `infra/security-access/openbao/tls/` (gitignored).
2. Ensure the private PostgreSQL Docker network exists, even though the database is not started yet: `docker network inspect syndes-data >/dev/null 2>&1 || docker network create --internal syndes-data`. The stack itself owns that named network when brought up.
3. Start **only OpenBao**: `docker compose --env-file infra/.env -f infra/security-access/compose.yaml up -d openbao`. The `.env` file contains only non-sensitive hostnames/audience/store identifiers; secrets are not read from it.
4. Initialize/unseal OpenBao through the approved operator procedure; never use a 1-of-1 unseal key or log the recovery material in production. Enable KV v2 and AppRole. Use `infra/security-access/openbao/policies/runtime-delivery.hcl` for a dedicated **runtime-delivery** identity, provision its role-id and secret-id out of band to protected `/run/syndes/approle/runtime-delivery/` files. The CI smoke test exercises this actual API and policy.
5. Populate the following OpenBao KV v2 paths using a privileged operator with unique randomly generated strong credentials:
   - `kv/production/postgres`: `admin_password`, `keycloak_password`, `openfga_password`, `core_password`.
   - `kv/production/keycloak`: `bootstrap_admin_username`, `bootstrap_admin_password`.
   - `kv/production/openfga`: `preshared_key`.
   - `kv/production/core-host`: `control_db_url`, `openfga_token` (the latter must match the OpenFGA service key and be rotated together).
6. Call `bash infra/security-access/openbao/run-renderer.sh` from the protected operator host; it verifies TLS, authenticates to OpenBao with the limited AppRole, renders six read-only Docker Secrets in `/run/syndes/runtime` (tmpfs), and revokes its temporary token. It **does not** log secret values or put them in Compose environment variables.
7. Start PostgreSQL: `docker compose --env-file infra/.env -f infra/postgres/compose.yaml up -d`. It consumes `POSTGRES_PASSWORD_FILE` and the three role bootstrap secrets directly as Docker-mounted files. Fresh volumes initialize the three independent system databases.
8. Start remaining Security and Access services: `docker compose --env-file infra/.env -f infra/security-access/compose.yaml up -d openfga-migrate openfga keycloak`. OpenFGA reads `/etc/openfga/config.yaml`; Keycloak reads `/run/secrets/keycloak_config`. Neither secret is an environment variable.
9. Configure a Keycloak `syndes` realm with clients and audience `syndes-core`; provision an OpenFGA store and its model. Set non-sensitive `CORE_OPENFGA_STORE_ID` in `.env` and initialize tenant membership tuples. **These are separate authorized onboarding actions, not automatic side effects of Compose**.
10. Provision the Core Host AppRole credentials to `/run/syndes/approle/core-host/`, then start Core Host: `docker compose --env-file infra/.env -f apps/core-host/compose.yaml up -d --build`.

`/run` is typically tmpfs on Linux; `run-renderer.sh` rejects non-tmpfs paths. Reboot requires the approved unseal/re-render/restart sequence. For automated recovery, establish a separately governed KMS/workload identity first. File secrets stay readable by the target container (per-container Docker secret mount) but the **host directory itself is root-only**. A compromised Docker daemon remains privileged over all secrets; only trusted operators can administer Docker/Komodo.

CI may use the committed `infra/.env.ci` throwaway test credentials to synthesize disposable files. This is solely a CI fixture, never a production fallback.

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

The OpenBao service is added without root tokens, unseal shares or database credentials in its Compose environment. **Core Host, PostgreSQL, Keycloak and OpenFGA now have file-backed secrets paths.** The runtime provisioner renders their secrets from OpenBao over verified TLS, while Core Host fetches its own two sensitive credentials directly using a scoped AppRole. Production still requires proper provisioning of real AppRoles, recovery material, Keycloak realm, FGA store and clients. Do not deploy those placeholders into production; confirm least-privilege runtime delivery, rotate startup secrets on controlled restarts and test all full-stack startup/failure paths. Never place unseal keys or OpenBao root tokens in `.env`, source control, GitHub Actions artifacts, container environment or Komodo configuration.
