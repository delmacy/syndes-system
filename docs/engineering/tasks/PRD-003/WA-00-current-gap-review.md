# WA-00 — Current implementation gap review (WhatsApp PRD-003)

## Scope and method

- **Target:** WA-01 through WA-05 of PRD-003 WhatsApp.
- **Method:** read-only review only. No application code was created, edited, or deleted. No destructive commands were run. No secrets were printed.
- **Reviewed artifacts:** `apps/api/src/modules/whatsapp/**`, `docs/product/PRD-003-WHATSAPP-SPEC.md`, `docs/engineering/PRD-003-WHATSAPP-SPRINT-PLAN.md`, `docs/engineering/tasks/PRD-003/WA-01..WA-05.md`, Inbox channel contracts (`apps/api/src/modules/inbox/channel/**`), tenant migrations, and web frontend WhatsApp surface.
- **Constraints honored:** MVP only; one WhatsApp number per tenant; provider Whatsmeow behind adapter; no public exposure; tenant selected server-side; authenticated/idempotent inbound; outbound only through Inbox; 40 messages/min/account; dirty tree preserved.

## Overall status

WA-01 to WA-05 are **substantially scaffolded** but not **complete** against the PRD-003 acceptance criteria. The WhatsApp module exists with config, schema, connection/session services, rate limiter, outbound queue + adapter, Whatsmeow provider, fake provider, controllers, audit, and tests. What is missing or incomplete: DB-level idempotency boundary for inbound WhatsApp, webhook trust-chain alignment with INBOX-03, authorization/isolation tests for WhatsApp, billing suspension enforcement in session/queue, E2E fake-provider and cross-tenant test suites, and reconciliation of ORM schema vs. tenant migrations.

## Gap map by sprint

### WA-01 — Contrato e persistência

| Required behavior | Status | Gap detail |
|---|---|---|
| One WhatsApp connection per tenant Basic | Implemented | `whatsapp_connections.singletonKey` unique per tenant DB; controller routes server-side via `TenantContext` |
| States `disconnected|pairing|connected|suspended|error` | Implemented | `whatsapp-connection.service.ts` + schema check constraint |
| Migrations on disposable test DB | Partially implemented | Migrations exist: `drizzle/tenant/20261030090000_whatsapp_connections.sql` and `20261030100000_whatsapp_entitlement.sql` |
| Authorization and isolation tests | **MISSING** | No spec exercises `requireAdmin`/`TenantContextGuard` cross-tenant or unauthorized access on `whatsapp.controller.ts` / `whatsapp-connection.service.ts`. Existing WhatsApp specs cover config, rate limiter, fake provider, whatsmeow provider, webhook controller only. |

**Schema/migration drift (security/consistency invariant):** `whatsapp.schema.ts` defines only `id, singletonKey, provider, status, phoneExternalId, sessionSecretRef, createdAt, updatedAt`. Migrations add `configured`, `authorized`, `service_enabled`, `suspension_reason` plus CHECK constraints (`authorization_check`, `connected_check`, `suspension_check`). The ORM entity and migrations are out of sync; billing suspension state cannot be read/enforced from the ORM model. Files: `apps/api/src/modules/whatsapp/whatsapp.schema.ts`, `apps/api/drizzle/tenant/20261030090000_whatsapp_connections.sql`, `apps/api/drizzle/tenant/20261030100000_whatsapp_entitlement.sql`.

**Missing test coverage:** `apps/api/src/modules/whatsapp/` has no `whatsapp-connection.service.spec.ts`, no `whatsapp.controller.spec.ts`, no cross-tenant/unauthorized WhatsApp spec. Depends on: `CoreCrmModule`, `InboxModule`, `PlatformCoreModule` (`whatsapp.module.ts` lines 18-19).

### WA-02 — Adapter e ciclo de sessão

| Required behavior | Status | Gap detail |
|---|---|---|
| Provider-neutral contract | Implemented | `whatsapp-provider.ts` (`WhatsAppProvider`), `fake-whatsapp.provider.ts`, `whatsmeow.provider.ts` |
| Fake adapter for CI | Implemented | `fake-whatsapp.provider.ts` + `fake-whatsapp.provider.spec.ts` |
| Pairing / connect / reconnect / disconnect | Implemented | `whatsapp-session.service.ts`; reconnect preserves session/config |
| Secrets segregated; logs sanitized | Partially | `whatsapp-audit.ts` catches and logs "details withheld"; `sessionSecretRef` column exists but is never populated/used (Whatsmeow is a remote sidecar, session lives there — acceptable for MVP) |
| Restart does not erase session/config | Implemented | `whatsapp-connection.service.ts` upserts on `singletonKey='default'`, preserving row |

