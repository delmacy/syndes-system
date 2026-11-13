# Q01 — Plataforma de testes

> **Plataforma de testes — Q01.** Conjunto de cenários, políticas e scripts de infraestrutura e segurança distribuídos em `tests/`, módulos e apps. A auditoria documenta **quais testes existem**, os ambientes e limites das provas. O CI do SHA `bd0aa69` foi aprovado; performance e Product Gates permanecem sem homologação.

<!-- syndes:module-id=Q01;source=tests;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais scripts e ambientes verificam o sistema?** | [Arquitetura/fixtures](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [Referência técnica](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Mapa de provas por camada {#mapa-provas}

- **Integridade:** Q10 verifica catálogo, AGENTS e estrutura mínima.
- **Integração e segurança:** Q01 mantém scripts em `tests/platform`; os módulos executam suas próprias suites.
- **Orquestração:** Q07 seleciona e executa as suites sob GitHub Actions; o [run auditado](https://github.com/delmacy/syndes-system/actions/runs/43340637846) passou 24/24 jobs no SHA `bd0aa69`.
- **Performance e RC:** cenários de carga previstos por estratégia, **sem benchmark ou restore operacional comprovado**.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **Um AGENTS ou script existente não é um teste executado, e CI aprovado não substitui Product Gate ou deploy.**

## Stack, contratos e persistência {#stack}

Q01 **não expõe endpoint, classe de domínio, frontend ou schema próprios**. Sua [referência técnica](REFERENCIA-TECNICA.md) apresenta scripts, comandos e efeitos, com ownership e restrições de segurança.

- **Fonte canônica:** [`tests/`](https://github.com/delmacy/syndes-system/tree/main/tests).
- **Contratos de execução:** [matriz de entradas e saídas](chapters/04-contratos-e-dependencias-publicas.md).
- **Banco/identidade:** apenas fixtures descartáveis; responsabilidades de runtime permanecem com seus owners.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `Q01`.
- **Caminho deste arquivo:** `docs/subprojects/Q01-plataforma-de-testes/README.md`.
- **Fonte do módulo:** `tests`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module Q01 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: tests
    - AGENTS global: AGENTS.md
    - AGENTS local: tests/AGENTS.md
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/Q01-plataforma-de-testes/ESCOPO.md
    - Status: docs/subprojects/Q01-plataforma-de-testes/STATUS.md
    - Sprint: docs/subprojects/Q01-plataforma-de-testes/SPRINT.md

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
