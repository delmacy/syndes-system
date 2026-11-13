---
title: "G03 · Testes e evidências"
description: "Seção temática experimental com referências rastreáveis"
draft: false
---

[← Ficha do módulo](../) · [↑ Volume](../../)

> **Leitura documental, não homologação.** Trechos extraídos dos documentos existentes; correspondência textual não demonstra implementação, testes ou implantação.

# Testes e evidências

## Referências verificáveis

### [STATUS.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)

> L12: \| **Qualidade/CI central** \| **Falha conhecida, gate não satisfeito** \| Run [43332115355](https://github.com/delmacy/syndes-system/actions/runs/43332115355) falhou em `Prove fail-closed test selection and removed-workflow parity`; revalidar após correção por Q07 \|

> L21: \| `AGENTS.md` \| Regras de MVP, autorização, testes, isolamento, gates e instruções locais \| Que agentes cumpram tudo automaticamente \|

> L24: \| `.github/workflows/syndes-ci.yml`, `scripts/ci/plan.mjs` \| Gates e planner de regressão impact/full no mesmo pipeline \| Que todas as suites/branch atual passaram \|

> L26: \| `docs/standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md` \| Vínculos requisito/WBS/Issue/commit/teste/deploy/aceite \| Estado atual de Issue/Project sem consulta ao serviço \|

> L30: 1. **Mainline CI vermelho:** falha em paridade dos workflows, com regressões posteriores/skipped no run citado. Owner Q07; corrigir/testar em frente separada sem enfraquecer gate.

> L32: 3. **GitHub Projects:** backfill/campos de status não comprovados; falta evidência dos itens e permissão do Project.

> L40: - [ESCOPO](ESCOPO.md): missão, exclusões, regras dos agentes, matriz de contratos, critérios de testes e diagrama de mudanças.

> L48: 2. **Q10 — Quality Gates:** próxima auditoria documental; critérios de aceite e evidências para releases.

> L49: 3. **Q07 — CI central:** corrigir a falha de paridade com testes adequados no escopo responsável e confirmar run verde por SHA.

> L56: **Estado final desta etapa:** documentação parcialmente reconciliada; aceite de governança pendente. Não interpretar publicação no Pages como gate global aprovado.

### [REFERENCIA-TECNICA.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/REFERENCIA-TECNICA.md)

> L21: \| `scripts/ci/run-suite.sh` \| Executor de suites por ID \| Executa testes selecionados; sua existência não prova resultado \|

> L46: - **CI mainline:** [workflow](https://github.com/delmacy/syndes-system/blob/main/.github/workflows/syndes-ci.yml); um run com falha de paridade não é gate aprovado. Observar runs e SHA, sem editar pipeline nesta revisão.

> L47: - **Testes da documentação:** `python -m unittest discover -s scripts/docs`, `node --test scripts/docs/test_*.mjs` e `mkdocs build --strict`, executados pelo fluxo local; resultado do próximo commit precisa ser verificado separadamente.

> L48: - **G03 STATUS:** [auditoria, riscos e próximos gates](STATUS.md).

### [OPERACAO.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/OPERACAO.md)

> L7: - [STATUS](STATUS.md): nível de validação, bloqueios, testes, ambiente e SHA.

> L32: 4. Testar com critérios apropriados: unitário, contrato, integração, E2E e CI.

> L33: 5. Registrar resultado e evidência em STATUS, sem confundir merge com deploy ou aceite.

### [06-wbs-marcos-e-aceite.md](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/chapters/06-wbs-marcos-e-aceite.md)

> L7: \| Grupo \| Trabalho previsto na WBS de origem \| Fonte de evidência a exigir \|

> L10: \| 00.04–00.05 \| Composição `front-shared` e reconciliação de mudanças \| Testes de frontend, owners, PRs e gates de migração \|

> L12: \| 00.09 \| Regras da `main` e critérios de promoção \| CI completo, gates e política aprovada pelo proprietário \|

> L16: \| Revisão G03 \| Evidência \| Estado \|

> L18: \| Leitura de política global/local \| `AGENTS.md`, `modules/*/AGENTS.md`, Workspace e testes \| Auditado em fonte, aprovação de processo pendente \|

> L22: \| Descrição e STATUS de G03 \| Capítulos e evidências por SHA \| Auditoria parcial, revisão do responsável pendente \|

> L27: - Verificação real de ci/gates por SHA, incluindo falhas/skips explícitos; não enfraquecer testes para obter verde.

> L29: - Documentar se Projects está sincronizado **com evidência da própria plataforma**, sem se apoiar na presença do sincronizador.

> L32: **Próxima unidade na sequência documental:** Q10 — Quality Gates (depois de G01/G02/G03). Q07/CI é a frente executora para a falha de paridade; esta auditoria não abre refatoração de workflows nem sprint automaticamente.

## Revisão e proveniência

- [STATUS original](https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/G03-engenharia-e-git/STATUS.md)
- O conteúdo apresentado é uma projeção de leitura, não uma ficha operacional atestada.
