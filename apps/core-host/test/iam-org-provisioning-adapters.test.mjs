import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID} from "node:crypto";
import {KeycloakOrganizationWriter} from "../dist/iam-org-provisioning-adapters.js";

const A=randomUUID(),K=randomUUID();
const alias="syndes-"+randomUUID().replaceAll("-","")+"-"+randomUUID().replaceAll("-","");
const name="Second Company";
test("Keycloak Organization writer recovers known alias and adds only specified Keycloak user UUID",async()=>{
 let created=false,member=false,posts=0;
 const requests=[];
 const send=async(url,init)=>{
  const parsed=new URL(url),path=parsed.pathname,method=init.method;
  if(method==="GET"&&path.endsWith("/organizations")){
   assert.equal(parsed.searchParams.get("search"),name);
   assert.equal(parsed.searchParams.get("exact"),"true");
   assert.equal(parsed.searchParams.get("briefRepresentation"),"false");
  }
  requests.push([method,path,init.body??null]);
  if(method==="GET"&&path.endsWith("/organizations"))
   return Response.json(created?[{id:K,alias,name,enabled:true}]:[],{status:200});
  if(method==="POST"&&path.endsWith("/organizations")){
   posts++;assert.deepEqual(JSON.parse(init.body),{name,alias,enabled:true});
   created=true;return new Response(null,{status:201});
  }
  if(method==="POST"&&path.endsWith("/members")){
   assert.equal(JSON.parse(init.body),A);
   member=true;return new Response(null,{status:201});
  }
  if(method==="GET"&&path.endsWith("/members/"+A))
   return Response.json({id:A,enabled:member},{status:member?200:404});
  throw Error("Unexpected provider call "+path);
 };
 const writer=new KeycloakOrganizationWriter("https://keycloak.test","syndes",
  {getToken:async()=> "header.payload.signature"},send);
 assert.equal(await writer.ensureOrganization(alias,name),K);
 assert.equal(await writer.ensureOrganization(alias,name),K);
 assert.equal(posts,1);
 await writer.ensureMember(K,A);
 assert.equal(await writer.isActiveMember(K,A),true);
 assert.equal(requests.filter(x=>x[0]==="POST"&&x[1].endsWith("/members")).length,1);
});
test("Keycloak alias collision and missing membership fail closed",async()=>{
 const disabled=async(url,init)=>{
  const path=new URL(url).pathname;
  if(init.method==="GET"&&path.endsWith("/organizations"))
   return Response.json([{id:K,alias,name:"Wrong org",enabled:true}]);
  throw Error("Unexpected network write");
 };
 const wrong=new KeycloakOrganizationWriter("https://keycloak.test","syndes",
  {getToken:async()=> "header.payload.signature"},disabled);
 await assert.rejects(wrong.ensureOrganization(alias,name));
 const unavailable=new KeycloakOrganizationWriter("https://keycloak.test","syndes",
  {getToken:async()=> "header.payload.signature"},
  async()=>new Response(null,{status:503}));
 await assert.rejects(unavailable.ensureOrganization(alias,name));
 await assert.rejects(unavailable.ensureMember(K,A));
});
