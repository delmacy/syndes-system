# SM-F1.0c — Migration map and fail-closed gate for legacy CRM, Inbox and WhatsApp

**State:** implementation staged in the feature PR stacked on #20. Not an approval
to create a second organization or workspace. This is a verified map of code
found in modules/core-crm, modules/inbox and modules/whatsapp as of 2026-11-08.
**Account/tenant** = physical PostgreSQL DB. **Organization** = company.
**Workspace** = logical work context. **Unit** = physical branch. **Site** is
reserved for the future publishing/intranet/consumer portal module.

## Immediate security finding

Today, CRM and Inbox service contexts carry only {actor, tenantId}, and the
existing repositories filter by tenant_id. The InboxChangeBus SSE subscriptions
are keyed by tenantId only, and WhatsApp account/route/replay queries are also
tenant-scoped. Tenant membership/FGA grants are NOT an organization/workspace
data boundary. A second organization created now would be exposed to legacy
reads, searches, CSV exports, history, metrics, WhatsApp account APIs and/or SSE
change notifications depending on the user's tenant permissions.

**First safety action: DB-enforced hard gate in**
modules/organizations/sql/002_legacy_single_context_gate.sql:
- UNIQUE(tenant_id) index on platform_organizations
- UNIQUE(tenant_id) index on platform_workspaces

Therefore no privileged or unprivileged path can accidentally add a second
organization/workspace by calling SQL on that tenant DB, even during concurrent
requests. Migration of an already multi-org tenant fails closed and does not
rewrite/de-duplicate records. These unique indexes deliberately remain until
the complete scope migration is proven and a later reviewed migration removes
them. They are NOT the final data model.

## Verified data ownership inventory

| Existing data / API family | Current state | Required future context and protection |
| --- | --- | --- |
| crm_people and identity normalization | Canonical per tenant; queries only tenant_id | Decide canonical global person + explicit org/workspace visibility links vs owner+sharing; ensure name/email/phone/CSV do not leak |
| crm_organizations / crm_person_organizations | CRM contact companies, not platform companies | Distinct platform organization; scope contact-company listing and relationship queries |
| crm_tags / crm_person_tags | Tenant-global tags and joins | Org/workspace policy; tag must not reveal other teams' person records |
| crm_notes / crm_audit | Tenant-global notes and event trail | Scope by accessible person and author; export and timeline restricted |
| crm_employees / crm_channel_identities | Employee != Keycloak user; identity globally unique within tenant | Audited principal↔employee bridge; scoped employee membership and cross-org channel identity policy |
| CRM HTTP /search /imports/csv /exports/csv | CRM service uses tenant-level CoreKernel grants | API resource path must identify verified org/workspace; filter before search/pagination and export; no client-selected tenant database |
| inbox_conversations | Keyed by (tenant_id, id); tenant-wide queue/list/detail/metrics | Ownership org/workspace, role filtered SQL and authorized handoffs; preserve original identity and history |
| inbox_messages / inbox_events | FK by tenant+conversation only | Inherit conversation's authorized org/workspace scope; prevents direct message-ID probing |
| Inbox REST /history /replies /notes /assignment /favorite | Tenant-level authorization and SQL | Check source/destination scope for every read/write and handoff; archive, attachment and export must follow same rules |
| InboxChangeBus SSE /events | Subscribers and publish keyed by tenant ID; changed events have no message content | Scope subscriptions/publish by authorized organization/workspace; keep session expiry/reauth and don't leak existence or activity |
| whatsapp_accounts | Account belongs to tenant, not organization; could represent a business number | Owner organization, workspace routing policy, capability grants and no cross-org account enumeration |
| whatsapp_conversation_routes | Tenant+conversation/account link | Ensure source account and conversation belong to same organization and channel routing is explicit; no implicit link |
| whatsapp_inbound_events / outbox / worker | Provider event and outbound send use tenant + account id | Trusted account ownership, dedupe & idempotency, org-safe dispatch and no cross-org outbound route |
| Whatsmeow history/contact name/group sync | Gateway/event paths update Inbox/CRM | Keep provider identity canonical; guard writes/replays against scope and cross-workspace history leakage |

