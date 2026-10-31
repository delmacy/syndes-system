# Syndes WhatsApp Gateway — Foundation (WIP)

## Status
**Control plane only.** This branch implements a usable admin dashboard, local SQLite operational storage, session registry, tenant links, authenticated REST and a read-only MCP JSON-RPC endpoint. **It does not yet connect to WhatsApp, scan QR, send messages, receive events, or implement the Keycloak token flow.** The stored state `created` is not a live WhatsApp session. Do not expose this build publicly or treat it as production-ready.

## Local run

```sh
cd services/whatsapp-gateway
cp .env.example .env
# Replace GATEWAY_ADMIN_TOKEN with a securely generated secret
docker compose up --build -d
```

The sample Compose file intentionally publishes **no host ports**, and the Docker network is internal. To inspect the dashboard locally without opening a public port:

```sh
docker compose exec gateway sh -c 'echo dashboard: http://127.0.0.1:8080'
```

For an actual browser, bind a protected local reverse proxy or temporarily add a localhost-only port mapping `127.0.0.1:8080:8080`. Do not publish the admin API directly to the internet. Use an authenticated reverse proxy and TLS before remote access.

## API (control plane, token required)
- `GET /healthz` (no auth; readiness only)
- `GET /` (dashboard shell; data API requires token)
- `GET /api/v1/overview`
- `POST /api/v1/sessions` `{"id":"device-1"}` — metadata only, no WhatsApp connection
- `POST /api/v1/links` `{"session_id":"device-1","tenant_id":"tenant-1","can_send":true}`
- `DELETE /api/v1/links/{session}/{tenant}`
- `POST /api/v1/authorize/send` `{"session_id":"device-1","tenant_id":"tenant-1"}` — decision only, does not send messages
- `POST /mcp` (experimental JSON-RPC read-only tool `gateway_overview`)

Authorization currently uses a single static administrator bearer token. It is a bootstrap mode, **not tenant-scoped access control** and not a replacement for Keycloak. The endpoint `authorize/send` shows only one condition of the eventual authorization chain. User identity, conversations, tenant membership and service authentication still require integration with the Syndes Core.

## Data protection
- Operational data: `/data/gateway.db`, WAL, foreign keys, bounded SQLite pool.
- Whatsmeow SQLStore will use **a separate `sessions.db`** after provider integration.
- No database access or credentials are sent to the browser.
- Secret stays in `.env` / protected deployment secrets.
- Use backups consistent with SQLite (online backup API or `VACUUM INTO`, not uncoordinated file copies) and test restore.
- Do not mount the same SQLite for concurrent writing across multiple host replicas.

## Tests and workflow
`go test -race -count=1 ./...`, `go vet ./...` and Docker build are configured in the GitHub Actions workflow triggered on every push and PR. Verification must be green before merging. This is a foundation only; real-provider integration tests, queue recovery, Keycloak authentication, MCP protocol conformance, message/tenant isolation and browser E2E tests remain pending.

## Next acceptance steps
1. Pin whatsmeow to tested upstream revision (current upstream uses Go 1.26+), add SQLStore and a single device/session supervisor.
2. QR pairing, reconnection, logout, message receive/send and media.
3. Durable outbox with 40 messages/minute per number and fair tenant scheduling, idempotency, retry and status.
4. Keycloak JWKS validation, scoped service tokens and Syndes Core permission checks.
5. MCP protocol compliance and scoped write tools, audit and rate-limiting.
6. Production-ready dashboard: connection statuses, error histories, QR pairing, numbers and tenant binding controls.
7. Real-provider E2E and backup/restore verification before release.
