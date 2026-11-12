# Execução do programa e GitHub Project

> **Estado verificável:** sete Issues de planejamento estão identificadas no repositório com o label `syndes-docs-workpackage`. **A entrada no GitHub Project ainda não foi executada/confirmada**: é necessário autorizar acesso à API de Projects. Não confundir Issue existente com item do quadro.

## Workpackages documentais

| Workpackage | GitHub Issue | Foco | Estado de integração ao Project |
|---|---|---|---|
| DOC-01 | [#107](https://github.com/delmacy/syndes-system/issues/107) | Home humana, navegação por áreas e ambientes | Pendente de sync |
| DOC-02 | [#108](https://github.com/delmacy/syndes-system/issues/108) | Inventário técnico, contratos public/private, API, frontend e SQL | Pendente de sync |
| DOC-03 | [#109](https://github.com/delmacy/syndes-system/issues/109) | Sincronização e autorização do GitHub Projects | **Bloqueado por permissão Projects** |
| DOC-04 | [#110](https://github.com/delmacy/syndes-system/issues/110) | Busca para agentes por ID, método, symbol, tabela e ancoragens | Pendente de sync |

## Workpackages já existentes no programa

| Referência | Issue real | Conteúdo |
|---|---|---|
| WBS mestre | [#60](https://github.com/delmacy/syndes-system/issues/60) | Estrutura de tarefas, dependências e Product Gates |
| Release P0 | [#101](https://github.com/delmacy/syndes-system/issues/101) | Integração e gates anteriores à evolução modular |
| Composição modular | [#104](https://github.com/delmacy/syndes-system/issues/104) | Ports & Adapters, perfis do Core Host |

Todos os sete itens acima possuem o label `syndes-docs-workpackage`, que é o filtro de importação. Os campos Status, Iteration, Start Date, Target Date e Owner devem ser mantidos no **GitHub Project real**. Nenhuma data ou responsável foi atribuída por esta documentação.

## Como concluir o vínculo com o GitHub Project

1. Informar o [endereço do Project](https://github.com/users/delmacy/projects) existente em `SYNDES_PROJECT_URL` (Actions variable).
2. Conceder autorização de **Projects** por meio do secret `SYNDES_PROJECTS_PAT`, seguindo o [guia de configuração](../standards/GITHUB-PROJECTS.md).
3. Executar o workflow [Syndes Docs — sincronizar workpackages com GitHub Projects](https://github.com/delmacy/syndes-system/actions/workflows/syndes-docs-project-sync.yml) em **dry-run**.
4. Executar o backfill real, conferir os sete itens no Project e registrar Issue, run e URL do quadro como evidências.

**Sem essa configuração, o Project permanece vazio ou incompleto.** A automação foi preparada para funcionar de forma idempotente, mas não foi acionada com token de Projects nesta implementação.

## Evidências e documentos

- [Linha do tempo realizada do produto](LINHA-DO-TEMPO.md).
- [Navegação técnica por módulo](CATALOGO-MODULOS.md).
- [Fontes de verdade](../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
- [Módulos e workpackages planejados](../subprojects/README.md).

O portal de documentação é uma interface de leitura integrada; **não** é uma cópia do estado do GitHub Projects. O Project será a fonte de andamento após a sincronização autorizada.
