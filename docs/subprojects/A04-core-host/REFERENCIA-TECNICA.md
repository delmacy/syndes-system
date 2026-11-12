# A04 — Core Host | Referência técnica

> **PILOTO · 12/11/2026.** Aplicação de composição, não módulo de negócio. Implementação e tests locais revisados parcialmente; não equivale a deploy/tenant operacional.

## 1. Stack e composição

- **Owner:** `A04 Core Host` · `apps/core-host`.
- **Stack:** NestJS, TypeScript, Node.js e PostgreSQL `pg`; integra Keycloak/OpenFGA por adapters, com fontes de segredo controladas no runtime.
- **Configuração confiável:** `apps/core-host/config/modules.json`, não uma lista de módulos controlada pelo browser.
- **Backend de negócio:** plugins de CRM, Inbox, WhatsApp, Organizations e demais explicitamente instalados.

## 2. Funções e classes relevantes

| Fonte | Método/função | Responsabilidade |
|---|---|---|
| `src/module-host.ts` | `loadInstalledPlugins()` | Carrega somente package specifiers `@syndes/*/plugin`, valida module IDs, dependências e rotas de assets |
| `src/module-host.ts` | `installModuleAssets(app, plugins)` | Publica assets declarados pelo plugin em rotas exatas, com headers de segurança |
| `src/main.ts` · `CoreService` (interno) | `ready()` | Checa Control DB e inicialização do Kernel; não é API exportada |
| `src/main.ts` · `CoreController` (interno) | `health()`, `ready()`, `check(...)` | `healthz`, `readyz`, checagem autorizada por tenant |
| `src/adapters.ts` | `ActorVerifier`, `PgMembership`, `FgaPermission` | Adaptadores concretos sob credenciais/runtime confiáveis |

**Contrato público:** o Host **compõe**, mas não expõe seus arquivos internos como import público de outro módulo. `ModuleDefinition` e `SyndesPlugin` pertencem ao Kernel.

## 3. APIs e segurança

- Endpoints reconhecidos no código: `GET /healthz`, `GET /readyz`, `GET /modules/:moduleId/config`, `POST /v1/tenants/:tenantId/authorize`.
- Permissões: tenant membership e autorização de recurso verificadas antes do handler; gates ENABLED dependem de Control/entitlement do módulo.
- **Status:** endpoints presentes no código; validação de identidade real e runtime/URLs públicos requer gate próprio.

## 4. Frontend

Nenhum frontend próprio. Workspace está em `apps/workspace-web`, Manager em `apps/master-admin-web`, Support em `apps/support-web`. A separação de acesso Manager ↔ Tenant deve continuar rígida.

## 5. Dados e schemas

- **Tenant DB:** usa `TrustedTenantDatabaseProvider`, mas não assume propriedade de tabelas CRM, Organizations, Inbox ou WhatsApp; migrations são dos donos.
- **Control/Manager DB:** acessa registro e lifecycle de módulos por adapters. Migrações são de `infra/postgres/bootstrap/control-*.schema`, com owners Control Plane/Installer, não `Core Host` por conveniência.
- **Não** criar SQL operacional do ERP no Control DB.

## 6. Evidências e próximos passos

- Testes locais do Host: **63 PASS, 19 SKIP** no checkpoint documental de 12/11/2026; os skips requerem cobertura adicional e não são homologação real.
- Workpackage CMP-01/CMP-02: mapear interfaces e validar perfis de composição offline antes de qualquer ativação produtiva.
- Fontes: [module-host.ts](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/src/module-host.ts), [main.ts](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/src/main.ts), [adapters.ts](https://github.com/delmacy/syndes-system/blob/main/apps/core-host/src/adapters.ts).
