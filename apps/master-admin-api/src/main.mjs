import {createServer} from "node:http";
import {createMasterTokenVerifier} from "./auth.mjs";
import pg from "pg";
import {readFileSync} from "node:fs";
import {createHandler} from "./server.mjs";

function required(name){
 const value=process.env[name]?.trim();
 if(!value)throw Error("Missing "+name);
 return value;
}
const issuer=required("MASTER_KEYCLOAK_ISSUER").replace(/\/$/,"");
const audience=required("MASTER_KEYCLOAK_AUDIENCE");
const clientId=required("MASTER_KEYCLOAK_CLIENT_ID");
const jwksUrl=required("MASTER_KEYCLOAK_JWKS_URL");
const origin=required("MASTER_PUBLIC_ORIGIN");
const secretPath=required("MASTER_CONTROL_DB_URL_FILE");
if(!secretPath.startsWith("/run/secrets/"))throw Error("Master DB URL must be mounted as a secret");
const connectionString=readFileSync(secretPath,"utf8").trim();
if(!connectionString)throw Error("Empty Master database credentials");
if(!origin.startsWith("https://")||!new URL(jwksUrl).protocol.startsWith("http"))
 throw Error("Invalid master auth origin or JWKS URL");
const verify=createMasterTokenVerifier({issuer,audience,clientId,jwksUrl});
const pool=new pg.Pool({
 connectionString,max:4,connectionTimeoutMillis:3000,idleTimeoutMillis:10000,
 statement_timeout:5000,application_name:"syndes-master-admin",
 options:"-c default_transaction_read_only=on",
});
const port=Number(process.env.MASTER_PORT??8085);
if(!Number.isInteger(port)||port<1||port>65535)throw Error("Invalid API port");
async function start(){
 const checks=await pool.query(
  "SELECT current_database() AS db,current_user AS role, "+
  "r.rolsuper,r.rolcreatedb,r.rolcreaterole FROM pg_roles r WHERE r.rolname=current_user");
 const check=checks.rows[0];
 if(check?.db!=="syndes_control"||check?.role!=="syndes_master_api"||
    check?.rolsuper||check?.rolcreatedb||check?.rolcreaterole)
  throw Error("Dedicated read-only control-plane DB role required");
 const server=createServer(createHandler({verify,pool,publicOrigin:origin}));
 server.listen(port,"0.0.0.0",()=>console.log("Master Admin API ready on port",port));
 const shutdown=()=>{
  server.close(()=>pool.end().then(()=>process.exit(0)).catch(()=>process.exit(1)));
 };
 process.once("SIGINT",shutdown);process.once("SIGTERM",shutdown);
}
start().catch(async()=>{
 console.error("Master Admin API startup denied; verify Keycloak and isolated control DB credentials");
 await pool.end().catch(()=>{});
 process.exitCode=1;
});
