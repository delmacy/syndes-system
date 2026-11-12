# Q01 — Plataforma de testes | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `Q01` — `catalog/work-units.json` |
| Workpackages relacionados | 2 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 3 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[Q01]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-00 — Baseline, governança e reconciliação de branches

**Prioridade na fonte:** P0 · **Gate:** G0 — mainline coerente

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**00.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Revalidar release candidate integrado após reconciliação | 00.04–00.07 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 00** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-95 — Release, qualidade, governança e evolução pós-MVP

**Prioridade na fonte:** P0→P3 · **Gate:** G10 — go-live comercial

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**95.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Estabelecer Definition of Done transversal e evidência por pacote | 00.09 | PEND |
| [**95.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Executar CI integrado por impacto com testes negativos preservados | 00.07,95.01 | PEND (outra frente) |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 95** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `Q01-WP-01` e `Q01-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `Q01`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22Q01%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
