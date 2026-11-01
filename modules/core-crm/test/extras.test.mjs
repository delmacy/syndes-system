import test from "node:test";
import assert from "node:assert/strict";
import {CoreKernel,AccessDeniedError} from "@syndes/core-kernel";
import {CrmExtras,CrmValidationError,parseContactsCsv,contactsToCsv,PgCrmExtrasFactory} from "../dist/index.js";

const A="4ab44379-d557-4df6-a2be-d44e121a8077";
const B="d21930aa-f4f6-40c0-bb1a-e71d7bb92caa";
const ctx={actor:{id:"alice",kind:"user"},tenantId:A};

test("RFC4180 CSV supports quoted line breaks and blocks malformed and oversized inputs",()=>{
 const csv='name,email,phone\r\n"Nome, Com Vírgula",NOME@example.com,51999990000\r\n"Nome com ""Aspas""",,\r\n';
 const rows=parseContactsCsv(csv);
 assert.equal(rows.length,2);
 assert.equal(rows[0].name,"Nome, Com Vírgula");
 assert.equal(rows[0].email,"nome@example.com");
 assert.equal(rows[1].name,'Nome com "Aspas"');
 assert.throws(()=>parseContactsCsv("name,email,phone\n\"unclosed,email,phone"),CrmValidationError);
 assert.throws(()=>parseContactsCsv("name,email,phone\nA,foo,123"),CrmValidationError);
 assert.throws(()=>parseContactsCsv("phone,name,email\nfoo,bar,baz"),CrmValidationError);
 assert.throws(()=>parseContactsCsv("name,email,phone\nA,a@example.com,\nB,a@example.com,"),CrmValidationError);
 assert.throws(()=>parseContactsCsv("x".repeat(1024*1024+1)),CrmValidationError);
 assert.throws(()=>parseContactsCsv("name,email,phone\n"+"A,,\n".repeat(501)),CrmValidationError);
});
test("CSV exports do not allow formula injection",()=>{
 const value=contactsToCsv([
   {id:"1",tenantId:A,name:"=HYPERLINK(\"evil\")",email:null,phone:null,archivedAt:null},
   {id:"2",tenantId:A,name:"-SUM(1,2)",email:null,phone:null,archivedAt:null},
 ]);
 assert.match(value,/"'=HYPERLINK/);
 assert.match(value,/'"'-SUM/);
 assert.ok(value.startsWith("name,email,phone\r\n"));
});
test("CRM extras always enforce authorization before database selection",async()=>{
 let selected=0;
 const kernel=new CoreKernel({
   modules:[{id:"platform",version:"0.1.0"},{id:"crm",version:"0.1.0",dependencies:["platform"]}],
   tenancy:{canAccessTenant:async({actor,tenantId})=>actor.id==="alice"&&tenantId===A},
   authorization:{canAccess:async({action})=>action==="read"},
 });
 await kernel.start();
 const svc=new CrmExtras(kernel,async()=>{
   selected++;
   return {duplicates:async()=>[],listOrganizations:async()=>[]};
 });
 await assert.rejects(svc.createEmployee(ctx,"9b3df87e-ec6c-46f5-9339-3a6851da0119","Technician"),AccessDeniedError);
 await assert.rejects(svc.possibleDuplicates({...ctx,tenantId:B},{email:"a@example.com"}),AccessDeniedError);
 assert.equal(selected,0);
 assert.deepEqual(await svc.possibleDuplicates(ctx,{email:"A@example.com"}),[]);
 assert.equal(selected,1);
});
test("repository factory refuses a tenant database with a mismatched identity",async()=>{
 const factory=new PgCrmExtrasFactory({resolve:async()=>({
   tenantId:B,query:async()=>({rows:[],rowCount:0}),
 })});
 await assert.rejects(factory.forTenant(A),/mismatch/i);
});