This matrix is a migration blocker checklist, not proof that its future filters
are implemented.

## Staging plan and acceptance tests

**Stage A — Completed in this code branch:** indexes preventing any second
Organization or Workspace in a tenant. CI must apply migrations twice, reject
a second company and workspace with SQLSTATE 23505, and reject existing
duplicate companies during migration. First organization/workspace + optional
units continue to work; other tenants have independent defaults.

**Stage B — Ownership and legacy backfill:** design organizational membership
for legacy actors, canonical shared CRM identity policy and WhatsApp account
ownership. Add additive SQL owner/binding tables and FK constraints. Bootstrap
must map existing records to the tenant's single default organization/workspace
idempotently; subsequent legacy writes must receive an owner or be denied. Do
not rely on nullable ownership fields or UI filters to enforce isolation.

**Stage C — Contextual API and database isolation:** all CRM/Inbox reads and
writes, search, CSV, SSE and WhatsApp external events/outputs must resolve
and validate organization/workspace on the backend. Negative tests should
exercise known foreign IDs, query pagination, exports, thread event timing,
history sync, attachments and handoff. Account membership alone is not enough.
No use of unconditional tenant-wide FGA can_read when accessing sensitive HR.

**Stage D — Release gate:** only after stages B/C are green with real
Keycloak/OpenFGA/PostgreSQL and backup/rollback evidence may a separate,
reviewed migration remove the two hard gate indexes. Then expose POST
organization/workspace APIs and UI selector (SM-F1.0d), preserving optional
Units and reserved publishing Sites.

## Evidence/validation scope

- Unit + SQL integration tests in modules/organizations/test.
- Host plugin and migration CLI tests in apps/core-host/test.
- CI full Core Host, disposable PG and real Inbox/CRM/WhatsApp regressions.
- No deployment or live WhatsApp messages during these tests.
- Do not mask failing tests by disabling related workflows or bypassing
  authorization/transaction checks.

**Do not close #21 yet:** the database gate is a safety precursor, not the
full organization/workspace isolation migration.


## Stage B implemented in code PR (2026-11-08; pending PostgreSQL CI)

Migration modules/organizations/sql/003_legacy_ownership.sql adds **nullable,
FK-constrained** platform_organization_id to crm_people, crm_organizations
(CRM contact companies), crm_tags and whatsapp_accounts; and
platform_organization_id, platform_origin_workspace_id,
platform_current_workspace_id to inbox_conversations. The legacy rows keep
their original IDs, relationships, messages, events, channel identities and
provider delivery receipts. Child records inherit their parent's owner,
not a newly created duplicate person/message.

The owner fields are prefixed with platform_ to distinguish platform company
scope from CRM contact-company IDs. Triggers assign the verified default
Organization/Workspace to **new records** after bootstrap; before bootstrap
they may remain NULL (compatibility with existing tenant data). Updating a
previously assigned company owner or original workspace is rejected. Compound
foreign keys ensure that conversation origin and current workspace always
belong to the same tenant and company, once non-NULL. The SQL is idempotent.

The explicit administrative operation is:
POST /v1/tenants/:tenantId/platform/default-context/backfill

It requires verified Keycloak actor, tenant membership, OpenFGA
organizations:bootstrap/write and **active admin memberships in BOTH the
default organization and default workspace**. It invokes
platform_backfill_legacy_ownership(tenantId, verifiedActorId) only when the authorized row
exists; SQL uses MATERIALIZED + LATERAL to prevent side effects without
membership. The function checks the single-context guard before any update,
locks per tenant, fails on conflicting owners, and updates all five parent
tables atomically. It returns counts, not personal or messaging content.
Each authorized execution writes an append-only, transactionally linked row to
platform_legacy_backfill_runs (tenant, organization, authenticated actor,
per-table counts, timestamp). A failed or unauthorized attempt never writes
this audit row.

