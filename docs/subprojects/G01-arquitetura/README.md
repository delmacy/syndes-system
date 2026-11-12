# G01 — Arquitetura

> **Arquitetura transversal do Syndes (G01).** Unidade de **governança técnica**, com owner documental em `docs/engineering`: registra decisões, fronteiras, integrações e critérios de conformidade. **Não é pacote de runtime, API ou banco de dados.** A revisão do escopo e do status está em auditoria parcial, sem homologação operacional.

<!-- syndes:module-id=G01;source=docs/engineering;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais são as fronteiras e o desenho?** | [Mapa lógico e matrizes](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) · [Referência de owners](REFERENCIA-TECNICA.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## O que a G01 documenta {#fronteiras}

- **Core:** fronteiras entre A08 Kernel, A04 Host e módulos de domínio; plugin instalado não significa módulo ativo para todo tenant.
- **Segurança:** separação Control/Tenant, Keycloak, OpenFGA, OpenBao e autorização fail-closed.
- **Dados e eventos:** bancos por tenant, catálogo Control, ownership de schemas e Event Bus/outbox em planos distintos.
- **Frontends:** Manager, Workspace e Support separados; `front-shared` é visual, sem compartilhar sessão.
- **Governança:** fonte de decisão/ADR, matriz de dependências, divergências de documentação e gates pendentes.

**Nesta revisão:** a [descrição arquitetural](chapters/01-missao-objetivos-e-fronteiras.md), as [matrizes e o diagrama lógico](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) e o [STATUS auditado](STATUS.md) foram vinculados ao código examinado. As regras de cada produto pertencem aos seus próprios owners.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **O conteúdo da especificação define o que é aprovado; presença de um item na documentação não comprova implementação.**

## Stack, contratos e persistência {#stack}

A G01 **não exporta classes, métodos, APIs nem schemas**. Sua referência é documental; as interfaces operacionais ficam nos owners e são consultadas por [catálogo técnico](../../blueprint/CATALOGO-MODULOS.md). O mapeamento dos contratos e da persistência está nos [capítulos de contratos](chapters/04-contratos-e-dependencias-publicas.md) e de [arquitetura e dados](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).

- **Fonte da unidade:** [`docs/engineering`](https://github.com/delmacy/syndes-system/tree/main/docs/engineering).
- **Banco de tenant e Control:** responsabilidade de I04, C01, A04 e dos módulos donos dos dados.
- **Contrato público vs. interno:** Kernel e cada `package.json#exports`, não a G01.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `G01`.
- **Caminho deste arquivo:** `docs/subprojects/G01-arquitetura/README.md`.
- **Fonte do módulo:** `docs/engineering`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module G01 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: docs/engineering
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/G01-arquitetura/ESCOPO.md
    - Status: docs/subprojects/G01-arquitetura/STATUS.md
    - Sprint: docs/subprojects/G01-arquitetura/SPRINT.md

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
