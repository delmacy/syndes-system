---
title: "P14 · Contratos e dependências"
description: "Volume Plataforma e core · capítulo P14 · matéria 04"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 4. Contratos públicos, internos e dependências

**P14 não possui package.json, controller HTTP, export JavaScript, serviço NestJS ou esquema SQL.** O contrato normativo dessa unidade é o `AGENTS.md` e as decisões aprovadas. As interfaces reais abaixo possuem owners separados.

### Contratos do Kernel (A08), não métodos P14

| Fonte e interface real | Contrato público e responsabilidade | Consumidores |
|---|---|---|
| `package.json#exports["."]`, `src/index.ts` | `@syndes/core-kernel`: **único import público do pacote**; caminhos `src/*` internos não são API | Host e módulos autorizados |
| `CoreKernel.start()` | Inicializa módulos por dependência; falha persistente requer novo Kernel | Host |
| `CoreKernel.execute(request, handler)` | Valida request e sequência membership + autorização de recurso; `Actor` autenticado externamente | Endpoints conectados |
| `CoreKernel.executeModule(request, handler)` | Variante opt-in com `ModuleAccessPort`; se indisponível, nega em vez de permitir | Apenas entrypoints explicitamente migrados |
| `ModuleRegistry.register/ordered/has` | IDs, versões, schemas, dependências, ordem e rejeição de ciclos/ausência | Host/owners de plugin |
| `defineSyndesModule(plugin)` | Valida descriptor de `SyndesPlugin`, migrações, assets e permissions | Módulos confiáveis |
| `TenancyPort.canAccessTenant` | Membership verificada no Host | Kernel |
| `AuthorizationPort.canAccess` | Autorização de recurso independente do tenant | Kernel |
| `TrustedTenantDatabaseProvider.resolve` | Handle de DB escolhido pelo Host, não pela requisição | Adapters |
| `TrustedTenantTransactionProvider.withTransaction` | Conexão pinned para operação e outbox atômicas | Event publishers/consumers |
| `validatePlatformEvent/validateControlPlaneEvent` | Envelopes tipados/versionados, grupos de dados distintos | Produtores/consumidores autorizados |

### Contratos do Host (A04) — concretos, não fornecidos pela P14

| Fonte | Método/rota/serviço | Limite de exposição |
|---|---|---|
| `module-host.ts` | `loadInstalledPlugins()` | Lista estática `config/modules.json`, specifier trusted e validação de dependências antes do Nest |
| `module-host.ts` | `installModuleAssets(app,plugins)` | Rotas declaradas, GET/HEAD, headers de segurança; assets não são microfrontend remoto |
| `main.ts` | `createHostModule(plugins)` | Composition root Nest, providers de Control, tenancy, FGA, secrets |
| `main.ts` | `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config` | Rotas do **Host**, não API P14; config OIDC pública sem segredo |
| `main.ts` | `POST /v1/tenants/:tenantId/authorize` | JWT, tenant UUID, `CoreKernel.execute`; não é autorização de todos os controllers do sistema |
| `platform-event-publisher.ts` | Publicação transacional | Requer provider transacional, outbox no tenant DB |
| `platform-event-dispatcher.ts`, `platform-event-worker-*.ts` | Dispatch/manual batch/admission | Código opt-in; nenhum scheduler/grant produtivo autorizado |

### Público, privado e contratos de mudança

- **Público do Kernel:** `@syndes/core-kernel`; `src/index.ts` enumera símbolos. `private: true` impede tratar como SDK npm distribuído.
- **Interno do Host:** `apps/core-host/src/*` não deve ser importado diretamente por outros módulos como SDK público. Usar tokens/ports injetados e contratos versionados aprovados.
- **Privado do tenant:** credenciais, DSN, membership e transações; nunca criar interface que aceite nome do DB vindo do navegador.
- **Eventos de domínio/Control:** são naturezas e schemas distintos; a publicação não altera automaticamente status de módulo.
- **Configuração atual:** `config/modules.json` é lista fixa; **não há manifesto declarativo de perfis diferentes por instância**.

Qualquer alteração em API, export, ACL, SQL, eventos ou composição cross-owner precisa de revisão, WBS/ADR/PR e suites de consumidores. Esta auditoria **não** altera contratos executáveis.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P14-platform-core/chapters/04-contratos-e-dependencias-publicas.md).
