---
title: "A04 · Contratos e dependências"
description: "Volume Plataforma e core · capítulo A04 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos e dependências públicas

- HTTP Core Host: `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize`. Rotas de plugin são **contratos dos owners**, não do Host.
- Internos A04: `loadInstalledPlugins`, `installModuleAssets`, `ActorVerifier.verify`, `PgMembership.canAccessTenant`, `FgaPermission.canAccess`, `TenantPgProvider.resolve`.
- Control: `PgModuleCatalog.listAvailableForTenant`, `PgModuleLifecycle.listModuleStates`, `PgEffectiveModuleAccess.canExecuteModule`, `PgModuleInstaller.plan/apply/enable/disable/verify`.
- Eventos C06: `OpenFgaServiceEventGrant.canProcess`, `TenantEventWorkerAdmission.authorize`.
- `ModuleDefinition`/`SyndesPlugin` pertencem ao Kernel. Não consumir classes de `main.ts` como API pública.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/A04-core-host/chapters/04-contratos-e-dependencias-publicas.md).
