# INBOX-06-R3 — Handoff: ponte WebSocket same-origin no BFF Next.js

## 1. Resumo

Implementada a ponte WebSocket same-origin mínima no BFF Next.js para o endpoint
`/api/v1/inbox/realtime` do backend, preservando guards e trusted ingress do
backend. Não foram alterados `apps/api`, auth global, tenant selection, provider
real, framework genérico nem billing. O token nunca viaja na URL do WebSocket.
A `Origin` é validada com falha fechada. A reconexão refetch do estado via REST
(fonte da verdade), sem depender de buffer de reprise.

## 2. Arquivos criados

| Arquivo | Propósito |
|---|---|
| `apps/web/src/modules/inbox/realtime.ts` | Cliente WebSocket same-origin: conexão, validação de origem, reconexão com refetch de estado, handlers de evento/heartbeat/revoked. |
| `apps/web/src/modules/inbox/realtime.spec.tsx` | Testes do cliente: origem (aceita/rejeita), conexão, despacho de eventos, filtro de heartbeat, revoke com close 1008, reconexão, limite de tentativas, disconnect cancela timers, sem reconexão após close explícito, sem duplicata. |
| `apps/web/src/app/api/backend/inbox/realtime/route.ts` | Rota ponte same-origin (`GET /api/backend/inbox/realtime`): autenticação via `auth()`, rejeição de seletores de tenant, encaminhamento para o backend. Documenta a limitação de runtime. |
| `apps/web/src/app/api/backend/inbox/realtime/route.spec.ts` | Testes diretos de fronteira da rota: rejeição de seletores de tenant, contrato sem token/tenant na URL. |

## 3. Limitação de runtime Next.js (documentada)

Next.js App Router route handlers **não expõem o evento `upgrade` do servidor
HTTP** nem dão acesso ao objeto de socket subjacente. Portanto não é possível
realizar um upgrade bruto de WebSocket dentro de `route.ts` usando apenas as
APIs públicas do Next.js.

Consequência: a rota ponte em `apps/web/src/app/api/backend/inbox/realtime/route.ts`
declara a interface da ponte e retorna `501` com descrição clara quando acessada
via HTTP, informando que o upgrade de WebSocket requer um servidor dedicado ou
proxy de mesma origem que espelhe o `upgrade` para
`SYNDES_API_URL/api/v1/inbox/realtime`, injetando `Authorization` e
`x-syndes-validated-*` a partir da sessão resolvida por `auth()`.

Enquanto o runtime não suportar upgrade, o cliente (`InboxRealtimeClient`)
degrade graciosamente para refetch REST em eventos `online`/`visibilitychange`
— o mesmo comportamento seguro já adotado no INBOX-05.

Para ativar o WebSocket de verdade em produção, é necessário:
- Um servidor dedicado ou proxy de mesma origem que faça o upgrade WebSocket;
- A ponte injeta server-side `Authorization: Bearer <accessToken>` e os headers
  `x-syndes-validated-*` (trusted ingress) a partir da sessão NextAuth;
- Nunca coloca token, tenant ou database na URL do WebSocket;
- Valida `Origin` contra `API_ORIGIN` / `WS_ALLOWED_ORIGINS` (fail-closed);
- Encaminha para `GET /api/v1/inbox/realtime` do backend existente.

## 4. Propriedades de segurança preservadas

| Propriedade | Como é garantida |
|---|---|
| Token nunca na URL | A ponte injeta `Authorization` server-side; o cliente conecta a um path de mesma origem sem query params sensíveis |
| Nenhum seletor de tenant do cliente | A rota rejeita quaisquer parâmetros de tenant/database na query (`400`); o tenant é resolvido server-side pela sessão |
| Origin validada (fail-closed) | O cliente valida `Origin` antes de conectar; a ponte server-side deve validar contra `API_ORIGIN` / `WS_ALLOWED_ORIGINS` |
| Autenticação server-side | A rota usa `auth()` (NextAuth); sessão inválida → `401` |
| Eventos são ponteiros | O cliente recebe apenas ids/estado; nenhum corpo, nota privada, nome de arquivo, tenant id ou database name viaja no socket |
| Reconnect refetch estado | Ao (re)conectar, o cliente chama `onRefetchState` para reconstruir o estado durável via REST |
| Isolamento cross-tenant | Mantido pelo backend (INBOX-04); a ponte não enfraquece autorização |

## 5. Testes

- `npm test` (apps/web): **58 testes passando** (12 arquivos), incluindo 16 novos testes do cliente realtime e 3 testes de fronteira da rota ponte.
- `npm run typecheck` (apps/web): **passou** (0 erros).
- `npm run lint` (apps/web): **passou** (0 erros nos arquivos tocados).

## 6. Riscos residuais

- A ponte WebSocket de upgrade real ainda requer um servidor dedicado ou proxy de mesma origem fora do escopo do App Router; a rota atual retorna 501 com descrição até que esse infraestrutura seja provisionada.
- O frontend continua sem cliente WebSocket nativo ativo; após a ponte ser provisionada, cabe ao web consumir o WS em vez de (ou junto com) o refetch REST.
- Isolamento cross-tenant, dedupe/ordenação e backup/restore de anexos permanecem sem prova executada nesta árvore (fora do escopo deste R3).

## 7. Próximos passos

1. Provisionar servidor dedicado/proxy de mesma origem para upgrade WebSocket, seguindo o contrato documentado na rota ponte.
2. Conectar o `InboxRealtimeClient` ao `InboxWorkspace` para consumir eventos realtime em vez de (ou junto com) o refetch REST.
3. Coordenação/Codex revisa e aceita formalmente este handoff; não há autoaceite.

## 8. Relação com INBOX-06-R3 (gate decision)

Este trabalho implementa a `CORREÇÃO MÍNIMA PROPOSTA` do relatório
`INBOX-06-R3-realtime-gate-decision.md`: ponte server-side pontual no web/BFF,
sem reabrir escopo, sem novo provider, sem framework genérico, sem alterar
`apps/api`.

## 9. INBOX-06-R3-F2 — transporte WebSocket real no runtime atual

Verificado que não existe servidor custom/proxy/deployment prévio na web e que
Next.js App Router route handlers não expõem o evento `upgrade` nem o socket
subjacente, portanto não é possível fazer upgrade bruto de WebSocket dentro de
`route.ts`.

- Prova executável: `apps/web/src/app/api/backend/inbox/realtime/route.proof.spec.ts`
  (4 testes): a rota ponte exporta apenas `GET`; com sessão válida responde `501`
  (não `101`); não coloca token nem tenant na URL do backend; rejeita seletor de
  tenant (`400`).
- Proposta de deployment: `docs/engineering/tasks/PRD-002/INBOX-06-R3-F2-server02-proposal.md`
  define server02 (Node + `ws`), pré-requisitos, contrato de segurança e integração
  com o `InboxRealtimeClient`, sem alterar `apps/api`.

Enquanto server02 não for provisionado, a rota retorna `501` e o cliente degrada
para refetch REST em `online`/`visibilitychange` (comportamento INBOX-05).
