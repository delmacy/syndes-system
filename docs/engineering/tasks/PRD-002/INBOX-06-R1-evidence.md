# INBOX-06-R1 — Evidência de fechamento do Product Gate PRD-002

- **Data:** 2026-10-29 (execução local)
- **Natureza:** evidência de execução para decisão do Product Gate PRD-002 (Inbox integrado), **não** é aceite. O aceite cabe ao coordenador/Codex; não há autoaceite.
- **Branch/HEAD:** `work/prd-001-core-crm-sprint-0`, HEAD `7fa5cbdbfca90bb249736f292c76288e0e1c19c0`.
- **Ambiente:** Windows / PowerShell, Node `v24.19.0`, npm `12.2.0`; PostgreSQL 17 descartável em `127.0.0.1:54331`, usuário `api_ci`, banco `postgres`; `psql` não está no PATH — verificações via `node -e "require('pg')…"` / Jest.
- **Variáveis de integração:** `CONTROL_PLANE_DATABASE_URL` e `TENANT_ADMIN_DATABASE_URL` = `postgresql://api_ci@127.0.0.1:54331/postgres` (cluster descartável, apenas este job).
- **Restrições respeitadas:** nenhum commit/push, nenhuma alteração de source/config/lockfiles/migrations, nenhum provider real (WhatsApp/email/AI), nenhum E2E destrutivo contra banco compartilhado, nenhuma seleção de tenant pelo cliente. A implementação Inbox está **não rastreada** (`?? apps/api/src/modules/inbox/`).
- **Artefatos resultado neste diretório:** `INBOX-06-R1-evidence.md` (este), `INBOX-06-R1-lint-output.txt`, `INBOX-06-R1-typecheck-output.txt`, `INBOX-06-R1-jest-unit-output.txt`, `INBOX-06-R1-jest-membership-output.txt`, `INBOX-06-R1-jest-integration-output.txt`, `INBOX-06-R1-vitest-web-output.txt`, `INBOX-06-R1-web-lint-output.txt`, `INBOX-06-R1-pg-probe-output.txt`.

---

## 1. Resumo executivo

A árvore local contém a implementação completa do módulo Inbox (`apps/api/src/modules/inbox/`), anteriormente não rastreada, com rotas congeladas sob `/api/v1/inbox/conversations` (não stubs), persistência Drizzle via `TenantContext` server-side, `customer_scope` (`cpf`/`pj`/`both`) com fail-closed, assignment por membro ativo do mesmo tenant, status `open`/`pending`/`resolved`, resposta pública com `Idempotency-Key`, nota privada sem outbound, canal fake determinístico, anexos privados e realtime autenticado.

Os checks locais executados nesta rodada passaram:
- lint API (inbox): OK, 0 erros/0 warnings
- typecheck API (`tsconfig.build.json`): OK
- Jest inbox unit (8 suítes): 69 testes passando
- Jest membership (2 suítes): 30 testes passando
- Jest integração PostgreSQL descartável (inbox): 9 testes passando em `127.0.0.1:54331`
- Vitest web `inbox-workspace.spec.tsx`: 16 testes passando
- lint web (inbox): OK, exit 0

Pontos ainda não atendidos para `ACEITO`: a entrega está **não rastreada** (sem commit/CI desta árvore), não há script Playwright headless da jornada Inbox, e não há drill de backup/restore de anexos executado. Não há evidência de CI verde para esta árvore.

**Decisão recomendada:** `CORREÇÕES NECESSÁRIAS` (ver seção 8). Não é `ACEITO` porque CI relevante verde e rastreamento/commit estão ausentes; não é `BLOQUEADO` porque o ambiente PostgreSQL está disponível e a integração passa.

---

## 2. Escopo, método e limites

**Lido antes da execução (exigência da task):**
- `INBOX-06-integrated-acceptance.md`, `INBOX-06-R1-gate-closure.md`, `INBOX-06-preflight-report.md`
- `INBOX-02-R2-report.md` (evidência da API central), `INBOX-02-R3-api-restoration.md`
- `INBOX-01-membership-lifecycle.md`, `INBOX-03-channel-fake.md`, `INBOX-04-realtime-attachments.md`, `INBOX-05-nextjs-inbox.md`, `INBOX-05-outcome.md`
- `docs/product/PRD-002-INBOX-SPEC.md`, `docs/engineering/PRD-002-INBOX-SPRINT-PLAN.md`
- `docs/engineering/tasks/PRD-002/README.md`, `docs/engineering/tasks/PRD-002/RESUME-2026-10-28.md`
- `AGENTS.md` raiz e `modules/*/AGENTS.md`

