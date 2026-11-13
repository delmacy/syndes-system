# P14 — Platform Core | Referência técnica

> **AUDITORIA ESTÁTICA PARCIAL — 12/11/2026.** Base `origin/main` SHA `e2c5194a97d48d8a809231d7088be668604725fb` (DevServer01/worktree isolada). **P14 é uma fronteira contratual**: a pasta `modules/platform-core` contém **somente `AGENTS.md`**. Kernel, Host, identity, tenancy e events executáveis têm owners específicos. Não interpretar este inventário como produto homologado.

## Stack e ownership

| Camada | Source of truth | Stack e limite |
|---|---|---|
| P14 | `modules/platform-core/AGENTS.md` | Política de capacidades transversais, sem package, classes, banco, HTTP ou app |
| A08 — Core Kernel | `packages/core-kernel/package.json`, `src/index.ts`, `kernel.ts`, `module-registry.ts` | Node 22+/TypeScript; `@syndes/core-kernel` versão 0.1.0 **privada**, `exports["."]` apenas |
| A04 — Core Host | `apps/core-host/package.json`, `src/main.ts`, `module-host.ts` | NestJS 12, Node ESM, pg, jose e adapters Control/Keycloak/OpenFGA/OpenBao |
| Control/tenancy | `modules/organizations`, `apps/account-access-api`, `apps/core-host/src/module-*.ts` | Managers/tenants com ownership separado |
| Plataforma de eventos | `packages/core-kernel/src/*events.ts`, `apps/core-host/src/platform-event-*.ts` | Contrato tipado + publicação/dispatch/manual batch **opt-in**, não scheduler automático |
| Domínio | `modules/core-crm`, `inbox`, `whatsapp`, `organizations`, `support`, `service-management` | API, persistência e comportamento próprios, sob seus owners |

## Classes, métodos e contratos públicos — owner A08

Os nomes abaixo são **exports públicos reais** de `packages/core-kernel/src/index.ts`; não são classes/métodos pertencentes à P14.

| Símbolo exportado | Efeito |
|---|---|
| `CoreKernel` / `start()` | Inicializa definições com ordem de dependências e sem repetir hooks após rejeição |
| `CoreKernel.execute(...)` | Exige `Actor` autenticado, `TenancyPort.canAccessTenant` e `AuthorizationPort.canAccess`; nega operação indevida |
| `CoreKernel.executeModule(...)` | Gate **opt-in** de `ModuleAccessPort`, não ativado automaticamente em todos os controllers |
| `ModuleRegistry.register/ordered/has` | SemVer/IDs válidos, schemas únicos, dependências e ordenação; rejeita ciclos/ausentes |
| `defineSyndesModule(...)`, `SyndesPlugin` | Descriptor confiável e seus assets, permissions e migrations |
| `TrustedTenantDatabaseProvider`, `TrustedTenantTransactionProvider` | Porta query-only vs. conexão pinned com `withTransaction` para efeitos atômicos |
| `validatePlatformEvent`, `validateControlPlaneEvent` | Envelopes versionados para planos de dados distintos |
| `resolveApprovedModules`, `projectTenantModuleStates` | Contratos de catálogo e lifecycle; operacionalidade depende de adapters reais |

**Contrato de import:** `@syndes/core-kernel` (entrypoint público), nunca `@syndes/core-kernel/src/*.ts`. O package tem `private:true`, sem publicação pública aprovada.

## Host real: composição, APIs e limites (owner A04)

`apps/core-host/src/module-host.ts` expõe **internamente** `loadInstalledPlugins()` e `installModuleAssets()`: lê a lista fixa de `config/modules.json` (CRM, Inbox, WhatsApp, Organizations, Support), valida trusted specifiers `@syndes/.../plugin`, dependências/ciclos e rotas duplicadas. `@syndes/service` existe como dependência do Host, **mas não está listado na composição ativa**.

`apps/core-host/src/main.ts` define os controllers HTTP concretos do **Host**, não da P14:

| Rota | Comportamento observado |
|---|---|
| `GET /healthz` | Estado básico `ok` |
| `GET /readyz` | Verifica CoreService/Control e inicialização do Kernel |
| `GET /modules/:moduleId/config` | Retorna `issuer/clientId` de plugin aprovado com OIDC público configurado |
| `POST /v1/tenants/:tenantId/authorize` | JWT verificado, UUID tenant, tenant membership + FGA via `CoreKernel.execute`; resposta deny/falha apropriada |

Isso não prova que todos os controllers de domínios tenham sido migrados para o gate de `executeModule`. Não expor `main.ts` como API SDK do Kernel.

## Persistência, eventos, frontend e configuração

- **Nenhum schema, migration, database ou entidade SQL é da P14.** Control DB, tenant DB (um por tenant) e schemas de módulos têm owners independentes. `platform_events` fica no banco tenant, não em Control.
- A04 provê `TenantPgProvider`, adapters, publishers e dispatchers; A08 define o contrato. Workers automáticos, grants reais e DDL operacional dependem de gates separados.
- **Nenhum frontend P14.** Workspace e Manager são apps separados; `packages/front-shared` não compartilha credenciais/sessão.
- **Nenhum perfil de composição implantado:** `config/modules.json` é lista fixa; o plano CMP-01/02 é futuro e CMP-03–09 não está comprovado.
- **Segurança:** qualquer mudança cross-owner exige revisão, testes de consumidores, tenant isolation e autorização; a inspeção não concede acesso operacional.

## Testes, WBS e evidências

- **Histórico:** [STATUS P14](STATUS.md) registrava em revisão anterior 35 testes locais Kernel PASS e 63 Host PASS, com **19 SKIP**; isso não foi reexecutado como teste de produto nesta auditoria documental.
- **Baseline atual:** [run 43345095065](https://github.com/delmacy/syndes-system/actions/runs/43345095065) no SHA `e2c5194` — 24/24 jobs `success` (incluindo Kernel e Host). Prova de CI naquele SHA, não restore/operacionalidade do produto.
- **Composição:** [ADR](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md) e [WBS](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md); CMP-01–10 são planejamento. Consulte [EVOLUÇÃO P14](EVOLUCAO.md) antes de criar tarefas.

[Especificação](ESCOPO.md) · [STATUS](STATUS.md) · [Governança e arquitetura](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
