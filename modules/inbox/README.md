# @syndes/core-inbox

Inbox module, installed as a **trusted compiled package** inside the Core Host. No separate container, WhatsApp library, QR-code handler, or tenant-selected database.

## Usage

The Core Host loads `@syndes/core-inbox/plugin` from `apps/core-host/config/modules.json`. Build order: Core Kernel → CRM → Inbox → Core Host. Apply the approved CRM migration before `001_inbox_foundation.sql` in each provisioned tenant database through the existing operator migration runner.

The HTTP base path is `/v1/tenants/:tenantId/inbox`; all operations require Keycloak access token and both tenant membership and OpenFGA policy. The browser UI is at `/inbox`. Configure Keycloak public OIDC client `syndes-inbox-ui` with authorization-code + PKCE S256, web origin, and exact redirect URI `https://<syndes-host>/inbox`. This is an operator onboarding step, not automatically provisioned by the module.

Routes: `GET/POST /conversations`, `GET /conversations/:id`, `GET /conversations/:id/messages`, `PATCH /conversations/:id/{assignment,status,handoff}`, `POST /conversations/:id/{replies,notes}`, `POST /conversations/:id/simulator/inbound`, and `GET /metrics`.

## Authorization resources

- `inbox:conversations`: `read`, `write`, `assign`
- `inbox:messages`: `read`, `reply`, `simulate`
- `inbox:notes`: `write`
- `inbox:metrics`: `read`

Permission descriptors **do not create OpenFGA tuples**. Provision minimal grants to tenant roles independently; no platform-admin bypass. Denials and policy outages fail closed before database selection.

A conversation has one optional CRM person reference enforced by a tenant-qualified FK. The channel is `simulation` for this iteration. To receive a simulated message, pass a stable `externalMessageId`; retries are deduplicated and conflicting payloads rejected. Agents must be assigned to reply or create internal notes; resolved/bot-handoff conversations reject human replies. A new inbound message reopens a resolved conversation. The UI polls the HTTP API every 7 seconds while active; this is **not** an authenticated WebSocket service.

## Developer checks

`cd modules/inbox && npm ci && npm run check && npm test`

The GitHub Actions workflow additionally runs the SQL migration twice in disposable PostgreSQL 17 and tests CRM tenant FKs, idempotency, status transitions, audit and cross-tenant denial. Production Keycloak, FGA and OpenBao configuration is not exercised by the standalone module CI.

## Scope boundaries

The provider simulator is intentionally not a public unauthenticated webhook. WhatsApp and Scheduling belong in later PRs. There is no real channel delivery, push WebSocket transport or attachment store in this foundation; media upload and push notifications require separate security/integration acceptance before production.

## Channel boundary

`InboundChannelAdapter` accepts an `InboundChannelEvent` independent of protocol. `SimulatedChannelAdapter` is the only registered provider in this PR and validates its channel before calling tenant-authorized Inbox operations. Future WhatsApp adapter and delivery acknowledgements require their own scoped PR; the simulation route is not an anonymous webhook.

## Browserless UI regression

Run `npm run test:ui` to execute the actual `public/app.js` in a minimal DOM model under Node.js `vm` (no Playwright/Chromium). The tests activate UI handlers, stub PKCE token exchange and tenant HTTP responses, and print sanitized `INBOX_FRONTEND_TRACE` and `INBOX_FRONTEND_DENIAL_TRACE` records to CI logs. This validates UI-to-API wiring and state transitions but **does not** validate CSS layout, real browser security behavior, WebSocket, or a real Keycloak login. The regular `npm test` also includes these tests.

## Core Host + PostgreSQL HTTP integration

`modules/inbox/test/postgres-integration.sh` provisions a disposable PostgreSQL container, applies CRM/Inbox migrations twice (idempotency), runs the Inbox repository integration and then `node --test apps/core-host/test/inbox-pg-http.integration.mjs`. This boots an **actual NestJS application** using installed Host plugin descriptors and the real PostgreSQL repository behind a test-only verifier/membership/FGA port; no production credentials, servers or graphical browsers. The HTTP suite asserts mounted assets/routes, input limits, missing records, auth, cross-tenant denials before DB leasing, CRM tenant-qualified FK, append retry/409, assignment/reply/handoff/status, metrics and audit. Production Keycloak/OpenFGA adapter end-to-end remains a separate gate.


## Filtros de fila por responsável

``GET /v1/tenants/:tenantId/inbox/conversations?status=open&queue=mine&limit=100`` permite ``queue`` opcional: ``all`` (padrão, compatível com clientes antigos), ``mine`` e ``unassigned``. O serviço resolve ``mine`` usando o ``actor.id`` verificado pelo Host, **não** aceita ``assigneeId`` na query string; o repositório aplica filtro por tenant, status e responsável **antes de LIMIT**, sem SQL dinâmico vindo do usuário. A permissão ``inbox:conversations/read`` continua exigida. Esta evolução não implementa paginação acima de 100 nem novas permissões automáticas.

