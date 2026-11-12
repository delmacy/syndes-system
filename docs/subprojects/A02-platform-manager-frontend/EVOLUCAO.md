# A02 — Platform Manager Frontend | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `A02` — `catalog/work-units.json` |
| Workpackages relacionados | 2 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 6 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[A02]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-20 — Platform Manager real — Control Plane separado

**Prioridade na fonte:** P0 · **Gate:** G2 — Manager autenticado

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**20.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Consolidar o frontend Manager sobre `front-shared` | 00.04 | BLOQ |
| [**20.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Manter visual preview como demo isolada até substituir por release autorizado | 20.01 | PEND |
| [**20.07**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Conectar UI real a `/me`, `/summary`, `/tenants` e detalhes | 20.01,20.06 | BLOQ |
| [**20.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Publicar Manager autenticado em origem HTTPS dedicada | 20.06–20.07 | BLOQ |
| [**20.09**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar fluxos reais de operador autorizado, negado e revogado | 20.08 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 20** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-90 — Métricas sanitizadas Support → Manager (issue #37)

**Prioridade na fonte:** P2 · **Gate:** G9 — agregados sem PII

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**90.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Indicadores visuais somente após API real aprovada | 90.03 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 90** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Planos especializados e dependências documentais

Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.

- [PLATFORM MANAGER PRD WBS](../../engineering/PLATFORM-MANAGER-PRD-WBS.md) — `docs/engineering/PLATFORM-MANAGER-PRD-WBS.md`

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `A02-WP-01` e `A02-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `A02`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22A02%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
