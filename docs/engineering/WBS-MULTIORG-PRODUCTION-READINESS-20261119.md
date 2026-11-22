# WBS executável — multi-org: homologação, signup e liberação controlada

**Programa:** MO-REL · **Baseline verificada:** `main` em `1f9bb11068b177e1c9f3037b90795e1843d4bc0b` (2026-11-19) · **Estado:** `PRODUCTION_GATE=BLOCKED`.
**Orquestração:** issue-mãe [#193](https://github.com/delmacy/syndes-system/issues/193), IAM [#160](https://github.com/delmacy/syndes-system/issues/160), signup [#189](https://github.com/delmacy/syndes-system/issues/189).
**Execução:** começar por [runbook do agente](./MULTIORG-AGENT-EXECUTION-20261119.md). **Esta WBS define escopo/critério, não atesta implantação.**

## 0. Inventário obrigatório e invariantes

Antes de começar, comparar esta WBS com a HEAD atual (o SHA acima é somente histórico); abrir/ler issues, PRs, logs e código. Atualizar status por evidências; não repetir trabalho já integrado, não tratar CI antigo como resultado de novo código. **Não** reescrever outra frente/worktree nem modificar funcionalidades além do gate selecionado.

Arquitetura irrenunciável:
- Um **tenant** = uma conta contratante + um database PostgreSQL; **N Platform Organizations** por tenant; **N Workspaces** por org; **N Service funis** por workspace (cada funil pertence a exatamente um workspace). `crm_organizations` é outro conceito.
- Keycloak 26.8.1 = identidade, credenciais, Organizations membership atual; Control = tenant/entitlement/vínculo Keycloak Organization ↔ Platform Organization; OpenFGA = grants finos por recurso/capability; tenant SQL = ownership, memberships operacionais, epoch/fence, audit/outbox; Core = enforcement. **Nunca** confiar no `tenantId`, database, org, ws ou autorização vindos somente do browser.
- `PRODUCTION_GATE=BLOCKED` e SQL002 em todos os bancos operacionais até gates G-1..G-6 comprovados. Instalações candidatas **não** são migrations automáticas.
- Sem credenciais admin no frontend, grants implicados por papéis amplos, permissões cruzadas Manager↔tenant, tokens inventados, remoção prematura do OpenFGA, nem “backup válido” só porque `pg_dump` executou.
- Novas operações devem falhar fechado em rede indisponível, FGA deny, vinculação Keycloak revogada, entitlement ausente, perda de lock/lease, escopo inválido e recuperação parcial.

### Realidade encontrada em 2026-11-19 — reconfirmar na execução

- PRs [#197](https://github.com/delmacy/syndes-system/pull/197), [#198](https://github.com/delmacy/syndes-system/pull/198), [#199](https://github.com/delmacy/syndes-system/pull/199), [#201](https://github.com/delmacy/syndes-system/pull/201), [#202](https://github.com/delmacy/syndes-system/pull/202) e [#203](https://github.com/delmacy/syndes-system/pull/203) integradas; a última tem CI central aprovado. IAM07D possui 19 capabilities exatas e pipelines de negócio Inbox/Service com transações pinned. Isto **não** prova todos os caminhos operacionais do Host ou seu deploy.
- [#200](https://github.com/delmacy/syndes-system/pull/200) **ainda aberta** na verificação: segurança de workers WhatsApp para Organization arquivada; confirmar CI, conflitos, merge e comportamento real antes de marcar G-2.
- `docs/engineering/MULTIORG-RELEASE-SECURITY-GATES-20261118.md` tem linhas iniciais desatualizadas em relação às seções posteriores (por exemplo, “saga não implementada”). Reconciliar a tabela e o status **sem transformar teste descartável em gate READY**.
- `apps/core-host/config/modules.json` **não** inclui `@syndes/service/plugin`; instalação/entitlement reais do Service continuam exigindo gate próprio.
- `modules/inbox/src/inbox.controller.ts` mantém `history_sync` negado (403) em multi-org: requer outbox de comando ou exclusão explícita e testada do piloto.
- `.github/workflows/syndes-core-host-devserver01.yml` publica para DevServer01 com controles específicos de SHA e recovery; **não** é CD multi-org de produção. `MultiOrgSingleHostLease` é uma medida para um único Core; validar topologia real.
- `apps/core-host/src/iam-org-provisioning-operator.ts` tem saga de **Organization adicional para tenant existente**; `docs/product/UC-SIGNUP-TENANT-ORGANIZATION-WORKSPACE-WIZARD-20261118.md` exige **criação inicial do tenant/DB**, que não pode ser confundida com essa saga.
- Migrations: Control `infra/postgres/bootstrap/control-iam07d-capabilities-010.schema`, tenant `modules/organizations/sql/010_iam07d_cutover_capabilities_candidate.sql`; `008` é instalador fence legado com SQL002 presente, `009` é instalador alternativo **pós-SQL002**, e `manual/activate_multiple_organizations.sql` é cutover operador-only. A ordem Control→tenant é importante para receipts de revogação.

## 1. Quadro de execução — apenas um estágio ativo por agente

| ID | Prioridade | Dependências | Entrega operacional | Gate | Estado inicial |
|---|---|---|---|---|---|
| MO-REL-00 | P0 | Nenhuma | Inventário de código, deploy, issues e matriz factual G-1..G-6 | Critérios reproduzíveis, riscos abertos explicitados | DONE — inventário factual #212/#213/#214; gates de produto continuam BLOCKED |
| MO-REL-01 | P0 | 00 | Auditar/corrigir isolamento em workers, ingress, exports, read/search, SSE e history_sync | G-2 + parte G-5 | IN_PROGRESS — WhatsApp #215 e CRM A/B CSV #216 integrados; workers/SSE/E2E ainda pendentes |
| MO-REL-02 | P0 | 00, 01 | Service opt-in em Host de staging, installer/Control ENABLED, FGA exato, IAM07D Control+tenant e least privilege | G-1/G-2 | IN_PROGRESS — Service opt-in + installer PG17 #217 integrados; Control/FGA/staging reais pendentes |
| MO-REL-03 | P0 | 00 | Signup backend: tenant+DB iniciais, founder, Org+Workspace, Keycloak+Control+FGA, saga retomável | G-3 | IN_PROGRESS — signup Control #218 e saga/SQL inicial/lock/finalização atômica #219 integrados; composição operacional E2E pendente |
| MO-REL-04 | P0 | 01, 02, 03 | Ambiente staging reproduzível, CI/CD e segredos/roles somente via Actions, Core singleton validado | G-3/G-5 | PROVEN no staging isolado — Core/Control/Keycloak/FGA persistente e deploy por Actions; aceite E2E/restore run 44988144506 |
| MO-REL-05 | P0 | 04 | E2E HTTP+DB+IdP+FGA+workers/streams, matriz negativa e concorrência de revogação | G-1/G-2/G-3/G-5 | PROVEN na fixture greenfield do staging — run 44988144506; G-1..G-6 globais ainda não aprovados |
| MO-REL-06 | P0 | 05 | Backup/restore + cutover SQL002 somente em staging; reconciliação Control/tenant/KC/FGA e rollback real | G-4 | PARCIAL — restore greenfield de cinco DBs + OpenBao; clone histórico sintético com cutover atômico, segunda org e backup compatível provados; reconciliação conjunta Control/tenant/KC/FGA pendente |
| MO-REL-07 | P1 | 03, 05 | APIs do signup e wizard responsivo integrados (somente funções reais) | Aceite UC-SIGNUP-01 | TODO |
| MO-REL-08 | P0 | 05, 06, 07 | Release piloto por tenant via GitHub Actions e aprovação explícita do operador | G-6 + Product Gate | BLOCKED |

`TODO` significa ausência de aceite específico **neste programa**, não inexistência de implementação anterior. No máximo **três entregas simultâneas**, porém um agente executa **uma por vez**. Cada uma requer PR próprio, CI central, evidências e atualização da WBS/issues.

### Tickets de execução (issues específicas; não duplicar signup)

| Etapa | Issue | Etapa | Issue |
|---|---|---|---|
| MO-REL-00 | [#205](https://github.com/delmacy/syndes-system/issues/205) | MO-REL-01 | [#206](https://github.com/delmacy/syndes-system/issues/206) |
| MO-REL-02 | [#207](https://github.com/delmacy/syndes-system/issues/207) | MO-REL-03 | [#189](https://github.com/delmacy/syndes-system/issues/189) (signup backend) |
| MO-REL-04 | [#208](https://github.com/delmacy/syndes-system/issues/208) | MO-REL-05 | [#209](https://github.com/delmacy/syndes-system/issues/209) |
| MO-REL-06 | [#210](https://github.com/delmacy/syndes-system/issues/210) | MO-REL-07 | [#189](https://github.com/delmacy/syndes-system/issues/189) (wizard + E2E) |
| MO-REL-08 | [#211](https://github.com/delmacy/syndes-system/issues/211) | Gate-mãe | [#193](https://github.com/delmacy/syndes-system/issues/193) |

**Política de execução:** MO-REL-03 e MO-REL-07 são duas entregas **distintas na mesma issue existente #189**. Não criar nova issue de signup; referenciar o subitem B/C ou D/E correspondente no PR e no comentário. As demais issues permanecem abertas até terem aceite factual. Não abrir todas as etapas em paralelo.

## 2. Pacotes de trabalho, testes obrigatórios e condição de saída

### MO-REL-00 — Reconciliação do baseline

**Arquivos principais:** `AGENTS.md`, AGENTS locais, issue #193, #160, #189, `MULTIORG-RELEASE-SECURITY-GATES-20261118.md`, `docs/engineering/WBS-KEYCLOAK-ORGANIZATIONS-CAPABILITIES-20261117.md`, `apps/core-host/config/modules.json`, `scripts/ci/plan.mjs`, workflows, PRs #200–203.

**Fazer:** inventário via `git grep`/source e READ-ONLY de endpoints, queries de ownership, workers, SSE e operações sinalizadas 403; reconciliar G-1..G-6 com commits e resultados reais; classificar cada item `IMPLEMENTED/INTEGRATED/TESTED/PROVEN/DEPLOYED/BLOCKED`. Verificar PR #200 e integrar somente após gate verde. Registrar evidências (SHA, job, markers, cenários); decidir piloto com `history_sync` 403 documentado ou implementar MO-REL-01 sem ampliar escopo silenciosamente.

**Saída:** inventário de rotas e contratos que evidencie o que falta, issue-mãe atualizada; nenhum SQL/realm operacional modificado.

### MO-REL-01 — Isolamento integral e efeitos externos

**Arquivos principais:** `modules/inbox/src/`, `modules/core-crm/src/`, `modules/whatsapp/src/`, `modules/whatsapp/gateway/whatsmeow/`, `packages/core-kernel/src/`, `packages/platform-events/` (se existir; descobrir owner real), `tests/platform/`.

**Fazer:** auditar rotas GET/list/search/export/CSV, CRM people/tags/channels, inbox events/SSE, contexto de mudanças entre Organizations, WhatsApp webhook, inbound projection, outbound relay, retries/dead-letter, consumer/service principals, suspensão de Org/Workspace, fuga de IDs e paginação antes de filtros; corrigir cada ponto com scopes de dados e grants. Para `history_sync`, escolher formalmente: `403` com teste+UX explícita para piloto **ou** comando persistido/idempotente com autorização atual no dispatch, reprocessamento seguro e auditoria, sem chamar o gateway dentro de tx.

**Testar:** ao menos 2 tenants, 2 orgs no mesmo tenant, 2 workspaces por org, revogações e retomada, consulta por ID conhecido de outro escopo, permutações de worker e erro de provider; negar sem efeito colateral quando org arquivada. Confirmar que processamento externo já iniciado não é falsamente apresentado como reversível.

**Saída:** matriz por endpoint/worker com teste CI e nenhuma rota tenant-wide em multi-org; política SSE single-host ou broker comprovada.

### MO-REL-02 — Service e IAM07D instalados e utilizáveis

**Arquivos principais:** `modules/service-management/`, `apps/core-host/config/modules.json`, `apps/core-host/src/module-host.ts`, `apps/core-host/src/service-release.ts`, `scripts/service-management/readiness_preflight.py`, `infra/postgres/bootstrap/`, `modules/organizations/sql/`, `catalog/iam-capabilities.v1.json`.

**Fazer:** ensaiar installer de Service 001–003, Workforce 007, catalog/entitlement Control ENABLED, grants FGA exatos por recurso/funil/equipe, memberships e callback pinned; alinhar modelo fine FGA. Executar primeiro Control IAM07D 010, depois tenant 010. Só inscrever plugin Service no perfil **especificamente autorizado** de staging, não generalizar globalmente ou adicionar menus falsos; preflight é read-only, não attestation de instalação.

**Testar:** operações HTTP reais do Service e Inbox, todos os grants/denials, bootstrap de Org, revisão de FGA coarse+fine, fail-closed ao remover cada privilégio e relançar depois de revogação; tenant com e sem Service habilitado.

**Saída:** Host de staging sobe com catálogo/instalação/entitlement coerentes; nenhum serviço administrativo ganha grants de atendimento implicitamente.

### MO-REL-03 — Signup tenant inicial (não apenas org adicional)

**Arquivos principais:** `docs/product/UC-SIGNUP-TENANT-ORGANIZATION-WORKSPACE-WIZARD-20261118.md`, `apps/core-host/src/iam-org-provisioning-operator.ts`, `apps/core-host/src/iam-org-provisioning-adapters.ts`, Control tenant registry, installer, organizações e issue #189.

**Fazer:** criar intenção de **tenant inicial** e ownership do fundador identificado por Keycloak; reservar tenant ID/DB internamente (browser jamais escolhe DSN), criar DB por instalador de privilégio mínimo, first Org Keycloak + primeira Platform Org + Workspace default (zero funis), link 1:1 Control, entitlements e **grants mínimos explícitos** FGA. Idempotency key e checkpoints duráveis. A saga de Organization adicional continua distinta. Controlar concorrência de duas abas; `ready` somente após prova de consistência, `reconcile_required` em erros.

**Testar:** perda da resposta de criação Keycloak/DB/FGA, replay, subject diferente, Manager token, founder não autorizado, suspensão e revogação após `ready` (não regrant), falhas parciais e retomada.

**Saída:** API/serviço backend com contrato estável e teste E2E real, sem UI ainda e sem credenciais fora do IdP.

### MO-REL-04 — Staging confiável e runner CI/CD

**Arquivos principais:** `.github/workflows/syndes-ci.yml`, `.github/workflows/syndes-core-host-devserver01.yml`, `scripts/deploy/`, `scripts/ci/` e runbooks de infra já existentes.

**Fazer:** definir staging segregado de produção com Keycloak, OpenFGA, Control, tenant PostgreSQL e Core/Service; segredos protegidos, client admin KC restrito, leitura por operador e privilégios SQL mínimos. GitHub Actions como único executante de provision/deploy; preflight read-only separado da etapa de alteração explicitamente aprovada. Fixar SHA e digests de imagem/migrations. Verificar singleton Core pela sessão PG e ausência de producers externos SSE não cobertos. Nenhum `ssh` de mutação manual ou `docker compose up` direto no servidor.

**Saída:** inventário e preflight automático rastreável em Actions, staging funcional, rollback de aplicação documentado; não produção.

### MO-REL-05 — Suite de homologação negativa e concorrente

**Fazer:** E2E em staging com Keycloak 26.8.1 real, Control/tenant PostgreSQL17, OpenFGA real e Host Nest real; duas identidades (incluindo mesmo subject em A/B), tenant A e B, Orgs A/B, Workspaces A1/A2/B1/B2 e funis distintos. Exercitar Inbox CRM WhatsApp Service via HTTP/worker/streams, seleção de escopo, FGA fine e coarse, idempotência, SSE reconnect, revogação concorrente, retries de provedor. Toda escrita e emissão deve carregar tenant/org/ws, quando aplicável funnel. Verificar trilha auditável no banco e zero concessões cruzadas. Proibir testes que simulem o resultado do Kernel sem passar pelo Host real como prova final.

**Saída:** CI verde com matrices positivas/negativas e evidências de revogação antes/durante/apos transação, provider down=deny; G-1/2/3/5 comprovados no mesmo release SHA.

### MO-REL-06 — Backup, restore e cutover SQL002 SOMENTE STAGING

**Arquivos principais:** `modules/organizations/sql/manual/activate_multiple_organizations.sql`, 008/009/010, `infra/postgres/bootstrap/control-iam07d-capabilities-010.schema`, scripts de backup/restore e verificações de integridade.

**Fazer:** backup criptografado e **testado por restauração** de Control e cada tenant-alvo, retenção/hash/ledger + referências externas Keycloak/FGA; usar staging e fixture com dados históricos; instalar Control 010 e tenant 010, ensaiar cutover com `psql --single-transaction -v ON_ERROR_STOP=1` e controle externo de aprovação. Verificar 008/009/010 em ambos estados completos e negar estado parcial. Criar Org B, reexecutar segurança e restaurar Control/tenant em bancos novos; reconciliar Keycloak/FGA sem emitir grants invisíveis. **Rollback pós-múltiplas orgs não pode recriar SQL002 sem antes voltar a um estado de dados compatível**; retornar ao backup consistente ou impedir rollback destrutivo.

**Saída:** dry-run e recovery assinados por operador, RPO/RTO medidos, hashes/contagens e invariantes verificados; nenhum banco de produção alterado.

### MO-REL-07 — Wizard de signup com dados de verdade

**Fazer:** após backend E2E, criar telas somente em frontend confiável existente (`apps/workspace-web` ou entrada pública aprovada pela arquitetura; não criar frontend novo por módulo). Identidade com Keycloak OIDC/PKCE; passos conta→Organization→Workspace→revisão→status real→conclusão; rascunho/idempotency key, back/forward e mobile. Nenhum botão apontando endpoint não implantado ou concedendo módulos não contratados.

**Testar:** E2E desktop/mobile, acessibilidade, abandono/retomada, reenvio de confirmação, erros de identidade e duas abas, replay e status `reconcile_required`.

**Saída:** UC-SIGNUP-01 e issue #189 com aceite por user story, sem declarar produção ativada.

### MO-REL-08 — Piloto em PRODUÇÃO, condicionado

**Pré-entrada:** G-1..G-6 aprovados em staging com SHA e registros, Service/IdP/Control/FGA/tenant instalados, backups restauráveis, operador responsável e janela de manutenção. **O agente não pode autoaprovar Product Gate nem inventar attestations.**

**Fazer após autorização operacional explícita:** release seletivo de UM tenant via GitHub Actions; preflight read-only; lock single-host, implantação de imagem/digests fixados, cutover por tenant com backup e transação controlados; smoke tests reais de A/B e fail-closed. Monitorar e validar rollback da aplicação ou recuperação de dados sem regressão de ownership. Só então considerar ampliação gradual.

**Saída:** URL de workflow, SHA, artifacts/restore, evidência sem segredos, decisão GO/NO-GO. Se faltar um gate, registrar `NO-GO` e manter SQL002/flag operacionais intactos.

## 3. Checklist de evidências por PR

- [ ] Issue ou `MO-REL-xx` identificada e dependência resolvida.
- [ ] Código proprietário localizado e AGENTS locais lidos; nenhuma implementação duplicada.
- [ ] Critérios positivos e negativos automatizados; teste de regressão histórico preservado.
- [ ] CI `Syndes Mainline CI` e `Syndes CI Gate` realmente `success` no **head SHA**.
- [ ] Migrations candidatas testadas em PG17 descartável, com replay, cutover parcial negado e rollback/restore de fixture.
- [ ] Nenhuma alteração de tenant comercial, realm operacional, grants ou secrets sem workflow autorizado.
- [ ] Evidência em PR/issue: commit, run/job, comandos (sem dados sigilosos), resultados, lacunas.
- [ ] Atualizar estado da linha MO-REL, G-1..G-6, `AGENTS.md` local quando contrato mudou, e README técnico; nunca marcar `READY` por inferência.

## 4. Fonte de verdade e reporte

Este arquivo é a **WBS das etapas**. A issue [#193](https://github.com/delmacy/syndes-system/issues/193) acompanha o Product Gate e possui os links de issues filhas. A issue [#189](https://github.com/delmacy/syndes-system/issues/189) acompanha o signup; a [#160](https://github.com/delmacy/syndes-system/issues/160) acompanha IAM. Estados são mantidos nos issues/PRs e **sincronizados com esta WBS**. Ordem de precedência: código/CI/infra comprovados `>` status de issue `>` texto histórico; discrepâncias devem ser abertas como tarefa, não apagadas.


### Reconciliação MO-REL-00 — evidências incrementais (2026-11-19)

PRs #212 e #213 **integrados** na main: `2d6eac02a14086bd940c2773bb9572363a418642` e `cde786a20c98efaeaa61a17a1962006946271a88`, ambos com Syndes CI Gate success nos respectivos heads (runs `44540988891`, `44542158764`). A matriz factual e a contagem estática de 84 decorators nos seis controllers de produto examinados estão em `MO-REL-00-BASELINE-EVIDENCE-20261119.md`; a extensão Organizations/Support/Go gateway/event workers está sob revisão no PR subsequente. Não chamar isso de testes reais de segurança A/B ou aceite de G-1..G-6. `PRODUCTION_GATE=BLOCKED`. Após CI e aceite de MO-REL-00, a execução seguinte é MO-REL-01 (#206), com PR #200 ainda conflitado e dependente de rebase/reteste.


### MO-REL-00 — aceite de baseline / início MO-REL-01

MO-REL-00 é reconciliação factual, **não** aprovação de segurança multi-org. PR #214 merged SHA `2dd31d47453a3a8b997eb718e233867577882d50`, [run 44544575705](https://github.com/delmacy/syndes-system/actions/runs/44544575705) `Syndes CI Gate=success`; matrizes, 84 rotas e limites registrados em `MO-REL-00-BASELINE-EVIDENCE-20261119.md`. A contagem e o inventário são estáticos: não demonstram isolamento em staging. MO-REL-01 corrige primeiro a aceitação inbound e o despacho outbound de WhatsApp quando Organization/Workspace estão inativas, usando PG17 descartável e deixando explicitamente aberta a janela de envio externo Go in-flight. A revisão do PR #200 está supersedida por uma implementação reconciliada sobre HEAD atual, sem forçar merge de branch conflitante. CRM exports, Inbox SSE, outras mutações, worker/eventos e topologia ainda requerem prova, portanto G-2/G-5 e `PRODUCTION_GATE=BLOCKED` permanecem.

### Evidência integrada MO-REL-01/02/03 — 2026-11-19

- MO-REL-01: [#215](https://github.com/delmacy/syndes-system/pull/215) merge `20daf9d56dc97a762a6341ce3acc9438df04b6c5` e [#216](https://github.com/delmacy/syndes-system/pull/216) merge `83fc4282a0b9637a581d2e9b9a9b3a1a8510bebf`: WhatsApp Organization/Workspace ativa, CRM duas Organizations no mesmo tenant (search, known ID, duplicates, CSV) sob PostgreSQL 17 descartável. **Não** é G-2 operacional nem staging.
- MO-REL-02: [#217](https://github.com/delmacy/syndes-system/pull/217) merge `e41f0ab5a77afcb6c766cfc114d6ac842bad24af`, CI 44557658680: Service Host opt-in apenas staging enforced; instalação oficial e rollback SQL PG17 efetivamente executados. Não instalar automaticamente em tenant.
- MO-REL-03: [#218](https://github.com/delmacy/syndes-system/pull/218) merge `9e2736cfe0dc5761c5deddd1a07a275e1ed1bb96`, CI 44559914481: reserva founder-bound sem grants. [#219](https://github.com/delmacy/syndes-system/pull/219) merge `80106ae4074fbc54fc64c0d5e6c3a079a1c0f116`, [CI 44567560783](https://github.com/delmacy/syndes-system/actions/runs/44567560783) `Syndes CI Gate=success`: saga do primeiro tenant, lock de sessão, contexto default SQL002, link Keycloak inicial com tenant ainda provisioned, grants FGA mínimos e transição Control `signup ready + tenant active + audit` atômica. Marcadores PG17 `UC_SIGNUP01B_PG17_FOUNDER_IDEMPOTENT_CONTROL_RESERVATION_PASS`, `UC_SIGNUP01C_PG17_FIRST_CONTEXT_SQL002_CONTROL_ACTIVATION_PASS`.
- **Lacuna concreta:** os artefatos acima são candidatos de operador, não um fluxo composto já executado com banco novo, Keycloak 26.8.1 e OpenFGA reais em staging. Faltam o **runner do provisionador privilegiado**, privilégio/credencial de serviço real revisado, ambiente staging segregado, E2E no Host e prova restore/cutover. O runtime não deve acionar um installer de banco. `history_sync` continua 403. SQL002 permanece em bancos operacionais. `PRODUCTION_GATE=BLOCKED`.

### MO-REL-04 — evidência operacional reconciliada em 2026-11-20

- **Comprovado por execução remota via GitHub Actions (não apenas CI unitário):** main `661273c664024ae7ea6dd6b3d5a6ee0cb14c9770`, [run 44732103374](https://github.com/delmacy/syndes-system/actions/runs/44732103374), attestation registrada na [issue #208](https://github.com/delmacy/syndes-system/issues/208#issuecomment-7039161108): Tailnet e scope aprovados; recovery Keycloak de staging aprovado; smoke read-only de PostgreSQL17, OIDC Keycloak e OpenFGA HTTP aprovado. A base de serviços foi efetivamente criada antes em [run 44607316098](https://github.com/delmacy/syndes-system/actions/runs/44607316098).
- **Não comprovado:** schema de Control/tenant instalado no staging, clientes e contas de serviço restritos, datastore OpenFGA persistente, Core Host com Service opt-in e singleton lease na topologia real, IAM07D Control→tenant 010, composição signup completa usando KC/FGA reais, restore ou SQL002 cutover. O [compose atual](../../infra/multiorg-staging/compose.yaml) configura `openfga` com `--datastore-engine memory`; logo HTTP saudável **não** implica autorizações duráveis.
- **Próxima entrega mínima da MO-REL-04:** projetar e testar migração *somente no staging* de FGA volátil para datastore PostgreSQL segregado, com credenciais de privilégio mínimo, migrations oficiais, prova de reinicialização/persistência e backup/restore; depois instalar Control/tenant e Core de staging via CI aprovado por SHA. Sem sobrescrever dados existentes, sem promoção de produção e sem alterar SQL002 operacional. Só marcar MO-REL-04 `PROVEN` quando a composição exigida e os receipts de CI estiverem demonstrados.
- **Acesso independente:** Desktop Commander DevServer01 indisponível nesta verificação; a fonte de evidência de execução é a attestation do workflow, não uma inspeção SSH nova. `PRODUCTION_GATE=BLOCKED`.

### Retomada MO-REL-04 — 2026-11-21: identidade e isolamento de segredos

- Baseline real `1663177c9233807dd02c70015afa06599e15d282`: o run
  `44854884016` falhava em `PILOT_OIDC_HTTP_400` após bootstrap admin concluído.
  [PR #251](https://github.com/delmacy/syndes-system/pull/251), merge
  `061699c8a97f94725c86f56c91f7773591d68694`, corrigiu os campos de perfil
  obrigatórios dos dois usuários sintéticos, inclusive os já criados. CI do head
  `6775c112dfec9e7b46b66f1a8bd5291b93623ca2`, run `44882638743`, aprovado;
  Keycloak26 real emitiu JWT após reparo/criação e comprovou replay sem troca
  de senha e deny para identidade suspensa. Isso ainda não atesta Core HTTP.
- [PR #252](https://github.com/delmacy/syndes-system/pull/252) propõe namespace
  OpenBao `multi-org-staging` e hostname SQL de staging fixos, sem fallback para
  produção. O CI do próprio SHA e os testes reais de ACL OpenBao são a fonte de
  aceite; código local ou proposta de policy não instala serviços/AppRoles.
- O provisionador de identidades precisa distinguir `provisioned` de `active`.
  Ao retomar um tenant já ativo, executar apenas leituras, tokens de login e
  checks FGA: qualquer tentativa de recriar usuário, membership, store, modelo
  ou tuple deve falhar antes da chamada externa. Não restaurar grants humanos
  revogados por um simples replay. Estado parcialmente ativo requer
  reconciliação explícita; não preencher memberships SQL silenciosamente.
- Core de staging ainda depende de OpenBao segregado/TLS/AppRoles, login SQL
  mínimo, issuer HTTPS e reader Keycloak restrito, entitlements/ledger/grants
  consistentes, singleton e E2E reais. Restore e piloto continuam pendentes.
  `PRODUCTION_GATE=BLOCKED`; nenhuma aprovação operacional é inferida do CI.

## Atualização de execução — staging greenfield (2026-11-22)

[Actions 44988144506](https://github.com/delmacy/syndes-system/actions/runs/44988144506), main `4330a94a8a9c160daa5b11b3ce05b6342bbfd616`: aceita duas passagens de HTTP real com Keycloak/OpenFGA/Control/tenants/worker/SSE, queda de provedores, cinco backups criptografados e restore em destinos novos, OpenBao snapshot e retorno à mesma imagem Core `sha256:e4fdd5246ad0cd42bee8ee2b0679ea0104e6f875b20584e7e5a88cad00b5f02a`; RTO observado 48 s. Evidência e limites em [plano de execução](MULTIORG-STAGING-EXECUTION-PLAN-20261122.md). SQL002 já estava removido na fixture criada greenfield; não houve backfill histórico nem cutover SQL002 legado. MO-REL-06 segue aberta para essa prova, e `PRODUCTION_GATE=BLOCKED`.

- Aceite final após limpeza do diagnóstico e verificação individual de cada grant OpenFGA: main `0d4bcbb65b2e77a82b8b28f289029b84ed4a7054`, [Actions 44989541139](https://github.com/delmacy/syndes-system/actions/runs/44989541139), job `137108180770` success, marcador final de restore e segunda passagem, RTO 48 s. MO-REL-04/05 aceitos no recorte staging greenfield; MO-REL-06 continua parcial até fixture histórica/SQL002 legado e Product Gate não está aprovado.

- MO-REL-06 histórico transacional: [Actions 45019251146](https://github.com/delmacy/syndes-system/actions/runs/45019251146) comprovou backfill/SQL002 com linhas legadas e rollback; [Actions 45019940500](https://github.com/delmacy/syndes-system/actions/runs/45019940500) comprovou 008/009/010 antes, durante estado parcial e depois do cutover, zero grant e rollback integral. O ensaio usou schema isolado no banco de manutenção do PostgreSQL17 de staging e **não é** cutover durável de tenant nem restore de fixture histórica. #210/G-4 continuam parcialmente abertos até `psql --single-transaction`, backup/restore do legado e reconciliação de Control/IdP/FGA.

- MO-REL-06 clone histórico sintético: main `577a736d181dc019860ff56024493cf6cd812e8a`, [Actions 45021167692](https://github.com/delmacy/syndes-system/actions/runs/45021167692), backup criptografado e restore em banco distinto, comparação histórica e cutover atômico via `psql -X --single-transaction`, origem preservada, 3 s; main `bc3b672795f4b2eb79b5a8e9f2552eecbba0a4ca`, [Actions 45022097742](https://github.com/delmacy/syndes-system/actions/runs/45022097742), job `137207829539` success, segunda org pós-cutover, SQL002 negada (`23505`) e restauração de backup pré-cutover em terceiro banco, 5 s. Não comprova recovery coordenado de Control/tenant/Keycloak/FGA com histórico operacional; #210/G-4 permanecem parciais. `PRODUCTION_GATE=BLOCKED`.
