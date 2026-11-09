/**
 * Disposable browser-homologation server.
 * Real Keycloak RS256/JWKS, OpenFGA REST, Nest HTTP and PostgreSQL.
 * NEVER invoke with production credentials, tenants or databases.
 */
import "reflect-metadata";
import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {NestFactory} from "@nestjs/core";
import {Global,Module} from "@nestjs/common";
import {CoreKernel} from "@syndes/core-kernel";
import {Pool} from "pg";
import {ActorVerifier,FgaPermission,PgMembership,fgaResourceObject} from "../dist/adapters.js";
import {loadInstalledPlugins} from "../dist/module-host.js";
const TENANT="11111111-1111-4111-8111-111111111111";
const OTHER="22222222-2222-4222-8222-222222222222";
const EMPLOYEE="33333333-3333-4333-8333-333333333333";
const AGENT="44444444-4444-4444-8444-444444444444";
const OUTSIDER="55555555-5555-4555-8555-555555555555";
const ACCOUNT="66666666-6666-4666-8666-666666666666";
const CONVERSATION="77777777-7777-4777-8777-777777777777";
const CRM="88888888-8888-4888-8888-888888888888";
const ORG="99999999-9999-4999-8999-999999999999";
const WORKSPACE="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const url=process.env.SYNDES_SUPPORT_E2E_PG_URL;
const issuer=process.env.SYNDES_SUPPORT_E2E_ISSUER;
const fga=process.env.SYNDES_SUPPORT_E2E_FGA_URL;
if(!url||!/\/syndes_support_e2e(?:\?|$)/.test(url)||
 !issuer?.startsWith("https://localhost:8443/realms/syndes-support-e2e")||
 fga!=="http://127.0.0.1:18080")
 throw new Error("Refusing non-disposable Support E2E environment");
