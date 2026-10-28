# PRD-001 — Core CRM Sprint Plan

## Regras do plano

- Sprints são ondas sequenciais com gates, não estimativas de calendário. Datas e pontos ficam em aberto porque capacidade e quotas dos harnesses variam.
- Uma única tarefa mutável de agente por vez. Nenhum paralelismo que colida em contratos, arquivos, schema ou migrations.
- Codex coordena, congela contratos, revisa cada entrega e decide aceite. OpenCode Free é recomendado para tarefas backend delimitadas; Cursor Auto para revisão/UI depois que API e sessão estiverem estáveis.
- Cada tarefa implementável adiciona testes na mesma fatia. Frontend E2E é opt-in; não rodar por padrão. Se o gate exigir execução, usar Playwright headless, produzir log/resultados e analisar esses outputs.
- Não criar Issues/Projects/branches/PRs por este plano. Este arquivo e as ordens de trabalho são o plano local do repositório; criação de tickets externos requer operação explicitamente solicitada.

## Sprint 0 — Product/Technical Gate e baseline

**Objetivo:** eliminar decisões que impedem auth segura, endpoints e UI; revisar a fundação já criada.

**Ordens:** `CRM-00` (Codex, antes de agentes implementadores) e `CRM-01` (backend: revisão/teste do Control Plane registry/migration/CI; pode ocorrer enquanto contratos são fechados, sem expor endpoints).

**Saída:** spec aprovada; auth/sessão, actor/tenant context, autorização, API/error/CSV e provisioning/migration tenant definidos; migration validada em PostgreSQL 16 descartável pelo CI; dependências e arquivos compartilhados congelados. **Concluído** no commit `075e329` (API e Repository Integrity verdes).

**Gate:** **ACEITO** no commit `075e329`. API manager/CRM e UI autenticada podem iniciar conforme as dependências da Sprint 1. Não havia escolha humana pendente.

## Sprint 1 — Platform Core mínimo

**Objetivo:** provisionar e resolver tenant com isolamento, autenticação, autorização e auditoria suficientes para o Core CRM.

**Ordens:** `CRM-02` (provisionamento idempotente), `CRM-03` (actor/context/authorization/tenant routing/audit) e `CRM-04` (manager API). Ordem obrigatória conforme dependências indicadas em cada ordem.

**Saída:** Control Plane e database tenant separados; retries seguros; nenhum tenant selecionado pelo cliente; testes de autorização/isolation; manager sem acesso a conteúdo CRM.

**Gate:** migrations em DB descartável, provisioning idempotente, Tenant B negado, auditoria e endpoints autenticados provados.

**Estado:** **ACEITO** após CRM-02/03/04. API run `40546566664` (PostgreSQL 16 integration, migrations e tenant provisioning), Repository Integrity `40546566483` e job web associados passaram no commit `8b41a11`.

## Sprint 2 — Persistência e API do Core CRM

**Objetivo:** completar o backend do CRM em fatias testadas.

**Ordens:** `CRM-05` (modelo/migration + Organization/Person/Relationship), `CRM-06` (Tag/Note/Timeline/Archive/ChannelIdentity), `CRM-07` (normalização/busca/duplicidade), `CRM-08` (CSV import/export).

**Saída:** API NestJS completa no escopo, todas as operações derivam `TenantContext` e têm autorização/auditoria pertinentes.

**Gate:** unit/integration cobrindo requisitos obrigatórios e isolamento A/B; migrations testadas a partir de zero; CI verde.

**Estado (2026-10-28):** Sprint 2 e Sprint 3 implementadas e seus gates locais aceitos. O commit `5a935f0` corrige o teardown dos bancos PostgreSQL de teste; API run `40630437451` passou com PostgreSQL 16 e migrations/provisioning, e Repository Integrity run `40630437336` passou. O job Web associado também passou. Gate da Sprint 2 ACEITO.

## Sprint 3 — Frontend e integração

**Objetivo:** entregar as duas áreas de UI previstas e integrar com as APIs.

**Ordens:** `CRM-09` (Platform Admin UI) e `CRM-10` (Core CRM UI); seguir dependências/ownership para não editar arquivos sobrepostos.

**Saída:** componentes e fluxos integrados com testes de componente; UI admin só exibe metadados de tenant; UI CRM implementa a jornada e mensagens de validação.

**Gate:** contract/component/integration tests verdes; sem autenticação paralela ou regra de negócio duplicada no Next.

## Sprint 4 — Aceite integrado

**Objetivo:** provar operação end-to-end sem transformar E2E em rotina de cada tarefa.

**Ordem:** `CRM-11` (Codex conduz revisão de segurança/aceite; agente pode corrigir apenas itens delimitados).

**Saída:** evidência da jornada, cross-tenant denial, autorização, migrations, logs/auditoria e tratamento de erros. Script Playwright headless existe e grava output reproduzível; execução E2E permanece opt-in e só ocorre após autorização/necessidade explícita do gate.

**Gate final:** Core CRM só é aceito quando funcional, integrado, seguro, testado e demonstrável. Só então começa Inbox.

**Estado (2026-10-28):** Sprint 4 e Product Gate do Core CRM **ACEITOS** após a jornada autenticada headless passar no [CRM Acceptance run 40636689299](https://github.com/delmacy/syndes-system/actions/runs/40636689299), no commit `9c0707c`. As seis etapas da jornada passaram; JSON/logs foram revisados. API/Web CI e Repository Integrity também passaram no mesmo commit: [API 40636689297](https://github.com/delmacy/syndes-system/actions/runs/40636689297) e [Repository Integrity 40636689309](https://github.com/delmacy/syndes-system/actions/runs/40636689309). Inbox está liberado como próximo módulo pela ordem global; não foi iniciado.

## Próxima ação

Sprint 0/Gate 0, Sprints 1–4 e CRM-00–CRM-11 aceitos. O Core CRM está concluído no escopo MVP aprovado, com CI verde e jornada autenticada demonstrada no commit `9c0707c`. Próximo módulo autorizado pela ordem do produto: Inbox.
