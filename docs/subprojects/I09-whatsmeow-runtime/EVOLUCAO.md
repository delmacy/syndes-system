# I09 — Whatsmeow runtime | Evolução

> **COMPONENTE TÉCNICO DO P03 — WHATSAPP.** Este documento histórico I09 permanece acessível para WBS, commits e links antigos. O gateway Go/Whatsmeow faz parte de [P03 — WhatsApp](../P03-whatsapp/README.md), com [Referência técnica](../P03-whatsapp/REFERENCIA-TECNICA.md) e [Operação](../P03-whatsapp/OPERACAO.md) centrais. Não representa outro módulo de produto.


> **PLANO DE EVOLUÇÃO · RASCUNHO DE VINCULAÇÃO.** Os workpackages abaixo são associações com a WBS existente, **não designações exclusivas de ownership**, nem confirmação de que a tarefa esteja em andamento ou concluída. Validar antes de autorizar execução.

## Painel do módulo

| Indicador | Fonte e interpretação |
|---|---|
| Unidade | `I09` — `catalog/work-units.json` |
| Workpackages relacionados | 3 grupos da WBS mestre (revisão histórica) |
| Tarefas com referência | 4 IDs rastreáveis, sem duplicar os requisitos |
| Sprint em andamento | [Ver SPRINT.md](SPRINT.md) — não inferir que está ativa |
| Evidências de implementação | [Ver STATUS.md](STATUS.md) — exige commit, testes e ambiente |
| Escopo normativo | [Ver ESCOPO.md](ESCOPO.md) e seus capítulos |
| Pedidos de mudança | [Atualizações](updates/README.md) e GitHub Issues identificadas por `[I09]` |

## Workpackages e tarefas existentes

**Origem rastreável:** [WBS mestre do Syndes](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) · caminho exato `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`.

Os estados da tabela são **os registrados no documento de origem**, que pode estar desatualizado. Não altere o status para DONE sem consultar o STATUS atual, SHA, CI, testes e aceite. Uma mesma tarefa pode envolver outros módulos, que preservam a propriedade de seus próprios contratos.

### WP-40 — Tenant operacional Syndes e Central Syndes Support

**Prioridade na fonte:** P1 · **Gate:** G4 — Support piloto interno/externo

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**40.04**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Provisionar conta/número WhatsApp exclusivos do atendimento Syndes | 40.02 | BLOQ (operação) |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 40** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-50 — CRM, Inbox, WhatsApp e Workspace existentes — hardening de MVP

