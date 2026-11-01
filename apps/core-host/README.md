# Core Host — NestJS composition root

Hosts the reusable `@syndes/core-kernel` in a single Node.js process, with PostgreSQL control-plane membership, Keycloak bearer JWTs and OpenFGA resource permission checks.

- `GET /healthz`: process health.
- `GET /readyz`: database connectivity and kernel startup.
- `POST /v1/tenants/:tenantId/authorize`: trusted JWT and `{"action":"read","resource":"person:42"}`, returns allowed only if both PostgreSQL membership and OpenFGA permit it.

Only authenticated identities validated against configured Keycloak JWKS, issuer and audience are accepted. Input tenant ID never directly selects a DB. No fallback authorization is available. This is a host foundation, not an implemented CRM.
