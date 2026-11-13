---
title: "C01 · WBS e evolução"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# WBS e evolução

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)

> L9: \| **Documentação C01** \| **AUDITORIA PARCIAL:** oito capítulos, reference, contracts, WBS, schema e APIs por owner reconciliados \| Revisão formal e aceite dos responsáveis ainda pendentes \|

> L42: \| **CP-E01..E07** \| Artefatos/versionamento e testes Control Events \| No Git; WBS registra entrega em worktree, **não aplicada operacionalmente** \|

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/REFERENCIA-TECNICA.md)

> L81: - **WBS:** [EVOLUÇÃO](EVOLUCAO.md) e [CP-E/CP-G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md): CP-G01/02 bloqueados, CP-G03 pendente.

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/OPERACAO.md)

> L8: - [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.

> L18: - **Fonte do migrador:** [`scripts/control/module_migrations.py`](https://github.com/delmacy/syndes-system/blob/main/scripts/control/module_migrations.py) e [WBS especializada CP-G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md). A presença do script não autoriza `--apply`.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/06-wbs-marcos-e-aceite.md)

> L3: A [EVOLUÇÃO C01](../EVOLUCAO.md) vincula os IDs **20.04, 30.03, 40.02, 55.03, 90.02, 90.03**. Os estados na WBS mestre são históricos e não foram promovidos. O plano especializado [CP-E/G](https://github.com/delmacy/syndes-system/blob/main/docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md) separa código/artefatos, instalação e consumers operacionais.

> L21: \| **CP-E07** \| ADR/WBS/instruções \| Fontes disponíveis; aprovação humana específica pendente \|

> L24: \| **CP-G03** \| Consumers Manager/readmodel + observabilidade e replay \| **PENDENTE** \|

### [07-controle-do-escopo.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/chapters/07-controle-do-escopo.md)

> L13: \| **P2 — WBS “worktree” não é deploy** \| CP-E01..E07 marcados “implementado na worktree” na fonte \| G03/C01: registrar que fontes hoje existem no main, mas **nenhum apply operacional** \|

> L23: - [x] WBS CP-E/CP-G e tarefas 20/30/40/55/90 preservadas, sem promover estados.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/C01-control-plane/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
