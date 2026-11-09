import {readFileSync} from "node:fs";
import {Pool} from "pg";
import {createTokenVerifier,createFgaWriteAuthorizer} from "./auth.mjs";
import {createAccountAccessServer} from "./server.mjs";

function need(name){
 const v=process.env[name];
 if(typeof v!=="string"||!v.trim())throw Error("Missing "+name);
 return v.trim();
}
function credentialFromFile(){
 const path=need("ACCOUNT_DB_URL_FILE");
 if(!path.startsWith("/run/secrets/"))throw Error("DB secret must be mounted under /run/secrets");
 const value=readFileSync(path,"utf8").trim();
 const url=new URL(value);
 if(!["postgres:","postgresql:"].includes(url.protocol)||url.username!=="syndes_account_api"||
    url.pathname!=="/syndes_control"||url.password.length<24)
  throw Error("Dedicated account API SQL role and Control DB required");
 return value;
}
async function main(){
 const db=new Pool({connectionString:credentialFromFile(),max:4,
  connectionTimeoutMillis:3000,idleTimeoutMillis:10000});
 const verifyBearer=createTokenVerifier({
  issuer:need("ACCOUNT_OIDC_ISSUER"),audience:need("ACCOUNT_OIDC_AUDIENCE"),
  clientId:need("ACCOUNT_OIDC_CLIENT_ID"),jwksUrl:need("ACCOUNT_OIDC_JWKS_URL"),
 });
 const canManageAccountRoles=createFgaWriteAuthorizer({
  endpoint:need("ACCOUNT_OPENFGA_URL"),store:need("ACCOUNT_OPENFGA_STORE_ID"),
  token:readFileSync(need("ACCOUNT_OPENFGA_TOKEN_FILE"),"utf8").trim(),
 });
 const server=createAccountAccessServer({
  verifyBearer,canManageAccountRoles,
  ready:async()=>{
   const r=await db.query("SELECT 1 FROM pg_proc WHERE proname='apply_tenant_account_delegation' AND pronamespace='public'::regnamespace");
   if(r.rowCount!==1)throw Error("Delegation routine unavailable");
  },
  delegate:async q=>{
   const r=await db.query(
    "SELECT role,state,already_applied FROM apply_tenant_account_delegation($1::uuid,$2::text,$3::text,$4::text,$5::text,$6::uuid)",
    [q.tenantId,q.actorId,q.targetId,q.operation,q.role,q.requestId],
   );
   if(r.rowCount!==1)throw Error("Unexpected account delegation result");
   return {role:r.rows[0].role,state:r.rows[0].state,
    alreadyApplied:r.rows[0].already_applied};
  },
  allowedOrigin:need("ACCOUNT_ALLOWED_ORIGIN"),
 });
 const port=Number(process.env.ACCOUNT_PORT??"8086");
 if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid API port");
 // Default to loopback. A separately reviewed private ingress may set
 // ACCOUNT_BIND_HOST=0.0.0.0 after securing Docker networking.
 const host=process.env.ACCOUNT_BIND_HOST??"127.0.0.1";
 if(!["127.0.0.1","0.0.0.0"].includes(host))throw Error("Invalid bind host");
 server.listen(port,host,()=>process.stdout.write("Account access API started (no secrets logged)\n"));
 const close=()=>server.close(()=>db.end());
 process.once("SIGINT",close);process.once("SIGTERM",close);
}
main().catch(()=>{process.stderr.write("Account access API startup denied\n");process.exitCode=1});
