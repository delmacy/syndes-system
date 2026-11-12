# Syndes Docs — Engenharia, Produto e Evolução

> **Portal de consulta do Syndes System.** Comece pelo módulo ou pela dúvida: capacidades, contratos, stack, workpackages, testes e histórico. A documentação e as alterações do código são fontes distintas, ligadas por IDs e evidências.

## Acesso rápido {#acesso-rapido}

| Quero encontrar | Abrir |
|---|---|
| **Um módulo e sua stack completa** | [Catálogo de módulos e busca técnica](blueprint/CATALOGO-MODULOS.md) |
| **APIs, classes, métodos ou contratos públicos/privados** | [Catálogo de símbolos](blueprint/CATALOGO-MODULOS.md) · [padrão de contratos](standards/CONTRATOS-PUBLICOS.md) |
| **Workpackages, projetos e Issues** | [Projeto e workpackages com Issues reais](blueprint/PROJETO-E-WORKPACKAGES.md) |
| **O que foi alterado de fato** | [Linha do tempo por commits](blueprint/LINHA-DO-TEMPO.md) |
| **Hospedagem, ambientes e infraestrutura** | [Hospedagem e ambientes](subprojects/I02-server02/README.md) |
| **CI, deploy e validação da plataforma** | [Monitoramento dos workflows](monitoramento/README.md) |
| **Arquitetura, ERP Lite e decisões** | [Blueprint Geral](blueprint/README.md) |
| **Solicitar mudança via agente** | [Como propor atualização contextual](standards/EDICAO-CONTEXTUAL.md) |

## Navegação por área {#areas}

As áreas separam produto, operação, core, frontend, infraestrutura e testes. Os componentes internos não criam módulos duplicados no menu.

| Área | Atalho |
|---|---|
| Produto e integrações | [Módulos do produto](blueprint/CATALOGO-MODULOS.md?area=produto) |
| Operação e negócio | [Serviços de operação](blueprint/CATALOGO-MODULOS.md?area=operacao) |
| Plataforma e Core | [Core e componentes de plataforma](blueprint/CATALOGO-MODULOS.md?area=plataforma) |
| Frontends e experiência | [Aplicações e componentes React](blueprint/CATALOGO-MODULOS.md?area=frontend) |
| Infraestrutura e hospedagem | [Ambientes, Docker e serviços](blueprint/CATALOGO-MODULOS.md?area=infraestrutura) |
| Qualidade e testes | [Testes, segurança e CI](blueprint/CATALOGO-MODULOS.md?area=qualidade) |

## Entradas principais do MVP {#mvp}

| Módulo | Entrada humana | Implementação e contratos | Planejamento |
|---|---|---|---|
| **CRM** | [P01 — CRM](subprojects/P01-crm/README.md) | [Referência técnica](subprojects/P01-crm/REFERENCIA-TECNICA.md) | [Evolução](subprojects/P01-crm/EVOLUCAO.md) |
| **Inbox** | [P02 — Inbox](subprojects/P02-inbox/README.md) | [Referência técnica](subprojects/P02-inbox/REFERENCIA-TECNICA.md) | [Evolução](subprojects/P02-inbox/EVOLUCAO.md) |
| **WhatsApp** | [P03 — WhatsApp](subprojects/P03-whatsapp/README.md) | [Plugin e gateway Go](subprojects/P03-whatsapp/REFERENCIA-TECNICA.md) | [Evolução](subprojects/P03-whatsapp/EVOLUCAO.md) |
| **Organizations** | [P04 — Organizations](subprojects/P04-organizations-workforce/README.md) | [Workforce e contexto](subprojects/P04-organizations-workforce/REFERENCIA-TECNICA.md) | [Evolução](subprojects/P04-organizations-workforce/EVOLUCAO.md) |
| **Core Host** | [A04 — Core Host](subprojects/A04-core-host/README.md) | [Composição e contratos](subprojects/A04-core-host/REFERENCIA-TECNICA.md) | [Evolução](subprojects/A04-core-host/EVOLUCAO.md) |

## Para agentes: buscar sem carregar o projeto inteiro {#agentes}

Use o ID do módulo como ponto de partida. O comando `python3 scripts/docs/query_registry.py --module P03 --json` localiza fontes e símbolos; o [guia de busca](standards/BUSCA-PARA-AGENTES.md) mostra filtros por método, API, SQL e frontend. Depois, leia só os capítulos e contratos necessários.

