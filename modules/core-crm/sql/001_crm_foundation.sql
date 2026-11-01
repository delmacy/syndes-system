-- Applied separately inside each tenant database. Never run against syndes_control.
BEGIN;
CREATE TABLE IF NOT EXISTS crm_organizations (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  legal_name TEXT NOT NULL CHECK (char_length(legal_name) BETWEEN 1 AND 160),
  trade_name TEXT,
  tax_id TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_org_name_idx ON crm_organizations(tenant_id,lower(legal_name))
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_org_taxid_idx ON crm_organizations(tenant_id,tax_id)
  WHERE archived_at IS NULL AND tax_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_people (
  id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  email TEXT,
  phone TEXT,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_people_name_idx ON crm_people(tenant_id,lower(name))
  WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS crm_people_email_idx ON crm_people(tenant_id,lower(email))
  WHERE archived_at IS NULL AND email IS NOT NULL;
CREATE INDEX IF NOT EXISTS crm_people_phone_idx ON crm_people(tenant_id,phone)
  WHERE archived_at IS NULL AND phone IS NOT NULL;

CREATE TABLE IF NOT EXISTS crm_person_organizations (
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,person_id,organization_id),
  FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id),
  FOREIGN KEY(tenant_id,organization_id) REFERENCES crm_organizations(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_person_org_by_org ON crm_person_organizations(tenant_id,organization_id);

CREATE TABLE IF NOT EXISTS crm_audit(
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  tenant_id UUID NOT NULL,
  actor_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_audit_tenant_idx ON crm_audit(tenant_id,recorded_at DESC);
COMMIT;