**Dependency note:** Whatsmeow provider calls a remote sidecar over `fetch` (`whatsmeow.provider.ts` lines 11-24). No `whatsmeow` npm package is referenced in `apps/api/package.json` — integration is HTTP, so no new dependency is required. Confirmed: grep for `whatsmeow` in `apps/api/package.json` found no matches.

### WA-03 — Inbound, identidade e idempotência

| Required behavior | Status | Gap detail |
|---|---|---|
| Webhook/event authenticated | Implemented | `whatsapp-webhook.controller.ts` validates `Bearer` token with `timingSafeEqual` before tenant lookup |
| Idempotency by provider event id | **INCOMPLETE at DB level** | App-level dedup exists in `channel-ingress.service.ts` (`ingestWithinTenant` selects `inboxMessages` by `externalId`), but the insert does **not** set `sourceChannel = 'whatsapp'`. Therefore the DB unique index `inbox_messages_channel_external_unique` (`sourceChannel`, `externalId`) cannot enforce channel-scoped idempotency, and the app-level select is not channel-scoped either — a replayed external id could theoretically collide across channels/conversations within a tenant. Files: `apps/api/src/modules/inbox/channel/channel-ingress.service.ts` lines 179-190, `apps/api/src/modules/inbox/inbox.schema.ts` lines 108-112 |
| WhatsApp identity → CRM person | Implemented via shared contract | `crm_channel_identities` maps (channel, externalId) → Person; `channel-identities.schema.ts` check constraint allows only `'whatsapp'` |
| Delivery into Inbox | Implemented | `ChannelIngressService.ingestTrustedBinding` → creates conversation + inbound message with `deliveryStatus='dispatched'` |

**Trust-chain gap:** `whatsapp-webhook.controller.ts` line 34 fabricates `bindingToken: 'whatsmeow:${tenantId}'` directly instead of resolving through `InboxChannelRegistry`. It validates the tenant against the Control Plane `tenants` table, but bypasses the trusted registry binding that INBOX-03 requires ("binding token resolves through the trusted registry to exactly one tenant id, tenant database and product channel"). Files: `apps/api/src/modules/whatsapp/whatsapp-webhook.controller.ts`, `apps/api/src/modules/inbox/channel/inbox-channel-registry.ts`, `apps/api/src/modules/inbox/channel/channel-ingress.service.ts`.

**Missing test coverage:** No WhatsApp-specific inbound E2E/integration spec exercising duplicate → single message, cross-tenant, or unauthorized inbound. `channel-ingress.service.spec.ts` covers the generic ingress contract but not the WhatsApp webhook path end-to-end.

### WA-04 — Outbound e configuração (UX)

| Required behavior | Status | Gap detail |
|---|---|---|
| Send originated by Inbox reply | Implemented at port level | `messages.service.ts` calls `ChannelOutboundService.deliverPublicReply` → `ChannelAdapterRegistry.adapterFor('whatsapp')` → `WhatsAppOutboundAdapter.dispatchOutbound` → `WhatsAppOutboundQueue.dispatch` → `WhatsAppSessionService.sendText` |
| Outbound only via Inbox authorization | Implemented | Adapter is resolved from the conversation's persisted channel; `ChannelOutboundService` is the only dispatcher; web backend proxies `/api/backend/whatsapp/*` to the API with server-side auth (`apps/web/src/app/api/backend/[...path]/route.ts`) |
| Delivery states pending/sent/failed | Partially | `inboxMessages.delivery_status` supports `pending|dispatched|failed`; `ChannelOutboundService` persists dispatched/failed; no explicit "sent" state (PRD uses `dispatched`) |
| Config/status UI | Implemented | `apps/web/src/modules/whatsapp/whatsapp-workspace.tsx`, `api.ts`, `page.tsx`; tests in `whatsapp-workspace.spec.tsx` |
| Recoverable provider failure; session preserved | Implemented | Queue retries 3× with backoff; failure marks message `failed`, session/config untouched |
| Rate limit 40 msg/min/account | Implemented | `whatsapp-rate-limiter.ts` sliding window, limit 40, window 60s, per accountId; `whatsapp-rate-limiter.spec.ts` covers 40/41st and per-tenant independence |

**Rate-limit scope caveat:** `WhatsAppRateLimiter` is an in-memory `Map` per process instance. The 40/min/account limit is enforced per-process, not cluster-wide. For MVP on a single instance this satisfies the constraint, but it does not survive restart or scale across replicas. File: `apps/api/src/modules/whatsapp/whatsapp-outbound.queue.ts` lines 16-28 (serializes per tenant via tails map).

