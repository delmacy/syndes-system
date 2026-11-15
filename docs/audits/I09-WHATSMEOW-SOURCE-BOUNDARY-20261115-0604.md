# I09 — Whatsmeow runtime: source-boundary audit (2026-11-15 06:04 BRT)

- Repository: delmacy/syndes-system
- Audited immutable main: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (GitHub compare against main: identical immediately before branch creation).
- Audit branch: `audit/i09-whatsmeow-source-20261115-0604`.
- Catalog: `catalog/work-units.json` identifies I09 as `modules/whatsapp/gateway`, maturity `verified`, documentation parent P03. **Catalog maturity is not deployment or acceptance evidence.**
- Prior I08 audit branches exist; I09 selected as next owner after I07 checkpoint. Other writers' branches untouched.

## Inspected source and contracts
- `modules/whatsapp/AGENTS.md`: provider independence, per-account 40/min, tenant isolation, queue-first outbound, no unsolicited outreach; WA-CUT and opt-in event bridge explicitly distinguish code from operational switch.
- `modules/whatsapp/README.md`: separates Go protocol/session adapter, module ownership, CRM identity, Inbox conversation and Core Host authorization; explicitly says foundation NOT production ready and C3 draft, not installed.
- `gateway/whatsmeow/README.md`: internal-only HTTP sidecar, localhost default 127.0.0.1:19083, PostgreSQL sessions, callback with separate bearer.
- `gateway/whatsmeow/main.go`: config requires DSN, API URL and two tokens; source invokes `sqlstore.Container.Upgrade` and executes `CREATE TABLE IF NOT EXISTS` plus legacy session import at process startup. **Boundary finding I09-01:** runtime performs schema changes during startup, despite controlled migration expectations elsewhere. This audit did NOT run the program or any DDL. Require explicit migration ownership/versioning and startup policy reconciliation before operational acceptance.
- `gateway/whatsmeow/accounts_http.go`: internal tenant-scoped bearer verification, account UUID and tenant/account DB checks for coverage/avatar; coverage is process-memory metadata, not persisted audit or proof of event delivery.
- `gateway/whatsmeow/gateway.go`: Go whatsmeow client registry by account, restore of enabled paired sessions, QR session handling.
- `gateway/whatsmeow/outbound.go`: idempotency-key and payload validation, persisted outbound insert, per-account minute reservation with cap 40 and account row lock, processing claim, uncertain-on-restart fail marking. **Boundary finding I09-02:** these are source mechanisms, not proof of multi-replica safety, durable recovery acceptance, real provider behavior, or authorized tenant end-to-end path.
- `gateway/whatsmeow/architecture_test.go`: source-string assertions (not runtime authorization tests).
- `gateway/whatsmeow/postgres_integration_test.go`: SQL integration test is conditional on `SYNDES_WHATSAPP_TEST_PG_DSN` and skips without it; creates tables and mutates test DB. Not executed in this read-only audit.

## Public/private boundaries and evidence
- Public-facing Nest API ownership belongs to P03/Core Host; Go endpoints are **private internal service contracts**, not internet-facing public API. Caller trust must originate from server-side authorization; shared/internal tokens alone do not establish end-user authorization.
- Go callback/inbound event envelope documented as `whatsapp.message.received` v1; opt-in TypeScript platform bridge documented as `whatsapp.message.received.v2`. No claim of an active deployed consumer or cutover. Full receiver/DTO and event-dispatch implementation not traced in this slice.
- Go sidecar SQL registry, outbox, rate windows and session migrations are present in source; tenant-local SQL 002/008 and organizational ownership guard are separately documented. No SQL applied, no migration executed, no runtime inspected.
- Source files exist; test definitions exist; **tests passed on this SHA: unknown**; **CI: not checked**; **deployed/homologated: not evidenced**. The catalog label `verified` must not be interpreted as those states.
- Not inspected exhaustively: remainder of 29 Go gateway files, complete HTTP route table, callbacks, receipts, QR, group/media handling, Go tests, Nest adapters/guards, tenant DB schemas, exact CI run artifacts, release digest and GitHub Pages SHA. No tests were run.
- Scope: read-only GitHub source examination; audit Markdown only on isolated branch. No DevServer access, secrets, runtime, migrations, SQL, product workflow, deployment or third-party branches modified.

## Review gates and next work
1. Trace startup DDL and schema ownership to versioned migration/runbook and reconcile I09-01 without changing runtime here.
2. Trace account-scoped internal authentication, Nest/Inbox inbound callback and tenant binding, negative cross-tenant tests, event v1/v2 cutover.
3. Inspect Go test suites and CI SHA results, actual deployment inventory only with authorized read-only evidence.
4. Reconcile all 57 catalog units and newly discovered owners separately; do not mark divergence zero, review gates passed, or public Pages SHA confirmed without direct evidence.
