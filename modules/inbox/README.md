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
