/**
 * IAM-07D3 opt-in adapter: real Inbox claim/transfer business effects execute
 * in the SAME pinned tenant transaction as the IAM07D epoch/membership fence.
 * Not imported by main.ts or the operational Inbox REST controllers.
 * Missing exact FGA capability or a revoked tenant epoch always denies.
 */
import {AccessDeniedError} from "@syndes/core-kernel";
import {PgInboxRepository} from "@syndes/core-inbox";
import type {RequestedIamPilotContext} from "./iam-organization-context-pilot.js";
import type {Iam07dRevokeFirstPilot} from "./iam07d-revoke-first-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const safeId=(id:unknown)=>typeof id==="string"&&UUID.test(id);

/** A capability is ALWAYS exact. Claim cannot silently reassign an existing
 * assignee; transfer is never a tenant-wide unscoped repository call.
 */
export class Iam07dInboxBusinessPilot{
 constructor(private readonly iam:Pick<Iam07dRevokeFirstPilot,"issue"|"execute">){
  if(typeof iam?.issue!=="function"||typeof iam?.execute!=="function")
   throw new TypeError("Trusted IAM07D controller dependency required");
 }
 async claim(bearer:string,requested:RequestedIamPilotContext,conversationId:string){
  if(!requested||requested.capability!=="inbox.conversation.claim"||
     !safeId(conversationId))throw new AccessDeniedError();
  const ticket=await this.iam.issue(bearer,requested);
  if(ticket.capability!=="inbox.conversation.claim")
   throw new AccessDeniedError();
  return this.iam.execute(ticket,async tx=>{
   // Hold conversation row until the subsequent repository UPDATE/audit;
   // a second user cannot race a claim and silently seize ownership.
   const available=await tx.query(`
      SELECT id::text AS id FROM inbox_conversations
      WHERE tenant_id=$1::uuid AND id=$2::uuid
       AND platform_organization_id=$3::uuid
       AND platform_current_workspace_id=$4::uuid
       AND assigned_to IS NULL AND status IN ('open','pending')
      FOR NO KEY UPDATE
     `,[ticket.tenantId,conversationId,
       ticket.organizationId,ticket.workspaceId]);
   if(available.rows.length!==1)throw new AccessDeniedError();
   const repo=new PgInboxRepository(tx,{
    organizationId:ticket.organizationId,workspaceId:ticket.workspaceId,
   });
   const result=await repo.assign(ticket.tenantId,conversationId,
     ticket.actor.id,ticket.actor.id);
   if(!result||result.id!==conversationId||
      result.assignedTo!==ticket.actor.id)
    throw new AccessDeniedError();
   return result;
  });
 }
 async transfer(bearer:string,requested:RequestedIamPilotContext,
  conversationId:string,targetWorkspaceId:string){
  if(!requested||requested.capability!=="inbox.conversation.transfer"||
     !safeId(conversationId)||!safeId(targetWorkspaceId)||
     targetWorkspaceId===requested.workspaceId)
   throw new AccessDeniedError();
  const ticket=await this.iam.issue(bearer,requested);
  if(ticket.capability!=="inbox.conversation.transfer")
   throw new AccessDeniedError();
  return this.iam.execute(ticket,async tx=>{
   const repo=new PgInboxRepository(tx,{
    organizationId:ticket.organizationId,workspaceId:ticket.workspaceId,
   });
   const result=await repo.transferWorkspace(ticket.tenantId,
     conversationId,ticket.actor.id,targetWorkspaceId);
   if(!result||result.id!==conversationId)throw new AccessDeniedError();
   return result;
  });
 }
}
