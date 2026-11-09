import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Param,Patch,Post,Query} from "@nestjs/common";
import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {SupportService,SupportDatabaseMismatchError,type SupportContext} from "./service.js";
import {SupportInputError,validUuid} from "./domain.js";

type HostApi=Readonly<{kernel:CoreKernel;verifier:{verify(header:string|undefined):Promise<Actor>}}>;
@Injectable()
export class SupportHost{
 readonly service:SupportService;
 constructor(@Inject("SYNDES_CORE_API") private readonly core:HostApi,
  @Inject("SYNDES_TENANT_DB") db:TrustedTenantDatabaseProvider){
  this.service=new SupportService(core.kernel,db);
 }
 async run<T>(tenantId:string,bearer:string|undefined,handler:(ctx:SupportContext)=>Promise<T>):Promise<T>{
  if(!validUuid(tenantId))throw new HttpException("Invalid tenant",400);
  let actor:Actor;
  try{actor=await this.core.verifier.verify(bearer);}
  catch{throw new HttpException("Authentication required",401);}
  try{return await handler({tenantId,actor});}
  catch(error){
   if(error instanceof HttpException)throw error;
   if(error instanceof SupportInputError)throw new HttpException(error.message,400);
   if(error instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
   if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505")
    throw new HttpException("Active case conflict",409);
   if(error instanceof SupportDatabaseMismatchError)throw new HttpException("Database unavailable",503);
   // No detailed PostgreSQL, FGA or OAuth error is exposed to the public API.
   throw new HttpException("Support temporarily unavailable",503);
  }
 }
}
const found=<T>(v:T|null):T=>{
 if(v===null)throw new HttpException("Case not found or action unavailable",404);
 return v;
};
@Controller("v1/tenants/:tenantId/support")
export class SupportController{
 constructor(private readonly host:SupportHost){}
 @Get(":kind/cases")
 list(@Param("tenantId")tenantId:string,@Param("kind")kind:string,
  @Headers("authorization")auth:string|undefined,@Query()filters:Record<string,unknown>){
  return this.host.run(tenantId,auth,ctx=>this.host.service.list(ctx,kind,filters));
 }
 @Get(":kind/cases/:caseId")
 get(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.get(ctx,kind,id)));
 }
 @Get(":kind/cases/:caseId/events")
 history(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined){
  return this.host.run(tenantId,auth,ctx=>this.host.service.history(ctx,kind,id));
 }
 @Post("internal/cases")
 createInternal(@Param("tenantId")tenantId:string,@Headers("authorization")auth:string|undefined,
  @Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.createInternal(ctx,body)));
 }
 @Post("external/cases")
 createExternal(@Param("tenantId")tenantId:string,@Headers("authorization")auth:string|undefined,
  @Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.createExternal(ctx,body)));
 }
 @Patch(":kind/cases/:caseId/status")
 status(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined,@Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.status(ctx,kind,id,body)));
 }
 @Patch(":kind/cases/:caseId/assignment")
 assignment(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined,@Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.assign(ctx,kind,id,body)));
 }
 @Patch(":kind/cases/:caseId/queue")
 queue(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined,@Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.transferQueue(ctx,kind,id,body)));
 }
 @Post(":kind/cases/:caseId/notes")
 note(@Param("tenantId")tenantId:string,@Param("kind")kind:string,@Param("caseId")id:string,
  @Headers("authorization")auth:string|undefined,@Body()body:unknown){
  return this.host.run(tenantId,auth,async ctx=>found(await this.host.service.note(ctx,kind,id,body)));
 }
}
