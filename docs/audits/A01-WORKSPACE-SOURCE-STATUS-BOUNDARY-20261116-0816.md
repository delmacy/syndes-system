# A01 — Workspace frontend: source/status and acceptance boundary (2026-11-16)

- Base `main`: `1cf48cc0a1281017ac58f7b9b9747f663109e151`. Scope: static GitHub-source audit only; this file is a checkpoint, not acceptance or release.
- Public contracts: `docs/subprojects/A01-workspace-frontend/{README,STATUS,OPERACAO}.md`, `docs/product/{MVP-SCOPE,WORKSPACE-MVP-HANDOFF,CORE-CRM-MVP-ACCEPTANCE,PRD-002-INBOX-ACCEPTANCE}.md`.
- Private implementation: `apps/workspace-web/src/{App.tsx,contexts/use-active-workspace.ts,lib/auth.ts,features/crm.tsx,features/inbox.tsx}`; test declarations: `apps/workspace-web/package.json`, `tests/auth.test.mjs` and the test directory listing.

## Findings and boundaries

1. **A01-STATUS-01 — owner status is not a functional audit.** `A01/STATUS.md` still says “documentação-base, SEM AUDITORIA FUNCIONAL”, with only `A01.DOC.01` pending. Source already contains implemented Workspace shell, CRM, Inbox, tenant/org/workspace selection and OIDC PKCE logic. This is a **documentation/evidence granularity divergence**, not proof of product completion. Reconcile the owner status against reviewed source, tests, and SHA; do not mark DONE from source existence.
2. **A01-IDENTITY-02 — local logout is not federated logout.** `App.tsx` invokes `markSignedOut()` and clears the in-memory token. `auth.ts` persists only a sign-out flag and PKCE transaction in sessionStorage; no Keycloak end-session call is shown in these inspected files. This matches the explicit limitation in `WORKSPACE-MVP-HANDOFF.md`; verify full session lifecycle before acceptance.
3. **A01-SCOPE-03 — UI scope and backend authorization are distinct.** `use-active-workspace.ts` limits selection to directory entries returned by the authenticated API and disposes scoped clients; this does not itself prove server-side org/workspace/tenant authorization. `crm.tsx` uses capabilities for UI actions and `inbox.tsx` contains a 10-second fallback poll; the documented product gates still require real multi-user Keycloak/OpenFGA/browser validation, realtime and attachment criteria where applicable.
4. **A01-TEST-04 — test declarations are not passing evidence.** `package.json` declares Node tests and several browser smoke commands. `auth.test.mjs` mocks fetch, window, sessionStorage and OIDC token exchange. Neither this test nor the inspected source proves live identity, tenant isolation, deployed SHA or UX acceptance.

## Interfaces, data and coverage

- A01 is a browser application consuming `TenantApi`; the inspected source does not own a tenant SQL schema, migrations or event dispatcher. HTTP route implementations, migrations and event producers/consumers belong to backend owners and were **not** audited here.
- Source existence: **observed** at base SHA. Test success on that SHA: **not verified**. Deployment/homologation: **not verified**. GitHub Pages publication SHA: **not verified**.
- Tests **not run**: Node unit, browser smoke, live-readiness, PostgreSQL, OIDC/FGA, multi-tenant E2E, CI. No DevServer access, secrets, SQL, runtime or deployment actions.
- Follow-up: reconcile `A01/STATUS.md` and topical documentation with source and real Actions results; audit `TenantApi` authorization boundaries and browser suites independently; preserve all open Product Gates. Do not equate a mock browser test with operational acceptance.
