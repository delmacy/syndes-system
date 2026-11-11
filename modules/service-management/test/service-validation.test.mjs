import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {AccessDeniedError} from "@syndes/core-kernel";
import {ServiceFunnelService,ServiceFunnelInputError} from "../dist/index.js";

const scope={
 tenantId:randomUUID(),organizationId:randomUUID(),workspaceId:randomUUID(),
 actor:{kind:"user",id:"tested-oidc-sub"},
};
const noAccess=()=>{let databaseCalls=0,kernelCalls=0;
 const kernel={execute:async()=>{kernelCalls++;throw new AccessDeniedError()}};
 const tenants={withTransaction:async()=>{databaseCalls++;throw Error("unexpected db")}};
 return {service:new ServiceFunnelService(kernel,tenants),
  counters:()=>({databaseCalls,kernelCalls})};
};

test("constructor is inert: no database resolver, scheduler or timer",()=>{
 const {counters}=noAccess();
 assert.deepEqual(counters(),{databaseCalls:0,kernelCalls:0});
});

test("actor, tenant, organization and workspace cannot be inferred from defaults",async()=>{
 const {service,counters}=noAccess();
 for(const ctx of [
  {...scope,tenantId:"../../postgres"},
  {...scope,organizationId:""},
  {...scope,workspaceId:"other"},
  {...scope,actor:{kind:"service",id:"service"}},
  {...scope,actor:{kind:"user",id:""}},
 ]){
  await assert.rejects(service.board(ctx,randomUUID()),AccessDeniedError);
 }
 assert.deepEqual(counters(),{databaseCalls:0,kernelCalls:0});
});

test("authorization denial precedes any database work",async()=>{
 const {service,counters}=noAccess();
 await assert.rejects(service.board(scope,randomUUID()),AccessDeniedError);
 await assert.rejects(service.open(scope,{
  funnelId:randomUUID(),idempotencyKey:"stable-open-key",
 }),AccessDeniedError);
 assert.deepEqual(counters(),{databaseCalls:0,kernelCalls:2});
});

test("invalid configuration, request keys and versions rejected before authorization",async()=>{
 const {service,counters}=noAccess();
 await assert.rejects(service.publishSimpleFunnel(scope,{
  code:"invalid space",name:"Valid name",stages:[
   {code:"start",label:"Started"},{code:"end",label:"Finished"},
  ],
 }),ServiceFunnelInputError);
 await assert.rejects(service.publishSimpleFunnel(scope,{
  code:"valid",name:"Valid name",stages:[
   {code:"only",label:"Only stage"},
  ],
 }),ServiceFunnelInputError);
 for(const code of [undefined,null,{},42]){
  await assert.rejects(service.publishSimpleFunnel(scope,{
   code,name:"Valid funnel",stages:[
    {code:"start",label:"First stage"},{code:"finish",label:"Final stage"},
   ],
  }),ServiceFunnelInputError);
 }
 await assert.rejects(service.publishSimpleFunnel(scope,{
  code:"valid",name:"Valid funnel",stages:[
   {code:undefined,label:"First stage"},{code:"finish",label:"Final stage"},
  ],
 }),ServiceFunnelInputError);
 for(const key of ["x","../../../secrets","invalid key","a".repeat(121),
   undefined,null,{},42]){
  await assert.rejects(service.open(scope,{
   funnelId:randomUUID(),idempotencyKey:key,
  }),ServiceFunnelInputError);
 }
 await assert.rejects(service.advance(scope,{
  attendanceId:randomUUID(),nextStageId:randomUUID(),expectedVersion:0,
 }),ServiceFunnelInputError);
 await assert.rejects(service.close(scope,{
  attendanceId:randomUUID(),expectedVersion:1,result:" ",
 }),ServiceFunnelInputError);
 assert.deepEqual(counters(),{databaseCalls:0,kernelCalls:0});
});

test("client cannot choose an FGA resource or a database lease",async()=>{
 let requested,dbCalls=0;
 const kernel={execute:async request=>{requested=request;throw new AccessDeniedError()}};
 const tenants={withTransaction:async()=>{dbCalls++;throw Error("DB forbidden")}};
 const service=new ServiceFunnelService(kernel,tenants);
 await assert.rejects(service.board({...scope,resource:"platform:owner",
  databaseName:"syndes_control"},randomUUID()),AccessDeniedError);
 assert.equal(requested.resource,"service:attendances");
 assert.equal(requested.action,"read");
 assert.deepEqual(requested.actor,scope.actor);
 assert.equal(dbCalls,0);
});
