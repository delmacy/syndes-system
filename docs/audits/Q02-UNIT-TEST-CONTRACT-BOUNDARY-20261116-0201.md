# Q02 — Unit-test contract boundary (2026-11-16 02:01 BRT)

Source baseline: main `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Audit branch: `audit/q02-unit-test-contract-boundary-20261116-0201`. Owner: Q02 (distributed under `modules`), catalog schema v1, ownership catalog is not deployment evidence.

## Inspected contracts and source
- `AGENTS.md` defines DONE as implemented + integrated + tested + proven, with tenant isolation, server-side authorization and CI green.
- `modules/core-crm/package.json`, `modules/inbox/package.json`, `modules/whatsapp/package.json`, `modules/service-management/package.json`, `modules/organizations/package.json`, `modules/support/package.json`: `npm test` invokes `npm run build && node --test test/*.test.mjs`. Thus tests are **not read-only commands**: TypeScript build writes `dist` locally. No test was run in this audit.
- `modules/inbox/package.json` additionally declares `test:ui = node --test test/frontend.test.mjs`, but the default `test` glob includes this test file as well (assuming the file exists, verified below). Do not claim it is excluded.
- `modules/inbox/test/frontend.test.mjs` uses a minimal synthetic DOM, `node:vm`, mocked fetch, fake token and tenant fixtures. Its UI assertions are not real-browser E2E, OIDC, OpenFGA or PostgreSQL tenant-isolation proof.
- `modules/core-crm/README.md` explicitly leaves product/security release gates open and distinguishes HTTP context guard from direct repository/WhatsApp calls. `modules/service-management/README.md` explicitly states the plugin/API are code-only, absent from operational Core Host config, with operator-gated SQL 001–003 and no published grants/migrations.
- `scripts/ci/plan.mjs` lists module suite selectors and marker-based availability. Matrix selection is not execution or green CI evidence.

## Finding Q02-BOUNDARY-01
The default package unit-test entrypoint for six inspected modules builds before running tests. Consequently a purported read-only verification command can modify generated local artifacts; do not run it on operational DevServer or infer read-only safety from `node --test` alone. Isolated checkout/build environment required for any future execution.

## Finding Q02-BOUNDARY-02
The Inbox frontend suite is a simulated DOM/API contract test, not browser/identity/tenant database homologation. A green result would establish only the mocked contract. No green result was observed in this checkpoint.

## Coverage and boundaries
Public contract: global AGENTS, module README and package scripts. Private implementation: Inbox test harness, CI suite planner. APIs: README declarations only, not a controller-by-controller verification. Events: not inspected. Schemas/migrations: CRM README 001–003 and Service README 001–003 are declarations, not DDL or applied state. Source classes: not exhaustively inspected. No claim of complete Q02 suite inventory, test success, integration, deployment or homologation. No secrets, SQL, migrations, runtime, builds, CI/workflows, deployments or DevServer actions. No other branch modified.

## Next audit
Expand Q02 into exact per-module test-file inventory and implementation mapping; compare GitHub Actions checks to immutable SHA, then Q03 integration. Do not merge this checkpoint without separate review and documentation gate.
