# I07 — Tailnet

> **Componente técnico/histórico.** Esta é a entrada humana do módulo: navegue pelas seis páginas abaixo. Código e documentação técnica podem existir sem estar implantados ou homologados.

<!-- syndes:module-id=I07;source=infra/master-admin/check-tailnet-route.py;kind=component -->

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

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **O conteúdo da especificação define o que é aprovado; presença de um item na documentação não comprova implementação.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) lista exports de pacote, interfaces públicas, declarações internas de classes/métodos, APIs HTTP identificadas, candidatos de frontend e objetos SQL com origem verificável.

- **Fonte do código/artefato:** [`infra/master-admin/check-tailnet-route.py`](https://github.com/delmacy/syndes-system/tree/main/infra/master-admin/check-tailnet-route.py).
- **Banco de tenant e Control/Manager:** [seção de persistência da referência](REFERENCIA-TECNICA.md).
- **Contrato público vs. interno:** [referência técnica](REFERENCIA-TECNICA.md).
- **Módulo pai:** [ I02 — Hospedagem e ambientes ](../I02-server02/README.md).

## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `I07`.
- **Caminho deste arquivo:** `docs/subprojects/I07-tailnet/README.md`.
- **Fonte do módulo:** `infra/master-admin/check-tailnet-route.py`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module I07 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: infra/master-admin/check-tailnet-route.py
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/I07-tailnet/ESCOPO.md
    - Status: docs/subprojects/I07-tailnet/STATUS.md
    - Sprint: docs/subprojects/I07-tailnet/SPRINT.md

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

## Capítulos temáticos independentes — auditoria I07

- [00 — Endereços exatos de leitura](chapters/00-enderecos-exatos-de-leitura.md)
- [01 — Missão, objetivos e fronteiras](chapters/01-missao-objetivos-e-fronteiras.md)
- [02 — Requisitos, histórias e casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md)
- [03 — Capabilities](chapters/03-capabilities.md)
- [04 — Contratos e dependências públicas](chapters/04-contratos-e-dependencias-publicas.md)
- [05 — Arquitetura, banco, interface e configuração](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md)
- [06 — WBS, marcos e aceite](chapters/06-wbs-marcos-e-aceite.md)
- [07 — Controle do escopo](chapters/07-controle-do-escopo.md)

A revisão de 2026-11-14 comprova apenas a existência e o comportamento legível da fonte Python, não teste, implantação ou homologação.
