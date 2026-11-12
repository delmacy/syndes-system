# G01 — Arquitetura | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Revisão **estática de documentação, catálogo, manifests e código** no checkout de `origin/main` SHA `b73f42adf47a9b766790f399e13529b470aef171` (DevServer01/worktree isolada). Não foram executados deploy, migrações, testes de autorização com serviços reais ou Product Gate. **Revisão documental não é homologação arquitetural.**

## Estado multidimensional

| Dimensão | Estado constatado | Evidência e limite |
|---|---|---|
| **Documentação** | **Auditoria parcial** | Capítulos 00–07 reconciliados com ADRs e fontes de código; aprovação do responsável pendente |
| **Implementação da G01** | **Não aplicável (governança)** | Owner `docs/engineering` no catálogo; G01 não possui API, package de runtime nem persistência |
| **Arquitetura de componentes** | **Código e configuração encontrados** | Kernel/Host/plugins/frontends presentes no checkout; a presença em Git não prova operação |
| **Integração** | **Não verificada nesta auditoria** | G01 não executou testes reais Keycloak/OpenFGA, PostgreSQL tenant A/B ou fluxo de Event Bus |
| **Operação** | **Não se aplica à G01 como serviço** | Deploys pertencem aos respectivos módulos e infraestrutura; ambiente-alvo não auditado |
| **Escopo e gates** | **Revisão/aprovação pendentes** | Documentação anterior não aprovada; decisões dos ADRs mantêm seus próprios estados |

## O que a revisão conseguiu confirmar em fonte

| Fonte conferida no SHA | Evidência estática encontrada | O que **não** comprova |
|---|---|---|
| `catalog/work-units.json`, `docs/subprojects/index.json` | G01 é unidade de arquitetura, source `docs/engineering`; owners por área e documentação vinculada | Aprovação de novos requisitos |
| `packages/core-kernel/src/index.ts` e `src/contracts.ts` | Exports públicos de `CoreKernel`, `ModuleRegistry`, `TenancyPort`, `AuthorizationPort`, `TrustedTenantTransactionProvider` e `ModuleAccessPort` | Enforcement real em todos os endpoints e workers |
| `packages/core-kernel/src/module-registry.ts` | Registro com validação de ID/versão, dependências ausentes e ciclos | Compatibilidade entre versões em todos os consumidores |
| `apps/core-host/src/module-host.ts`, `config/modules.json` | Loader de trusted plugins, configuração fixa de CRM, Inbox, WhatsApp, Organizations, Support | Instalação/ENABLED por tenant ou perfis de instância |
| `modules/core-crm/package.json`, `modules/inbox/package.json`, `modules/whatsapp/package.json` | Superfícies via `exports`; pacote Inbox = `@syndes/core-inbox` | Rotas HTTP habilitadas, identidade ou integração |
| `apps/master-admin-web`, `apps/workspace-web`, `apps/support-web`, `packages/front-shared` | Projetos e compartilhamento visual presentes | Deploy independente, OIDC e isolamento verificados no ambiente |
| `packages/core-kernel/src/platform-events.ts`, `control-plane-events.ts` | Tipos/validação de contratos de eventos | Dispatcher ativo, migrations aplicadas ou replay operacional |

**Referências normativas consultadas:** [Core Framework](../../engineering/CORE-FRAMEWORK-ARCHITECTURE.md), [composição do Core](../../engineering/ADR-COMPOSICAO-MODULAR-CORE-20261111.md), [Control/Tenant](../../engineering/ADR-CONTROL-TENANT-MODULE-COMPOSITION-20261110.md), [frontend/backend](../../engineering/ADR-FRONTEND-BACKEND-COMPOSITION-20261110.md), [schemas](../../engineering/ADR-ACCOUNT-KERNEL-MODULE-SCHEMAS-20261110.md), [eventos tenant](../../engineering/ADR-PLATFORM-EVENTS-20261111.md), [eventos Control](../../engineering/ADR-CONTROL-PLANE-EVENTS-20261111.md).

## Divergências e limites abertos

1. Diagrama histórico do Core Framework menciona `apps/core-api` como futuro Host; a composição examinada é `apps/core-host`. Atualização da referência histórica **sob revisão**, não mudança de arquitetura implícita.
2. Índice `docs/standards/CONTRATOS-PUBLICOS.md` menciona `@syndes/inbox` como nome a verificar; o manifesto P02 declara `@syndes/core-inbox`. Corrigir pelo owner do contrato.
3. Schemas PostgreSQL por módulo e migração de tabelas `public` são evolução por gates; **não há evidência nesta auditoria de migração completa nem de ACL aplicada no ambiente**.
4. Perfis de composição de Host distintos e controle ENABLED/entitlement integrado em todas as rotas/workers continuam dependentes dos WPs/ADRs próprios.
5. Não se executaram testes de integração, E2E, restore, autorização real ou verificação de deploy nesta revisão; o CI da futura SHA documental também requer checagem separada.

## Atualização realizada nesta frente

- [Capítulos da especificação](ESCOPO.md): missão, responsabilidades e exclusões, matrizes, contratos, estados de implementação, diagrama lógico, fontes e pendências.
- [Plano de atualização das unidades](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md): G01 passa de baseline para auditoria parcial. **Demais STATUS não foram promovidos**.
- [Evolução/WBS](EVOLUCAO.md): mantém associações existentes sem inventar responsáveis/estados.
- Nenhum módulo de produto, SQL, workflow geral ou serviço operacional foi alterado.

## Próximos marcos candidatos (não comprometidos)

1. **G01 — revisão arquitetural:** responsável confirma as fronteiras, os conflitos e as propostas; reconciliar documentação de owners sem duplicar source of truth.
2. **G02 — Produto e UX:** auditar escopo/PRDs, prioridades, jornadas e Product Gates, conforme sequência aprovada.
3. **G03/Q10/Q07:** rastreabilidade de ADR e evidências de qualidade/CI; não editar workflows nesta frente documental.

## Checkpoint

| Data | SHA/ambiente | Método e resultado | Limitação |
|---|---|---|---|
| 2026-11-12 | `b73f42adf47a9b766790f399e13529b470aef171` · DevServer01, worktree isolada | Inspeção de arquivos e ADRs; atualização documental G01 | Sem runtime/CI do commit futuro, sem autorização, restore ou aceite |

**Critério para subir de “auditoria parcial”:** aprovar a descrição com os owners, solucionar ou formalizar divergências, verificar a SHA integrada e registrar evidências de testes/gates relevantes. Não confundir documento publicado com Product Gate concluído.
