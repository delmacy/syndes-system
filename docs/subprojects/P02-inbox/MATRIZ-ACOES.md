# P02 Inbox — Matriz de ações, contratos, permissões e provas

> **Rastreabilidade documental · 16/11/2026 · código `24018b354392196899332af1581170fb3ad7cf24`.** 17 rotas HTTP e 2 consumidores assíncronos identificados na fonte. **Não confundir declaração com roteamento montado, worker ativo, concessão FGA, CI da SHA, homologação ou deploy.** Os 34 PASS são históricos de 12/11 no checkout `b452a03e`.

## 1. Funções e 19 ações rastreáveis

| Função | Ação / ficha A–J | Tipo | Contrato | Permissão/contexto |
|---|---|---|---|---|
| Fila e indicadores | [Filtrar fila e pesquisar conversas](acoes/p02-queue-list.md) | HTTP | `GET conversations` | `inbox:conversations/read` |
| Fila e indicadores | [Consultar indicadores da fila](acoes/p02-queue-metrics.md) | HTTP | `GET metrics` | `inbox:metrics/read` |
| Conversas | [Criar conversa de demonstração](acoes/p02-conversation-create.md) | HTTP | `POST conversations` | `inbox:conversations/write` |
| Conversas | [Consultar conversa](acoes/p02-conversation-get.md) | HTTP | `GET conversations/:id` | `inbox:conversations/read` |
| Conversas | [Alterar estado da conversa](acoes/p02-conversation-status.md) | HTTP | `PATCH conversations/:id/status` | `inbox:conversations/write` |
| Conversas | [Marcar ou desmarcar favorito](acoes/p02-conversation-favorite.md) | HTTP | `PATCH conversations/:id/favorite` | `inbox:conversations/write` |
| Conversas | [Marcar conversa como lida](acoes/p02-conversation-read.md) | HTTP | `PATCH conversations/:id/read` | `inbox:conversations/write` |
| Mensagens e notas | [Consultar mensagens](acoes/p02-message-list.md) | HTTP | `GET conversations/:id/messages` | `inbox:messages/read` |
| Mensagens e notas | [Responder à conversa](acoes/p02-message-reply.md) | HTTP | `POST conversations/:id/replies` | `inbox:messages/write` |
| Mensagens e notas | [Registrar nota interna](acoes/p02-message-note.md) | HTTP | `POST conversations/:id/notes` | `inbox:notes/write` |
| Operação do atendimento | [Atribuir ou liberar responsável](acoes/p02-assignment-set.md) | HTTP | `PATCH conversations/:id/assignment` | `inbox:assignment/write` |
| Operação do atendimento | [Alternar atendimento humano ou bot](acoes/p02-handoff-set.md) | HTTP | `PATCH conversations/:id/handoff` | `inbox:conversations/write` |
| Operação do atendimento | [Transferir conversa entre workspaces](acoes/p02-workspace-transfer.md) | HTTP | `PATCH conversations/:id/workspace` | `inbox:assignment/write` |
| Vínculo CRM | [Vincular conversa à pessoa CRM](acoes/p02-crm-link.md) | HTTP | `PATCH conversations/:id/contact` | `crm:people/read + inbox:conversations/write` |
| Canais e eventos | [Solicitar histórico WhatsApp](acoes/p02-whatsapp-history.md) | HTTP | `POST conversations/:id/history` | `inbox:conversations/read + whatsapp:accounts/read` |
| Canais e eventos | [Simular mensagem de entrada](acoes/p02-simulation-inbound.md) | HTTP | `POST conversations/:id/simulator/inbound` | `inbox:simulation/write` |
| Tempo real | [Acompanhar alterações por SSE](acoes/p02-realtime-events.md) | HTTP | `GET events` | `inbox:conversations/read` |
| Canais e eventos | [Consumir evento WhatsApp recebido](acoes/p02-whatsapp-ingest-event.md) | Evento | `whatsapp.message.received.v2` | `service principal / contrato versionado, NÃO HTTP` |
| Vínculo CRM | [Consumir resolução de pessoa CRM](acoes/p02-crm-resolved-event.md) | Evento | `crm.person.resolved.v1` | `service principal / contrato versionado, NÃO HTTP` |

**Total:** 19 fichas; 17 HTTP; 2 consumidores sem endpoint HTTP. A coluna “contrato” é *relativa* a `/v1/tenants/:tenantId/inbox` quando HTTP.

## 2. Funcionalidades, dependências e ownership

| Grupo | Resultado / responsabilidade | Dependências |
|---|---|---|
| Fila e indicadores | listar, filtrar, pesquisar e medir fila | PostgreSQL, Kernel, FGA, memberships |
| Conversas | criar, consultar, marcar estado/favorito/lida | InboxService, PgInboxRepository, Tenant DB |
| Mensagens e notas | listar, responder e inserir nota interna | Inbox e WhatsAppReply opcional |
| Operação do atendimento | atribuição, handoff e transferência de workspace | Workforce P04, guard escopado |
| Vínculo CRM | relacionar Person existente / consumir resolução versionada | CRM P01, política de identidade |
| Canais e eventos | simulação, solicitação histórica e mensagem WhatsApp consumida | WhatsApp P03 e Event Bus C06 |
| Tempo real | SSE com invalidação scoped e reconsulta REST | InboxChangeBus em memória do Host |

O funil, protocolo, etapas e Kanban pertencem ao P05 Gestão de Atendimentos, **não** ao Inbox. O manager não recebe acesso a dados de tenant automaticamente.

