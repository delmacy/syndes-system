/**
 * Visual-only preview adapter. This contains solely invented, explicitly
 * labeled records. It never reads Keycloak, Control DB, tenant DB or network.
 * Enabled only in a dedicated VITE_DEMO_PREVIEW=true build, behind a static
 * Nginx server whose /v1/* routes are disabled.
 */
import {MasterApi,type Operator,type Overview,type Tenant,type TenantPage} from "./api";

export const exampleTenants:readonly Tenant[]=Object.freeze([
 {id:"11111111-1111-4111-8111-111111111111",displayName:"Empresa Alfa [DEMONSTRAÇÃO]",
  status:"active",createdAt:"2026-09-20T12:00:00.000Z",activeMembers:5},
 {id:"22222222-2222-4222-8222-222222222222",displayName:"Empresa Beta [DEMONSTRAÇÃO]",
  status:"provisioned",createdAt:"2026-10-14T12:00:00.000Z",activeMembers:0},
 {id:"33333333-3333-4333-8333-333333333333",displayName:"Empresa Gama [DEMONSTRAÇÃO]",
  status:"active",createdAt:"2026-11-01T12:00:00.000Z",activeMembers:3},
]);

const viewer:Operator=Object.freeze({
 role:"viewer",
 capabilities:{viewTenants:true,manageTenants:false,viewCustomerData:false}
});

const statistics:Overview=Object.freeze({
 total:3,active:2,provisioned:1,suspended:0,memberships:8
});

/** Same read-only UI contract, but no bearer token and no HTTP calls. */
export class DemoMasterApi extends MasterApi {
 constructor(){super("VISUAL_DEMO_NO_BEARER");}
 override async me(_signal?:AbortSignal):Promise<Operator>{return viewer;}
 override async overview(_signal?:AbortSignal):Promise<Overview>{return statistics;}
 override async tenants(
  params:{query:string;state:string;page:number},_signal?:AbortSignal
 ):Promise<TenantPage>{
  const term=(params.query??"").trim().toLocaleLowerCase("pt-BR");
  const filtered=exampleTenants.filter(item=>
   (params.state==="all"||item.status===params.state)&&
   (!term||item.displayName?.toLocaleLowerCase("pt-BR").includes(term)||
      item.id.toLowerCase().includes(term))
  );
  const page=Number.isSafeInteger(params.page)?Math.max(1,params.page):1;
  return {total:filtered.length,page,pageSize:25,
   items:filtered.slice((page-1)*25,page*25)};
 }
 override async tenant(id:string,_signal?:AbortSignal):Promise<Tenant>{
  const found=exampleTenants.find(item=>item.id===id);
  if(!found)throw Error("Registro de demonstração inexistente.");
  return found;
 }
}
