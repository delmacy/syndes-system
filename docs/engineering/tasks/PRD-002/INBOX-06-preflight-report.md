# INBOX-06 — Evidência de pré-gate (Codex)

- **Data:** 2026-10-28 (execução local)
- **Natureza:** evidência de pré-gate, **não** aceite. Nenhum código, configuração ou lockfile foi alterado; o único arquivo escrito por esta execução foi este relatório.
- **Branch:** `work/prd-001-core-crm-sprint-0`
- **HEAD:** `7fa5cbdbfca90bb249736f292c76288e0e1c19c0`
- **Ambiente:** Windows / PowerShell, Node `v24.19.0`, npm `12.2.0`
- **Alvo:** implementação do PRD-002 (Inbox), testes e documentação existentes e harness PostgreSQL descartável.
- **Decisão recomendada:** **BLOQUEADO** (ver seção 8).

> Não houve commit, push, deploy, execução de E2E, provider real ou teste destrutivo contra banco compartilhado.

---

## 1. Resumo executivo

O código Inbox presente na árvore cobre apenas parte do PRD-002: schema/migrations, DTOs, contrato de canal + fake adapter, anexos e realtime têm implementação real; porém **a superfície HTTP central do INBOX-02 está em stub** — `GET /inbox/conversations` retorna `[]`, `GET /inbox/conversations/:id` retorna `{ id }`, e os controllers/services de mensagens, notas, assignment e status estão vazios e em rotas diferentes do contrato congelado. Não existe **nenhum** arquivo de teste backend do módulo Inbox na árvore, embora as revisões de INBOX-02/03/04 registrem execuções verdes (232, 270 e 355 testes de API; integrações 19/19, 25/25 e 13/13). A suíte atual reproduzível é menor que a registrada: **33 suites / 207 testes** de API (todos verdes) e **10 arquivos / 39 testes** web (todos verdes, Inbox 16/16).

Os checks de lint, typecheck, unit e build executáveis localmente passaram (API e web). Os checks de **migração/integração PostgreSQL não puderam ser executados**: o `.env` da API aponta para `127.0.0.1:54331`, que está com `ECONNREFUSED`; existe uma instância em `127.0.0.1:5433`, mas a autenticação configurada falha (`password authentication failed`). Docker, `psql` e `pg_isready` não estão disponíveis no PATH. Assim, as evidências de PostgreSQL para membership, isolamento cross-tenant, dedupe/ordenação, anexos e realtime permanecem **não comprovadas nesta execução**.

Consequência: os critérios de aceite do INBOX-06 (jornada demonstrável, matriz com authz/isolamento em PostgreSQL, CI verde e revisão de segurança) não podem ser satisfeitos com a árvore atual. A recomendação é **BLOQUEADO**, com follow-ups explícitos na seção 8 — nenhuma correção de fonte foi feita aqui.

---

## 2. Escopo, método e limites

**Lido antes da execução (exigência da task):**

- `docs/engineering/tasks/PRD-002/INBOX-06-integrated-acceptance.md`
- `docs/product/PRD-002-INBOX-SPEC.md`
- `docs/engineering/PRD-002-INBOX-SPRINT-PLAN.md`
- `docs/engineering/tasks/PRD-002/README.md`, `RESUME-2026-10-28.md`, INBOX-01..05
- `docs/engineering/TEST-STRATEGY.md`, `docs/engineering/REPOSITORY-STRUCTURE.md`
- `docs/engineering/INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md`
- `AGENTS.md` raiz, `modules/*/AGENTS.md` (todos os 12 módulos + `modules/README.md`) e `tests/AGENTS.md` + `tests/{integration,security,integrity,performance}/AGENTS.md`
- `INBOX-05-outcome.md`
- Workflows CI: `.github/workflows/{api,integrity,crm-acceptance}.yml`

**Limites respeitados:**

- Nenhuma alteração em `src/**`, configuração, `.env`, `package.json` ou lockfiles.
- Nenhum teste destrutivo contra banco compartilhado; a suíte CRM Core completa (que trunca tabelas do Control Plane) não foi executada.
- E2E/Playwright não executado (gate opt-in).
- Nenhum provider real (WhatsApp/email/AI) utilizado.
- Nenhuma correção de código foi aplicada; tudo o que exigiria mudança está listado como follow-up.

