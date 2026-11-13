# Q07 — CI/CD | STATUS

> **AUDITORIA TÉCNICA PARCIAL + CORREÇÃO LOCAL VALIDADA — 12/11/2026.** Base `origin/main` SHA `9521919178bcc0341c4d187492f9d027d188a6bd`, DevServer01/worktree isolada. A falha de paridade foi reproduzida e o planner/runner corrigido, com testes locais executados. **Ainda requer verificação do CI completo no novo SHA remoto para declarar mainline saudável.**

## Estado multidimensional

| Dimensão | Estado e evidência |
|---|---|
| **Documentação** | **Auditoria parcial:** capítulos 00–07, contratos, fluxos, matrizes e WBS reconciliados; aprovação técnica do responsável pendente |
| **Implementação Q07** | **Correção testada localmente:** paridade reconhece workflows auxiliares; Serviço registrado no catálogo e runner |
| **CI unitário e integridade** | **PASS local:** 19/19 testes `scripts/ci/*.test.mjs`, `repository-structure.sh` e `bash -n scripts/ci/*.sh` |
| **Integração de módulo Serviço** | **PASS local em PG17 descartável:** 19/19 testes, incluindo Nest HTTP, tenant A/B, equipes e trilha auditável, `npm pack --dry-run` |
| **CI central anterior** | **FAIL no SHA base:** [run 43337290670](https://github.com/delmacy/syndes-system/actions/runs/43337290670), etapa `Prove fail-closed test selection and removed-workflow parity` |
| **CI central pós-correção** | **PENDENTE:** precisa de matriz completa e `Syndes CI Gate` sucessos no SHA integrado |
| **Release/Produto/Operação** | **Não verificados:** alteração de seleção CI não habilita P05 nem libera migrations, grant, deploy, backup/restore ou Product Gate |

## Causa, reparo e prova

| Item | Antes | Correção da Q07 | Evidência |
|---|---|---|---|
| Classificação de workflows | 3 YAML fixos; havia 5 legítimos | Lista explícita dos cinco e teste de gatilhos | `parity.test.mjs`, teste regressivo de classificação |
| Unicidade de regressão | Teste rejeitava Docs Pages por ter `push` escopado | Mantém central exclusivo em PR/merge group e Docs/Projects como auxiliares | Manutenção das assertions de OIDC/FGA/SQL, paridades e gate |
| Catálogo full | 14 suites instaladas | 15 suites incluindo `service-management` | `node plan.mjs full` + `plan.test.mjs` |
| Serviço real | Package e testes do P05 fora do CI central | Runner PG17-alpine com label/porta controlada, cleanup, check/test/pack | 19/19 testes locais de Serviço, sem skips |
| Proteções | SQL002, Manager/Support paridades e Gate | Preservadas sem alterações | `scripts/ci/parity.test.mjs` e `syndes-ci.yml` |

## Riscos restantes

1. **CI remoto pós-integração** pode expor novos erros em outras suites; se ocorrerem, manter FAIL e diagnosticar o run específico, não desligar testes.
2. **Serviço opt-in:** pacote continua ausente do `apps/core-host/config/modules.json`; a suíte bem-sucedida não comprova release nem módulo ENABLED em tenant.
3. **Módulos futuros:** novos pacotes devem entrar no catálogo e no runner conforme owner; evitar regressões faltantes no `full`.
4. **Workpackages:** WBS 00.07 e 95.02 associadas; progresso real requer evidências de CI por commit, não inferência da documentação.
5. **Segurança:** nenhum tenant operacional, migrations de produção, grant, porta pública ou secret foi alterado nesta frente.

## Continuidade

- [Especificação Q07](ESCOPO.md) registra requisitos, histórias, matriz de dependências, diagrama e limites.
- [Referência técnica](REFERENCIA-TECNICA.md) relaciona assinaturas, comandos e resultados locais.
- [Plano geral](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md) atualiza somente a **revisão documental** da Q07.
- **Próxima unidade da auditoria:** Q01 — Test Infrastructure, após verificação dos resultados do CI central.

| Data | Base de evidência | Método | Não comprovado |
|---|---|---|---|
| 2026-11-12 | `9521919178bcc0341c4d187492f9d027d188a6bd`, DevServer01/worktree isolada | 17 testes prévios (16 PASS/1 FAIL), 19 de CI pós-reparo PASS, 19 PG17 Serviço PASS, integridade e shell PASS | GitHub CI do novo SHA, deploy, release e Product Gate |

**Critério para declarar gate de CI recuperado:** o job `foundation`, todas as regressões instaladas e paridades requeridas devem concluir `success` no commit integrado, e o `Syndes CI Gate` também. Um Docs Pages verde não substitui esse requisito.
