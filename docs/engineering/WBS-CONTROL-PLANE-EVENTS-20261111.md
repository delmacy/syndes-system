# WBS — Outbox do Control Plane, fase separada PR4

| ID | Entrega | Estado | Evidência/gate |
|---|---|---|---|
| CP-E01 | Schema versionado 006 `control_events` | Implementado na worktree | replay-safe, checksum-pinned |
| CP-E02 | Trigger de auditoria → outbox no mesmo COMMIT | Implementado na worktree | PG17: commit e ambos os rollbacks |
| CP-E03 | Contratos v1 entitlement/installation | Implementado na worktree | Core Kernel typed + unit |
| CP-E04 | Entregas independentes e inbox idempotente | Schema/teste em worktree | 2 consumers PG17; dispatcher **não instalado** |
| CP-E05 | Escopo tenant/module FK e privilégios mínimos | Implementado na worktree | FK de auditoria composta + roles sem grants |
| CP-E06 | Migration runner com 006 após 001–005 | Implementado na worktree | 9 unit tests, SHA/ordem/abort |
| CP-E07 | ADR, WBS, AGENTS, instruções operator | Implementado na worktree | review pendente |
| CP-G01 | Aplicação 001–006 no Control DB operacional | **Bloqueada** | backup, restore ensaiado, SHA da release, janela e autorização |
| CP-G02 | Dispatcher Control e identidade de serviço/FGA | **Bloqueada** | provisionamento + Product Gate |
| CP-G03 | Consumers Manager/readmodel, observabilidade, retenção, replay | **Pendente** | especificação e testes de autorização |
| CP-G04 | Multi-org, SQL002, reconciliação WhatsApp operacional | **Fora de escopo** | gates independentes |

**Regra:** a migration não é parte de bootstrap automático; nenhum serviço operacional acessa ou altera `control_events` nesta PR. O Control DB global não substitui as outboxes tenant-local já integradas em PRs #83–#85.
