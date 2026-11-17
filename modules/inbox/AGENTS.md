# AGENTS.md — Inbox

## Estado

**MÓDULO EM DESENVOLVIMENTO — PRD-002 (prioridade a partir de 2026-11-01).** O CRM mantém pendências de frontend abertas por decisão explícita do responsável pelo produto. Não declarar Inbox concluída antes de realtime seguro, anexos, aceite Keycloak/OpenFGA real e testes de isolamento.

## Missão

Fornecer atendimento humano compartilhado e histórico de conversas, sem tentar reproduzir um contact center completo.

## Escopo MVP

- Conversation;
- Message;
- Assignment;
- Status;
- Attachments;
- Realtime;
- Human handoff;
- histórico.

Fluxo: receber → visualizar → atribuir → responder → acompanhar.

## Dependências

- Core CRM para identidade canônica de cliente.
- Platform Core para tenancy/auth.
- Canais fornecem mensagens via contratos; Inbox não depende diretamente de whatsmeow/email provider.

## Não fazer

- voice contact center;
- SLA sofisticado;
- workforce management;
- QA de atendentes;
- dashboards avançados;
- automações genéricas.

## Segurança

- conversa sempre escopada ao tenant;
- attachments autorizados;
- WebSocket/realtime deve validar tenant e usuário;
- nenhum ID externo pode selecionar tenant.

## Testes

- message ordering/idempotency;
- assignment;
- status;
- realtime isolation;
- attachments;
- handoff;
- cross-tenant denial;
- reconnect/retry onde aplicável.


## ModuleAccess e SSE (FC-02.02)

O Core Host define SYNDES_INBOX_MODULE_GATE=legacy|enforce. Ausente preserva legacy até migrations Control DB, backup/restore, entitlements e receipts de todos os tenants. A flag nunca vem de usuário, frontend, header ou query.

Com enforce, todo ingresso HTTP/SSE passa por InboxDefaultContextGuard e CoreKernel.executeModule com moduleId inbox ANTES de tenant DB, mantendo JWT, tenant membership, FGA por ação, SQL 002 e Organization/Workspace. SSE verifica JWT/escopo/FGA/ENABLED periodicamente e antes dos eventos; falha e timeout fecham o stream. Não converter erro de ModuleAccess em legacy. Isso não protege ainda callbacks/outbox/go gateway WhatsApp; continuam tarefas FC-02.02. Não liberar funcionalidades no frontend até servidor e read model tenant-safe.

Ver docs/engineering/FC-02-02-INBOX-MODULE-GATE-SSE-20261111.md. A worktree raiz do DevServer01 é de outra frente de UX e deve ser preservada.

## Consumidores de Platform Events (2026-11-11)

`whatsapp-event-consumer.ts` é o owner de gravações de conversas e mensagens, utilizando portas de leitura/comando WhatsApp e publicando `inbox.participant.observed.v1`. `crm-link-event-consumer.ts` revalida a decisão CRM e o escopo antes de escrever `crm_person_id`, jamais sobrescreve vínculo divergente. Efeito e `consumer_inbox` estão na mesma transação. Funcionamento comprovado somente em PG17 descartável com adapters injetados; sem worker registrado/ativado no Host operacional. Sem frontend novo ou duplicado.

## P02-ASSIGN-01 — regra de atribuição (2026-11-16)

O ator mantém `inbox:assignment/write`. Atribuição para `assigneeId` não nulo só ocorre quando `platform_org_memberships` **e** `platform_workspace_memberships` de P04 estão ativas e têm `admin|editor` no **workspace atual** da conversa, com organização/workspace ativos. `viewer`, revogado, ausente e outro escopo geram resultado nulo / 404 genérico, sem escrita ou notificação; `null` libera.

A operação usa um CTE com `FOR NO KEY UPDATE` na conversa (serializa atribuições e transferências) e `FOR SHARE` nas memberships (protege contra revogação durante o update), na mesma instrução SQL que grava e audita. Testar com `pg-org-scope.mjs`, `pg-assignment-races.mjs`, `pg-integration.mjs` e HTTP Host. Não criar tabela duplicada de funcionários, não supor novos FGA grants, não sanear o histórico automaticamente e não ativar em ambiente sem migrations/backfill P04. A autenticação e grants individuais Keycloak/OpenFGA do **destinatário** não são validados neste incremento.

**Evidência automatizada:** [run 43939884169](https://github.com/delmacy/syndes-system/actions/runs/43939884169), SHA `8de743e`, job Inbox success: 35 unitários, 1 PG scope, 1 PG persistência, 1 PG concorrência, 9 Host HTTP, sem identity provider de produção. Não promover o módulo a homologado por esse resultado.

## P02-ASSIGN-02 — pré-homologação sem ambiente operacional

Enquanto DevServer01 estiver indisponível, executar apenas a suíte `Regression / inbox` no GitHub Actions com PostgreSQL e OpenFGA descartáveis. `pg-assignment-preflight.mjs` deve reportar apenas contagens agregadas em transação com rollback; `fga-assignment-preflight.mjs` deve testar o modelo real em store efêmero. Sem limpar `assigned_to` históricos, criar grants em produção, alterar o modelo FGA ou simular validação Keycloak inexistente. Consulte `docs/subprojects/P02-inbox/PRE-HOMOLOGACAO-ASSIGN.md`.

**Prova do ensaio CI:** job `Regression / inbox` do [run 43968388949](https://github.com/delmacy/syndes-system/actions/runs/43968388949), SHA `df6424c`: preflight PG 1 PASS, OpenFGA descartável 5 PASS, 35 testes do módulo e 9 Host HTTP. Nenhum gate de IAM real, backfill real, reparo histórico ou servidor foi liberado.

## Deploy DevServer01 — 17/11/2026

Imagem `syndes/core-host:inbox-assign-4126665`, source commit `4126665`, implantada no stack de WhatsApp sem mudar gateway/frontend/dados/grants; canário isolado e smoke real Kernel/OpenFGA com responsável atual PASS, índice 002 preservado. Ver `docs/subprojects/P02-inbox/IMPLANTACAO-DEVSERVER01-20261117.md` para rollback, riscos e evidência. **A implementação P02-ASSIGN-01 NÃO valida grants FGA do futuro destinatário por operação**, e Product Gate segue aberto.
