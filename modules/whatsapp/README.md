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

## Go-only gateway direction (2026-11-02)
- WhatsApp protocol server and account session registry are Go + whatsmeow; CRM/Inbox remain downstream consumers over authenticated internal API.
- Account-scoped `/v1/accounts/{accountId}/{operation}` routes replace tenant-keyed sessions in the **source tree**. The sidecar requires trusted account provisioning and is NOT switched on in deployment.
- Go migration creates `syndes_whatsapp_accounts`; existing legacy tenant-only sessions are imported as account ID = tenant ID where the legacy table exists (preserves rollback).
- Events carry `accountId` and tenant is resolved by the server-side account registry.
- **Not production-ready:** caller authentication is still a shared Bearer; account-scoped credentials / binding authorization, Go compilation, queue-only outbound, callback routing and PostgreSQL integration tests are outstanding. Never expose routes directly.

## Go-only outbound delivery and security (incremental)
- Account token: HMAC-SHA256(master, `syndes-whatsapp-v1:tenantId:accountId`), sent as Bearer over private transport. The Core Host must derive scoped tokens **only after** Keycloak/OpenFGA authorization. Master token itself is rejected for account operations.
- `POST /v1/accounts/{accountId}/messages` now requires `idempotencyKey` and **queues** rather than calling whatsmeow in the HTTP handler.
- Go dispatcher serializes rate reservations via PostgreSQL account row locks and caps at 40/minute/account. Reservation and claim run in one transaction.
- Outbound messages with uncertain outcomes are marked failed (manual reconciliation), never blindly retried. A startup recovery marks stale processing claims uncertain.
- **Still pending:** backend account provisioning, outbound status API, transaction-level DB integration tests, dead-letter management, inbound consumer integration, operational health, multi-instance worker leases, and real WhatsApp acceptance.

## Versioned inbound event contract (2026-11-02)
- Go gateway POSTs an authenticated version 1 envelope to the existing internal callback URL with `type=whatsapp.message.received`, `tenantId`, `accountId`, and a nested normalized `message` body.
- Headers: `X-Syndes-Event-Version: 1`, `X-Syndes-Event-Type: whatsapp.message.received`.
- Callback retries remain buffered in the inbound outbox; CRM/Inbox integration must verify tenant/account mapping and deduplicate by account+external message ID.
- **Breaking integration gate:** the previous unversioned consumer, if any, must be adapted before activating the gateway. No new Core Host receiver has been enabled or deployed yet.


## Stage C3 — Whatsmeow account and route ownership; integration slice (2026-11-09)

**Release status:** draft only. Source changes are not installed on DevServer01 or on active tenant databases. This slice depends on #28 and the earlier foundation through #27.

The WhatsApp human HTTP API now resolves the actor from the trusted verifier, checks tenant membership and the existing whatsapp:accounts/read grant, and requires active membership in the ONE authorized default Organization and Workspace, Stage B audited backfill, and the SQL 002 single-context indexes. It does not accept caller-selected org/workspace IDs. Every account listing, account detail, create, toggle, pair, reconnect or disconnect, contact rename, avatar, or group action now uses this authorized context. Accounts themselves are organization-owned; workspaces gate operator access. Human Inbox WhatsApp replies, history and display decoration also propagate the verified context and scope related account/conversation SQL; legacy internal callers lacking scope are **not** treated as safe for multi-org.

The inbound webhook is still authenticated with its dedicated internal secret, not end-user FGA. It admits only enabled accounts with a non-NULL platform owner, and the worker selects pending events from those accounts and their active default workspaces. Projected conversations receive explicit immutable owning organization + origin/current workspace; conflict handling refuses an existing conversation with a different organization owner. Canonical JID reuse requires matching account ownership. The outbound worker requires an enabled owned account and, for an Inbox-originated reply, matching organization ownership of the Inbox message and conversation. Provider delivery metadata and routes remain account-local. Events lacking a valid owner are not projected or sent.

Migration **modules/organizations/sql/004_whatsapp_route_owner_guard.sql** (additive, after 003) preflights existing route ownership and fails closed if a route already crosses organizations, without repairing or deleting records. A database trigger checks the account and conversation owner on every route INSERT/UPDATE and prevents reassigning tenant, account or conversation identity. Legacy unbackfilled route rows are not deleted; attempts to update them without bound owners fail closed. The migration is idempotent and must be applied only through the controlled migration mechanism.

A disposable PostgreSQL test in **modules/whatsapp/test/pg-org-scope.mjs** constructs Org A and B (and their default workspaces) inside one tenant and verifies the complete path: account list/create/read isolation, raw inbound events and projection ownership, route mismatch rejection at SQL level, reply authorization by foreign UUID, and the durable outbound worker never dispatching an intent belonging to a foreign owner. The test drops 002 only in a rolled-back fixture; production must retain it.

**Open security gates:** SSE emission from Whatsmeow worker across replicas is not yet implemented; a tenant-only service path still exists for legacy callers. Multi-workspace routing, explicit account→workspace handling and authorized transfers across workspaces/organizations, preservation of history with revocation, schema uniqueness per organization and authoritative organization-scoped provider session controls require further design and testing. Before any removal of the single-context 002 indexes, those paths must be covered by cross-org and cross-workspace negative tests. No merge or deployment may imply multi-org is enabled.
