# Syndes Support — API e contratos de interface
Estado: implementação para review no PR da Issue #32, sem homologação/ativação.

## Segurança e autenticação
Base: `/v1/tenants/{syndesTenantId}/support`. `syndesTenantId` é UUID idêntica ao valor do servidor `SYNDES_SUPPORT_TENANT_ID`. Não inferir do frontend, nem permitir troca de tenant. JWT Bearer Keycloak, tenant membership e FGA obrigatórios antes da consulta; `support:cases:internal` e `support:cases:external` com ações `read/write`. Para caso externo criado pelo agente, ainda exigir `inbox:conversations/read` e `crm:people/read`. SQL exige membership ativo da fila para operação, e vínculo de Inbox/CRM/WhatsApp Syndes. GET para interno permite leitura ao solicitante **sem acesso às notas internas**; notas restritas a membros da fila. Todos os writes têm auditoria atômica.

## Endpoints implementados
| Rota | Verbo | Entrada | Resposta | WBS |
|---|---|---|---|---|
| `/{kind}/cases` | GET | `kind=internal|external`, query `queue,priority,status,assigneeId,limit,offset` | Case[] da audiência autorizada, paginada | 3.3/6.2 |
| `/{kind}/cases/{caseId}` | GET | UUID de ticket | Case ou 404 | 3.3/6.3 |
| `/{kind}/cases/{caseId}/events` | GET | UUID de ticket | CaseEvent[] filtrados por acesso, até 100 | 3.4/6.3 |
| `/internal/cases` | POST | `{queue,priority,description}` | Case criado; requester do JWT | 5.1/6.4 |
| `/external/cases` | POST | `{conversationId,priority}` | Case criado, somente conversa WhatsApp Syndes válida e contato CRM vinculado | 4.2/6.4 |
| `/{kind}/cases/{caseId}/status` | PATCH | `{status}` | Case atualizado, se transição permitida | 3.4/4.3/5.3 |
| `/{kind}/cases/{caseId}/assignment` | PATCH | `{assigneeId}` | Case atualizado; requer membro da fila | 3.4/5.3 |
| `/{kind}/cases/{caseId}/queue` | PATCH | `{queue}` | Case atualizado; requer vínculo fonte e destino | 3.4/5.3 |
| `/{kind}/cases/{caseId}/notes` | POST | `{body}` | CaseEvent privado; **sem envio de Inbox** | 4.4/5.3 |

Status: `new` → `triage` → `in_progress` → `waiting_customer`/ `resolved` → `closed`; `waiting_customer` → `in_progress`/ `resolved`; `triage` → `closed`; `resolved`/ `closed` → `triage` (reabrir). Somente caminhos explicitados no `src/domain.ts` são válidos. Priorização: `low,normal,high,critical`. Filas externas: `external_general`; internas: `it_infra,product,operations,administrative`.

Erros: 400 entrada inválida; 401 JWT ausente/inválido; 403 tenant sem acesso/grant não concedido; 404 caso não visível/operação não disponível; 409 conflito de caso ativo WhatsApp; 503 falha de FGA/PG/OpenBao. UUID e protocolo **não autorizam acesso**.

## Contrato de Case (resposta)
`id,protocol,kind,channel,requesterId,queue,assignedTo,priority,status,crmPersonId,conversationId,commercialTenantRef,createdAt,updatedAt,resolvedAt,closedAt,canOperate`. `canOperate` é **informação derivada da membership atual**, não concede FGA: o backend reavalia ao executar cada ação. `commercialTenantRef` nunca faz join no banco do cliente. `CaseEvent`: `id,action,actorId,previousStatus,nextStatus,body,recordedAt`. Não há SSE do Support nesta versão.

## Matriz de interface (sem elementos especulativos)
| Controle em `apps/support-web` | Requisito/WBS | Dados | Permissão | Erro e teste |
|---|---|---|---|---|
| Seletores externo/interno | SUP-01/SUP-03, 6.1 | `kind`, `GET cases` | FGA read por kind | 403 mostra erro, UI API test |
| Filtros fila/prioridade/estado | SUP-02, 6.2 | SQL `GET cases` | FGA read + row scoping | carregamento/erro, API test |
| Lista e detalhe | SUP-06, 6.2–6.3 | `GET cases` / `GET case` | FGA read + SQL | vazio/404, HTTP test |
| Linha do tempo | SUP-07/SUP-08, 6.3 | `GET events` | FGA read + filtro nota por fila | notas ocultas ao solicitante, PG test |
| Formulário interno | SUP-04, 6.4 | `POST internal/cases` | FGA internal/write | validação e erros 400/401/403/503 |
| Abertura externo com conversa Inbox | SUP-05, 4.2/6.4 | `GET inbox/conversations`, `POST external/cases` | Inbox/read+CRM/read+Support/write, membership | 409/404/403, PG test |
| Estado/atribuição/transferência | SUP-07, 6.3 | `PATCH` real | Support/write + membro fila | ações só para `canOperate`; validação backend |
| Nota interna | SUP-08, 6.3 | `POST notes` | Support/write + membro fila | sem outbound, PG test |
| Sair e login | SUP-01, 6.1 | OIDC PKCE S256, sessão isolada | cliente `syndes-support-ui` | auth tests, fail closed |

O frontend é outro bundle, com domínio/origin e client OIDC próprios. Nunca compartilhar sessionStorage ou client ID de Workspace/Platform Manager. O fluxo externo destinado ao cliente ocorre pelo WhatsApp da Syndes; não existe cadastro público anônimo de Cases.