**Operator sequence after successful PR CI/review**:
1. Apply CRM, Inbox, WhatsApp, Organizations migrations through the trusted
   migration process; the 002 guard must be present before 003.
2. Bootstrap once as authorized administrator, granting default org/workspace
   memberships to that person. Do not re-enroll another actor on retry.
3. Invoke the authenticated backfill endpoint; record ONLY table counts. Run
   again and expect all zero without data loss. Never copy customer data into
   logs.
4. Validate that all CRM/Inbox/WhatsApp top-level records in the intended
   tenant have a valid owner. NULLs require investigation before enabling
   multi-org. Do not update another tenant from this operation.
5. Observe realtime, history and provider state; no outbound WhatsApp tests.
6. Keep 002 indexes installed. Stage C must explicitly select authorized
   context in ALL CRM/Inbox/WhatsApp API and SSE paths and convert owner
   columns to NOT NULL/validated FKs before stage D removes the indexes.

**Known limitation:** This is an *ownership scaffold* plus migration. It does
NOT constrain legacy CRM/Inbox REST, CSV, SSE or WhatsApp account routes to
the owner scopes. All those paths remain tenant-wide until Stage C.


## Stage C1 — CRM HTTP default-context access gate (PR #25 / 2026-11-09)

This first Stage C increment is intentionally limited to the ONE default
Organization and Workspace permitted by the
002_legacy_single_context_gate.sql migration. It does NOT unlock multiple
organizations or claim full per-record organization/workspace filtering.

All CRM Nest HTTP endpoints (people, contact companies, employees, tags,
relationships, notes, timelines, channel identities, duplicate search,
CSV import/export and UI capabilities) enter through CrmHost.context()
and CrmDefaultContextGuard before any CRM business query.

1. The Host validates Keycloak JWT; the actor is not caller-selectable.
2. CoreKernel checks tenant membership AND the new crm:context/read FGA grant
   BEFORE the tenant database is resolved.
3. The database checks active platform_org_memberships and
   platform_workspace_memberships for that actor on the default org/workspace.
4. An audited legacy backfill row must exist in platform_legacy_backfill_runs.
5. The legacy single-context UNIQUE indexes must still be installed.
   Removing either immediately denies CRM entry until fully scoped SQL takes
   over, preventing accidental unsafe multi-org activation.
6. A verified organizationId and workspaceId are available in CrmContext.

Missing membership responds 403 (not 401); bad bearer 401; missing DB service
fails closed with 503. The client cannot request a different organization
in this increment. The crm:context permission was added to the CRM plugin
metadata. OpenFGA tuples must be explicitly granted to intended CRM roles;
tenant membership alone must not allow CRM access.

**Mandatory future rollout order to avoid user lockouts**:
- Apply all three organization migrations to the approved tenant;
- Bootstrap default organization/workspace as approved tenant admin;
- Run default-context/backfill at least once and verify the audit row;
- Provision crm:context/read to authorized CRM roles via trusted FGA admin,
  alongside existing resource-specific action permissions;
- ONLY THEN release the CRM Host image and verify member access and
  same-tenant nonmember denial (especially CSV export and capabilities).

**Not yet finished:** All legacy CRM repository SQL remains tenant scoped,
and this gate only works as a cross-organization boundary because Stage A
forbids any second organization/workspace. An organization-aware SQL query
layer (including exports, nested contact/employee/channel associations,
writes and actor permission checks in-transaction), CRM-to-Inbox and
WhatsApp provider paths, and appropriate channel sharing policy still must
be implemented and tested before removing the indexes. Direct repository
calls outside the Nest HTTP controller are not covered by the HTTP guard.
No merge, customer migration, FGA admin change or deploy is included.


## Stage C2a — Explicit platform organization predicates in CRM PostgreSQL repository

Every CRUD/query method in PgCrmRepository and PgCrmExtras now accepts
an optional, server-verified platform organization ID from CrmContext.
The Core Host passes the authorization result from CrmDefaultContextGuard
to the CRM service and extras repository factories.

