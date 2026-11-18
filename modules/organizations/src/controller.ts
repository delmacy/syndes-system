import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Param,Post} from "@nestjs/common";
import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {OrganizationService,OrgInputError,OrgTenantMismatchError,validUUID,type OrgContext} from "./service.js";

type HostApi={
 readonly kernel:CoreKernel;
 readonly verifier:{verify(bearer:string|undefined):Promise<Actor>};
 readonly organizationAccess?:{
  requireActive(tenantId:string,organizationId:string,principalId:string):Promise<void>;
 };
};
@Injectable()
export class OrganizationHost{
  readonly service:OrganizationService;
  constructor(
    @Inject("SYNDES_CORE_API") private readonly core:HostApi,
    @Inject("SYNDES_TENANT_DB") db:TrustedTenantDatabaseProvider,
  ){this.service=new OrganizationService(core.kernel,db);}
  async requireLiveOrganization(ctx:OrgContext,organizationId:string):Promise<void>{
    if(!validUUID(organizationId))throw new AccessDeniedError();
    if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")return;
    if(!this.core.organizationAccess)throw new AccessDeniedError();
    await this.core.organizationAccess.requireActive(
      ctx.tenantId,organizationId,ctx.actor.id);
  }
  async visibleOrganizations(ctx:OrgContext):Promise<readonly Record<string,unknown>[]>{
    const rows=await this.service.listOrganizations(ctx);
    if(process.env.SYNDES_MULTI_ORG_ENABLED!=="true")return rows;
    if(!this.core.organizationAccess)throw new AccessDeniedError();
    const visible:Record<string,unknown>[]=[];
    for(const row of rows){
      if(!validUUID(row.id))throw new AccessDeniedError();
      try{
        await this.requireLiveOrganization(ctx,row.id);
        visible.push(row);
      }catch(error){
        // The tenant SQL membership is not a Keycloak Organizations grant.
        // A revoked/absent link must never be returned in the directory.
        if(error instanceof AccessDeniedError)continue;
        throw error;
      }
    }
    return visible;
  }
  async run<T>(tenantId:string,bearer:string|undefined,handler:(ctx:OrgContext)=>Promise<T>):Promise<T>{
    if(!validUUID(tenantId))throw new HttpException("Invalid tenant",400);
    let actor:Actor;
    try{actor=await this.core.verifier.verify(bearer);}
    catch{throw new HttpException("Authentication required",401);}
    try{return await handler({tenantId,actor});}
    catch(error){
      if(error instanceof HttpException)throw error;
      if(error instanceof OrgInputError)throw new HttpException(error.message,400);
      if(error instanceof AccessDeniedError)throw new HttpException("Forbidden",403);
      if(error instanceof OrgTenantMismatchError)throw new HttpException("Tenant database unavailable",503);
      if(typeof error==="object"&&error!==null&&"code" in error&&error.code==="23505")
        throw new HttpException("Organization or workspace already exists",409);
      // Includes FGA, PostgreSQL and OpenBao faults; never grant access on errors.
      throw new HttpException("Organization service unavailable",503);
    }
  }
}
@Controller("v1/tenants/:tenantId/platform")
export class OrganizationController{
  constructor(private readonly host:OrganizationHost){}
  @Post("bootstrap")
  bootstrap(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined,
    @Body()body:unknown){
    return this.host.run(id,auth,ctx=>{
      // First-context provisioning must be a reconciled Keycloak/Control saga.
      // A legacy bootstrap would create a SQL Organization without its
      // immutable Keycloak Organization link.
      if(process.env.SYNDES_MULTI_ORG_ENABLED==="true")throw new AccessDeniedError();
      return this.host.service.bootstrap(ctx,body);
    });
  }
  @Post("default-context/backfill")
  backfill(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,async ctx=>{
      if(process.env.SYNDES_MULTI_ORG_ENABLED==="true")throw new AccessDeniedError();
      const result=await this.host.service.backfillDefaultOwnership(ctx);
      if(!result)throw new HttpException("Default context admin required",403);
      return {bound:result};
    });
  }
  @Post("organizations")
  createOrganization(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined,
    @Body()body:unknown){
    return this.host.run(id,auth,async ctx=>{
      // The direct SQL-only route cannot bind a new Keycloak Organization;
      // it is disabled until operator saga + idempotent Control link exist.
      if(process.env.SYNDES_MULTI_ORG_ENABLED==="true")throw new AccessDeniedError();
      const created=await this.host.service.createOrganization(ctx,body);
      if(!created)throw new HttpException("Tenant administrator required",403);
      return created;
    });
  }
  @Post("organizations/:organizationId/workspaces")
  createWorkspace(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined,@Body()body:unknown){
    return this.host.run(id,auth,async ctx=>{
      await this.host.requireLiveOrganization(ctx,org);
      const created=await this.host.service.createWorkspace(ctx,org,body);
      if(!created)throw new HttpException("Organization admin required",403);
      return created;
    });
  }
  @Get("organizations")
  organizations(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,ctx=>this.host.visibleOrganizations(ctx));
  }
  @Get("organizations/:organizationId/workspaces")
  workspaces(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,async ctx=>{
      await this.host.requireLiveOrganization(ctx,org);
      return this.host.service.listWorkspaces(ctx,org);
    });
  }
  @Get("organizations/:organizationId/units")
  units(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,async ctx=>{
      await this.host.requireLiveOrganization(ctx,org);
      return this.host.service.listUnits(ctx,org);
    });
  }
  @Post("organizations/:organizationId/units")
  unit(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined,@Body()body:unknown){
    return this.host.run(id,auth,async ctx=>{
      await this.host.requireLiveOrganization(ctx,org);
      const created=await this.host.service.createUnit(ctx,org,body);
      if(!created)throw new HttpException("Not found",404);
      return created;
    });
  }
}
