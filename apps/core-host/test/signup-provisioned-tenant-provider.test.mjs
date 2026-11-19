import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {PgSignupProvisionedTenantProvider} from "../dist/signup-provisioned-tenant-provider.js";
const make=()=>({
 requestId:randomUUID(),founderId:randomUUID(),tenantId:randomUUID(),
 organizationId:randomUUID(),workspaceId:randomUUID(),
 accountName:"Co",organizationName:"Org",workspaceName:"Ws",
 keycloakAlias:"unused",keycloakOrganizationId:null,
 state:"reserved",revision:1,
});
test("UC-SIGNUP-01C operator provider fails closed on identity, state and untrusted database",async()=>{
 const i=make(),suffix=i.tenantId.replaceAll("-",""),name="syndes_tenant_"+suffix,
  role="syndes_t_"+suffix;
 let tenantState="provisioned",intentState="reserved",founderPresent=true,
  opened=0,queries=0;
 const control={query:async(sql,values)=>{
  assert.match(sql,/platform_signup_intents/);
  assert.deepEqual(values,[i.requestId,i.founderId,i.tenantId,i.organizationId,i.workspaceId]);
  return {rows:founderPresent?[{database_name:name,role_name:role,
   tenant_state:tenantState,intent_state:intentState}]:[]};
 }};
 const build=(dbName,dbRole)=>({
  rows:[],rowCount:1,
  query:async sql=>{
   queries++;
   if(sql.startsWith("SELECT current_database()"))return {
    rows:[{database_name:dbName,role_name:dbRole}]};
   return {rows:[{ok:1}],rowCount:1};
  },connect:async()=>({query:async sql=>{
   if(sql.startsWith("SELECT current_database()"))return{
    rows:[{database_name:dbName,role_name:dbRole}]};
   return {rows:[],rowCount:1};
  },release:()=>{}}),end:async()=>{},
 });
 const source={open:async(db,dbRole)=>{
  opened++;assert.equal(db,name);assert.equal(dbRole,role);return build(db,dbRole);
 }};
 const provider=new PgSignupProvisionedTenantProvider(i,control,source);
 await assert.rejects(provider.resolve(randomUUID()));
 assert.equal(opened,0);
 assert.equal((await (await provider.resolve(i.tenantId)).query("SELECT 1",[])).rows[0].ok,1);
 assert.equal(opened,1);
 tenantState="suspended";
 await assert.rejects(provider.resolve(i.tenantId));
 await assert.rejects((await provider.resolve(i.tenantId).catch(()=>null))?.query?.("SELECT 1",[])??Promise.reject(Error("denied")));
 tenantState="active";intentState="reserved";
 await assert.rejects(provider.resolve(i.tenantId));
 intentState="ready";
 assert.ok(await provider.resolve(i.tenantId));
 founderPresent=false;
 await assert.rejects(provider.resolve(i.tenantId));
 await provider.close();
 assert.ok(queries>0);
 const corrupt=new PgSignupProvisionedTenantProvider(i,control,{
  open:async()=>build("wrong_db",role),
 });
 founderPresent=true;
 await assert.rejects(corrupt.resolve(i.tenantId));
 await corrupt.close();
});
test("UC-SIGNUP-01C tenant provider pins SQL transaction, denies external COMMIT, rolls back errors",async()=>{
 const i=make(),suffix=i.tenantId.replaceAll("-",""),name="syndes_tenant_"+suffix,
  role="syndes_t_"+suffix;
 const calls=[];
 const control={query:async()=>({rows:[{database_name:name,role_name:role,
  tenant_state:"provisioned",intent_state:"reserved"}]})};
 const pool={query:async()=>({rows:[{database_name:name,role_name:role}]}),
  connect:async()=>({query:async(sql)=>{
   calls.push(sql);
   if(sql.startsWith("SELECT current_database"))return {
    rows:[{database_name:name,role_name:role}]};
   return {rows:[],rowCount:1};
  },release:()=>calls.push("RELEASED")}),
  end:async()=>{}};
 const provider=new PgSignupProvisionedTenantProvider(i,control,{open:async()=>pool});
 const done=await provider.withTransaction(i.tenantId,async tx=>{
  assert.equal(tx.tenantId,i.tenantId);
  await tx.query("SELECT 1",[]);
  await assert.rejects(tx.query("COMMIT",[]));
  return 7;
 });
 assert.equal(done,7);
 assert.deepEqual(calls.slice(-4),["BEGIN","SELECT 1","COMMIT","RELEASED"]);
 await assert.rejects(provider.withTransaction(i.tenantId,async tx=>{
  await tx.query("SELECT 2",[]);throw Error("synthetic business failure");
 }),/synthetic business failure/);
 assert.ok(calls.includes("ROLLBACK"));
 await assert.rejects(provider.withTransaction(randomUUID(),async()=>0));
 await provider.close();
});
