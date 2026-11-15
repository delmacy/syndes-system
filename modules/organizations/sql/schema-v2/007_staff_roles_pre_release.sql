-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/007_staff_roles_pre_release.sql; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
-- Syndes DC-2c / issue #49: operational staff profiles and team structures.
-- MANUAL PRE-RELEASE MIGRATION. Do not register in plugin migration manifest.
-- Run inside an approved tenant DB after org 001/002, CRM 001/003 and
-- the controlled ownership migration 003. Never run against syndes_control.
-- No second organization/workspace, owner grant, identity or FGA tuple created.
BEGIN;

DO $preflight$
BEGIN
 IF to_regclass('organizations.platform_organizations') IS NULL OR
    to_regclass('organizations.platform_workspace_memberships') IS NULL OR
    to_regclass('crm.crm_employees') IS NULL OR
    to_regclass('crm.crm_people') IS NULL OR
    NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema='crm' AND table_name='crm_people'
       AND column_name='platform_organization_id'
    ) THEN
  RAISE EXCEPTION 'Workforce requires organization and CRM ownership migrations'
    USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='organizations'
   AND indexname='platform_legacy_single_organization'
 ) OR NOT EXISTS (
  SELECT 1 FROM pg_indexes WHERE schemaname='organizations'
   AND indexname='platform_legacy_single_workspace'
 ) THEN
  RAISE EXCEPTION 'SQL 002 physical single-context gate must remain in place'
    USING ERRCODE='55000';
 END IF;
END $preflight$;

-- Employee ID comes from CRM and is NOT a Keycloak user ID.
-- One active employee and one active principal may be linked per organization.
-- Old revoked links remain for audit; no implicit reactivation or replacement.
CREATE TABLE IF NOT EXISTS organizations.platform_staff_identity_links (
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
  REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,employee_id)
  REFERENCES crm.crm_employees(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,principal_id)
  REFERENCES organizations.platform_org_memberships(tenant_id,organization_id,principal_id)
  ON DELETE RESTRICT,
 CHECK (
  (state='active' AND revoked_by IS NULL AND revoked_at IS NULL) OR
  (state='revoked' AND revoked_by IS NOT NULL AND revoked_at IS NOT NULL)
 )
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_one_active_employee
 ON organizations.platform_staff_identity_links(tenant_id,organization_id,employee_id)
 WHERE state='active';
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_one_active_principal
 ON organizations.platform_staff_identity_links(tenant_id,organization_id,principal_id)
 WHERE state='active';

-- Business designation, NOT an OpenFGA permission and NOT an alias for
-- legacy workspace admin/editor/viewer. A target still needs full membership.
CREATE TABLE IF NOT EXISTS organizations.platform_workspace_staff_roles (
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
  REFERENCES organizations.platform_workspace_memberships(
   tenant_id,organization_id,workspace_id,principal_id)
  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_workspace_staff_active
 ON organizations.platform_workspace_staff_roles(tenant_id,organization_id,workspace_id,business_role)
 WHERE state='active';

CREATE TABLE IF NOT EXISTS organizations.platform_staff_teams (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 id UUID NOT NULL,
 name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 120),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','archived')),
 created_by TEXT NOT NULL CHECK(length(created_by) BETWEEN 1 AND 256),
 created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,organization_id,id),
 FOREIGN KEY(tenant_id,organization_id)
  REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_staff_team_unique_name
 ON organizations.platform_staff_teams(tenant_id,organization_id,lower(trim(name)))
 WHERE state='active';