**Dependency:** `WhatsAppOutboundAdapter` registers itself as a production adapter on `OnModuleInit` (`whatsapp-outbound.adapter.ts` line 18). `ChannelAdapterRegistry.registerProductionAdapter` requires `productionProvider === true`, which the adapter declares (line 10).

### WA-05 — Integração, segurança e Product Gate

| Required behavior | Status | Gap detail |
|---|---|---|
| E2E fake provider on Tailscale | **MISSING** | No E2E spec covering config → session → inbound → Inbox → outbound → reconnect with the fake provider |
| Cross-tenant and unauthorized = 0 | **NOT TESTED for WhatsApp** | No WhatsApp cross-tenant or unauthorized access test suite exists |
| Reconnect, duplicate delivery, billing suspension | **NOT TESTED** | Suspension columns exist in migrations but no spec exercises suspension/reactivation or billing-driven `service_enabled=false` blocking send/receive |
| Security review, observability, gate decision | **PENDING** | Audit writes exist (`whatsapp-audit.ts`), metrics not confirmed |

**Billing suspension enforcement gap:** `whatsapp-session.service.ts` `sendText` blocks on `status === 'suspended'` but does not consult `service_enabled`/`suspension_reason`/`authorized` (columns that exist only in migrations, not the ORM schema). Billing-driven suspension is not enforced in code. Files: `apps/api/src/modules/whatsapp/whatsapp-session.service.ts`, `apps/api/drizzle/tenant/20261030100000_whatsapp_entitlement.sql`.

## Security invariants observed / at risk

- **Tenant isolation:** enforced by `TenantContext` server-side routing; no client tenant selector reaches WhatsApp code. Web backend strips tenant selectors (`apps/web/src/app/api/backend/[...path]/route.ts` lines 44-73).
- **Server-side authorization:** `requireAdmin` guards all management endpoints (`whatsapp.controller.ts` lines 67-71).
- **Authenticated/idempotent inbound:** webhook token validated with `timingSafeEqual`; but trust-chain bypass noted above and DB idempotency not channel-scoped.
- **No public exposure:** config defaults `bindHost=127.0.0.1`, `enabled=false`; `publicBaseUrl` must be HTTPS if set (`whatsapp.config.ts` lines 40-43).
- **Logs without secrets:** `whatsapp-audit.ts` withholds details; web `api.ts` does not surface provider/secret bodies; QR rendered client-side only.
- **Least privilege:** migrations add billing columns but ORM doesn't model them; session secret ref column unused.

## Files and tests referenced (read-only, not modified)

**WhatsApp module:** `whatsapp.module.ts`, `whatsapp.controller.ts`, `whatsapp-webhook.controller.ts`, `whatsapp.schema.ts`, `whatsapp.config.ts`, `whatsapp.config.spec.ts`, `whatsapp-connection.service.ts`, `whatsapp-session.service.ts`, `whatsapp-provider.ts`, `whatsmeow.provider.ts`, `whatsmeow.provider.spec.ts`, `fake-whatsapp.provider.ts`, `fake-whatsapp.provider.spec.ts`, `whatsapp-audit.ts`, `whatsapp-rate-limiter.ts`, `whatsapp-rate-limiter.spec.ts`, `whatsapp-outbound.adapter.ts`, `whatsapp-outbound.queue.ts`.

**Inbox contracts:** `inbox-channel.contracts.ts`, `channel-adapter-registry.ts`, `channel-ingress.service.ts`, `channel-ingress.service.spec.ts`, `channel-outbound.service.ts`, `inbox-channel-registry.ts`, `inbox.schema.ts`, `messages/messages.service.ts`.

**CRM:** `channel-identities/channel-identities.schema.ts`.

**Migrations:** `drizzle/tenant/20261030090000_whatsapp_connections.sql`, `drizzle/tenant/20261030100000_whatsapp_entitlement.sql`.

**Web:** `apps/web/src/modules/whatsapp/api.ts`, `whatsapp-workspace.tsx`, `whatsapp-workspace.spec.tsx`, `apps/web/src/app/whatsapp/page.tsx`, `apps/web/src/app/api/backend/[...path]/route.ts`.

## Conclusion

WhatsApp PRD-003 is scaffolded end-to-end but **not yet gated**. Concrete gaps to close before WA-05 acceptance: (1) channel-scoped DB idempotency for inbound WhatsApp (`sourceChannel` on ingress insert + channel-scoped dedup select), (2) webhook trust-chain resolution through `InboxChannelRegistry`, (3) WhatsApp authorization/isolation tests, (4) billing suspension enforcement in code using the migration columns, (5) E2E fake-provider, cross-tenant, unauthorized, duplicate-delivery, and suspension test suites, and (6) reconciliation of `whatsapp.schema.ts` ORM entity with the tenant migrations. No code was edited; this report is the only artifact created.
