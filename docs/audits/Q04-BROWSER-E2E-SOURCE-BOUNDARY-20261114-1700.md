# Q04 — Browser E2E: source and evidence boundary audit (2026-11-14 17:00 BRT)

- **Repository:** delmacy/syndes-system
- **Audited main SHA:** `1cf48cc0a1281017ac58f7b9b9747f663109e151` (GitHub compare against main: identical at start)
- **Owner:** Q04 Browser E2E; catalog path `tests/platform`, maturity `distributed`. Ownership is not execution, release or homologation evidence.
- **Method:** GitHub MCP file reads and compare; no runtime, credentials, SQL, migrations, CI modification, deployment or DevServer access.

## Source and contracts

1. `apps/master-admin-web/package.json` exposes `test:browser = node tests/browser-e2e.mjs`. Its source runs a Vite preview on loopback port 4179 and Playwright Chromium, with HTTP route fixtures for Keycloak OIDC and `/v1/platform/admin/**`. It asserts PKCE state/S256 and token code verifier, Bearer authorization header, operator denial (403), dashboard, tenant search/details and logout. The fixture explicitly states it is **not** proof of deployed Keycloak, Control DB or operational tenant data. A UI 403 fixture is not a backend authorization test.
2. `apps/workspace-web/package.json` exposes browser-related commands `test:smoke`, `test:ui-anon`, `test:inbox-ui`, `test:crm-ui`, `test:whatsapp-ui`, and `test:live-readiness`. `tests/anonymous-smoke.mjs` checks anonymous HTML 200, CRM/Inbox protected screens and absence of page errors; no authenticated tenant journey. `tests/browser-smoke.mjs` describes real HTTPS/OIDC/CRM/Inbox UI journey, requires an externally supplied preview password and was **not run**.
3. `apps/workspace-web/tests/live-readiness.mjs` is an operational read-only predeploy probe, **not browser E2E**: curl Host routing, runtime JSON, unauthenticated Inbox 401/403, Docker container state and OpenBao unsealed. Its code was read, not executed.
4. `apps/support-web/package.json` exposes `test:e2e = playwright test`; exact test files/config, assertions and environment wiring were **not** examined in this pass.
5. `tests/platform/README.md`, `tests/platform/package.json`, and `apps/support-web/playwright.config.ts` returned 404 for these exact paths. A 404 is not proof the suite or configuration is absent elsewhere.

## Boundary and evidence matrix

| Dimension | Evidence / limit |
| --- | --- |
| Public UI contracts | Login, anonymous guards, navigation, tenant list/detail and logout assertions inspected in selected scripts |
| Private contracts | Manager API and Keycloak responses are **mocked** in the inspected Manager browser script; no real server enforcement established |
| Classes/source | Selected JS runner source and frontend package scripts inspected; component implementations not exhaustively read |
| APIs | Manager `/v1/platform/admin/me`, `summary`, `tenants`, `tenants/:id` are fixture-intercepted, not real endpoint execution |
| Events | No Q04-owned event producer/consumer demonstrated; event delivery not tested by selected scripts |
| Schemas/migrations | No Q04-owned schema/migration; tenant data is fixture-only in Manager browser script |
| Security | Frontend forbidden-state assertion does not establish OpenFGA, tenant/org isolation or backend RBAC |
| Tests executed this audit | **None** |
| CI at audited SHA | **Not checked**; command presence is not test success |
| Deployed/homologated | **Not verified** |
| Public GitHub Pages SHA | **Not verified** |

## Findings and next review gates

- **Material evidence boundary:** do not conflate fixture-backed Manager E2E with live identity/database authorization. Track real integration suites separately.
- **Potential fragility to review:** Workspace live smoke embeds a default host and username and expects a locally supplied password; do not run it without explicit operational authorization. No secret was read.
- Inspect Support Playwright tests and all Workspace browser assertions, then cross-reference `.github/workflows/syndes-ci.yml` job selection and recorded GitHub Actions SHA; verify positive/negative tenant/org scenarios and screenshots/artifact provenance.
- Confirm the actual Q04 inventory under `tests/platform` versus distributed app-level suites; do not reclassify ownership without source mapping and tests.
- This checkpoint is **source-only, partial**. No claim of 57-unit reconciliation, zero global divergence, passed review gates, or published Pages SHA.
