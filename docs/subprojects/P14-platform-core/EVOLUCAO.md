# P14 — Platform Core | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `P14` — `catalog/work-units.json` |
| Workpackages relacionados | 5 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 6 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[P14]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-00 — Baseline, governança e reconciliação de branches

**Prioridade na fonte:** P0 · **Gate:** G0 — mainline coerente

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**00.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Congelar inventário rastreável de `main`, deploy e PRs #56–#59 | — | PEND |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 00** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-50 — CRM, Inbox, WhatsApp e Workspace existentes — hardening de MVP

**Prioridade na fonte:** P1 · **Gate:** G5 — fluxo Basic real

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**50.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Confirmar paridade de CRM/Inbox/WhatsApp entre `main` e DevServer01 | 00.01,10.01 | PEND |
| [**50.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Fechar aceite do fluxo Basic CRM + Inbox + WhatsApp | 50.07,10.07 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 50** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-55 — Gestão de Atendimentos Básica (PRD-003A) — inserida no MVP em 11/11/2026

**Prioridade na fonte:** P1 · **Gate:** G5A: atendimento com etapas e protocolo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**55.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-03) | Integração do novo módulo no Host/installer, entitlements ENABLED, APIs REST OIDC+FGA+membership e erros 401/403/409; **SM-03C canonicidade e schema de migration; SM-03D preflight read-only** | 55.02, 10.02–10.05, 50.08 | API opt-in no main; SM-03C corrigiu ID/schema/transaction e testou PgModuleInstaller em PG17 sintético; Control/restore/FGA reais BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 55** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-70 — Demais módulos previstos do MVP comercial (ordem PRD-004–010)

**Prioridade na fonte:** P2 · **Gate:** G7 — escopo Basic completo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**70.09**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Product Gate por módulo, conforme `MODULE-ORDER.md` | 70.01–70.08 | PEND |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 70** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-95 — Release, qualidade, governança e evolução pós-MVP

**Prioridade na fonte:** P0→P3 · **Gate:** G10 — go-live comercial

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**95.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Estabelecer Definition of Done transversal e evidência por pacote | 00.09 | PEND |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 95** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Planos especializados e dependências documentais

Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.

- [WBS COMPOSICAO MODULAR CORE 20261111](../../engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md) — `docs/engineering/WBS-COMPOSICAO-MODULAR-CORE-20261111.md`

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `P14-WP-01` e `P14-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `P14`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.
