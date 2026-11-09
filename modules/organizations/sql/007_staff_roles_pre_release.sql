-- Syndes DC-2c / issue #49: operational staff profiles and team structures.
-- MANUAL PRE-RELEASE MIGRATION. Do not register in plugin migration manifest.
-- Run inside an approved tenant DB after org 001/002, CRM 001/003 and
-- the controlled ownership migration 003. Never run against syndes_control.
-- No second organization/workspace, owner grant, identity or FGA tuple created.
BEGIN;

DO $preflight$
BEGIN
 IF to_regclass('platform_organizations') IS NULL OR
    to_regclass('platform_workspace_memberships') IS NULL OR
    to_regclass('crm_employees') IS NULL OR
    to_regclass('crm_people') IS NULL OR
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema=current_schema() AND table_name='crm_people'
       AND column_name='platform_organization_id'
    ) THEN
  RAISE EXCEPTION 'Workforce requires organization and CRM ownership migrations'
    USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
   AND indexname='platform_legacy_single_organization'
 ) OR NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname=current_schema()
   AND indexname='platform_legacy_single_workspace'
 ) THEN
  RAISE EXCEPTION 'SQL 002 physical single-context gate must remain in place'
    USING ERRCODE='55000';
 END IF;
END $preflight$;

-- Employee ID comes from CRM and is NOT a Keycloak user ID.
-- One active employee and one active principal may be linked per organization.
-- Old revoked links remain for audit; no implicit reactivation or replacement.
CREATE TABLE IF NOT EXISTS platform_staff_identity_links (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 id UUID NOT NULL,
 employee_id UUID NOT NULL,
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 bound_by TEXT NOT NULL CHECK(length(bound_by) BETWEEN 1 AND 256),
 bound_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 revoked_by TEXT CHECK(revoked_by IS NULL OR length(revoked_by) BETWEEN 1 AND 256),
 revoked_at TIMESTAMPTZ,
 PRIMARY KEY(tenant_id,organization_id,id),
 FOREIGN KEY(tenant_id,organization_id)
  REFERENCES platform_organizations(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,employee_id)
  REFERENCES crm_employees(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,principal_id)
  REFERENCES platform_org_memberships(tenant_id,organization_id,principal_id)
  ON DELETE RESTRICT,
 CHECK (
  (state='active' AND revoked_by IS NULL AND revoked_at IS NULL) OR
  (state='revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_one_active_employee
 ON platform_staff_identity_links(tenant_id,organization_id,employee_id)
 WHERE state='active';
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_one_active_principal
 ON platform_staff_identity_links(tenant_id,organization_id,principal_id)
 WHERE state='active';

-- Business designation, NOT an OpenFGA permission and NOT an alias for
-- legacy workspace admin/editor/viewer. A target still needs full membership.
CREATE TABLE IF NOT EXISTS platform_workspace_staff_roles (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 business_role TEXT NOT NULL CHECK(business_role IN ('supervisor','agent','viewer')),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 assigned_by TEXT NOT NULL CHECK(length(assigned_by) BETWEEN 1 AND 256),
 assigned_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 changed_by TEXT NOT NULL CHECK(length(changed_by) BETWEEN 1 AND 256),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,organization_id,workspace_id,principal_id),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,principal_id)
  REFERENCES platform_workspace_memberships(
   tenant_id,organization_id,workspace_id,principal_id)
  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_workspace_staff_active
 ON platform_workspace_staff_roles(tenant_id,organization_id,workspace_id,business_role)
 WHERE state='active';

CREATE TABLE IF NOT EXISTS platform_staff_teams (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 id UUID NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','archived')),
 created_by TEXT NOT NULL CHECK(length(created_by) BETWEEN 1 AND 256),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,organization_id,id),
 FOREIGN KEY(tenant_id,organization_id)
  REFERENCES platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_team_unique_name
 ON platform_staff_teams(tenant_id,organization_id,lower(trim(name)))
 WHERE state='active';

CREATE TABLE IF NOT EXISTS platform_staff_team_workspaces (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 team_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 PRIMARY KEY(tenant_id,organization_id,team_id,workspace_id),
 FOREIGN KEY(tenant_id,organization_id,team_id)
  REFERENCES platform_staff_teams(tenant_id,organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,workspace_id)
  REFERENCES platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS platform_staff_team_members (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 team_id UUID NOT NULL,
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 team_role TEXT NOT NULL CHECK(team_role IN ('lead','member')),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 assigned_by TEXT NOT NULL CHECK(length(assigned_by) BETWEEN 1 AND 256),
 PRIMARY KEY(tenant_id,organization_id,team_id,principal_id),
 FOREIGN KEY(tenant_id,organization_id,team_id)
  REFERENCES platform_staff_teams(tenant_id,organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,principal_id)
  REFERENCES platform_org_memberships(tenant_id,organization_id,principal_id)
  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_staff_team_members_active
 ON platform_staff_team_members(tenant_id,organization_id,principal_id)
 WHERE state='active';

CREATE TABLE IF NOT EXISTS platform_staff_access_audit (
 tenant_id UUID NOT NULL,
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 organization_id UUID NOT NULL,
 actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 256),
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 event TEXT NOT NULL CHECK(event IN (
  'identity_linked','identity_revoked',
  'role_assigned','role_changed','role_revoked',
  'team_created','team_member_assigned','team_member_revoked'
 )),
 resource_id UUID NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,organization_id)
  REFERENCES platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_staff_audit_org
 ON platform_staff_access_audit(tenant_id,organization_id,occurred_at DESC,id DESC);

-- Audit changes in the same transaction as identity/role transitions.
CREATE OR REPLACE FUNCTION platform_staff_identity_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $staff$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR NEW.organization_id<>OLD.organization_id OR
     NEW.id<>OLD.id OR NEW.principal_id<>OLD.principal_id OR
     NEW.employee_id<>OLD.employee_id OR OLD.state='revoked' OR
     NEW.state<>'revoked' THEN
   RAISE EXCEPTION 'Staff identity links are immutable, only revoke'
    USING ERRCODE='42501';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Staff identity records cannot be deleted' USING ERRCODE='42501';
 END IF;
 IF NEW.state='active' AND NOT EXISTS (
  SELECT 1 FROM crm_employees e
  JOIN crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
  JOIN platform_org_memberships m
   ON m.tenant_id=p.tenant_id AND m.organization_id=NEW.organization_id
      AND m.principal_id=NEW.principal_id
  WHERE e.tenant_id=NEW.tenant_id AND e.id=NEW.employee_id AND e.active=true
   AND p.archived_at IS NULL
   AND p.platform_organization_id=NEW.organization_id
   AND m.state='active'
 ) THEN
  RAISE EXCEPTION 'Active employee, ownership and membership required'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $staff$;
DROP TRIGGER IF EXISTS staff_identity_validate ON platform_staff_identity_links;
CREATE TRIGGER staff_identity_validate
 BEFORE INSERT OR UPDATE OR DELETE ON platform_staff_identity_links
 FOR EACH ROW EXECUTE FUNCTION platform_staff_identity_validate();

CREATE OR REPLACE FUNCTION platform_staff_identity_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $audit$
BEGIN
 INSERT INTO platform_staff_access_audit(
  tenant_id,organization_id,actor_id,principal_id,event,resource_id
 ) VALUES(
  NEW.tenant_id,NEW.organization_id,
  CASE WHEN TG_OP='INSERT' THEN NEW.bound_by ELSE NEW.revoked_by END,
  NEW.principal_id,
  CASE WHEN TG_OP='INSERT' THEN 'identity_linked' ELSE 'identity_revoked' END,
  NEW.id
 );
 RETURN NEW;
END $audit$;
DROP TRIGGER IF EXISTS staff_identity_audit ON platform_staff_identity_links;
CREATE TRIGGER staff_identity_audit
 AFTER INSERT OR UPDATE ON platform_staff_identity_links
 FOR EACH ROW EXECUTE FUNCTION platform_staff_identity_audit();

CREATE OR REPLACE FUNCTION platform_staff_role_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $audit$
BEGIN
 INSERT INTO platform_staff_access_audit(
  tenant_id,organization_id,actor_id,principal_id,event,resource_id
 ) VALUES(
  NEW.tenant_id,NEW.organization_id,
  NEW.changed_by,NEW.principal_id,
  CASE
   WHEN TG_OP='INSERT' THEN 'role_assigned'
   WHEN NEW.state='revoked' THEN 'role_revoked'
   ELSE 'role_changed'
  END,
  NEW.workspace_id
 );
 RETURN NEW;
END $audit$;
DROP TRIGGER IF EXISTS staff_role_audit ON platform_workspace_staff_roles;
CREATE TRIGGER staff_role_audit
 AFTER INSERT OR UPDATE ON platform_workspace_staff_roles
 FOR EACH ROW EXECUTE FUNCTION platform_staff_role_audit();

CREATE OR REPLACE FUNCTION platform_staff_audit_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $guard$
BEGIN
 RAISE EXCEPTION 'Staff audit records are append-only'
  USING ERRCODE='42501';
END $guard$;
DROP TRIGGER IF EXISTS staff_audit_no_changes ON platform_staff_access_audit;
CREATE TRIGGER staff_audit_no_changes
 BEFORE UPDATE OR DELETE OR TRUNCATE ON platform_staff_access_audit
 FOR EACH STATEMENT EXECUTE FUNCTION platform_staff_audit_guard();

-- No PUBLIC grants, no first identity, no tenant/org/workspace creation.
REVOKE ALL ON
 platform_staff_identity_links,platform_workspace_staff_roles,
 platform_staff_teams,platform_staff_team_workspaces,
 platform_staff_team_members,platform_staff_access_audit
 FROM PUBLIC;
COMMIT;
