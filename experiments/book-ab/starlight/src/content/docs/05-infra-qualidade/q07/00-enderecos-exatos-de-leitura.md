---
title: "Q07 · Fontes e endereços"
description: "Volume Infraestrutura e qualidade · capítulo Q07 · matéria 00"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/00-enderecos-exatos-de-leitura.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 0. Fontes verificáveis da Q07

**Base auditada:** `origin/main` SHA `9521919178bcc0341c4d187492f9d027d188a6bd` (12/11/2026). Q07 é unidade de **engenharia de CI/CD**, com source canônico `scripts/ci/plan.mjs`. Os testes executados na worktree de auditoria são evidências **locais** e não provam aprovação do GitHub Actions até o novo commit ser validado pela plataforma.

| Fonte | Caminho | Papel |
|---|---|---|
| Ownership | `catalog/work-units.json`, `docs/subprojects/index.json` | Identidade Q07 e índice de documentos |
| Políticas | [AGENTS global](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md), [TEST-STRATEGY](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/TEST-STRATEGY.md) | Regras de falha fechada e camadas de teste |
| Pipeline central | [syndes-ci.yml](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml) | Foundation → impact → regression/paridades → gate |
| Planejador | [plan.mjs](https://github.com/delmacy/syndes-system/blob/main/scripts/ci/plan.mjs) e `plan.test.mjs` | Suite catalog/impact/full e regressões de seleção |
| Paridade de segurança | [parity.test.mjs](https://github.com/delmacy/syndes-system/blob/main/scripts/ci/parity.test.mjs) | Unicidade da mainline, proteções SQL/identidade, suites e jobs obrigatórios |
| Executor | `scripts/ci/run-suite.sh`, `run-infra.sh`, `run-account-access.sh`, `run-workspace-browser.sh` | Executar scripts reais com preflight local, PG descartável e integração |
| Reutilizáveis | `platform-manager.yml`, `support-browser-e2e.yml` | Paridades invocadas pelo CI, não pipelines independentes de PR |
| Automação Docs | `syndes-docs-pages.yml`, `syndes-docs-project-sync.yml` | Publicação condicionada a paths, sync de Issues; não substituem CI do produto |
| Serviço de atendimento | `modules/service-management/package-lock.json`, `test/*.test.mjs` | Suite nova adicionada à seleção e executor, PG17 descartável |
| WBS | [EVOLUÇÃO da Q07](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/EVOLUCAO.md), [WBS principal](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md) | 00.07 e 95.02 vinculados; não implicam DONE |
| Falha de referência | [Run anterior](https://github.com/delmacy/syndes-system/actions/runs/43337290670) | Falha do `foundation` em `parity.test.mjs` no SHA auditado |

**Limite:** não registrar strings de conexão reais, segredos, conteúdo de tenant, credenciais ou topologia privada no portal público.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/Q07-ci-cd/chapters/00-enderecos-exatos-de-leitura.md).
