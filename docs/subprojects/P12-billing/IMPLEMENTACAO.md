# SYNDES — PROMPT DE IMPLEMENTAÇÃO · P12 Billing

> Copie este texto para um chat especializado. Os caminhos são relativos à raiz do repositório `delmacy/syndes-system`.

**Unidade autorizada:** `P12` — Billing
**Área:** `operacao`
**Escopo:** `docs/subprojects/P12-billing/ESCOPO.md`
**Planejamento por workpackages:** `docs/subprojects/P12-billing/EVOLUCAO.md`
**Status:** `docs/subprojects/P12-billing/STATUS.md`
**Sprint:** `docs/subprojects/P12-billing/SPRINT.md`
**Artefatos próprios:** `modules/billing`
**Catálogo de contratos públicos:** `docs/standards/CONTRATOS-PUBLICOS.md`
**Regras globais obrigatórias:** `AGENTS.md`
**Tópico / requisito solicitado:** [INSERIR ID, SEÇÃO OU ÂNCORA DO TÓPICO]

**Ordem de leitura:** escopo e tópico indicado → status/sprint → código próprio e regras locais pertinentes → apenas contratos públicos externos indispensáveis. Não ler todo o Blueprint automaticamente.

**Limite:** atuar exclusivamente em P12. É permitido consultar documentação de contratos públicos e imports exportados de outras unidades. É proibido assumir responsabilidade por desenho interno ou modificar outra unidade. Se houver impacto externo, registrar o contrato, a unidade proprietária e o bloqueio. Não especular sobre a arquitetura privada alheia.

## Atuação e saída
Atue como engenheiro desta unidade. Antes de editar, confira worktree/branch, SHA e alterações alheias, os requisitos aprovados e contratos públicos importados. Use bibliotecas já exportadas antes de propor uma nova. Consulte as instruções de implementação e segurança de `AGENTS.md` e do módulo local.

Implemente exclusivamente o incremento aprovado nesta unidade. Execute testes unitários, contratos, integração e segurança afetados; confira evidências de GitHub Actions sem assumir CI verde. Não altere CI/CD de outra equipe, banco operacional, migrações reais, papéis ou deploy sem gates pertinentes. Ao encerrar a meta, atualize STATUS e SPRINT com evidências, bloqueios e próxima tarefa, e **pare** antes de iniciar outra sprint.

Variáveis: documente nomes reais, origem e modo de injeção, jamais valores secretos. Se um requisito depender de mudança interna externa, informe o impedimento e não implemente fora de sua unidade.

## Controle de incrementos aprovados

Para novas capacidades e atualizações, **não execute diretamente uma Issue bruta**. Exija o documento `docs/subprojects/P12-billing/updates/P12-UPD-[NNNN]/REQUISITO.md` aprovado e seu `IMPLEMENTACAO.md` específico. Confira os IDs, versão, decisão e gates contra o capítulo normativo e o STATUS. Se ausentes ou ambíguos, encaminhe para a projeção e pare.

Conclua somente a meta aprovada da unidade, teste contratos públicos impactados, obtenha evidências do Actions e atualize STATUS/SPRINT. Não mova trabalho para outro módulo nem trate melhoria apenas desejada como autorização de implementação.
