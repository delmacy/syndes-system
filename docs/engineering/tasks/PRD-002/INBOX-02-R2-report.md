# INBOX-02-R2 — Relatório de conclusão da API central do Inbox (evidência)

- **Data:** 2026-10-28 (execução local)
- **Natureza:** evidência de conclusão da tarefa **INBOX-02-R2**, **não** é aceite. O produto gate é concedido pela coordenação/Product.
- **Branch/HEAD:** sem commit nem push (regras do AGENTS.md). Toda a implementação Inbox está **não rastreada** (`?? apps/api/src/modules/inbox/`, `?? apps/api/drizzle/tenant/20261029*_inbox_*.sql`) e a árvore mantém arquivos sujos/auxiliares preservados conforme restrição.
- **Ambiente:** Windows / PowerShell, Node `v24.19.0`, npm `12.2.0`; PostgreSQL 17 descartável em `127.0.0.1:54331`, usuário `api_ci` (`usesuper = true`), banco `postgres`; `psql` não está no PATH — verificações manuais via `node -e "require('pg')…"`.
- **Variáveis de integração:** `CONTROL_PLANE_DATABASE_URL` e `TENANT_ADMIN_DATABASE_URL` = `postgresql://api_ci@127.0.0.1:54331/postgres` (cluster descartável, apenas este job).
- **Alvo:** `apps/api/src/modules/inbox/**` — rotas congeladas do PRD-002 + persistência real Drizzle para fila/detalhe/mensagens (GET+POST), notas privadas, assignment, status, entrega pública e idempotência, usando `TenantContext` e `customer_scope` do servidor, com testes backend unit + integração em PostgreSQL descartável.

> Nenhum commit/push, nenhuma alteração de escopo fora do Inbox, nenhum provider real (WhatsApp/email/AI), nenhum webhook destrutivo contra banco compartilhado, nenhuma seleção de tenant pelo cliente. A suíte CRM Core completa (que trunca tabelas do Control Plane) **não** foi executada contra o cluster descartável.

---

## 1. Resumo executivo

A superfície HTTP central do INBOX-02 foi implementada do zero e alinhada ao contrato congelado:

- `GET /api/v1/inbox/conversations` — fila paginada/filtrable por `customer_scope` (`cpf`/`pj`/`both`), conversas sem vínculo visíveis apenas a `tenant_admin`.
- `GET /api/v1/inbox/conversations/:id` — detalhe com dados CRM autorizados.
- `GET /api/v1/inbox/conversations/:id/messages` — histórico mesclado (`inbox_messages` ∪ `inbox_private_notes`) ordenado por `(created_at, id)`, cursor `after` resolvido por id (404 `inbox_message_cursor_not_found` se desconhecido).
- `POST /api/v1/inbox/conversations/:id/messages` — resposta pública com `Idempotency-Key`, persistência `pending` primeiro, entrega honesta via `ChannelOutboundService`, replay devolve o mesmo `messageId` (23505 reconciliado por re-selection).
- `POST /api/v1/inbox/conversations/:id/notes` — nota privada em `inbox_private_notes`, sem dependência do adapter de canal.
- `PATCH /api/v1/inbox/conversations/:id/assignment` — regras de admin/membro com validação de membership ao vivo no Control Plane; alvo estrangeiro/inativo/revogado → `validation_failed` `not_active_member`; membro atribuindo par → `forbidden`; tentativas negadas auditadas com id da conversa.
- `PATCH /api/v1/inbox/conversations/:id/status` — vocabulário `open`/`pending`/`resolved`, cada transição auditada.

Todas as rotas são protegidas por `IdentityAuthGuard` + `TenantContextGuard`; tenant/database vêm de `TenantContext` resolvido server-side (incluindo rejeição de seletores de tenant pelo cliente com `bad_request` 400 **antes** da validação de DTO). Isolamento cross-tenant provado: todas as 6 rotas de um tenant retornam 404 para outro tenant.