## 3. Matriz de autorização do código (não são grants provisionados)

| Recurso | Ação | Superfícies |
|---|---|---|
| `inbox:conversations` | `read` | lista, detalhe, stream SSE, histórico WA antes do gate adicional |
| `inbox:conversations` | `write` | criação, status, handoff, favorito, marcar lida, vínculo CRM |
| `inbox:messages` | `read` | listagem de mensagens |
| `inbox:messages` | `write` | resposta local ou enfileiramento WhatsApp |
| `inbox:notes` | `write` | nota interna |
| `inbox:assignment` | `write` | ator que atribui/transfere; P02-ASSIGN-01 também exige P04 `admin/editor` ativo para o destinatário |
| `inbox:simulation` | `write` | mensagem simulada; não webhook público |
| `inbox:metrics` | `read` | métricas agregadas |
| `crm:people` | `read` | vínculo manual com pessoa CRM |
| `whatsapp:accounts` | `read` | solicitação de histórico WA, condicionada ao port |

A lista é retirada de `src/service.ts`, `src/inbox.controller.ts` e `src/plugin.ts`; **não extrapolar** para actions `assign`/`reply` mencionadas em README legado. Consumidores usam service principal e política de assinatura própria, não autorização HTTP de operador.

## 4. Dados e migrations

| Domínio | Evidência no código | Estado |
|---|---|---|
| `inbox_conversations` | `sql/001_inbox_foundation.sql` e `postgres.ts` | Base versionada; aplicação desconhecida |
| `inbox_messages` | `sql/001_inbox_foundation.sql` e consumer WA | Base versionada; colunas provider/source precisam de migration |
| `inbox_events` | `sql/001_inbox_foundation.sql` e repo | Auditoria append em código; operação não homologada |
| `platform_*`, `crm_people` | referências externas de Organizations/CRM | Não atribuir ao P02 |
| `whatsapp_*` | rotas/eventos P03 | Não atribuir ao P02 |

[Inventário técnico detalhado](INVENTARIO-TECNICO.md) e [diagramas](DIAGRAMAS.md). **A migration 001 não contém todos os campos utilizados pelo código atual**, portanto um deploy requer reconstruir a cadeia de migrations 002 e demais owners, backfill e restore antes de qualquer ativação.

## 5. Contratos assíncronos e SSE

| Origem / destino | Contrato | Comportamento de código |
|---|---|---|
| P03 WhatsApp → P02 Inbox | `whatsapp.message.received.v2` | consumer no tenant tx, dedup por hash e escopo |
| P02 Inbox → C06/CRM P01 | `inbox.participant.observed.v1` | publisher somente quando participante aplicável |
| CRM P01 → P02 Inbox | `crm.person.resolved.v1` | revalida política, bloqueia conflito, vincula |
| P02 → navegador | `GET /events`, `changed` | invalidação sem conteúdo/PII, snapshot reconsultado em API |

**Não confundir** SSE efêmero em memória de um Host com Platform Event Bus persistido em outbox/transação. Worker opt-in e cutover WA não foram homologados.

## 6. Matriz de diagramas existentes

| Tipo | Representação | Status |
|---|---|---|
| C4 simplificado | Workspace → Host → Guard/FGA → Service/Repo → Tenant DB | Desenho documental do código |
| Sequência de negócio | conversa, atribuição, resposta, reconsulta SSE | Desenho, sem E2E real |
| Fluxo de eventos | WhatsApp v2 → Inbox → participant observed → CRM resolved → Inbox | Opt-in, operação pendente |
| Boundary de confiança | tenant/organization/workspace, grants, DB resolver, FGA | Negativas reais pendentes |
| ERD | três tabelas base + dependências externas (sem reivindicar colunas posteriores) | SQL 001 identificado |

[Diagramas versionados](DIAGRAMAS.md). Não criar falsos diagramas de runtime/produção.

## 7. Próximos testes e decisões

**Fontes de paridade e riscos reais:** [PARIDADE-CODIGO.md](PARIDADE-CODIGO.md). P02-ASSIGN-01 adiciona verificação atômica de membership ativa do destinatário na org/workspace atuais, sem duplicar o diretório P04. Ainda é preciso conciliar a substituição manual CRM, os grants reais de destinatários e a migração dos ambientes.

| Prioridade | Pendência | Critério de fechamento |
|---|---|---|
| P0 | Reconciliar 001 + migrations de escopo e WhatsApp | SHA de cada migration, pré-requisitos, execução descartável/restore |
| P0 | Testar acesso JWT, grants e tenants A/B com org/workspace | PASS/FAIL por ação e ambiente, sem bypass Manager |
| P0 | Fazer fluxo WhatsApp → Inbox → CRM com worker controlado | Idempotência, replay, revisão e autoria do evento validados |
| P0 | Comprovar reply/histórico pelo port WhatsApp | Provider, outbox, erro e delivery status, sem confundir “enfileirado” com “entregue” |
| P1 | Validar UI `apps/workspace-web` mobile com usuário real | fila/contato/atribuição/resposta, SSE e fallback |
| P1 | Operar SSE em múltiplas réplicas | broker compartilhado ou restrição explícita de implantação |
| P1 | Runbook: rollback, backups, observabilidade | Evidência de ensaio, SLO e responsável |

**Prioridade seguinte sugerida:** P02-VAL-01 (não atribuído/aprovado): auditoria funcional com IAM real e isolamento por escopo, antes de qualquer mudança de código. [WBS](EVOLUCAO.md) e [STATUS](STATUS.md).
