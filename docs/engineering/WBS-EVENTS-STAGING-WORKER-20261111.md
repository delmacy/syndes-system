# WBS — Staging Worker Admission e composição (2026-11-11)

| ID | Entrega | Situação / evidência |
|---|---|---|
| EV-W01 | `TenantEventWorkerAdmission` exige identity service + module ENABLED + escopo org/workspace + port FGA, fail-closed | Implementado; unit tests |
| EV-W02 | `PgEventWorkerScope` query tenant-local, Organization/Workspace ativos e pertencentes | Implementado; PG17 descartável |
| EV-W03 | `PgEffectiveModuleAccess` com Control DB real e dependências/release attested/ENABLED | Reutilizado e validado em PG17 real descartável |
| EV-W04 | `composeTenantEventWorker`: 3 consumers reais WhatsApp/Inbox/CRM, ponte opt-in e dispatcher | Implementado; fluxo PG17 descartável |
| EV-W05 | Cobertura de suspensão/retomada, negação FGA, erro Control, org arquivada, cross-tenant | Implementado e testado, sem tenant operacional |
| EV-W06 | ADR, AGENTS e documentação de gates | Implementado em worktree |
| EV-W07 | Modelo OpenFGA e adapter de identidade de serviço | Modelo/adapter candidatos implementados e testados em store descartável (etapa EV-FGA); **store e grants reais ainda bloqueados** |
| EV-W08 | Provisionamento Control 001–006 e platform_events 001–002 em staging | **Bloqueado — restore real homologado e autorização** |
| EV-W09 | Conectar Factory ao Host Nest, scheduler gated, discovery e observabilidade | **Pendente — não ligar automaticamente** |
| EV-W10 | Cutover legado e canário com rollback + frontend autenticado | **Pendente após gates anteriores** |

A composição não é importada por `apps/core-host/src/main.ts` e não roda sozinha. O único caminho de recebimento WhatsApp em operação continua o legado textual. Nenhum serviço novo foi publicado. Não alterar SQL002, multi-org, configurações da plataforma ou workflows GitHub Actions.

Para testes de fixtures PG17 descartáveis, usar `SYNDES_EVENTS_PG_URL` e `SYNDES_EVENTS_DISPOSABLE=EVENTS_TEST_ONLY` (as suítes verificam host localhost, database postgres e credencial de fixture). Não enviar DSN de tenant operacional ao runner.

**Frontend:** disponível para revisão visual sem essas etapas; utilização do fluxo novo depende de worker autorizado + cutover.
