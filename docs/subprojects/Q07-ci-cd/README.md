# Q07 — CI/CD

> **CI central — Q07.** Unidade de engenharia responsável pela seleção, execução e paridade dos testes no `main`. **Revisão parcial com correção técnica testada localmente:** a publicação dos Docs e o sync Projects são workflows auxiliares, e Gestão de Atendimentos agora tem suite PG17 própria. CI global e Product Gate só serão considerados aprovados após prova no SHA remoto.

<!-- syndes:module-id=Q07;source=scripts/ci/plan.mjs;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Como o CI é planejado, executado e auditado?** | [Mapa de triggers e gates](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [Referência técnica](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Critérios de execução e cobertura {#visao-ci}

- **Mainline:** `syndes-ci.yml` coordena `foundation`, seleção por impacto/full, regressões, paridades e gate.
- **Workflows auxiliares:** Docs Pages e Projects têm gatilhos específicos e não criam outro pipeline de PR.
- **Cobertura ampliada:** 15 suites instaladas com `service-management`; PG17 descartável validado localmente.
- **Estado real:** [STATUS](STATUS.md) distingue prova local e resultado do CI remoto; não confundir testes com deploy.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **O resultado de um teste local não equivale a execução do GitHub Actions no mesmo SHA nem a homologação operacional.**

## Stack, contratos e persistência {#stack}

Q07 **não possui API HTTP, frontend de produto nem banco próprio**. A [referência técnica](REFERENCIA-TECNICA.md) descreve o planner Node, o runner Bash, a matriz JSON, os gatilhos YAML e os requisitos de evidência.

- **Fonte principal:** [`scripts/ci/plan.mjs`](https://github.com/delmacy/syndes-system/blob/main/scripts/ci/plan.mjs).
- **Contratos:** [matriz e dependências](chapters/04-contratos-e-dependencias-publicas.md).
- **Serviços descartáveis:** PostgreSQL 17 somente para testes de Serviço, sem migrations operacionais.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `Q07`.
- **Caminho deste arquivo:** `docs/subprojects/Q07-ci-cd/README.md`.
- **Fonte do módulo:** `scripts/ci/plan.mjs`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module Q07 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: scripts/ci/plan.mjs
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/Q07-ci-cd/ESCOPO.md
    - Status: docs/subprojects/Q07-ci-cd/STATUS.md
    - Sprint: docs/subprojects/Q07-ci-cd/SPRINT.md

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
