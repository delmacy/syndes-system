/**
 * IAM-07D1 / candidate-only revoke-FIRST protocol.
 *
 * For revocations routed through THIS operator protocol, the tenant database
 * is the write-linearization point. A pending business transaction holds
 * the same fence row FOR SHARE until commit. Revocation updates that row
 * before recording a Control receipt or attempting remote revocation.
 *
 * Direct Keycloak/OpenFGA admin changes DO NOT participate in this lock:
 * no global distributed-transaction or production guarantee is claimed.
 * Not imported by the operational Core Host.
 */
import {
 AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TenantTransaction,type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";
import type {
 OrganizationContextAdmissionPilot,RequestedIamPilotContext,
 ResolvedIamPilotContext,
} from "./iam-organization-context-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type SpecificIam07dCapability=
 |"inbox.conversation.claim"
 |"inbox.conversation.transfer"
 |"service.funnel.operate";
const SPECIFIC=new Set<string>([
 "inbox.conversation.claim","inbox.conversation.transfer",
 "service.funnel.operate",
]);
const scope=(s:RequestedIamPilotContext)=>[
 s.tenantId,s.organizationId,s.workspaceId,s.capability,
];
const tuple=(s:Readonly<{tenantId:string;organizationId:string;
 workspaceId:string;principalId:string;capability:SpecificIam07dCapability}>)=>[
 s.tenantId,s.organizationId,s.workspaceId,s.principalId,s.capability,
];
const epochNumber=(value:unknown):number=>{
 const n=typeof value==="string"?Number(value):value;
 if(!Number.isSafeInteger(n)||Number(n)<1)throw new AccessDeniedError();
 return Number(n);
};
function valid(cap:unknown):cap is SpecificIam07dCapability{
 return typeof cap==="string"&&SPECIFIC.has(cap);
}
export type Iam07dTicket=Readonly<{
 actor:ResolvedIamPilotContext["actor"];
 tenantId:string;organizationId:string;workspaceId:string;
 capability:SpecificIam07dCapability;
 epoch:number;
}>;
export type Iam07dRevocation=Readonly<{
 operationId:string;
 tenantId:string;organizationId:string;workspaceId:string;
 principalId:string;capability:SpecificIam07dCapability;
 expectedEpoch:number;
}>;
type ControlStore=Readonly<{
 query(sql:string,values:unknown[]):Promise<{rows:Record<string,unknown>[];rowCount:number|null}>;
}>;
export type SpecificIam07dPolicy=Readonly<{
 /** Exactly named action; no alias to legacy inbox:assignment/write. */
 canPerform(context:ResolvedIamPilotContext,capability:SpecificIam07dCapability):Promise<boolean>;
}>;

/**
 * The class is operator/CI composition only. The caller MUST use a
 * verified JWT admission, a separately defined exact-capability policy,
 * and one pinned transaction provider that rolls back on thrown errors.
 */
export class Iam07dRevokeFirstPilot{
 private readonly issued=new WeakSet<object>();
 private readonly verifiedContexts=new WeakMap<object,ResolvedIamPilotContext>();
 constructor(private readonly admission:Pick<OrganizationContextAdmissionPilot,"resolve">,
   private readonly specific:SpecificIam07dPolicy,
   private readonly tenants:TrustedTenantTransactionProvider,
   private readonly control:ControlStore){
  if(typeof admission?.resolve!=="function"||typeof specific?.canPerform!=="function"||
     typeof tenants?.withTransaction!=="function"||
     typeof tenants?.resolve!=="function"||typeof control?.query!=="function")
   throw new TypeError("IAM07D invalid trusted dependencies");
 }
 async issue(bearer:string,requested:RequestedIamPilotContext):Promise<Iam07dTicket>{
  try{
   if(!requested||!valid(requested.capability)||
      ![requested.tenantId,requested.organizationId,requested.workspaceId]
       .every(x=>typeof x==="string"&&UUID.test(x))||
      (requested.capability==="service.funnel.operate")!==UUID.test(requested.funnelId??"")||
      typeof bearer!=="string"||!bearer.startsWith("Bearer "))
    throw new AccessDeniedError();
   const context=await this.admission.resolve(bearer,requested);
   if(context.actor.kind!=="user"||!UUID.test(context.actor.id)||
      context.tenantId!==requested.tenantId||
      context.organizationId!==requested.organizationId||
      context.workspaceId!==requested.workspaceId||
      context.capability!==requested.capability||
      context.moduleId!==(requested.capability==="service.funnel.operate"?"service":"inbox")||
      context.scopeWriteAllowed!==true)
    throw new AccessDeniedError();
   // Missing exact fine-grained policy => DENY; never borrow coarse FGA.
   if(await this.specific.canPerform(context,requested.capability)!==true)
    throw new AccessDeniedError();
   const db=await this.tenants.resolve(context.tenantId);
   if(db.tenantId!==context.tenantId)throw new AccessDeniedError();
   const result=await db.query(
    "SELECT epoch::text,state FROM platform_iam_capability_fences "+
    "WHERE tenant_id=$1::uuid AND organization_id=$2::uuid AND "+
    "workspace_id=$3::uuid AND principal_id=$4 AND capability=$5",
    [context.tenantId,context.organizationId,context.workspaceId,
      context.actor.id,requested.capability]);
   if(result.rows.length!==1||result.rows[0].state!=="active")
    throw new AccessDeniedError();
   const ticket=Object.freeze({
    actor:Object.freeze({...context.actor}),
    tenantId:context.tenantId,organizationId:context.organizationId,
    workspaceId:context.workspaceId,capability:requested.capability,
    epoch:epochNumber(result.rows[0].epoch),
   });
   this.issued.add(ticket);
   this.verifiedContexts.set(ticket,Object.freeze({...context}));
   return ticket;
  }catch{throw new AccessDeniedError();}
 }
 /** Business effect AND audit must run entirely inside the pinned transaction.
  * No nested pool query, network call, or second transaction in the callback.
  */
 async execute<T>(ticket:Iam07dTicket,
   effect:(tx:TenantTransaction,ticket:Iam07dTicket)=>Promise<T>):Promise<T>{
  if(!ticket||!this.issued.has(ticket)||typeof effect!=="function")
   throw new AccessDeniedError();
  try{
   const context=this.verifiedContexts.get(ticket);
   if(!context||context.actor.id!==ticket.actor.id||
      context.capability!==ticket.capability||
      await this.specific.canPerform(context,ticket.capability)!==true)
    throw new AccessDeniedError();
   return await this.tenants.withTransaction(ticket.tenantId,async tx=>{
    if(tx.tenantId!==ticket.tenantId||
       tx[PINNED_TENANT_TRANSACTION]!==true)
     throw new AccessDeniedError();
    const allowed=await tx.query(`
      SELECT f.epoch::text AS epoch
      FROM platform_iam_capability_fences f
      JOIN platform_workspaces w
       ON w.tenant_id=f.tenant_id AND w.organization_id=f.organization_id
        AND w.id=f.workspace_id AND w.status='active'
      JOIN platform_organizations o
       ON o.tenant_id=f.tenant_id AND o.id=f.organization_id
        AND o.status='active'
      JOIN platform_org_memberships om
       ON om.tenant_id=f.tenant_id AND om.organization_id=f.organization_id
        AND om.principal_id=f.principal_id AND om.state='active'
        AND om.role IN ('admin','editor')
      JOIN platform_workspace_memberships wm
       ON wm.tenant_id=f.tenant_id AND wm.organization_id=f.organization_id
        AND wm.workspace_id=f.workspace_id AND wm.principal_id=f.principal_id
        AND wm.state='active' AND wm.role IN ('admin','editor')
      WHERE f.tenant_id=$1::uuid AND f.organization_id=$2::uuid
       AND f.workspace_id=$3::uuid AND f.principal_id=$4
       AND f.capability=$5 AND f.state='active'
      FOR SHARE OF f,w,o,om,wm
     `,[ticket.tenantId,ticket.organizationId,ticket.workspaceId,
      ticket.actor.id,ticket.capability]);
    if(allowed.rows.length!==1||
       epochNumber(allowed.rows[0].epoch)!==ticket.epoch)
     throw new AccessDeniedError();
    return effect(tx,ticket);
   });
  }catch{throw new AccessDeniedError();}
 }
 /** Trusted operator revocation. Tenant deny commits FIRST and is durable
  * even when the subsequent Control receipt fails. Retry SAME operation ID
  * to reconcile without bumping epoch or opening privileges.
  */
 async revoke(command:Iam07dRevocation):Promise<number>{
  try{
   if(!command||!valid(command.capability)||
      !UUID.test(command.operationId??"")||
      ![command.tenantId,command.organizationId,command.workspaceId,
        command.principalId].every(x=>typeof x==="string"&&UUID.test(x))||
      !Number.isSafeInteger(command.expectedEpoch)||command.expectedEpoch<1)
    throw new AccessDeniedError();
   const n=command.expectedEpoch+1;
   if(!Number.isSafeInteger(n))throw new AccessDeniedError();
   const values=tuple(command);
   const current=await this.tenants.withTransaction(command.tenantId,async tx=>{
    if(tx.tenantId!==command.tenantId||
       tx[PINNED_TENANT_TRANSACTION]!==true)
     throw new AccessDeniedError();
    const changed=await tx.query(`
      UPDATE platform_iam_capability_fences
        SET state='revoked',epoch=epoch+1,
            last_revoke_operation_id=$6::uuid,changed_at=clock_timestamp()
      WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
       AND workspace_id=$3::uuid AND principal_id=$4
       AND capability=$5 AND epoch=$7::bigint AND state='active'
      RETURNING epoch::text AS epoch`,
      [...values,command.operationId,command.expectedEpoch]);
    if(changed.rows.length===1)return epochNumber(changed.rows[0].epoch);
    const prior=await tx.query(`
      SELECT epoch::text AS epoch,state,last_revoke_operation_id::text AS op
      FROM platform_iam_capability_fences WHERE tenant_id=$1::uuid
       AND organization_id=$2::uuid AND workspace_id=$3::uuid
       AND principal_id=$4 AND capability=$5 FOR UPDATE`,values);
    if(prior.rows.length!==1||
       epochNumber(prior.rows[0].epoch)!==n||
       prior.rows[0].state!=="revoked"||
       prior.rows[0].op!==command.operationId)
     throw new AccessDeniedError();
    return n;
   });
   if(current!==n)throw new AccessDeniedError();
   const saved=await this.control.query(`
     INSERT INTO public.platform_iam07d_revocation_receipts
      (operation_id,tenant_id,organization_id,workspace_id,principal_id,
       capability,tenant_revoked_epoch)
     VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7::bigint)
     ON CONFLICT (operation_id) DO NOTHING RETURNING operation_id`,
     [command.operationId,...values,n]);
   if(saved.rows.length>1)throw new AccessDeniedError();
   const verify=await this.control.query(`
     SELECT tenant_id::text,organization_id::text,workspace_id::text,
      principal_id,capability,tenant_revoked_epoch::text AS epoch,
      state FROM public.platform_iam07d_revocation_receipts
     WHERE operation_id=$1::uuid`,[command.operationId]);
   if(verify.rows.length!==1||verify.rows[0].tenant_id!==command.tenantId||
      verify.rows[0].organization_id!==command.organizationId||
      verify.rows[0].workspace_id!==command.workspaceId||
      verify.rows[0].principal_id!==command.principalId||
      verify.rows[0].capability!==command.capability||
      epochNumber(verify.rows[0].epoch)!==n||
      verify.rows[0].state!=="revoked")throw new AccessDeniedError();
   return n;
  }catch{throw new AccessDeniedError();}
 }
}
