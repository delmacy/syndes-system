## 2. Requisitos, histórias e casos de uso

### Matriz de requisitos de CI identificados

| Requisito técnico | Origem | Prova exigida |
|---|---|---|
| Regra única de integração | `syndes-ci.yml` e `parity.test.mjs` | Nenhum outro workflow deve registrar `pull_request` ou `merge_group` de regressão |
| Workflow de publicação legítimo | `syndes-docs-pages.yml` | `push main` com filtros de paths; sem job de regressão/merge duplicado |
| Sync Projects legítimo | `syndes-docs-project-sync.yml` | Somente Issues/dispatch e permissões condicionais; não duplicar mainline |
| Planejamento por impacto | `plan.mjs` | Mudanças em CRM/Inbox atingem consumers, incluindo Serviço; mudanças desconhecidas → full |
| Cobertura de módulo instalável | `modules/service-management/package-lock.json` | Suite `service-management` aparece no full e quando source é alterado |
| Testes de atendimento isolados | `test/service-funnels-pg17.test.mjs` | PostgreSQL 17-alpine, label/porta fixos, ambiente descartável e testes sem `skip` |
| Segurança na promoção | `gate` e `parity.test.mjs` | Gates necessários têm conclusão `success`, sem substituir teste falho por publicidade do Pages |

### Histórias de usuário do processo

- **US-Q07-01 — PR de mudança técnica:** como engenheiro, quero que a análise de diff selecione os módulos afetados e suas dependências para detectar regressão sem duplicar toda a CI em vários workflows.
- **US-Q07-02 — Mudança desconhecida:** como revisor, quero que o planner selecione a regressão completa quando não reconhecer um path, e nunca ignore testes de componentes instalados.
- **US-Q07-03 — Novo módulo de domínio:** como responsável por atendimento, quero uma suíte real de serviço na matriz, com verificações PG17, NestJS, autorização e isolamento.
- **US-Q07-04 — Docs independente:** como mantenedor, quero publicar documentação e sincronizar Issues sem ser interpretado como pipeline concorrente de PR.
- **US-Q07-05 — Gate final:** como responsável por release, quero distinguir CI, deploy e Product Gate e impedir promoção quando qualquer job obrigatório for falho, cancelado ou ignorado.

### Casos de uso

**UC-Q07-A — Push no `main`:** checkout → foundation (integridade, paridade, SQL002) → planner em modo full → regressão de todas as suites instaladas → paridade Browser/Manager quando requerida → job Gate. Nenhum `skipped` obrigatório deve produzir aprovação.

**UC-Q07-B — PR sobre CRM/Inbox:** diff do merge-base → `selectSuites` → incluir as suites proprietárias e consumidores pertinentes, inclusive `service-management` → regressão. O status do módulo com plugin não montado continua **não operacional**, mesmo com testes aprovados.

**UC-Q07-C — Documento atualizado:** `syndes-ci.yml` executa integridade e seleção adequada; `syndes-docs-pages.yml` publica site conforme paths; `syndes-docs-project-sync.yml` age somente pelos seus gatilhos. O segundo fluxo não substitui o primeiro.

### NFR relevantes

Segurança/integridade sempre fail-closed; runner não deve usar dados do cliente, não executar destruição em hosts reais e deve limpar containers descartáveis mesmo após falha. O tempo de CI é métrica operacional a ser coletada, não justificativa para ignorar suíte requerida.
