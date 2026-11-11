# AGENTS.md — Tenant Workspace frontend

Read docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md and docs/engineering/WBS-FRONTEND-BACKEND-COMPOSITION-20261110.md before modifying navigation or tenant scope.

- One React app for Account, Platform Organization and Workspace. Manager is a **different app**, with separate login and APIs.
- src/App.tsx owns authentication and composes the hooks; src/app/workspace-shell.tsx owns the layout; src/app/feature-registry.ts describes only existing frontend views; src/app/workspace-feature-outlet.tsx mounts React screens from src/features.
- src/contexts/use-active-workspace.ts owns the scoped directory and selection per authenticated TenantApi; never cache tenant/org/workspace selection between logins or implicitly trust user-supplied scope IDs.
- packages/front-shared contains presentational primitives only: never JWT, API clients, OpenFGA, tenant context or Manager credentials.
- Backend NestJS modules live in modules/* and apps/core-host. Do not move frontend pages there or create microfrontends / arbitrary code loaders.
- A static menu is not permission enforcement. Do not add dynamic enabled-module navigation before the full server-side ModuleAccessPort gate and tenant-safe capabilities read model.
- Keep Platform Organization separate from CRM Organization. Do not unlock multiple organizations or SQL 002 without gates #21/#31 and worker/WhatsApp isolation.
- Preserve existing visual UX, CRM/Inbox behavior and tests. Work in clean worktrees; do not reset DevServer01 root or another chat's uncommitted changes. No implicit production deploy, database migrations or CI workflow changes.

## API transport lifecycle (FC-01.02)

- TenantApi is scoped to exactly one authenticated session or one rendered Workspace. Directory root creates disposable children with forWorkspace; never reuse a child for another Organization.
- Dispose old scoped client at React context switch. Dispose root client on logout/principal change to abort all descendants. watchInbox combines its caller AbortSignal with client's lifecycle.
- Stale fetch responses must be rejected even if transport ignores abort; late 401 from disposed scope must never log out current session.
- Aborting in-flight write is not server rollback. Never retry non-idempotent mutations without server-side idempotency and state check.
- Test API response races, SSE A/B, logout, unknown routes and anonymous guards. See docs/engineering/FC-01-02-WORKSPACE-REQUEST-LIFECYCLE-20261110.md.