**Prioridade na fonte:** P1 · **Gate:** G5 — fluxo Basic real

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**50.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Homologar WhatsApp gateway e Whatsmeow real | 50.01,50.03 | BLOQ |
| [**50.06**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Auditar controles de rate limit, integridade e quotas dos canais | 50.05,10.06 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 50** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

### WP-95 — Release, qualidade, governança e evolução pós-MVP

**Prioridade na fonte:** P0→P3 · **Gate:** G10 — go-live comercial

| ID da tarefa | Entregável planejado | Dependências na WBS | Estado registrado na WBS |
|---|---|---|---|
| [**95.05**](../../engineering/WBS-PROGRAMA-SYNDES-20261110.md) | Ensaiar falhas e DR: Keycloak, FGA, OpenBao, DB, SSE, WhatsApp | 95.03–95.04 | BLOQ |

**Critérios de aceite e evidências originais:** consultar a seção **WBS 95** em `docs/engineering/WBS-PROGRAMA-SYNDES-20261110.md`; localizar os IDs acima. Confirmar decisões na SHA atual antes de iniciar.

## Gates de reconciliação documental I09/P03 (auditoria de 15/11/2026)

> **Acompanhamento de evidências, não workpackages aprovados nem tarefas implementadas.** Fonte: [auditoria I09-DOC-01](https://github.com/delmacy/syndes-system/blob/audit/i09-callback-doc-drift-20261115-2055/docs/audits/I09-CALLBACK-DOCUMENTATION-DRIFT-20261115-2055.md), baseada na main `1cf48cc0`. Conferir SHA e auditorias posteriores antes de promover estados.

| Gate documental | Constatação sustentada | Estado de comprovação | Próxima evidência necessária |
|---|---|---|---|
| I09.DOC.CALLBACK | `src/inbound-http.ts` declara `POST /api/v1/internal/whatsapp/events/:tenantId`; o README P03 de 02/11 relata ausência histórica | Declaração de fonte auditada; README P03 ainda requer delimitação temporal | Reconciliar README com proprietário P03 sem apagar o histórico |
| I09.TEST.CALLBACK | Import do módulo no plugin não prova rota ativa; compatibilidade do envelope Go/TS não foi testada nesta auditoria | Teste atual não comprovado | Executar testes isolados Node/Go, incluindo auth e rejeição entre tenants, com SHA |
| I09.OP.DISPATCH | `WHATSAPP_DISPATCH_ENABLED === "true"` condiciona o timer; valor operacional não consultado | Configuração e execução não verificadas | Evidência autorizada de configuração e execução, sem expor segredos |
| I09.DATA.BRIDGE | Caminho transacional depende de bridge injetado; composição Nest inspecionada não o injeta | Garantia transacional não comprovada no receiver inspecionado | Teste de integração e composição efetiva |
| I09.ACCEPT.01 | Migrações declaradas e testes históricos não demonstram deploy, integração ou aceite | Homologação não comprovada | CI por SHA, evidência de ambiente e aceite explícito |

Estes IDs são **marcadores de acompanhamento documental**, não substituem a WBS mestre 50.05/50.06, nem autorizam código, migrations ou deploy. I09 é componente técnico de P03; a reconciliação do README pertence ao respectivo owner documental.

## Backlog local e novos workpackages

Use esta seção apenas para **planejamentos explicitamente aprovados e vinculados a requisitos do módulo**. A estrutura abaixo é um modelo vazio, não um pacote de trabalho iniciado.

| WP / tarefa | Objetivo e requisito aprovado | Prioridade | Dependência / gate | Situação comprovada | Evidência |
|---|---|---|---|---|---|
| — | Nenhum incremento local adicional registrado neste documento | — | — | NÃO ATRIBUÍDO | — |

Para criar um pacote local novo, utilize [Modelo de Workpackage](../../standards/TEMPLATE-WORKPACKAGE.md), registre IDs estáveis como `I09-WP-01` e `I09-TASK-001`, acrescente tarefas com critérios de aceite, vincule o capítulo normativo e a decisão aprovada. Se houver dependência externa, encaminhe ao dono: não implemente fora de `I09`.

## Próximo incremento e checkpoint

1. **Planejar:** revisar as tarefas da WBS e selecionar um pacote com dependências satisfeitas. Registrar a decisão e o objetivo verificável em [SPRINT.md](SPRINT.md).
2. **Executar:** consumir somente requisitos aprovados, caminhos de código próprios e contratos públicos; os três prompts estão disponíveis nas páginas **Projeção**, **Implementação** e **Alteração rápida**.
3. **Consolidar:** atualizar [STATUS.md](STATUS.md) com SHA, CI, ambiente, testes, bloqueios e evidência de aceite; fechar o pacote antes de outro incremento independente.

**Não confundir:** planejado ≠ aprovado ≠ atribuído ≠ implementado ≠ testado ≠ integrado ≠ operacional ≠ aceito.


## Acompanhamento no GitHub e histórico comprovado

- [Issues relacionadas a esta unidade](https://github.com/delmacy/syndes-system/issues?q=is%3Aissue%20%22I09%22) — pesquisa de texto; **não equivale a atribuição automática de ownership**.
- [Linha do tempo realizada](HISTORICO.md) — commits com SHA/data; prova de modificação, não aceitação.
- [STATUS](STATUS.md) · [SPRINT](SPRINT.md) — revisão técnica e comprometimento da sprint.
- [Regras para vincular evidências](../../standards/FONTES-DE-VERDADE-E-RASTREABILIDADE.md).

**Datas do roadmap:** não declaradas neste inventário. Workpackages sem data aprovada não recebem barras Gantt fictícias. Quando houver projeto e marcos confirmados, cadastrar o link explícito à fonte.
