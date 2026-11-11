-- SM-03C: installer-owned schema service; no nested BEGIN/COMMIT or activation.
-- Requires Organizations 001/002/003, CRM 001/003 and Inbox 001 in public.
-- Trusted installer creates schema service inside its own outer transaction.
CREATE TABLE IF NOT EXISTS service.service_funnels(
 tenant_id uuid NOT NULL,organization_id uuid NOT NULL,workspace_id uuid NOT NULL,
 id uuid NOT NULL,code varchar(48) NOT NULL CHECK(code ~ '^[a-z][a-z0-9_-]{1,47}$'),
 name varchar(160) NOT NULL CHECK(length(btrim(name)) BETWEEN 2 AND 160),
 state varchar(12) NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','published')),
 revision integer NOT NULL DEFAULT 1 CHECK(revision=1),
 created_by varchar(256) NOT NULL,created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 published_at timestamptz,
 PRIMARY KEY(tenant_id,organization_id,workspace_id,id),
 UNIQUE(tenant_id,organization_id,workspace_id,code),
 FOREIGN KEY(tenant_id,organization_id,workspace_id)
  REFERENCES public.platform_workspaces(tenant_id,organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE IF NOT EXISTS service.service_funnel_stages(
 tenant_id uuid NOT NULL,organization_id uuid NOT NULL,workspace_id uuid NOT NULL,
 funnel_id uuid NOT NULL,id uuid NOT NULL,
 code varchar(48) NOT NULL CHECK(code ~ '^[a-z][a-z0-9_-]{1,47}$'),
 label varchar(120) NOT NULL CHECK(length(btrim(label)) BETWEEN 2 AND 120),
 position smallint NOT NULL CHECK(position BETWEEN 1 AND 8),
 terminal boolean NOT NULL DEFAULT false,
 PRIMARY KEY(tenant_id,organization_id,workspace_id,funnel_id,id),
 UNIQUE(tenant_id,organization_id,workspace_id,funnel_id,position),
 UNIQUE(tenant_id,organization_id,workspace_id,funnel_id,code),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,funnel_id)
  REFERENCES service.service_funnels(tenant_id,organization_id,workspace_id,id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX IF NOT EXISTS service_funnel_one_final
 ON service.service_funnel_stages(tenant_id,organization_id,workspace_id,funnel_id)
 WHERE terminal;

CREATE TABLE IF NOT EXISTS service.service_attendances(
 tenant_id uuid NOT NULL,organization_id uuid NOT NULL,workspace_id uuid NOT NULL,
 id uuid NOT NULL,protocol bigint GENERATED ALWAYS AS IDENTITY,
 funnel_id uuid NOT NULL,stage_id uuid NOT NULL,inbox_conversation_id uuid,
 request_key varchar(120) NOT NULL CHECK(length(btrim(request_key)) BETWEEN 8 AND 120),
 assigned_to varchar(256),state varchar(12) NOT NULL DEFAULT 'open'
  CHECK(state IN ('open','closed')),
 result varchar(240),version bigint NOT NULL DEFAULT 1 CHECK(version>0),
 created_by varchar(256) NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),closed_at timestamptz,
 PRIMARY KEY(tenant_id,organization_id,workspace_id,id),UNIQUE(protocol),
 UNIQUE(tenant_id,organization_id,workspace_id,request_key),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,funnel_id)
  REFERENCES service.service_funnels(tenant_id,organization_id,workspace_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,organization_id,workspace_id,funnel_id,stage_id)
  REFERENCES service.service_funnel_stages(tenant_id,organization_id,workspace_id,funnel_id,id)
   ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,inbox_conversation_id)
  REFERENCES public.inbox_conversations(tenant_id,id) ON DELETE RESTRICT,
 CHECK((state='open' AND result IS NULL AND closed_at IS NULL)
   OR (state='closed' AND length(btrim(result)) BETWEEN 2 AND 240 AND closed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS service_attendance_board_idx ON service.service_attendances
 (tenant_id,organization_id,workspace_id,funnel_id,state,stage_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS service.service_attendance_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 tenant_id uuid NOT NULL,organization_id uuid NOT NULL,workspace_id uuid NOT NULL,
 attendance_id uuid NOT NULL,actor_id varchar(256) NOT NULL,
 action varchar(20) NOT NULL CHECK(action IN ('created','stage_changed','assigned','closed')),
 previous_stage_id uuid,next_stage_id uuid,
 previous_assignee varchar(256),next_assignee varchar(256),
 result varchar(240),version bigint NOT NULL CHECK(version>0),
 recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(tenant_id,organization_id,workspace_id,attendance_id)
  REFERENCES service.service_attendances(tenant_id,organization_id,workspace_id,id) ON DELETE RESTRICT,
 UNIQUE(tenant_id,organization_id,workspace_id,attendance_id,version)
);
CREATE INDEX IF NOT EXISTS service_attendance_history_idx ON service.service_attendance_events
 (tenant_id,organization_id,workspace_id,attendance_id,id);

CREATE OR REPLACE FUNCTION service.service_funnel_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE s text; n int; lastpos int; finalpos int;
BEGIN
 IF TG_TABLE_NAME='service_funnel_stages' THEN
  SELECT state INTO s FROM service.service_funnels WHERE tenant_id=COALESCE(NEW.tenant_id,OLD.tenant_id)
   AND organization_id=COALESCE(NEW.organization_id,OLD.organization_id)
   AND workspace_id=COALESCE(NEW.workspace_id,OLD.workspace_id)
   AND id=COALESCE(NEW.funnel_id,OLD.funnel_id) FOR UPDATE;
  IF s IS DISTINCT FROM 'draft' THEN
   RAISE EXCEPTION 'Published funnel is immutable' USING ERRCODE='23514';
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 IF TG_OP='DELETE' OR OLD.state<>'draft' OR NEW.state<>'published'
   OR (OLD.tenant_id,OLD.organization_id,OLD.workspace_id,OLD.id,OLD.code,OLD.name,OLD.created_by)
      IS DISTINCT FROM
      (NEW.tenant_id,NEW.organization_id,NEW.workspace_id,NEW.id,NEW.code,NEW.name,NEW.created_by)
   OR NEW.revision<>1 OR NEW.published_at IS NULL THEN
  RAISE EXCEPTION 'Funnel definition is immutable' USING ERRCODE='23514';
 END IF;
 SELECT count(*),max(position),max(position) FILTER (WHERE terminal)
  INTO n,lastpos,finalpos FROM service.service_funnel_stages
  WHERE tenant_id=NEW.tenant_id AND organization_id=NEW.organization_id
   AND workspace_id=NEW.workspace_id AND funnel_id=NEW.id;
 IF n NOT BETWEEN 2 AND 8 OR lastpos<>n OR finalpos<>n THEN
  RAISE EXCEPTION 'Invalid ordered stages or final stage' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION service.service_funnel_attendance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE actor text; previous_pos int; next_pos int; terminal_stage boolean;
BEGIN
 actor:=nullif(btrim(current_setting('syndes.service_actor_id',true)),'');
 IF actor IS NULL OR length(actor)>256 OR NEW.created_by IS NULL THEN
  RAISE EXCEPTION 'Trusted service actor required' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(
  SELECT 1 FROM public.platform_workspaces w
  JOIN public.platform_organizations o ON o.tenant_id=w.tenant_id AND o.id=w.organization_id
  JOIN public.platform_org_memberships om ON om.tenant_id=w.tenant_id
   AND om.organization_id=w.organization_id AND om.principal_id=actor
  JOIN public.platform_workspace_memberships wm ON wm.tenant_id=w.tenant_id
   AND wm.organization_id=w.organization_id AND wm.workspace_id=w.id
   AND wm.principal_id=actor
  WHERE w.tenant_id=NEW.tenant_id AND w.organization_id=NEW.organization_id
   AND w.id=NEW.workspace_id AND w.status='active' AND o.status='active'
   AND om.role IN ('admin','editor') AND wm.role IN ('admin','editor')
   AND om.state='active' AND wm.state='active'
 ) THEN
  RAISE EXCEPTION 'Authorized workspace editor required' USING ERRCODE='23514';
 END IF;
 IF NEW.assigned_to IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.platform_workspace_memberships wm
  JOIN public.platform_org_memberships om ON om.tenant_id=wm.tenant_id
   AND om.organization_id=wm.organization_id AND om.principal_id=wm.principal_id
  WHERE wm.tenant_id=NEW.tenant_id AND wm.organization_id=NEW.organization_id
   AND wm.workspace_id=NEW.workspace_id AND wm.principal_id=NEW.assigned_to
   AND wm.state='active' AND om.state='active'
   AND wm.role IN ('admin','editor') AND om.role IN ('admin','editor')
 ) THEN
  RAISE EXCEPTION 'Assignee has no active workspace permission' USING ERRCODE='23514';
 END IF;
 IF NEW.inbox_conversation_id IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.inbox_conversations c WHERE c.tenant_id=NEW.tenant_id
   AND c.id=NEW.inbox_conversation_id AND c.platform_organization_id=NEW.organization_id
   AND c.platform_current_workspace_id=NEW.workspace_id
 ) THEN
  RAISE EXCEPTION 'Inbox conversation outside attendance scope' USING ERRCODE='23514';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM service.service_funnels f
  WHERE f.tenant_id=NEW.tenant_id AND f.organization_id=NEW.organization_id
   AND f.workspace_id=NEW.workspace_id AND f.id=NEW.funnel_id AND f.state='published') THEN
  RAISE EXCEPTION 'Published funnel required' USING ERRCODE='23514';
 END IF;
 SELECT position,terminal INTO next_pos,terminal_stage FROM service.service_funnel_stages
  WHERE tenant_id=NEW.tenant_id AND organization_id=NEW.organization_id
   AND workspace_id=NEW.workspace_id AND funnel_id=NEW.funnel_id AND id=NEW.stage_id;
 IF next_pos IS NULL THEN
  RAISE EXCEPTION 'Unknown stage' USING ERRCODE='23514';
 END IF;
 IF TG_OP='INSERT' THEN
  IF NEW.created_by<>actor OR next_pos<>1 OR NEW.version<>1
    OR NEW.state<>'open' OR NEW.assigned_to IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid attendance opening' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
 END IF;
 IF (OLD.tenant_id,OLD.organization_id,OLD.workspace_id,OLD.id,
      OLD.funnel_id,OLD.inbox_conversation_id,OLD.request_key,OLD.created_by,OLD.created_at)
    IS DISTINCT FROM
    (NEW.tenant_id,NEW.organization_id,NEW.workspace_id,NEW.id,
      NEW.funnel_id,NEW.inbox_conversation_id,NEW.request_key,NEW.created_by,NEW.created_at)
   OR NEW.version<>OLD.version+1 OR OLD.state<>'open' THEN
  RAISE EXCEPTION 'Attendance immutability/version check' USING ERRCODE='23514';
 END IF;
 IF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
  SELECT position INTO previous_pos FROM service.service_funnel_stages
   WHERE tenant_id=OLD.tenant_id AND organization_id=OLD.organization_id
    AND workspace_id=OLD.workspace_id AND funnel_id=OLD.funnel_id AND id=OLD.stage_id;
  IF NEW.state<>'open' OR abs(next_pos-previous_pos)<>1
   OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
   RAISE EXCEPTION 'Only adjacent manual stages allowed' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.state='closed' THEN
  IF NOT terminal_stage OR NEW.result IS NULL OR length(btrim(NEW.result))<2
   OR NEW.closed_at IS NULL OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
   RAISE EXCEPTION 'Close requires final stage' USING ERRCODE='23514';
  END IF;
 ELSIF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
  IF NEW.state<>'open' OR NEW.result IS NOT NULL THEN
   RAISE EXCEPTION 'Invalid assignment' USING ERRCODE='23514';
  END IF;
 ELSE
  RAISE EXCEPTION 'No direct attendance mutation' USING ERRCODE='23514';
 END IF;
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION service.service_funnel_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 INSERT INTO service.service_attendance_events(
  tenant_id,organization_id,workspace_id,attendance_id,actor_id,action,
  previous_stage_id,next_stage_id,previous_assignee,next_assignee,result,version)
 VALUES(NEW.tenant_id,NEW.organization_id,NEW.workspace_id,NEW.id,
  current_setting('syndes.service_actor_id'),
  CASE WHEN TG_OP='INSERT' THEN 'created'
   WHEN NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN 'stage_changed'
   WHEN NEW.state='closed' THEN 'closed' ELSE 'assigned' END,
  CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.stage_id END,NEW.stage_id,
  CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.assigned_to END,NEW.assigned_to,
  NEW.result,NEW.version);
 RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION service.service_funnel_no_audit_rewrite()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
 RAISE EXCEPTION 'Attendance history is append-only' USING ERRCODE='23514';
