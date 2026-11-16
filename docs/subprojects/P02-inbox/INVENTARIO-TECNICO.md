# P02 Inbox — Inventário técnico verificável (código vs ambiente)

> **Snapshot editorial 16/11/2026 · SHA `24018b354392196899332af1581170fb3ad7cf24`.** Verificado no repositório, **não em runtime**. Os testes de 34 PASS citados no STATUS são **históricos (12/11, checkout `b452a03e`)**. O escopo continua rascunho; migrações aplicadas, IAM real, worker/Host e Product Gate não estão comprovados.

## 1. Stack, owners e exports

| Tema | Símbolo/caminho real | Fronteira |
|---|---|---|
| Módulo | [`package.json`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/package.json) `@syndes/core-inbox` 0.1.0 | `modules/inbox`, não container próprio |
| Entry público `.` | [`src/index.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/index.ts) | `dist/index.js` após build |
| Entry público `./plugin` | [`src/plugin.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/plugin.ts) | `dist/plugin.js`; não ativa automaticamente |
| NestJS | [`src/nest.module.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/nest.module.ts), [controller](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts) | Rotas declaradas sob Host |
| Domínio | [`InboxService`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/service.ts) | Regras/validação + Kernel |
| Persistência | [`PgInboxRepository`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/postgres.ts) | Queries no Tenant DB |
| Scope | [`InboxDefaultContextGuard`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/context-guard.ts) | JWT/Kernel/FGA/membership, org/workspace |
| Realtime | [`InboxChangeBus`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/realtime.ts) | SSE in-memory; não outbox |
| Integrações | [consumer WhatsApp](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/whatsapp-event-consumer.ts) + [consumer CRM](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/crm-link-event-consumer.ts) | C06 Event Bus em tenant tx, opt-in |
| UI | `apps/workspace-web/src/features/inbox.tsx`; `modules/inbox/public` | Frontend com owner A01; assets legados |

**Classes exportadas pelo pacote** precisam ser lidas em `src/index.ts` ou em `./plugin`; um import relativo de `src/postgres.ts` não vira API pública automaticamente. Export manifest permite `.` e `./plugin` apenas.

## 2. Inventário de 17 endpoints

**Base:** `/v1/tenants/:tenantId/inbox`. Controller [`src/inbox.controller.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/inbox.controller.ts). Parâmetro de escopo opcional via headers `x-syndes-organization-id` e `x-syndes-workspace-id`, que são **seletores validados**, não fonte de autoridade.

| Verbo | Rota relativa | Handler | Contrato / limite | Ficha A–J |
|---|---|---|---|---|
| `GET` | `conversations` | `InboxController.list` | status, queue, scope, limit, offset, q | [p02-queue-list](acoes/p02-queue-list.md) |
| `GET` | `metrics` | `InboxController.metrics` | não recebe body | [p02-queue-metrics](acoes/p02-queue-metrics.md) |
| `POST` | `conversations` | `InboxController.create` | subject, crmPersonId?, externalThreadId? | [p02-conversation-create](acoes/p02-conversation-create.md) |
| `GET` | `conversations/:id` | `InboxController.get` | conversationId UUID | [p02-conversation-get](acoes/p02-conversation-get.md) |
| `PATCH` | `conversations/:id/status` | `InboxController.status` | status: open | pending | resolved | [p02-conversation-status](acoes/p02-conversation-status.md) |
| `PATCH` | `conversations/:id/favorite` | `InboxController.favorite` | favorite boolean | [p02-conversation-favorite](acoes/p02-conversation-favorite.md) |
| `PATCH` | `conversations/:id/read` | `InboxController.read` | conversationId UUID | [p02-conversation-read](acoes/p02-conversation-read.md) |
| `GET` | `conversations/:id/messages` | `InboxController.messages` | conversationId; limit até 100 | [p02-message-list](acoes/p02-message-list.md) |
| `POST` | `conversations/:id/replies` | `InboxController.reply` | body texto até 5000 | [p02-message-reply](acoes/p02-message-reply.md) |
| `POST` | `conversations/:id/notes` | `InboxController.note` | body até 5000 | [p02-message-note](acoes/p02-message-note.md) |
| `PATCH` | `conversations/:id/assignment` | `InboxController.assign` | assigneeId string ou null | [p02-assignment-set](acoes/p02-assignment-set.md) |
| `PATCH` | `conversations/:id/handoff` | `InboxController.handoff` | mode human | bot | [p02-handoff-set](acoes/p02-handoff-set.md) |
| `PATCH` | `conversations/:id/workspace` | `InboxController.transferWorkspace` | workspaceId UUID | [p02-workspace-transfer](acoes/p02-workspace-transfer.md) |
| `PATCH` | `conversations/:id/contact` | `InboxController.contact` | personId UUID | [p02-crm-link](acoes/p02-crm-link.md) |
| `POST` | `conversations/:id/history` | `InboxController.requestHistory` | conversationId UUID | [p02-whatsapp-history](acoes/p02-whatsapp-history.md) |
| `POST` | `conversations/:id/simulator/inbound` | `InboxController.simulate` | body, externalMessageId estável | [p02-simulation-inbound](acoes/p02-simulation-inbound.md) |
| `GET` | `events` | `InboxController.eventsStream` | Bearer JWT; escopo confiável | [p02-realtime-events](acoes/p02-realtime-events.md) |

