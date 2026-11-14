# Q03 — Integration source/contract boundary audit (2026-11-14 16:00 BRT)

- **Authoritative source:** GitHub `delmacy/syndes-system`, main `1cf48cc0a1281017ac58f7b9b9747f663109e151` (verified by compare against main before this checkpoint).
- **Audit branch:** `audit/q03-integration-source-20261114-1600`, created from the exact main SHA. This document is an isolated checkpoint, not an acceptance, merge or deployment.
- **Catalog owner:** Q03 Integração, source `scripts/events`, per `docs/subprojects/Q03-integracao/README.md`.
- **Baseline:** Q03 STATUS says “SEM AUDITORIA FUNCIONAL”; reference is explicitly an unaudited inventory. Do not promote status on this checkpoint.

## Verified source and boundaries

1. `scripts/events/disposable_restore_drill.py` is a Python command-line synthetic PostgreSQL 17 restore exercise, not a Q03 HTTP API, Node package, frontend or production backup service. Its header explicitly disclaims operational DB access and production-gate status.
2. It defines a closed list of Control schema files and Tenant SQL migrations belonging to Control, Organizations, CRM, Inbox, WhatsApp and Core Host. **Q03 does not own those schemas/migrations** and their presence in the script is not evidence they were applied to any live DB.
3. `safe_database` enforces a restricted database-name regex; `Postgres.command` checks a disposable container prefix; `sql_file` accepts only allowlisted migration paths and rejects repository escape; `run` enforces subprocess timeouts and suppresses raw SQL stderr in errors.
4. `Postgres.dump` checks PGDMP archive signature and minimum length; `Postgres.restore` uses `pg_restore --single-transaction --exit-on-error --no-owner --no-acl`. These are source-level checks, not an observed successful restore.
5. `seed_control` creates synthetic roles, loads allowlisted Control schemas, writes synthetic entitlement transition and asserts one audit/outbox/trigger/FK result. `seed_tenant` loads Tenant migrations and creates synthetic organization/workspace/CRM/WhatsApp/Inbox fixtures. Event tables and payloads are fixtures of their owning domains, **not a Q03 event publisher contract**.
6. `apps/core-host/package.json`, `modules/core-crm/package.json` and `modules/inbox/package.json` expose distinct Node test scripts. These cannot be counted as Q03 integration tests without assertions and execution evidence.

## Contract reconciliation and open questions

- **Public boundary:** CLI script and its documented safety preconditions; no Q03 package exports or HTTP routes demonstrated in inspected files.
- **Private boundary:** Python `DrillError`, `Postgres`, subprocess runner, SQL fixtures and allowlisted migration paths. These are implementation internals, not public module APIs.
- **Events:** synthetic Control and Tenant outbox/delivery/consumer-inbox facts; actual runtime producers, consumers, version compatibility and delivery guarantees not established.
- **Data:** synthetic Control and Tenant migrations are imported from other owners; operational schema state, migration version, grants and isolation remain unverified.
- **Tests:** **none executed** in this audit. No Q03 assertions suite fully inspected, no CI run tied to this main SHA, no DevServer read or execution, no load/E2E/rollback or production restore verification.
- **Operation:** no deployment, homologation, RPO/RTO, retention, encryption or real database restore established.
- **Documentation:** Q03 STATUS/reference remain baseline. This checkpoint identifies actual source and constraints but does not assert global divergence-free reconciliation or a published GitHub Pages SHA.

## Next audit gates

Inspect remaining `scripts/events` files and test assertions; verify negative cases (unexpected DB/container/path, tampered archive, failed restore, tenant/org isolation and event consistency); correlate test runs with exact source SHA; reconcile Q03 topical reference, STATUS and operation docs only after review. Check newest main/branch and concurrent documentation branches before any integration. Do not execute Docker, SQL, migrations, workflows or production actions as part of this checkpoint.
