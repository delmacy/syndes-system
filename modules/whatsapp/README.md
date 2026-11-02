# Syndes WhatsApp module — foundation (NOT production ready)

The official Go gateway sources were imported from the existing local whatsmeow sidecar.
Original source: `/home/delmacy/.local/share/syndes-whatsapp/services/whatsmeow`.
No gateway rewrite or WhatsApp Cloud API is used.

## Ownership
- **Go / whatsmeow:** WhatsApp protocol, sessions, sending, inbound event buffering.
- **WhatsApp module:** account ownership, normalized provider contracts, outbound persisted queue, rate limiting.
- **CRM:** person and channel identity.
- **Inbox:** conversation, message, assignment and human reply.
- **Core Host:** trusted authenticated tenant context and OpenFGA action checks.

## Current audit (2026-11-02)
- Gateway implements pairing/connect/disconnect/send, SQL session mappings, inbound event spool and retrying callback delivery.
- Callback currently points to `POST /api/v1/internal/whatsapp/events/{tenantId}`, **not present** in the checked Core Host or Inbox sources.
- Sidecar operation route accepts an arbitrary UUID tenant selector authenticated only by a shared bearer token. Do NOT expose or mount for live tenants until account-to-tenant binding is enforced server-side.
- Only text transport is evidenced; delivery receipts, media, outbound durable queue and 40/min/account are NOT validated.
- `go test ./...` could not run on DevServer01 because the Go executable is not installed.
- Existing local sidecar configuration is intentionally NOT copied. Never commit env files or PostgreSQL DSNs.
- This initial commit does not enable the plugin in Core Host and does not deploy the sidecar.

## Integration gates
1. Verify account ownership from a trusted Core Host context; bind each gateway request to a server-authorized account, not client-selected tenant.
2. Implement authenticated inbound callback that resolves account mapping and routes only to CRM/Inbox tenant database.
3. Add persistent outbound queue with idempotency, recoverable claims, retries and a per-account 40/min rate limiter.
4. Mount the module as `@syndes/whatsapp/plugin` only once API, SQL, authorization and tests are complete.
5. Run Go tests, PostgreSQL integration tests, cross-tenant denial tests and authorized real-number acceptance tests.

## Rollback
This branch does not change running infrastructure. Revert the commit or do not merge it to roll back.
The legacy local gateway remains untouched during migration; deduplicate deployments after validation.

## Phase 2 implementation (2026-11-02)
- Added `@syndes/whatsapp` package with provider-independent account repository.
- Added tenant-local `whatsapp_accounts` (multiple accounts/tenant), `whatsapp_outbox` and per-account outbound windows schema.
- Account reads always filter by trusted tenant ID, and `requireEnabled` denies disabled/missing accounts.
- Validation: `cd modules/whatsapp && npm test` passed five tests; TypeScript build passed.
- Not yet enabled: SQL migration rollout, real DB verification, Nest controllers, OpenFGA enforcement, Go gateway multi-account refactor, QR/UI, and durable queue processor. Existing gateway still maps one session per tenant, therefore it is NOT safe to enable multiple accounts in production.
- Rate quota schema is preparatory only: the dispatcher must reserve rate tokens atomically before sending and recover claims after crashes.
- Source runtime `dist/` is intentionally excluded from Git.

## Outbox foundation
- Added tenant-scoped durable outbound enqueue and SQL for atomic per-account 40/minute reservation. Eight local tests pass.
- Reservation SQL is NOT yet wired into a worker, and has not been executed against PostgreSQL. Do not treat quotas/retries as implemented operationally.
- Enqueue returns existing idempotency row on conflict; production must additionally reject same key with a different payload, to avoid ambiguous intent.

## HTTP API foundation
- Nest plugin descriptor and tenant accounts endpoints were compiled with local peer links: `GET /v1/tenants/:tenantId/whatsapp/accounts`, `GET /:accountId` and `POST /`.
- API uses Core JWT verifier, CoreKernel membership/OpenFGA, and trusted tenant database lease. It is not yet in Core Host's installed-modules allowlist; no live routes have been enabled.
- Peer dependency installation in offline mode failed because the npm registry package cache was missing. Local symlinks were used solely to compile; a reproducible installation/lockfile check is required before deployment.
- Device operations, secure account-bound sidecar protocol, callback receiver and Inbox integration are not implemented by these routes.