**Estado do repositório (fonte da evidência):**

- `git status` mostra a implementação Inbox inteira como **não rastreada**: `?? apps/api/src/modules/inbox/`, `?? apps/api/drizzle/tenant/20261029180000_inbox_core.sql`, `?? apps/api/drizzle/tenant/20261029200000_inbox_channel_ingress.sql`, `?? apps/api/drizzle/tenant/20261029220000_inbox_attachments.sql`, `?? apps/web/src/modules/inbox/`, `?? apps/web/src/app/inbox/`, `?? docs/engineering/tasks/PRD-002/`, `?? docs/product/PRD-002-INBOX-SPEC.md`, entre outros.
- Arquivos rastreados modificados incluem `apps/api/src/app.module.ts`, `apps/api/src/modules/core-crm/memberships/memberships.controller.ts`, `apps/api/src/modules/platform-core/identity/tenant-membership.service.ts`, `apps/api/package.json`/`package-lock.json`, `apps/api/drizzle/tenant/meta/_journal.json` e `modules/core-crm/AGENTS.md`.
- Não há branch, stash ou commit contendo uma versão alternativa do backend Inbox; o que existe é a árvore local acima.

---

## 3. Comandos executados e resultados exatos

Todos os comandos abaixo foram executados localmente, sem alterar fonte/configuração.

| # | Diretório | Comando | Resultado |
|---|---|---|---|
| 1 | `apps/api` | `npm run lint` | **OK** — 0 erros, 1 warning (`conversations.service.ts:39`, `@typescript-eslint/no-unsafe-argument`) |
| 2 | `apps/api` | `npm run typecheck` | **OK** — `tsc --noEmit -p tsconfig.build.json` sem saída/erros |
| 3 | `apps/api` | `npm run test:unit` | **OK** — `Test Suites: 33 passed, 33 total`; `Tests: 207 passed, 207 total`; 4.241 s |
| 4 | `apps/api` | `npm run build` | **OK** — `nest build` sem erros |
| 5 | `apps/api` | `npx jest src/modules/core-crm/memberships/memberships.controller.spec.ts src/modules/platform-core/identity/tenant-membership.service.spec.ts --runInBand` | **OK** — `Test Suites: 2 passed, 2 total`; `Tests: 30 passed, 30 total` |
| 6 | `apps/api` | `npm run test:integration` | **FALHA AMBIENTAL** — `Test Suites: 4 failed, 4 total`; `Tests: 52 failed, 52 total`; todas as falhas `connect ECONNREFUSED 127.0.0.1:54331` (`CONTROL_PLANE_DATABASE_URL` do `.env` local) |
| 7 | `apps/web` | `npm run lint` | **OK** — `eslint src` sem erros |
| 8 | `apps/web` | `npm run typecheck` | **OK** — `tsc --noEmit` sem erros |
| 9 | `apps/web` | `npm test` | **OK** — `Test Files 10 passed (10)`; `Tests 39 passed (39)`; 5.89 s |
| 10 | `apps/web` | `npx vitest run src/modules/inbox/inbox-workspace.spec.tsx` | **OK** — `Test Files 1 passed (1)`; `Tests 16 passed (16)` |
| 11 | `apps/web` | `npm run build` com envs de CI (`AUTH_SECRET`, `AUTH_URL`, `KEYCLOAK_ISSUER`, `KEYCLOAK_WEB_CLIENT_ID`, `KEYCLOAK_WEB_CLIENT_SECRET`, `SYNDES_API_URL`, `INGRESS_SIGNING_SECRET`) | **OK** — build de produção Next.js 16.4.3; rotas incluem `/`, `/crm`, `/inbox`, `/platform-admin`, `/api/backend/[...path]` |
| 12 | raiz | `bash tests/integrity/repository-structure.sh` | **FALHA DE AMBIENTE (CRLF)** — `set: pipefail: invalid option name`; com CR removido o conteúdo imprime `Repository governance structure: PASS` |
| 13 | raiz | probe Node/`pg` em `127.0.0.1:54331` / `:5433` / `:5432` | `54331` → `ECONNREFUSED`; `5433` → `SASL: SCRAM-SERVER-FIRST-MESSAGE: client password must be a string` / `password authentication failed for user "api_ci"`; `5432` → `ECONNREFUSED` |
| 14 | — | `docker ps`, `psql`, `pg_isready` | não disponíveis no PATH |
| 15 | — | Playwright/E2E Inbox | **não executado** (opt-in; nenhum script Inbox existe — ver G4) |

