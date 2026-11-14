# Q06 — Performance: source and contract boundary audit (2026-11-14 19:00 BRT)

## Provenance
- Repository: delmacy/syndes-system; authoritative GitHub MCP.
- Baseline main SHA: `1cf48cc0a1281017ac58f7b9b9747f663109e151`.
- Catalog: `catalog/work-units.json` lists Q06 Performance, owner path `tests/performance`, maturity `contract`; catalog maturity is not deployment/acceptance status.
- Dedicated branch: `audit/q06-performance-source-20261114-1900`. Do not merge without review.

## Source and contract comparison
- `tests/performance/AGENTS.md` is the verified normative contract: isolated environment; stages 50/200/500/1000/2500 tenants; baseline, degradation, bottleneck, breaking point and recovery; spike; initial 2-hour soak; MockWhatsAppProvider/MockAIProvider for mass load; real providers separately and at reduced scale; p50/p95/p99, CPU/RAM, database connections/query time, queue depth/age, WebSockets, AI latency, lost/duplicate messages and recovery time; security and integrity preserved under stress.
- GitHub contents lookups of `tests/performance/README.md`, `tests/performance/STATUS.md`, and `tests/performance/package.json` returned 404 at main. This is **not** an exhaustive tree inspection: other scripts or tests elsewhere may exist.
- `scripts/ci/plan.mjs` enumerates 15 CI suites and **no separately named performance suite**. Its `full` mode selects those suites; it does not itself establish load-test execution. `docs/engineering/MAINLINE-CI-POLICY.md` explicitly assigns heavy performance to an isolated release gate.
- Public contract: performance criteria in AGENTS; no verified Q06 HTTP API, published SDK, or event contract. Private contract: runner/fixtures/load generators and thresholds are not evidenced by inspected files. Do not infer absence globally.
- Source classes/functions: `selectSuites` in CI planner is owned by Q07, not a Q06 load runner. No Q06 source class inspected.
- APIs/events: Q06 measures consumers and producers, but owns no verified API or event schema in this inspection.
- Schemas/migrations: no Q06-owned database schema/migration established; target modules own their data models.
- Tests: **none run**. No p95/p99, throughput, error budget, isolation, spike/soak or recovery result was measured. No CI run tied to this checkpoint SHA was verified.
- Deployment/homologation: **not established**; no DevServer access, no SQL, no credentials, no runtime, no CI/workflow edits.

## Material gaps and next gates
1. Inventory actual `tests/performance` tree and cross-repository load generators; distinguish missing runner from unexamined runner.
2. Define reproducible isolated dataset, environment limits, tenant/org isolation assertions and negative cases before any stress execution.
3. Trace per-stage capacity, p50/p95/p99, errors, duplicate/lost events, DB/queue/WS metrics, recovery and 2-hour soak to a source SHA and artifacts.
4. Review release-gate criteria with Q07/Q08; do not promote Q06 `contract` to tested or homologated without execution evidence.
5. Reconcile all 57 catalog owners and any newly discovered owners separately. Global zero divergences, review gates and public GitHub Pages deployed SHA are **not confirmed**.

## Concurrent-writer boundary
Read-only inspection of main and existing documentation; one new Markdown checkpoint only on own audit branch. No changes to other branches or integrated main. No claims of successful test execution or operational reality.
