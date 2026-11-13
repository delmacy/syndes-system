---
title: "G03 · WBS e evolução"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# WBS e evolução

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

> L3: > **AUDITORIA TÉCNICA PARCIAL — 12/11/2026.** Fontes `AGENTS.md`, scripts de escopo/CI/docs, WBS e padrões examinados em `origin/main` SHA `068954a21e3090c7f94d374e2a8486cec7c2537b` (DevServer01, worktree isolada). É auditoria **de código estático e governança**, não homologação de CI/Projects, isolamento técnico dos agentes ou deploy.

> L9: \| **Documentação G03** \| **Auditoria parcial** \| Capítulos de processo e fontes reconciliados; revisão/aprovação da política pendente \|

> L26: \| `docs/standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md` \| Vínculos requisito/WBS/Issue/commit/teste/deploy/aceite \| Estado atual de Issue/Project sem consulta ao serviço \|

> L33: 4. **Rastreabilidade:** WBS histórica/Issue/Project e documentação não devem ter progressos manuais independentes.

> L54: \| 2026-11-12 \| `068954a21e3090c7f94d374e2a8486cec7c2537b` · DevServer01/worktree isolada \| Leitura de AGENTS, scripts, workflows, WBS e padrões versionados \| Run verde de CI, isolamento físico, Projects, release, homologação \|

> L56: **Estado final desta etapa:** documentação parcialmente reconciliada; aceite de governança pendente. Não interpretar publicação no Pages como gate global aprovado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L8: - **Metadados:** `catalog/work-units.json` (owner e source), `catalog/evolution-associations.json` (WBS) e `catalog/traceability-links.json` (vínculos, não status).

> L42: **Nenhuma tabela ou migration pertence à G03.** Git é a origem de código/histórico; Issues/Projects armazenam estados externos sob controle do GitHub; WBS e documentação guardam vínculos e decisões. O `Control DB` e os bancos de tenant não são utilizados para planejar workpackages do portal.

> L50: - **G03 WBS:** [WP-00, vinculações históricas](EVOLUCAO.md).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

> L8: - [SPRINT](SPRINT.md): incremento autorizado e checkpoints, quando existentes.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/06-wbs-marcos-e-aceite.md)

> L7: \| Grupo \| Trabalho previsto na WBS de origem \| Fonte de evidência a exigir \|

> L18: \| Leitura de política global/local \| `AGENTS.md`, `modules/*/AGENTS.md`, Workspace e testes \| Auditado em fonte, aprovação de processo pendente \|

> L21: \| Issues/Projects/WBS \| WBS-00, padrões de rastreabilidade e workflow de sync \| Integração prevista; estado de Projects não comprovado \|

> L22: \| Descrição e STATUS de G03 \| Capítulos e evidências por SHA \| Auditoria parcial, revisão do responsável pendente \|

> L32: **Próxima unidade na sequência documental:** Q10 — Quality Gates (depois de G01/G02/G03). Q07/CI é a frente executora para a falha de paridade; esta auditoria não abre refatoração de workflows nem sprint automaticamente.

### [07-controle-do-escopo.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/07-controle-do-escopo.md)

> L11: \| WBS histórica e fontes dinâmicas podem divergir \| G02/G03 + owners \| Preservar estados e SHA de origem, resolver lacunas por evidência, não sobrescrever silenciosamente \|

> L17: - [ ] Fonte e owner aprovados pelo responsável? **Pendente**.

> L26: Novo incremento precisa de owner, objetivo, risco, WBS e evidência. Não iniciar trabalho fora de G03, editar contratos de API, SQL, frontends de produto, branches protegidas ou configurações operacionais sem autorização específica. **A segurança do sistema não é uma opção**: controles tenant e autorização continuam de responsabilidade dos serviços de runtime.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
