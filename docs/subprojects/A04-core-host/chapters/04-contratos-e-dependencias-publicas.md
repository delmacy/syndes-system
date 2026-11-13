## 4. Contratos e dependências públicas

- HTTP Core Host: `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize`. Rotas de plugin são **contratos dos owners**, não do Host.
- Internos A04: `loadInstalledPlugins`, `installModuleAssets`, `ActorVerifier.verify`, `PgMembership.canAccessTenant`, `FgaPermission.canAccess`, `TenantPgProvider.resolve`.
- Control: `PgModuleCatalog.listAvailableForTenant`, `PgModuleLifecycle.listModuleStates`, `PgEffectiveModuleAccess.canExecuteModule`, `PgModuleInstaller.plan/apply/enable/disable/verify`.
- Eventos C06: `OpenFgaServiceEventGrant.canProcess`, `TenantEventWorkerAdmission.authorize`.
- `ModuleDefinition`/`SyndesPlugin` pertencem ao Kernel. Não consumir classes de `main.ts` como API pública.
