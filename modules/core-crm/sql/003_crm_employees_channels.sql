-- Tenant database migration 003; CRM profiles are not Keycloak accounts.
BEGIN;
CREATE TABLE IF NOT EXISTS crm_employees(
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  person_id UUID NOT NULL,
  job_title TEXT NOT NULL CHECK(char_length(job_title) BETWEEN 1 AND 160),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,person_id),
  FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS crm_channel_identities(
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  person_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK(channel IN ('whatsapp','instagram','email')),
  external_id TEXT NOT NULL CHECK(char_length(external_id) BETWEEN 1 AND 256),
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,channel,external_id),
  FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_channel_person_idx ON crm_channel_identities(tenant_id,person_id);
COMMIT;
