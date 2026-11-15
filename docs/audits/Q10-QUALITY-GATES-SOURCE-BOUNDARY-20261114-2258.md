# Q10 — Quality Gates: source and contract boundary audit

- Audit date: 2026-11-14 (America/Sao_Paulo)
- Repository: `delmacy/syndes-system`
- Inspected integrated main: `1cf48cc0a1281017ac58f7b9b9747f663109e151`
- Owner: `Q10` in `catalog/work-units.json`, `tests/integrity`, maturity `code` (catalog maturity is not deployment or acceptance).
- Scope: static GitHub MCP source reads only. No DevServer access, CI execution, migrations, SQL, secrets, deployment, runtime, workflow or product changes.

## Public and private boundaries

The public Q10 contract is repository structure and governance integrity: `tests/integrity/AGENTS.md` describes fast checks on every push/PR, explicitly not a substitute for lint/typecheck/unit/integration. `tests/AGENTS.md` defines cross-tenant, authorization, record-integrity and silent-loss release invariants; Q10 does not itself prove them.

The internal entry point `tests/integrity/repository-structure.sh` runs with `set -euo pipefail`, requires 19 nonempty files, checks that each `modules/*/` directory has a nonempty `AGENTS.md`, then delegates catalog validation to `scripts/architecture/check-work-units.mjs` (implementation of this delegate not examined in this checkpoint). `.github/workflows/syndes-ci.yml` invokes that script in `foundation`, also requires at least 11 module contracts, runs `node --test scripts/ci/*.test.mjs`, and checks shell syntax. `gate` requires foundation, impact and regression success, plus selected Support and Platform Manager parity success; unselected parity must be skipped.

`scripts/ci/plan.mjs` defines 15 potential suite entries, filters to installed markers, routes `tests/integrity/` and CI changes to full regression, and emits a `noop` matrix entry when nothing buildable is impacted. `scripts/ci/plan.test.mjs` tests selection logic, including unknown paths, full mode and docs-only. `scripts/ci/run-suite.sh` dispatches suite-specific commands, including disposable DB and browser work; **none were run in this audit**.

Q10 does not expose a domain HTTP API, domain service class, published domain event, or owned SQL migration in the inspected owner files. Its executable contracts are shell exit statuses, Node planner inputs/outputs, workflow job dependencies and GitHub check conclusions. Other owners' APIs/events/migrations are dependencies of broader release gates, not Q10-owned features.

## Material divergences and limits

1. **Q10-01 / confirmed source-level regression-selection gap:** `.github/workflows/syndes-ci.yml` computes PR paths using `git diff --name-only --diff-filter=ACMRT`; deleted paths are excluded. A deletion-only PR can therefore bypass the intended impacted-suite selection, despite the `foundation` structure checks protecting a subset of required files. The planner's unit tests exercise paths, not the workflow's deletion filtering. Inherited from Q07; do not count as a newly fixed issue.
2. **Q10-02 / policy versus enforcement:** `docs/engineering/MAINLINE-CI-POLICY.md` explicitly says administrative branch protection is disabled by owner decision. The `Syndes CI Gate` YAML can fail a workflow, but is not an administrative GitHub merge barrier. This is a declared governance risk, not a claim that protection should be enabled without authorization.
3. **Q10-03 / coverage boundary:** existence of 15 suite definitions and a success gate does not prove individual assertions, actual run results at the audited SHA, performance capacity, security isolation in deployment, or operational acceptance. No current-SHA workflow results or Pages publication SHA were verified.
4. **Q10-04 / incomplete owner inspection:** `scripts/architecture/check-work-units.mjs` and individual `scripts/ci/*.test.mjs` beyond `plan.test.mjs` were not reviewed. No repository-wide exhaustive inventory or newly discovered owner reconciliation was completed.

## Evidence read at main SHA

- `catalog/work-units.json` (57 catalog units; Q10 ownership)
- `tests/integrity/AGENTS.md`; `tests/integrity/repository-structure.sh`; `tests/AGENTS.md`
- `.github/workflows/syndes-ci.yml`; `scripts/ci/plan.mjs`; `scripts/ci/plan.test.mjs`; `scripts/ci/run-suite.sh`
- `docs/engineering/TEST-STRATEGY.md`; `docs/engineering/MAINLINE-CI-POLICY.md`; `README.md`

## Status and next review gate

Source existence: confirmed for inspected files. Static boundary reasoning: partial. Test success at current SHA: **not checked**. Deployed/homologated: **not checked**. GitHub Pages public SHA: **not checked**. Tests run: **none**. Meaningful divergences zero: **false** (Q10-01 and policy/enforcement boundary remain open). No merge authorized from this checkpoint.

Next: inspect delegated architecture checker and remaining CI assertions, audit G01 Architecture (next catalog owner), correlate check runs by exact SHA, and reconcile all 57 catalog units plus newly discovered owners before final gates. This branch contains documentation only and is not a claim of completion.
