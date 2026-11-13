---
title: "G03 · WBS e critérios de aceite"
description: "Volume Infraestrutura e qualidade · capítulo G03 · matéria 06"
draft: false
---

[← Ficha do capítulo](../) · [Volume](../../) · [Fonte original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/06-wbs-marcos-e-aceite.md)

> Conteúdo espelhado da documentação versionada; não expressa automaticamente estado funcional.

## 6. WBS, marcos e critérios de aceite da engenharia

### Associação existente com WBS-00

A [EVOLUÇÃO da G03](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/EVOLUCAO.md) liga os IDs **00.01, 00.02, 00.03, 00.04, 00.05, 00.06 e 00.09** ao WP-00 (baseline, governança e branches). Esses são vínculos para consulta, **não** ownership exclusivo nem declarações de progresso.

| Grupo | Trabalho previsto na WBS de origem | Fonte de evidência a exigir |
|---|---|---|
| 00.01–00.03 | Inventário do `main`, PRs e divergências históricas | SHA comparados, PR/commit e diffs efetivos |
| 00.04–00.05 | Composição `front-shared` e reconciliação de mudanças | Testes de frontend, owners, PRs e gates de migração |
| 00.06 | Triagem de branches antigas sem exclusão precipitada | Matriz branch → status do commit → ação aprovada |
| 00.09 | Regras da `main` e critérios de promoção | CI completo, gates e política aprovada pelo proprietário |

### Checkpoint da presente auditoria

| Revisão G03 | Evidência | Estado |
|---|---|---|
| Leitura de política global/local | `AGENTS.md`, `modules/*/AGENTS.md`, Workspace e testes | Auditado em fonte, aprovação de processo pendente |
| Limite de trabalho dos agentes | `scripts/docs/verify_module_scope.py` e `AGENTS.md` | Limite **consultivo**, não sandbox garantido |
| Pipeline e riscos | `syndes-ci.yml`, planner, parity tests, último CI observado | Fluxo mapeado; CI global com bloqueio |
| Issues/Projects/WBS | WBS-00, padrões de rastreabilidade e workflow de sync | Integração prevista; estado de Projects não comprovado |
| Descrição e STATUS de G03 | Capítulos e evidências por SHA | Auditoria parcial, revisão do responsável pendente |

### Critérios para elevar G03 de parcial a revisada

- Regras/owners confirmados pelo responsável e conflitos de política resolvidos com decisão registrada.
- Verificação real de ci/gates por SHA, incluindo falhas/skips explícitos; não enfraquecer testes para obter verde.
- Rastreabilidade real de um pacote de trabalho: requisito → WP → Issue → PR/commit → CI → deploy (se aplicável) → aceite.
- Documentar se Projects está sincronizado **com evidência da própria plataforma**, sem se apoiar na presença do sincronizador.
- Testar cenário de violação de escopo sem confundir scanner consultivo com controle impeditivo real.

**Próxima unidade na sequência documental:** Q10 — Quality Gates (depois de G01/G02/G03). Q07/CI é a frente executora para a falha de paridade; esta auditoria não abre refatoração de workflows nem sprint automaticamente.


---
**Rastreabilidade:** [revisar documento fonte](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/06-wbs-marcos-e-aceite.md).
