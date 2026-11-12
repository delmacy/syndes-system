# SYNDES — MODELO DE ALTERAÇÃO RÁPIDA

> Use somente para ajustes **pequenos, específicos e suficientemente claros** dentro de um módulo. Para nova funcionalidade, risco de contrato ou ambiguidade, usar **Projeção/Planejamento**. Para um incremento aprovado com WBS e testes, usar **Implementação**.

**Módulo:** [ID e nome]
**Mudança solicitada:** Altere [X] do módulo [ID/nome] para que [resultado esperado].
**Caminho direto:** `[docs/subprojects/ID-slug/chapters/NN-assunto.md]`
**Código próprio:** `[path do módulo]`
**Estado:** `[docs/subprojects/ID-slug/STATUS.md]`
**Contexto:** `[AGENTS.md, AGENTS local, contratos públicos necessários]`

**Execute exclusivamente o ajuste descrito**, confirmando o estado existente e reutilizando contratos e bibliotecas públicas. Não modifique outros módulos nem amplie o escopo. Teste o que foi afetado, atualize o STATUS com evidências e encerre a tarefa. Se houver ambiguidade relevante, mudança de contrato, migração ou nova capability sem aprovação, **não programe**: indique o impedimento e encaminhe para Projeção/Planejamento.

## Quando usar qual prompt

- **Projeção/Planejamento:** conceber, discutir, esclarecer e especificar antes de aprovar.
- **Implementação:** executar requisito aprovado, critérios de aceite e WBS.
- **Alteração rápida:** correção ou ajuste local pontual, sem gerar um projeto novo.

A caixa de edição do Syndes Docs permite copiar a alteração contextual já preenchida com módulo, documento e tópico. Nada é implementado automaticamente pelo GitHub Pages.
