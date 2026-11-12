# A08 — Core Kernel | Referência técnica

> **PILOTO DE INVENTÁRIO · 12/11/2026.** Código verificado, testes locais registrados em P14; integração/ativação não derivadas desta página. Os métodos listados são entradas **exportadas**, não o catálogo de todos os métodos privados.

## 1. Stack e papel

- **Owner:** `A08 Core Kernel` · `packages/core-kernel`.
- **Tecnologia:** TypeScript 5.9 / Node 22+, compilado por `tsc`, sem dependências diretas de NestJS, SQL ou OpenFGA (`packages/core-kernel/package.json`).
- **Contrato de importação:** `@syndes/core-kernel` via `package.json#exports["."]` e `src/index.ts`.
- **Responsabilidade:** ports de tenancy, autorização, módulos, eventos e lifecycle; não conter regra de negócios.

## 2. Classes, métodos e efeitos

| Tipo e fonte | Método | Responsabilidade / efeitos |
|---|---|---|
| `CoreKernel` — `src/kernel.ts` | `start(): Promise<void>` | Inicializa plugins ordenados; falhas tornam startup reprovado, sem retry implícito |
| `CoreKernel` | `execute(request, handler)` | Verifica membership do tenant e autorização de recurso antes de chamar handler; falha fechada |
| `CoreKernel` | `executeModule(request, handler)` | Aplica elegibilidade do módulo além de tenancy/FGA em rota opt-in |
| `ModuleRegistry` — `src/module-registry.ts` | `register(module)` | Valida ID, versão, schema, dependências e duplicações |
| `ModuleRegistry` | `has(id)` | Consulta presença no registry confiável |
| `ModuleRegistry` | `ordered()` | Ordena por dependências e rejeita ausência/ciclo |

**Fontes:** [index.ts](https://github.com/delmacy/syndes-system/blob/main/packages/core-kernel/src/index.ts), [kernel.ts](https://github.com/delmacy/syndes-system/blob/main/packages/core-kernel/src/kernel.ts), [module-registry.ts](https://github.com/delmacy/syndes-system/blob/main/packages/core-kernel/src/module-registry.ts).

## 3. Contratos públicos

- **Ports exportados:** `TenancyPort`, `AuthorizationPort`, `TrustedTenantDatabaseProvider`, `TrustedTenantTransactionProvider`, `ModuleAccessPort`, `ModuleCatalogPort`, `TenantModuleLifecyclePort`.
- **Tipagem de evento:** `platformEventTypes`, `validatePlatformEvent`, `controlPlaneEventTypes`, `validateControlPlaneEvent` e tipos em `src/platform-events.ts` e `src/control-plane-events.ts`.
- **Regra:** tipos exportados não significam que o consumidor, adapter ou worker esteja ativado.
- **Contrato HTTP direto:** nenhum. A camada Host oferece as rotas.

## 4. Frontend

Nenhuma tela própria. Workspace/Manager/Support consomem APIs compostas no Host/Manager API. **Não criar componentes React no Kernel**; componentes visuais compartilhados pertencem a `packages/front-shared`.

## 5. Dados e schemas

- **Tenant DB:** nenhuma tabela/migration de ownership do Kernel.
- **Control/Manager DB:** nenhuma tabela de ownership do Kernel.
- **Acesso físico:** adapters do Host/serviços proprietários, através dos ports confiáveis. Não resolver credencial/DSN no Kernel.

## 6. Evidências e pendências

- Build local de Kernel: `npm test` — **35 PASS** no checkpoint documental de 12/11/2026. Não constitui habilitação de consumidores.
- **Próximo passo:** mapear versão, consumidores e testes dos ports públicos; nenhuma migração ou deploy autorizados por esta página.