**Limites respeitados:**
- Nenhuma alteração em `src/**`, configuração, `.env`, `package.json`, lockfiles ou migrations.
- Nenhum teste destrutivo contra banco compartilhado; suíte CRM Core completa não executada.
- E2E/Playwright não executado (opt-in; script Inbox inexistente).
- Nenhum provider real utilizado.
- Nenhuma correção de código aplicada; gaps listados como follow-up.

---

## 3. Comandos executados e resultados exatos

Todos executados em `apps/api` salvo indicação.

| # | Diretório | Comando | Resultado |
|---|-----------|---------|-----------|
| 1 | `apps/api` | `npx eslint "src/modules/inbox/**/*.ts"` | **OK** — 0 erros, 0 warnings (exit 0) |
| 2 | `apps/api` | `npm run typecheck` (`tsc --noEmit -p tsconfig.build.json`) | **OK** — sem saída/erros (exit 0) |
| 3 | `apps/api` | `npx jest <8 suítes inbox>` | **OK** — `Test Suites: 8 passed, 8 total`; `Tests: 69 passed, 69 total` (5.241 s) |
| 4 | `apps/api` | `npx jest <memberships.controller.spec.ts tenant-membership.service.spec.ts> --runInBand` | **OK** — `Test Suites: 2 passed, 2 total`; `Tests: 30 passed, 30 total` (2.679 s) |
| 5 | `apps/api` | `$env:CONTROL_PLANE_DATABASE_URL='postgresql://api_ci@127.0.0.1:54331/postgres'; $env:TENANT_ADMIN_DATABASE_URL='postgresql://api_ci@127.0.0.1:54331/postgres'; npx jest "src/modules/inbox/inbox.postgres.integration.spec.ts" --runInBand` | **OK** — `Test Suites: 1 passed, 1 total`; `Tests: 9 passed, 9 total` (6.234 s). Aviso pré-existente: "Jest did not exit one second after..." (harness, não regressão). |
| 6 | `apps/web` | `npx vitest run src/modules/inbox/inbox-workspace.spec.tsx` | **OK** — `Test Files 1 passed (1)`; `Tests 16 passed (16)` (6.78 s) |
| 7 | `apps/web` | `npx eslint --no-cache src/modules/inbox/` | **OK** — exit 0 (execução limpa, sem cache) |
| 8 | raiz | `Test-NetConnection 127.0.0.1 -Port 54331/5433/5432` | `54331: True`; `5433: True`; `5432: False` |

**Nota:** comandos de tipocheck/build/web e `npm run test:unit` completo (33 suítes/207 testes) foram relatados verdes no preflight INBOX-06 e no INBOX-05-outcome, mas não reexecutados integralmente nesta rodada (consistência com árvore não rastreada; CI desta árvore ainda não rodou).

---

## 4. Matriz requisito → source → teste → evidência (PRD-002 completo)

Legenda: **OK** = provado por teste executado nesta rodada; **OK (prévio)** = verde em relatório anterior (INBOX-02-R2 / INBOX-05-outcome / preflight); **GAP** = ausente ou não demonstrado; **NÃO PROVADO** = depende de ambiente/E2E não executado.