**Notas de leitura dos resultados:**

- O `npm run test:unit` executa todos os `*.spec.ts` que não contenham `.postgres.integration`; são exatamente os 33 arquivos de teste existentes fora das 4 specs de integração.
- O `npm run test:integration` falhou antes de qualquer efeito de banco porque a conexão administrativa não existe; **não** houve execução destrutiva.
- O warning de lint está em código Inbox e deve ser resolvido junto da implementação (follow-up).

---

## 4. Estado real da implementação (source audit)

### 4.1 Implementado de fato

| Área | Arquivos principais | Situação |
|---|---|---|
| Schema tenant + migrations | `apps/api/src/modules/inbox/inbox.schema.ts`; `apps/api/drizzle/tenant/20261029180000_inbox_core.sql`, `..._channel_ingress.sql`, `..._attachments.sql`; journal com `idx` 3–5 | migrations presentes e registradas; **não aplicadas/verificadas** nesta execução |
| DTOs/validação de contrato | `apps/api/src/modules/inbox/inbox-dtos.ts` (`parseInboxListQuery`, `parseCreateInboxMessageDto`, `parseIdempotencyKeyHeader`, etc.) | implementado, mas **não consumido** pelos controllers centrais (stubs) |
| Canal + fake adapter | `channel/inbox-channel.contracts.ts`, `inbox-channel.port.ts`, `inbox-channel-registry.ts`, `fake-channel.adapter.ts`, `channel-ingress.service.ts`, `channel-outbound.service.ts`, `inbox-inbound.service.ts`, `inbox-outbound.service.ts` | implementação substancial; sem testes presentes na árvore |
| Anexos | `attachments/inbox-attachment.config.ts`, `inbox-attachment.storage.ts`, `inbox-attachment.validation.ts`, `inbox-attachments.service.ts`, `conversation-attachments.controller.ts`, `attachments.controller.ts` | rotas `GET/POST /api/v1/inbox/conversations/:id/attachments` e `GET /api/v1/inbox/attachments/:id` implementadas; sem testes presentes |
| Realtime | `realtime/inbox-realtime.gateway.ts`, `hub.ts`, `authorizer.ts`, `session.ts`, `contracts.ts`, `dto.ts` | gateway WebSocket autenticado em `/api/v1/inbox/realtime`; sem testes presentes |
| Membership (INBOX-01) | `core-crm/memberships/memberships.controller.ts`; `platform-core/identity/tenant-membership.service.ts` | controller com grant/list/revoke/updateScope e validação runtime; service com INSERT/UPDATE + `audit_events`; unit verde (30 testes) |
| Auditoria/logs | `inbox-audit.ts` | registra IDs/tenant/actor/action/result; não registra corpos, nomes de arquivo, chaves ou tokens |

### 4.2 Stubs / ausente (bloqueadores)

| Rota do contrato PRD-002 | Estado na árvore |
|---|---|
| `GET /api/v1/inbox/conversations` | `conversations.controller.ts` → `list()` retorna `[]` |
| `GET /api/v1/inbox/conversations/:id` | `conversations.controller.ts` → `detail()` retorna `{ id }` |
| `GET /api/v1/inbox/conversations/:id/messages` | **não existe**; `messages.controller.ts` está vazio e montado em `/api/v1/inbox/messages` |
| `POST /api/v1/inbox/conversations/:id/messages` | **não existe**; `messages.service.ts` vazio (só injeta `TenantCrmDatabase`) |
| `POST /api/v1/inbox/conversations/:id/notes` | **não existe**; `notes.controller.ts` vazio em `/api/v1/inbox/notes`; `notes.service.ts` vazio |
| `PATCH /api/v1/inbox/conversations/:id/assignment` | **não existe**; `assignment.controller.ts` vazio em `/api/v1/inbox/assignment`; service vazio |
| `PATCH /api/v1/inbox/conversations/:id/status` | **não existe**; `status.controller.ts` vazio em `/api/v1/inbox/status`; service vazio |

O próprio `conversations.service.ts` se identifica como stub:

```ts
/**
 * INBOX-02 conversations service stub.
 *
 * Provides `loadVisibleConversation` used by attachments and realtime.
 * Full conversation queue/search logic lives in INBOX-02 slices.
 */
```

