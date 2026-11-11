import {readTenantModuleInventory} from "./modules/tenant-module-inventory.mjs";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const states=new Set(["all","active","provisioned","suspended"]);
const roles=new Set(["owner","operator","viewer"]);
function reply(res,status,value){
 res.writeHead(status,{
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store, private",
  "X-Content-Type-Options":"nosniff",
  "Referrer-Policy":"no-referrer",
  "X-Frame-Options":"DENY",
  "Content-Security-Policy":"default-src 'none'"
 });
 res.end(JSON.stringify(value));
}
const failure=(res,status,message)=>reply(res,status,{error:message});
function tenant(row){
 return {
  id:String(row.tenant_id),
  displayName:row.display_name??null,
  status:String(row.state),
  createdAt:new Date(row.created_at).toISOString(),
  activeMembers:Number(row.active_members??0),
 };
}
/** Standalone control-plane HTTP handler.
 * No tenant DB provider, no WhatsApp gateway client, no CRM repository,
 * no user impersonation and no data modification routes.
 */
export function createHandler({verify,pool,publicOrigin}){
 if(typeof verify!=="function"||typeof pool?.query!=="function"||
    typeof publicOrigin!=="string")throw Error("Invalid master API dependencies");
 return async(req,res)=>{
  try{
   if(req.url==="/healthz"&&req.method==="GET")
    return reply(res,200,{status:"ok"});
   if(req.url==="/readyz"&&req.method==="GET"){
    try{
     // Check all four metadata-table grants; LIMIT 0 never reads personal data.
     await pool.query("SELECT 1 FROM tenant_registry,tenant_memberships,platform_operator_access,platform_tenant_profiles LIMIT 0");
     return reply(res,200,{status:"ready"});
    }catch{return failure(res,503,"Control plane unavailable");}
   }
   // No CORS. Origin check is only defense in depth: the signed token and
   // database role/permissions enforce the actual security boundary.
   if(req.headers.origin&&req.headers.origin!==publicOrigin)
    return failure(res,403,"Origin not allowed");
   const uri=new URL(req.url??"/","http://master-internal");
   const pathname=uri.pathname;
   const base="/v1/platform/admin";
   const modulePath=new RegExp("^"+base+"/tenants/([0-9a-z-]+)/modules$","i").exec(pathname);
   const allowed=pathname===base+"/me"||pathname===base+"/summary"||
     pathname===base+"/tenants"||modulePath!==null||
     new RegExp("^"+base+"/tenants/[0-9a-z-]+$","i").test(pathname);
   if(!allowed||req.method!=="GET")return failure(res,404,"Not found");

   let principal;
   try{principal=await verify(req.headers.authorization);}
   catch{return failure(res,401,"Unauthorized");}
   let granted;
   try{
    const result=await pool.query(
      "SELECT role FROM platform_operator_access WHERE principal_id=$1 AND state='active' LIMIT 1",
      [principal]);
    granted=result.rows[0]?.role;
   }catch{return failure(res,503,"Control plane unavailable");}
   if(!roles.has(granted))return failure(res,403,"Platform operator required");

   if(pathname===base+"/me")return reply(res,200,{
    role:granted,capabilities:{viewTenants:true,manageTenants:false,viewCustomerData:false},
   });

   if(pathname===base+"/summary"){
    try{
     const r=await pool.query("SELECT count(*)::int AS total,"+
       " count(*) FILTER(WHERE state='active')::int AS active,"+
       " count(*) FILTER(WHERE state='provisioned')::int AS provisioned,"+
       " count(*) FILTER(WHERE state='suspended')::int AS suspended,"+
       " (SELECT count(*)::int FROM tenant_memberships WHERE state='active') AS memberships"+
       " FROM tenant_registry");
     const row=r.rows[0]??{};
     return reply(res,200,Object.fromEntries(
      ["total","active","provisioned","suspended","memberships"].map(k=>[k,Number(row[k]??0)])
     ));
    }catch{return failure(res,503,"Control plane unavailable");}
   }

   if(pathname===base+"/tenants"){
    const searchParams=uri.searchParams;
    if(["query","state","page"].some(k=>searchParams.getAll(k).length>1)||
       [...searchParams.keys()].some(k=>!["query","state","page"].includes(k)))
      return failure(res,400,"Invalid query parameters");
    const search=(searchParams.get("query")??"").trim();
    const state=searchParams.get("state")??"all";
    const pageText=searchParams.get("page")??"1";
    const page=Number(pageText);
    if(search.length>80||/[\u0000-\u001f]/.test(search)||!states.has(state)||
       !/^[1-9]\d{0,3}$/.test(pageText)||!Number.isSafeInteger(page))
      return failure(res,400,"Invalid query");
    const filter="FROM tenant_registry t LEFT JOIN platform_tenant_profiles p"+
      " ON p.tenant_id=t.tenant_id"+
      " WHERE ($1='' OR t.tenant_id::text ILIKE '%'||$1||'%'"+
      " OR p.display_name ILIKE '%'||$1||'%')"+
      " AND ($2='all' OR t.state=$2)";
    try{
     const [count,rows]=await Promise.all([
      pool.query("SELECT count(*)::int AS total "+filter,[search,state]),
      pool.query("SELECT t.tenant_id::text,t.state,t.created_at,p.display_name,"+
       " (SELECT count(*)::int FROM tenant_memberships m"+
       " WHERE m.tenant_id=t.tenant_id AND m.state='active') AS active_members "+
       filter+" ORDER BY t.created_at DESC,t.tenant_id ASC LIMIT 25 OFFSET $3",
       [search,state,(page-1)*25])
     ]);
     return reply(res,200,{total:Number(count.rows[0]?.total??0),page,
      pageSize:25,items:rows.rows.map(tenant)});
    }catch{return failure(res,503,"Control plane unavailable");}
   }
   if(modulePath){
    const tenantId=modulePath[1];
    if(!UUID.test(tenantId)||uri.search)return failure(res,400,"Invalid tenant identifier");
    try{
     const inventory=await readTenantModuleInventory(pool,tenantId);
     return inventory?reply(res,200,inventory):failure(res,404,"Tenant not found");
    }catch{return failure(res,503,"Module inventory unavailable");}
   }
   const id=pathname.slice((base+"/tenants/").length);
   if(!UUID.test(id))return failure(res,400,"Invalid tenant identifier");
   try{
    const r=await pool.query("SELECT t.tenant_id::text,t.state,t.created_at,p.display_name,"+
     " (SELECT count(*)::int FROM tenant_memberships m"+
     " WHERE m.tenant_id=t.tenant_id AND m.state='active') AS active_members"+
     " FROM tenant_registry t LEFT JOIN platform_tenant_profiles p"+
     " ON p.tenant_id=t.tenant_id"+
     " WHERE t.tenant_id=$1::uuid LIMIT 1",[id]);
    if(!r.rows[0])return failure(res,404,"Tenant not found");
    return reply(res,200,tenant(r.rows[0]));
   }catch{return failure(res,503,"Control plane unavailable");}
  }catch{return failure(res,500,"Internal error");}
 };
}
