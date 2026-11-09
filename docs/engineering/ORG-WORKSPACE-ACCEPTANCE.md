# SM-F1.0c — Organization / Workspace security acceptance (issue #21)

## Scope and authority
One commercial tenant resolves to exactly one trusted tenant PostgreSQL database.
Platform organization is a logical isolation domain INSIDE that tenant.
Workspace is a work queue / logical operational scope inside a platform organization.
\`crm_organizations\` are CRM **contact companies** and never authority scopes;
\`platform_units\` represent branches and \`Site\` is reserved for portal publishing.

The user-selected organizationId and workspaceId are ONLY SQL lookup keys.
Authenticated identity comes from Keycloak, tenant membership and action grants from
CoreKernel/OpenFGA, and active organization+workspace membership from the tenant DB.
Selected viewer membership can read but never write. Neither UI controls nor a
client-selected tenant DB are sources of authorization.

## Ownership / visibility inventory

| Surface | Owner source | Read / write guard |
| --- | --- | --- |
| \`crm_people\`, \`crm_organizations\` (contact companies), \`crm_tags\` | immutable \`platform_organization_id\` | CoreKernel FGA + active platform membership + scoped SQL before pagination/search/CSV |
| \`crm_person_organizations\`, \`crm_person_tags\`, \`crm_notes\`, \`crm_employees\`, \`crm_audit\` | CRM person / contact-company / tag parent | Parent org predicates, SQL 005 cross-organization relation triggers |
| \`crm_channel_identities\` | CRM person, explicit \`platform_organization_id\` from SQL 005 | Scoped parent checks + immutable same-org trigger; per-org unique index |
| \`inbox_conversations\` | immutable \`platform_organization_id\`, immutable \`platform_origin_workspace_id\`, mutable \`platform_current_workspace_id\` | authenticated membership of selected org/current workspace; scoped SQL on search, queue, status, assignment, notes, metrics |
| \`inbox_messages\`, \`inbox_events\` | conversation parent | Parent scope in repository and organization/workspace SSE invalidation |
| \`whatsapp_accounts\` | immutable \`platform_organization_id\` | account owner + tenant; CoreKernel \`whatsapp:accounts\` FGA on human APIs |
| WhatsApp routes, history, groups, contact names, receipts | WhatsApp account + owning Inbox conversation | account↔conversation owner trigger (004), scoped human queries and account-authorized background projection |
| WhatsApp outbound queue | account owner and optional Inbox message / conversation parent | scoped reply SQL, worker recheck, SQL 005 cross-org outbox trigger |
| Channel events / worker | service-trusted account ID in tenant DB | DB-derived org/workspace; NEVER request-provided org, no cross-org event fanout |
| Inbox SSE | exact tenant+organization+current workspace | HTTP same context/FGA, same Host event bus; payload invalidation only, no PII |
| Workspace UI, CSV export | immutable \`TenantApi\` context | selected headers in REST/exports/SSE, remount CRM/Inbox to invalidate stale state |
| Org/workspace directory, create, transfer, units | platform membership and creator | FGA + active memberships + SQL CTE authorization+audit |

**Explicit sharing policy:** cross-organization CRM contact sharing is currently
**denied** (no automatic fallback and no implicit common global address book).
A future sharing product must use separately reviewed explicit grants; do not
reinterpret a CRM contact-company link as a platform-org grant.

**Not currently implemented:** Inbox attachment store / user-uploaded media;
the foundation README explicitly excludes it. Therefore there is no attachment
API on which to claim isolation. New attachment endpoints require their own
signed-access and owner checks before launch.

## Negative tests and migration evidence

- PostgreSQL disposable Org A/B, multiple workspaces; search, list, metrics,
  cross-org UUID requests, statuses, notes, replies, tags, contact links,
  worker inbound/outbound, provider account routing, CRM channels and SSE.
- FGA deny before resolving a DB, viewer read-only, revoked source/destination
  membership, same-org workspace transfer preserving conversation ID/history,
  no cross-org transfers.
- Tenant-scoped legacy direct callers fail closed whenever multi-org mode is
  enabled. With physical indexes 002 installed, a second context cannot exist.
- Migration 003 performs idempotent counted owner backfill with audit.
  Migration 004 rejects cross-org account routes.
  Migration 005 guards CRM relations, owner-binding and outbox, prepares
  per-org unique indexes. Migration 006 registers new org/workspace audits.
  Tests reapply 005/006 and run the full cutover in a rollbackable PG schema.
- Manual cutover script is EXCLUDED from the module migration registry; its
  preflight checks prior migrations, owner backfill, triggers, backup and Host
  attestation. Never run it through automatic deployment.

## Security / release gate (NOT the issue's coding acceptance)

The initial release continues with single default org/workspace and both
physical unique indexes from SQL 002. Product Gate is separately required
for multi-org production. The operator must prove (1) backup restoration,
(2) migration order, (3) active FGA grants, (4) single-transaction physical
cutover, (5) new Host built from approved SHA and (6) negative A/B smoke tests
before enabling SYNDES_MULTI_ORG_ENABLED=true. A true env flag alone cannot
bypass SQL 002. Never remove one index without the other.

Multi-replica SSE delivery is NOT guaranteed by the in-process bus; new
multi-replica deployments need a reviewed durable/pub-sub invalidation
transport (or sticky singleton deployment) and regression tests.
Do not equate code checks with that production guarantee.

**Current release state:** no merge into main, no migration of customer data,
no DevServer01 deploy, no Product Gate approval, no operational multi-org.
