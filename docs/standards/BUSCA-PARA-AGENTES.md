# Busca para agentes e contratos de módulos

> **Padrão de consulta do Syndes Docs.** O objetivo é recuperar o menor contexto suficiente sem varrer 57 módulos. A busca abaixo lê arquivos locais do repositório e não usa rede, credenciais ou dados de clientes.

## Guia de busca por intenção

| Pergunta do agente | Comando |
|---|---|
| Qual é a stack do WhatsApp? | `python3 scripts/docs/query_registry.py --module P03` |
| Onde está a classe CrmService? | `python3 scripts/docs/query_registry.py --symbol CrmService` |
| Qual classe tem o método createPerson? | `python3 scripts/docs/query_registry.py --method createPerson` |
| Onde a tabela crm_people é declarada? | `python3 scripts/docs/query_registry.py --table crm_people` |
| Quais decorators HTTP pertencem à Inbox? | `python3 scripts/docs/query_registry.py --module P02 --route Get` |
| Quais arquivos de frontend têm nome CRM? | `python3 scripts/docs/query_registry.py --module P01 --frontend crm` |
| Quais artefatos estão na área? | `python3 scripts/docs/query_registry.py --area infraestrutura` |
| Quais componentes legados existem? | `python3 scripts/docs/query_registry.py --include-components --module I09` |
| Resposta estruturada para agente | Adicionar `--json` ao comando |

O extrator gera uma **referência de localização de código**. Para aprovar uma chamada entre módulos, verificar obrigatoriamente `package.json#exports` (ou contrato público explícito), autorização por tenant/organization/workspace, versão, tipo, semântica, efeitos e testes. Classes internas e métodos `private/protected` não são extensões públicas.

## Ancoragens permanentes

Em cada home `docs/subprojects/<ID>-<slug>/README.md`:

- `#acessos` — índice interno humano.
- `#capacidades` — requisitos e capacidades.
- `#stack` — stack e interfaces.
- `#evolucao` — planejamento e entregas.
- `#agentes` — contexto para pesquisas/prompt.

Na referência técnica construída pelo Pages:

- `#inventario-codigo` — inventário sintático.
- `#pacote-publico` — entrypoints/exports declarados.
- `#classes-e-interfaces` — símbolos encontrados.
- `#metodos` — métodos de classes.
- `#endpoints-http` — decorators de controller.
- `#frontend-identificado` — arquivos candidatos reais.
- `#schemas-sql` — tabelas e migrations encontradas.

Os links absolutos e identificadores correspondentes ficam no [registro estruturado JSON](https://delmacy.github.io/syndes-system/assets/catalog/modules.json), regenerado durante o build. Cada módulo possui um JSON detalhado `assets/catalog/<ID>.json`. Os títulos possuem marcas explícitas para minimizar quebras de deep links.

## Como o agente deve realizar uma alteração

1. Recuperar o módulo e o(s) símbolos envolvidos pelo ID com o comando de consulta.
2. Ler a especificação relevante por caminho e âncora, não todo o conjunto de módulos.
3. Conferir se a interface desejada é **pública** ou **privada**; não importar diretamente uma implementação interna de outro owner.
4. Ler contratos versionados, SQL, frontend e testes afetados pelo incremento.
5. Aplicar o prompt de **alteração rápida** se pontual; para mudança de requisito/capability abrir **projeção**, esclarecer ambiguidades e só depois implementar.
6. Atualizar escopo, referência técnica e diagramas; registrar WBS, commits, testes, deployment e aceite **apenas com provas verificáveis**.

**Nunca usar saída de inventário para inferir runtime ativo, migração aplicada ou autorização concedida.**
