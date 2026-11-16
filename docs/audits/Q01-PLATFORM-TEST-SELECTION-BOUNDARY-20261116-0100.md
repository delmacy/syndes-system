# Q01 — Test platform selection boundary (2026-11-16 01:00 BRT)

Baseline: main `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Owner: Q01, `tests`, catalog `catalog/work-units.json` (57 units; ownership/maturity is not acceptance).

## Static evidence and boundary
- Public engineering contract: `AGENTS.md` requires relevant automated tests green, tenant isolation, security and release gates. It explicitly distinguishes IMPLEMENTED, INTEGRATED, TESTED, PROVEN and DONE.
- Internal selection contract: `scripts/ci/plan.mjs` declares 15 suites and a `noop` fallback. Changes under `tests/platform/`, `tests/integrity/`, `scripts/ci/`, or `.github/` select **all available** suites. Documentation-only changes select no impacted suite and emit `noop`; the source comment says governance runs separately.
- Q01-BOUNDARY-01: neither `tests/platform` nor `tests/integrity` has its own entry in the 15-suite planner catalog. Selecting all available package suites does **not by itself** prove the platform/integrity test files execute. The workflow consuming this matrix and separate governance job must be inspected before claiming coverage. This is a proof gap, not a confirmed CI omission.
- Q01-BOUNDARY-02: `installedSuites()` filters by marker existence; full/impact selects only installed suites. Thus the static matrix cannot establish that every expected suite was installed or executed in a particular GitHub Actions run.
- No owner-specific business API, domain events, or database migration were identified in these examined Q01 contracts. This is not a repository-wide absence claim.

## Not performed / unresolved
No tests, builds, migrations, SQL, workflows, deployment, or DevServer access. No evidence of green CI on this baseline, real auth/tenant gates, operational acceptance, or published GitHub Pages SHA was established. No product code or other branch modified. Review the workflow and test entrypoints next; reconcile against commit-specific check results before asserting coverage or DONE.
