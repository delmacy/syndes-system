# P02 Inbox · Assumir conversa multi-org · `p02-conversation-claim`

Revisão 21/11/2026, código `5c4efc5d`.

## A. Identidade e estado

Owner P02 Inbox; atendimento. Integração e aceite **NÃO HOMOLOGADOS**.

## B. Intenção e regra do domínio

Assumir conversa somente no tenant, organização e workspace autorizados. Modo legado nega.

## C. Fluxo e edge cases

JWT e contexto → Keycloak/Control/FGA exato → epoch/fence e escrita pinned → SSE. **EC-01:** grant revogado, outro escopo ou provider indisponível negam sem escrita.

## D. Contratos, métodos e APIs

`POST /v1/tenants/:tenantId/inbox/conversations/:id/claim`; `InboxController.claim` → `InboxHost.claimExact` → `OperationalIam07dOperations.claim`. Capability `inbox.conversation.claim`.

## E. Dados e integridade

`inbox_conversations`, `inbox_events`, fence/epoch IAM07D. Browser não define DSN nem autoridade de principal.

## F. Segurança e isolamento

Exige identidade e membership Keycloak atuais, Control ativo/ENABLED, grant FGA exato e ownership SQL. Manager não ganha acesso implícito.

## G. Frontend e estados visuais

Endpoint declarado não comprova botão integrado ou jornada de navegador homologada. Preservar Workspace existente.

## H. Eventos e dependências

Atribuição e auditoria são transacionais. SSE depende de topologia single-host validada ou broker; não presumir operação multi-host.

## I. Testes e casos Given/When/Then

**CP-01:** contexto e grants válidos permitem assumir a própria conversa. Negar tenant/org/workspace alheios, capability ausente, epoch revogado, provider down e modo legado. Referência: `tests/platform/iam-multiorg-keycloak-fga-http-ci.mjs`; arquivo presente não é aceite de staging.

## J. Fontes e próximos gates

[Controller](https://github.com/delmacy/syndes-system/blob/5c4efc5d306acc1eaf79ce4d8747e7d0983f528c/modules/inbox/src/inbox.controller.ts), [matriz](../MATRIZ-ACOES.md), [paridade](../PARIDADE-CODIGO.md). Product Gate permanece bloqueado.
