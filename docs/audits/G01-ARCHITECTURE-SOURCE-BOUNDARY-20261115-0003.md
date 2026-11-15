# G01 — Architecture source-boundary audit (2026-11-15 00:03 BRT)

- Repository: delmacy/syndes-system
- Inspected main SHA: `1cf48cc0a1281017ac58f7b9b9747f663109e151` (GitHub commit search; verify again before integration).
- Scope: G01 architectural ownership, global contracts, architecture validator, Core Kernel public surface, Core Host plugin composition, front/backend ADR, modular-profile ADR.
- Catalog: `catalog/work-units.json` enumerates 57 units (P14, A8, C8, I12, Q10, G5); its `maturity` is ownership/source classification, **not** a tested/deployed/homologated state. No newly discovered owner conclusively established in this limited sample.

## Public and private boundaries

- `packages/core-kernel/src/index.ts` explicitly exports public ports, contracts, module registry, plugin and events interfaces; internal files are not supported extension points.
- `apps/core-host/src/module-host.ts` is a trusted Nest plugin loader. It validates package specifier pattern, unique module entries, plugin descriptor and ID, dependency cycles and duplicate asset routes. `apps/core-host/config/modules.json` lists CRM, Inbox, WhatsApp, Organizations, Support; Service is absent. These checks establish composition, not tenant ENABLED/authorization or deployment.
- `docs/engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md` separates Manager and Workspace trust boundaries; front-shared is presentation-only, and server-side tenant/org/workspace + FGA authorization is required independently of menu visibility.
- `docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md` explicitly says deployment profiles are **not implemented**; CMP-01..10 are future gates, not capabilities.
- `scripts/architecture/check-work-units.mjs` checks 57 IDs, allowed maturity values, paths and module AGENTS/package presence; it does **not** prove implementation correctness, API security, events persistence, migration safety or operational acceptance.

## APIs, classes, events, schemas and migrations

- Inspected source class/function boundaries: `ModuleRegistry` invocation and `loadInstalledPlugins`/`installModuleAssets` in Core Host; Kernel exports `platformEventTypes`, `validatePlatformEvent`, `controlPlaneEventTypes`, `validateControlPlaneEvent` and typed transaction/provider contracts.
- No G01-owned HTTP endpoint, event stream, schema or migration was demonstrated. Those belong to implementing modules/infra; this audit did not inspect their bodies or test their integration.
- G01 contract prohibits treating multi-org SQL 002, Control migrations, OpenFGA tuples or event workers as operationally approved merely because source exists.

## Evidence and gaps

- Source existence: confirmed for paths listed above at inspected main snapshot.
- Test success at inspected SHA: **not checked**. No test executed in this run; CI status, assertions, negative tenant-isolation tests and source-to-ADR traceability remain open.
- Deploy, operational authorization, backup/restore, production and homologation: **not checked and not proven**.
- Public GitHub Pages published SHA: **not checked**.
- Meaningful divergences zero: **not asserted**. Prior Q07/Q08/Q10 CI/release findings remain open pending current-code revalidation.
- No DevServer access, runtime, SQL, migrations, secrets, product workflows, deployment, or other agents' branches were touched.

## Next gate

Review Kernel and Core Host actual guards and negative tests, inspect architecture checks and source owners for direct cross-module imports; correlate test run SHA and docs review before any integration. Recheck latest main/branch and compare with zero unrelated changes. Do not merge this checkpoint without review.
