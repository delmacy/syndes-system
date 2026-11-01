# Syndes — Inbox PRD-002: development checkpoint

## Scope and module mounting

The Inbox is an independently installed trusted business package (`@syndes/inbox/plugin`) declared in `apps/core-host/config/modules.json`, with a Nest API module, responsive browser UI, tenant-specific PostgreSQL migration and OpenFGA permissions. No Inbox-specific controller or provider is added to the Core Host. It depends on the CRM module for canonical Person links and on Platform security.

## Implemented and exercised

- [x] Conversation history, direction and author of messages.
- [x] Inbound receiver requires verified service actor; CoreKernel checks tenant membership and OpenFGA before resolving the database.
- [x] Tenant + channel + external message ID deduplication, including retries, against real PostgreSQL.
- [x] Durable outbound queue: human replies are recorded and queued, never sent directly to external providers.
- [x] Basic status (open/pending/resolved), self-claim/release, atomic ownership check and AI→human handoff marker.
- [x] Tenant-scoped event history with cursor, browser authorized polling every 5 seconds.
- [x] Structured attachment metadata table; source file transfer is NOT implemented.
- [x] Dedicated API and responsive UI, with PKCE login and no stored bearer access token.
- [x] Two isolated tenant databases and distinct PostgreSQL roles in CI.
- [x] Real generic Host mounting test with expected 401/403 and no tenant DB resolution before authorization.

## Incomplete MVP/production gates

- [ ] Attachment upload/download with trusted tenant-scoped object storage and validation; never accept arbitrary client URLs or paths.
- [ ] Dedicated authenticated channel adapter with provider inbound/outbound receipts and retries (in PRD-003 WhatsApp, not in Inbox).
- [ ] Restore/reconnect acceptance and concurrency stress beyond CI idempotence.
- [ ] Operational delivery state updates by the future queue consumer; queued messages are NOT yet actually delivered.
- [ ] Full browser staging journey with real Keycloak, provisioned OpenFGA tuples and authorized tenant/CRM identity.
- [ ] Access-reviewed authorization policy, backups and release gate.

This checkpoint is for the **development implementation of Inbox**, not for releasing an omnichannel product. Do not represent queued replies as WhatsApp deliveries, or event polling as a WebSocket push server.

## Acceptance evidence
GitHub Actions:
- `Core Inbox CI`: domain and database integration.
- `Core Host and Infrastructure CI`: generic module loader, image packaging and Security/Access stack.

No permanent service deployment, branch merge or real client data changes are authorized by this PR.