`conversations.service.ts` só implementa `loadVisibleConversation` (usado por anexos e realtime). Não há fila, paginação, filtros, detalhe, mensagens, notas, assignment nem status.

### 4.3 Divergência de contrato backend × spec × web

A UI e o relatório INBOX-05 consomem rotas aninhadas na conversa:

- `GET /inbox/conversations/:id/messages`
- `POST /inbox/conversations/:id/messages`
- `POST /inbox/conversations/:id/notes`
- `PATCH /inbox/conversations/:id/assignment`
- `PATCH /inbox/conversations/:id/status`

A árvore backend registra controllers vazios em `/api/v1/inbox/messages`, `/notes`, `/assignment`, `/status` (sem `:id` e sem handlers). Apenas anexos usam o path aninhado correto. Portanto, mesmo os testes de componente web (que mockam `fetch`) não provam integração real com a API.

---

## 5. Matriz requisito → source → teste → evidência

Legenda de situação: **OK (unit)** = provado por teste unitário executado agora; **PARCIAL** = source presente, sem prova executável; **FALHA** = contrato central ausente/stub; **NÃO PROVADO** = depende de PostgreSQL/E2E não executável aqui.

| # | Requisito (PRD-002 / INBOX-06) | Source | Teste existente | Evidência nesta execução | Situação |
|---|---|---|---|---|---|
| 1 | Tenant/database resolvidos server-side; cliente não escolhe tenant | `apps/web/src/app/api/backend/[...path]/route.ts`; `platform-core/identity/tenant-context.guard.ts`, `tenant-selector-input.ts`; `apps/web/src/lib/tenant-{selector,host}.ts` | `tenant-selector.spec.ts`, `tenant-host.spec.ts`, `ingress-signature.spec.ts`; `identity-guards.spec.ts`, `tenant-selector-input.spec.ts`, `trusted-ingress.spec.ts` | API unit 33/207 e web 10/39 verdes | OK (unit) |
| 2 | Fila compartilhada com paginação/filtros/estados | `inbox/conversations/conversations.controller.ts` (stub), `conversations.service.ts` (parcial) | Nenhum teste backend Inbox | `list()` retorna `[]` na árvore | **FALHA** |
| 3 | Detalhe da conversa + dados CRM autorizados | `conversations.controller.ts` (stub) | Nenhum teste backend Inbox | `detail()` retorna `{ id }` | **FALHA** |
| 4 | Histórico de mensagens em ordem determinística | `messages.controller.ts` vazio; `inbox.schema.ts` tem índices de ordem | Nenhum teste backend Inbox | Rota do contrato ausente | **FALHA** |
| 5 | Resposta pública + `Idempotency-Key` + status de envio honesto | `channel/inbox-outbound.service.ts` (dispatch existe); nenhuma rota | Nenhum teste backend Inbox | Rota `POST /:id/messages` ausente | **FALHA** |
| 6 | Nota privada separada e nunca enviada ao canal | `notes.controller.ts`/`notes.service.ts` vazios; `inbox-outbound.service.ts` só lê `inbox_messages` | Nenhum teste backend Inbox | Separação só em comentário/código de outbound | **FALHA** (rota) / **NÃO PROVADO** (isolamento) |
| 7 | Assignment para membro ativo do mesmo tenant, com scope | `assignment.controller.ts`/`service.ts` vazios; `inbox-membership.port.ts`, `tenant-membership.service.ts` | `memberships.controller.spec.ts`, `tenant-membership.service.spec.ts` (30 testes) | 30/30 verdes; rota de assignment ausente | **FALHA** (rota) / PARCIAL (membership) |
| 8 | Status `open`/`pending`/`resolved` e transições | `status.controller.ts`/`service.ts` vazios; constraint em `inbox.schema.ts` | Nenhum teste backend Inbox | Rota ausente; apenas constraint de schema | **FALHA** |
| 9 | Anexos privados com allowlist/limite e download autorizado | `attachments/*` (config, storage, validation, service, controllers) | Nenhum teste backend Inbox | typecheck/lint/build verdes; sem execução funcional | PARCIAL |
| 10 | Realtime autenticado, escopo por evento, sem replay, reconnect via REST | `realtime/*`; `docs/engineering/INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` | Nenhum teste backend Inbox | source implementado; BFF não suporta upgrade WS (G9) | PARCIAL |
| 11 | Canal fake determinístico; dedupe/ordenação/retry/delivery | `channel/*`; migrations de ingress; fake adapter selecionado por env | Nenhum teste backend Inbox | source implementado; sem prova de idempotência/retry | PARCIAL |
| 12 | Grant/revoke de membership existente + auditoria | `memberships.controller.ts`; `tenant-membership.service.ts` (INSERT/UPDATE + `audit_events`) | `memberships.controller.spec.ts` + `tenant-membership.service.spec.ts` (30) | 30/30 verdes; PG integration não executada | PARCIAL (unit OK; PG ausente) |
| 13 | `customer_scope` `cpf`/`pj`/`both` em leitura/escrita/evento | `inbox-scope.ts`; `crm-scope.ts`; `tenant-permissions.ts` | `crm-scope.spec.ts`, `tenant-permissions.spec.ts` | unit verdes; predicado Inbox não distingue `cpf` de `pj` (G6) | **CORREÇÃO NECESSÁRIA** |
| 14 | Isolamento tenant A/B; IDs de outro tenant = denied/not found | guards + `TenantCrmDatabase.withTenant`; `inbox-realtime.authorizer.ts` | specs unit de identidade/guardas; nenhum teste Inbox cross-tenant | unit verdes; sem prova Inbox em PostgreSQL | NÃO PROVADO |
| 15 | Conversa sem Person visível apenas a `tenant_admin` | `inbox-scope.ts` (admin → sem predicado; member → `EXISTS` relationship) | Nenhum teste Inbox | lógica presente; sem prova | PARCIAL |
| 16 | Duplicata/retry/atraso sem duplicar nem perder mensagem | `channel-ingress.service.ts`, `inbox-inbound.service.ts`, índices únicos no schema | Nenhum teste Inbox | sem prova de dedupe/ordenação | NÃO PROVADO |
| 17 | Anexos inválidos/cross-tenant bloqueados; backup/restore documentado | `attachments/*`; `INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` | Nenhum teste Inbox; nenhum drill de restore | documentação presente; sem execução | NÃO PROVADO / PENDÊNCIA OPERACIONAL |
| 18 | UI compartilhada admin/member, estados de erro/reconnect | `apps/web/src/modules/inbox/*`, `apps/web/src/app/inbox/page.tsx` | `inbox-workspace.spec.tsx` (16) | 16/16 verdes; build web verde | OK (componente) / integração não provada |
| 19 | Jornada demonstrável headless (fake inbound → … → reconnect) | — | Nenhum script Playwright Inbox (`tests/acceptance` só tem CRM) | não executado; script inexistente | **AUSENTE** |
| 20 | CI relevante verde, outputs revisados, logs sem secrets | workflows `api.yml`/`crm-acceptance.yml`; árvore não rastreada | — | lint/typecheck/unit/build locais verdes; **sem run de CI desta árvore** | NÃO PROVADO |

