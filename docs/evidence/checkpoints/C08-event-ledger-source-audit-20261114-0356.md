# C08 — Audit e observabilidade: source checkpoint (2026-11-14 03:56 BRT)

## Source baseline and boundary
- GitHub main inspected at `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`; dedicated branch `audit/c08-event-ledger-source-20261114-0356`.
- Owner catalog documentation points C08 to `apps/core-host`. This checkpoint audits the **tenant-local platform event ledger subset**, not the entirety of observability or all 57 catalog units.
- Existing `docs/subprojects/C08-audit-e-observabilidade/REFERENCIA-TECNICA.md` says backend classes and public contracts remain to be audited. That is a **documentation inventory gap**, not proof of absent source.

## Source classes and contracts verified
- `apps/core-host/src/platform-event-publisher.ts`: `TenantEventPublisher.publish(tx,event)` requires a pinned tenant transaction, validates the event, rejects tenant mismatch and event-type/version mismatch; inserts to `platform_events.outbox_events`. A reused producer/idempotency key is accepted only if prior event facts match, otherwise throws collision.
- `apps/core-host/src/platform-event-dispatcher.ts`: `TenantEventDispatcher` registers explicit consumer subscriptions, validates names/types, routes pending outbox rows with `FOR UPDATE SKIP LOCKED`, retains unsupported records, and uses tenant-scoped delivery states, lease and retry limits. `EventWorkerAuthorization` is a host-provided service-identity authorization port, not a user JWT.
- `apps/core-host/src/platform-event-worker-admission.ts`: `PgEventWorkerScope` checks active organization/workspace using tenant-pinned DB; `TenantEventWorkerAdmission` requires module access, scope and trusted service grant, with suspended-on-outage behavior.
- Core-kernel imports are **external public dependencies** for this owner. Export/compatibility of each import was not exhaustively traced in this checkpoint. No HTTP API or frontend screen is established by these classes alone.

## Schemas and migration evidence
- `apps/core-host/sql/001_platform_events.sql` declares tenant-local `platform_events.outbox_events`, `event_deliveries`, `consumer_inbox`, indexes, uniqueness and organization/workspace FKs. Explicitly excludes Control Plane.
- `apps/core-host/sql/002_event_type_version_consistency.sql` declares a type/version CHECK with NOT VALID then VALIDATE; preexisting mismatches may block validation.
- File existence **does not prove applied migrations** or successful rollback/restore.

## Tests and missing evidence
- Test files located: `platform-event-publisher.test.mjs`, `platform-dispatcher-pg17.test.mjs`, `platform-event-worker-admission.test.mjs`, `platform-event-worker-admission-pg17.test.mjs`, `platform-events-pg17.test.mjs` and other platform-events variants. Test assertions and run results were **not** exhaustively audited.
- **Tests executed: none.** No DevServer access, SQL, migrations, deployment, secrets, workflows or other branches changed.
- No CI success, runtime composition, deployed state, homologation, public GitHub Pages SHA or all-unit reconciliation established.

## Follow-up review gates
1. Trace `@syndes/core-kernel` exported event types, validators, ports and versioned contracts; inspect worker batch/composition, HTTP exposure and actual consumers.
2. Inspect test assertions and SHA-matched GitHub Actions evidence without running production workflows.
3. Reconcile C08 technical reference and topical chapters through the documentation-review process, respecting concurrent branches and main changes; preserve this checkpoint as audit-only.
4. Continue catalog owner-by-owner. Do not claim meaningful divergences zero or publication before evidence.
