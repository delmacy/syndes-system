export type Operator={role:"owner"|"operator"|"viewer";capabilities:{
 viewTenants:boolean;manageTenants:boolean;viewCustomerData:boolean
}};
export type Overview={total:number;active:number;provisioned:number;suspended:number;memberships:number};
export type Tenant={id:string;displayName:string|null;status:"active"|"provisioned"|"suspended";
 createdAt:string;activeMembers:number};
export type TenantPage={total:number;page:number;pageSize:number;items:Tenant[]};
export type TenantModule={
 moduleId:string;approvedVersions:string[];
 entitlementState:"granted"|"suspended"|"revoked"|null;
 entitled:boolean;validUntil:string|null;
 installationState:"requested"|"installed"|"enabled"|"suspended"|"retired"|null;
 targetVersion:string|null;installedVersion:string|null;verifiedAt:string|null;
};
export type TenantModuleInventory={
 tenantId:string;tenantStatus:"active"|"provisioned"|"suspended";items:TenantModule[];
};
export class ApiError extends Error{constructor(message:string,readonly status:number){super(message);}}
export class MasterApi{
 constructor(private readonly token:string){}
 private async get<T>(path:string,signal?:AbortSignal):Promise<T>{
  const response=await fetch("/v1/platform/admin"+path,{
   headers:{Authorization:"Bearer "+this.token,Accept:"application/json"},
   cache:"no-store",signal
  });
  if(response.status===401)throw new ApiError("Sua sessão expirou. Entre novamente.",401);
  if(response.status===403)throw new ApiError("Esta conta não possui acesso à administração da plataforma.",403);
  if(!response.ok)throw new ApiError("Não foi possível consultar o Control Plane.",response.status);
  return response.json() as Promise<T>;
 }
 me(signal?:AbortSignal){return this.get<Operator>("/me",signal);}
 overview(signal?:AbortSignal){return this.get<Overview>("/summary",signal);}
 tenants(params:{query:string;state:string;page:number},signal?:AbortSignal){
  const url=new URLSearchParams({query:params.query,state:params.state,page:String(params.page)});
  return this.get<TenantPage>("/tenants?"+url,signal);
 }
 tenant(id:string,signal?:AbortSignal){
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new ApiError("Identificador inválido",400);
  return this.get<Tenant>("/tenants/"+encodeURIComponent(id),signal);
 }
 tenantModules(id:string,signal?:AbortSignal){
  if(!/^[0-9a-f-]{36}$/i.test(id))throw new ApiError("Identificador inválido",400);
  return this.get<TenantModuleInventory>("/tenants/"+encodeURIComponent(id)+"/modules",signal);
 }
}
