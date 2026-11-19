# MO-REL-00 — reconciliação factual de baseline (2026-11-19)

**Estado:** EM EXECUÇÃO; aceite ainda não comprovado. **Produção:** `PRODUCTION_GATE=BLOCKED`. Esta matriz é uma fotografia de fontes consultadas via API GitHub, não uma attestation de ambiente, nem autorização para instalar migrations, ativar multi-org, alterar grants ou operar servidores.

## Identificação da baseline e evidências

- `main` consultada via API de commit (`fetch_commit(main)`): `ebc80fda0fb7fa13935c70ec773d9fb4d85451ab`. A baseline histórica da WBS era `1f9bb11068b177e1c9f3037b90795e1843d4bc0b` (merge PR #203); não confundir ambos os SHAs.
- A configuração `apps/core-host/config/modules.json` contém CRM, Inbox, WhatsApp, Organizations e Support, **não** contém `@syndes/service/plugin`. Logo, código de Service existente não comprova plugin instalado no Host operacional.
- `apps/core-host/src/iam07d-capability-catalog.ts` declara 19 capabilities (13 Inbox, 6 Service). O catálogo não é grant nem implantação.
- `modules/inbox/src/inbox.controller.ts` define `InboxHost`, hooks `SYNDES_IAM07D_OPS`, mutações com transação pinned e integração WhatsApp, mas há caminhos legacy e o `history_sync` está bloqueado em multi-org no contrato. O piloto não deve prometer sincronização histórica.
- PR [#197](https://github.com/delmacy/syndes-system/pull/197) merged `ab27577ed2f215db9489a5cbf8a9372e39febf9b`; PR [#202](https://github.com/delmacy/syndes-system/pull/202) merged `6594c5a4f7b1498c25c816d7dcc2ab90f112a315`; PR [#203](https://github.com/delmacy/syndes-system/pull/203) merged `1f9bb11068b177e1c9f3037b90795e1843d4bc0b`. O merge destes trabalhos não equivale a G-1 operacional.
- PR [#200](https://github.com/delmacy/syndes-system/pull/200) permanece **open**, `mergeable=true` na consulta, head `a9d9d53c33b480004e77d536b69e3baffc2953f8`; base SHA apresentado `b14041be2286f44fcb37912937814203b3a51e4a`, anterior à HEAD consultada. O [run 44431530383](https://github.com/delmacy/syndes-system/actions/runs/44431530383) é **success** nesse head, inclusive jobs `Regression / host`, `Regression / inbox`, `Regression / whatsapp-ts` e `Syndes CI Gate`; os jobs de identidade real de Support e Platform Manager estavam **skipped**. Não atestar esse CI como validação da futura merge SHA.
- Para `ebc80fd`, a consulta de runs vinculados ao commit pelo conector retornou lista vazia (limitação: consulta filtrada por runs PR). Os status de Vercel `syndes-docs-reader` e `syndes-system` são **failure** (build-rate-limit), o que não deve ser confundido com veredito do `Syndes CI Gate` nem ignorado como saúde geral.
- Issues revisadas: [#193](https://github.com/delmacy/syndes-system/issues/193), [#160](https://github.com/delmacy/syndes-system/issues/160), [#189](https://github.com/delmacy/syndes-system/issues/189), [#205](https://github.com/delmacy/syndes-system/issues/205)–[#211](https://github.com/delmacy/syndes-system/issues/211). Fonte normativa: WBS MO-REL e runbook de 2026-11-19; ADR IAM de 2026-11-18. Foram consultados AGENTS raiz, Inbox, CRM, WhatsApp e Service.

## Matriz de reconciliação e riscos

| Caminho / gate | Já existe (não recriar) | Risco/lacuna atual | Classificação verificável | Próxima evidência |
|---|---|---|---|---|
| G-1 Inbox mutações | 19 capabilities IAM07D; Inbox pinned com outbox para resposta WhatsApp; PR #203 merged | Cobertura Host de **todas** as rotas/identidades e operações de Service instalado não homologada em staging | IMPLEMENTED parcialmente / PROVEN operacional **não** | Matriz rota→capability→fence→tenant tx; HTTP real Keycloak/FGA/PG17 no Host |
| G-1 Service | PR #202 merged, plugin/SQL/installer candidatos | Config do Host não inclui Service; ENABLED, FGA e roles de staging ausentes | IMPLEMENTED candidato / DEPLOYED **não** | MO-REL-02 instalador e entitlements com E2E |
| G-2 CRM read/search/CSV | Módulo e guardas documentados nos AGENTS | Inventário linha a linha e dataset A/B para paginação/filtros/CSV faltam | PROVEN **não** | MO-REL-01 matriz controller→repository→query→negativo |
| G-2 Inbox read/get/SSE | Guard `InboxDefaultContextGuard`; SSE revalidation com ModuleAccess enforce | Prova integral de listas/mensagens/decoração, revogação e sem broadcast cruzado não consolidada | TESTED por componentes; PROVEN release **não** | MO-REL-01 leitura por ID B e stream A/B sob deny/outage |
| G-2 WhatsApp inbound/outbound/retry | PR #200 adiciona verificação de Organization ativa; CI head success | PR **não merged**; efeito externo durante archive concorrente não é reversível | TESTED no PR / INTEGRATED main **não** | Atualizar PR #200 sobre main e obter CI do novo SHA; revisar concorrência |
| G-2 Service/event_delivery workers | Service principal/grants FGA segregados documentados | Product Gate de despacho/fila não confirmado | PROVEN **não** | MO-REL-01/02 ensaio em backend real |
| G-3 org adicional | `iam-org-provisioning-operator.ts` e Control intents candidatos | Não confundir com criação de tenant/DB fundador; state em tabela inicial de gates está desatualizado | IMPLEMENTED candidato / DEPLOYED **não** | MO-REL-03 saga inicial e reconciliation |
| G-3 signup | UC e issue #189 | Tenant/DB iniciais, idempotency e wizard real ainda não aceitos | BLOCKED | MO-REL-03 backend e MO-REL-07 UI |
| G-4 | PG17 restore sintético tenant TOPO-05F | Falta restore staging Control+tenant+KC/FGA auditável e rollback multi-org | TESTED laboratório / PROVEN staging **não** | MO-REL-06 |
| G-5 SSE | `MultiOrgSingleHostLease` candidata com advisory lock Control | Single-host topology/deploy e producers externos não verificados | IMPLEMENTED / PROVEN ambiente **não** | MO-REL-04/05 |
| G-6 release | CI/CD DevServer01 existente | Não é pipeline de cutover SQL002 de produção; sem autorização GO | BLOCKED | MO-REL-08 após G-1..G-5 |

### Divergências textuais e decisão conservadora

1. O quadro inicial G-3 de `MULTIORG-RELEASE-SECURITY-GATES-20261118.md` diz **NÃO IMPLEMENTADA**, mas o mesmo documento registra TOPO-06B (saga de **Organization adicional**). Corrigir leitura para **componentes implementados em piloto; G-3 não aprovado**, mantendo bloqueado o signup inicial.
2. IAM07D possui catálogo e mutações integradas, mas não há prova de Service operacional no Host. Não traduzir `merged` para `DONE`.
3. `history_sync` tem capability declarada e comportamento **403 multi-org**. Decisão para o primeiro piloto: **manter 403 explicitamente, com UX e regressão negativa**, sem criar envio externo não durável. Formalizar nos testes MO-REL-01.
4. PR #200 possui CI verde no HEAD original e base defasada. Revalidar merge/novo SHA antes de integrar, e auditar os efeitos externos concorrentes.
5. A issue #193 contém nomenclatura histórica GATE-01..07; a WBS executável usa G-1..G-6. Usar WBS como mapa de estágios e preservar a rastreabilidade entre os itens, sem declarar antigos gates concluídos.

## Pendências para encerrar MO-REL-00

- [x] Consultar main, AGENTS relevantes, WBS/ADR, issues, PRs representativos, módulo ativo e CI do PR #200.
- [x] Registrar distinção entre código, teste descartável, CI do head, integração na main e operação.
- [x] Definir `history_sync` 403 no piloto, sem bypass de autorização.
- [ ] Completar inventário **exaustivo por arquivo/linha** de rotas GET/list/search/export/CSV, SQL filters, todos workers, callbacks e SSE a partir de leitura integral do código ou checkout local; a busca de código do conector não trouxe resultados, portanto não alegar análise exaustiva.
- [ ] Validar o novo merge base do PR #200 e Gate no SHA correspondente antes de merge.
- [ ] Publicar CI central verde para o PR deste inventário e sincronizar #205/#193 com link do run; só então avaliar aceite formal de MO-REL-00.

**Próxima entrega elegível:** MO-REL-01 (#206) após aceite MO-REL-00; MO-REL-03 (#189) também depende de 00. **Nenhuma mutação** em SQL002, realm, grants, secrets, servidor ou produção foi autorizada por este documento.


## Complemento auditado na HEAD `2d6eac02a14086bd940c2773bb9572363a418642` — rotas e ownership

Consultado `git/trees?recursive=1` via GitHub (2928 entries, `truncated=false`) e conteúdo-fonte dos controllers, repositories, workers e query scopes. Os pontos abaixo são **inventário estático**, não teste de integração.

| Superfície (arquivo e linhas) | Rotas/operações | Implementação e risco residual |
|---|---|---|
| CRM `modules/core-crm/src/crm.controller.ts:67-216` | 25 decorators: capabilities, people CRUD, CRM organizations CRUD, vínculos, tags, notas, channels, employees, timeline, duplicates, `imports/csv`, `exports/csv` | `postgres.ts` usa `crmOwnerQuery` com markers `/*ORG:...*/`; `scope-query.ts:16-32` nega query não escopada quando flag multi-org ativa. Exigir CSV/extra/relação A/B real e SQL002 removido **somente em laboratório**. |
| Inbox `modules/inbox/src/inbox.controller.ts:334-444` | 18 decorators: SSE, list/get/messages, create, claim, assign, status, handoff, transfer workspace, favorite, read, contact, history, reply, note, simulate, metrics | `postgres.ts` usa `inboxScopedQuery` com markers org+workspace; `scope-query.ts:13-27` nega ausência de scope. Controller faz `mutateExact` para ações finas; `requestHistory` chama `legacyWrite` e nega 403 em multi-org. Testar SSE reconnect, métricas, paginação/decoração e troca de workspace com A/B. |
| WhatsApp HTTP `modules/whatsapp/src/http.ts:96-199` | 11 decorators: list/get/create/pair/disconnect/enable/connect, contact-name, avatar, group GET/PATCH | Guard de Organization live no host; necessita testes por rota, IDs alheios, status e erro de provider. |
| WhatsApp ingresso `modules/whatsapp/src/inbound-http.ts:60-64` | `POST api/v1/internal/whatsapp/events/:tenantId` com Bearer de webhook e validação de envelope | **Falha identificada em main**: `inbound-http.ts:25-30` e caminho de duplicata `:39-41` exigem `service_enabled` e `platform_organization_id IS NOT NULL`, mas não verificam `platform_organizations.status='active'` nem workspace active. Um webhook pode inserir sob org arquivada. PR #200 corrige parte deste risco; não considerar protegido até merge+testes. |
| WhatsApp relay `modules/whatsapp/src/outbound-relay.ts:12-41` | `deliverNext` busca outbox em tenant, escolhe account, chama `gateway.sendQueued` e consulta status | **Falha identificada em main**: predicate `:20-32` não valida status active de Organization; antes da chamada externa `:36-41` existe janela de revogação. PR #200 implementa filtros, mas reconhece concorrência com envio externo in-flight. P0 MO-REL-01. |
| WhatsApp dispatcher `modules/whatsapp/src/dispatch-worker.ts:27-41` | tick percorre tenant_registry ativo e aciona projetor/relay | Escopo de admissão por tenant **não** substitui validação org/ws em cada efeito. Provar reprocessamento e archive entre pick e dispatch. |
| Service `modules/service-management/src/controller.ts:160-233` | 12 decorators: funnels read/publish, board, teams, attendances open/inspector/get/events/stage/assign/team/close | `service.ts:123-180,205-420` inclui WHERE tenant+org+ws e team checks; `controller.ts:85-120` contém paths exact pinned. **Plugin segue ausente** de `apps/core-host/config/modules.json`. Testar Host real, grants e installer staging. |
| Core `apps/core-host/src/main.ts:45-159` | healthz, readyz, modules config, authorization | Há `MultiOrgSingleHostLease` no composition root e `multiorg-single-host-lease.ts`; não há demonstração topológica staging. |

**Contagens de decorators observados:** CRM 25, Inbox 18, WhatsApp HTTP 11, WhatsApp internal 1, Service 12 = **67**; não equivale a 67 endpoints operantes, pois Service é opt-in e há subrouters de Organizations/Support e callbacks/event consumers fora deste subtotal. A próxima auditoria precisa ampliar a matriz a Organizations/Support/Go gateway e callbacks de eventos, com testes reais.

### Casos negativos mínimos vinculados aos caminhos

- CRM: ids de person/tag/org CRM de Platform Org B conhecidos por A; `GET people`, `GET people/:id`, `GET exports/csv`, `POST imports/csv`, paginação/duplicatas; nenhuma linha de B, escrita, contagem lateral ou erro revelador.
- Inbox: list/messages/metrics/SSE com A/B, transfer A1→A2 permitido somente com grants exatos; A→B negado; `history` 403 sem chamada gateway.
- WhatsApp: account de Org B arquivada e workspace inativa recusam webhook novo **e duplicate ack**, outbound novo e retry; archive entre seleção e chamada externa deve ser testado sem alegar atomicidade externa.
- Service: leitura de funil, board, attendance, events e alterações de equipe exigem tenant/org/ws/funnel coerentes; testar FGA deny, revogação antes/durante write, Control entitlement off e ausência de plugin.
- Reexecutar os casos com IdP/FGA indisponíveis e ledger de auditoria, especialmente em caminhos de workers sem JWT humano. Prova funcional só em MO-REL-01/02/05.

**Conclusão deste complemento:** inventário de controllers principais realizado, mas ainda não foi demonstrada cobertura de todos os endpoints/callbacks, nem testes de cenários A/B ou CI deste incremento. MO-REL-00 permanece **IN PROGRESS**, sem falso aceite.
