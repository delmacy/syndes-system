# C01 — Control Plane | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `C01` — `catalog/work-units.json` |
| Workpackages relacionados | 5 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 6 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[C01]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-20 — Platform Manager real — Control Plane separado

**Prioridade na fonte:** P0 · **Gate:** G2 — Manager autenticado

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**20.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisão restrita de `syndes_master_api` + OpenBao AppRole | 10.02,10.05 | BLOQ (infra) |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 20** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-30 — Conta, colaboradores, papéis e equipes — Operations

**Prioridade na fonte:** P1 · **Gate:** G3 — workforce auditável

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**30.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisionar com segurança API de delegação Account Owner/Admin | 30.01–30.02,10.05 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 30** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-40 — Tenant operacional Syndes e Central Syndes Support

**Prioridade na fonte:** P1 · **Gate:** G4 — Support piloto interno/externo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**40.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisionar Syndes como tenant convencional, com DB dedicado | 40.01,10.02–10.05 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 40** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-55 — Gestão de Atendimentos Básica (PRD-003A) — inserida no MVP em 11/11/2026

**Prioridade na fonte:** P1 · **Gate:** G5A: atendimento com etapas e protocolo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**55.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) (SM-03) | Integração do novo módulo no Host/installer, entitlements ENABLED, APIs REST OIDC+FGA+membership e erros 401/403/409; **SM-03C canonicidade e schema de migration; SM-03D preflight read-only** | 55.02, 10.02–10.05, 50.08 | API opt-in no main; SM-03C corrigiu ID/schema/transaction e testou PgModuleInstaller em PG17 sintético; Control/restore/FGA reais BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 55** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-90 — Métricas sanitizadas Support → Manager (issue #37)

**Prioridade na fonte:** P2 · **Gate:** G9 — agregados sem PII

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**90.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Criar produtor de agregados com identidade serviço restrita | 90.01,10.02 | BLOQ |
| [**90.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | API de leitura de snapshots e estados stale/indisponível | 90.02 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 90** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Planos especializados e dependências documentais

Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.

- [WBS CONTROL PLANE EVENTS 20261111](../../engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md) — `docs/engineering/WBS-CONTROL-PLANE-EVENTS-20261111.md`

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `C01-WP-01` e `C01-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `C01`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22C01%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
