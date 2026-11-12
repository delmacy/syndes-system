# P05 — Gestão de Atendimentos | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `P05` — `catalog/work-units.json` |
| Workpackages relacionados | 2 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 14 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[P05]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-55 — Gestão de Atendimentos Básica (PRD-003A) — inserida no MVP em 11/11/2026

**Prioridade na fonte:** P1 · **Gate:** G5A: atendimento com etapas e protocolo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**55.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-01) | Aprovar recorte Basic e atualizar baseline, PRD, AGENTS e WBS; F0–F8 avançado permanece pós-MVP | Decisão 11/11 | Integrado ao main via PR #93 com CI #127 verde |
| [**55.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-02) | Funil com 2–8 etapas configuráveis, protocolo independente de conversa, vínculo Inbox opcional, atribuição a pessoa autorizada, mudança adjacente e encerramento com trilha SQL append-only; testes PG A/B | CRM, Inbox, Organizations e SQL002 | Domínio PR #93 no main, PG17 sintético 14/14; CI módulo Issue #94, Host plugin em preparação |
| [**55.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-03) | Integração do novo módulo no Host/installer, entitlements ENABLED, APIs REST OIDC+FGA+membership e erros 401/403/409; **SM-03C canonicidade e schema de migration; SM-03D preflight read-only** | 55.02, 10.02–10.05, 50.08 | API opt-in no main; SM-03C corrigiu ID/schema/transaction e testou PgModuleInstaller em PG17 sintético; Control/restore/FGA reais BLOQ |
| [**55.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-04) | Equipes canônicas Workforce 007, grants FGA origem/destino, transferência com CAS e auditoria no mesmo Workspace | 30.06–30.11, 55.03 | Código SM-04 em branch; PG17 sintético verde; staging/Control ainda BLOQ |
| [**55.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-05) | Inspector Inbox com API read-only por conversa (SM-05A-API opt-in), UI e lista/Kanban funcional com dados autorizados, frontend compartilhado apenas visual | 55.03–55.04 | API Inspector implementada/testada em branch; UI/Product Gate BLOQ |
| [**55.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-06) | Restore real/staging, smoke JWT/tenant A-B/Workspace, rollback, browser e Product Gate | SM-03C/03D, 10.07, 55.05, 95.03 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 55** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-80 — Construtor avançado de Funis e Templates — pós-MVP congelado

**Prioridade na fonte:** P3 / congelado · **Gate:** G8 — somente após PRD-003A Basic homologado e novo Product Gate

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**80.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Definir construtor avançado além do Basic e aprovar novo PRD/ADR/PG | 30.11,50.08 | CONGELADO (produto) |
| [**80.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F1: catálogo de grupos/equipes/funis por API montável | 80.01 | CONGELADO |
| [**80.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F2: criador visual de funis | 80.02 | CONGELADO |
| [**80.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F3: catálogo de templates oficiais/privados | 80.03 | CONGELADO |
| [**80.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F4 avançado: protocolos versionados, subprotocolos e reabertura complexa | 80.02 | CONGELADO |
| [**80.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F5 avançado: transferência cross-funnel/cross-Workspace e correlação de protocolos | 80.05 | CONGELADO |
| [**80.07**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F6–F7 avançado: painéis multi-funil configuráveis, supervisão e templates | 80.05–80.06 | CONGELADO |
| [**80.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | F8: políticas avançadas de SLA, presença e capacidade (Scheduling Basic é PRD-004) | 80.07,70.01 | CONGELADO |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 80** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Planos especializados e dependências documentais

Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.

- [WBS GESTAO ATENDIMENTOS MVP 20261111](../../engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md) — `docs/engineering/WBS-GESTAO-ATENDIMENTOS-MVP-20261111.md`
- [WBS SERVICE MANAGEMENT](../../engineering/WBS-SERVICE-MANAGEMENT.md) — `docs/engineering/WBS-SERVICE-MANAGEMENT.md`

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `P05-WP-01` e `P05-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `P05`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22P05%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
