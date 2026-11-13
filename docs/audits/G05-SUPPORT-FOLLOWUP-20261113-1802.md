# G05/P06 Support — follow-up audit checkpoint (2026-11-13 18:02 BRT)

Source baseline: `8d17879b24fe3162f6b3e8a5776e25dd6d9cbc7b`. Branch: `audit/g05-support-followup-20261113-1802`. Evidence is GitHub MCP file reads of `modules/support/README.md` (blob `9659d914b150803e512b57332f42bd5b3f85e600`) and `modules/support/src/controller.ts` (blob `b3a0b4738c74d5514c7caa5f5b30ae3c1f865a97`). Previous partial checkpoint PR #124 is not accepted as merged or tested.

## Verified public boundary

Controller prefix `v1/tenants/:tenantId/support`; nine NestJS routes: GET `:kind/cases`, GET `:kind/cases/:caseId`, GET `:kind/cases/:caseId/events`, POST `internal/cases`, POST `external/cases`, PATCH `:kind/cases/:caseId/status`, PATCH `:kind/cases/:caseId/assignment`, PATCH `:kind/cases/:caseId/queue`, POST `:kind/cases/:caseId/notes`. The controller alone does not prove route registration or deployed reachability.

## Verified private boundary

`SupportHost.run` checks UUID-shaped tenant ID, invokes `verifyClient(bearer, "syndes-support-ui")` and forwards `{tenantId,actor}` to `SupportService`. Constructor injection tokens: `SYNDES_CORE_API` (kernel and verifier), `SYNDES_TENANT_DB` (trusted tenant DB provider). Error mapping: malformed tenant 400, missing authentication 401, input 400, authorization 403, uniqueness 409, DB mismatch 503, generic unknown 503. This is static source evidence, not proof of effective tenant isolation or identity configuration.

## Divergence and boundaries

README still says **"Este branch é desenvolvimento"** although the README and controller were fetched from main. This is a verified stale-context wording issue; no inference of production readiness. README requires `SYNDES_SUPPORT_TENANT_ID` and `SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID` gates, but their enforcement must be traced in service source and tests. Controller exposes event-history HTTP endpoint; it does not prove event bus publication. No migrations, DB schemas, service/domain internals, PRD SUP-01..SUP-11 mapping, module registration, CI evidence, or operational deployment verified in this checkpoint. The attempted path `modules/support/sql/migrations/001_support_cases.sql` returned 404; this is a path lookup failure, not evidence the migration is absent.

## Explicit non-actions / gates

No tests run; no DevServer accessed; no runtime, SQL, migration, credentials, workflow, deployment, product files, canonical status, or other writer branches changed. No homologation claimed. Next: locate migration through GitHub repository paths; inspect `service.ts`, `domain.ts`, `nest.module.ts`, tests and SUP requirements; map each source symbol to requirement and CI SHA; reconcile main and other concurrent documentation branches before any merge. Catalog-wide 57-unit reconciliation, zero-divergence gate, review and GitHub Pages published SHA remain unverified.
