# Q07 — Deletion-only CI impact coverage follow-up (2026-11-16 04:01 BRT)

## Baseline and ownership
- GitHub main inspected at `1cf48cc0a1281017ac58f7b9b9747f663109e151`; Q07 owner is `scripts/ci/plan.mjs` (catalog maturity `code`, not deployment or acceptance).
- Existing Q07 checkpoint `audit/q07-ci-source-20261114-1956` already records omission of deleted paths; this follow-up inspects whether the current planner tests cover that exact negative case. It does not claim a new vulnerability.
- Read-only GitHub sources: `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs`, `scripts/ci/plan.test.mjs`, `AGENTS.md`, `catalog/work-units.json`.

## Public and private contracts
- Workflow PR impact uses `git diff --name-only --diff-filter=ACMRT "$PR_BASE" "$PR_HEAD"`; the D (deleted) change class is excluded before the planner receives paths.
- `selectSuites(changedPaths, available, mode)` maps changed paths to 15 catalog suites; `installedSuites()` filters by filesystem markers; `full` selects all available suites. Empty impact becomes `noop`; governance remains a separate foundation job.
- `scripts/ci/plan.test.mjs` asserts mapping for kernel, tenancy, core-host, service-management, WhatsApp, Support, Manager, account, unknown paths, documentation-only and full mode. No test in this examined file simulates the workflow's deletion-only diff filtering.
- The workflow foundation runs `node --test scripts/ci/*.test.mjs` and repository structure checks. Those checks do not independently prove deleted test files trigger their affected suite.

## Finding and evidence boundary
- **Q07-DEL-02 (follow-up to Q07-01):** deletion-only changes to a recognized module can be omitted from the PR impact matrix at the workflow boundary. Even if `selectSuites(['modules/inbox/test/some.test.mjs'])` would select Inbox-related suites, the workflow never passes that path if it was deleted. A regression test that calls `selectSuites` directly cannot establish end-to-end deletion coverage. Add a workflow-level fixture covering a deletion-only PR and assert required suites are selected before considering this gap closed; no workflow changes made.
- Q07 owns CI orchestration, not business APIs, domain events, domain classes or SQL migrations. These remain with the relevant modules; no runtime schema ownership is inferred.
- No isolated tests were run, no GitHub Actions status or downstream parity execution was verified for this SHA, and no DevServer, SQL, migrations, secrets, deployments or workflows were modified.
- Source exists: **yes** for inspected CI files. Test pass at inspected SHA: **not verified**. Operational deployment/homologation: **not verified**. Review gate, global 57-unit reconciliation, material divergence zero and public GitHub Pages SHA: **not verified**.
- Documentation checkpoint only, intentionally isolated on a dedicated branch. Re-check main and branch before any integration; do not overwrite concurrent changes.
