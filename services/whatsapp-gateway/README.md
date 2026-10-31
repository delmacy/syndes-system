# Syndes WhatsApp Gateway — active PR (not production-ready)

## Components

- `cmd/gateway`: headless Go HTTP REST + read-only MCP endpoint and outbound dispatcher.
- `internal/provider/whatsmeow`: real WhatsApp Web multidevice adapter, QR pairing, events, reconnection, text sending, groups and logout.
- `internal/supervisor`: one live process owner per device.
- `internal/store`: operational SQLite with sessions, tenant links, indexes and WAL.
- `internal/inbox`: persistent inbound event deduplication.
- `internal/outbox`: durable idempotent outbound queue, 40 claims per minute per session, conversation ownership checks.
- `internal/auth`: Keycloak RS256 JWT verification using cached JWKS, with issuer, audience, scope and expiry checks.
- `apps/whatsapp-admin` (different directory): independent Next.js interface, **not** part of this gateway.

### Key boundary

The gateway is an **administrative control plane**. The REST and MCP endpoints accept service-administrator identity, not arbitrary tenant end-user tokens. Tenant user membership, conversation history visibility and chat assignment in the Syndes Core are not yet integrated. Keep the frontend and API behind private trusted access; do not expose publicly before end-user OIDC and cross-tenant E2E tests.

## Storage

`/data/gateway.db` contains operational session metadata and tenant routing. `/data/sessions.db` is managed by whatsmeow SQLStore and contains linked-device keys. The two databases share an isolated named Docker volume but NOT a schema. Back them up with SQLite-consistent snapshots, restrict Docker volumes and verify restoration before production. Never share SQLite DBs between simultaneous writer containers.

## Authentication

Default bootstrap: `GATEWAY_ADMIN_TOKEN` (random secret >=32 chars) for trusted internal testing only.

For Keycloak service-to-service tokens, set all:
- `GATEWAY_ISSUER` to the exact realm URL.
- `GATEWAY_AUDIENCE` to the gateway audience configured on the client.
- `GATEWAY_JWKS_URL` to the realm's JWKS/certs endpoint (HTTPS).

With Keycloak variables configured, the bootstrap token does **not** bypass JWT validation. Keycloak clients need `gateway.admin` scope. The Next.js admin currently uses a bootstrap token and needs its own user-facing OIDC integration before these settings can be enabled for a production deployment.

## HTTP API (administrator only)

- `GET /healthz`
- `GET /api/v1/overview` (sessions, tenant links, exclusive conversation routes)
- `POST /api/v1/sessions` `{"id":"device-01"}`
- `POST /api/v1/sessions/{id}/connect`
- `POST /api/v1/sessions/{id}/disconnect`
- `POST /api/v1/sessions/{id}/logout` (revokes device)
- `GET /api/v1/sessions/{id}/status`
- `GET /api/v1/sessions/{id}/qr` (ephemeral pairing secret, never stored in SQLite)
- `GET /api/v1/sessions/{id}/groups`
- `POST /api/v1/links` `{"session_id":"device-01","tenant_id":"tenant-a","can_send":true}`
- `DELETE /api/v1/links/{session}/{tenant}`
- `POST /api/v1/conversations/assign` `{"session_id":"device-01","chat_id":"5511999999999","tenant_id":"tenant-a"}`
- `POST /api/v1/authorize/send` (link-only introspection; **not a complete send authorization**)
- `POST /api/v1/outbox` `{"id":"msg-uuid","session_id":"device-01","tenant_id":"tenant-a","recipient":"5511999999999","body":"Olá","priority":1}` — enqueue after link+conversation assignment.
- `POST /mcp`: minimal read-only JSON-RPC with `gateway_overview`; **full MCP Streamable HTTP conformance is not yet certified**.

Text messages are dispatched asynchronously if a session is authenticated and connected. The dispatcher enforces session-level limits and retries on failure. The actual WhatsApp service may still reject sends. This uses an unofficial WhatsApp Web library and carries platform account risk.

## Deployment

```sh
cd services/whatsapp-gateway
cp .env.example .env
# Set a strong GATEWAY_ADMIN_TOKEN
docker compose up --build -d
```

No published host port. The gateway egress network permits outbound WhatsApp connectivity. Provision a **private** route to the Go API from the standalone Next.js frontend or a trusted services-only network. Do not expose the internal gateway directly to the internet.

## Test gates

GitHub Actions on each push/PR run `go mod tidy`, `go vet ./...`, `go test -race -count=1 -cover ./...`, Go build and image build. Tests cover tenant access, exclusive route gating, queue idempotency and fixed-window limits, restart persistence, inbound deduplication, device ownership, provider mock, SQLite SQLStore migration and Keycloak RS256/JWKS rejection scenarios.

## Remaining release blockers

- Complete Keycloak OIDC login for the independent Next.js admin, OIDC/Core user-to-tenant authorization and audited service identity.
- Finish operational UI for QR pairing, queue, statuses, tenant number linking and error diagnostics.
- Media uploads/downloads, safe streaming, contact and receipt APIs, complete MCP conformance, and controlled account-specific rate limits across multiple devices.
- Delivery state tracking, queue recovery of leased sends with at-least-once semantics, per-tenant fairness, anti-spam and idempotency end-to-end with WhatsApp IDs.
- Real-number pairing, send/receive, reconnect, group and restore tests. These require a legitimate owned phone/number and should **not** be run with third-party accounts.
- Backup and restoration drill, threat model, load test, vulnerability review and deployment smoke test.
