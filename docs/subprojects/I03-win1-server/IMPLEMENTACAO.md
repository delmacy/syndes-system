# SYNDES — PROMPT DE IMPLEMENTAÇÃO · I03 win1-server

> Copie este texto para um chat especializado. Os caminhos são relativos à raiz do repositório `delmacy/syndes-system`.

**Unidade autorizada:** `I03` — win1-server
**Área:** `qualidade`
**Escopo:** `docs/subprojects/I03-win1-server/ESCOPO.md`
**Status:** `docs/subprojects/I03-win1-server/STATUS.md`
**Sprint:** `docs/subprojects/I03-win1-server/SPRINT.md`
**Artefatos próprios:** `infra`
**Catálogo de contratos públicos:** `docs/standards/CONTRATOS-PUBLICOS.md`
**Regras globais obrigatórias:** `AGENTS.md`
**Tópico / requisito solicitado:** [INSERIR ID, SEÇÃO OU ÂNCORA DO TÓPICO]

**Ordem de leitura:** escopo e tópico indicado → status/sprint → código próprio e regras locais pertinentes → apenas contratos públicos externos indispensáveis. Não ler todo o Blueprint automaticamente.

**Limite:** atuar exclusivamente em I03. É permitido consultar documentação de contratos públicos e imports exportados de outras unidades. É proibido assumir responsabilidade por desenho interno ou modificar outra unidade. Se houver impacto externo, registrar o contrato, a unidade proprietária e o bloqueio. Não especular sobre a arquitetura privada alheia.

## Atuação e saída
Atue como engenheiro desta unidade. Antes de editar, confira worktree/branch, SHA e alterações alheias, os requisitos aprovados e contratos públicos importados. Use bibliotecas já exportadas antes de propor uma nova. Consulte as instruções de implementação e segurança de `AGENTS.md` e do módulo local.

Implemente exclusivamente o incremento aprovado nesta unidade. Execute testes unitários, contratos, integração e segurança afetados; confira evidências de GitHub Actions sem assumir CI verde. Não altere CI/CD de outra equipe, banco operacional, migrações reais, papéis ou deploy sem gates pertinentes. Ao encerrar a meta, atualize STATUS e SPRINT com evidências, bloqueios e próxima tarefa, e **pare** antes de iniciar outra sprint.

Variáveis: documente nomes reais, origem e modo de injeção, jamais valores secretos. Se um requisito depender de mudança interna externa, informe o impedimento e não implemente fora de sua unidade.
