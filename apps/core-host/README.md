# Core Host — NestJS composition root

Hosts the reusable `@syndes/core-kernel` in a single Node.js process, with PostgreSQL control-plane membership, Keycloak bearer JWTs and OpenFGA resource permission checks.

- `GET /healthz`: process health.
- `GET /readyz`: database connectivity and kernel startup.
- `POST /v1/tenants/:tenantId/authorize`: trusted JWT and `{"action":"read","resource":"person:42"}`, returns allowed only if both PostgreSQL membership and OpenFGA permit it.

Only authenticated identities validated against configured Keycloak JWKS, issuer and audience are accepted. Input tenant ID never directly selects a DB. No fallback authorization is available. This is a host foundation, not an implemented CRM.

## OpenBao AppRole secrets (first live consumer)

The Core Host no longer accepts `CORE_CONTROL_DB_URL` or `CORE_OPENFGA_TOKEN` through Docker Compose. On every application startup, it authenticates with OpenBao using **two read-only file-mounted AppRole credentials**, obtains `kv/data/production/core-host`, extracts `control_db_url` and `openfga_token`, and revokes the bootstrap token. The service refuses to start if TLS verification, authentication, secret loading or token revocation fails. The database password and OpenFGA token are **never placed in Docker Compose environment variables**.

The Core Host Docker container runs as UID/GID `10001:10001`. Deliver AppRole credentials to the host's volatile `/run/syndes/approle/core-host/` directory from an **authorized off-host operator or secret distributor**:

- `role-id`: non-secret identifier; `root:10001`, mode `0440`.
- `secret-id`: bootstrap credential; `root:10001`, mode `0440`.
- Directory `root:10001`, mode `0750`; `/run` is typically volatile. Validate file ownership under rootless/user-namespace Docker configurations.
- OpenBao TLS certificate from `infra/security-access/openbao/tls/server.crt` is mounted read-only and loaded through `NODE_EXTRA_CA_CERTS`; never disable peer verification.

The OpenBao AppRole must have policy `infra/security-access/openbao/policies/core-host.hcl` (read access to its path only). Provision it through the approved operator workflow, with a limited token lifetime. The `secret-id` remains a sensitive **bootstrap credential** while the Core Host can restart; rotate or revoke it if the host is compromised. This is not an identity-free bootstrap mechanism. In a future phase, a platform-native workload identity may replace the two bootstrapping files.

**Manual preparation before deployment:** an administrator must populate the KV v2 secret path with `control_db_url` and `openfga_token`, create and bind the AppRole and distribute the login files. None of these is automatically created in production by CI or Compose. Never copy the disposable CI credentials to a real host.

The initial retrieval occurs at startup; running Node's token is revoked after retrieval, but database/FGA credentials remain active in process memory until restart. Rolling key rotation therefore requires a controlled restart for now.

## Tenant CRM API

The authenticated Core Host exposes `/v1/tenants/:tenantId/crm` with Person/Organization CRUD, relations, tags, notes, timeline, employees, ChannelIdentity, duplicate suggestions, and CSV import/export. Each action verifies a Keycloak JWT, enforces CoreKernel tenant membership and an OpenFGA permission **before** resolving a tenant database.

The tenant pool provider checks the canonical active tenant mapping in `syndes_control` and fetches `kv/data/production/tenants/<uuid>` from OpenBao using a **separate limited AppRole** (`infra/security-access/openbao/policies/core-tenant-db.hcl`). Each tenant KV record contains the `username` (must match the registry role) and `password` (distinct PostgreSQL login for that tenant). The DB host is fixed at `syndes-postgres`; arbitrary client-provided DSNs, hosts, roles and database names are rejected. Inactive or missing tenants cannot resolve a DB. Up to 8 small pools are cached with idle credential refresh.

For production, provision and rotate per-tenant OpenBao KV records as part of the audited onboarding transaction. Mount `/run/syndes/approle/core-tenant-db/{role-id,secret-id}` as protected files (root:10001, mode 0440), separate from the Core Host AppRole. No DB superuser password is present in the application. The Core Host application cannot start normally without the original Core Host OpenBao credentials, but the tenant-specific AppRole is accessed only on first CRM operation and fails closed when absent.

**Warning:** This implementation enforces access at request boundaries; the OpenFGA relationship assignments and user memberships are still provided by the separate onboarding administrative workflow. Do not activate real customers before those are provisioned and verified.

## Installed package modules

Business API controllers and UI files are **not part of Core Host**. The generic loader reads `apps/core-host/config/modules.json`, imports the approved packages' `./plugin` entry points, validates dependencies and registers their Nest API modules and exact static assets. The Core CRM is the first installed reference module. `/modules/:moduleId/config` exposes only public OIDC client metadata declared by each package. All business routes remain protected by CoreKernel membership and OpenFGA permission checks. See `docs/engineering/CORE-MODULE-MOUNTING.md`.

## Tenant module installer (AK-30 candidate)

An operator-only, inactive candidate is implemented in src/module-installer.ts with PLAN/APPLY/VERIFY and a protected tenant ledger. It is NOT mounted in Nest or callable over HTTP; Core Host runtime's tenant role must not have migration DDL privilege. See docs/engineering/AK-30-01-02-TENANT-INSTALLER-20261110.md. Both PostgreSQL bootstrap SQL candidates are not registered in operational setup. The separate Platform Manager frontend will eventually show **administrative states** through authenticated Control Plane APIs; it must not open tenant DB connections or execute SQL.

## Host configurável por perfil (feature CMP-01 a CMP-09)

O Host já carrega descritores confiáveis via arquivo fixo `config/modules.json`, compõe NestJS no startup e rejeita dependências inválidas. **Ainda não** seleciona perfis por instância nem produz imagem mínima: o Dockerfile inclui os pacotes implementados. A evolução aprovada separa responsabilidades: Kernel = ports/contratos; Host = composition root/adapters; módulos = domínio; infra = release, segredo e isolamento. Nunca permitir plugin arbitrário vindo do cliente, nem confundir seleção no perfil com entitlement do tenant. Para seguir o roteiro, consultar `docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md`, o WBS CMP e a issue #104.
