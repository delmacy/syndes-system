/**
 * IAM07D4 candidate-only adapter for the EXISTING ServiceFunnelService
 * stage transition. The business engine SQL and audit trigger stay in
 * Service Management, while IAM holds a per-user exact funnel capability
 * epoch lock until the SAME tenant transaction commits.
 * Not mounted by main.ts or registered on any operational controller.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import type {RequestedIamPilotContext} from "./iam-organization-context-pilot.js";
import type {Iam07dRevokeFirstPilot} from "./iam07d-revoke-first-pilot.js";
import type {ServiceFunnelService,FunnelContext} from "@syndes/service";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export class Iam07dServiceFunnelBusinessPilot{
 constructor(private readonly iam:Pick<Iam07dRevokeFirstPilot,"issue"|"execute">,
  private readonly service:Pick<ServiceFunnelService,"advancePinned">){
  if(typeof iam?.issue!=="function"||typeof iam?.execute!=="function"||
     typeof service?.advancePinned!=="function")
   throw new TypeError("Trusted IAM07D4 dependencies required");
 }
 async advance(bearer:string,requested:RequestedIamPilotContext,
  input:Readonly<{attendanceId:string;nextStageId:string;expectedVersion:number}>){
  if(!requested||requested.capability!=="service.funnel.operate"||
     typeof requested.funnelId!=="string"||!UUID.test(requested.funnelId)||
     !input||!UUID.test(input.attendanceId??"")||
     !UUID.test(input.nextStageId??"")||
     !Number.isSafeInteger(input.expectedVersion)||input.expectedVersion<1)
   throw new AccessDeniedError();
  const ticket=await this.iam.issue(bearer,requested);
  if(ticket.capability!=="service.funnel.operate")
   throw new AccessDeniedError();
  return this.iam.execute(ticket,async tx=>{
   // Scope the attendance by the SAME funnelId proven by real ownership
   // and exact OpenFGA fine resource; a different funnel cannot borrow it.
   const selected=await tx.query(`
     SELECT a.id::text AS id
     FROM service.service_attendances a
     WHERE a.tenant_id=$1::uuid AND a.organization_id=$2::uuid
      AND a.workspace_id=$3::uuid AND a.id=$4::uuid
      AND a.funnel_id=$5::uuid AND a.state='open'
      AND a.version=$6::bigint
     FOR NO KEY UPDATE
   `,[ticket.tenantId,ticket.organizationId,ticket.workspaceId,
     input.attendanceId,requested.funnelId,input.expectedVersion]);
   if(selected.rows.length!==1)throw new AccessDeniedError();
   const context:FunnelContext={
    tenantId:ticket.tenantId,organizationId:ticket.organizationId,
    workspaceId:ticket.workspaceId,actor:ticket.actor,
   };
   // The Service implementation repeats its existing kernel/module checks,
   // protected membership query, trusted actor GUC and CAS stage transition.
   return this.service.advancePinned(context,input,tx);
  });
 }
}
