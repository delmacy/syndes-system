import test from "node:test";
import assert from "node:assert/strict";
import {ModuleRegistry} from "@syndes/core-kernel";
import {loadInstalledPlugins,installModuleAssets} from "../dist/module-host.js";

test("Core Host mounts CRM, Inbox and WhatsApp from installed package descriptors",async()=>{
  const plugins=await loadInstalledPlugins();
  assert.deepEqual(plugins.map(p=>p.definition.id),["crm","inbox","whatsapp"]);
  assert.equal(plugins[0].publicOidcClientId,"syndes-crm-ui");
  const order=new ModuleRegistry([{id:"platform",version:"0.1.0"},...plugins.map(p=>p.definition)])
    .ordered().map(x=>x.id);
  assert.deepEqual(order,["platform","crm","inbox","whatsapp"]);
  assert.deepEqual(plugins[0].migrations.map(x=>x.id),[
    "001_crm_foundation","002_crm_tags_notes","003_crm_employees_channels"
  ]);
  assert.ok(plugins[0].permissions.some(x=>x.resource==="crm:people"));
  assert.equal(plugins[1].definition.dependencies.includes("crm"),true);
  assert.ok(plugins[1].permissions.some(x=>x.resource==="inbox:conversations"));
  assert.equal(plugins[1].migrations[0].id,"001_inbox_foundation");
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
