import {
 platformEventTypes,type ModuleAccessPort,type Actor,type TrustedTenantDatabaseProvider,type PlatformEventType,
} from "@syndes/core-kernel";
import type {EventWorkerAuthorization} from "./platform-event-dispatcher.js";
import {tenantUUID} from "./adapters.js";

const MODULE=/^[a-z][a-z0-9_]{0,62}$/;
const CONSUMER=/^[a-z][a-z0-9_.-]{1,95}$/;
const PRINCIPAL=/^[a-z][a-z0-9_.:-]{2,127}$/;

/** Supplied ONLY by the trusted host's actual OpenFGA service-identity port.
 * Deliberately no allow-all, JWT impersonation, or fallback to user permissions. */
export interface TrustedServiceEventGrant {
 canProcess(request:Readonly<{
  actor:Actor;tenantId:string;organizationId:string;workspaceId:string|null;
  moduleId:string;consumerId:string;eventType:PlatformEventType;
 }>):Promise<boolean>;
}

/** A read-only, tenant-pinned scope check. No caller-provided DSN or fallback
 * to the default organization/workspace; both must match the event envelope. */
export class PgEventWorkerScope {
 constructor(private readonly tenants:TrustedTenantDatabaseProvider){}
 async active(tenantId:string,organizationId:string,workspaceId:string|null):Promise<boolean>{
  if(!tenantUUID(tenantId)||!tenantUUID(organizationId)||
     (workspaceId!==null&&!tenantUUID(workspaceId)))return false;
  const db=await this.tenants.resolve(tenantId);
  if(db.tenantId!==tenantId)throw Error("Tenant-scoped worker database mismatch");
  const result=await db.query(`
   SELECT 1 FROM platform_organizations o
   WHERE o.tenant_id=$1::uuid AND o.id=$2::uuid AND o.status='active'
    AND ($3::uuid IS NULL OR EXISTS(
     SELECT 1 FROM platform_workspaces w
      WHERE w.tenant_id=o.tenant_id AND w.organization_id=o.id
       AND w.id=$3::uuid AND w.status='active'
    ))
   LIMIT 1
  `,[tenantId,organizationId,workspaceId]);
  return result.rows.length===1;
 }
}

export interface ActiveEventScope {
 active(tenantId:string,organizationId:string,workspaceId:string|null):Promise<boolean>;
}

/** No scheduler or startup side effects. Composition is deliberately blocked
 * without real Control module access + FGA grant + verified service principal. */
export class TenantEventWorkerAdmission implements EventWorkerAuthorization {
 constructor(
  private readonly moduleAccess:ModuleAccessPort,
  private readonly scope:ActiveEventScope,
  private readonly grant:TrustedServiceEventGrant,
  private readonly expectedPrincipalId:string,
 ){
  if(!PRINCIPAL.test(expectedPrincipalId)||!moduleAccess?.canExecuteModule||
     !scope?.active||!grant?.canProcess)
   throw Error("Trusted event worker admission dependencies missing");
 }
 async authorize(request:Parameters<EventWorkerAuthorization["authorize"]>[0]):
  Promise<"enabled"|"suspended"|"denied">{
  const {actor,tenantId,organizationId,workspaceId,consumerId,moduleId,eventType}=request;
  if(!actor||actor.kind!=="service"||actor.id!==this.expectedPrincipalId||
     !tenantUUID(tenantId)||!tenantUUID(organizationId)||
     (workspaceId!==null&&!tenantUUID(workspaceId))||
     !MODULE.test(moduleId)||!CONSUMER.test(consumerId)||
     !consumerId.startsWith(moduleId+".")||
     !platformEventTypes.includes(eventType)||
     (workspaceId===null&&[
       "whatsapp.message.received.v2","inbox.participant.observed.v1",
       "crm.person.resolved.v1","crm.person.review_required.v1",
     ].includes(eventType)))return "denied";
  try{
   // Control outages, incomplete release attestations and disabled modules
   // keep deliveries suspended/recoverable rather than bypassing entitlement.
   const enabled=await this.moduleAccess.canExecuteModule({actor,tenantId,moduleId});
   if(enabled!==true)return "suspended";
   // Scope must be resolved against the same trusted tenant database mapping,
   // after module admission and BEFORE contacting external FGA.
   if(await this.scope.active(tenantId,organizationId,workspaceId)!==true)
    return "denied";
   const allowed=await this.grant.canProcess({
    actor,tenantId,organizationId,workspaceId,moduleId,consumerId,eventType,
   });
   // Explicit FGA false means denied, never an implicit permission.
   return allowed===true?"enabled":"denied";
  }catch{
   // FGA/Control DB/tenant scope infrastructure outage preserves the event.
   return "suspended";
  }
 }
}