In the owner-aware path, CRM SQL uses **parameterized**
platform_organization_id predicates for top-level CRM people,
CRM contact-companies and tags. Dependent notes, audit timeline,
employees, channel identities, tags and CRM company associations are scoped
through parent ownership checks. Mutations by a known foreign ID return
not found/false (or fail without writing), with audit inserted only when a
scoped row is mutated. New person, contact-company, tag and CSV-import rows
receive their owner explicitly. Searches and CSV exports are filtered
**inside SQL before ORDER BY / LIMIT / OFFSET**, not on paginated results.

The org scope is supplied only by the HTTP Host's verified
CrmDefaultContextGuard (the client cannot submit it in the request body or
path). SQL marker fragments remain in the trusted module source and the
organization UUID is added to the bound query parameter list, never
interpolated. If an owner-scoped repository method forgets its owner marker
or an invalid UUID is passed, it fails closed before touching the DB.

**Integration test design:** modules/organizations/test/pg-crm-org-scope.test.mjs
creates two platform companies in ONE disposable tenant PostgreSQL schema.
For test only, it drops the temporary single-context indexes in that
disposable schema, then validates direct scoped CRM repositories cannot
see or mutate the other company's contacts, notes, tags, employees,
identities, links or CSV records even with known foreign UUIDs.
Real deployments retain the indexes, and Stage C1 continues to require
the default context and completed backfill before any CRM HTTP call.

**Open security work:** direct internal calls to CrmService/CrmExtras can
still omit organizationId to preserve existing legacy Inbox/WhatsApp callers.
That tenant-only path must be removed/restricted in a subsequent revision
after migrating these callers, and all organization ownership constraints,
uniqueness policies and sharing grants need a product decision. The
Stage C1 HTTP guard continues to require the SQL single-context gate.
Workspace-level CRM visibility is also not yet implemented: CRM is scoped
to platform organization only, while workspace memberships gate entry.
Do NOT enable a second company or remove the SQL indexes based solely on
this increment. No tenant migration or production rollout.


## Stage C2b — Isolamento parcial da Inbox em HTTP, SQL e SSE (2026-11-09)

**Estado: branch de implementação para revisão, sem deploy nem liberação multi-org.**

O Core Host da Inbox verifica o usuário pelo Keycloak, exige membership do tenant e a permissão OpenFGA existente inbox:conversations/read **antes** de resolver o banco. Em seguida valida memberships ativas na Organização e Workspace **padrão**, auditoria de backfill Stage B e os índices SQL de trava 002. O cliente HTTP não pode escolher o contexto. Essa checagem ocorre em todo endpoint autenticado, inclusive quando a entrada posteriormente será rejeitada. Um usuário com grant somente de leitura pode resolver o contexto antes de ser negada uma alteração sem grant de escrita.

O InboxService repassa o contexto ao repositório; PgInboxRepository usa parâmetros vinculados platform_organization_id e platform_current_workspace_id para consultas, buscas, detalhes, mensagens, mutações, notas, atribuições, marcações e métricas **antes da paginação**. Conversas simuladas novas recebem owner, workspace de origem e workspace atual explícitos. O vínculo com pessoa do CRM exige proprietário compatível. Busca por dados de rota WhatsApp considera apenas contas da organização apropriada; o dispatcher Whatsmeow continua sendo um caminho pendente.

O bus SSE separa invalidações pelos três identificadores tenant/organização/workspace, sem corpo de conversas ou mensagens. Eventos internos legados apenas por tenant permanecem em namespace separado e **não alcançam** clientes SSE autenticados no contexto padrão. Streams expiram em 60 segundos e reautenticam na reconexão; não se promete revogação instantânea durante uma conexão já aberta.

O teste PostgreSQL descartável modules/inbox/test/pg-org-scope.mjs cria **duas organizações e três workspaces no mesmo tenant**, removendo os índices 002 SOMENTE dentro de transação reversível, e verifica negativas por UUID em listagem, busca, mutações, mensagens, métricas e CRM. A suíte HTTP PG instala as migrations e efetua bootstrap/backfill dos tenants de teste; ela não executa nenhuma migração no cliente.

