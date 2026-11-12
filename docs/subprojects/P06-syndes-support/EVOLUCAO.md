# P06 — Syndes Support | Evolução

> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `P06` — `catalog/work-units.json` |
| Workpackages relacionados | 2 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 12 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[P06]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-40 — Tenant operacional Syndes e Central Syndes Support

**Prioridade na fonte:** P1 · **Gate:** G4 — Support piloto interno/externo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**40.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Aprovar tenant operacional exclusivo da fornecedora e políticas LGPD | 30.01,10.07 | BLOQ (produto) |
| [**40.02**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisionar Syndes como tenant convencional, com DB dedicado | 40.01,10.02–10.05 | BLOQ |
| [**40.03**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Reconciliar código Support já integrado na `main` com PR #34 | 00.02,40.02 | PEND |
| [**40.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisionar conta/número WhatsApp exclusivos do atendimento Syndes | 40.02 | BLOQ (operação) |
| [**40.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar CRM/Inbox/Support para público externo no tenant Syndes | 40.03–40.04 | BLOQ |
| [**40.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar suporte interno com client OIDC dedicado e filas privadas | 40.02–40.03,10.03 | BLOQ |
| [**40.07**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Configurar concessões FGA, memberships de fila e auditoria | 40.05–40.06 | BLOQ |
| [**40.08**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Executar migrations somente no tenant Syndes + backup/restore pré-release | 40.02–40.07,10.07 | BLOQ |
| [**40.09**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar origem privada/HTTPS, rate limit, SSE e monitoramento | 40.08 | BLOQ |
| [**40.10**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Aprovar e liberar Support MVP pelo gate #39 | 40.09 | BLOQ (aprovação) |
| [**40.11**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Criar acesso temporário a dados de cliente apenas com consentimento explícito | 40.10,30.09 | BLOQ (novo gate) |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 40** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-90 — Métricas sanitizadas Support → Manager (issue #37)

**Prioridade na fonte:** P2 · **Gate:** G9 — agregados sem PII

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**90.01**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Aprovar ADR de snapshots, fontes, frequência, TTL e LGPD | 20.09,40.10 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 90** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Planos especializados e dependências documentais

Esses documentos contêm o detalhamento das frentes relacionadas, mas **não são automaticamente metas da sprint**.

- [WBS SYNDES SUPPORT](../../engineering/WBS-SYNDES-SUPPORT.md) — `docs/engineering/WBS-SYNDES-SUPPORT.md`

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `P06-WP-01` e `P06-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `P06`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.
