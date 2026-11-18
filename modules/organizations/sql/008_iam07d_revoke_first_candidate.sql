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

-- IAM07D2: remote FGA target catalog is reconciliation metadata ONLY.
-- It is not a grant and cannot authorize an operation by itself.
-- A missing target is not evidence that external tuples are absent.
CREATE TABLE IF NOT EXISTS platform_iam_fga_grant_targets (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 principal_id TEXT NOT NULL,
 capability TEXT NOT NULL,
 resource_name TEXT NOT NULL CHECK(length(resource_name) BETWEEN 20 AND 512),
 fga_object TEXT NOT NULL CHECK(
  fga_object ~ '^iam_capability:[0-9a-f]{64}$'
 ),
 PRIMARY KEY(tenant_id,organization_id,workspace_id,
  principal_id,capability,resource_name),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,principal_id,capability)
  REFERENCES platform_iam_capability_fences(
   tenant_id,organization_id,workspace_id,principal_id,capability)
  ON DELETE RESTRICT
);

-- A durable tenant-local outbox row commits in the SAME transaction as the
-- deny fence. The Control receipt is written later and can fail independently.
-- Empty/unknown grant catalog means dispatch cannot claim completion.
CREATE TABLE IF NOT EXISTS platform_iam_revocation_outbox (
 operation_id UUID PRIMARY KEY,
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 principal_id TEXT NOT NULL,
 capability TEXT NOT NULL,
 revoked_epoch BIGINT NOT NULL CHECK(revoked_epoch>1),
 state TEXT NOT NULL DEFAULT 'pending'
  CHECK(state IN ('pending','delivered')),
 attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts>=0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 last_attempt_at TIMESTAMPTZ,
 delivered_at TIMESTAMPTZ,
 FOREIGN KEY(tenant_id,organization_id,workspace_id,principal_id,capability)
  REFERENCES platform_iam_capability_fences(
   tenant_id,organization_id,workspace_id,principal_id,capability)
  ON DELETE RESTRICT,
 CHECK((state='pending' AND delivered_at IS NULL) OR
       (state='delivered' AND delivered_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS platform_iam_revocation_outbox_pending
 ON platform_iam_revocation_outbox(tenant_id,created_at,operation_id)
 WHERE state='pending';
