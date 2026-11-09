# Organizations platform foundation

Trusted installed module @syndes/core-organizations.

001_account_hierarchy.sql creates additive tables in each existing tenant DB.
002_legacy_single_context_gate.sql enforces one organization and one workspace
per tenant until CRM, Inbox and WhatsApp queries/streams are fully migrated.
The gate uses unique PostgreSQL indexes, not a frontend feature flag.
POST /v1/tenants/:tenantId/platform/bootstrap creates one default organization and
one default workspace, only for a verified tenant admin via OpenFGA.
Retrying does not grant another caller admin. Bootstrap is idempotent.
GET /v1/tenants/:tenantId/platform/organizations lists membership-filtered orgs.
GET /v1/tenants/:tenantId/platform/organizations/:organizationId/workspaces
lists the workspaces to which the actor is a member.
GET and POST /v1/tenants/:tenantId/platform/organizations/:organizationId/units
are membership-filtered; edits require admin/editor and are audited.

Creation of additional organizations/workspaces is deliberately NOT enabled
until legacy CRM/Inbox enforce organization/workspace authorization.
Site is reserved for a future content-publishing product; unit = physical branch.

Run npm test; optional disposable PostgreSQL integration uses
SYNDES_ORG_TEST_PG_URL.
