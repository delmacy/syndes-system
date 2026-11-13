# C01 — Control Plane

> **Control Plane (C01) — auditoria técnica parcial, 13/11/2026.** No DevServer01, registry, memberships e metadados básicos do Manager existem. **Catálogo, entitlements, instalações, ledger e outbox Control não estão instalados; seis migrations aparecem PENDING.** Nenhum DDL/grant foi executado. Os contratos estão distribuídos entre C01, Kernel, Host, Installer, Manager e Event Platform.

<!-- syndes:module-id=C01;source=infra/postgres/bootstrap;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais contratos Control, APIs e tabelas existem?** | [Referência técnica por owner](REFERENCIA-TECNICA.md) · [Fronteiras e SQL](chapters/04-contratos-e-dependencias-publicas.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Snapshot do Control Plane {#estado-control}

- **Instalado no DevServer01:** `tenant_registry`, `tenant_memberships`, `platform_operator_access`, `platform_tenant_profiles`; um tenant consta como `active`.
- **Não instalado:** `module_catalog`, `tenant_module_entitlements`, `tenant_module_installs`, `tenant_module_audit`, roles específicas de módulos e `control_events`.
- **Migrations Control:** seis stages `PENDING` no comando de consulta `--plan`; ledger ausente.
- **Impacto:** adaptadores Host e inventário de módulos do Manager dependem de SQL ausente; **nenhuma rota foi homologada neste host**.
- **Separação:** tenant `active` não significa módulo `enabled`; schema instalado não é prova de acesso FGA, restore ou Product Gate.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **Contratos versionados, objetos SQL presentes, API implantada e autorização são estados distintos.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) identifica as **tabelas versionadas versus instaladas**, exports Kernel (A08), classes Host (A04) e APIs Manager/Account Access (A05/A06). **C01 não é um backend independente.**

- **Fonte de contratos SQL:** [`infra/postgres/bootstrap`](https://github.com/delmacy/syndes-system/tree/main/infra/postgres/bootstrap).
- **Persistência:** [diagrama de fronteiras e migrations](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
- **Contratos administrativos:** [matriz SQL, HTTP e events](chapters/04-contratos-e-dependencias-publicas.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `C01`.
- **Caminho deste arquivo:** `docs/subprojects/C01-control-plane/README.md`.
- **Fonte do módulo:** `infra/postgres/bootstrap`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module C01 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: infra/postgres/bootstrap
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/C01-control-plane/ESCOPO.md
    - Status: docs/subprojects/C01-control-plane/STATUS.md
    - Sprint: docs/subprojects/C01-control-plane/SPRINT.md

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
