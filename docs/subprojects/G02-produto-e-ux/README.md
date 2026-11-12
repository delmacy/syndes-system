# G02 — Produto e UX

> **Produto e experiência de uso — unidade G02.** Governança documental de escopo, PRDs, jornadas, requisitos, casos de uso e Product Gates. **G02 não é aplicação executável nem backend**; as interfaces pertencem a A01/A02/A03 e os comportamentos aos módulos de produto. Revisão parcial de fontes em 12/11/2026, sem homologação.

<!-- syndes:module-id=G02;source=docs/product;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais interfaces e contratos viabilizam a jornada?** | [Mapa de UX e owners](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [Referência técnica de fontes](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Matriz do produto e escopo {#matriz-produto}

- **Produto:** [MVP comercial e Basic](chapters/03-capabilities.md), [requisitos e casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md) e [exclusões](chapters/07-controle-do-escopo.md).
- **Fase inicial:** CRM → Inbox → WhatsApp → Gestão de Atendimentos Básica, sem antecipar Product Gate.
- **UX por público:** Workspace para o cliente, Platform Manager para metadados globais e Syndes Support para atendimento da fornecedora.
- **Fontes:** PRD-003A aprovado em 11/11; criador avançado F0–F8 permanece pós-MVP. Os STATUS dos módulos executáveis não foram alterados nesta revisão.

[STATUS de auditoria da G02](STATUS.md) · [Plano de atualização de todas as unidades](../../blueprint/PLANO-ATUALIZACAO-MODULOS.md).

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **A aprovação pertence ao PRD ou à decisão de produto original, não à simples presença na G02; implementação, integração e homologação são estados independentes.**

## Stack, contratos e persistência {#stack}

A G02 **não registra exports, classes, controllers ou schemas próprios**. Ela define comportamentos e aceites; contratos de API, dependências, persistência e componentes React pertencem a seus respectivos owners.

- **Fonte normativa da unidade:** [`docs/product`](https://github.com/delmacy/syndes-system/tree/main/docs/product).
- **Jornadas e dados:** [mapa de UX, domínios e entidades](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
- **Contratos por owner:** [matriz de dependências](chapters/04-contratos-e-dependencias-publicas.md) e [referência técnica](REFERENCIA-TECNICA.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `G02`.
- **Caminho deste arquivo:** `docs/subprojects/G02-produto-e-ux/README.md`.
- **Fonte do módulo:** `docs/product`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module G02 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: docs/product
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/G02-produto-e-ux/ESCOPO.md
    - Status: docs/subprojects/G02-produto-e-ux/STATUS.md
    - Sprint: docs/subprojects/G02-produto-e-ux/SPRINT.md

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