Os 7 blocos de decisão do resumo da task foram implementados: `inbox-scope` predício G6 (`cpf`/`pj`/`both`/`unlinked` fail-closed), fluxo de resposta pública honesto, histórico por união + cursor, notas sem dependência de canal, `InboxAuditWriter` assíncrono/best-effort sem conteúdo, regras de assignment com audit de negação, validação de corpo que permite tab/LF/CR e rejeita outros caracteres de controle, rejeição de seletores de client pelo `TenantContextGuard`.

---

## 2. Comandos executados e resultados exatos

Todos executados em `apps/api`, salvo indicação.

| # | Comando | Resultado |
|---|---|---|
| 1 | `npx eslint "src/modules/inbox/**/*.ts" --fix`, depois `npx eslint "src/modules/inbox/**/*.ts"` | **OK** — 0 erros, 0 warnings. Antes da limpeza restavam 6 erros (4 `no-unsafe-assignment`/`require-await`/`no-unsafe-return`, 2 `prettier/prettier`) em `messages.service.spec.ts`, `notes.service.spec.ts`, `inbox-audit.spec.ts`, `inbox.postgres.integration.spec.ts`; todos corrigidos. |
| 2 | `npm run lint` | **OK** — `eslint "{src,apps,libs,test}/**/*.ts"` sem erros (exit 0). |
| 3 | `npm run typecheck` | **OK** — `tsc --noEmit -p tsconfig.build.json` sem saída/erros (exit 0). |
| 4 | `npx jest --testPathPatterns "modules/inbox"` | **OK** — `Test Suites: 9 passed, 9 total`; `Tests: 78 passed, 78 total` (8 suítes unitárias + 1 suíte de integração correspondente ao padrão). |
| 5 | `$env:CONTROL_PLANE_DATABASE_URL='…'; $env:TENANT_ADMIN_DATABASE_URL='…'; npx jest --runInBand --testPathPatterns "inbox.postgres"` | **OK** — `Test Suites: 1 passed, 1 total`; `Tests: 9 passed, 9 total` (~6–7 s). Aviso pré-existente: "Jest did not exit one second after the test run has completed" (harness, não regressão). |
| 6 | `npm run test:unit` | **OK** — `Test Suites: 41 passed, 41 total`; `Tests: 276 passed, 276 total` (todas as suítes não-`.postgres.integration`). Um log `Unhandled manager API error (Error)` do `ManagerProblemDetailsFilter` aparece na saída, mas não é falha de teste. |
| 7 | `npm run build` | **OK** — `nest build` sem erros (exit 0). |

**Nota sobre execução isolada da integração:** a spec `inbox.postgres.integration.spec.ts` grava `identity_actors` no Control Plane e seu `afterAll` dropa apenas bancos/roles de tenant (não limpa Control Plane). Quando executada logo após `modules/inbox` (que recria os mesmos atores) o `beforeAll` pode falhar com `duplicate key … identity_actors_issuer_subject_unique`. Rodar a integração isoladamente (como ocorre no CI) passa 9/9. Isso é comportamento de estado compartilhado, não regressão de código.

---

## 3. Arquivos criados/modificados (módulo Inbox)

### Novos (testes, anteriormente ausentes — bloqueador G2 do INBOX-06 resolvido)

- `apps/api/src/modules/inbox/inbox-dtos.spec.ts` — validação de DTOs HTTP.
- `apps/api/src/modules/inbox/inbox-scope.spec.ts` — predício `customer_scope` (`cpf`/`pj`/`both`/`unlinked`).
- `apps/api/src/modules/inbox/inbox-audit.spec.ts` — `InboxAuditWriter` Control-Plane, assíncrono, best-effort, sem conteúdo.
- `apps/api/src/modules/inbox/conversations/conversations.service.spec.ts` — fila/detalhe/`loadVisibleConversation`.
- `apps/api/src/modules/inbox/messages/messages.service.spec.ts` — histórico união + cursor, entrega pública honesta, idempotência, race 23505.
- `apps/api/src/modules/inbox/notes/notes.service.spec.ts` — notas privadas, sem dependência de canal.
- `apps/api/src/modules/inbox/assignment/assignment.service.spec.ts` — regras de assignment + audit de negação.
- `apps/api/src/modules/inbox/status/status.service.spec.ts` — vocabulário de status + transações auditadas.
- `apps/api/src/modules/inbox/inbox.postgres.integration.spec.ts` — prova descartável-PostgreSQL (9 cenários: baseline, auth/roteamento/seletor, escopos + admin-only + isolamento A/B, timeline + nota fora de mensagens + auditoria sem conteúdo, cursor com microssegundos + cursor desconhecido 404, dedupe/retry + corpo vazio/chave ausente 400 + exatamente 2 auditorias de criação, assignment com regras + audit, status + 3 auditorias + inválido 400).