---

## 6. Lacunas explícitas

### G1 — API central do INBOX-02 em stub (BLOQUEADOR)
`conversations` (lista/detalhe), `messages` (GET/POST), `notes`, `assignment` e `status` não têm handlers; os services correspondentes são vazios. Sem isso, o critério “jornada demonstrável” do INBOX-06 e os aceites do INBOX-02 não podem ser verificados. Além disso, os paths dos controllers vazios divergem do contrato congelado e do cliente web.

### G2 — Nenhum teste backend Inbox na árvore (BLOQUEADOR)
Não existe nenhum `*.spec.ts` sob `apps/api/src/modules/inbox/**`. As revisões registram: INBOX-02 “38 suites/232 testes, integração 19/19”; INBOX-03 “10 suites/73 testes, API 43/270, integração 25/25”; INBOX-04 “50 suites/355 testes, 13/13 + 18/18 + 50/50”. A execução atual reproduz **33 suites/207 testes** de unidade e nenhuma suíte Inbox. O delta precisa ser reconciliado antes do gate; não há artefatos (logs/JSON) no repositório para essas execuções.

### G3 — PostgreSQL/migrations não executáveis nesta máquina (BLOQUEADOR DE EVIDÊNCIA)
`apps/api/.env` aponta para `postgresql://api_ci@127.0.0.1:54331/postgres`; a porta está fechada (`ECONNREFUSED`). A instância em `127.0.0.1:5433` recusa a credencial configurada. Docker/`psql`/`pg_isready` não estão no PATH. Portanto:
- migrations dos 3 arquivos Inbox a partir de banco vazio: **não executadas**;
- evidência PostgreSQL de membership (grant/revoke/audit/cross-tenant): **não executada** (a spec `crm-core.postgres.integration.spec.ts` cobre membership, mas não rodou);
- isolamento Inbox, dedupe/retry, anexos e realtime: **não executados**.
- O documento operacional INBOX-04 cita `inbox-realtime-attachments.postgres.integration.spec.ts`, que **não existe** na árvore.

