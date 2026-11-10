-- CANDIDATE ONLY (AK-40.01). NOT wired into the legacy Host migration manifest.
-- Generated from sql/001_account_hierarchy.sql; do not edit this output by hand.
-- Requires separately installed CRM/Inbox/WhatsApp schemas and approved AK-30 installer.
-- One tenant = one PostgreSQL database. Organizations are logical security domains.
-- Purely additive; no existing CRM/Inbox tables are altered here.
-- No default organization can be materialized from this SQL alone because
-- tenant_id is resolved from the trusted control-plane registry by the Host.
-- Bootstrap is one atomic, authorized call and never creates additional orgs.
CREATE TABLE IF NOT EXISTS organizations.platform_organizations (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  display_name TEXT NOT NULL CHECK(length(trim(display_name)) BETWEEN 1 AND 160),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_one_default_org_per_tenant
  ON organizations.platform_organizations(tenant_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS organizations.platform_org_memberships (
  tenant_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
  PRIMARY KEY(tenant_id,organization_id,principal_id),
  FOREIGN KEY(tenant_id,organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_org_memberships_principal
  ON organizations.platform_org_memberships(tenant_id,principal_id) WHERE state='active';

CREATE TABLE IF NOT EXISTS organizations.platform_workspaces (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
  slug TEXT NOT NULL CHECK(slug ~ '^[a-z][a-z0-9-]{0,62}$'),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,organization_id,id),
  UNIQUE(tenant_id,organization_id,slug),
  FOREIGN KEY(tenant_id,organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS platform_one_default_workspace_per_org
  ON organizations.platform_workspaces(tenant_id,organization_id) WHERE is_default;

CREATE TABLE IF NOT EXISTS organizations.platform_workspace_memberships (
  tenant_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  principal_id TEXT NOT NULL CHECK(length(principal_id) BETWEEN 1 AND 256),
  role TEXT NOT NULL CHECK(role IN ('admin','editor','viewer')),
  state TEXT NOT NULL DEFAULT 'active' CHECK(state IN ('active','revoked')),
  PRIMARY KEY(tenant_id,organization_id,workspace_id,principal_id),
  FOREIGN KEY(tenant_id,organization_id,workspace_id)
    REFERENCES organizations.platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,organization_id,principal_id)
    REFERENCES organizations.platform_org_memberships(tenant_id,organization_id,principal_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_workspace_memberships_principal
  ON organizations.platform_workspace_memberships(tenant_id,principal_id) WHERE state='active';

-- Unit represents an operational location (headquarters, branch, plant etc).
-- Site is reserved for a future publishing product, never a physical location.
CREATE TABLE IF NOT EXISTS organizations.platform_units (
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  organization_id UUID NOT NULL,
  name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 160),
  kind TEXT NOT NULL CHECK(kind IN ('headquarters','branch','other')),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,organization_id,id),
  FOREIGN KEY(tenant_id,organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);

-- A workspace may operate across zero or many units and vice-versa.
CREATE TABLE IF NOT EXISTS organizations.platform_workspace_units (
  tenant_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  workspace_id UUID NOT NULL,
  unit_id UUID NOT NULL,
  PRIMARY KEY(tenant_id,organization_id,workspace_id,unit_id),
  FOREIGN KEY(tenant_id,organization_id,workspace_id)
    REFERENCES organizations.platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT,
  FOREIGN KEY(tenant_id,organization_id,unit_id)
    REFERENCES organizations.platform_units(tenant_id,organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_workspace_units_by_unit
  ON organizations.platform_workspace_units(tenant_id,organization_id,unit_id);

CREATE TABLE IF NOT EXISTS organizations.platform_org_audit (
  tenant_id UUID NOT NULL,
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_id UUID NOT NULL,
  actor_id TEXT NOT NULL CHECK(length(actor_id) BETWEEN 1 AND 256),
  event TEXT NOT NULL CHECK(event IN ('default_context_initialized','unit_created')),
  entity_id UUID NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY(tenant_id,organization_id)
    REFERENCES organizations.platform_organizations(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS platform_org_audit_by_org
  ON organizations.platform_org_audit(tenant_id,organization_id,occurred_at DESC);
