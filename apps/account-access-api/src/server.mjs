import {createServer} from "node:http";

const TENANT_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PRINCIPAL=/^[^\u0000-\u001f\u007f]{1,256}$/;
const PREFIX="/v1/accounts/";
const SUFFIX="/access/delegations";
const BODY_KEYS=["operation","principalId","role"];

function json(res,status,data,origin){
 const headers={"content-type":"application/json; charset=utf-8",
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "referrer-policy":"no-referrer","vary":"Origin"};
 if(origin)headers["access-control-allow-origin"]=origin;
 res.writeHead(status,headers);
 res.end(JSON.stringify(data));
}
async function bodyObject(req){
 const len=Number(req.headers["content-length"]);
 if(Number.isFinite(len)&&len>2048)throw Object.assign(Error("Too large"),{status:413});
 let n=0,content="";
 for await(const chunk of req){
  n+=chunk.length;
  if(n>2048)throw Object.assign(Error("Too large"),{status:413});
  content+=chunk.toString("utf8");
 }
 let obj;
 try{obj=JSON.parse(content);}catch{throw Object.assign(Error("Invalid JSON"),{status:400});}
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||Object.keys(obj).sort().join(",")!==BODY_KEYS.slice().sort().join(","))
  throw Object.assign(Error("Unexpected JSON shape"),{status:400});
 if(!PRINCIPAL.test(obj.principalId)||!["grant","revoke"].includes(obj.operation)||
    !["owner","admin"].includes(obj.role))
  throw Object.assign(Error("Invalid account role mutation"),{status:400});
 return obj;
}
/** No general proxy or tenant data access. Endpoint deliberately has no UI. */
export function createAccountAccessServer({
 verifyBearer,canManageAccountRoles,delegate,ready,allowedOrigin
}){
 if(!verifyBearer||!canManageAccountRoles||!delegate||!ready||
    !allowedOrigin?.startsWith("https://"))
  throw Error("Missing account access dependencies");
 const http=createServer(async(req,res)=>{
  if(req.method==="GET"&&req.url==="/healthz"){
   json(res,200,{status:"ok"});return;
  }
  if(req.method==="GET"&&req.url==="/readyz"){
   try{await ready();json(res,200,{status:"ready"});}
   catch{json(res,503,{error:"Unavailable"});}
   return;
  }
  if(req.method!=="POST"||!req.url?.startsWith(PREFIX)||
     !req.url.endsWith(SUFFIX)||req.url.includes("?")){
   json(res,404,{error:"Not found"});return;
  }
  const tenantId=req.url.slice(PREFIX.length,-SUFFIX.length);
  if(!TENANT_UUID.test(tenantId)){
   json(res,404,{error:"Not found"});return;
  }
  if(req.headers.origin!==allowedOrigin){
   json(res,403,{error:"Forbidden"});return;
  }
  if(!req.headers["content-type"]?.toLowerCase().startsWith("application/json")||
     !TENANT_UUID.test(req.headers["idempotency-key"]??"")){
   json(res,400,{error:"Invalid request"});return;
  }
  // Authentication occurs before any DB/FGA call, even body parsing.
  let actor;
  try{actor=await verifyBearer(req.headers.authorization);}
  catch{json(res,401,{error:"Unauthorized"},allowedOrigin);return;}
  let input;
  try{input=await bodyObject(req);}
  catch(e){json(res,e?.status===413?413:400,{error:"Invalid request"},allowedOrigin);return;}
  let granted;
  try{granted=await canManageAccountRoles(actor,tenantId);}
  catch{json(res,503,{error:"Authorization unavailable"},allowedOrigin);return;}
  if(!granted){json(res,403,{error:"Forbidden"},allowedOrigin);return;}
  try{
   const result=await delegate({
    actorId:actor.id,tenantId,targetId:input.principalId,
    operation:input.operation,role:input.role,
    requestId:req.headers["idempotency-key"],
   });
   json(res,200,{role:result.role,state:result.state,
    alreadyApplied:result.alreadyApplied===true},allowedOrigin);
  }catch(e){
   const status=e?.code==="23505"||e?.code==="23514"?409:
    e?.code==="42501"?403:e?.code==="22023"?400:503;
   json(res,status,{error:status===503?"Unavailable":status===409?"Conflict":
    status===403?"Forbidden":"Invalid request"},allowedOrigin);
  }
 });
 http.requestTimeout=8000;
 http.headersTimeout=10000;
 http.keepAliveTimeout=3000;
 return http;
}
