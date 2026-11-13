# A04 — Core Host | STATUS

> **AUDITORIA TÉCNICA PARCIAL — 13/11/2026.** Fonte do inventário: checkpoint `94fdcc6` (auditoria estática sobre integração local `f4fbfe5`). Esta revisão documental parte de `3c1db91`. **NÃO HOMOLOGADO:** nenhuma consulta a secrets, Keycloak, OpenFGA, bancos operacionais ou deploy.

## Estado por evidência

| Área | Código observado | Limitação |
|---|---|---|
| Composição NestJS | `main.ts`, `module-host.ts`, `config/modules.json` | Plugins declarados não equivalem a módulos ENABLED |
| Autenticação e autorização | `ActorVerifier`, `PgMembership`, `FgaPermission` | Token/grant/tenant reais não verificados |
| Dados | `TenantPgProvider`, `resolveRegistry`, adapters Control | Migrations e grants efetivos não verificados |
| Lifecycle | `PgModuleCatalog`, `PgModuleLifecycle`, `PgEffectiveModuleAccess`, `PgModuleInstaller` | Plano, instalação, ativação e execução são gates diferentes |
| Eventos | `platform-event-*.ts` | Sem ativação de dispatcher/worker ou prova de consumo real |
| Testes | Testes existentes e checkpoint estático | Suite Node A04 não reexecutada neste incremento; dependências isoladas pendentes |
| Operação | Configuração versionada | Sem prova de saúde, CI/deploy do SHA ou E2E |

## WBS de documentação e homologação

| ID | Estado | Critério de aceite |
|---|---|---|
| A04.DOC.01 | **AUDITORIA PARCIAL** | Contratos, ownership e capítulos reconciliados com testemunhas de símbolos |
| A04.TEST.01 | PENDENTE | Instalar dependências pinadas em cópia descartável, compilar e executar testes A04 com relatório por SHA |
| A04.DATA.01 | PENDENTE | Conferir schema, migrations, grants e negativas tenant/org/workspace em PG17 segregado |
| A04.SEC.01 | PENDENTE | JWT, FGA, OpenBao, gates de módulo e fail-closed em ambiente autorizado |
| A04.EVT.01 | PENDENTE | Eventos, worker admission, replay, dedupe e outbox por tenant sem tocar runtime |
| A04.GATE | BLOQUEADO | Owner review, CI por SHA, operação comprovada e publicação documental |

**Próxima unidade na sequência:** conferir o plano após A04; a auditoria de código e a reconciliação de cada owner são independentes. Não iniciar novas features por conta deste STATUS.

[Referência técnica](REFERENCIA-TECNICA.md) · [Operação](OPERACAO.md) · [Capítulos](ESCOPO.md).
