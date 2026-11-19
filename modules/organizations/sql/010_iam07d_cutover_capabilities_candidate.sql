-- IAM07D cutover-compatible CAPABILITY expansion; OPERATOR/CI ONLY.
-- Applies to an installed 008 (single-context), an installed 009
-- (post-cutover), or a 008 installation retained across the cutover.
-- NEVER removes SQL002, creates an ACTIVE fence, grants FGA or runs on
-- plugin bootstrap. Run with psql -v ON_ERROR_STOP=1 --single-transaction.
DO $preflight$
DECLARE barrier_count integer;
BEGIN
 IF to_regclass('platform_iam_capability_fences') IS NULL
 OR to_regclass('platform_iam_fga_grant_targets') IS NULL
 OR to_regclass('platform_iam_revocation_outbox') IS NULL
 OR to_regclass('platform_organizations') IS NULL
 OR to_regclass('platform_workspaces') IS NULL
 OR to_regclass('platform_org_memberships') IS NULL
 OR to_regclass('platform_workspace_memberships') IS NULL THEN
   RAISE EXCEPTION 'IAM07D 010 requires installed scoped fence/outbox and ownership'
    USING ERRCODE='55000';
 END IF;
 SELECT count(*) INTO barrier_count FROM pg_indexes
 WHERE schemaname=current_schema()
 AND indexname IN ('platform_legacy_single_organization',
                   'platform_legacy_single_workspace');
 IF barrier_count NOT IN (0,2) THEN
   RAISE EXCEPTION 'IAM07D 010 refuses half-complete SQL002 cutover'
    USING ERRCODE='55000';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='platform_iam_capability_fences'::regclass AND contype='f'
  AND confrelid='platform_workspace_memberships'::regclass)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='platform_iam_fga_grant_targets'::regclass AND contype='f'
  AND confrelid='platform_iam_capability_fences'::regclass)
 OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='platform_iam_revocation_outbox'::regclass AND contype='f'
  AND confrelid='platform_iam_capability_fences'::regclass) THEN
   RAISE EXCEPTION 'IAM07D 010 requires existing scoped composite foreign keys'
    USING ERRCODE='55000';
 END IF;
 IF barrier_count=0 AND (
  NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
   conrelid='platform_workspace_memberships'::regclass AND contype='f'
   AND confrelid='platform_workspaces'::regclass)
  OR NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
   conrelid='platform_workspace_memberships'::regclass AND contype='f'
   AND confrelid='platform_org_memberships'::regclass)
 ) THEN
  RAISE EXCEPTION 'IAM07D 010 multi-org requires Organization/Workspace ownership FKs'
   USING ERRCODE='55000';
 END IF;
END $preflight$;

-- Add the new restrictive constraint FIRST. Existing active/revoked
-- rows remain valid. Old 008/009 constraint removed ONLY after validation.
DO $constraint$
BEGIN
 IF NOT EXISTS(
   SELECT 1 FROM pg_constraint WHERE
    conrelid='platform_iam_capability_fences'::regclass AND
    conname='platform_iam_capability_fences_capability_v2_check'
 ) THEN
  ALTER TABLE platform_iam_capability_fences
    ADD CONSTRAINT platform_iam_capability_fences_capability_v2_check
    CHECK (capability IN (
    'inbox.conversation.claim',
    'inbox.conversation.transfer',
    'inbox.conversation.create',
    'inbox.conversation.assign',
    'inbox.conversation.status',
    'inbox.conversation.handoff',
    'inbox.conversation.favorite',
    'inbox.conversation.mark_read',
    'inbox.conversation.link_contact',
    'inbox.message.reply',
    'inbox.message.note',
    'inbox.conversation.history_sync',
    'inbox.message.simulate',
    'service.funnel.operate',
    'service.funnel.publish',
    'service.attendance.open',
    'service.attendance.assign',
    'service.attendance.team_transfer',
    'service.attendance.close'
    )) NOT VALID;
 END IF;
END $constraint$;

ALTER TABLE platform_iam_capability_fences
 VALIDATE CONSTRAINT platform_iam_capability_fences_capability_v2_check;
ALTER TABLE platform_iam_capability_fences
 DROP CONSTRAINT IF EXISTS platform_iam_capability_fences_capability_check;

-- A replay verifies both key catalogs still share their restrictive FK.
-- An absent capability row is a DENY, including every newly introduced
-- capability. This script never seeds, grants or reactivates any row.
DO $verify$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE
  conrelid='platform_iam_capability_fences'::regclass
  AND conname='platform_iam_capability_fences_capability_v2_check'
  AND convalidated) THEN
   RAISE EXCEPTION 'IAM07D 010 capability constraint not validated'
    USING ERRCODE='55000';
 END IF;
END $verify$;
