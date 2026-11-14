# P01 CRM — Matriz de ações, APIs, permissões e diagramas

> **Índice de rastreabilidade 14/11/2026, baseado em `39f434e5720653eda8af2e3b2a0fa60d1a119cdd`.** São declarações do código, **não comprovações de deploy, de permissões efetivamente concedidas, de execução de cenários ou de aceite do produto**.

## 1. Cobertura por função e ação

| Função | Ação (ficha completa) | HTTP | Fontes |
|---|---|---:|---|
| cadastros | [Criar contato](acoes/crm-create-person.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Consultar e pesquisar contatos](acoes/crm-search-person.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Cadastrar organização comercial](acoes/crm-create-organization.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Vincular pessoa e organização](acoes/crm-link-organization.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| atendimento | [Registrar nota de atendimento](acoes/crm-create-note.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| atendimento | [Consultar histórico e timeline](acoes/crm-read-timeline.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| validacoes | [Validar autorização e isolamento](acoes/crm-authorization.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| integracoes | [Consultar contrato público do CRM](acoes/crm-public-contracts.md) | — | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| evolucao | [Homologar jornada CRM](acoes/crm-product-gate.md) | — | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Atualizar e arquivar contato](acoes/crm-maintain-person.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Consultar, editar e arquivar empresa](acoes/crm-manage-organizations.md) | 4 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Consultar e desvincular relacionamentos](acoes/crm-manage-links.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Gerenciar tags de contatos](acoes/crm-tags.md) | 5 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| cadastros | [Consultar e vincular perfil de funcionário](acoes/crm-employees.md) | 3 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| integracoes | [Vincular e consultar identidades de canal](acoes/crm-channels.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| validacoes | [Consultar possíveis duplicidades](acoes/crm-duplicates.md) | 1 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| integracoes | [Importar e exportar contatos CSV](acoes/crm-csv.md) | 2 | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |
| integracoes | [Resolver identidade de WhatsApp por eventos](acoes/crm-identity-events.md) | — | [Inventário](INVENTARIO-INTEGRAL.md) · [Código](https://github.com/delmacy/syndes-system/tree/39f434e5720653eda8af2e3b2a0fa60d1a119cdd/modules/core-crm/src) |

**Contagem reconciliada:** 18 ações únicas, 30 rotas HTTP declaradas distribuídas entre 15 fichas; três fichas (**crm-public-contracts**, **crm-identity-events**, **crm-product-gate**) não são endpoints de produto. Separar contrato público, evento assíncrono e requisito de homologação.

## 2. Cobertura por tipo de diagrama

| Diagrama existente em [DIAGRAMAS.md](DIAGRAMAS.md) | Natureza | Ações relacionadas | Situação |
|---|---|---|---|
| 01 · Arquitetura | Workspace → Host → Kernel → Tenant DB; consumidor opt-in | `crm-public-contracts`, `crm-authorization` | Declaração de código, não deploy |
| 02 · ERD | 8 entidades desenhadas + `crm_audit` descrita à parte | Cadastros, notas, tags, canais, CSV e perfis | Migration versionada, não aplicação real |
| 03 · Sequência | Criação de Person, contexto e transação | `crm-create-person` | Sem jornada real homologada |
| 04 · Eventos WA→CRM | `observed` → `resolved`/`review_required` | `crm-identity-events`, `crm-channels` | Consumer opt-in |
| 05 · Segurança | JWT, tenant, membership, FGA e DB | Todas com contexto e autorização | E2E negativo real pendente |
| 06 · Product Gate | Unit→CI→IAM→browser→restore→aceite | `crm-product-gate` | Planejamento, não entrega |

**Candidatos, ainda não diagramados/homologados:** fluxograma de duplicidade/merge, sequência CSV com falhas, máquina de estados de arquivamento e revisão humana WA. Não inserir novos campos na baseline universal congelada v1.0.0. Para qualquer alteração no código, revisar apenas os diagramas afetados pelo contrato da ação.

## 3. Matriz de autorização (recursos no código, não grants reais)

| Recurso | Operações de leitura | Operações de escrita | Gate |
|---|---|---|---|
| `crm:context` | resolver contexto autenticado | não é CRUD | membership, FGA, org/workspace, modo legacy/enforce |
| `crm:people` | buscar/consultar, timeline, duplicidades, CSV export | criar, atualizar, archive, CSV import | tenant A/B, limites, escopo |
| `crm:organizations` | consultar empresas CRM e vínculos | criar, editar, arquivar empresa CRM | ≠ Platform Organization |
| `crm:relationships` | vínculo lido sob `crm:organizations/read` | criar/remover vínculo | FK e tenant |
| `crm:tags` | listar tags e vínculos | criar, vincular, desvincular | isolamento, normalização |
| `crm:notes` | listar notas | registrar nota | limite e autor |
| `crm:employees` | consultar perfil legado | criar perfil | não é identidade Keycloak |
| `crm:channels` | consultar canais | vincular identidade | sem escrita WhatsApp |

O endpoint `GET capabilities` indica affordances da UI; **não substitui** verificação de permissão por requisição.

## 4. Lacunas, prioridades e decisões

| Prioridade | Lacuna | Critério / evidência |
|---|---|---|
| P0 | JWT Keycloak, OpenFGA, Workspace e tenants A/B reais | [STATUS](STATUS.md) + [EVOLUÇÃO](EVOLUCAO.md) 50.02, E2E e negativas |
| P0 | WA: idempotência, replay, revisão humana | [ação](acoes/crm-identity-events.md), CRM-WA-01.03/04 |
| P0 | SQL 002 e ativação multi-org | Migration/restore/gates aprovados |
| P1 | Cobertura de edge cases por ação | CP-01..04 executados com SHA, ambiente e PASS/FAIL/SKIP |
| P1 | UI com dados reais; recuperação e aceite | Browser E2E, runbook, restore e Product Gate |
| DECISÃO | CPF/CNPJ: checar dígito verificador? | Código atual verifica **comprimento**, aprovação necessária para mudança |
| DECISÃO | EmployeeProfile do CRM × Workforce P04 | Contratos/owner e plano de migração a aprovar |
| DECISÃO | Identidade WhatsApp ambígua e duplicados | Sem mescla/vínculo automático por inferência |

**Não criar tarefas atribuídas nem mudanças de código a partir deste documento.** Vincular decisões aprovadas ao ESCOPO e à WBS.