| # | Requisito (PRD-002) | Source | Teste | Evidência nesta execução | Situação |
|---|---------------------|--------|-------|--------------------------|----------|
| 1 | Tenant/database resolvidos server-side; cliente não escolhe tenant | `TenantContextGuard`, `tenantOf`, `inbox.module.ts` (DI sem tenant do cliente) | `inbox.postgres.integration.spec.ts`, `identity-guards` | 401 sem identidade; 400 `bad_request` com seletores `tenantId`/`databaseName`; 404 sem roteamento | OK (prévio) + integração 9/9 |
| 2 | Fila compartilhada, paginação/filtros, estados | `conversations.service.ts` + `conversations.controller.ts` (`api/v1/inbox/conversations`) | `conversations.service.spec.ts` + integração | 200 com `page/pageSize/total`; filtro `status`/`channel`; ordem `updated_at DESC, id ASC` | OK (69 testes inbox) |
| 3 | Detalhe da conversa + dados CRM autorizados | `conversations.service.ts` (`toConversationResource`) | `conversations.service.spec.ts` + integração | 200 com `person`/`organization`/`subject`/`customerId`/`unreadCount`/`preview`; sem vínculo 200 admin / 404 membro | OK (69 testes inbox) |
| 4 | Histórico mesclado ordem `(created_at, id)`, cursor id | `messages.service.ts` (união SQL + cursor) | `messages.service.spec.ts` + integração | timeline inbound→note→outgoing; cursor microssegundos; cursor desconhecido → 404 `inbox_message_cursor_not_found` | OK (69 testes inbox) |
| 5 | Resposta pública + `Idempotency-Key` + entrega honesta | `messages.service.ts` + `ChannelOutboundService` | `messages.service.spec.ts` + integração | `pending` sem adapter; `failed` → `success:false` + `error:'delivery_failed'`; replay mesmo `messageId`; body vazio/chave ausente → 400 | OK (69 testes inbox) |
| 6 | Nota privada separada, nunca enviada ao canal | `notes.service.ts` (sem canal); `inbox_private_notes` | `notes.service.spec.ts` + integração | nota em `inbox_private_notes`, `deliveryStatus` ausente, 0 linhas `inbox_messages` com corpo da nota | OK (69 testes inbox) |
| 7 | Assignment membro ativo mesmo tenant; negação auditada | `assignment.service.ts` + `InboxMembershipPort` (Control Plane) | `assignment.service.spec.ts` + integração; `memberships.controller.spec.ts` | admin atribui ativo; membro self-assigna/release; par → 403 `forbidden`; estrangeiro/inativo/revogado → 400 `validation_failed` `not_active_member`; auditorias `success`/`denied` | OK (69 inbox + 30 membership) |
| 8 | Status `open`/`pending`/`resolved`; transições auditadas | `status.service.ts` + constraint `inbox.schema.ts` | `status.service.spec.ts` + integração | 3 transições → 3 auditorias `inbox.conversation.status.changed`; inválido `closed` → 400 | OK (69 testes inbox) |
| 9 | Isolamento cross-tenant A/B (todas as rotas) | roteamento `TenantContext` (banco por tenant) | `inbox.postgres.integration.spec.ts` | 404 `inbox_conversation_not_found` em todas as rotas do tenant A a partir do tenant B; contagens inalteradas | OK (integração 9/9) |
| 10 | Auditoria sem conteúdo (mensagem/nota/corpo) | `InboxAuditWriter` (Control Plane `audit_events`) | `inbox-audit.spec.ts` + integração | `payload` nunca contém corpos; apenas ids/tenant/ação/resultado | OK (69 testes inbox) |
| 11 | Anexos privados, allowlist/limite, download autorizado | `attachments/*` (config, storage, validation, service, controllers) | Nenhum teste backend Inbox presente | typecheck/lint/build verdes; sem execução funcional | GAP |
| 12 | Realtime autenticado, escopo por evento, sem replay, reconnect via REST | `realtime/*`; BFF sem upgrade WS (fallback refetch) | Nenhum teste backend Inbox presente | source implementado; BFF limitação documentada (G9) | NÃO PROVADO |
| 13 | Canal fake determinístico; dedupe/ordenação/retry/delivery | `channel/*`; índice único parcial `(source_channel, external_id)` | Nenhum teste backend Inbox presente | source implementado; sem prova de idempotência/retry em execução | NÃO PROVADO |
| 14 | Grant/revoke membership + auditoria (INBOX-01) | `memberships.controller.ts`; `tenant-membership.service.ts` | `memberships.controller.spec.ts` + `tenant-membership.service.spec.ts` (30) | 30/30 verdes; PG integration não executada nesta rodada | OK (unit 30) |
| 15 | `customer_scope` `cpf`/`pj`/`both` distinguidos (G6 corrigido) | `inbox-scope.ts` (`conversationScopeCondition`) | `inbox-scope.spec.ts` + integração | cpf = pessoa sem vínculo PJ; pj = org ou pessoa vinculada; both = pessoa ou org; default `1=0`; admin `undefined` | OK (69 testes inbox) |
| 16 | Conversa sem Person visível apenas a `tenant_admin` | `inbox-scope.ts` (admin → sem predicado; member → `EXISTS` relationship) | `inbox-scope.spec.ts` + integração | lógica presente; pessoa sem vínculo 200 admin / 404 membro | OK (69 testes inbox) |
| 17 | Duplicata/retry/atraso sem duplicar nem perder | `channel-ingress.service.ts`, índices únicos schema | Nenhum teste Inbox executado | sem prova de dedupe/ordenação | NÃO PROVADO |
| 18 | Anexos inválidos/cross-tenant/path traversal bloqueados | `attachments/*` | Nenhum teste Inbox executado | sem execução funcional | GAP |
| 19 | UI compartilhada admin/member, estados de erro/reconnect | `apps/web/src/modules/inbox/*` | `inbox-workspace.spec.tsx` (16) | 16/16 verdes; build web verde (prévio) | OK (componente) / integração não provada |
| 20 | Jornada demonstrável headless (fake inbound → … → reconnect) | — | Nenhum script Playwright Inbox | não executado; script inexistente | GAP |
| 21 | CI relevante verde, outputs revisados, logs sem secrets | workflows `api.yml`/`crm-acceptance.yml` | — | lint/typecheck/unit/build locais verdes; **sem run de CI desta árvore (não rastreada)** | GAP |
| 22 | Backup/restore de anexos (drill operacional) | `INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` | Nenhum drill executado | documentação presente; sem execução (data/tenant/amostra/resultado) | GAP |
| 23 | Teste de higiene de logs/segredos | `inbox-audit.ts` (sem conteúdo) | Nenhum teste automatizado de secrets | revisão de source apenas | GAP |

