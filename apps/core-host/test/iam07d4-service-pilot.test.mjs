import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {AccessDeniedError} from "@syndes/core-kernel";
import {Iam07dServiceFunnelBusinessPilot}
 from "../dist/iam07d-service-funnel-business-pilot.js";

test("IAM07D4 snapshots caller input before delayed verified admission/commit",async()=>{
 const tenantId=randomUUID(),organizationId=randomUUID(),workspaceId=randomUUID(),
  actorId=randomUUID(),funnelId=randomUUID(),attendanceId=randomUUID(),
  nextStageId=randomUUID();
 const request={tenantId,organizationId,workspaceId,funnelId,
  capability:"service.funnel.operate"};
 const input={attendanceId,nextStageId,expectedVersion:1};
 const ticket={tenantId,organizationId,workspaceId,
  actor:{kind:"user",id:actorId},capability:"service.funnel.operate",epoch:1};
 let resume;
 const paused=new Promise(resolve=>{resume=resolve});
 const selected=[],effect=[];
 const business=new Iam07dServiceFunnelBusinessPilot({
  issue:async(_bearer,selectedRequest)=>{
   await paused;
   selected.push({...selectedRequest});
   return ticket;
  },
  execute:async(_ticket,work)=>work({
   tenantId,query:async(sql,values)=>({rows:[{id:attendanceId}],rowCount:1,
    values}),
  }),
 },{advancePinned:async(ctx,selectedInput,tx)=>{
  effect.push({ctx,input:selectedInput,tx});
  return {stageId:selectedInput.nextStageId,version:2};
 }});
 const performing=business.advance("Bearer verified-stub",request,input);
 request.funnelId=randomUUID();
 input.nextStageId=randomUUID();
 input.expectedVersion=44;
 resume();
 const changed=await performing;
 assert.equal(changed.stageId,nextStageId);
 assert.equal(selected.length,1);
 assert.equal(selected[0].funnelId,funnelId);
 assert.equal(effect.length,1);
 assert.equal(effect[0].input.nextStageId,nextStageId);
 assert.equal(effect[0].input.expectedVersion,1);
 assert.equal(effect[0].ctx.actor.id,actorId);
 assert.ok(Object.isFrozen(effect[0].input));
});

test("IAM07D4 wrong capability/funnel/ID is denied before issuing IAM ticket",async()=>{
 let invoked=false;
 const business=new Iam07dServiceFunnelBusinessPilot({
  issue:async()=>{invoked=true;throw Error("Should never issue")},
  execute:async()=>{invoked=true;throw Error("Should never execute")},
 },{advancePinned:async()=>{invoked=true}});
 const base={tenantId:randomUUID(),organizationId:randomUUID(),
  workspaceId:randomUUID(),funnelId:randomUUID(),
  capability:"service.funnel.operate"};
 const action={attendanceId:randomUUID(),nextStageId:randomUUID(),
  expectedVersion:1};
 for(const request of [
  {...base,capability:"inbox.conversation.claim"},
  {...base,funnelId:undefined},
  {...base,funnelId:randomUUID().slice(0,4)},
 ]){
  await assert.rejects(business.advance("Bearer fake",request,action),AccessDeniedError);
 }
 for(const input of [
  {...action,attendanceId:"bad"},{...action,nextStageId:"bad"},
  {...action,expectedVersion:0},{...action,expectedVersion:1.5},
 ]){
  await assert.rejects(business.advance("Bearer fake",base,input),AccessDeniedError);
 }
 assert.equal(invoked,false);
});
