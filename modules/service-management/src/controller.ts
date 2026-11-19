import {
 Body,Controller,Get,Headers,HttpException,Inject,Injectable,Module,Optional,Param,Patch,Post,
} from "@nestjs/common";
import {
 AccessDeniedError,type Actor,type CoreKernel,type TenantTransaction,
 type TrustedTenantTransactionProvider,
} from "@syndes/core-kernel";
import {
 ServiceFunnelService,ServiceFunnelInputError,ServiceFunnelConflictError,
 type FunnelContext,
} from "./service.js";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type HostApi=Readonly<{
 kernel:CoreKernel;
 verifier:{verify(header:string|undefined):Promise<Actor>};
 organizationAccess?:{requireActive(tenantId:string,organizationId:string,principalId:string):Promise<void>};
}>;
const status=(error:unknown)=>{
 if(error instanceof HttpException)return error;
 if(error instanceof ServiceFunnelInputError)return new HttpException("Invalid service-management request",400);
 if(error instanceof ServiceFunnelConflictError)return new HttpException("Attendance conflict",409);
 if(error instanceof AccessDeniedError)return new HttpException("Forbidden",403);
 if(typeof error==="object"&&error!==null&&"code" in error){
  if(error.code==="23505"||error.code==="23514")return new HttpException("Service-management conflict",409);
  if(error.code==="23503")return new HttpException("Invalid scoped reference",409);
 }
 return new HttpException("Service-management unavailable",503);
};

/** This module is never mounted until explicitly added to trusted installed
 * plugins. No anonymous lookup, no implicit/default org/workspace and no
 * frontend-provided SQL role/DSN/FGA claim. */
@Injectable()
export class ServiceManagementHost{
 readonly service:ServiceFunnelService;
 constructor(
  @Inject("SYNDES_CORE_API") private readonly core:HostApi,
  @Inject("SYNDES_TENANT_DB") provider:TrustedTenantTransactionProvider,
  @Optional() @Inject("SYNDES_IAM07D_OPS")
  private readonly exact?:{
   executeMutation<T>(bearer:string,
    scope:{tenantId:string;organizationId:string;workspaceId:string},
    capability:"service.funnel.publish"|"service.attendance.open"|
      "service.attendance.assign"|"service.attendance.team_transfer"|
      "service.attendance.close",funnelId:string|undefined,
    effect:(tx:TenantTransaction,actor:Actor)=>Promise<T>):Promise<T>;
   advance(bearer:string,scope:{tenantId:string;organizationId:string;workspaceId:string},
    funnelId:string,service:ServiceFunnelService,input:{
     attendanceId:string;nextStageId:string;expectedVersion:number;
    }):Promise<unknown>;
  },
 ){
  this.service=new ServiceFunnelService(core.kernel,provider);
 }
 async advanceExact(ctx:FunnelContext,bearer:string|undefined,
  attendanceId:string,nextStageId:string,expectedVersion:number):Promise<unknown>{
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.advance(ctx,{attendanceId,nextStageId,expectedVersion});
  if(!this.exact||!bearer)throw new AccessDeniedError();
  const attendance=await this.service.get(ctx,attendanceId);
  if(!attendance||typeof attendance.funnelId!=="string")
   throw new AccessDeniedError();
  return this.exact.advance(bearer,ctx,attendance.funnelId,this.service,
   {attendanceId,nextStageId,expectedVersion});
 }
 private async exactWrite<T>(ctx:FunnelContext,bearer:string|undefined,
  capability:"service.funnel.publish"|"service.attendance.open"|
   "service.attendance.assign"|"service.attendance.team_transfer"|
   "service.attendance.close",
  funnelId:string|undefined,
  work:(ctx:FunnelContext,tx:TenantTransaction)=>Promise<T>):Promise<T>{
  if(!this.exact||!bearer)throw new AccessDeniedError();
  return this.exact.executeMutation(bearer,ctx,capability,funnelId,async(tx,actor)=>{
   if(actor.kind!==ctx.actor.kind||actor.id!==ctx.actor.id)
    throw new AccessDeniedError();
   return work({...ctx,actor},tx);
  });
 }
 private async funnelOf(ctx:FunnelContext,attendanceId:string):Promise<string>{
  const attendance=await this.service.get(ctx,attendanceId);
  if(!attendance||!UUID.test(attendance.funnelId))throw new AccessDeniedError();
  return attendance.funnelId;
 }
 async publishExact(ctx:FunnelContext,bearer:string|undefined,
  input:Parameters<ServiceFunnelService["publishSimpleFunnel"]>[1]){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.publishSimpleFunnel(ctx,input);
  return this.exactWrite(ctx,bearer,"service.funnel.publish",undefined,
   (authorized,tx)=>this.service.publishSimpleFunnelPinned(authorized,input,tx));
 }
 async openExact(ctx:FunnelContext,bearer:string|undefined,
  input:Parameters<ServiceFunnelService["open"]>[1]){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.open(ctx,input);
  return this.exactWrite(ctx,bearer,"service.attendance.open",input?.funnelId,
   (authorized,tx)=>this.service.openPinned(authorized,input,tx));
 }
 async assignExact(ctx:FunnelContext,bearer:string|undefined,
  input:Parameters<ServiceFunnelService["assign"]>[1]){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.assign(ctx,input);
  const funnel=await this.funnelOf(ctx,input?.attendanceId);
  return this.exactWrite(ctx,bearer,"service.attendance.assign",funnel,
   (authorized,tx)=>this.service.assignPinned(authorized,input,tx));
 }
 async transferTeamExact(ctx:FunnelContext,bearer:string|undefined,
  input:Parameters<ServiceFunnelService["transferTeam"]>[1]){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.transferTeam(ctx,input);
  const funnel=await this.funnelOf(ctx,input?.attendanceId);
  return this.exactWrite(ctx,bearer,"service.attendance.team_transfer",funnel,
   (authorized,tx)=>this.service.transferTeamPinned(authorized,input,tx));
 }
 async closeExact(ctx:FunnelContext,bearer:string|undefined,
  input:Parameters<ServiceFunnelService["close"]>[1]){
  if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")
   return this.service.close(ctx,input);
  const funnel=await this.funnelOf(ctx,input?.attendanceId);
  return this.exactWrite(ctx,bearer,"service.attendance.close",funnel,
   (authorized,tx)=>this.service.closePinned(authorized,input,tx));
 }
 async run<T>(
  tenantId:string,auth:string|undefined,organizationId:unknown,workspaceId:unknown,
  operation:(ctx:FunnelContext)=>Promise<T>,
 ):Promise<T>{
  if(!UUID.test(tenantId))throw new HttpException("Invalid tenant",400);
  let actor:Actor;
  try{actor=await this.core.verifier.verify(auth);}
  catch{throw new HttpException("Authentication required",401);}
  if(actor.kind!=="user"||typeof organizationId!=="string"||
     typeof workspaceId!=="string"||!UUID.test(organizationId)||!UUID.test(workspaceId))
   throw new HttpException("Authorized organization/workspace selection required",403);
  try{
   if(process.env.SYNDES_MULTI_ORG_ENABLED==="true"){
    if(!this.core.organizationAccess)throw new AccessDeniedError();
    await this.core.organizationAccess.requireActive(
     tenantId,organizationId,actor.id);
   }
   return await operation({tenantId,organizationId,workspaceId,actor});
  }catch(error){throw status(error);}
 }
}