CREATE TABLE IF NOT EXISTS organizations.platform_staff_team_workspaces (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 team_id UUID NOT NULL,
 workspace_id UUID NOT NULL,
 PRIMARY KEY(tenant_id,organization_id,team_id,workspace_id),
 FOREIGN KEY(tenant_id,organization_id,team_id)
  REFERENCES organizations.platform_staff_teams(tenant_id,organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,workspace_id)
  REFERENCES organizations.platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS organizations.platform_staff_team_members (
 tenant_id UUID NOT NULL,
 organization_id UUID NOT NULL,
 team_id UUID NOT NULL,
 principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
 team_role TEXT NOT NULL CHECK(team_role IN ('lead','member')),
 state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
 assigned_by TEXT NOT NULL CHECK(length(assigned_by) BETWEEN 1 AND 256),
 PRIMARY KEY(tenant_id,organization_id,team_id,principal_id),
 FOREIGN KEY(tenant_id,organization_id,team_id)
  REFERENCES organizations.platform_staff_teams(tenant_id,organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,principal_id)
  REFERENCES organizations.platform_org_memberships(tenant_id,organization_id,principal_id)
  ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_staff_team_members_active
 ON organizations.platform_staff_team_members(tenant_id,organization_id,principal_id)
 WHERE state='active';

CREATE TABLE IF NOT EXISTS organizations.platform_staff_access_audit (
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
  REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_staff_audit_org
 ON organizations.platform_staff_access_audit(tenant_id,organization_id,occurred_at DESC,id DESC);

-- Audit changes in the same transaction as identity/role transitions.
CREATE OR REPLACE FUNCTION organizations.platform_staff_identity_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $staff$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR NEW.organization_id<>OLD.organization_id OR
     NEW.id<>OLD.id OR NEW.principal_id<>OLD.principal_id OR
     NEW.employee_id<>OLD.employee_id OR
     NEW.bound_by<>OLD.bound_by OR NEW.bound_at<>OLD.bound_at OR
     OLD.state='revoked' OR NEW.state<>'revoked' THEN
   RAISE EXCEPTION 'Staff identity links are immutable, only revoke'
    USING ERRCODE='42501';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Staff identity records cannot be deleted' USING ERRCODE='42501';
 END IF;
 IF NEW.state='active' AND NOT EXISTS (
  SELECT 1 FROM crm.crm_employees e
  JOIN crm.crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
  JOIN organizations.platform_org_memberships m
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
DROP TRIGGER IF EXISTS staff_identity_validate ON organizations.platform_staff_identity_links;
CREATE TRIGGER staff_identity_validate
 BEFORE INSERT OR UPDATE OR DELETE ON organizations.platform_staff_identity_links
 FOR EACH ROW EXECUTE FUNCTION organizations.platform_staff_identity_validate();

CREATE OR REPLACE FUNCTION organizations.platform_staff_identity_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $audit$
BEGIN
 INSERT INTO organizations.platform_staff_access_audit(
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
DROP TRIGGER IF EXISTS staff_identity_audit ON organizations.platform_staff_identity_links;
CREATE TRIGGER staff_identity_audit
 AFTER INSERT OR UPDATE ON organizations.platform_staff_identity_links
 FOR EACH ROW EXECUTE FUNCTION organizations.platform_staff_identity_audit();

CREATE OR REPLACE FUNCTION organizations.platform_staff_role_validate()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $role$
BEGIN
 IF TG_OP='DELETE' THEN
  RAISE EXCEPTION 'Staff designations must be revoked, not deleted'
   USING ERRCODE='42501';
 END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.tenant_id<>OLD.tenant_id OR
     NEW.organization_id<>OLD.organization_id OR
     NEW.workspace_id<>OLD.workspace_id OR
     NEW.principal_id<>OLD.principal_id OR
     NEW.assigned_by<>OLD.assigned_by OR
     NEW.assigned_at<>OLD.assigned_at OR
     (NEW.state=OLD.state AND NEW.business_role=OLD.business_role) THEN
   RAISE EXCEPTION 'Invalid staff designation transition'
    USING ERRCODE='42501';
  END IF;
 END IF;
 IF NEW.state='active' AND NOT EXISTS (
  SELECT 1 FROM organizations.platform_workspace_memberships wm
  JOIN organizations.platform_org_memberships om ON om.tenant_id=wm.tenant_id
   AND om.organization_id=wm.organization_id AND om.principal_id=wm.principal_id
   AND om.state='active'
  JOIN organizations.platform_staff_identity_links l ON l.tenant_id=om.tenant_id
   AND l.organization_id=om.organization_id AND l.principal_id=om.principal_id
   AND l.state='active'
  JOIN crm.crm_employees e ON e.tenant_id=l.tenant_id
   AND e.id=l.employee_id AND e.active=true
  JOIN crm.crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
   AND p.archived_at IS NULL AND p.platform_organization_id=l.organization_id
  JOIN organizations.platform_organizations o ON o.tenant_id=om.tenant_id
   AND o.id=om.organization_id AND o.status='active'
  JOIN organizations.platform_workspaces w ON w.tenant_id=wm.tenant_id
   AND w.organization_id=wm.organization_id AND w.id=wm.workspace_id
   AND w.status='active'
  WHERE wm.tenant_id=NEW.tenant_id AND wm.organization_id=NEW.organization_id
   AND wm.workspace_id=NEW.workspace_id AND wm.principal_id=NEW.principal_id
   AND wm.state='active'
   AND (NEW.business_role='viewer' OR wm.role IN ('admin','editor'))
 ) THEN
  RAISE EXCEPTION 'Designation requires active employee and authorized scope'
   USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $role$;
DROP TRIGGER IF EXISTS staff_role_validate ON organizations.platform_workspace_staff_roles;
CREATE TRIGGER staff_role_validate
 BEFORE INSERT OR UPDATE OR DELETE ON organizations.platform_workspace_staff_roles
 FOR EACH ROW EXECUTE FUNCTION organizations.platform_staff_role_validate();

CREATE OR REPLACE FUNCTION organizations.platform_staff_role_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $audit$
BEGIN
 INSERT INTO organizations.platform_staff_access_audit(
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
DROP TRIGGER IF EXISTS staff_role_audit ON organizations.platform_workspace_staff_roles;
CREATE TRIGGER staff_role_audit
 AFTER INSERT OR UPDATE ON organizations.platform_workspace_staff_roles
 FOR EACH ROW EXECUTE FUNCTION organizations.platform_staff_role_audit();

CREATE OR REPLACE FUNCTION organizations.platform_staff_audit_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog AS $guard$
BEGIN
 RAISE EXCEPTION 'Staff audit records are append-only'
  USING ERRCODE='42501';
END $guard$;
DROP TRIGGER IF EXISTS staff_audit_no_changes ON organizations.platform_staff_access_audit;
CREATE TRIGGER staff_audit_no_changes
 BEFORE UPDATE OR DELETE OR TRUNCATE ON organizations.platform_staff_access_audit
 FOR EACH STATEMENT EXECUTE FUNCTION organizations.platform_staff_audit_guard();

-- No PUBLIC grants, no first identity, no tenant/org/workspace creation.
REVOKE ALL ON
 organizations.platform_staff_identity_links,organizations.platform_workspace_staff_roles,
 organizations.platform_staff_teams,organizations.platform_staff_team_workspaces,
 organizations.platform_staff_team_members,organizations.platform_staff_access_audit
 FROM PUBLIC;
COMMIT;
