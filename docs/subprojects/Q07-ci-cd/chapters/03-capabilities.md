## 3. Capabilities reais do pipeline

| Capability | Evidência no repositório | Estado desta auditoria |
|---|---|---|
| Planner de regressões impact/full | `scripts/ci/plan.mjs`, `plan.test.mjs` | Inspecionado; testes locais de seleção passaram |
| Pipeline único de regressões | `.github/workflows/syndes-ci.yml` | Mantido; falha prévia reproduzida em paridade |
| Detecção de workflows auxiliares | `parity.test.mjs` | Corrigida para classificar os cinco workflows por papel, sem liberar PR concorrente |
| Gate de segurança estrutural | `tests/integrity/repository-structure.sh` | Executado localmente sem erro |
| Shell de executor | `scripts/ci/run-suite.sh` | Sintaxe Bash verificada localmente; suíte de Serviço executada |
| Suíte Serviço Basic | `modules/service-management`, `scripts/ci/plan.mjs`, `run-suite.sh` | Incorporada; 19 testes locais PG17/NestJS passaram; permanece opt-in no Host |
| Paridade Manager/Support | `platform-manager.yml`, `support-browser-e2e.yml` | Verificada por assertivas de presença; cenários reais no GitHub ainda dependem do novo run |
| Docs publisher/Projects sync | Dois workflows `syndes-docs-*` | Considerados auxiliares por gatilhos e escopo; não são gate de produto |
| Evidências de release | Run GitHub, SHA, logs de job, WBS e Product Gate | Devem ser conectadas ao STATUS, sem inventar percentuais |

### Mudança efetiva nesta revisão

1. **Antes:** `parity.test.mjs` pressupunha somente três YAML; falhava porque Docs Pages e Project Sync são workflows legítimos adicionais.
2. **Depois:** a lista de workflows permitidos é explícita. Testa `push/pull_request/merge_group` do central, `workflow_call` nos reutilizáveis e gatilhos próprios nos auxiliares.
3. **Antes:** o planner `full` tinha 14 suites, omitindo `service-management` apesar do `package-lock.json` e testes do módulo.
4. **Depois:** 15 suites; `service-management` é selecionada em full e nos impactos de Serviço/CRM/Inbox, com PG17 descartável e checks.
5. **Não feito:** ativação do plugin `@syndes/service` no Host, rollout, grant real, migration operacional ou alteração dos Product Gates.

### Lacunas ainda não encerradas

Cobertura total de módulos e flows de ponta a ponta requer inspeção por Q07/owners à medida que módulos são criados. CI no GitHub deve passar todos os 15 jobs selecionados mais as paridades; o teste local não prova essa condição.
