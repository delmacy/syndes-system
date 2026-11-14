# I09 — Whatsmeow runtime: source/contract audit checkpoint

Date: 2026-11-14 07:00 America/Sao_Paulo. Canonical GitHub main baseline: `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`.
Owner: I09 (catalog/work-units.json), path `modules/whatsapp/gateway`, documentation parent P03. Catalog maturity `verified` is **not** acceptance or deployment proof.

## Directly inspected via GitHub MCP
- `catalog/work-units.json`, `catalog/README.md`, `modules/README.md`, repository `README.md`.
- `modules/whatsapp/AGENTS.md`, `modules/whatsapp/README.md`, `modules/whatsapp/package.json`, `modules/whatsapp/src/accounts.ts`.
- `docs/engineering/WA-DATA-01-CRM-WA-01-20261111.md`.

## Public versus private contracts / ownership
- Public TS package exports accounts, contracts, plugin, CRM link planner, event bridge, route commands, identity reader; **exports are declarations**, not proof of runtime integration.
- Go/whatsmeow owns protocol/session/send/inbound buffering; WhatsApp TS owns accounts, normalized contracts, durable outbound/rate limit; CRM owns identity; Inbox owns conversations; Core Host owns authenticated tenant and authorization.
- Contract demands 40 outgoing messages/minute/account, prioritized queue, retries, deduplication, isolation, no direct provider bypass, D+31 gateway suspension. No live enforcement independently established in this audit.
- `WhatsAppAccounts` source implements list/get/create/setEnabled/requireEnabled, UUID checks, tenant-scoped SQL, optional organization filter, and rejects partial owner context. **Risk boundary:** tenant-only access remains possible when `SYNDES_MULTI_ORG_ENABLED` is not true; authorization must be supplied by trusted caller, not inferred from this repository class.
- README documents account-scoped Go routes, HMAC account tokens, enqueue-before-send, PostgreSQL rate reservation and uncertain-send reconciliation as **source claims**, while explicitly retaining outstanding multi-instance leases, backend provisioning, callback integration and real acceptance. Do not promote those claims to independently verified Go source findings.
- README explicitly reports a former callback `POST /api/v1/internal/whatsapp/events/{tenantId}` absent from its then-checked consumers, and later describes a versioned callback envelope. The present end-to-end callback registration and routing remain unverified.
- AGENTS documents opt-in `whatsapp.message.received.v2` event bridge, legacy Nest ingress, and single-projector cutover guard. Event publication and current production switch were not verified.
- README mentions Go SQL migration `syndes_whatsapp_accounts`; module AGENTS references migration 008 projection path and organizations migration 004 owner guard. Their actual SQL and application state were **not** examined in this slice.
- 2026-11-11 WA-DATA document reports read-only operational aggregates and in-memory coverage counters; historical evidence only, not current production proof.

## Physical inspection limits
- `modules/whatsapp/gateway/go.mod`, `gateway/README.md`, `gateway/main.go`, `gateway/cmd/gateway/main.go`, and `gateway/AGENTS.md` returned 404 at this SHA. This does **not** prove Go source absence; recursive tree listing was not available in this connector path. The exact Go source classes/functions, HTTP handlers, migrations, and test inventory are therefore not yet audited.
- No tests executed; no CI result tied to this SHA checked; no SQL, migrations, runtime, deployment, DevServer, secrets or workflows touched.
- Historical test-pass statements in README were not rerun and are not treated as current passing tests.
- No claim of operational deployment, homologation, zero divergence, full 57-unit reconciliation or GitHub Pages publication.

## Required follow-up
1. Locate actual Go gateway source paths via authoritative GitHub tree/index; inspect handlers, session registry, auth, queue worker, events, migrations and test files.
2. Compare public TS and private Go route/callback envelopes; verify owner binding and account token rejection on negative paths.
3. Audit SQL migration ordering, duplicate ingress/projector prevention, rate reservation, crash recovery and multi-instance lease behavior without executing SQL.
4. Inspect test files and CI evidence per SHA; document missing negative tests and reconcile P03/I09 documentation in a separately reviewed docs PR.
