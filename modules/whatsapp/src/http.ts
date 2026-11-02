import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Module,Param,Post} from "@nestjs/common";
import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {WhatsAppAccounts} from "./accounts.js";

type Runtime={kernel:CoreKernel;verifier:{verify(value:string|undefined):Promise<Actor>}};
@Injectable()
export class WhatsAppHost {
 readonly accounts:WhatsAppAccounts;
 constructor(@Inject("SYNDES_CORE_API")private readonly core:Runtime,
 @Inject("SYNDES_TENANT_DB")pools:TrustedTenantDatabaseProvider){
  this.accounts=new WhatsAppAccounts(async tenantId=>{
   const db=await pools.resolve(tenantId);
   if(db.tenantId!==tenantId)throw new Error("Tenant database mismatch");
   return {query:async<T extends Record<string,unknown>>(sql:string,values:readonly unknown[])=>{
    const result=await db.query(sql,values);
    return {rows:result.rows as T[]};
   }};
  });
 }
 async run<T>(tenantId:string,authorization:string|undefined,action:"read"|"write",fn:()=>Promise<T>):Promise<T>{
  let actor:Actor;
  try{actor=await this.core.verifier.verify(authorization)}
  catch{throw new HttpException("Authentication required",401)}
  try {
   return await this.core.kernel.execute({tenantId,actor,resource:"whatsapp:accounts",action},fn);
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
  return this.host.run(tenantId,authorization,"read",()=>this.host.accounts.list({tenantId}));
 }
 @Get(":accountId")
 get(@Param("tenantId")tenantId:string,@Param("accountId")accountId:string,
 @Headers("authorization")authorization:string|undefined){
  return this.host.run(tenantId,authorization,"read",async()=>{
   const account=await this.host.accounts.get({tenantId},accountId);
   if(!account)throw new HttpException("WhatsApp account not found",404);
   return account;
  });
 }
 @Post()
 create(@Param("tenantId")tenantId:string,@Headers("authorization")authorization:string|undefined,
 @Body()body:{displayName?:unknown}){
  return this.host.run(tenantId,authorization,"write",()=>{
   if(typeof body?.displayName!=="string")throw new HttpException("Invalid display name",400);
   return this.host.accounts.create({tenantId},body.displayName);
  });
 }
}
@Module({providers:[WhatsAppHost],controllers:[WhatsAppAccountsController]})
export class WhatsAppHttpModule{}
