# I04 — PostgreSQL

> **PostgreSQL (I04) — auditoria técnica parcial, 13/11/2026.** Instância de desenvolvimento consultada em modo somente leitura: isolamento de CONNECT/roles no tenant observado confirmado, porém as seis migrations de módulos do Control continuam **PENDING** e o tenant canônico examinado não apresenta schemas de produto. **Sem alterações de banco ou homologação de produção.**

<!-- syndes:module-id=I04;source=infra/postgres;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Quais bancos, roles e schemas existem de fato?** | [Inventário SQL da instância](REFERENCIA-TECNICA.md) · [Mapas e fronteiras](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Observado versus versionado {#estado-postgresql}

- **PostgreSQL 17 no DevServer01:** Control, Keycloak, OpenFGA e um tenant canônico presentes, além de outro DB ainda não classificado.
- **Isolamento básico:** `PUBLIC`, `syndes_core` e `syndes_master_api` não têm `CONNECT` ao banco de tenant observado; a role exclusiva não é superusuária.
- **Control:** registry/membership e Manager básico presentes; **catálogo de módulos, entitlements, ledger e eventos Control ausentes** na instância examinada.
- **Tenant:** schemas de produto e `_syndes.module_migrations` não encontrados no tenant canônico examinado.
- **Migrador:** seis etapas **PENDING** em `--plan`; **não executamos DDL nem `--apply`**.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **SQL no Git, CI verde, objeto SQL aplicado, acesso seguro e aceite operacional são evidências independentes.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) distingue **scripts/SQL declarados** de **bancos, roles, schemas e grants existentes**. **I04 não oferece API HTTP, classes de negócio ou frontend próprios.**

- **Fonte versionada:** [`infra/postgres/`](https://github.com/delmacy/syndes-system/tree/main/infra/postgres), SQL de cada módulo e migrador Control.
- **DBs Control/Tenant/stores:** [arquitetura e diagramas](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md).
- **Contratos privados e gates:** [matriz de scripts](chapters/04-contratos-e-dependencias-publicas.md).


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `I04`.
- **Caminho deste arquivo:** `docs/subprojects/I04-postgresql/README.md`.
- **Fonte do módulo:** `infra/postgres`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module I04 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: infra/postgres
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/I04-postgresql/ESCOPO.md
    - Status: docs/subprojects/I04-postgresql/STATUS.md
    - Sprint: docs/subprojects/I04-postgresql/SPRINT.md

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