## Atualização em tempo real (SSE) — primeira implementação do MVP (2026-11-02)

O endpoint `GET /v1/tenants/:tenantId/inbox/events` envia apenas eventos `changed`, **sem nomes, números, contatos ou mensagens no corpo**. Para estabelecer o stream o Core Host verifica JWT, membership do tenant e `inbox:conversations/read` no kernel/OpenFGA **antes** de escrever headers e sem selecionar banco. Os listeners são organizados por `tenantId` validado, limitados a 60 conexões por tenant. A conexão é encerrada pelo servidor após 60 segundos e precisa ser reautenticada, evitando autorização indefinida. Heartbeat periódico minimiza timeout intermediário. Mutação somente publica invalidation **após** API/DB confirmar sucesso.

O cliente usa `fetch` com header Bearer (o `EventSource` nativo não permite headers arbitrários) e, ao receber invalidation, consulta a lista e a conversa selecionada pelas rotas previamente autorizadas. Quando não há conexão SSE, reverte à consulta HTTP de 10 segundos, com reconexão em 5 segundos. Isso preserva a funcionalidade sem vazamento de dados através do barramento.

**Limitação:** transporte e barramento somente na memória de uma instância Core Host (nossa configuração de desenvolvimento atual). **Não funciona corretamente com múltiplas réplicas ou workers sem broker compartilhado**, nem garante entrega quando o cliente esteve offline. Nesse cenário a reconexão deve reconstruir o estado via API HTTP e, antes de escalar, será necessário Redis pub/sub ou equivalente. As mensagens continuam persistidas no banco do tenant; SSE não armazena dados.


## Stage C2b — Isolamento parcial da Inbox em HTTP, SQL e SSE (2026-11-09)

**Estado: branch de implementação para revisão, sem deploy nem liberação multi-org.**

O Core Host da Inbox verifica o usuário pelo Keycloak, exige membership do tenant e a permissão OpenFGA existente inbox:conversations/read **antes** de resolver o banco. Em seguida valida memberships ativas na Organização e Workspace **padrão**, auditoria de backfill Stage B e os índices SQL de trava 002. O cliente HTTP não pode escolher o contexto. Essa checagem ocorre em todo endpoint autenticado, inclusive quando a entrada posteriormente será rejeitada. Um usuário com grant somente de leitura pode resolver o contexto antes de ser negada uma alteração sem grant de escrita.

O InboxService repassa o contexto ao repositório; PgInboxRepository usa parâmetros vinculados platform_organization_id e platform_current_workspace_id para consultas, buscas, detalhes, mensagens, mutações, notas, atribuições, marcações e métricas **antes da paginação**. Conversas simuladas novas recebem owner, workspace de origem e workspace atual explícitos. O vínculo com pessoa do CRM exige proprietário compatível. Busca por dados de rota WhatsApp considera apenas contas da organização apropriada; o dispatcher Whatsmeow continua sendo um caminho pendente.

O bus SSE separa invalidações pelos três identificadores tenant/organização/workspace, sem corpo de conversas ou mensagens. Eventos internos legados apenas por tenant permanecem em namespace separado e **não alcançam** clientes SSE autenticados no contexto padrão. Streams expiram em 60 segundos e reautenticam na reconexão; não se promete revogação instantânea durante uma conexão já aberta.

O teste PostgreSQL descartável modules/inbox/test/pg-org-scope.mjs cria **duas organizações e três workspaces no mesmo tenant**, removendo os índices 002 SOMENTE dentro de transação reversível, e verifica negativas por UUID em listagem, busca, mutações, mensagens, métricas e CRM. A suíte HTTP PG instala as migrations e efetua bootstrap/backfill dos tenants de teste; ela não executa nenhuma migração no cliente.

**Gates que continuam abertos (#21 P0):** chamada de serviço legado sem contexto ainda usa SQL tenant-only por compatibilidade; Whatsmeow inbound/outbound, account routing, decoração de mensagens, trabalhos provider, autorizações de transferência e compartilhamento entre workspaces permanecem pendentes. Os índices platform_legacy_single_organization e platform_legacy_single_workspace NÃO podem ser removidos nem pode ser criada segunda organização/workspace em produção.

**Rollout:** antes de qualquer nova imagem Host, aplicar migrations CRM, Inbox, WhatsApp e Organizations 001–003, realizar bootstrap autorizado, executar backfill auditado, provisionar memberships e garantir grants Inbox existentes. O CRM também exige o grant independente crm:context/read. Instalar a imagem antes desses requisitos gera 403/503 e pode bloquear usuários. Esta PR não realiza deploy nem mudanças de FGA ou bancos operacionais.
