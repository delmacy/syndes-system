# Auditoria I08 — Komodo (checkpoint parcial, 2026-11-13)

**Base GitHub:** `891559a6cb8f2e4f0c64e561cad175911ec947d2` (main, verificado antes da branch). **Owner:** I08; pai I02; `source: infra` no catálogo `docs/subprojects/index.json`. **Escopo:** leitura do GitHub MCP exclusivamente. Não houve acesso ao runtime, segredos, SQL, migrations, workflows, CI de produto ou alteração de código.

## Evidência documental verificada

- `docs/subprojects/I08-komodo/STATUS.md`: baseline documental **SEM AUDITORIA FUNCIONAL**, estado operacional não verificado; WBS `I08.DOC.01` pendente de revisão.
- `docs/subprojects/I08-komodo/REFERENCIA-TECNICA.md`: declara inventário não auditado, classes, métodos, APIs e consumers ainda a auditar; nenhuma migration em subpasta SQL da fonte genérica identificada nesse documento, **não** evidência de ausência de persistência.
- `docs/subprojects/I08-komodo/OPERACAO.md`: índice de fontes, **não** runbook homologado; exige validação de grants, migrations, testes e rollback antes de operação.
- `docs/subprojects/I08-komodo/ESCOPO.md`: rascunho não aprovado, capítulos temáticos independentes; `chapters/04-contratos-e-dependencias-publicas.md` mantém entradas/saídas, APIs, eventos e ports **A INVENTARIAR**.
- `docs/engineering/WORKSPACE-DEVSERVER01-RUNBOOK.md`: declara explicitamente **Komodo e cadastro de stacks fora do procedimento Workspace**. Evidências de Workspace/Traefik não podem ser atribuídas ao I08.
- `docs/subprojects/I08-komodo/HISTORICO.md`: não fornece evidência de deploy ou aceite.

## Matriz de contratos e limites

| Dimensão | Evidência efetivamente inspecionada | Conclusão |
|---|---|---|
| Ownership | catálogo I08 `source: infra`, pai I02 | Escopo de fonte é **diretório compartilhado**, não pacote Komodo delimitado; não atribuir todo `infra` ao I08 |
| Contratos públicos/privados | capítulo 04 e referência técnica | **Não inventariados**; nenhum export, port, consumer ou versão homologado |
| Classes/métodos | referência técnica sem símbolos auditados | **Não comprovados** |
| HTTP APIs / eventos | capítulos de contratos sem endpoint/evento verificado | **Não comprovados**, não afirmar ausência |
| Banco/schema/migrations | referência técnica apenas genérica | Nenhuma migration **atribuível com segurança** a I08 nesta leitura; não afirmar ausência de SQL no repositório |
| Frontend | referência técnica sem telas verificadas | **Não comprovado** |
| Testes | nenhum teste de I08 localizado/inspecionado neste checkpoint | **Não executados**; nenhum gate de integração atribuído |
| Operação/deploy | STATUS e OPERACAO sem prova | **Não verificado, não homologado** |

## Limitação da descoberta

A tentativa GitHub MCP `fetch_file(path=infra)` foi recusada porque o caminho é um **diretório**, e buscas GitHub MCP por `komodo`, `compose.komodo`, `KOMODO` e `komodo-core` retornaram **zero resultados**. Resultado de busca zero **não comprova ausência de arquivos**. Falta inventário recursivo do diretório `infra` por uma ferramenta GitHub de árvore/listagem, ou caminhos exatos provenientes de uma fonte versionada; não recorrer ao DevServer para substituir GitHub como fonte. Esta é uma lacuna **de auditoria**, não uma divergência corrigida.

## Continuidade e gates

1. Obter árvore versionada de `infra` no GitHub; identificar manifests, serviços, imagens, portas, redes, mounts, nomes de containers e eventuais arquivos de testes atribuíveis a Komodo, separando código de terceiros e outros owners.
2. Comparar símbolos/rotas/contratos públicos e privados reais, dependências, eventos, schemas/migrations e testes com os capítulos temáticos; registrar caminhos, linhas e SHAs.
3. Executar **somente testes isolados, não mutáveis, quando necessários e autorizados**; registrar comando e resultado. Nesta rodada **nenhum teste executado**.
4. Atualizar STATUS/REFERENCIA/OPERACAO somente após evidência de fonte e revisão; nunca promover a implantado ou homologado por existência de arquivo.
5. Reconciliar catálogo completo de 57 unidades **mais owners descobertos**, em rodada própria, com revisão e Pages SHA. **Não concluído** neste checkpoint.

**Decisão:** manter I08 em baseline documental, auditoria parcial e bloqueada por inventário de código incompleto. Não alterar contratos ou status canônicos nesta branch; checkpoint exclusivamente documental.