END $$;
DO $install$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_funnels'::regclass
  AND tgname='service_funnel_definition_guard') THEN
  CREATE TRIGGER service_funnel_definition_guard BEFORE UPDATE OR DELETE ON service.service_funnels
  FOR EACH ROW EXECUTE FUNCTION service.service_funnel_guard();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_funnel_stages'::regclass
  AND tgname='service_funnel_stages_guard') THEN
  CREATE TRIGGER service_funnel_stages_guard BEFORE INSERT OR UPDATE OR DELETE
  ON service.service_funnel_stages FOR EACH ROW EXECUTE FUNCTION service.service_funnel_guard();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_attendances'::regclass
  AND tgname='service_attendance_validate') THEN
  CREATE TRIGGER service_attendance_validate BEFORE INSERT OR UPDATE ON service.service_attendances
  FOR EACH ROW EXECUTE FUNCTION service.service_funnel_attendance_guard();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_attendances'::regclass
  AND tgname='service_attendance_audit') THEN
  CREATE TRIGGER service_attendance_audit AFTER INSERT OR UPDATE ON service.service_attendances
  FOR EACH ROW EXECUTE FUNCTION service.service_funnel_audit();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_attendance_events'::regclass
  AND tgname='service_attendance_no_rewrite') THEN
  CREATE TRIGGER service_attendance_no_rewrite BEFORE UPDATE OR DELETE
   ON service.service_attendance_events FOR EACH ROW EXECUTE FUNCTION service.service_funnel_no_audit_rewrite();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='service.service_attendance_events'::regclass
  AND tgname='service_attendance_no_truncate') THEN
  CREATE TRIGGER service_attendance_no_truncate BEFORE TRUNCATE ON service.service_attendance_events
   FOR EACH STATEMENT EXECUTE FUNCTION service.service_funnel_no_audit_rewrite();
 END IF;
END $install$;
