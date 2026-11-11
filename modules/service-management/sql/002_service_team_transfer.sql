-- SM-04: ONLY for approved staging after Organizations/manual 007 and service 001.
-- This schema is a tenant-local opt-in. No changes to Control, Inbox or CRM.
DO $preflight$ BEGIN
 IF to_regclass('service.service_attendances') IS NULL OR
    to_regclass('service.service_attendance_events') IS NULL OR
    to_regclass('public.platform_staff_teams') IS NULL OR
    to_regclass('public.platform_staff_team_workspaces') IS NULL OR
    to_regclass('public.platform_staff_team_members') IS NULL OR
    to_regclass('public.platform_staff_identity_links') IS NULL OR
    to_regclass('public.platform_workspace_staff_roles') IS NULL OR
    NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='platform_legacy_single_organization') OR
    NOT EXISTS(SELECT 1 FROM pg_indexes
     WHERE schemaname='public' AND indexname='platform_legacy_single_workspace') THEN
  RAISE EXCEPTION 'Service teams require manual Workforce 007 and SQL002'
   USING ERRCODE='55000';
 END IF;
END $preflight$;

ALTER TABLE service.service_attendances ADD COLUMN IF NOT EXISTS team_id UUID;
ALTER TABLE service.service_attendance_events ADD COLUMN IF NOT EXISTS previous_team_id UUID;
ALTER TABLE service.service_attendance_events ADD COLUMN IF NOT EXISTS next_team_id UUID;
ALTER TABLE service.service_attendance_events ADD COLUMN IF NOT EXISTS transfer_reason VARCHAR(240);
DO $constraints$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='service.service_attendances'::regclass
    AND conname='service_team_workspace_fk') THEN
  ALTER TABLE service.service_attendances ADD CONSTRAINT service_team_workspace_fk
   FOREIGN KEY(tenant_id,organization_id,team_id,workspace_id)
   REFERENCES public.platform_staff_team_workspaces(tenant_id,organization_id,team_id,workspace_id)
   ON DELETE RESTRICT;
 END IF;
END $constraints$;
ALTER TABLE service.service_attendance_events
 DROP CONSTRAINT IF EXISTS service_attendance_events_action_check;
ALTER TABLE service.service_attendance_events ADD CONSTRAINT service_attendance_events_action_check
 CHECK(action IN ('created','stage_changed','assigned','closed','team_transferred'));
CREATE INDEX IF NOT EXISTS service_attendance_active_team_idx
 ON service.service_attendances(tenant_id,organization_id,workspace_id,team_id,state)
 WHERE team_id IS NOT NULL;

-- Business designation is NOT an OpenFGA tuple. Both Host module/resource FGA
-- and tenant+org+workspace membership are separately required.
CREATE OR REPLACE FUNCTION service.service_team_is_supervisor(t UUID,o UUID,w UUID,subject TEXT)
RETURNS BOOLEAN STABLE LANGUAGE SQL SECURITY INVOKER AS $fn$
 SELECT EXISTS(
 SELECT 1 FROM public.platform_workspace_staff_roles r
 JOIN public.platform_staff_identity_links l ON l.tenant_id=r.tenant_id
   AND l.organization_id=r.organization_id AND l.principal_id=r.principal_id
   AND l.state='active'
 JOIN public.crm_employees e ON e.tenant_id=l.tenant_id AND e.id=l.employee_id
   AND e.active=true
 JOIN public.crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
   AND p.archived_at IS NULL AND p.platform_organization_id=r.organization_id
 JOIN public.platform_org_memberships om ON om.tenant_id=r.tenant_id
   AND om.organization_id=r.organization_id AND om.principal_id=r.principal_id
   AND om.state='active' AND om.role IN ('admin','editor')
 JOIN public.platform_workspace_memberships wm ON wm.tenant_id=r.tenant_id
   AND wm.organization_id=r.organization_id AND wm.workspace_id=r.workspace_id
   AND wm.principal_id=r.principal_id AND wm.state='active'
   AND wm.role IN ('admin','editor')
 WHERE r.tenant_id=t AND r.organization_id=o AND r.workspace_id=w
   AND r.principal_id=subject AND r.state='active' AND r.business_role='supervisor'
 );
$fn$;

