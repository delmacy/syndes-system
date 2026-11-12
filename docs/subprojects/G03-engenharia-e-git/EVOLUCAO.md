# G03 — Engenharia e Git | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `G03` — `catalog/work-units.json` |
| Workpackages relacionados | 1 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 7 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[G03]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-00 — Baseline, governança e reconciliação de branches

**Prioridade na fonte:** P0 · **Gate:** G0 — mainline coerente

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**00.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Congelar inventário rastreável de `main`, deploy e PRs #56–#59 | — | PEND |
| [**00.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Reconciliar PRs #33/#34/#51 encerradas e commits integrados por #47/#54 | 00.01 | PEND |
| [**00.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Inspecionar diferenças reais dos PRs #57 → #58 → #59 contra `main` | 00.01–00.02 | PEND |
| [**00.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Integrar `front-shared` e modularização na linha corrente | 00.03 | PEND |
| [**00.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Reconciliar PR #56 (DC-2c) contra `main` e pré-requisitos SQL | 00.02 | PEND |
| [**00.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Triar branches históricas, incluindo #1/#2/#3/#7/#50, sem apagá-las sem evidência | 00.01 | PEND |
| [**00.09**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Conferir regras de governança da `main` e critérios de promoção | 00.01 | PEND |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 00** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `G03-WP-01` e `G03-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `G03`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22G03%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
