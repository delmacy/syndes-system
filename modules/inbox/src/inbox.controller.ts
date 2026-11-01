import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Param,Patch,Post,Query} from "@nestjs/common";
import type {Actor,CoreKernel,TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {AccessDeniedError} from "@syndes/core-kernel";
import {InboxService,PgInboxRepositoryFactory,InboxValidationError,InboxTenantMismatchError} from "./index.js";
import type {InboxContext,Inbound} from "./contracts.js";
import {uuid,pageSize} from "./validation.js";
interface HostPort {readonly kernel:CoreKernel;readonly verifier:{verify(header:string|undefined):Promise<Actor>};}
@Injectable()
export class InboxHost {
 readonly service:InboxService;
 constructor(@Inject("SYNDES_CORE_API") private readonly core:HostPort,
  @Inject("SYNDES_TENANT_DB") provider:TrustedTenantDatabaseProvider){
  const repos=new PgInboxRepositoryFactory(provider);
  this.service=new InboxService(core.kernel,t=>repos.forTenant(t));
 }
 async run<T>(tenant:string,bearer:string|undefined,fn:(ctx:InboxContext)=>Promise<T>):Promise<T>{
  let id:string,actor:Actor;
  try{id=uuid(tenant,"tenant")}catch{throw new HttpException("Invalid tenant",400)}
  try{actor=await this.core.verifier.verify(bearer)}
  catch{throw new HttpException("Authentication required",401)}
  try{return await fn({tenantId:id,actor})}
  catch(e){
   if(e instanceof HttpException)throw e;
   if(e instanceof InboxValidationError)throw new HttpException(e.message,400);
   if(e instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
   if(e instanceof InboxTenantMismatchError)throw new HttpException("Tenant unavailable",503);
   if(e&&typeof e==="object"&&"code" in e&&e.code==="23505")throw new HttpException("Duplicate",409);
   throw new HttpException("Inbox temporarily unavailable",503);
  }
 }
}
@Controller("v1/tenants/:tenantId/inbox")
export class InboxController{
 constructor(private readonly host:InboxHost){}
 private call<T>(t:string,b:string|undefined,fn:(c:InboxContext)=>Promise<T>){return this.host.run(t,b,fn)}
 @Get("conversations")
 list(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Query("limit")limit?:string){
  return this.call(t,b,c=>this.host.service.list(c,pageSize(limit,50)));
 }
 @Get("conversations/:id")
 get(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string){
  return this.call(t,b,async c=>{
   const value=await this.host.service.get(c,id);
   if(!value)throw new HttpException("Not found",404);
   return value;
  });
 }
 @Get("conversations/:id/messages")
 messages(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string,@Query("limit")limit?:string){
  return this.call(t,b,c=>this.host.service.messages(c,id,pageSize(limit,100,200)));
 }
 @Post("inbound")
 receive(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Body()body:Inbound){
  return this.call(t,b,c=>this.host.service.receive(c,body));
 }
 @Post("conversations/:id/replies")
 reply(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string,@Body()body:{body:unknown}){
  return this.call(t,b,c=>this.host.service.reply(c,id,body?.body));
 }
 @Post("conversations/:id/claim")
 claim(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string){
  return this.call(t,b,c=>this.host.service.assign(c,id,c.actor.id));
 }
 @Post("conversations/:id/release")
 release(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string){
  return this.call(t,b,c=>this.host.service.assign(c,id,null));
 }
 @Patch("conversations/:id/status")
 status(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string,@Body()body:{status:unknown}){
  return this.call(t,b,c=>this.host.service.status(c,id,body?.status));
 }
 @Patch("conversations/:id/handoff")
 handoff(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string,@Body()body:{enabled:unknown}){
  return this.call(t,b,c=>this.host.service.handoff(c,id,body?.enabled));
 }
 @Get("events")
 events(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Query("after")after?:string){
  return this.call(t,b,c=>this.host.service.events(c,after));
 }
}
