# P14 — Platform Core

> **Platform Core (P14) é uma fronteira de arquitetura, não um runtime.** `modules/platform-core` contém apenas `AGENTS.md`; os contratos executáveis pertencem ao Core Kernel (A08), ao Core Host (A04) e aos owners de segurança, Control e domínio. **Auditoria documental parcial**, com CI da baseline aprovado por SHA e perfis CMP ainda não implementados.

<!-- syndes:module-id=P14;source=modules/platform-core;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais contratos são Kernel, Host ou módulos?** | [Referência por owner](REFERENCIA-TECNICA.md) · [Fronteiras e métodos](chapters/04-contratos-e-dependencias-publicas.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Mapa das responsabilidades {#mapa-core}

- **P14:** mapa de governança transversal e fronteiras de arquitetura — não é um processo.
- **A08:** [`@syndes/core-kernel`](https://github.com/delmacy/syndes-system/tree/main/packages/core-kernel), ports, contratos, module registry e envelopes de eventos.
- **A04:** [`Core Host`](https://github.com/delmacy/syndes-system/tree/main/apps/core-host), NestJS, composição, autenticação, adapters e trusted plugins.
- **Control, Identity, FGA e módulos:** processos e dados pertencentes aos respectivos owners, com gating de tenant/ENABLED.
- **Perfis de implantação CMP:** [ADR e matriz de gates](chapters/06-wbs-marcos-e-aceite.md), ainda **não implementados/homologados**.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **Esta especificação registra fontes e decisões; publicação no Docs ou CI verde não equivale a um Core por perfil instalado nem a Product Gate.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) identifica **símbolos públicos do Kernel** e **rotas internas do Host**, sem atribuí-los ao P14. **P14 não possui APIs, frontend ou migrations próprios.**

- **Regras P14:** [`modules/platform-core/AGENTS.md`](https://github.com/delmacy/syndes-system/blob/main/modules/platform-core/AGENTS.md).
- **Contratos:** [matriz de exports, ports e interfaces](chapters/04-contratos-e-dependencias-publicas.md).
- **Banco:** Control e tenant DB pertencem às respectivas unidades; o P14 não instala DDL.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `P14`.
- **Caminho deste arquivo:** `docs/subprojects/P14-platform-core/README.md`.
- **Fonte do módulo:** `modules/platform-core`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module P14 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: modules/platform-core
    - AGENTS global: AGENTS.md
    - AGENTS local: modules/platform-core/AGENTS.md
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/P14-platform-core/ESCOPO.md
    - Status: docs/subprojects/P14-platform-core/STATUS.md
    - Sprint: docs/subprojects/P14-platform-core/SPRINT.md

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
