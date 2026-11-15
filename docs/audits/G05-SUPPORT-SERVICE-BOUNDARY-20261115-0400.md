# G05 — Support service boundary follow-up (2026-11-15 04:00 BRT)

Source baseline: GitHub main commit `1cf48cc0a1281017ac58f7b9b9747f663109e151`, rechecked through GitHub MCP commit search and compare. Dedicated branch `audit/g05-support-service-boundary-20261115-0400`. Earlier G05 branches `audit/g05-support-20261113-1556` and `audit/g05-support-followup-20261113-1802` are diverged from main (respectively 15 and 13 commits behind); their checkpoints are historical, not integrated or current release evidence.

## Source and contract evidence

- `modules/support/AGENTS.md`: operational Syndes tenant only, authenticated Keycloak/tenancy/OpenFGA before DB selection, queue membership and SQL enforcement, atomic mutation auditing, no outbound notes.
- `modules/support/src/service.ts` blob `e4962b7ac4d964e76a61344947877c13e27e2212`: `SupportService.run` compares request tenant to server configured `SYNDES_SUPPORT_TENANT_ID`, requires user actor, invokes kernel authorization before `TrustedTenantDatabaseProvider.resolve`, then compares returned DB tenant. Extra Inbox/CRM read permissions for external creation. SQL uses tenant-scoped queries and queue membership for list/get/history and mutations; creation uses CTE with `support_case_events` in same statement.
- `modules/support/src/domain.ts` blob `af8c520580927a14b2130e506828c3823718d9cf`: strict input shape, UUID, queue/kind/status/priority, pagination bounds and state transition graph.
- `modules/support/src/nest.module.ts` blob `3f86d75b78480be6fdc1a9a5eb67b7df0e18a235`: controller and Host providers; `plugin.ts` blob `114be278b4fae6fcc9069326a8baace2f63189d0` declares permissions, API module and migration 001. Plugin registration is not proof of runtime Host installation.
- Earlier G05 checkpoint inspected controller prefix `v1/tenants/:tenantId/support` and nine endpoints. Controller's verified-client boundary is not proof of live Keycloak configuration.
- `modules/support/test/security.test.mjs` blob `66f2a2079126f30f4994a7611e411ccf7d3edba9`: negative assertions for wrong tenant/config, FGA denial/outage before DB, DB mismatch, external dependency permissions, internal note history filtering, input rejection, and audit SQL text. Harness stubs DB and kernel; SQL strings and call order assertions are **not** PG execution or authorization integration evidence.
- `modules/support/package.json` declares build/check/test; declaration does not establish success. Prior checkpoint identified `modules/support/sql/001_support_cases.sql` and platform migration gate, but this round did not re-read their full bodies. No standalone Support domain event publisher/consumer demonstrated; `support_case_events` is an SQL audit table, not an event bus.
- `docs/engineering/SYNDES-SUPPORT-RUNBOOK.md` blob `332db926989b01a1eb71dcdcdbe4020e4c129b64`: explicit proposal for homologation, separate OIDC client, digest-pinned image, gated migration, smoke/rollback. It does not authorize deployment.

## Open boundaries and divergences

1. Historical README wording `Este branch é desenvolvimento` was previously confirmed stale on main; no change made.
2. Need full cross-check of SQL constraints, `SupportService` mutation branches, controller mapping, PG/E2E assertions, PRD SUP-01..SUP-11 and Host composition before accepting functional equivalence.
3. Service checks server-configured tenant and DB provider's tenant ID, but mocked tests do not demonstrate real DB isolation, FGA tuples, OIDC `azp`, tenant installer execution or client separation.
4. Neither `support_case_events` nor SQL audit CTEs establish outbound domain event publication. Notes must remain non-outbound.
5. G05 governance owner is distinct from Support product implementation P06 and platform/identity/DB/test owners. No status promotion without independent evidence.

## Execution and release gates

Tests **not run**. No CI run/result inspected for this SHA; no DevServer accessed; no SQL, migrations, secrets, runtime, workflows, deployment, other agent branches, canonical status or merge modified. Source existence != successful tests != integrated != deployed/homologated. Review gates, 57-unit and discovered-owner reconciliation, zero meaningful divergences, and public GitHub Pages SHA remain unverified. This is a bounded source audit checkpoint only.
