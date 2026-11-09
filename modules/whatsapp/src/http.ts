import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Module,Param,Post,Patch} from "@nestjs/common";
import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppAccounts} from "./accounts.js";
import {WhatsAppGatewayClient} from "./gateway-client.js";
import {WhatsAppContactNames} from "./contact-name.js";
import {WhatsAppGroupService} from "./groups.js";
import {WhatsAppAvatars} from "./avatars.js";
import {WhatsAppDefaultContextGuard,type WhatsAppScope} from "./scope.js";

type Runtime={kernel:CoreKernel;verifier:{verify(value:string|undefined):Promise<Actor>}};
@Injectable()
export class WhatsAppHost {
 readonly accounts:WhatsAppAccounts;
 readonly scope:WhatsAppDefaultContextGuard;
 readonly gateway=new WhatsAppGatewayClient();
 readonly contactNames:WhatsAppContactNames;
 readonly groups:WhatsAppGroupService;
 readonly avatars:WhatsAppAvatars;
 constructor(@Inject("SYNDES_CORE_API")private readonly core:Runtime,
 @Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider){
  this.scope=new WhatsAppDefaultContextGuard(core.kernel,pools);
  this.contactNames=new WhatsAppContactNames(pools,this.gateway);
  this.groups=new WhatsAppGroupService(pools,this.gateway);
  this.avatars=new WhatsAppAvatars(pools,this.gateway);
  this.accounts=new WhatsAppAccounts(async tenantId=>{
   const db=await pools.resolve(tenantId);
   if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
   return {query:async<T extends Record<string,unknown>>(sql:string,values:readonly unknown[])=>{
    const result=await db.query(sql,values);
    return {rows:result.rows as T[]};
   }};
  });
 }
 async avatarAuthorized(tenantId:string,authorization:string|undefined,conversationId:string,scope:WhatsAppScope){
  const actor=await this.core.verifier.verify(authorization);
  return this.core.kernel.execute({tenantId,actor,resource:"inbox:conversations",action:"read"},
   ()=>this.avatars.get(tenantId,conversationId,scope));
 }
 async runContactName<T>(tenantId:string,authorization:string|undefined,fn:(actor:Actor,scope:WhatsAppScope)=>Promise<T>):Promise<T>{
  let actor:Actor;
  try{actor=await this.core.verifier.verify(authorization)}
  catch{throw new HttpException("Authentication required",401)}
  try{
   return await this.core.kernel.execute({tenantId,actor,resource:"whatsapp:accounts",action:"write"},
    ()=>this.core.kernel.execute({tenantId,actor,resource:"crm:people",action:"write"},
       async()=>fn(actor,await this.scope.resolve(tenantId,actor))));
  }catch(error){
   if(error instanceof HttpException)throw error;
   if(error instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
   if(error instanceof Error && /Invalid contact name|Invalid contact context/.test(error.message))
     throw new HttpException("Nome inválido",400);
   if(error instanceof Error && /Use the CRM contact name first/.test(error.message))
     throw new HttpException("Atualize o nome no CRM antes de sincronizar.",409);
   if(error instanceof Error && /WhatsApp contact not eligible|WhatsApp contact route changed/.test(error.message))
     throw new HttpException("Conversa ou telefone não elegível",404);
   throw new HttpException("Não foi possível enviar a alteração ao WhatsApp",503);
  }
 }
 async run<T>(tenantId:string,authorization:string|undefined,action:"read"|"write",fn:(scope:WhatsAppScope)=>Promise<T>):Promise<T>{
  let actor:Actor;
  try{actor=await this.core.verifier.verify(authorization)}
  catch{throw new HttpException("Authentication required",401)}
  try {
   return await this.core.kernel.execute({tenantId,actor,resource:"whatsapp:accounts",action},
    async()=>fn(await this.scope.resolve(tenantId,actor)));
  }catch(error){
   if(error instanceof HttpException)throw error;
   if(error instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
   if(error instanceof Error && /Invalid (account or tenant identifier|account display name)/.test(error.message))
    throw new HttpException(error.message,400);
   throw new HttpException("WhatsApp accounts unavailable",503);
  }
 }
}
@Controller("v1/tenants/:tenantId/whatsapp/accounts")
export class WhatsAppAccountsController {
 constructor(private readonly host:WhatsAppHost){}
 @Get()
 list(@Param("tenantId")tenantId:string,@Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"read",async scope=>{
   const accounts=await this.host.accounts.list(scope);
   const connected=await this.host.gateway.list(tenantId);
   const sessions=new Map(connected.map(s=>[s.accountId,s]));
   return accounts.map(a=>{
    const s=sessions.get(a.id);
    return {...a,serviceEnabled:a.serviceEnabled&&(s?.enabled??true),deviceJid:s?.deviceJid??a.deviceJid,
     phoneExternalId:s?.deviceJid??a.phoneExternalId,
     state:s?.connected?"connected":s?.deviceJid?"disconnected":"unpaired"};
   });
  });
 }
 @Get(":accountId")
 get(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,
 @Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"read",async scope=>{
   const account=await this.host.accounts.get(scope,accountId);
   if(!account)throw new HttpException("WhatsApp account not found",404);
   return account;
  });
 }
 @Post()
 create(@Param("tenantId")tenantId:string,@Headers("authorization")authorization:string|undefined,
 @Body()body:{displayName?:unknown}){
  return this.host.run(tenantId,authorization,"write",async scope=>{
   if(typeof body?.displayName!=="string")throw new HttpException("Invalid display name",400);
   const account=await this.host.accounts.create(scope,body.displayName);
   await this.host.gateway.register(tenantId,account.id);
   return account;
  });
 }
 @Post(":accountId/pair")
 pair(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,@Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"write",async scope=>{
   await this.host.accounts.requireEnabled(scope,accountId);
   await this.host.gateway.register(tenantId,accountId);
   return this.host.gateway.pair(tenantId,accountId);
  });
 }
 @Post(":accountId/disconnect")
 disconnect(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,@Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"write",async scope=>{
   await this.host.accounts.requireEnabled(scope,accountId);
   return this.host.gateway.disconnect(tenantId,accountId);
  });
 }
 @Patch(":accountId/enabled")
 enabled(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,@Headers("authorization")authorization:string|undefined,
 @Body()body:{enabled?:unknown}){
  return this.host.run(tenantId,authorization,"write",async scope=>{
   if(typeof body?.enabled!=="boolean")throw new HttpException("Invalid enabled state",400);
   const current=await this.host.accounts.get(scope,accountId);
   if(!current)throw new HttpException("WhatsApp account not found",404);
   await this.host.gateway.setEnabled(tenantId,accountId,body.enabled);
   try{
    const updated=await this.host.accounts.setEnabled(scope,accountId,body.enabled);
    if(!updated)throw new Error("Account update unavailable");
    return updated;
   }catch(error){
    try{await this.host.gateway.setEnabled(tenantId,accountId,current.serviceEnabled)}
    catch{/* Remote state must be reconciled by operator if rollback fails. */}
    throw error;
   }
  });
 }
 @Post(":accountId/connect")
 connect(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,@Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"write",async scope=>{
   await this.host.accounts.requireEnabled(scope,accountId);
   return this.host.gateway.connect(tenantId,accountId);
  });
 }
}
@Controller("v1/tenants/:tenantId/whatsapp/conversations")
export class WhatsAppContactNamesController {
 constructor(private readonly host:WhatsAppHost){}
 @Patch(":conversationId/contact-name")
 rename(@Param("tenantId")tenantId:string,@Param("conversationId")conversationId:string,
   @Headers("authorization")authorization:string|undefined,
   @Body()body:{fullName?:unknown;saveOnPrimaryAddressbook?:unknown}){
  return this.host.runContactName(tenantId,authorization,(actor,scope)=>
   this.host.contactNames.rename(tenantId,actor.id,conversationId,
      body?.fullName,body?.saveOnPrimaryAddressbook??false,scope));
 }
}
@Controller("v1/tenants/:tenantId/whatsapp/conversations")
export class WhatsAppGroupsController{
 constructor(private readonly host:WhatsAppHost){}
 @Get(":conversationId/avatar")
 avatar(@Param("tenantId")tenantId:string,@Param("conversationId")conversationId:string,
   @Headers("authorization")authorization:string|undefined){
   return this.host.run(tenantId,authorization,"read",scope=>this.host.avatarAuthorized(tenantId,authorization,conversationId,scope));
 }
 @Get(":conversationId/group")
 info(@Param("tenantId")tenantId:string,@Param("conversationId")conversationId:string,
  @Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"read",scope=>this.host.groups.info(tenantId,conversationId,scope));
 }
 @Patch(":conversationId/group")
 update(@Param("tenantId")tenantId:string,@Param("conversationId")conversationId:string,
  @Headers("authorization")authorization:string|undefined,@Body()body:unknown){
  return this.host.run(tenantId,authorization,"write",scope=>this.host.groups.update(tenantId,conversationId,body,scope));
 }
}
@Module({providers:[WhatsAppHost],controllers:[WhatsAppAccountsController,WhatsAppContactNamesController,WhatsAppGroupsController]})
export class WhatsAppHttpModule{}
