/**
 * IAM-07D2 candidate: bounded, explicitly invoked tenant-only remote revoke
 * dispatcher. No daemon, schedules, production wiring or direct browser/API.
 * Never call remote FGA until the tenant deny epoch is committed and checked.
 * A provider outage retains outbox=pending; retries only make privileges LESS.
 */
import {
 AccessDeniedError,PINNED_TENANT_TRANSACTION,
 type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";
import {iam07dFineObjectForScope}
 from "./iam07d-fine-fga-policy.js";
import type {Iam07dRevocation,SpecificIam07dCapability}
 from "./iam07d-revoke-first-pilot.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAPS=new Set<string>([
 "inbox.conversation.claim","inbox.conversation.transfer",
 "service.funnel.operate",
]);
export interface ExactFineTupleRevoker{
 revokeExact(userId:string,object:string):Promise<"removed"|"absent">;
}
export class Iam07dRevocationOutboxDispatcher{
 constructor(private readonly tenantDatabases:TrustedTenantTransactionProvider,
  private readonly fga:ExactFineTupleRevoker,
  /** Replays SAME operation to reconcile Control AFTER tenant deny commit. */
  private readonly reconcile:(command:Iam07dRevocation)=>Promise<number>){
  if(typeof tenantDatabases?.resolve!=="function"||
     typeof tenantDatabases?.withTransaction!=="function"||
     typeof fga?.revokeExact!=="function"||typeof reconcile!=="function")
   throw TypeError("Untrusted IAM revocation dispatcher");
 }
 async deliver(tenantId:string,operationId:string):Promise<"delivered"|"already_delivered">{
  if(!UUID.test(tenantId)||!UUID.test(operationId))throw new AccessDeniedError();
  let scope:Readonly<{tenantId:string;organizationId:string;workspaceId:string;
    principalId:string;capability:SpecificIam07dCapability;
    revokedEpoch:number}>|undefined;
  try{
   const db=await this.tenantDatabases.resolve(tenantId);
   if(db.tenantId!==tenantId)throw new AccessDeniedError();
   const out=await db.query(`
     SELECT tenant_id::text,organization_id::text,workspace_id::text,
      principal_id,capability,revoked_epoch::text AS epoch,state
     FROM platform_iam_revocation_outbox
     WHERE tenant_id=$1::uuid AND operation_id=$2::uuid
   `,[tenantId,operationId]);
   if(out.rows.length!==1)throw new AccessDeniedError();
   const row=out.rows[0];
   if(row.state==="delivered")return "already_delivered";
   const epoch=Number(row.epoch);
   if(row.state!=="pending"||row.tenant_id!==tenantId||
      !UUID.test(String(row.organization_id))||!UUID.test(String(row.workspace_id))||
      !UUID.test(String(row.principal_id))||
      !CAPS.has(String(row.capability))||
      !Number.isSafeInteger(epoch)||epoch<2)
    throw new AccessDeniedError();
   scope={
    tenantId,organizationId:String(row.organization_id),
    workspaceId:String(row.workspace_id),principalId:String(row.principal_id),
    capability:row.capability as SpecificIam07dCapability,
    revokedEpoch:epoch,
   };
   const values=[tenantId,scope.organizationId,scope.workspaceId,
    scope.principalId,scope.capability];
   const fence=await db.query(`
     SELECT state,epoch::text AS epoch,last_revoke_operation_id::text AS op
     FROM platform_iam_capability_fences
     WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
      AND workspace_id=$3::uuid AND principal_id=$4 AND capability=$5
   `,values);
   if(fence.rows.length!==1||fence.rows[0].state!=="revoked"||
      Number(fence.rows[0].epoch)!==epoch||
      fence.rows[0].op!==operationId)
    throw new AccessDeniedError();
   const targets=await db.query(`
      SELECT resource_name,fga_object
      FROM platform_iam_fga_grant_targets
      WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
       AND workspace_id=$3::uuid AND principal_id=$4 AND capability=$5
      ORDER BY resource_name
    `,values);
   // Without a COMPLETE trusted registration catalog we cannot assert all
   // external fine grants were withdrawn. No empty-target success shortcut.
   if(targets.rows.length===0)throw new AccessDeniedError();
   for(const grant of targets.rows){
    const expected=iam07dFineObjectForScope({
     tenantId,organizationId:scope.organizationId,
     workspaceId:scope.workspaceId,capability:scope.capability,
     resourceName:String(grant.resource_name),
    });
    if(grant.fga_object!==expected)throw new AccessDeniedError();
   }
   // All side-effects are remote OUTSIDE a PG lease/transaction. A crash
   // mid-batch leaves pending, so retry idempotently checks each tuple again.
   for(const grant of targets.rows){
    const result=await this.fga.revokeExact(scope.principalId,String(grant.fga_object));
    if(result!=="removed"&&result!=="absent")throw new AccessDeniedError();
   }
   const expected=epoch-1;
   const current=await this.reconcile({
    operationId,tenantId,organizationId:scope.organizationId,
    workspaceId:scope.workspaceId,principalId:scope.principalId,
    capability:scope.capability,expectedEpoch:expected,
   });
   if(current!==epoch)throw new AccessDeniedError();
   return await this.tenantDatabases.withTransaction(tenantId,async tx=>{
    if(tx.tenantId!==tenantId||tx[PINNED_TENANT_TRANSACTION]!==true)
     throw new AccessDeniedError();
    // Revalidate local deny under lock BEFORE marking delivered.
    const locked=await tx.query(`
      SELECT state,epoch::text AS epoch,last_revoke_operation_id::text AS op
      FROM platform_iam_capability_fences
      WHERE tenant_id=$1::uuid AND organization_id=$2::uuid
       AND workspace_id=$3::uuid AND principal_id=$4 AND capability=$5
      FOR SHARE
    `,values);
    if(locked.rows.length!==1||locked.rows[0].state!=="revoked"||
       Number(locked.rows[0].epoch)!==epoch||locked.rows[0].op!==operationId)
     throw new AccessDeniedError();
    const updated=await tx.query(`
      UPDATE platform_iam_revocation_outbox
      SET state='delivered',attempts=attempts+1,
       last_attempt_at=clock_timestamp(),delivered_at=clock_timestamp()
      WHERE tenant_id=$1::uuid AND operation_id=$2::uuid
       AND revoked_epoch=$3::bigint AND state='pending'
      RETURNING operation_id::text
    `,[tenantId,operationId,epoch]);
    if(updated.rows.length===1)return "delivered";
    const reread=await tx.query(`
      SELECT state FROM platform_iam_revocation_outbox
      WHERE tenant_id=$1::uuid AND operation_id=$2::uuid
       AND revoked_epoch=$3::bigint
    `,[tenantId,operationId,epoch]);
    if(reread.rows.length!==1||reread.rows[0].state!=="delivered")
     throw new AccessDeniedError();
    return "already_delivered";
   });
  }catch{
   // Counter is best effort; never change state from pending on failure.
   if(scope){
    try{
     await this.tenantDatabases.withTransaction(tenantId,async tx=>{
      if(tx.tenantId!==tenantId||tx[PINNED_TENANT_TRANSACTION]!==true)
       throw new AccessDeniedError();
      await tx.query(`
       UPDATE platform_iam_revocation_outbox
        SET attempts=attempts+1,last_attempt_at=clock_timestamp()
       WHERE tenant_id=$1::uuid AND operation_id=$2::uuid AND state='pending'
      `,[tenantId,operationId]);
     });
    }catch{/* no content or secrets logged */}
   }
   throw new AccessDeniedError();
  }
 }
}
