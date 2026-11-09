# Organizations platform foundation

Trusted installed module @syndes/core-organizations.

001_account_hierarchy.sql creates additive tables in each existing tenant DB.
002_legacy_single_context_gate.sql enforces one organization and one workspace
per tenant until CRM, Inbox and WhatsApp queries/streams are fully migrated.
The gate uses unique PostgreSQL indexes, not a frontend feature flag.
003_legacy_ownership.sql adds nullable, compound-FK owner columns for CRM
people/contact companies/tags, Inbox conversations with origin/current
workspaces, and WhatsApp accounts. Legacy child IDs/messages are untouched.
After authorized bootstrap, POST /v1/tenants/:tenantId/platform/default-context/backfill
binds existing rows atomically to the verified default; it requires FGA write
and active organization + workspace admin memberships. Repeat returns zero
counts. New legacy records inherit the default through database triggers.
Keep 002 installed until all CRM/Inbox/WhatsApp reads and writes enforce the
organization/workspace scope, even with the 003 ownership columns present.
POST /v1/tenants/:tenantId/platform/bootstrap creates one default organization and
one default workspace, only for a verified tenant admin via OpenFGA.
Retrying does not grant another caller admin. Bootstrap is idempotent.
GET /v1/tenants/:tenantId/platform/organizations lists membership-filtered orgs.
GET /v1/tenants/:tenantId/platform/organizations/:organizationId/workspaces
lists the workspaces to which the actor is a member.
GET and POST /v1/tenants/:tenantId/platform/organizations/:organizationId/units
are membership-filtered; edits require admin/editor and are audited.

Additional organizations/workspaces are supported through authorized,
audited Platform HTTP endpoints only after the separate manual Product Gate,
completed owner backfill, removal of the 002 unique indexes in one
transaction, explicit multi-org server enablement, and FGA grants.
They are NEVER provisioned implicitly or solely by toggling a flag.
POST /v1/tenants/:tenantId/platform/organizations is restricted to the
verified default tenant administrator; it atomically creates a new default
workspace and grants the creator admin membership.
POST /v1/tenants/:tenantId/platform/organizations/:organizationId/workspaces
requires an active organization admin and grants only the creator.
Migration 004 prevents cross-organization WhatsApp account routes.
Migration 005 adds CRM/Inbox/outbox ownership guards and scoped uniqueness.
Migration 006 adds audit events for newly created contexts.
manual/activate_multiple_organizations.sql is NOT a plugin migration.
It requires Product Gate, backup/restore proof and scoped Host deployment;
its disposable PG test never changes any real tenant database.
The original 002 single-context SQL gate remains the default SAFE state.
Site is reserved for a future content-publishing product; unit = physical branch.

Run npm test; optional disposable PostgreSQL integration uses
SYNDES_ORG_TEST_PG_URL.
