import {Body,Controller,Delete,Get,Header,Headers,HttpException,HttpStatus,Injectable,Param,Patch,Post,Query} from "@nestjs/common";
import {Inject} from "@nestjs/common";
import {AccessDeniedError,type RequestedOperationalScope} from "@syndes/core-kernel";
import {SelectedScope} from "./selection-header.js";
import {CrmService,CrmExtras,PgCrmRepositoryFactory,PgCrmExtrasFactory,CrmValidationError,TenantDatabaseMismatchError} from "./index.js";
import {CrmDefaultContextGuard} from "./context-guard.js";
import type {CrmContext,CreatePerson,CreateOrganization} from "./contracts.js";
import {isUuid} from "./validation.js";
import {CORE_RUNTIME,TENANT_DATABASES,type CrmHostRuntime,type TrustedTenantDatabaseProvider} from "./runtime.js";

@Injectable()
export class CrmHost {
 readonly crm:CrmService;
 readonly extra:CrmExtras;
 readonly scope:CrmDefaultContextGuard;
 constructor(
   @Inject(CORE_RUNTIME) readonly core:CrmHostRuntime,
   @Inject(TENANT_DATABASES) private readonly pools:TrustedTenantDatabaseProvider
 ){
   const repos=new PgCrmRepositoryFactory(pools);
   const extras=new PgCrmExtrasFactory(pools);
   this.crm=new CrmService(core.kernel,(id,organizationId)=>repos.forTenant(id,organizationId));
   this.extra=new CrmExtras(core.kernel,(id,organizationId)=>extras.forTenant(id,organizationId));
   this.scope=new CrmDefaultContextGuard(core.kernel,pools);
 }
 async context(tenantId:string,bearer:string|undefined,selection?:RequestedOperationalScope):Promise<CrmContext>{
   if(!isUuid(tenantId))throw new HttpException("Invalid tenant ID",400);
   let actor;
   try{actor=await this.core.verifier.verify(bearer)}
   catch{throw new HttpException("Authentication required",401)}
   // The context guard performs both FGA and active org/workspace checks.
   // Context denial MUST NOT be misclassified as an authentication failure.
   return this.scope.resolve(tenantId,actor,selection);
 }
 async run<T>(tenantId:string,bearer:string|undefined,
   task:(context:CrmContext)=>Promise<T>,selection?:RequestedOperationalScope):Promise<T>{
   try{
     const ctx=await this.context(tenantId,bearer,selection);
     return await task(ctx);
   }catch(e){
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
 private run<T>(t:string,b:string|undefined,fn:(c:CrmContext)=>Promise<T>,
  selection?:RequestedOperationalScope){
   return this.host.run(t,b,fn,selection);
 }
 // UI affordances only. Every action still passes through server-side CoreKernel.
 @Get("capabilities")
 capabilities(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined){
   return this.run(t,b,async c=>{
     const permissions=[
       ["people.read","crm:people","read"],["people.write","crm:people","write"],
       ["organizations.read","crm:organizations","read"],["organizations.write","crm:organizations","write"],
       ["relationships.write","crm:relationships","write"],
       ["tags.read","crm:tags","read"],["tags.write","crm:tags","write"],
       ["notes.read","crm:notes","read"],["notes.write","crm:notes","write"],
       ["employees.read","crm:employees","read"],["employees.write","crm:employees","write"],
       ["channels.read","crm:channels","read"],["channels.write","crm:channels","write"],
     ] as const;
     const entries=await Promise.all(permissions.map(async ([name,resource,action])=>{
       try{
         if(action==="write"&&c.scopeWriteAllowed===false)return [name,false] as const;
         await this.host.core.kernel.execute({actor:c.actor,tenantId:c.tenantId,resource,action},async()=>true);
         return [name,true] as const;
       }catch(error){
         if(error instanceof AccessDeniedError)return [name,false] as const;
         // Outages do not accidentally grant access or silently claim a policy denial.
         throw error;
       }
     }));
     return Object.fromEntries(entries);
   },selection);
 }
 @Get("people")
 people(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Query("q")q:string|undefined,@Query("limit")limit:string|undefined,@Query("offset")offset:string|undefined){
   return this.run(t,b,c=>this.host.crm.listPeople(c,q??null,limit===undefined?25:Number(limit),offset===undefined?0:Number(offset)),selection);
 }
 @Post("people")
 createPerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Body()body:CreatePerson){return this.run(t,b,c=>this.host.crm.createPerson(c,body),selection)}
 @Get("people/:id")
 person(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,@Param("id")id:string){
   return this.run(t,b,async c=>{
     const result=await this.host.crm.getPerson(c,id);
     if(!result)throw new HttpException("Not found",404);
     return result;
   },selection);
 }
 @Patch("people/:id")
 updatePerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:CreatePerson){
   return this.run(t,b,c=>this.host.extra.updatePerson(c,id,body),selection);
 }
 @Delete("people/:id")
 archivePerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.archivePerson(c,id),selection)}
 @Get("organizations")
 organizations(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Query("q")q:string|undefined,@Query("limit")limit:string|undefined,@Query("offset")offset:string|undefined){
   return this.run(t,b,c=>this.host.extra.listOrganizations(c,q??null,limit===undefined?25:Number(limit),offset===undefined?0:Number(offset)),selection);
 }
 @Post("organizations")
 createOrganization(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Body()body:CreateOrganization){return this.run(t,b,c=>this.host.crm.createOrganization(c,body),selection)}
 @Get("organizations/:id")
 organization(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){
   return this.run(t,b,c=>this.host.extra.getOrganization(c,id),selection);
 }
 @Patch("organizations/:id")
 updateOrg(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:CreateOrganization){
   return this.run(t,b,c=>this.host.extra.updateOrganization(c,id,body),selection);
 }
 @Delete("organizations/:id")
 archiveOrg(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.extra.archiveOrganization(c,id),selection)}
 @Post("people/:id/organizations")
 relate(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:{organizationId:string}){
   return this.run(t,b,c=>this.host.crm.linkPerson(c,id,body?.organizationId),selection);
 }
 @Get("tags")
 listTags(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined){
   return this.run(t,b,c=>this.host.extra.listTags(c),selection);
 }
 @Delete("people/:id/organizations/:organizationId")
 unlinkOrganization(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")personId:string,@Param("organizationId")orgId:string){
   return this.run(t,b,c=>this.host.extra.unlinkOrganization(c,personId,orgId),selection);
 }
 @Delete("people/:id/tags/:tagId")
 unlinkTag(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")personId:string,@Param("tagId")tagId:string){
   return this.run(t,b,c=>this.host.extra.unlinkTag(c,personId,tagId),selection);
 }
 @Post("tags")
 tag(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Body()body:{label:string}){return this.run(t,b,c=>this.host.crm.createTag(c,body?.label),selection)}
 @Post("people/:id/tags")
 tagPerson(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:{tagId:string}){
   return this.run(t,b,c=>this.host.crm.tagPerson(c,id,body?.tagId),selection);
 }
 @Post("people/:id/notes")
 note(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:{body:string}){
   return this.run(t,b,c=>this.host.crm.createNote(c,id,body?.body),selection);
 }
 @Get("people/:id/notes")
 notes(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.listNotes(c,id),selection)}
 @Get("people/:id/organizations")
 personOrganizations(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")personId:string){
   return this.run(t,b,c=>this.host.extra.listPersonOrganizations(c,personId),selection);
 }
 @Get("people/:id/tags")
 personTags(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")personId:string){
   return this.run(t,b,c=>this.host.extra.listPersonTags(c,personId),selection);
 }
 @Get("people/:id/channels")
 channels(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.extra.listChannels(c,id),selection)}
 @Get("people/:id/employee")
 personEmployee(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")personId:string){
   return this.run(t,b,c=>this.host.extra.getPersonEmployee(c,personId),selection);
 }
 @Get("employees")
 employees(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined){
   return this.run(t,b,c=>this.host.extra.listEmployees(c),selection)
 }
 @Get("people/:id/timeline")
 timeline(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string){return this.run(t,b,c=>this.host.crm.listTimeline(c,id),selection)}
 @Post("people/:id/employee")
 employee(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:{jobTitle:string}){
   return this.run(t,b,c=>this.host.extra.createEmployee(c,id,body?.jobTitle),selection);
 }
 @Post("people/:id/channels")
 channel(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Param("id")id:string,@Body()body:{channel:string;externalId:string;displayName?:string|null}){
   return this.run(t,b,c=>this.host.extra.linkChannel(c,id,body),selection);
 }
 @Post("duplicates")
 duplicates(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Body()body:{email?:string|null;phone?:string|null;excludeId?:string|null}){
   return this.run(t,b,c=>this.host.extra.possibleDuplicates(c,body),selection);
 }
 @Post("imports/csv")
 imports(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined,
   @Body()body:{csv:string}){return this.run(t,b,c=>this.host.extra.importCsv(c,body?.csv),selection)}
 @Get("exports/csv")
 @Header("Content-Type","text/csv; charset=utf-8")
 @Header("Content-Disposition",'attachment; filename="syndes-contacts.csv"')
 exports(@Param("tenantId")t:string,@Headers("authorization")b:string|undefined,@SelectedScope()selection:RequestedOperationalScope|undefined){
   return this.run(t,b,c=>this.host.extra.exportCsv(c),selection);
 }
}
