# P14 Platform Core — source/contract audit checkpoint (2026-11-14 02:58 BRT)

- Repository: delmacy/syndes-system
- Audited immutable main SHA: `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`.
- Owner: P14, `modules/platform-core`; catalog maturity `contract`. P14 follows the previously checkpointed P13 owner. This is an incremental checkpoint, **not** a reconciliation of all 57 owners.
- Scope and boundaries: GitHub MCP source-only inspection. No DevServer, runtime, SQL/migrations, credentials, CI/workflow modifications, deployment or third-party branches. No tests executed; no claim of CI success or operational homologation.

## Public contract versus physical source

`modules/platform-core/AGENTS.md` specifies Identity, Tenancy, Authorization, Resource Registry, Module Registry, Entitlements, Audit, Events, Provisioning and Configuration. Invariants include server-side tenant resolution, per-tenant databases, separate Control Plane, no implicit platform-admin business-data access, protected secrets, idempotent provisioning and centrally authoritative entitlements. Minimum tests listed: tenant resolution, authorization, cross-tenant denial, provisioning idempotency, entitlement transitions, audit events and Control Plane migrations. These are contractual requirements, not proven acceptance.

`modules/platform-core/README.md` and `modules/platform-core/package.json` returned 404 at the audited SHA; do **not** infer that cross-cutting implementation is absent. `modules/README.md` labels P14 a transversal contract, consistent with catalog maturity.

## Implementation ownership discovered outside P14 directory

- `apps/core-host/src/module-installer.ts` contains `PgModuleInstaller`, trusted release/migration/attestation types, SHA-256 migration verification, manifest validation, tenant database identity checks, dependency/entitlement gates and ledger comparison. Comments explicitly state operator-only use, not wired to Nest/HTTP or runtime tenant provider. Source existence does not prove execution, complete provisioning or approval.
- `apps/core-host/src/platform-event-dispatcher.ts` contains `TenantEventDispatcher`, `EventSubscription`, trusted service identity, tenant transaction provider, authorization admission, outbox routing with `FOR UPDATE SKIP LOCKED`, claim/lease/retry/suspension handling and transactional consumer inbox/ack. It is a candidate engine, not evidence of a deployed scheduler or live event consumption.
- `modules/platform-core/AGENTS.md` explicitly attributes typed event contracts to `packages/core-kernel/src/platform-events.ts`, tenant persistence/publisher to Core Host, and Control Plane events/migration 006 to separate Control DB. These references are **not independently inspected in this checkpoint**.

## Contract, API, event, schema, test and evidence matrix

| Dimension | Evidence | Boundary |
|---|---|---|
| Public functional contract | P14 AGENTS and module index | Requirements only |
| Private source/classes | Installer and dispatcher files inspected | Partial; remaining cross-cutting owners not inventoried |
| HTTP APIs | No P14-owned HTTP API verified | Do not infer absence globally |
| Events | Dispatcher source inspected | Publisher, event type definitions, subscribers and worker admission require follow-up |
| Schemas/migrations | Installer ledger references and P14 AGENTS references to platform_events 001/002 and Control Plane 006 | Migration files and migration tests not inspected or executed |
| Tests | Minimum cases specified in AGENTS | No test files verified; zero tests run |
| Integration | Main source present | CI status not checked; not accepted |
| Deployment/homologation | No operational evidence collected | Unknown, not approved |
| Public GitHub Pages | No deployed SHA verification | Pending |

## Next audit steps

1. Inventory `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts`, `apps/core-host/src/platform-event-publisher.ts`, `tenant-database.ts`, `platform-event-worker-batch.ts`, and their tests.
2. Inspect actual migrations and compare with P14 AGENTS claims without executing SQL.
3. Trace installer/dispatcher consumers and admission controls, locate SHA-specific test evidence, and reconcile topical docs through review gates.
4. Recheck latest main/branch SHA and compare before any follow-on mutation; do not merge this checkpoint automatically.

This checkpoint preserves uncertainty: source present != tests passing != deployed/homologated.
