import "reflect-metadata";
import test from "node:test";
import assert from "node:assert/strict";
import {ServiceManagementController} from "../dist/controller.js";

const T="11111111-1111-4111-8111-111111111111";
const O="22222222-2222-4222-8222-222222222222";
const W="33333333-3333-4333-8333-333333333333";
const A="44444444-4444-4444-8444-444444444444";
const H="Bearer validated-by-actual-host";
test("multi-org Service rejects un-fenced writes and uses exact stage advance instead",async()=>{
 const old=process.env.SYNDES_MULTI_ORG_ENABLED;
 process.env.SYNDES_MULTI_ORG_ENABLED="true";
 let legacy=0,operations=0;
 const host={
  run:async(t,h,o,w,fn)=>{
   operations++;assert.deepEqual([t,h,o,w],[T,H,O,W]);
   return fn({tenantId:T,organizationId:O,workspaceId:W,actor:{id:A,kind:"user"}});
  },
  service:new Proxy({},{get:()=>()=>{legacy++;throw Error("Unprotected service operation")}}),
  advanceExact:async(ctx,bearer,id,next,version)=>{
   assert.deepEqual([ctx.organizationId,ctx.workspaceId,bearer,id,next,version],
    [O,W,H,A,A,1]);
   return {id,version:2};
  },
 };
 const api=new ServiceManagementController(host);
 try{
  const prohibited=[
   ()=>api.createFunnel(T,H,O,W,{code:"new",name:"New",stages:[]}),
   ()=>api.open(T,H,O,W,{funnelId:A,idempotencyKey:"test-claim"}),
   ()=>api.assign(T,H,O,W,A,{assigneeId:A,expectedVersion:1}),
   ()=>api.transferTeam(T,H,O,W,A,{destinationTeamId:A,expectedVersion:1,reason:"Try"}),
   ()=>api.close(T,H,O,W,A,{result:"done",expectedVersion:1}),
  ];
  for(const call of prohibited)
   await assert.rejects(async()=>await call(),e=>e.status===403);
  assert.equal(operations,0);
  assert.equal(legacy,0);
  assert.deepEqual(await api.advance(T,H,O,W,A,{nextStageId:A,expectedVersion:1}),
   {id:A,version:2});
  assert.equal(operations,1);
  assert.equal(legacy,0);
 }finally{
  if(old===undefined)delete process.env.SYNDES_MULTI_ORG_ENABLED;
  else process.env.SYNDES_MULTI_ORG_ENABLED=old;
 }
});
