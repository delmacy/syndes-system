# Q09 — Infra Tests | Atualizações e propostas

> **Caixa de entrada lógica.** A origem das sugestões é a Issue do GitHub; este índice não significa requisito aprovado.

## Acesso direto aos assuntos para propor mudanças

- [Registrar uma nova capacidade no capítulo correto](../chapters/03-capabilities.md)
- [Registrar história de usuário ou caso de uso](../chapters/02-requisitos-historias-e-casos-de-uso.md)
- [Consultar o escopo consolidado](../ESCOPO.md)

## Adicionar uma capacidade, história ou alteração

Abra o [índice de capítulos](../ESCOPO.md), escolha o assunto e clique **Propor alteração neste tópico** → **Copiar prompt de projeção** ou **Enviar à caixa de entrada**.

Para ideia sem tópico existente, escolha a área apropriada: capacidades, requisitos/histórias, integração, banco, UX ou qualidade. Não altere o Markdown normativo diretamente para registrar uma ideia que ainda precisa de discussão.

- [Abrir a caixa de entrada desta unidade no GitHub](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20is%3Aopen%20%22%5BSyndes%20Docs%5D%5BQ09%5D%22)
- [Criar nova solicitação no GitHub](https://github.com/delmacy/syndes-system/issues/new)
- [Prompt de projeção desta unidade](../PROJECAO.md)
- [Prompt de implementação desta unidade](../IMPLEMENTACAO.md)

**Identificação obrigatória:** `[Syndes Docs][Q09]` no título, caminho do capítulo, seção/tópico, SHA da fonte, descrição da proposta e objetivo.

## Fluxo de aprovação

`PROPOSTA → EM ANÁLISE → ESCLARECIMENTO → APROVADA → PRONTA PARA IMPLEMENTAÇÃO → IMPLEMENTADA → TESTADA / ACEITA`.

**Nunca** tratar uma issue ou sugestão como autorização automática para executar código. Após sua aprovação explícita, o agente de projeção atualiza o capítulo de destino e cria a especificação de implementação versionada nesta pasta, por exemplo `updates/Q09-UPD-0001/REQUISITO.md` e `updates/Q09-UPD-0001/IMPLEMENTACAO.md`, usando `docs/standards/TEMPLATE-ATUALIZACAO.md`. A implementação só começa quando a atualização possui critérios de aceite e a autorização correspondente; ao concluir, atualizar STATUS e SPRINT.

**Escopo resumido:** [ESCOPO.md](../ESCOPO.md) (`docs/subprojects/Q09-infra-tests/ESCOPO.md`).