### G4 — Sem script E2E Inbox (BLOQUEADOR DE ACEITE)
`apps/web/tests/acceptance/` contém apenas `core-crm.acceptance.spec.ts`. O INBOX-06 exige script Playwright headless com login/seed isolados, JSON/logs por etapa e teardown. Não há script nem artefatos Inbox.

### G5 — Implementação não rastreada (BLOQUEADOR DE CI)
Todo o Inbox (API, 3 migrations, web, docs PRD-002) está `untracked`. Não existe commit/branch que materialize essa entrega; consequentemente não há evidência de CI para esta árvore, e o critério “CI relevante verde” não pode ser considerado atendido.

### G6 — Predicado de `customer_scope` possivelmente incorreto (CORREÇÃO NECESSÁRIA)
`inbox-scope.ts` aplica o mesmo predicado `EXISTS (SELECT 1 FROM crm_relationships …)` para `cpf` e para `pj` (linhas 13–20), sem distinguir pessoa sem vínculo PJ (`cpf`) de organização PJ/contatos (`pj`). O CRM tem semântica distinta (`crm-scope.ts`). Isso pode expor ou ocultar conversas incorretamente e precisa de teste específico com os três escopos.

### G7 — Contrato de rotas divergente (CORREÇÃO NECESSÁRIA)
Rotas aninhadas exigidas pela spec/UI (`/conversations/:id/messages|notes|assignment|status`) não existem; controllers vazios usam `/inbox/messages`, `/inbox/notes`, `/inbox/assignment`, `/inbox/status`. A UI não pode operar contra a API real.

### G8 — Backup/restore de anexos sem drill (PENDÊNCIA OPERACIONAL)
O procedimento está documentado em `INBOX-04-REALTIME-ATTACHMENT-OPERATIONS.md` (snapshot conjunto DB+volume, restore isolado, verificação size/SHA-256 e downloads negados). Não há evidência de execução (data, tenant, amostra, resultado). O DoD operacional do INBOX-06 exige demonstrar antes de declarar concluído.

### G9 — Limitação realtime via BFF (LIMITAÇÃO REGISTRADA)
O BFF `/api/backend/[...path]` só implementa métodos HTTP (`GET/HEAD/POST/PUT/PATCH/DELETE`) e não faz upgrade WebSocket; o cliente web usa fallback `online`/`visibilitychange` + refetch REST (`inbox-workspace.tsx:172-177`). A limitação é honesta e documentada, mas o aceite de “evento realtime” na jornada permanece não demonstrável pelo frontend atual. Exige decisão de gate (aceitar fallback documentado ou prover bridge WS server-side).

### G10 — Itens menores (registro)
- Lint: 1 warning em `conversations.service.ts` (`no-unsafe-argument`).
- `npm run test:integration` não tem pré-condição clara de skip: falha ruidosa quando não há banco (52 falhas), em vez de indicar harness ausente.
- Documentação de estado inconsistente: `tasks/PRD-002/README.md` diz INBOX-01 “Em execução” e INBOX-05 “Em correção (R1)”, enquanto INBOX-02/03/04 constam aceitas; a árvore contradiz os aceites do backend. `INBOX-05-outcome.md` registra 15 testes Inbox; a execução atual tem 16.
- Não há teste automatizado de “logs sem tokens/secrets”; a revisão foi apenas de source (`inbox-audit.ts` registra IDs; gateways suprimem detalhes).

---

## 7. Revisão de segurança (resumo)

**Pontos positivos comprováveis por source/unit:**

