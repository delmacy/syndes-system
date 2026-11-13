---
title: "G03 · Fontes e endereços"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 00"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/00-enderecos-exatos-de-leitura.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 0. Fontes verificáveis e caminhos

G03 é a unidade de **governança de engenharia e Git**, cujo `source` canônico em `catalog/work-units.json` é `AGENTS.md` na raiz. Não é um app, banco ou contrato HTTP. Leitura estática no commit `068954a21e3090c7f94d374e2a8486cec7c2537b` de 12/11/2026.

| Tema | Fonte versionada | Interpretação |
|---|---|---|
| Política global | [AGENTS.md](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md) | Escopo, gates, segurança, prioridades, regra de ler instrução local |
| Instrução por owner | `modules/*/AGENTS.md`, `apps/workspace-web/AGENTS.md`, `tests/**/AGENTS.md` | Regras locais aplicáveis, sempre subordinadas às globais |
| Catálogo de owners | `catalog/work-units.json`, `docs/subprojects/index.json` | Fonte da identidade e caminhos do módulo, não habilitação operacional |
| Alterações delimitadas | [verify_module_scope.py](https://github.com/delmacy/syndes-system/blob/main/scripts/docs/verify_module_scope.py) | Checker **consultivo** de diff, não sandbox de segurança |
| CI central | [.github/workflows/syndes-ci.yml](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml), `scripts/ci/plan.mjs`, `run-suite.sh` | Seleção de suites e gate; verificar execução por SHA |
| Documentação publicada | `scripts/docs/build_site.py`, `docs/assets/topic-editor.js` | MkDocs + páginas derivadas e editor de propostas; publicação GitHub Pages é somente leitura |
| Fonte e provas | [FONTES-DE-VERDADE-E-RASTREABILIDADE](https://github.com/delmacy/syndes-system/blob/main/docs/standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md) | ADR/PRD/WBS/Issue/PR/commit/teste/deploy/aceite permanecem distintos |
| Issues e Projects | [GITHUB-PROJECTS](https://github.com/delmacy/syndes-system/blob/main/docs/standards/GITHUB-PROJECTS.md), `scripts/docs/sync_github_project.py` | Sincronizador previsto, **não** comprovação de Project preenchido |
| WBS | [WBS mestre](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md), [G03 EVOLUCAO](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/EVOLUCAO.md) | Tarefas associadas 00.01–00.06 e 00.09, estados originais históricos |
| Critério de validação | [TEST-STRATEGY](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/TEST-STRATEGY.md) e `AGENTS.md` | Gates por commit, PR e RC, sem deduzir aprovação de teste declarado |

**Consulta operacional:** sempre fixar SHA e ambiente. A página pública não deve conter credenciais, tokens, URLs administrativas restritas ou dados de tenant.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/00-enderecos-exatos-de-leitura.md).
