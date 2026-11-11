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
