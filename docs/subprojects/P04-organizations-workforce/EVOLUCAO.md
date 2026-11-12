# P04 — Organizations & Workforce | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `P04` — `catalog/work-units.json` |
| Workpackages relacionados | 2 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 11 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[P04]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-30 — Conta, colaboradores, papéis e equipes — Operations

**Prioridade na fonte:** P1 · **Gate:** G3 — workforce auditável

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**30.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Adaptar PR #56 (DC-2c) à `main` sem migração operacional automática | 00.05,30.01 | BLOQ |
| [**30.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Criar API HTTP autorizada de funcionários, equipes e papéis por workspace | 30.05,10.04 | BLOQ |
| [**30.07**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Vincular CRM Employee a `sub` Keycloak e convites com aceite explícito | 30.06 | BLOQ |
| [**30.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Implementar gestão de equipes e supervisores no Workspace | 30.06–30.07 | BLOQ |
| [**30.09**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Rever permissões de recursos concretos e funções de fila | 30.08 | BLOQ |
| [**30.11**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar desligamento, troca de equipe e auditoria ponta a ponta | 30.09–30.10 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 30** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-60 — Multi-organização, Unidades e Workspaces (gate separado)

**Prioridade na fonte:** P2 · **Gate:** G6 — ativação multi-org opcional

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**60.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Aprovar formalmente Product Gate de múltiplas organizações #31 | 50.08,30.11 | BLOQ (decisão) |
| [**60.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Auditar migrations Organization 001–006, CRM, Inbox e WhatsApp | 60.01 | BLOQ |
| [**60.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Validar ativação MANUAL transacional do modo multi-org em PG descartável | 60.02,10.07 | BLOQ |
| [**60.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Implementar/validar CRUD protegido de organizações, unidades e workspaces #22 | 60.03 | BLOQ |
| [**60.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Testar Org A/B e Workspace X/Y no mesmo tenant | 60.04–60.05 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 60** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `P04-WP-01` e `P04-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `P04`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22P04%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