const root=new URL("../../../",import.meta.url);
const read=(path)=>readFile(new URL(path,root),"utf8");
const migrations=[
 "modules/core-crm/sql/001_crm_foundation.sql",
 "modules/core-crm/sql/002_crm_tags_notes.sql",
 "modules/core-crm/sql/003_crm_employees_channels.sql",
 "modules/inbox/sql/001_inbox_foundation.sql",
 "modules/whatsapp/sql/001_whatsapp_accounts.sql",
 "modules/whatsapp/sql/002_whatsapp_inbound.sql",
 "modules/whatsapp/sql/003_whatsapp_outbound_inbox.sql",
 "modules/whatsapp/sql/004_whatsapp_conversation_phone.sql",
 "modules/whatsapp/sql/005_whatsapp_history.sql",
 "modules/whatsapp/sql/006_whatsapp_contact_names.sql",
 "modules/whatsapp/sql/007_whatsapp_delivery_receipts.sql",
 "modules/organizations/sql/001_account_hierarchy.sql",
 "modules/organizations/sql/002_legacy_single_context_gate.sql",
 "modules/organizations/sql/003_legacy_ownership.sql",
 "modules/organizations/sql/004_whatsapp_route_owner_guard.sql",
 "modules/organizations/sql/005_scoped_relationship_integrity.sql",
 "modules/organizations/sql/006_context_creation_audit.sql",
 "modules/support/sql/001_support_cases.sql",
];
const strip=sql=>sql.replace(/^\s*(?:BEGIN|COMMIT);\s*$/gim,"");
const pool=new Pool({connectionString:url,max:6,connectionTimeoutMillis:5000});
async function seed(){
 const c=await pool.connect();
 try{
  await c.query("SELECT 1");
  await c.query("BEGIN");
  for(const file of migrations)await c.query(strip(await read(file)));
  await c.query(`CREATE TABLE tenant_registry(tenant_id uuid PRIMARY KEY,state text NOT NULL);
    CREATE TABLE tenant_memberships(tenant_id uuid NOT NULL,principal_id text NOT NULL,state text NOT NULL,
      PRIMARY KEY(tenant_id,principal_id));`);
  await c.query("INSERT INTO tenant_registry(tenant_id,state) VALUES($1,'active'),($2,'active')",[TENANT,OTHER]);
  await c.query("INSERT INTO tenant_memberships(tenant_id,principal_id,state) VALUES($1,$2,'active'),($1,$3,'active')",
    [TENANT,EMPLOYEE,AGENT]);
  await c.query("INSERT INTO platform_organizations(tenant_id,id,display_name,is_default) VALUES($1,$2,'Syndes E2E',true)",[TENANT,ORG]);
  await c.query("INSERT INTO platform_workspaces(tenant_id,id,organization_id,name,slug,is_default) VALUES($1,$2,$3,'Syndes','syndes',true)",
    [TENANT,WORKSPACE,ORG]);
  for(const who of [AGENT,EMPLOYEE]){
   await c.query("INSERT INTO platform_org_memberships(tenant_id,organization_id,principal_id,role) VALUES($1,$2,$3,'editor')",
    [TENANT,ORG,who]);
   await c.query("INSERT INTO platform_workspace_memberships(tenant_id,organization_id,workspace_id,principal_id,role) VALUES($1,$2,$3,$4,'editor')",
    [TENANT,ORG,WORKSPACE,who]);
  }
  await c.query("INSERT INTO platform_legacy_backfill_runs(tenant_id,organization_id,actor_id,counts) VALUES($1,$2,$3,'{}'::jsonb)",
   [TENANT,ORG,AGENT]);
  await c.query("INSERT INTO support_queue_memberships(tenant_id,queue_code,principal_id,role,granted_by) VALUES($1,'it_infra',$2,'agent','ci-operator'),($1,'external_general',$2,'agent','ci-operator')",
   [TENANT,AGENT]);
  await c.query("INSERT INTO crm_people(tenant_id,id,name) VALUES($1,$2,'Synthetic prospect')",[TENANT,CRM]);
  await c.query("INSERT INTO whatsapp_accounts(tenant_id,id,display_name) VALUES($1,$2,'Syndes test number')",[TENANT,ACCOUNT]);
  await c.query("INSERT INTO inbox_conversations(tenant_id,id,subject,channel,crm_person_id,external_thread_id) VALUES($1,$2,'Prospect test via WhatsApp','whatsapp',$3,$4)",
   [TENANT,CONVERSATION,CRM,"synthetic-"+randomUUID()]);
  await c.query("INSERT INTO whatsapp_conversation_routes(tenant_id,conversation_id,account_id,recipient_external_id) VALUES($1,$2,$3,'e2e@jid')",
   [TENANT,CONVERSATION,ACCOUNT]);
  await c.query("COMMIT");
 }catch(e){await c.query("ROLLBACK");throw e;}finally{c.release();}
}
async function setupFga(){
 const request=async(path,body)=>{
  const result=await fetch(fga+path,{
   method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),
   signal:AbortSignal.timeout(10000)
  });
  if(!result.ok)throw new Error("E2E FGA setup "+path+" returned "+result.status+": "+(await result.text()).slice(0,500));
  return result.json();
 };
 const store=await request("/stores",{name:"syndes-support-e2e-"+randomUUID()});
 const model=JSON.parse(await read("infra/security-access/fga-model.json"));
 await request("/stores/"+store.id+"/authorization-models",model);
 const permissionTuples=[];
 const roles={
  [EMPLOYEE]:{"support:cases:internal":["viewer","editor"]},
  [AGENT]:{
   "support:cases:internal":["viewer","editor"],
   "support:cases:external":["viewer","editor"],
   "inbox:conversations":["viewer"],"crm:people":["viewer"]
  }
 };
 for(const [who,resources] of Object.entries(roles))
  for(const [resource,relations] of Object.entries(resources))
   for(const relation of relations)
    permissionTuples.push({user:"user:"+who,relation,object:fgaResourceObject(TENANT,resource)});
 await request("/stores/"+store.id+"/write",{writes:{tuple_keys:permissionTuples}});
 return store.id;
}
let app;
try{
 await seed();
 const store=await setupFga();
 const mods=await loadInstalledPlugins();
 const kernel=new CoreKernel({
  modules:[{id:"platform",version:"0.1.0"},...mods.map(p=>p.definition)],
  tenancy:new PgMembership(pool),
  authorization:new FgaPermission(fga,store,"test-only")
 });
 await kernel.start();
 const verifier=new ActorVerifier(issuer,"syndes-e2e-api",issuer+"/protocol/openid-connect/certs");
 process.env.SYNDES_SUPPORT_TENANT_ID=TENANT;
 process.env.SYNDES_SUPPORT_WHATSAPP_ACCOUNT_ID=ACCOUNT;
 delete process.env.SYNDES_MULTI_ORG_ENABLED;
 const provider={resolve:async tenantId=>({
  tenantId,query:async(sql,args)=>{
   const r=await pool.query(sql,args);
   return {rows:r.rows,rowCount:r.rowCount};
  }
 })};
 class HostPorts{}
 Global()(HostPorts);
 Module({providers:[
  {provide:"SYNDES_CORE_API",useValue:{kernel,verifier}},
  {provide:"SYNDES_TENANT_DB",useValue:provider},
 ],exports:["SYNDES_CORE_API","SYNDES_TENANT_DB"]})(HostPorts);
 class App{}
 const apiModules=mods.filter(p=>["support","inbox"].includes(p.definition.id)).map(p=>p.apiModule);
 if(apiModules.length!==2)throw new Error("Missing trusted Support/Inbox HTTP plugin");
 Module({imports:[HostPorts,...apiModules]})(App);
 app=await NestFactory.create(App,{logger:false});
 await app.listen(4180,"127.0.0.1");
 console.log("SYNDES_SUPPORT_BROWSER_E2E_READY");
}catch(e){console.error("Support disposable E2E setup failed:",e);await pool.end();process.exit(1);}
async function close(){
 await app?.close();await pool.end();
}
process.on("SIGINT",()=>{void close().then(()=>process.exit(0));});
process.on("SIGTERM",()=>{void close().then(()=>process.exit(0));});