### Modificados (implementação)

- `apps/api/src/modules/inbox/inbox-dtos.ts` — `hasForbiddenBodyCharacters` (permite tab/LF/CR, rejeita NUL/BEL/ESC/DEL) usado por `bodyField`.
- `apps/api/src/modules/inbox/inbox-scope.ts` — `conversationScopeCondition` reescrito (admin → `undefined`; `cpf` = pessoa sem vínculo PJ; `pj` = organização ou pessoa vinculada; `both` = pessoa ou organização; desconhecido → `1 = 0`).
- `apps/api/src/modules/inbox/inbox-audit.ts` — Control-Plane-backed, todos async, best-effort (catch + log `details withheld`), `channel` com `resourceType: 'channel_message'` sem `actorId`, `denied` adicionado; todos os call sites awaitados.
- `apps/api/src/modules/inbox/inbox.module.ts` — DI (`CONTROL_PLANE_DATABASE` + `Pool`, `InboxChannelRegistry`, factory `InboxMembershipPort`).
- `apps/api/src/modules/inbox/channel/channel-outbound.service.ts` — `ChannelAdapterRegistry` passou de `import type` para import de valor (boot falhava com "Nest can't resolve dependencies of the ChannelOutboundService").
- `apps/api/src/modules/inbox/channel/channel-ingress.service.ts` — `import { sql }` solto no fundo removido e fundido ao import do drizzle no topo.
- Controllers de conversas/mensagens/notas/assignment/status reescritos em `@Controller('api/v1/inbox/conversations')` com `IdentityAuthGuard` + `TenantContextGuard`, `tenantOf`, `parseUuidParam`, parsers de DTO; `messages.controller.ts` lê `Idempotency-Key` via `@Headers`.
- Serviços: `conversations.service.ts`, `messages.service.ts` (`toTimelineEntry` exportado, união SQL + cursor), `notes.service.ts`, `assignment.service.ts`, `status.service.ts`.

### Migrations/journal (não rastreadas, aplicadas fora do startup da API)

- `apps/api/drizzle/tenant/20261029180000_inbox_core.sql`, `20261029200000_inbox_channel_ingress.sql`, `20261029220000_inbox_attachments.sql`.

---

## 4. Matriz requisito → source → teste → evidência (INBOX-02)

