# WBS — Stage de validação integrada do Event Bus (2026-11-11)

| ID | Entrega | Estado/evidência |
|---|---|---|
| EV-STG01 | `TenantEventWorkerBatch` limitado, sem timers/scheduler/HTTP | Implementado; 4 testes unitários |
| EV-STG02 | Fixture PG17 com Control 001–006, tenant migrations e dados sintéticos | Implementado, banco descartado após teste |
| EV-STG03 | OpenFGA v1.22.1 real com modelo service e grants por consumidor | Implementado no teste; store em memória |
| EV-STG04 | Execução de 3 consumidores WhatsApp → Inbox → CRM → Inbox com `TenantEventWorkerBatch` | Implementado; PostgreSQL+FGA integrados |
| EV-STG05 | Negar sem grant, suspender com módulo desabilitado, retomar, deduplicar e revogar | Implementado, testado |
| EV-STG06 | Runner `scripts/events/run_disposable_staging.sh` com flags e cleanup de fixtures | Implementado; execução manual reproduzível |
| EV-STG07 | ADR, WBS, AGENTS, testes de regressão | Implementado em worktree; CI pendente |
| EV-STG08 | Restore de backups **reais** em ambiente segregado, com operator evidence | **Bloqueado**: autorização, custódia, escopo de dados, RTO/RPO |
| EV-STG09 | Staging operacional com identities OpenBao, FGA store/model/grants, Control/tenant migrations | **Bloqueado** por restore real e autorização |
| EV-STG10 | Scheduler/discovery por tenant, monitoramento, circuit breaker, replay/review | **Pendente**, não há startup automático |
| EV-STG11 | Cutover canário do projetor legado, rollback e teste no frontend autenticado | **Pendente**, não antecipar ativação |

**Estados a não confundir:** código/testes locais → CI → merge no main → provisionamento staging → deploy → homologação no frontend. Esta PR entrega somente os três primeiros, após CI aprovada.

**Segurança:** o runner usa portas loopback, contêineres sem volumes, nomes/labels verificadas, PostgreSQL 17 e OpenFGA descartáveis. O `syndes_control` operacional, tenant ativo, modelo OpenFGA operacional, WhatsApp legado e frontend da outra worktree não são modificados.

Ver `docs/engineering/ADR-EVENTS-DISPOSABLE-STAGING-20261111.md`.
