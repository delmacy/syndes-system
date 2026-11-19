/** Operator-only initial signup link; runtime IAM reader intentionally filters
 * PROVISIONED tenants. Reuse normal Keycloak Organizations for credentials,
 * but this isolated Control function binds the first Org before activation.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import type {Pool} from "pg";
import type {SignupReservation} from "./signup-control-intents.js";
import type {FirstTenantLinkPort} from "./signup-first-tenant-saga.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REALM=/^[a-z][a-z0-9_-]{1,80}$/;
export class PgFirstTenantSignupKeycloakLink implements FirstTenantLinkPort{
 constructor(private readonly control:Pick<Pool,"query">,
  private readonly realm:string){
  if(!REALM.test(realm))throw new AccessDeniedError();
 }
 async ensure(intent:SignupReservation,kcId:string):Promise<void>{
  if(!UUID.test(intent?.requestId)||!UUID.test(intent?.tenantId)||
     !UUID.test(intent?.organizationId)||!UUID.test(intent?.founderId)||
     !UUID.test(kcId))throw new AccessDeniedError();
  const r=await this.control.query(`
   SELECT public.platform_signup_bind_initial_keycloak_org(
     $1::uuid,$2,$3::uuid,$4::uuid) AS revision
  `,[intent.requestId,this.realm,kcId,intent.founderId]);
  if(r.rows.length!==1||Number(r.rows[0].revision)!==1)
   throw new AccessDeniedError();
  if(!await this.verify(intent,kcId))throw new AccessDeniedError();
 }
 async verify(intent:SignupReservation,kcId:string):Promise<boolean>{
  if(!UUID.test(intent?.requestId)||!UUID.test(intent?.tenantId)||
     !UUID.test(intent?.organizationId)||!UUID.test(kcId))
   throw new AccessDeniedError();
  // Deliberately independent of the runtime PgOrganizationIdentityLinks
  // reader, which requires tenant.state=active and cannot inspect a pending
  // signup. The operator verifies the reverse unique link and CAS revision.
  const r=await this.control.query(`
    SELECT l.keycloak_organization_id::text AS id
    FROM public.platform_keycloak_org_links l
    JOIN public.platform_signup_intents i
      ON i.tenant_id=l.tenant_id AND i.organization_id=l.organization_id
    JOIN public.tenant_registry t ON t.tenant_id=i.tenant_id
    WHERE i.request_id=$1::uuid AND i.founder_id=$2::uuid
      AND i.tenant_id=$3::uuid AND i.organization_id=$4::uuid
      AND i.state IN ('reserved','reconcile_required','ready')
      AND t.state IN ('provisioned','active')
      AND l.realm=$5 AND l.keycloak_organization_id=$6::uuid
      AND l.state='active' AND l.revision=1
      AND EXISTS(SELECT 1 FROM public.platform_keycloak_org_link_audit a
        WHERE a.request_id=i.request_id AND a.tenant_id=l.tenant_id
        AND a.organization_id=l.organization_id
        AND a.keycloak_organization_id=l.keycloak_organization_id
        AND a.operation='provisioned' AND a.result_state='active'
        AND a.result_revision=1)
    LIMIT 2
  `,[intent.requestId,intent.founderId,intent.tenantId,
      intent.organizationId,this.realm,kcId]);
  return r.rows.length===1&&r.rows[0].id===kcId;
 }
}
