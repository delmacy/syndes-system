-- Pre-alpha greenfield fixture for NEW isolated staging tenant ONLY.
-- Never execute against existing operational/WhatsApp tenant.
DO $preflight$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_tables WHERE schemaname='service' AND tablename='service_funnels')
 OR EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public'
  AND indexname IN ('platform_legacy_single_organization','platform_legacy_single_workspace'))
 OR EXISTS(SELECT 1 FROM platform_organizations)
 OR EXISTS(SELECT 1 FROM platform_workspaces)
 OR EXISTS(SELECT 1 FROM whatsapp_accounts)
 OR EXISTS(SELECT 1 FROM inbox_conversations) THEN
  RAISE EXCEPTION 'Greenfield pilot requires empty owner-scoped schema without SQL002'
   USING ERRCODE='55000';
 END IF;
END $preflight$;

INSERT INTO platform_organizations(tenant_id,id,display_name,is_default)
VALUES
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1','Piloto Organização A',true),
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2','Piloto Organização B',false);

INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default)
VALUES
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001','a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1','Atendimento A1','atendimento-a1',true),
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','cae8c1e2-4a1d-4b69-9e02-0dd15b0d1002','a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1','Atendimento A2','atendimento-a2',false),
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2001','b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2','Atendimento B1','atendimento-b1',true),
('1f5a8ce9-3f01-48cc-a013-2198d99e7510','cbe8c1e2-4a1d-4b69-9e02-0dd15b0d2002','b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2','Atendimento B2','atendimento-b2',false);

INSERT INTO platform_org_audit(tenant_id,organization_id,actor_id,event,entity_id)
SELECT tenant_id,id,'system:greenfield-installer','organization_created',id
FROM platform_organizations;

INSERT INTO platform_org_audit(tenant_id,organization_id,actor_id,event,entity_id)
SELECT tenant_id,organization_id,'system:greenfield-installer','workspace_created',id
FROM platform_workspaces;

-- Two published, two-stage funnels per workspace; scope keys always explicit.
INSERT INTO service.service_funnels(tenant_id,organization_id,workspace_id,id,code,name,created_by)
SELECT w.tenant_id,w.organization_id,w.id,
 pg_catalog.gen_random_uuid(),v.code,v.label,'system:greenfield-installer'
FROM platform_workspaces w CROSS JOIN
 (VALUES('vendas','Funil de vendas'),('suporte','Funil de suporte')) AS v(code,label);

INSERT INTO service.service_funnel_stages(
 tenant_id,organization_id,workspace_id,funnel_id,id,code,label,position,terminal)
SELECT f.tenant_id,f.organization_id,f.workspace_id,f.id,
 pg_catalog.gen_random_uuid(),'entrada','Entrada',1,false
FROM service.service_funnels f;
INSERT INTO service.service_funnel_stages(
 tenant_id,organization_id,workspace_id,funnel_id,id,code,label,position,terminal)
SELECT f.tenant_id,f.organization_id,f.workspace_id,f.id,
 pg_catalog.gen_random_uuid(),'finalizado','Finalizado',2,true
FROM service.service_funnels f;

UPDATE service.service_funnels SET state='published',published_at=clock_timestamp()
WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510';

DO $verify$
DECLARE n_org int;n_ws int;n_funnel int;n_stages int;
BEGIN
 SELECT count(*) INTO n_org FROM platform_organizations;
 SELECT count(*) INTO n_ws FROM platform_workspaces;
 SELECT count(*) INTO n_funnel FROM service.service_funnels;
 SELECT count(*) INTO n_stages FROM service.service_funnel_stages;
 IF n_org<>2 OR n_ws<>4 OR n_funnel<>8 OR n_stages<>16
  OR EXISTS(SELECT 1 FROM service.service_funnels WHERE state<>'published')
  OR EXISTS(SELECT 1 FROM
   (SELECT organization_id,workspace_id,count(*) AS n FROM service.service_funnels
    GROUP BY organization_id,workspace_id) x WHERE x.n<>2)
  OR EXISTS(SELECT 1 FROM service.service_funnels WHERE id::text !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  OR EXISTS(SELECT 1 FROM service.service_funnel_stages WHERE id::text !~
    '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
  OR EXISTS(SELECT 1 FROM whatsapp_accounts)
  OR EXISTS(SELECT 1 FROM inbox_conversations) THEN
  RAISE EXCEPTION 'Greenfield pilot scope/funnel inventory incorrect' USING ERRCODE='55000';
 END IF;
 -- This must be rejected by composite Organization+Workspace ownership FK.
 BEGIN
  INSERT INTO service.service_funnels(
   tenant_id,organization_id,workspace_id,id,code,name,created_by)
  VALUES('1f5a8ce9-3f01-48cc-a013-2198d99e7510',
   'b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2',
   'cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001',
   'd0000000-0000-4000-8000-000000000001',
   'invalido','Vazamento de escopo','system:greenfield-installer');
  RAISE EXCEPTION 'Scope FK did not reject cross-organization funnel'
   USING ERRCODE='55000';
 EXCEPTION WHEN foreign_key_violation THEN NULL;
 END;
END $verify$;
