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
