# Organization / Unit / Workspace foundation — Increment F1.0a (code)

**Status:** implemented on branch feat/platform-org-unit-workspace-20261108, pending PR CI, PostgreSQL integration and controlled release.
**Related product gate:** docs/engineering/ADR-ACCOUNT-ORGANIZATION-UNIT-WORKSPACE-PROPOSAL.md (separate documentation PR #19).
**Baseline:** feat/workspace-contextual-nav-20261108 (PR #18). Do not merge this feature directly into the governance-only main branch.

## Deliberate scope of this code change

- Module @syndes/core-organizations installed through Core Host plugin contract.
- Tenant database tables: platform_organizations, platform_org_memberships,
  platform_workspaces, platform_workspace_memberships, platform_units,
  platform_workspace_units, platform_org_audit.
- Physical units are optional. Workspace↔Unit association has N:N schema with
  composite foreign keys for identical tenant AND organization.
- Existing tenant can be initialized by an authorized operator using
  POST /v1/tenants/:tenantId/platform/bootstrap. The bootstrap creates exactly
  one organization, one workspace, the first admin's memberships and an
  audit event in one SQL CTE statement. A repeated call creates nothing and
  does NOT enroll the second caller.
- GET /v1/tenants/:tenantId/platform/organizations
- GET /v1/tenants/:tenantId/platform/organizations/:organizationId/workspaces
- GET /v1/tenants/:tenantId/platform/organizations/:organizationId/units
- POST /v1/tenants/:tenantId/platform/organizations/:organizationId/units
- Every handler authenticates the Keycloak actor, checks verified tenant
  membership + OpenFGA permission BEFORE resolving the tenant DB, then checks
  active platform_org_memberships/platform_workspace_memberships for data.
- Unit creation requires organization editor/admin plus FGA write and inserts
  its audit record atomically.
- Future publishing Sites are not locations. Use Unit/platform_units only.

## NOT IMPLEMENTED / NOT APPROVED FOR ROLLOUT

- No creation of additional organizations or workspaces; existing CRM/Inbox
  queries still use tenant-scoped tables and could expose data if enabled.
- No staff invitation or principal↔CRM employee identity bridge; tenant admin
  must initialize default context, operator provisioning remains a future task.
- No migration of legacy CRM/Inbox rows, searches, SSE, exports or channel
  identities to organizational scope.
- No UI organization/workspace switcher or collaborative messaging.
- No Site publishing/intranet/portal module.
- No changes to DevServer01, active tenant DBs, live WhatsApp or FGA tuples.

## Release prerequisites

1. Complete PR-based code review, CI kernel/organizations/Host/Docker build,
   and disposable PostgreSQL migration-twice + isolation test.
2. Confirm Keycloak and OpenFGA grants for the intended tenant administrator.
   Core Host OpenFGA resources are sha256(tenantId+"|"+resource); resources:
   organizations:bootstrap (write), organizations:directory (read),
   organizations:units (read/write). Ensure resource→tenant relationships are
   provisioned by trusted admin procedure; do NOT grant all tenant members
   write or deploy a blanket allow rule.
3. Migrate the trusted deployed image with the existing operator script
   infra/postgres/bootstrap/migrate-modules-tenant.sh using an approved tenant
   ID and image. This creates empty additive tables, not a new Organization.
4. Invoke the one-time authenticated POST platform/bootstrap as approved
   tenant administrator; inspect initialized=true once and false on retry.
   Then GET organizations/workspaces and verify membership filtering.
5. Release only after backup, rollback of application image, error handling and
   no-verbose-logs policy are validated. Do not treat SQL rollback as dropping
   populated production tables.

## Testing and cross-module gates

- Unit tests assert auth before DB, tenant handle identity, actor-bound queries,
  unknown UUID rejection, unit role gate and atomic audit.
- Disposable Postgres test applies migration twice; initializes default,
  checks retry doesn't confer membership; checks tenant and org isolation,
  revocation, FK cross-org rejection, workspace-unit link and audit.
- Core Host test verifies descriptor, API mount, migration CLI, and regressions.
- Multi-organization UI/creation requires **separate** migration of CRM and
  Inbox to org/workspace owner with reviewed API compatibility and security.
  This is a HARD product gate, not an optional follow-up.

## Deviation/risk register

- Default provisioning currently requires a verified tenant administrator to
  execute bootstrap. It does NOT automatically adopt all legacy principals;
  this avoids automatically granting cross-org rights without consent.
- OpenFGA resources are new and require trusted provisioning. Existing role
  mappings may not contain these resources.
- Container tests and SQL integration require Linux CI; Windows dev hosts may
  lack Docker. The NestJS peer linker uses junctions on Windows to avoid
  requiring Developer Mode while retaining POSIX symlinks.
- Not ready for production or second-organization onboarding until these
  acceptance gates pass.
