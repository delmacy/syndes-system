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
