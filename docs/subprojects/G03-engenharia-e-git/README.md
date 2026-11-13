# G03 — Engenharia e Git

> **Governança de engenharia e colaboração (G03).** Regras de AGENTS, ownership, worktrees, contratos de mudança, GitHub Issues/Projects e gates de CI. **G03 não é um módulo executável**: esta ficha explica como alterar o produto com rastreabilidade, não como liberar permissões de execução. Revisão estática parcial em 12/11/2026.

<!-- syndes:module-id=G03;source=AGENTS.md;kind=module -->

## Acessar a documentação {#acessos}

| Quero descobrir | Abrir |
|---|---|
| **O que o módulo faz?** | [Especificação, capacidades e histórias](ESCOPO.md) |
| **Que regras, scripts e contratos governam mudanças?** | [Referência técnica de engenharia](REFERENCIA-TECNICA.md) · [Matriz de owners e contratos](chapters/04-contratos-e-dependencias-publicas.md) |
| **O que será feito?** | [Evolução: workpackages e dependências](EVOLUCAO.md) |
| **O que realmente mudou?** | [Histórico Git e evidências relacionadas](HISTORICO.md) |
| **Como testar, operar ou entregar?** | [Operação, testes, gates e runbooks](OPERACAO.md) |
| **Como pedir uma alteração?** | [Atualizações e propostas contextualizadas](updates/README.md) |

## Engenharia e agentes por responsabilidade {#governanca}

- **Preparar trabalho:** ler [AGENTS global](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md), regra local aplicável, catálogo e WBS; fixar SHA, dono, artefato e escopo.
- **Executar com limite:** usar worktree isolada, revisar diff e [verificar escopo consultivamente](chapters/04-contratos-e-dependencias-publicas.md); o scanner não impõe sandbox.
- **Verificar:** [matriz do pipeline e gates](chapters/05-arquitetura-banco-interface-configuracao-e-diagramas.md) e [STATUS G03](STATUS.md); falha do CI central não é release aprovado.
- **Rastrear:** [WBS/Issues/Projects](EVOLUCAO.md) com fontes separadas, sem criar progresso fictício.

## Capacidades e requisitos {#capacidades}

Consulte a [especificação integral](ESCOPO.md) e os [capítulos de capacidades](chapters/03-capabilities.md) e [histórias/casos de uso](chapters/02-requisitos-historias-e-casos-de-uso.md). **Regras e decisões aprovadas estão nas fontes originais; uma proposta no Docs ou um script no Git não comprovam execução, controle de acesso ou aceite.**

## Stack, contratos e persistência {#stack}

A [referência técnica](REFERENCIA-TECNICA.md) documenta scripts, workflows e checagens de engenharia. **G03 não possui classes de produto, APIs HTTP ou tabelas próprias**; os contratos dos módulos ficam em cada owner.

- **Fonte de regras:** [`AGENTS.md`](https://github.com/delmacy/syndes-system/blob/main/AGENTS.md).
- **Contrato de alteração:** [owner e revisão de diff](chapters/04-contratos-e-dependencias-publicas.md).
- **Bancos:** Control e Tenant pertencem a seus owners; documentação de engenharia não executa migrations.


## Planejamento, progresso e provas {#evolucao}

- [Workpackages, tasks e prioridades](EVOLUCAO.md).
- [STATUS — estado com evidências](STATUS.md) · [SPRINT — incremento](SPRINT.md).
- [Histórico de alterações por commit](HISTORICO.md).
- [GitHub Issues do repositório](https://github.com/delmacy/syndes-system/issues).

Não interpretar task cadastrada como tarefa concluída, nem commit como deploy.

## Para agentes e busca precisa {#agentes}

- **Identificador canônico:** `G03`.
- **Caminho deste arquivo:** `docs/subprojects/G03-engenharia-e-git/README.md`.
- **Fonte do módulo:** `AGENTS.md`.
- **Leitura por intenção:** requisito → `ESCOPO.md`; símbolo/API → `REFERENCIA-TECNICA.md`; tarefa → `EVOLUCAO.md`; evidência → `HISTORICO.md` ou `STATUS.md`.
- **Pesquisa determinística:** `python3 scripts/docs/query_registry.py --module G03 --json`. [Guia de busca para agentes](../../standards/BUSCA-PARA-AGENTES.md).
- **Prompts disponíveis:** [projeção](PROJECAO.md), [implementação](IMPLEMENTACAO.md) e [alteração rápida](ALTERACAO.md).
- **Ancoragens fixas deste home:** `#acessos`, `#capacidades`, `#stack`, `#evolucao`, `#agentes`.

## Contexto original para agentes {#contexto-legado}

??? info "Abrir instruções anteriores (preservadas)"


    - Catálogo: catalog/work-units.json
    - Código/artefato: AGENTS.md
    - AGENTS global: AGENTS.md
    - AGENTS local: Não existe arquivo local específico; aplicar AGENTS.md raiz
    - Package/exports: N/A; localizar configuração declarativa
    - Contratos públicos: docs/standards/CONTRATOS-PUBLICOS.md
    - Escopo: docs/subprojects/G03-engenharia-e-git/ESCOPO.md
    - Status: docs/subprojects/G03-engenharia-e-git/STATUS.md
    - Sprint: docs/subprojects/G03-engenharia-e-git/SPRINT.md

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
