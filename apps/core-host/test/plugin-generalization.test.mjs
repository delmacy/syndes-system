import test from "node:test";
import assert from "node:assert/strict";
import {ModuleRegistry,defineSyndesModule} from "@syndes/core-kernel";
import {installModuleAssets} from "../dist/module-host.js";

test("a second business module is mountable without any CRM or Core Host route changes",async()=>{
 class ExampleApiModule {}
 const second=defineSyndesModule({
   definition:{id:"scheduling",version:"0.1.0",dependencies:["platform"]},
   apiModule:ExampleApiModule,
   permissions:[{resource:"scheduling:appointments",actions:["read","write"]}],
   migrations:[{id:"001_initial",fileUrl:"file:///approved-module/sql/001_initial.sql"}],
   assets:[{route:"/scheduling",fileUrl:new URL("../config/modules.json",import.meta.url).href,contentType:"application/json"}],
 });
 const order=new ModuleRegistry([
   {id:"platform",version:"0.1.0"},second.definition
 ]).ordered().map(m=>m.id);
 assert.deepEqual(order,["platform","scheduling"]);
 let middleware;
 installModuleAssets({use:fn=>middleware=fn},[second]);
 const result=await new Promise(resolve=>{
   const res={statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v},end(value){resolve({status:this.statusCode,body:value})}};
   middleware({method:"GET",originalUrl:"/scheduling"},res,()=>resolve({next:true}));
 });
 assert.equal(result.status,200);
 assert.match(String(result.body),/core-crm\/plugin/);
});
test("module descriptor rejects duplicate assets and unsafe migration paths",()=>{
 class ExampleApiModule {}
 const module={definition:{id:"docs",version:"0.1.0"},apiModule:ExampleApiModule,permissions:[],migrations:[],
   assets:[{route:"/docs",fileUrl:"file:///tmp/docs",contentType:"text/html"},
           {route:"/docs",fileUrl:"file:///tmp/dup",contentType:"text/html"}]};
 assert.throws(()=>defineSyndesModule(module),/Duplicate asset/);
 assert.throws(()=>defineSyndesModule({...module,assets:[],migrations:[{id:"../secrets",fileUrl:"file:///tmp/hidden"}]}),/Invalid module migration/);
});
