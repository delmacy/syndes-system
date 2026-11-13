# Q10 — Quality Gates

> **Quality Gates — Q10.** Unidade proprietária de `tests/integrity`, que verifica estrutura mínima, AGENTS e catálogo. A política de qualidade transversal também referencia Q02–Q09 e os gates de produto, segurança e operação. **A existência de um teste estrutural não comprova produto aprovado.** Auditoria documental parcial em 12/11/2026.

<!-- syndes:module-id=Q10;source=tests/integrity;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais gates foram definidos e como são verificados?** | [Matriz dos gates](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [Referência técnica](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Critérios de qualidade por camada {#criterios}

- **Integridade estrutural:** `tests/integrity/repository-structure.sh` e contratos AGENTS sob owner Q10.
- **Build e regressão:** suites de Q02/Q03 e módulos, seleção por impacto/full na Q07.
- **Segurança e experiência:** Q04/Q05, cenários reais tenant A/B, OIDC, autorização, browser e falhas.
- **Operação:** Q06/Q08/Q09, stress, backup/restore, rollback e janela de release.
- **STATUS atual:** [CI principal com falha de paridade](STATUS.md), sem Product Gate aprovado.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **Políticas existentes e aprovação não são equivalentes à execução e ao aceite de suites: registrar cada etapa por SHA/ambiente.**

## Stack, contratos e persistência {#stack}

Q10 **não tem API HTTP, frontend operacional nem schemas próprios**. Sua [referência técnica](REFERENCIA-TECNICA.md) reúne testes de integridade, comandos, limites e relações com CI.

- **Fonte de código:** [`tests/integrity`](https://github.com/delmacy/syndes-system/tree/main/tests/integrity).
- **Regras de aceite:** [evidência mínima e contratos entre áreas](chapters/04-contratos-e-dependencias-publicas.md).
- **Persistência/identidade:** testes pertencem a Q03/Q05 e owners de banco e segurança.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `Q10`.
- **Caminho deste arquivo:** `docs/subprojects/Q10-quality-gates/README.md`.
- **Fonte do módulo:** `tests/integrity`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module Q10 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: tests/integrity
    - AGENTS global: AGENTS.md
    - AGENTS local: tests/integrity/AGENTS.md
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/Q10-quality-gates/ESCOPO.md
    - Status: docs/subprojects/Q10-quality-gates/STATUS.md
    - Sprint: docs/subprojects/Q10-quality-gates/SPRINT.md

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
