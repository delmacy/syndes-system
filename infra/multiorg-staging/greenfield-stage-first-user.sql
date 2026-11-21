-- CI-only stage: bind REAL Keycloak signed founder, finalize fresh tenant, link Org B.
-- Authorized stage operator has independently verified live Keycloak membership
-- and exact, per-resource FGA tuples before calling this transaction.
-- No operational tenant, WhatsApp account, event/outbox or production schema.
\set ON_ERROR_STOP on
BEGIN;
SELECT CASE WHEN
 (SELECT count(*) FROM public.tenant_registry WHERE
   tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510' AND state='provisioned')=1
 AND (SELECT count(*) FROM public.platform_signup_intents
   WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510')=0
 AND (SELECT count(*) FROM public.tenant_memberships
   WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510')=0
 AND (SELECT count(*) FROM public.platform_keycloak_org_links
   WHERE tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510')=0
 THEN true ELSE false END AS preflight \gset
\if :preflight
\else
  SELECT 1/0;
\endif
INSERT INTO public.tenant_memberships(tenant_id,principal_id,state)
VALUES('1f5a8ce9-3f01-48cc-a013-2198d99e7510',:'founder','active');

INSERT INTO public.platform_signup_intents(
 request_id,founder_id,tenant_id,organization_id,workspace_id,
 account_name,organization_name,workspace_name,keycloak_alias)
VALUES(
 'e5f2aafc-16d8-48ac-a7f1-392701b10001',:'founder'::uuid,
 '1f5a8ce9-3f01-48cc-a013-2198d99e7510',
 'a3f80cc7-4c61-4f8e-8c39-d848dfbe10a1',
 'cae8c1e2-4a1d-4b69-9e02-0dd15b0d1001',
 'Piloto Greenfield','Piloto Organização A','Atendimento A1',
 'syndes-1f5a8ce93f0148cca0132198d99e7510-e5f2aafc16d848aca7f1392701b10001');
INSERT INTO public.platform_signup_intent_audit(request_id,revision,event)
VALUES('e5f2aafc-16d8-48ac-a7f1-392701b10001',1,'reserved');

SET ROLE syndes_signup_link_operator;
SELECT public.platform_signup_bind_initial_keycloak_org(
 'e5f2aafc-16d8-48ac-a7f1-392701b10001',
 'syndes-pilot',:'kc_a'::uuid,:'founder'::uuid
);
RESET ROLE;
SET ROLE syndes_signup_finalize_operator;
SELECT public.platform_signup_finalize(
 'e5f2aafc-16d8-48ac-a7f1-392701b10001',
 :'founder'::uuid,:'kc_a'::uuid
);
RESET ROLE;
SET ROLE syndes_iam_link_operator;
SELECT public.transition_platform_keycloak_org_link(
 '1f5a8ce9-3f01-48cc-a013-2198d99e7510',
 'b4f80cc7-4c61-4f8e-8c39-d848dfbe10b2',
 'syndes-pilot',:'kc_b'::uuid,'active',0,
 'e5f2aafc-16d8-48ac-a7f1-392701b10002',
 'system:stage-pilot', 'Real second Organization on fresh stage tenant'
);
RESET ROLE;
INSERT INTO public.tenant_memberships(tenant_id,principal_id,state)
VALUES('1f5a8ce9-3f01-48cc-a013-2198d99e7510',:'restricted','active');
SELECT CASE WHEN
 (SELECT count(*) FROM public.tenant_registry WHERE
  tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510' AND state='active')=1
 AND (SELECT count(*) FROM public.platform_signup_intents WHERE
  tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510'
  AND state='ready' AND keycloak_organization_id=:'kc_a'::uuid)=1
 AND (SELECT count(*) FROM public.platform_keycloak_org_links WHERE
  tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510'
  AND state='active')=2
 AND (SELECT count(*) FROM public.platform_keycloak_org_link_audit WHERE
  tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510')=2
 AND (SELECT count(*) FROM public.tenant_memberships WHERE
  tenant_id='1f5a8ce9-3f01-48cc-a013-2198d99e7510'
  AND state='active')=2
 THEN true ELSE false END AS verification \gset
\if :verification
\else
  SELECT 1/0;
\endif
COMMIT;