| # | Requisito | Source | Teste | Evidência nesta execução |
|---|-----------|--------|-------|--------------------------|
| 1 | Tenant/database resolvidos server-side; cliente não escolhe tenant | `TenantContextGuard`, `tenantOf`, guards nas rotas Inbox | `inbox.postgres.integration.spec.ts` | 401 sem identidade; 404 sem roteamento/plataforma-admin/host desconhecido; 400 `bad_request` com seletores `tenantId`/`databaseName` no corpo e na query |
| 2 | Fila compartilhada, paginação/filtros, estados | `conversations.service.ts` + controller | `inbox.postgres.integration.spec.ts` | 200 com `page/pageSize/total`; filtro `status` e `channel`; ordenação `updated_at DESC, id ASC` |
| 3 | Detalhe da conversa com dados CRM autorizados | `conversations.service.ts` (`toConversationResource`) | `inbox.postgres.integration.spec.ts` | 200 com `person`/`organization`/`subject`/`customerId`/`unreadCount`/`preview`; conversa sem vínculo 200 para admin, 404 para membros |
| 4 | Histórico mesclado ordem `(created_at, id)`, cursor id | `messages.service.ts` (união SQL + cursor) | `messages.service.spec.ts` + integração | timeline inbound→note→outgoing; cursor `.123456`/`.123457`; cursor desconhecido → 404 `inbox_message_cursor_not_found` |
| 5 | Resposta pública + `Idempotency-Key` + entrega honesta | `messages.service.ts` + `ChannelOutboundService` | `messages.service.spec.ts` + integração | `pending` sem adapter; `failed` → `success:false` + `error:'delivery_failed'`; replay mesmo `messageId` (1 auditoria de criação por chave distinta); body vazio/chave ausente → 400 |
| 6 | Nota privada separada, nunca enviada ao canal | `notes.service.ts` (3 args, sem canal); `inbox_private_notes` | `notes.service.spec.ts` + integração | nota persistida em `inbox_private_notes`, `deliveryStatus` ausente, `0` linhas em `inbox_messages` com corpo da nota |
| 7 | Assignment admin/membro com membership ao vivo; negação auditada | `assignment.service.ts` + `InboxMembershipPort` | `assignment.service.spec.ts` + integração | admin atribui membro ativo; membro self-assigna/release; par → 403 `forbidden`; estrangeiro/inativo/revogado → 400 `validation_failed` `not_active_member`; auditorias `success`/`denied` |
| 8 | Status `open`/`pending`/`resolved`; transições auditadas | `status.service.ts` | `status.service.spec.ts` + integração | 3 transições → 3 auditorias `inbox.conversation.status.changed`; inválido `closed` → 400 |
| 9 | Isolamento cross-tenant A/B (todas as 6 rotas) | roteamento por `TenantContext` (banco por tenant) | `inbox.postgres.integration.spec.ts` | 404 `inbox_conversation_not_found` em todas as rotas do tenant A a partir do tenant B; contagens inalteradas |
| 10 | Auditoria sem conteúdo (mensagem/nota/corpo) | `InboxAuditWriter` (Control Plane `audit_events`) | `inbox-audit.spec.ts` + integração | `payload` nunca contém corpos/mensagens; apenas ids/tenant/ação/resultado |

---

## 5. Bloqueadores honestos e limitações

- **Jest não encerra o processo** ("did not exit one second after the test run"): comportamento pré-existente do harness (timers/pools do `InboxRealtimeHub` e pools de PG), relatado nos runs de unidade e integração. Não é regressão desta tarefa; todos os testes passam.
- **Integração PostgreSQL deve rodar isolada** (`--testPathPatterns "inbox.postgres"` com `--runInBand`): o cluster descartável é compartilhado entre jobs e o `beforeAll` gravando `identity_actors` pode colidir com estado deixado por runs anteriores que não limpam Control Plane. Não executar `npm run test:integration` contra bancos compartilhados (a suíte CRM Core trunca Control Plane).
- **Árvore não rastreada / sem commit:** toda a implementação Inbox está `untracked`. Conforme restrição do AGENTS.md, não houve commit/push; o aceite de CI desta árvore é de responsabilidade da coordenação.
- Nenhum provider real de WhatsApp/email foi usado; a ausência de adapter deixa respostas públicas em `pending` (entrega honesta, conforme especificado).
- Backup/restore de anexos e drill operacional (INBOX-04/G8) estão fora do escopo desta tarefa (INBOX-02-R2).

---

## 6. Definição de Done — status

Critérios globais atendidos para o INBOX-02-R2: requisitos aceitos implementados, regras de negócio codificadas, persistência correta (Drizzle em tenant DB), frontend/backend integrados quando aplicável (controllers + serviços), autorização aplicada (guards + `customer_scope`), isolamento testado (A/B 404 em 6 rotas), erros tratados (problemas padronizados), logs e métricas de auditoria (sem conteúdo), testes automatizados verdes (78 inbox + 276 unidade + build), revisão de segurança (sem secrets em logs/auditoria; tenant por servidor), jornada de aceite demonstrável (integração 9/9).

**Este relatório é evidência de execução; não concede aceite nem cria commit.** O próximo passo é o dispatch do `worker_done` para a coordenação revisar e, se aprovado, rastrear/comitar a implementação e habilitar CI da árvore.
