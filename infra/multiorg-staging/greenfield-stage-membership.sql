-- Stage-only new synthetic tenant: physically grant only the identities that
-- are verified in real Keycloak Org membership. No WhatsApp, no existing tenant.
\set ON_ERROR_STOP on
BEGIN;
SELECT CASE WHEN
 (SELECT count(*) FROM platform_organizations)=2 AND
 (SELECT count(*) FROM platform_workspaces)=4 AND
 (SELECT count(*) FROM service.service_funnels WHERE state='published')=8 AND
 (SELECT count(*) FROM platform_org_memberships)=0 AND
 (SELECT count(*) FROM platform_workspace_memberships)=0 AND
 (SELECT count(*) FROM whatsapp_accounts)=0 AND
 (SELECT count(*) FROM inbox_conversations)=0
 THEN 1 ELSE 1/0 END AS preflight;
INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role,state)
VALUES
 ('1f5a8ce9-3f01-48cc-a013-2198d99e7510',
  'a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1',:'founder','admin','active'),
 ('1f5a8ce9-3f01-48cc-a013-2198d99e7510',
  'b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2',:'founder','admin','active'),
 ('1f5a8ce9-3f01-48cc-a013-2198d99e7510',
  'b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2',:'restricted','viewer','active');
INSERT INTO platform_workspace_memberships(
 tenant_id,organization_id,workspace_id,principal_id,role,state)
SELECT w.tenant_id,w.organization_id,w.id,:'founder','admin','active'
 FROM platform_workspaces w
 WHERE w.tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510';
INSERT INTO platform_workspace_memberships(
 tenant_id,organization_id,workspace_id,principal_id,role,state)
SELECT w.tenant_id,w.organization_id,w.id,:'restricted','viewer','active'
 FROM platform_workspaces w
 WHERE w.tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510'
  AND w.organization_id='b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2';
SELECT CASE WHEN
 (SELECT count(*) FROM platform_org_memberships)=3 AND
 (SELECT count(*) FROM platform_workspace_memberships)=6 AND
 (SELECT count(*) FROM platform_org_memberships WHERE
  principal_id=:'restricted' AND organization_id=
  'a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1')=0 AND
 (SELECT count(*) FROM platform_workspace_memberships WHERE
  principal_id=:'restricted' AND organization_id=
  'a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1')=0
 THEN 1 ELSE 1/0 END AS verification;
COMMIT;
