import {Body,Controller,Delete,Get,Header,Headers,HttpException,HttpStatus,Injectable,Param,Patch,Post,Query} from "@nestjs/common";
import {Inject} from "@nestjs/common";
import {AccessDeniedError} from "@syndes/core-kernel";
import {CrmService,CrmExtras,PgCrmRepositoryFactory,PgCrmExtrasFactory,CrmValidationError,TenantDatabaseMismatchError} from "./index.js";
import type {CrmContext,CreatePerson,CreateOrganization} from "./contracts.js";
import {isUuid} from "./validation.js";
import {CORE_RUNTIME,TENANT_DATABASES,type CrmHostRuntime,type TrustedTenantDatabaseProvider} from "./runtime.js";

@Injectable()
export class CrmHost {
 readonly crm:CrmService;
 readonly extra:CrmExtras;
 constructor(
   @Inject(CORE_RUNTIME) readonly core:CrmHostRuntime,
   @Inject(TENANT_DATABASES) private readonly pools:TrustedTenantDatabaseProvider
 ){
   const repos=new PgCrmRepositoryFactory(pools);
   const extras=new PgCrmExtrasFactory(pools);
   this.crm=new CrmService(core.kernel,id=>repos.forTenant(id));
   this.extra=new CrmExtras(core.kernel,id=>extras.forTenant(id));
 }
 async context(tenantId:string,bearer:string|undefined):Promise<CrmContext>{
   if(!isUuid(tenantId))throw new HttpException("Invalid tenant ID",400);
   try{
     const actor=await this.core.verifier.verify(bearer);
     return {actor,tenantId};
   }catch{
     throw new HttpException("Authentication required",401);
   }
 }
 async run<T>(tenantId:string,bearer:string|undefined,
   task:(context:CrmContext)=>Promise<T>):Promise<T>{
   const ctx=await this.context(tenantId,bearer);
   try{return await task(ctx)}
   catch(e){
     if(e instanceof HttpException)throw e;
     if(e instanceof CrmValidationError)throw new HttpException(e.message,400);
     if(e instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
     if(e instanceof TenantDatabaseMismatchError)throw new HttpException("Tenant unavailable",503);
     if(typeof e==="object"&&e!==null&&"code" in e&&e.code==="23505")
       throw new HttpException("Duplicate record",409);
     // Includes OpenFGA/OpenBao/Postgres outages: never allow on error.
     throw new HttpException("CRM temporarily unavailable",503);
   }
 }
}

@Controller("v1/tenants/:tenantId/crm")
export class CrmController{
 constructor(private readonly host:CrmHost){}
 private run<T>(t:string,b:string|undefined,fn:(c:CrmContext)=>Promise<T>){
   return this.host.run(t,b,fn);
 }
 @Get("people")
 people(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Query("q")q:string|undefined,@Query("limit")limit:string|undefined){
   return this.run(t,b,c=>this.host.crm.listPeople(c,q??null,limit===undefined?25:Number(limit)));
 }
 @Post("people")
 createPerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Body()body:CreatePerson){return this.run(t,b,c=>this.host.crm.createPerson(c,body))}
 @Get("people/:id")
 person(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@Param("id")id:string){
   return this.run(t,b,async c=>{
     const result=await this.host.crm.getPerson(c,id);
     if(!result)throw new HttpException("Not found",404);
     return result;
   });
 }
 @Patch("people/:id")
 updatePerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:CreatePerson){
   return this.run(t,b,c=>this.host.extra.updatePerson(c,id,body));
 }
 @Delete("people/:id")
 archivePerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.archivePerson(c,id))}
 @Get("organizations")
 organizations(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Query("q")q:string|undefined,@Query("limit")limit:string|undefined){
   return this.run(t,b,c=>this.host.extra.listOrganizations(c,q??null,limit===undefined?25:Number(limit)));
 }
 @Post("organizations")
 createOrganization(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Body()body:CreateOrganization){return this.run(t,b,c=>this.host.crm.createOrganization(c,body))}
 @Get("organizations/:id")
 organization(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){
   return this.run(t,b,c=>this.host.extra.getOrganization(c,id));
 }
 @Patch("organizations/:id")
 updateOrg(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:CreateOrganization){
   return this.run(t,b,c=>this.host.extra.updateOrganization(c,id,body));
 }
 @Delete("organizations/:id")
 archiveOrg(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.extra.archiveOrganization(c,id))}
 @Post("people/:id/organizations")
 relate(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:{organizationId:string}){
   return this.run(t,b,c=>this.host.crm.linkPerson(c,id,body?.organizationId));
 }
 @Post("tags")
 tag(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Body()body:{label:string}){return this.run(t,b,c=>this.host.crm.createTag(c,body?.label))}
 @Post("people/:id/tags")
 tagPerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:{tagId:string}){
   return this.run(t,b,c=>this.host.crm.tagPerson(c,id,body?.tagId));
 }
 @Post("people/:id/notes")
 note(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:{body:string}){
   return this.run(t,b,c=>this.host.crm.createNote(c,id,body?.body));
 }
 @Get("people/:id/notes")
 notes(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.listNotes(c,id))}
 @Get("people/:id/channels")
 channels(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.extra.listChannels(c,id))}
 @Get("employees")
 employees(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined){
   return this.run(t,b,c=>this.host.extra.listEmployees(c))
 }
 @Get("people/:id/timeline")
 timeline(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.listTimeline(c,id))}
 @Post("people/:id/employee")
 employee(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:{jobTitle:string}){
   return this.run(t,b,c=>this.host.extra.createEmployee(c,id,body?.jobTitle));
 }
 @Post("people/:id/channels")
 channel(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Param("id")id:string,@Body()body:{channel:string;externalId:string;displayName?:string|null}){
   return this.run(t,b,c=>this.host.extra.linkChannel(c,id,body));
 }
 @Post("duplicates")
 duplicates(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Body()body:{email?:string|null;phone?:string|null;excludeId?:string|null}){
   return this.run(t,b,c=>this.host.extra.possibleDuplicates(c,body));
 }
 @Post("imports/csv")
 imports(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,
   @Body()body:{csv:string}){return this.run(t,b,c=>this.host.extra.importCsv(c,body?.csv))}
 @Get("exports/csv")
 @Header("Content-Type","text/csv; charset=utf-8")
 @Header("Content-Disposition",'attachment; filename="syndes-contacts.csv"')
 exports(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined){
   return this.run(t,b,c=>this.host.extra.exportCsv(c));
 }
}
