-- Applied separately to each tenant database AFTER 001_crm_foundation.sql.
BEGIN;
CREATE TABLE IF NOT EXISTS crm_tags(
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  label TEXT NOT NULL CHECK(char_length(label) BETWEEN 1 AND 64),
  label_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  UNIQUE(tenant_id,label_key)
);
CREATE TABLE IF NOT EXISTS crm_person_tags(
  tenant_id UUID NOT NULL,
  person_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,person_id,tag_id),
  FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id),
  FOREIGN KEY(tenant_id,tag_id) REFERENCES crm_tags(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_person_tags_tag_idx ON crm_person_tags(tenant_id,tag_id);
CREATE TABLE IF NOT EXISTS crm_notes(
  tenant_id UUID NOT NULL,
  id UUID NOT NULL,
  person_id UUID NOT NULL,
  body TEXT NOT NULL CHECK(char_length(body) BETWEEN 1 AND 5000),
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(tenant_id,id),
  FOREIGN KEY(tenant_id,person_id) REFERENCES crm_people(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS crm_notes_person_idx
  ON crm_notes(tenant_id,person_id,created_at DESC);
COMMIT;
