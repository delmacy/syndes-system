# I02 — Hospedagem e ambientes

> **Hospedagem por ambiente e função (I02).** Auditoria **parcial** com observação somente leitura do Docker no DevServer01 em 12/11/2026. **Staging e produção não foram verificados**, e o caminho físico histórico `I02-server02` não define o ambiente. Serviços observados não significam deploy homologado.

<!-- syndes:module-id=I02;source=infra;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais ambientes, containers e serviços existem?** | [Inventário observado e manifests](REFERENCIA-TECNICA.md) · [Diagrama e paridade por serviço](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Ambientes e evidências {#ambientes}

- **Desenvolvimento:** DevServer01 — **16 containers Up**, incluindo PostgreSQL, Keycloak, OpenFGA, OpenBao, Traefik/Komodo, Core Host, Workspace e WhatsApp. São metadados observados, não aceite de serviços.
- **Homologação / staging:** manifests e scripts identificados, **nenhuma instalação homologada confirmada**.
- **Produção:** **não verificada** — os conectores de `win1-server` e `server02` estavam offline na coleta; isso não comprova que os servidores estejam parados.
- **Riscos:** previews/cutovers e um PG17 de teste sem owner reconciliado, versões/digests e roteamento a auditar.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **A existência de Compose ou de container Up não comprova health funcional, backups, staging/produção ou aceite.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) documenta Compose, networks, images, stores, dependências e o inventário datado. **I02 não publica endpoints, classes de domínio ou UI próprias.**

- **Fonte versionada:** [`infra/`](https://github.com/delmacy/syndes-system/tree/main/infra) e Compose dos owners.
- **Dados:** [separação Control, tenant e stores técnicos](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
- **Contratos operacionais:** [matriz de serviços e dependências](chapters/04-contratos-e-dependencias-publicas.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `I02`.
- **Caminho deste arquivo:** `docs/subprojects/I02-server02/README.md`.
- **Fonte do módulo:** `infra`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module I02 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: infra
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/I02-server02/ESCOPO.md
    - Status: docs/subprojects/I02-server02/STATUS.md
    - Sprint: docs/subprojects/I02-server02/SPRINT.md

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

## Mapa de ambientes e serviços {#mapa-de-ambientes}

Nesta unidade ficam reunidos **ambientes de desenvolvimento, homologação e produção**, além da composição técnica de hospedagem. [Abrir inventário de stack e serviços](REFERENCIA-TECNICA.md#ambientes-e-hospedagem) ou [procedimentos](OPERACAO.md#hospedagem).

Os identificadores técnicos anteriores de servidores e ferramentas (I01, I03, I05–I08, I12) continuam rastreáveis, mas não ocupam entradas independentes no menu principal. O ambiente real de produção só será indicado após verificação operacional.