A existência de 17 decorators é o **inventário de código**, não um atestado de que 17 URLs respondem em um ambiente específico. `GET /events` usa stream SSE autenticado, não um endpoint de dados GET ordinário.

## 3. Serviços, ações e validações

| Serviço | Métodos presentes | Observação |
|---|---|---|
| `InboxHost` | `list`, `get`, `messages`, `history`, `reply`, `revalidateStream`, `run` | Port WhatsApp opcional, checagem de JWT |
| `InboxService` | `watch`, `create`, `list`, `get`, `messages`, `assign`, `status`, `handoff`, `favorite`, `markRead`, `linkContact`, `reply`, `note`, `simulate`, `transferWorkspace`, `metrics` | Kernel por recurso e action; não há bypass Manager |
| `PgInboxRepository` | `create`, `list`, `get`, `messages`, `assign`, `status`, `handoff`, `favorite`, `markRead`, `linkContact`, `append`, `transferWorkspace`, `metrics` | Queries escopadas; path legacy tenant-only condicionado |
| `InboxDefaultContextGuard` | `resolve` | Valida tenant/org/workspace e índices/backfill conforme modo |
| `InboxChangeBus` | `subscribe`, `publish`, `count`, `connect` | SSE 60s; até 60 inscritos no canal; revalida em enforce |
| `InboxWhatsAppReceivedConsumer` | `handle` | Consome `whatsapp.message.received.v2`, publica observed |
| `InboxCrmPersonResolvedConsumer` | `handle` | Consome `crm.person.resolved.v1`, nunca sobrescreve outro CRM Person |