CREATE OR REPLACE FUNCTION service.service_team_can_read(t UUID,o UUID,w UUID,team UUID,subject TEXT)
RETURNS BOOLEAN STABLE LANGUAGE SQL SECURITY INVOKER AS $fn$
 SELECT CASE WHEN team IS NULL THEN true ELSE
 service.service_team_is_supervisor(t,o,w,subject) OR EXISTS(
 SELECT 1 FROM public.platform_staff_team_members tm
 JOIN public.platform_staff_teams st ON st.tenant_id=tm.tenant_id
   AND st.organization_id=tm.organization_id AND st.id=tm.team_id AND st.state='active'
 JOIN public.platform_staff_team_workspaces tw ON tw.tenant_id=tm.tenant_id
   AND tw.organization_id=tm.organization_id AND tw.team_id=tm.team_id
   AND tw.workspace_id=w
 JOIN public.platform_workspace_staff_roles r ON r.tenant_id=tm.tenant_id
   AND r.organization_id=tm.organization_id AND r.workspace_id=w
   AND r.principal_id=tm.principal_id AND r.state='active'
   AND r.business_role IN ('agent','supervisor')
 JOIN public.platform_staff_identity_links l ON l.tenant_id=tm.tenant_id
   AND l.organization_id=tm.organization_id AND l.principal_id=tm.principal_id
   AND l.state='active'
 JOIN public.crm_employees e ON e.tenant_id=l.tenant_id AND e.id=l.employee_id
   AND e.active=true
 JOIN public.crm_people p ON p.tenant_id=e.tenant_id AND p.id=e.person_id
   AND p.archived_at IS NULL AND p.platform_organization_id=tm.organization_id
 JOIN public.platform_org_memberships om ON om.tenant_id=tm.tenant_id
   AND om.organization_id=tm.organization_id AND om.principal_id=tm.principal_id
   AND om.state='active' AND om.role IN ('admin','editor')
 JOIN public.platform_workspace_memberships wm ON wm.tenant_id=tm.tenant_id
   AND wm.organization_id=tm.organization_id AND wm.workspace_id=w
   AND wm.principal_id=tm.principal_id AND wm.state='active'
   AND wm.role IN ('admin','editor')
 WHERE tm.tenant_id=t AND tm.organization_id=o AND tm.team_id=team
   AND tm.principal_id=subject AND tm.state='active'
 ) END;
$fn$;

CREATE OR REPLACE FUNCTION service.service_team_is_staffed(t UUID,o UUID,w UUID,team UUID)
RETURNS BOOLEAN STABLE LANGUAGE SQL SECURITY INVOKER AS $fn$
 SELECT EXISTS(
 SELECT 1 FROM public.platform_staff_team_members tm
 JOIN public.platform_staff_teams st ON st.tenant_id=tm.tenant_id
   AND st.organization_id=tm.organization_id AND st.id=tm.team_id AND st.state='active'
 JOIN public.platform_staff_team_workspaces tw ON tw.tenant_id=tm.tenant_id
   AND tw.organization_id=tm.organization_id AND tw.team_id=tm.team_id
   AND tw.workspace_id=w
 WHERE tm.tenant_id=t AND tm.organization_id=o AND tm.team_id=team
   AND tm.state='active' AND service.service_team_can_read(t,o,w,team,tm.principal_id)
 );
$fn$;

-- Explicit opt-in upgrade of the old guard and audit in exactly the same tx.
-- No backfill, no rewriting old protocols, and SQL002 remains physically active.
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
 IF NEW.team_id IS NOT NULL AND NEW.assigned_to IS NOT NULL
   AND NOT service.service_team_can_read(NEW.tenant_id,NEW.organization_id,
     NEW.workspace_id,NEW.team_id,NEW.assigned_to) THEN
  RAISE EXCEPTION 'Assignee is not active in the routed team'
   USING ERRCODE='23514';
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
 IF NEW.team_id IS DISTINCT FROM OLD.team_id THEN
  -- Supervisor status never creates a FGA grant. The module, resource and
  -- actual membership gates were checked before this database transaction.
  IF NEW.team_id IS NULL OR NEW.state<>'open' OR
     NEW.stage_id IS DISTINCT FROM OLD.stage_id OR NEW.assigned_to IS NOT NULL OR
     NEW.result IS DISTINCT FROM OLD.result OR
     NEW.closed_at IS DISTINCT FROM OLD.closed_at OR
     length(btrim(coalesce(current_setting('syndes.service_transfer_reason',true),'')))
       NOT BETWEEN 4 AND 240 OR
     NOT service.service_team_is_supervisor(NEW.tenant_id,NEW.organization_id,
       NEW.workspace_id,actor) OR
     NOT service.service_team_can_read(OLD.tenant_id,OLD.organization_id,
       OLD.workspace_id,OLD.team_id,actor) OR
     NOT service.service_team_is_staffed(NEW.tenant_id,NEW.organization_id,
       NEW.workspace_id,NEW.team_id) THEN
   RAISE EXCEPTION 'Team transfer requires authorized source, staffed target and reason'
     USING ERRCODE='23514';
  END IF;
 ELSIF NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
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
  previous_stage_id,next_stage_id,previous_assignee,next_assignee,result,version,
  previous_team_id,next_team_id,transfer_reason)
 VALUES(NEW.tenant_id,NEW.organization_id,NEW.workspace_id,NEW.id,
  current_setting('syndes.service_actor_id'),
  CASE WHEN TG_OP='INSERT' THEN 'created'
   WHEN NEW.team_id IS DISTINCT FROM OLD.team_id THEN 'team_transferred'
   WHEN NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN 'stage_changed'
   WHEN NEW.state='closed' THEN 'closed' ELSE 'assigned' END,
  CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.stage_id END,NEW.stage_id,
  CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.assigned_to END,NEW.assigned_to,
  NEW.result,NEW.version,
  CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.team_id END,NEW.team_id,
  CASE WHEN TG_OP='INSERT' THEN NULL
    WHEN NEW.team_id IS DISTINCT FROM OLD.team_id THEN
      btrim(current_setting('syndes.service_transfer_reason',true))
    ELSE NULL END);
 RETURN NEW;
END $$;
