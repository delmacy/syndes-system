# Q03 — Restore guard assertions and integration boundary (2026-11-15 13:02 BRT)

Baseline: GitHub main `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Dedicated branch: `audit/q03-restore-guards-followup-20261115-1302`. Follow-up to Q03 staging preflight checkpoint; source review only.

## Contracts and code examined
- `scripts/events/test_disposable_restore_drill.py` contains **seven** unittest methods. It imports `disposable_restore_drill.py`, mocks its `run` function for dump/restore command checks, and uses a temporary local file for checksum and permissions assertions. It does not run Docker or PostgreSQL.
- Public CLI contract of `disposable_restore_drill.py`: both `--disposable` and `--ack-synthetic` are mandatory; optional `--json`. Report explicitly sets `production_backup_verified=false`, `production_restore_approved=false`, `operational_ddl_executed=false`.
- Private boundaries: `safe_database`, `sql_file`, `Postgres.command/sql/dump/restore`, `verified_archive`, `seed_control`, `seed_tenant`, `restore_drill`. Fixed allowlisted Control/tenant SQL paths; random isolated Docker container name; PG17; no published ports, network none; pg_dump custom archive SHA-256 and mode 0600; restore single transaction.
- Data/event scope: Control tenant module audit and `control_events.outbox_events`; tenant `platform_events.outbox_events`, deliveries, consumer inbox; synthetic `crm.person.created.v1` and `whatsapp.message.received.v2`. Cross-owner SQL migrations are **fixtures**, not Q03-owned schema or evidence of their operational application.
- Restore checks compare source/restored ledger facts, verify restored Control transition trigger and runtime role SELECT denial, then simulate idempotent replay twice. This tests a synthetic fixture, not a real consumer, real authorization service, or operational backup recovery.
- No HTTP API, business class, or domain event producer owned by the Q03 test harness identified in these inspected files.

## Coverage gaps / audit findings
- **Q03-05:** Seven guard methods do not exercise the full restore lifecycle or Docker cleanup failure paths; tests assert command construction and synthetic fixture fields, not live behavior. The executable drill has side effects (Docker container lifecycle, CREATE DATABASE, SQL writes, pg_dump/pg_restore) and must **not** be run under read-only audit policy.
- **Q03-06:** The `finally` cleanup invokes `docker stop` with `check=False` and does not validate success. A successful synthetic report does not independently attest cleanup; operational inspection is required before claiming no residual container.
- **Q03-07:** `CONTROL` and `TENANT` migration file lists are hardcoded; no independent current migration discovery or checksum comparison is performed. New migrations can be omitted from the drill while it still reports synthetic PASS.
- **Q03-08:** The fixture creates event ledger records and simulates inbox replay directly through SQL; it does not verify HTTP/API producers, actual event dispatch, real consumers, cross-tenant denial or deployed event processing.

## Evidence / constraints
Source existence and seven assertions confirmed on main SHA above. **Tests run: none.** No DevServer access, Docker, SQL, build, migration, CI/workflow edit, secrets, deployment, branch merge or operational verification. CI per SHA, review gates, deployment/homologation and public GitHub Pages SHA remain **unverified**. Existing Q03 documentation must reconcile these boundaries without promoting test existence to test success.

Next: locate and inspect Node event integration tests and compare assertions against migrations and public/private event contracts; independently reconcile catalog owners and SHA-specific CI. Do not overwrite other audit or documentation branches.
