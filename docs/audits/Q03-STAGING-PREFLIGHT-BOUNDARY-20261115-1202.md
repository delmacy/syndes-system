# Q03 — staging preflight and disposable integration boundary (2026-11-15 12:02 BRT)

- GitHub authoritative baseline: main `1cf48cc0a1281017ac58f7b9b9747f663109e151`; dedicated audit branch `audit/q03-staging-preflight-boundary-20261115-1202`.
- Previous Q03 checkpoint: `audit/q03-integration-source-20261114-1600`, 1 ahead/0 behind main when compared. This is a follow-up, not a replacement.
- Catalog: Q03 Integração points to `scripts/events`; status is not promoted by source inspection.

## Public and private contracts

- `staging_preflight.py` provides CLI `--json` and `--strict`, reporting local HTTP preview, Control schema ledger and tenant schema inventory. It explicitly keeps `operational_activation_ready=False` and distinguishes preview/schema presence from deployment authorization.
- Private functions `expected_database`, `read_catalog`, `local_http`, `inventory` restrict tenant database derivation, fixed PostgreSQL catalog queries and preapproved localhost probes. SQL is wrapped in `BEGIN TRANSACTION READ ONLY` and `ROLLBACK`. The script invokes `docker exec` against a preselected container and is **operational read access**, not a purely static check.
- `test_staging_preflight.py` contains six unittest methods: tenant mapping, fixed read-only query, preview-vs-activation, missing backup/FGA gates, invalid migrations/mappings and external HTTP refusal. Assertions use mocked subprocess/catalog/probe, not real PostgreSQL or authorization services.
- `run_disposable_staging.sh` requires two explicit flags, checks preexisting names and ports, starts labeled disposable PostgreSQL 17 and OpenFGA containers, runs builds and Node integration tests, then requests cleanup. **It is not read-only**: Docker run/stop, `npm ci`, `npm run build`, `link-peers`, SQL fixture tests and writes to checkout artifacts are side effects. Do not execute on DevServer01 under the current audit policy.
- Script uses fixed local ports and names; source checks lower collision risk but cannot prove cleanup, isolation or safety in a real execution. Do not interpret its synthetic PASS string as operational homologation.

## Source ownership and evidence boundaries

- Q03 owns scripts/test harness behavior, not business HTTP APIs, classes, domain events or migrations. `staging_preflight.py` queries Control and tenant tables, including outbox/delivery/inbox and migration keys, owned by other modules; presence checks do not establish runtime producer/consumer correctness or applied migration checksum.
- The preflight queries registry tenant names and exposes aggregate statuses; source deliberately omits tenant IDs and database names from report. It does not verify backup restore, FGA, ENABLED enforcement, projector cutover, public TLS or release readiness.
- No test was executed in this audit. No CI run tied to this SHA, deployed state, real database inventory, restore, load test, review gate or public GitHub Pages SHA was verified.
- Potential documentation divergence: any classification of `run_disposable_staging.sh` as a safe read-only smoke test is inaccurate; verify topical Q03 runbook and reconcile in a separate reviewed documentation flow.

## Next gates

Inspect `test_disposable_restore_drill.py` and the two Node event integration tests in detail; compare assertions against events, migrations and tenant boundaries. Obtain immutable CI evidence per source SHA, reconcile Q03 docs and the independently discovered owner inventory, then review without merging another agent's branch. No runtime, migrations, SQL, secrets, CI/workflow edits or deployment authorized.
