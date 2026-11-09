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
platform_backfill_legacy_ownership(tenantId) only when the authorized row
exists; SQL uses MATERIALIZED + LATERAL to prevent side effects without
membership. The function checks the single-context guard before any update,
locks per tenant, fails on conflicting owners, and updates all five parent
tables atomically. It returns counts, not personal or messaging content.

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