- O BFF rejeita seletores de tenant em query, JSON e form (`route.ts:44-73`), injeta bearer + assinatura de ingress server-side e limita o target ao origin da API.
- Controllers Inbox usam `IdentityAuthGuard` + `TenantContextGuard`; tenant/database vêm de `tenantOf(request)`, nunca do cliente.
- Anexos: validação de MIME/extensão/tamanho, storage privado por tenant, chave gerada pelo servidor, download reautorizado pela conversa, headers `no-store`/`nosniff`.
- Realtime: handshake reusa guards; hub relê membership/escopo antes de cada entrega; revogação fecha socket; eventos carregam apenas pointers.
- Auditoria: `InboxAuditWriter` registra `code/type/id/tenantId/actorId/outcome`, sem conteúdo.

**Pontos não comprovados (impacto no gate):**

- Authz/isolamento dos endpoints centrais (fila, detalhe, mensagens, notas, assignment, status) não são testáveis porque os endpoints são stubs.
- Não há prova executada de cross-tenant denial em Inbox, dedupe/ordenação, attachment cross-tenant/traversal, nem de que nota privada nunca chega ao adapter em retry real.
- Sem PostgreSQL disponível, a matriz de segurança exigida pelo INBOX-06 permanece no papel.

**Nenhum secret apareceu nos comandos/saídas usados nesta execução.** O `.env` local contém apenas URL de manutenção sem senha (`api_ci@127.0.0.1:54331`).

---

## 8. Recomendação e follow-ups

### Decisão: **BLOQUEADO**

Motivos objetivos, na ordem do critério de aceite do INBOX-06:

1. A jornada exigida não existe na API atual (G1/G7): fila, detalhe, histórico, resposta, nota, assignment e status são stubs/ausentes.
2. Não há testes backend Inbox nem artefatos das execuções alegadas (G2).
3. As evidências PostgreSQL de membership, isolamento, dedupe, anexos e realtime não são executáveis neste ambiente (G3).
4. Não há script/artefato E2E Inbox (G4).
5. A entrega não está rastreada e não há CI desta árvore (G5).

Se a coordenação souber que a implementação completa existe em outra cópia/run, ela deve ser restaurada e re-submetida a este mesmo preflight; a decisão foi tomada estritamente sobre a árvore em `7fa5cbd` + estado local descrito na seção 2.

### Follow-ups propostos (não executados por este preflight)

| ID | Ação | Dono sugerido | Bloqueia reavaliação? |
|---|---|---|---|
| F1 | Implementar/restaurar a API central INBOX-02 (fila, detalhe, mensagens GET/POST, notas, assignment, status) e alinhar rotas ao contrato congelado | Worker Inbox API | Sim |
| F2 | Restaurar/criar as suítes backend Inbox e anexar logs das execuções (unit + integração descartável) | Worker Inbox API | Sim |
| F3 | Prover harness PostgreSQL descartável (porta 54331 ou documentar outra) e executar migrations do zero + `cp:migrations:verify` + `tenant:verify:provisioning` + `npm run test:integration` | Coordenação/plataforma | Sim |
| F4 | Produzir evidência PostgreSQL de membership (grant/revoke/audit/cross-tenant) | Worker INBOX-01 | Sim |
| F5 | Criar/executar o script Playwright headless da jornada Inbox com JSON/logs e teardown (somente no gate) | Worker INBOX-05/06 | Sim |
| F6 | Executar drill de backup/restore de anexos e registrar data/tenant/amostra/resultado | Operação/plataforma | Sim (DoD operacional) |
| F7 | Corrigir/validar o predicado `cpf` vs `pj` em `inbox-scope.ts` com testes dos três escopos | Worker Inbox API | Sim |
| F8 | Commitar/rastrear a implementação e habilitar CI da árvore | Coordenação | Sim |
| F9 | Resolver o warning de lint em `conversations.service.ts` | Worker Inbox API | Não (mas recomendado) |
| F10 | Decidir formalmente sobre a limitação realtime via BFF (aceitar fallback documentado ou implementar bridge WS) | Codex/Produto | Sim (critério de aceite) |
| F11 | Adicionar teste de higiene de logs/segredos ao pacote de segurança do Inbox | Worker Inbox API | Não (recomendado) |

**Próximo responsável:** coordenador/Codex decide a ordem e o dispatch dos follow-ups. Este relatório não concede aceite, não altera código e não cria commit.
