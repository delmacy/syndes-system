-- Syndes Support 001: additive, tenant-local. Run only through the trusted Host installer.
-- P0: no WhatsApp message, CRM or control-plane table is modified.
BEGIN;
CREATE TABLE IF NOT EXISTS support_queues (
 code varchar(32) PRIMARY KEY,
 kind varchar(8) NOT NULL CHECK(kind IN ('external','internal')),
 label varchar(80) NOT NULL CHECK(length(trim(label))>0),
 UNIQUE(code,kind)
);
INSERT INTO support_queues(code,kind,label) VALUES
 ('external_general','external','Atendimento externo'),
 ('it_infra','internal','TI / Infraestrutura'),
 ('product','internal','Produto'),
 ('operations','internal','Operações'),
 ('administrative','internal','Administrativo')
ON CONFLICT(code) DO NOTHING;

CREATE TABLE IF NOT EXISTS support_queue_memberships (
 tenant_id uuid NOT NULL,
 queue_code varchar(32) NOT NULL REFERENCES support_queues(code),
 principal_id varchar(256) NOT NULL CHECK(length(trim(principal_id))>0),
 role varchar(16) NOT NULL CHECK(role IN ('agent','lead')),
 granted_by varchar(256) NOT NULL CHECK(length(trim(granted_by))>0),
 granted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(tenant_id,queue_code,principal_id)
);
CREATE INDEX IF NOT EXISTS support_queue_member_read_idx
 ON support_queue_memberships(tenant_id,principal_id,queue_code);

CREATE TABLE IF NOT EXISTS support_queue_membership_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 queue_code varchar(32) NOT NULL REFERENCES support_queues(code),
 principal_id varchar(256) NOT NULL,
 actor_id varchar(256) NOT NULL,
 action varchar(16) NOT NULL CHECK(action IN ('granted','revoked')),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS support_membership_audit_idx
 ON support_queue_membership_audit(tenant_id,queue_code,recorded_at DESC);
-- Enforce audit for manual/operator grants and revokes; never expose a public grant API.
CREATE OR REPLACE FUNCTION support_audit_queue_member()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $trigger$
DECLARE who text;
BEGIN
 IF TG_OP='UPDATE' THEN
  RAISE EXCEPTION 'Queue membership is immutable; revoke and regrant' USING ERRCODE='23514';
 ELSIF TG_OP='INSERT' THEN
  INSERT INTO support_queue_membership_audit(tenant_id,queue_code,principal_id,actor_id,action)
  VALUES(NEW.tenant_id,NEW.queue_code,NEW.principal_id,NEW.granted_by,'granted');
  RETURN NEW;
 ELSIF TG_OP='DELETE' THEN
  who:=current_setting('syndes.support_actor_id',true);
  IF who IS NULL OR length(trim(who)) NOT BETWEEN 1 AND 256 THEN
   RAISE EXCEPTION 'Revoke requires audited operator identity' USING ERRCODE='23514';
  END IF;
  INSERT INTO support_queue_membership_audit(tenant_id,queue_code,principal_id,actor_id,action)
  VALUES(OLD.tenant_id,OLD.queue_code,OLD.principal_id,who,'revoked');
  RETURN OLD;
 END IF;
 RETURN NULL;
END
$trigger$;
DO $install$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger
    WHERE tgname='support_queue_member_audit' AND tgrelid='support_queue_memberships'::regclass) THEN
  CREATE TRIGGER support_queue_member_audit
   BEFORE INSERT OR UPDATE OR DELETE ON support_queue_memberships
   FOR EACH ROW EXECUTE FUNCTION support_audit_queue_member();
 END IF;
END
$install$;

CREATE TABLE IF NOT EXISTS support_cases (
 tenant_id uuid NOT NULL,
 id uuid NOT NULL,
 protocol bigint GENERATED ALWAYS AS IDENTITY,
 kind varchar(8) NOT NULL CHECK(kind IN ('internal','external')),
 channel varchar(16) NOT NULL CHECK(channel IN ('form','whatsapp')),
 requester_id varchar(256) NOT NULL CHECK(length(trim(requester_id))>0),
 crm_person_id uuid,
 inbox_conversation_id uuid,
 commercial_tenant_ref uuid,
 queue_code varchar(32) NOT NULL,
 assigned_to varchar(256),
 priority varchar(16) NOT NULL CHECK(priority IN ('low','normal','high','critical')),
 status varchar(32) NOT NULL DEFAULT 'new'
  CHECK(status IN ('new','triage','in_progress','waiting_customer','resolved','closed')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 resolved_at timestamptz,
 closed_at timestamptz,
 PRIMARY KEY(tenant_id,id),
 UNIQUE(protocol),
 FOREIGN KEY(queue_code,kind) REFERENCES support_queues(code,kind),
 FOREIGN KEY(tenant_id,crm_person_id) REFERENCES crm_people(tenant_id,id),
 FOREIGN KEY(tenant_id,inbox_conversation_id) REFERENCES inbox_conversations(tenant_id,id),
 CHECK (
  (kind='internal' AND channel='form' AND inbox_conversation_id IS NULL AND crm_person_id IS NULL)
  OR
  (kind='external' AND channel='whatsapp' AND inbox_conversation_id IS NOT NULL AND crm_person_id IS NOT NULL)
 )
);
CREATE INDEX IF NOT EXISTS support_cases_scoped_list_idx
 ON support_cases(tenant_id,kind,queue_code,status,updated_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS support_cases_requester_idx
 ON support_cases(tenant_id,kind,requester_id,updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS support_cases_one_active_whatsapp
 ON support_cases(tenant_id,inbox_conversation_id)
 WHERE kind='external' AND status NOT IN ('closed');

CREATE TABLE IF NOT EXISTS support_case_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,
 case_id uuid NOT NULL,
 actor_id varchar(256) NOT NULL CHECK(length(trim(actor_id))>0),
 action varchar(32) NOT NULL
  CHECK(action IN ('created','status_changed','assigned','queue_transferred','internal_note')),
 previous_status varchar(32),
 next_status varchar(32),
 body text CHECK(body IS NULL OR (length(body) BETWEEN 1 AND 5000)),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,case_id) REFERENCES support_cases(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS support_case_events_history_idx
 ON support_case_events(tenant_id,case_id,id);
COMMIT;
