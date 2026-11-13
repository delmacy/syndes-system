---
title: "Q07 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL + CORREÇÃO LOCAL VALIDADA — 12/11/2026.** Base `origin/main` SHA `9521919178bcc0341c4d187492f9d027d188a6bd`, DevServer01/worktree isolada. A falha de paridade foi reproduzida e o planner/runner corrigido, com testes locais executados. **CI mainline validada no commit `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`: 24/24 jobs SUCCESS, inclusive `Syndes CI Gate`.** Isso comprova o pipeline nes

> L7: \| Dimensão \| Estado e evidência \|

> L11: \| **CI unitário e integridade** \| **PASS local:** 19/19 testes `scripts/ci/*.test.mjs`, `repository-structure.sh` e `bash -n scripts/ci/*.sh` \|

> L12: \| **Integração de módulo Serviço** \| **PASS local em PG17 descartável:** 19/19 testes, incluindo Nest HTTP, tenant A/B, equipes e trilha auditável, `npm pack --dry-run` \|

> L14: \| **CI central pós-correção** \| **SUCCESS confirmado:** [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873), commit `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`, **24/24 jobs success**, incluindo Serviço, Support, Manager e Infra; `Syndes CI Gate` **success** \|

> L15: \| **Release/Produto/Operação** \| **Não verificados:** alteração de seleção CI não habilita P05 nem libera migrations, grant, deploy, backup/restore ou Product Gate \|

> L19: \| Item \| Antes \| Correção da Q07 \| Evidência \|

> L21: \| Classificação de workflows \| 3 YAML fixos; havia 5 legítimos \| Lista explícita dos cinco e teste de gatilhos \| `parity.test.mjs`, teste regressivo de classificação \|

> L22: \| Unicidade de regressão \| Teste rejeitava Docs Pages por ter `push` escopado \| Mantém central exclusivo em PR/merge group e Docs/Projects como auxiliares \| Manutenção das assertions de OIDC/FGA/SQL, paridades e gate \|

> L24: \| Serviço real \| Package e testes do P05 fora do CI central \| Runner PG17-alpine com label/porta controlada, cleanup, check/test/pack \| 19/19 testes locais de Serviço, sem skips \|

> L25: \| Proteções \| SQL002, Manager/Support paridades e Gate \| Preservadas sem alterações \| `scripts/ci/parity.test.mjs` e `syndes-ci.yml` \|

> L32: 4. **Workpackages:** WBS 00.07 e 95.02 associadas; progresso real requer evidências de CI por commit, não inferência da documentação.

> L42: \| Data \| Base de evidência \| Método \| Não comprovado \|

> L44: \| 2026-11-12 \| `9521919178bcc0341c4d187492f9d027d188a6bd`, DevServer01/worktree isolada \| 17 testes prévios (16 PASS/1 FAIL), 19 de CI pós-reparo PASS, 19 PG17 Serviço PASS, integridade e shell PASS \| CI remoto validado posteriormente; deploy, release e Product Gate ainda não verificados \|

> L45: \| 2026-11-12 \| `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`, [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873) \| **24/24 jobs success**, incluído `Syndes CI Gate`; Pages publicado em run 43339625845 \| Homologação operacional, backup/restore real e Product Gate continuam separados \|

> L47: **Gate de CI recuperado e comprovado no SHA `ec688ce`:** `foundation`, regressões, paridades e gate final concluíram com `success`. Para futuros commits, exigir a mesma evidência. **Q07 permanece em auditoria documental parcial** por depender da revisão formal do owner; produto e produção não estão homologados.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/REFERENCIA-TECNICA.md)

> L3: > **AUDITORIA E CORREÇÃO LOCAL — 12/11/2026.** Base `origin/main` SHA `9521919178bcc0341c4d187492f9d027d188a6bd`. Scripts de CI corrigidos em worktree isolada, com suites reais executadas localmente. **CI mainline concluída com sucesso no SHA `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f` ([run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873), 24/24 jobs success).** Não equivale a Product G

> L8: - **Orquestrador:** `.github/workflows/syndes-ci.yml` executa `foundation`, `impact`, `regression`, duas paridades reutilizáveis e `gate`.

> L11: - **Testes:** `scripts/ci/parity.test.mjs`, `plan.test.mjs`, `tests/integrity/repository-structure.sh`.

> L22: \| `start_pg(name,port,password,version,label?)` \| `scripts/ci/run-suite.sh` \| Inicializa PostgreSQL apenas de teste com label opcional e `trap` de limpeza \|

> L23: \| `node --test scripts/ci/*.test.mjs` \| Planner/paridade \| 19/19 testes localmente, sem skipped \|

> L28: Marcador `modules/service-management/package-lock.json`, dependência do `@syndes/core-kernel`. O teste exige `postgres:17-alpine` descartável e valida módulo **não montado por padrão no Host**, FGA/ENABLED, tenant/workspace, protocolos, equipes e auditoria. O runner define marcador `SYNDES_FUNNEL_DISPOSABLE=FUNNEL_PG17_ONLY` apenas no ensaio. **Local: 19 testes PASS**, inclusive a fixture PG17. Não usar essas configu

> L32: **Q07 não publica API HTTP, eventos do domínio nem banco operacional.** Seu contrato público para GitHub Actions é a matriz JSON `{"include":[{"suite":"...", "node":"..."}]}`, os exit codes, logs de jobs e o `Syndes CI Gate`. Não modificar contratos públicos de P01/P02/P03/P05 para corrigir seleção.

> L38: - **Fail closed:** modos desconhecidos produzem erro; `gate` deve reprovar `failure`, `cancelled` ou `skipped` requerido.

> L48: - **Depois remoto:** [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873) do commit `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f`: **24/24 jobs success**, incluído `Syndes CI Gate`. Evidência válida somente para essa revisão e ambientes descartáveis do CI.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/06-wbs-marcos-e-aceite.md)

> L9: \| **00.07** \| Matriz do CI central por impacto, `front-shared` e Workforce \| Cobertura parcial em código; planner revisado para Serviço e testes locais; **gate remoto ainda precisa comprovar** \|

> L10: \| **95.02** \| CI integrado com testes negativos preservados \| Paridade local reparada, Serviço PG17 aprovado localmente; falta GitHub full `success` no SHA integrado \|

> L16: \| `node --test scripts/ci/*.test.mjs` \| 16/17 PASS; falha por dois workflows Docs extras \| 19/19 PASS, com teste adicional de trigger \|

> L20: \| `run-suite.sh service-management` \| Suite não registrada \| Check/build, 19 testes NestJS/PG17 e `npm pack --dry-run` PASS \|

> L21: \| CI remoto do novo SHA \| FAIL na revisão anterior \| **24/24 jobs SUCCESS**, incluindo final Gate, [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873) no SHA `ec688ce3b6884ef4d1e6dd10ba4c2f3048dbef0f` \|

> L26: - `regression` executa todas as suites instaladas em push `main`, inclusive Serviço, com testes PG17 **não ignorados**.

> L28: - `gate` só recebe **success** após jobs obrigatórios e evidências; `skipped` necessário não passa.

> L29: - Release e Product Gate permanecem externos ao CI e exigem autorização operacional explícita.

> L31: **Situação:** pipeline recuperado no [run 43339625873](https://github.com/delmacy/syndes-system/actions/runs/43339625873). **Próximo módulo na auditoria documental:** **Q01 — Plataforma de testes**. A aprovação de CI é por SHA e não dá aceite ao produto.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