Limites: `text` rejeita vazios e caracteres de controle, até 5000 no corpo; `subject` 160; `optionalExternal` até 160 com charset restrito; `limit` inteiro 1–100; status `open|pending|resolved`; queue `all|mine|unassigned`; scope `all|unread|favorites|groups|archived`; offset 0–100000; search máximo 80. Fonte [`src/validation.ts`](https://github.com/delmacy/syndes-system/blob/24018b354392196899332af1581170fb3ad7cf24/modules/inbox/src/validation.ts).

## 4. Dicionário de SQL 001 (apenas base, não runtime completo)

| Tabela base | Campos declarados em `001_inbox_foundation.sql` | Constraints/índices |
|---|---|---|
| `inbox_conversations` | `tenant_id`, `id`, `crm_person_id`, `subject`, `channel`, `external_thread_id`, `status`, `assigned_to`, `handoff`, `created_at`, `updated_at` | PK composta tenant/id, FK tenant-qualified para `crm_people`; unique index `tenant_id,channel,external_thread_id` partial; índice `inbox_queue_idx` |
| `inbox_messages` | `tenant_id`, `id`, `conversation_id`, `direction`, `body`, `author_id`, `external_message_id`, `created_at` | PK composta tenant/id, FK tenant-qualified para conversa; unique dedup parcial; histórico tenant/conversa/data/id |
| `inbox_events` | `id` bigint identity, `tenant_id`, `conversation_id`, `actor_id`, `action`, `detail`, `recorded_at` | PK de evento, FK tenant-qualified; `inbox_audit_idx` |

### Campos presentes no código atual, ausentes da base 001

| Campo(s) | Código de referência | Implicação |
|---|---|---|
| `platform_organization_id`, `platform_origin_workspace_id`, `platform_current_workspace_id` | `postgres.ts`, `context-guard.ts`, consumidor WA | Exigem migrations/backfill de escopo e índices de trava 002 controlados por outros owners |
| `is_group`, `is_favorite`, `is_archived`, `unread_count`, `history_sync_at` | `contracts.ts`, `postgres.ts` | Reconciliar versões de migrations de UI/WhatsApp |
| `source`, `bot_eligible`, `provider_message_id`, `provider_sender_id` | `whatsapp-event-consumer.ts` | Reconciliar schema WA e janela de cutover antes de ativar consumidor |
| `whatsapp_chat_routes`, `whatsapp_accounts` | `postgres.ts` | Entidades de P03 WhatsApp, **não propriedade Inbox** |
| `platform_*memberships` e `platform_legacy_backfill_runs` | `context-guard.ts` | Dados de Control/Organizations/Workforce no Tenant DB, outros owners |

**Consequência:** é incorreto usar somente o SQL 001 para montar um banco do Inbox atualizado. Precisamos registrar o caminho e SHA de cada migration adicional no gate de instalação. Nenhuma migration foi executada neste trabalho.

## 5. Contratos de eventos e transporte

| Tipo | Direction / source | Evidência de comportamento |
|---|---|---|
| `whatsapp.message.received.v2` | P03 → P02 | `InboxWhatsAppReceivedConsumer.handle` carrega origem por port, usa mesmo tenant tx, canonicalChat e hashes idempotentes |
| `inbox.participant.observed.v1` | P02 → CRM P01 | Publicado para chats individuais não próprios; com scope e correlação, não cria Person |
| `crm.person.resolved.v1` | CRM P01 → P02 | Checa UUID/scope, `FOR UPDATE` e `identity.validateLink` antes de vincular |
| `GET events` SSE `changed` | Host P02 → Workspace A01 | Sem PII, invalida snapshot; cliente reconsulta REST autorizado |
| `POST replies` quando WhatsApp | Inbox Host → P03 via port | Enqueue somente após grants; receipt/delivery reais são responsabilidade P03 |

Diferença crucial: SSE é buffer in-memory efêmero; Platform Events dependem de outbox e worker. Não declarar worker/cutover como em operação sem evidência.

## 6. Autorização e cenários de negação

| Recurso | Action observada em código | Caminho |
|---|---|---|
| `inbox:conversations` | read/write | fila, detalhes, status, handoff, favorito, lida, vínculo, SSE, criar |
| `inbox:messages` | read/write | histórico, reply / outbound |
| `inbox:notes` | write | notas internas |
| `inbox:assignment` | write | atribuir e transferir workspaces |
| `inbox:simulation` | write | simular inbound com ID estável |
| `inbox:metrics` | read | indicadores |
| `crm:people` | read | vínculo manual CRM |
| `whatsapp:accounts` | read | solicitação de histórico WA |

`src/plugin.ts` declara permissões mas **não cria grants FGA**. O guard de contexto exige tenant membership, FGA e, conforme modo, `ENABLED` antes de DB; headers não autorizam novo tenant. Testes negativos reais Keycloak + FGA + A/B, modo `enforce`, multi-org e restore pendentes de homologação.

## 7. Fontes de teste e qualificação

- `test/inbox.test.mjs`: regras do serviço, contratos e casos básicos; **não verifica browser real**.
- `test/default-context.test.mjs`, `test/scope-query.test.mjs`: contexto, isolamento, FGA e SQL scoped.
- `test/realtime.test.mjs`: SSE e revalidação.
- `test/frontend.test.mjs`: DOM simulado Node/vm, **não Playwright do Workspace**.
- `test/pg-integration.mjs`, `test/pg-org-scope.mjs`, `test/postgres-integration.sh`: PostgreSQL descartável e HTTP Host fake verifier/FGA, não configuração produtiva.
- `apps/core-host/test/inbox-pg-http.integration.mjs`: Host NestJS no teste com portas fake, não login produtivo.

Evidência histórica: [STATUS](STATUS.md) registra **34 PASS locais em 12/11**. Nesta atualização documental, nenhum `npm test` do Inbox, E2E real, build de módulo, migration ou deploy de negócio foi executado.

## 8. Lacunas para agente / marco seguinte

A [paridade de código](PARIDADE-CODIGO.md) apresenta os caminhos exatos de P04 SQL 002/003 e P03 SQL 005, além das divergências manuais/assíncronas do CRM, marcação de lida, favorito e elegibilidade de responsável. **Não provisionar apenas com P02 SQL 001.**


| Lacuna | Owner principal | Critério de fechamento |
|---|---|---|
| Relação completa SQL 001 → org/workspace 002 → WA fields | P02 + P04/P03, conforme owner do schema | migration aplicável, ordem, checksum, restore, testes |
| WhatsApp ingress / reply / history | P03/C06/P02 | service grants, replay, idempotência e delivery |
| Worker opt-in | C06 + consumers P02/P01 | flag/ENV, health e autorização real |
| JWT/ENABLED/FGA, tenant A/B, default/multi-org | A04/A08/C01/C03/C04/P02 | negativas reais e logs de execução |
| UI fila/contatos/resposta/Inspector em navegador | A01/P02/P05 | dados autorizados, funcionalidade mobile e aceite |
| SSE multi-host | A04/P02 | broker compartilhado ou arquitetura de instância única |