---

## 5. Lacunas reproduzíveis (gaps)

| ID | Gap | Reprodução | Impacto no gate |
|----|-----|------------|-----------------|
| G1 | Entrega **não rastreada** (sem commit/CI desta árvore) | `git status` mostra `?? apps/api/src/modules/inbox/` e migrations; nenhum commit/branch materializa a entrega | Critério "CI relevante verde" não atendido |
| G2 | Sem script Playwright headless da jornada Inbox | `apps/web/tests/acceptance/` contém apenas `core-crm.acceptance.spec.ts`; não existe script Inbox | Jornada demonstrável não executável |
| G3 | Sem drill de backup/restore de anexos | `INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` documenta procedimento, sem data/tenant/amostra/resultado | DoD operacional não demonstrado |
| G4 | Sem teste automatizado de logs sem secrets/tokens | `inbox-audit.ts` registra apenas IDs; nenhum teste de higiene de secrets | Revisão de segurança parcial |
| G5 | Realtime via BFF sem upgrade WebSocket (G9) | `/api/backend/[...path]` não faz upgrade WS; fallback refetch documentado | Aceite de "evento realtime" não demonstrável pelo frontend atual (decisão de gate) |
| G6 | Anexos/realtime/canal sem testes backend executáveis | source presente, sem specs de backend para attachments/realtime/channel | Prova funcional ausente |

Gaps G1–G4 são de **evidência/processo** (não de código quebrado). G5 é uma **limitação documentada** que requer decisão formal de gate.

---

## 6. Estado dos estados INBOX-01/03/04/05 e INBOX-02-R2

- **INBOX-01 (membership):** aceito/revisado; controller `core-crm/memberships` + `tenant-membership.service` com grant/revoke/audit; 30 testes unit verdes. PG integration de membership não executada nesta rodada.
- **INBOX-02-R2 (API central):** evidência de execução (não aceite); implementação local completa, 78 testes inbox (8 unit + integração) + integração 9/9, lint/typecheck/build verdes.
- **INBOX-03 (channel fake):** aceito; ingress com `TenantContext` confiável, idempotência por `(source_channel, external_id)`, fake adapter selecionado por `INBOX_CHANNEL_ADAPTER=fake` fora de produção.
- **INBOX-04 (realtime/anexos):** aceito/release; gateway WebSocket autenticado, anexos privados por tenant; backup/restore documentado mas sem drill.
- **INBOX-05 (frontend):** R1 corrigida; 10 arquivos/39 testes web verdes (Inbox 15/15), typecheck/lint/build verdes; gate Codex pendente; limitação WS documentada.
- **INBOX-02-R2 vs preflight INBOX-06 divergência:** o preflight reportou a superfície HTTP central como stub e sem testes backend, com base no estado rastreado em HEAD `7fa5cbd`. A árvore **local (não rastreada)** contém a implementação completa e os testes que passam (ver seção 3). Os gaps remanescentes são de rastreamento/CI/E2E/backup, não de ausência de código.

