-- IAM-07D1: CANDIDATE ONLY. MANUAL/CI; NOT registered in plugin migrations.
-- Revoke-first fence for the one physically selected tenant PostgreSQL database.
-- SQL002 multi-organization barrier MUST remain in place. No roles or grants.
-- A row is a restrictive guard, NOT a grant or replacement for OpenFGA.
-- No row => DENY. No control-plane/Keycloak-side direct revoke atomicity implied.
DO $preflight$
BEGIN
 IF to_regclass('platform_organizations') IS NULL OR
    to_regclass('platform_workspace_memberships') IS NULL OR
    NOT EXISTS (SELECT 1 FROM pg_indexes
      WHERE schemaname=current_schema()
        AND indexname='platform_legacy_single_organization') OR
    NOT EXISTS (SELECT 1 FROM pg_indexes
      WHERE schemaname=current_schema()
        AND indexname='platform_legacy_single_workspace') THEN
   RAISE EXCEPTION 'IAM07D requires active single-context barrier'
     USING ERRCODE='55000';
 END IF;
END $preflight$;

CREATE TABLE IF NOT EXISTS platform_iam_capability_fences (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 capability TEXT NOT NULL CHECK(capability IN (
  'inbox.conversation.claim',
  'inbox.conversation.transfer',
  'service.funnel.operate'
 )),
 epoch BIGINT NOT NULL CHECK(epoch>0),
 state TEXT NOT NULL CHECK(state IN ('active','revoked')),
 last_revoke_operation_id UUID,
 changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,organization_id,workspace_id,principal_id,capability),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,principal_id)
  REFERENCES platform_workspace_memberships(
   tenant_id,organization_id,workspace_id,principal_id)
  ON DELETE RESTRICT,
 CHECK ((state='active' AND last_revoke_operation_id IS NULL) OR
        (state='revoked' AND last_revoke_operation_id IS NOT NULL))
);
-- No default ACTIVE entry; provisioning of this independent restrictive fence
-- must be reviewed and NEVER inferred from a SQL role or coarse FGA write.