**Prompts canônicos:** [Projeção](standards/PROMPT-PROJECAO.md) · [Implementação](standards/PROMPT-IMPLEMENTACAO.md) · [Alteração rápida](standards/PROMPT-ALTERACAO.md).

**Limites:** um símbolo encontrado não é necessariamente contrato público; uma migration no repositório não comprova execução; um commit não é deploy nem aceite.

## Histórico do índice e instruções anteriores {#contexto-anterior}

??? info "Abrir índice anterior para agentes (preservado)"

    # Syndes — documentação de referência dos agentes
    > **Ponto de entrada**: este índice serve para localizar arquivos exatos no GitHub, sem busca exploratória pelo repositório inteiro.

    ## Leitura direta
    - [Blueprint Geral (índice e referências existentes)](blueprint/README.md)
    - [57 módulos: cobertura de reconciliação (4 auditados, 53 por auditar)](blueprint/README.md#cobertura-real-do-preenchimento-2026-11-12)
    - [57 unidades: escopo, status e sprint](subprojects/README.md)
    - **Evolução por módulo:** em cada unidade, página Evolução com workpackages, tasks e dependências vinculadas à WBS.
    - [Painel de monitoramento dos workflows](monitoramento/README.md)
    - [Catálogo JSON com paths para o portal](subprojects/index.json)
    - [Contratos públicos, bibliotecas e interfaces](standards/CONTRATOS-PUBLICOS.md)
    - [Como editar um tópico e enviar à caixa de entrada](standards/EDICAO-CONTEXTUAL.md)
    - [Prompt de projeção](standards/PROMPT-PROJECAO.md)
    - [Prompt de implementação](standards/PROMPT-IMPLEMENTACAO.md)
    - [Prompt de alteração rápida (modelo)](standards/PROMPT-ALTERACAO.md)
    - [Fluxo de propostas, atualização e implementação](standards/FLUXO-DE-ATUALIZACOES.md)
    - [Modelo de atualização aprovada](standards/TEMPLATE-ATUALIZACAO.md)
    - [Template do contrato público](standards/TEMPLATE-CONTRATO-PUBLICO.md)

    ## Rotina do agente
    1. Receber ID da unidade e caminho direto do capítulo/tópico.
    2. Consultar **somente** seu escopo, status/sprint, regras obrigatórias e contratos públicos relevantes.
    3. Executar apenas a atividade dentro da unidade autorizada; impacto externo vira referência e bloqueio, nunca trabalho não autorizado.
    4. Registrar progresso com evidência no STATUS e consolidar sprint na meta.
    5. Alterar ESCOPO aprovado apenas mediante decisão explícita; ideias adicionais ficam como propostas.

    **Importante:** os textos de scaffold são rascunhos e não substituem PRDs, ADRs, definições de runtime, GitHub Actions e testes já existentes.

    ## Três níveis de navegação

    **Área → Módulo → Página.** A página Escopo apresenta capítulos, tópicos, histórias, capacidades, contratos e diagramas no próprio corpo da documentação. Cada capítulo continua em arquivo Markdown individual para edição e consultas precisas de agentes.

    ## Projeto de documentação técnica

    A [proposta de ERP Lite e referência técnica por módulo](blueprint/PROPOSTA-ERP-LITE-E-REFERENCIA-TECNICA.md) define o padrão de classes, métodos, contratos públicos, telas e schemas de Tenant/Control. É uma **proposta**, não código ERP aprovado. A [referência de template](standards/TEMPLATE-REFERENCIA-TECNICA.md) orienta o preenchimento.


    ## Portal integrado: documentação, projeto e linha do tempo

    Cada módulo possui **seis páginas** no menu: Visão geral, Especificação, Referência técnica, Evolução, Histórico e Operação. STATUS, SPRINT, prompts e caixa de entrada continuam disponíveis por links internos e nos caminhos de Git já utilizados pelos agentes.

    - [Linha do tempo geral — planejado × realizado](blueprint/LINHA-DO-TEMPO.md).
    - [Fontes de verdade e rastreabilidade](standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).
    - [Blueprint do produto](blueprint/README.md).

    O histórico é calculado a partir do Git no build, **não** digitado manualmente; Issues/Projects são fontes de status das tarefas, e commit/CI/deploy/aceite não são equivalentes.


    [GitHub Projects: configuração e sincronização](standards/GITHUB-PROJECTS.md) · [Comandos de busca para agentes](standards/BUSCA-PARA-AGENTES.md).

    [Workpackages reais e situação do GitHub Project](blueprint/PROJETO-E-WORKPACKAGES.md).
