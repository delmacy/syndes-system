# Q04 — Support browser E2E: real-service contract and evidence boundary (2026-11-16 03:00 BRT)

- Repository: `delmacy/syndes-system`; source baseline `main@1cf48cc0a1281017ac58f7b9b9747f663109e151`, confirmed identical against main immediately before audit branch creation.
- Dedicated branch: `audit/q04-support-real-browser-contract-20261116-0300`; owner Q04, catalog path `tests/platform`, maturity `distributed` (ownership metadata, not acceptance evidence).
- Prior Q04 checkpoint: `audit/q04-browser-e2e-boundaries-20261114-1700`; this follow-up fills its expressly uninspected Support browser suite. Existing Q03/Q04 branches remain untouched.

## Public versus private contracts and source mapping

- Public `docs/engineering/TEST-STRATEGY.md` demands PR integration, isolation, authorization and contract checks; `apps/support-web/package.json` declares `test:e2e = playwright test`. Neither declaration proves an executed pass.
- Private `apps/support-web/playwright.config.mjs` selects `e2e/*.spec.mjs`, one worker, local frontend `127.0.0.1:4179`, screenshots/traces on failure and JUnit output. `apps/support-web/vite.config.ts` explicitly sets port 4179 and proxies `/v1/tenants` to `127.0.0.1:4180`; there is no default-port mismatch.
- Source `apps/support-web/e2e/support.spec.mjs` asserts anonymous API 401, rejection of a real Keycloak-signed wrong-client JWT (401), requester/agent/outsider access differences, ticket creation, queue updates, private note exclusion on requester reload, WhatsApp-linked external case, and delayed GET/POST response audience-switch isolation. Its explicit route interceptions are delay/reorder controls around `route.fetch()` real HTTP responses, not replacement fixtures.
- `.github/workflows/support-browser-e2e.yml` declares disposable PostgreSQL 16, Keycloak 26.8.1 HTTPS, OpenFGA 1.22.1 memory store, Core Host support E2E backend on 4180, Vite UI on 4179 and Playwright Chromium. This is a *real disposable service integration design*, not a claim of green CI, production identity, durable FGA store or production tenant authorization.
- `.github/workflows/syndes-ci.yml` invokes the reusable Support workflow only if the impact matrix contains `support` or `support-web`. `scripts/ci/plan.mjs` selects these on Support changes and full regression; its marker filtering and `noop` path mean the gate declaration is not a record of actual execution. `scripts/ci/run-suite.sh` runs Support Web's Node tests/build separately from this browser parity workflow.

## Q04-SUPPORT-01 — important correction to evidence classification

Support browser tests **are not fixture-only UI tests**: source and workflow declare real, isolated Keycloak, HTTP backend, PostgreSQL and OpenFGA interactions, including authorization negatives and out-of-order responses. They must not be conflated with the mocked Manager browser fixture documented in the previous Q04 checkpoint. Equally, source presence alone does not prove this workflow ran successfully at the audited SHA.

## Q04-SUPPORT-02 — remaining evidence boundary

The Support browser test is one specific disposable tenant, with explicit role/queue scenarios and a wrong-client check. It does not by itself establish general multi-tenant isolation, every API endpoint, migrations applied in an operational database, production deployment, recovery, or homologation. Keycloak/OpenFGA versions and ephemeral stores are workflow declarations, not runtime observations. No Q04-owned business event producer, schema or migration was identified in the examined files; the Support/Inbox backend owns those contracts, which were not exhaustively audited here.

## Tests and operational boundaries

No test, build, SQL, migration, Docker, workflow, deployment or DevServer command was executed. No credentials or secrets were read. GitHub Actions run/check conclusions for this exact SHA were not established; no public Pages publication SHA or global review-gate proof. No changes to main or other agents' branches. This documentation-only checkpoint is pending independent review; do not merge without documentation gates and concurrency recheck.

Next: compare actual GitHub Actions checks and artifacts against immutable source SHA; enumerate remaining Workspace/Manager browser assertions and independent API/security checks; continue Q04/Q05 and 57-unit reconciliation without treating catalog maturity as deployed state.
