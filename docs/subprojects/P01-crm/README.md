# P01 — CRM

> **Unidade do catálogo Syndes.** Esta é a entrada humana do módulo: navegue pelas seis páginas abaixo. Código e documentação técnica podem existir sem estar implantados ou homologados.

<!-- syndes:module-id=P01;source=modules/core-crm;kind=module -->

## Ficha Mestre e ações detalhadas — 14/11/2026

- [Ficha Mestre P01](FICHA-MODULO.md) — aplicação das 22 dimensões do modelo v1.0.0 congelado.
- [Matriz das 18 ações](MATRIZ-ACOES.md) — contratos, APIs, diagramas e edge cases por ação.
- [Exemplo: ficha Criar contato](acoes/crm-create-person.md).
- Esta consolidação **não é homologação, implementação de funcionalidade nem aprovação de requisito novo**.

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Como funciona do banco à interface?** | [Referência técnica: stack, classes e contratos](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/04-catalogo-de-capabilities-propostas-para-rastreabilidade.md) e [histórias/casos de uso](chapters/03-publico-atores-e-jornada-principal.md). **O conteúdo da especificação define o que é aprovado; presença de um item na documentação não comprova implementação.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) lista exports de pacote, interfaces públicas, declarações internas de classes/métodos, APIs HTTP identificadas, candidatos de frontend e objetos SQL com origem verificável.

- **Fonte do código/artefato:** [`modules/core-crm`](https://github.com/delmacy/syndes-system/tree/main/modules/core-crm).
- **Banco de tenant e Control/Manager:** [seção de persistência da referência](REFERENCIA-TECNICA.md).
- **Contrato público vs. interno:** [referência técnica](REFERENCIA-TECNICA.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `P01`.
- **Caminho deste arquivo:** `docs/subprojects/P01-crm/README.md`.
- **Fonte do módulo:** `modules/core-crm`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module P01 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: modules/core-crm
    - AGENTS global: AGENTS.md
    - AGENTS local: modules/core-crm/AGENTS.md
    - Package/exports: modules/core-crm/package.json
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/P01-crm/ESCOPO.md
    - Status: docs/subprojects/P01-crm/STATUS.md
    - Sprint: docs/subprojects/P01-crm/SPRINT.md

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


## Atlas de implementação (13/11/2026)

- [Inventário integral: 30 rotas, 9 tabelas, assinaturas e rastreabilidade](INVENTARIO-INTEGRAL.md)
- [Diagramas: arquitetura, persistência, fluxo HTTP, eventos, segurança e gates](DIAGRAMAS.md)

Esses documentos registram a superfície do código e **não encerram** o Product Gate.