**Gates que continuam abertos (#21 P0):** chamada de serviço legado sem contexto ainda usa SQL tenant-only por compatibilidade; Whatsmeow inbound/outbound, account routing, decoração de mensagens, trabalhos provider, autorizações de transferência e compartilhamento entre workspaces permanecem pendentes. Os índices platform_legacy_single_organization e platform_legacy_single_workspace NÃO podem ser removidos nem pode ser criada segunda organização/workspace em produção.

**Rollout:** antes de qualquer nova imagem Host, aplicar migrations CRM, Inbox, WhatsApp e Organizations 001–003, realizar bootstrap autorizado, executar backfill auditado, provisionar memberships e garantir grants Inbox existentes. O CRM também exige o grant independente crm:context/read. Instalar a imagem antes desses requisitos gera 403/503 e pode bloquear usuários. Esta PR não realiza deploy nem mudanças de FGA ou bancos operacionais.


## Stage C3 — Whatsmeow account and route ownership; integration slice (2026-11-09)

**Release status:** draft only. Source changes are not installed on DevServer01 or on active tenant databases. This slice depends on #28 and the earlier foundation through #27.

The WhatsApp human HTTP API now resolves the actor from the trusted verifier, checks tenant membership and the existing whatsapp:accounts/read grant, and requires active membership in the ONE authorized default Organization and Workspace, Stage B audited backfill, and the SQL 002 single-context indexes. It does not accept caller-selected org/workspace IDs. Every account listing, account detail, create, toggle, pair, reconnect or disconnect, contact rename, avatar, or group action now uses this authorized context. Accounts themselves are organization-owned; workspaces gate operator access. Human Inbox WhatsApp replies, history and display decoration also propagate the verified context and scope related account/conversation SQL; legacy internal callers lacking scope are **not** treated as safe for multi-org.

The inbound webhook is still authenticated with its dedicated internal secret, not end-user FGA. It admits only enabled accounts with a non-NULL platform owner, and the worker selects pending events from those accounts and their active default workspaces. Projected conversations receive explicit immutable owning organization + origin/current workspace; conflict handling refuses an existing conversation with a different organization owner. Canonical JID reuse requires matching account ownership. The outbound worker requires an enabled owned account and, for an Inbox-originated reply, matching organization ownership of the Inbox message and conversation. Provider delivery metadata and routes remain account-local. Events lacking a valid owner are not projected or sent.

Migration **modules/organizations/sql/004_whatsapp_route_owner_guard.sql** (additive, after 003) preflights existing route ownership and fails closed if a route already crosses organizations, without repairing or deleting records. A database trigger checks the account and conversation owner on every route INSERT/UPDATE and prevents reassigning tenant, account or conversation identity. Legacy unbackfilled route rows are not deleted; attempts to update them without bound owners fail closed. The migration is idempotent and must be applied only through the controlled migration mechanism.

A disposable PostgreSQL test in **modules/whatsapp/test/pg-org-scope.mjs** constructs Org A and B (and their default workspaces) inside one tenant and verifies the complete path: account list/create/read isolation, raw inbound events and projection ownership, route mismatch rejection at SQL level, reply authorization by foreign UUID, and the durable outbound worker never dispatching an intent belonging to a foreign owner. The test drops 002 only in a rolled-back fixture; production must retain it.

**Open security gates:** SSE emission from Whatsmeow worker across replicas is not yet implemented; a tenant-only service path still exists for legacy callers. Multi-workspace routing, explicit account→workspace handling and authorized transfers across workspaces/organizations, preservation of history with revocation, schema uniqueness per organization and authoritative organization-scoped provider session controls require further design and testing. Before any removal of the single-context 002 indexes, those paths must be covered by cross-org and cross-workspace negative tests. No merge or deployment may imply multi-org is enabled.