@Controller("v1/tenants/:tenantId/service-management")
export class ServiceManagementController{
 constructor(private readonly host:ServiceManagementHost){}
 private run<T>(
  tenantId:string,auth:string|undefined,org:unknown,workspace:unknown,
  callback:(ctx:FunnelContext)=>Promise<T>,
 ):Promise<T>{
  return this.host.run(tenantId,auth,org,workspace,callback);
 }
 private legacyWrite<T>(tenantId:string,auth:string|undefined,
  org:unknown,workspace:unknown,callback:(ctx:FunnelContext)=>Promise<T>):Promise<T>{
  if(process.env.SYNDES_MULTI_ORG_ENABLED==="true")
   throw new HttpException("Exact write capability required",403);
  return this.run(tenantId,auth,org,workspace,callback);
 }
 @Get("funnels")
 listFunnels(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown){
  return this.run(t,a,o,w,ctx=>this.host.service.listFunnels(ctx));
 }
 @Post("funnels")
 createFunnel(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Body()body:{code:string;name:string;stages:{code:string;label:string}[]}){
  return this.run(t,a,o,w,ctx=>this.host.publishExact(ctx,a,body));
 }
 @Get("funnels/:funnelId/board")
 board(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("funnelId")id:string){
  return this.run(t,a,o,w,ctx=>this.host.service.board(ctx,id));
 }
 @Get("teams")
 teams(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown){
  return this.run(t,a,o,w,ctx=>this.host.service.listTeams(ctx));
 }
 @Post("attendances")
 open(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Body()body:{funnelId:string;conversationId?:string|null;idempotencyKey:string}){
  return this.run(t,a,o,w,ctx=>this.host.openExact(ctx,a,body));
 }
 @Get("conversations/:conversationId/attendances")
 byConversation(@Param("tenantId")t:string,
  @Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,
  @Headers("x-syndes-workspace-id")w:unknown,
  @Param("conversationId")conversationId:string){
  return this.run(t,a,o,w,ctx=>this.host.service.byConversation(ctx,conversationId));
 }
 @Get("attendances/:id")
 get(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string){
  return this.run(t,a,o,w,async ctx=>{
   const attendance=await this.host.service.get(ctx,id);
   if(!attendance)throw new HttpException("Attendance not found",404);
   return attendance;
  });
 }
 @Get("attendances/:id/events")
 history(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string){
  return this.run(t,a,o,w,ctx=>this.host.service.history(ctx,id));
 }
 @Patch("attendances/:id/stage")
 advance(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string,@Body()body:{nextStageId:string;expectedVersion:number}){
  return this.run(t,a,o,w,ctx=>this.host.advanceExact(
   ctx,a,id,body?.nextStageId,body?.expectedVersion));
 }
 @Patch("attendances/:id/assignment")
 assign(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string,@Body()body:{assigneeId:string;expectedVersion:number}){
  return this.run(t,a,o,w,ctx=>this.host.assignExact(ctx,a,{...body,attendanceId:id}));
 }
 @Patch("attendances/:id/team")
 transferTeam(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string,
  @Body()body:{destinationTeamId:string;expectedVersion:number;reason:string}){
  return this.run(t,a,o,w,ctx=>this.host.transferTeamExact(ctx,a,{
   ...body,attendanceId:id}));
 }
 @Post("attendances/:id/close")
 close(@Param("tenantId")t:string,@Headers("authorization")a:string|undefined,
  @Headers("x-syndes-organization-id")o:unknown,@Headers("x-syndes-workspace-id")w:unknown,
  @Param("id")id:string,@Body()body:{result:string;expectedVersion:number}){
  return this.run(t,a,o,w,ctx=>this.host.closeExact(ctx,a,{...body,attendanceId:id}));
 }
}

@Module({controllers:[ServiceManagementController],providers:[ServiceManagementHost]})
export class ServiceManagementHttpModule{}
