-- Disposable PG17 integration: first founder -> provisioned -> Keycloak link -> READY.
-- External Keycloak Org verification is a separate trusted integration; this is
-- a real SQL proof of the previously circular activation dependency.
\set tenant 8eab450f-14e5-4b2c-9e8b-000000000101
\set org 9eab450f-14e5-4b2c-9e8b-000000000201
\set workspace aeab450f-14e5-4b2c-9e8b-000000000301
\set founder beab450f-14e5-4b2c-9e8b-000000000401
\set request ceab450f-14e5-4b2c-9e8b-000000000501
\set kc deab450f-14e5-4b2c-9e8b-000000000601
\set realm syndes_signup_ci
INSERT INTO public.tenant_registry(tenant_id,database_name,role_name,state)
VALUES(:'tenant'::uuid,'syndes_tenant_8eab450f14e54b2c9e8b000000000101',
 'syndes_t_8eab450f14e54b2c9e8b000000000101','provisioned');
INSERT INTO public.tenant_memberships(tenant_id,principal_id,state)
VALUES(:'tenant'::uuid,:'founder','active');
INSERT INTO public.platform_signup_intents(
 request_id,founder_id,tenant_id,organization_id,workspace_id,
 account_name,organization_name,workspace_name,keycloak_alias)
VALUES(:'request'::uuid,:'founder'::uuid,:'tenant'::uuid,:'org'::uuid,:'workspace'::uuid,
 'Disposable test account','First organization','First workspace',
 'syndes-8eab450f14e54b2c9e8b000000000101-ceab450f14e54b2c9e8b000000000501');
INSERT INTO public.platform_signup_intent_audit(request_id,revision,event)
VALUES(:'request'::uuid,1,'reserved');
-- Generic IAM links MUST still reject a PROVISIONED tenant.
DO $negative$ BEGIN
 BEGIN
  PERFORM public.transition_platform_keycloak_org_link(
    '8eab450f-14e5-4b2c-9e8b-000000000101',
    '9eab450f-14e5-4b2c-9e8b-000000000201','syndes_signup_ci',
    'deab450f-14e5-4b2c-9e8b-000000000601','active',0,
    'ceab450f-14e5-4b2c-9e8b-000000000501','ci','reject before activation');
  RAISE EXCEPTION 'Generic IAM accepted PROVISIONED tenant' USING ERRCODE='P0001';
 EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
 END;
 -- A request with a wrong founder or absent enrollment cannot bind identity.
 BEGIN
  PERFORM public.platform_signup_bind_initial_keycloak_org(
    'ceab450f-14e5-4b2c-9e8b-000000000501','syndes_signup_ci',
    'deab450f-14e5-4b2c-9e8b-000000000601',
    'beab450f-14e5-4b2c-9e8b-000000000402');
  RAISE EXCEPTION 'Wrong founder accepted' USING ERRCODE='P0001';
 EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
 END;
END $negative$;
DO $deny$ BEGIN
 IF pg_catalog.has_function_privilege(
   'syndes_core','public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)','EXECUTE')
 OR pg_catalog.has_function_privilege(
   'syndes_signup_operator','public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)','EXECUTE')
 OR pg_catalog.has_table_privilege(
   'syndes_signup_link_operator','public.platform_keycloak_org_links','INSERT')
 OR NOT pg_catalog.has_function_privilege(
   'syndes_signup_link_operator','public.platform_signup_bind_initial_keycloak_org(uuid,text,uuid,uuid)','EXECUTE')
 THEN RAISE EXCEPTION 'Initial link function privileges are wrong' USING ERRCODE='P0001'; END IF;
END $deny$;
-- The caller only has EXECUTE on the trusted SECURITY DEFINER, not table WRITE.
SET ROLE syndes_signup_link_operator;
SELECT public.platform_signup_bind_initial_keycloak_org(
 :'request'::uuid,:'realm',:'kc'::uuid,:'founder'::uuid);
SELECT public.platform_signup_bind_initial_keycloak_org(
 :'request'::uuid,:'realm',:'kc'::uuid,:'founder'::uuid);
RESET ROLE;
DO $verify$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.tenant_registry
    WHERE tenant_id='8eab450f-14e5-4b2c-9e8b-000000000101' AND state='provisioned')
 OR (SELECT count(*) FROM public.platform_keycloak_org_links)!=1
 OR (SELECT count(*) FROM public.platform_keycloak_org_link_audit)!=1
 THEN RAISE EXCEPTION 'Initial link did not preserve PROVISIONED and unique audit'
   USING ERRCODE='P0001'; END IF;
 BEGIN
  PERFORM public.platform_signup_bind_initial_keycloak_org(
    'ceab450f-14e5-4b2c-9e8b-000000000501','syndes_signup_ci',
    'deab450f-14e5-4b2c-9e8b-000000000602',
    'beab450f-14e5-4b2c-9e8b-000000000401');
  RAISE EXCEPTION 'Wrong KC Org replay accepted' USING ERRCODE='P0001';
 EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
 END;
END $verify$;
-- Trusted external saga verifies live Keycloak membership and tenant ownership
-- BEFORE invoking this finalizer. No bootstrap bypass in the SQL itself.
SET ROLE syndes_signup_finalize_operator;
SELECT public.platform_signup_finalize(:'request'::uuid,:'founder'::uuid,:'kc'::uuid);
SELECT public.platform_signup_finalize(:'request'::uuid,:'founder'::uuid,:'kc'::uuid);
RESET ROLE;
-- After READY the dedicated initial operator is closed; only the
-- finalized state read can be retried. No post-READY link rewrite or new grant.
SET ROLE syndes_signup_link_operator;
DO $deny_ready$ BEGIN
 BEGIN
  PERFORM public.platform_signup_bind_initial_keycloak_org(
    'ceab450f-14e5-4b2c-9e8b-000000000501','syndes_signup_ci',
    'deab450f-14e5-4b2c-9e8b-000000000601',
    'beab450f-14e5-4b2c-9e8b-000000000401');
  RAISE EXCEPTION 'Signup link reopened after READY' USING ERRCODE='P0001';
 EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
 END;
END $deny_ready$;
RESET ROLE;
DO $completed$ BEGIN
 IF (SELECT state FROM public.tenant_registry
     WHERE tenant_id='8eab450f-14e5-4b2c-9e8b-000000000101')<>'active'
 OR (SELECT state FROM public.platform_signup_intents
     WHERE request_id='ceab450f-14e5-4b2c-9e8b-000000000501')<>'ready'
 OR (SELECT count(*) FROM public.platform_keycloak_org_link_audit)!=1
 OR (SELECT count(*) FROM public.platform_signup_intent_audit)!=2
 THEN RAISE EXCEPTION 'First tenant READY did not commit exactly once'
    USING ERRCODE='P0001';END IF;
END $completed$;
