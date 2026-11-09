import {Body,Controller,Get,Headers,HttpException,Inject,Injectable,Param,Post} from "@nestjs/common";
import {AccessDeniedError,type Actor,type CoreKernel,type TrustedTenantDatabaseProvider} from "@syndes/core-kernel";
import {OrganizationService,OrgInputError,OrgTenantMismatchError,validUUID,type OrgContext} from "./service.js";

type HostApi={readonly kernel:CoreKernel;readonly verifier:{verify(bearer:string|undefined):Promise<Actor>}};
@Injectable()
export class OrganizationHost{
  readonly service:OrganizationService;
  constructor(
    @Inject("SYNDES_CORE_API") private readonly core:HostApi,
    @Inject("SYNDES_TENANT_DB") db:TrustedTenantDatabaseProvider,
  ){this.service=new OrganizationService(core.kernel,db);}
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
      // Includes FGA, PostgreSQL and OpenBao faults; never grant access on errors.
      throw new HttpException("Organization service unavailable",503);
    }
  }
}
@Controller("v1/tenants/:tenantId/platform")
export class OrganizationController{
  constructor(private readonly host:OrganizationHost){}
  @Post("bootstrap")
  bootstrap(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,ctx=>this.host.service.bootstrap(ctx));
  }
  @Get("organizations")
  organizations(@Param("tenantId")id:string,@Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,ctx=>this.host.service.listOrganizations(ctx));
  }
  @Get("organizations/:organizationId/workspaces")
  workspaces(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,ctx=>this.host.service.listWorkspaces(ctx,org));
  }
  @Get("organizations/:organizationId/units")
  units(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined){
    return this.host.run(id,auth,ctx=>this.host.service.listUnits(ctx,org));
  }
  @Post("organizations/:organizationId/units")
  unit(@Param("tenantId")id:string,@Param("organizationId")org:string,
    @Headers("authorization")auth:string|undefined,@Body()body:unknown){
    return this.host.run(id,auth,async ctx=>{
      const created=await this.host.service.createUnit(ctx,org,body);
      if(!created)throw new HttpException("Not found",404);
      return created;
    });
  }
}
