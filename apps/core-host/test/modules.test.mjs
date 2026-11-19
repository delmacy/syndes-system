import test from "node:test";
import assert from "node:assert/strict";
import {ModuleRegistry} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets,serviceStagingOptIn} from "../dist/module-host.js";

test("Core Host mounts CRM, Inbox, WhatsApp, Organizations and Support from trusted descriptors",async()=>{
  const plugins=await loadInstalledPlugins();
  assert.deepEqual(plugins.map(p=>p.definition.id),["crm","inbox","whatsapp","organizations","support"]);
  assert.equal(plugins[0].publicOidcClientId,"syndes-crm-ui");
  const order=new ModuleRegistry([{id:"platform",version:"0.1.0"},...plugins.map(p=>p.definition)])
    .ordered().map(x=>x.id);
  assert.deepEqual(order,["platform","crm","inbox","organizations","whatsapp","support"]);
  assert.deepEqual(plugins[0].migrations.map(x=>x.id),[
    "001_crm_foundation","002_crm_tags_notes","003_crm_employees_channels"
  ]);
  assert.ok(plugins[0].permissions.some(x=>x.resource==="crm:people"));
  assert.equal(plugins[1].definition.dependencies.includes("crm"),true);
  assert.ok(plugins[1].permissions.some(x=>x.resource==="inbox:conversations"));
  assert.equal(plugins[1].migrations[0].id,"001_inbox_foundation");
  assert.equal(plugins[3].definition.id,"organizations");
  assert.equal(plugins[3].migrations[0].id,"001_account_hierarchy");
  assert.ok(plugins[3].permissions.some(x=>x.resource==="organizations:bootstrap"));

});

test("generic asset middleware responds only to exact declared routes",async()=>{
 const plugins=await loadInstalledPlugins();
 let middleware;
 installModuleAssets({use:fn=>{middleware=fn}},plugins);
 async function request(url,method="GET"){
   return await new Promise((resolve,reject)=>{
     const res={statusCode:200,headers:{},body:"",
       setHeader(k,v){this.headers[k]=v},
       end(data){this.body=data??"";resolve(this)},
     };
     middleware({method,originalUrl:url},res,err=>
       err?reject(err):resolve({next:true}));
   });
 }
 const page=await request("/crm");
 assert.equal(page.statusCode,200);
 assert.match(page.headers["Content-Type"],/html/);
 assert.match(String(page.body),/lang="pt-BR"/);
 assert.match(page.headers["Content-Security-Policy"],/default-src 'none'/);
 const script=await request("/crm/app.js");
 assert.match(String(script.body),/code_challenge_method:"S256"/);
 assert.equal((await request("/crm/private.txt")).next,true);
 assert.equal((await request("/crm/app.js/../whatever")).next,true);
 assert.equal((await request("/crm", "POST")).statusCode,405);
});

test("Service optional plugin refuses every non-staging or unenforced configuration",async()=>{
 const valid={
  SYNDES_SERVICE_STAGING_OPT_IN:"true",SYNDES_DEPLOYMENT_ENV:"staging",
  SYNDES_MULTI_ORG_ENABLED:"true",SYNDES_CRM_MODULE_GATE:"enforce",
  SYNDES_INBOX_MODULE_GATE:"enforce",
 };
 assert.equal(serviceStagingOptIn(valid),true);
 assert.equal(serviceStagingOptIn({...valid,SYNDES_SERVICE_STAGING_OPT_IN:undefined}),false);
 assert.equal(serviceStagingOptIn({...valid,SYNDES_SERVICE_STAGING_OPT_IN:"false"}),false);
 for(const change of [
  {SYNDES_DEPLOYMENT_ENV:"production"},
  {SYNDES_MULTI_ORG_ENABLED:"false"},
  {SYNDES_CRM_MODULE_GATE:"legacy"},
  {SYNDES_INBOX_MODULE_GATE:"legacy"},
  {SYNDES_SERVICE_STAGING_OPT_IN:"maybe"},
 ]){
  assert.throws(()=>serviceStagingOptIn({...valid,...change}),/staging/);
 }
 // Exercise the actual installed @syndes/service/plugin and ModuleRegistry.
 const names=Object.keys(valid);
 const before=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{
  for(const [k,v] of Object.entries(valid))process.env[k]=v;
  const plugins=await loadInstalledPlugins();
  assert.deepEqual(plugins.map(p=>p.definition.id),
   ["crm","inbox","whatsapp","organizations","support","service"]);
  assert.equal(plugins.at(-1).definition.version,"0.3.0");
  assert.equal(plugins.at(-1).migrations.length,3);
  assert.ok(plugins.at(-1).definition.dependencies.includes("inbox"));
 }finally{
  for(const [k,v] of Object.entries(before)){
   if(v===undefined)delete process.env[k];else process.env[k]=v;
  }
 }
});
