# I10 — Backup e Restore

> **Unidade do catálogo Syndes.** Esta é a entrada humana do módulo: navegue pelas seis páginas abaixo. Código e documentação técnica podem existir sem estar implantados ou homologados.

<!-- syndes:module-id=I10;source=scripts/events/disposable_restore_drill.py;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Como funciona do banco à interface?** | [Referência técnica: stack, classes e contratos](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |


## Capítulos temáticos independentes

| Assunto | Página |
|---|---|
| Visão geral | [00](chapters/00-visao-geral.md) |
| Arquitetura e fronteiras | [01](chapters/01-arquitetura-e-fronteiras.md) |
| Requisitos e casos de uso | [02](chapters/02-requisitos-historias-e-casos-de-uso.md) |
| Capabilities | [03](chapters/03-capabilities.md) |
| Contratos, APIs e eventos | [04](chapters/04-contratos-apis-eventos.md) |
| Dados e persistência | [05](chapters/05-dados-e-persistencia.md) |
| Testes e evidências | [06](chapters/06-testes-e-evidencias.md) |
| Riscos e próximos passos | [07](chapters/07-riscos-e-proximos-passos.md) |

As oito páginas são arquivos separados, não âncoras da mesma página. Os estados nelas descritos são de auditoria parcial.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **O conteúdo da especificação define o que é aprovado; presença de um item na documentação não comprova implementação.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) lista exports de pacote, interfaces públicas, declarações internas de classes/métodos, APIs HTTP identificadas, candidatos de frontend e objetos SQL com origem verificável.

- **Fonte do código/artefato:** [`scripts/events/disposable_restore_drill.py`](https://github.com/delmacy/syndes-system/tree/main/scripts/events/disposable_restore_drill.py).
- **Banco de tenant e Control/Manager:** [seção de persistência da referência](REFERENCIA-TECNICA.md).
- **Contrato público vs. interno:** [referência técnica](REFERENCIA-TECNICA.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `I10`.
- **Caminho deste arquivo:** `docs/subprojects/I10-backup-e-restore/README.md`.
- **Fonte do módulo:** `scripts/events/disposable_restore_drill.py`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module I10 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: scripts/events/disposable_restore_drill.py
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/I10-backup-e-restore/ESCOPO.md
    - Status: docs/subprojects/I10-backup-e-restore/STATUS.md
    - Sprint: docs/subprojects/I10-backup-e-restore/SPRINT.md

    Leia somente o escopo desta unidade, o status, a sprint, as instruções operacionais obrigatórias e os contratos públicos diretamente necessários. Não assuma responsabilidade interna por outros módulos.

    7. **Assuntos editáveis:** [Capítulos da especificação](ESCOPO.md) · [Atualizações e propostas](updates/README.md).

    8. **Alteração rápida:** [Prompt curto por módulo](ALTERACAO.md).
    9. **Evolução planejada:** [Workpackages e tasks](EVOLUCAO.md).


    ## Mapa documental integrado

    | Página | Objetivo |
    |---|---|
    | [Especificação](ESCOPO.md) | Requisitos, histórias de usuário, regras de negócio e diagramas aprovados |
    | [Referência técnica](REFERENCIA-TECNICA.md) | Stack, métodos, contratos públicos, frontend e schemas |
    | [Evolução](EVOLUCAO.md) | WBS, workpackages, tasks, dependências e planejamento |
    | [Histórico](HISTORICO.md) | Linha do tempo dos commits de código/documentação e vínculos de evidência |
    | [Operação](OPERACAO.md) | Status, sprint, gates, runbooks e os três prompts de agentes |

    **Fonte de verdade:** o catálogo define o proprietário; o Git registra as alterações; Issues/Projects cuidam da execução; Actions e evidências de ambiente comprovam testes/deploy. Não promover status por inferência.