---

## 7. Revisão de segurança (resumo)

**Pontos comprováveis por source/unit executados:**
- BFF rejeita seletores de tenant em query/JSON/form; injeta bearer + assinatura de ingress server-side; target limitado ao origin da API.
- Controllers Inbox usam `IdentityAuthGuard` + `TenantContextGuard`; tenant/database de `tenantOf(request)`, nunca do cliente.
- Anexos: validação MIME/extensão/tamanho, storage privado por tenant, chave gerada pelo servidor, download reautorizado pela conversa, headers `no-store`/`nosniff`.
- Realtime: handshake reusa guards; hub revalida membership e `customer_scope` antes de cada entrega; revogação fecha socket; eventos carregam apenas pointers.
- Auditoria: `InboxAuditWriter` registra ids/tenant/actor/action/result, sem conteúdo.
- `customer_scope` fail-closed (`default → 1=0`); admin explícito sem filtro de scope.

**Não comprovados (impacto no gate):**
- Authz/isolamento dos endpoints centrais em PostgreSQL (coberto parcialmente pela integração 9/9, que inclui isolamento A/B).
- Prova executada de cross-tenant denial em anexos, attachment traversal, nota privada nunca chega ao adapter em retry real.
- Teste automatizado de ausência de tokens/secrets em logs (G4).

**Nenhum secret apareceu nos comandos/saídas desta execução.** O `.env` local contém apenas URL de manutenção sem senha (`api_ci@127.0.0.1:54331`).

---

## 8. Decisão recomendada e follow-ups

### Decisão: `CORREÇÕES NECESSÁRIAS`

Não é `ACEITO`: CI relevante verde para esta árvore está ausente (entrega não rastreada, sem commit, sem run de CI), jornada headless não executada e drill de backup/restore não feito. Não é `BLOQUEADO`: o ambiente PostgreSQL está disponível (`54331` reachable) e a integração Inbox passa 9/9; o código é real e não stub.

### Follow-ups propostos

| ID | Ação | Dono sugerido | Bloqueia reavaliação? |
|----|------|---------------|-----------------------|
| F1 | Commitar/rastrear a implementação Inbox e habilitar CI da árvore (`api.yml`/`crm-acceptance.yml`) | Coordenação | Sim |
| F2 | Executar CI completa desta árvore (lint, typecheck, unit, integration PG descartável) e anexar outputs | Coordenação/plataforma | Sim |
| F3 | Criar/executar script Playwright headless da jornada Inbox (login/seed isolados, JSON/logs por etapa, teardown seguro, sem secrets) — somente por gate explícito | Worker INBOX-05/06 | Sim |
| F4 | Executar drill de backup/restore de anexos e registrar data/tenant/amostra/resultado | Operação/plataforma | Sim (DoD operacional) |
| F5 | Adicionar teste automatizado de higiene de logs/segredos ao pacote de segurança do Inbox | Worker Inbox API | Não (recomendado) |
| F6 | Decidir formalmente sobre limitação realtime via BFF (aceitar fallback documentado ou implementar bridge WS server-side) | Codex/Produto | Sim (critério de aceite) |
| F7 | Executar `npm run test:unit` completo (33 suítes/207) e `npm run build` da API nesta árvore | Worker Inbox API | Sim |

### Próximo responsável

O coordenador/Codex decide a ordem e o despacho dos follow-ups (não há autoaceite deste worker). Após atender F1–F7 (ou subset autorizado), reavaliar para `ACEITO`/`CORREÇÕES NECESSÁRIAS`/`BLOQUEADO` com decisão explícita. Nenhum commit/push até a decisão `ACEITO`.
