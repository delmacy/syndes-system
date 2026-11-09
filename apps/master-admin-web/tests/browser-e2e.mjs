// Browser E2E against the compiled frontend with explicit test-only HTTP fixtures.
// Not evidence of a deployed Keycloak, Control DB or operational tenant data.
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=fileURLToPath(new URL("../",import.meta.url));
const vite=fileURLToPath(new URL("../node_modules/vite/bin/vite.js",import.meta.url));
const address="http://127.0.0.1:4179";
const issuer="https://id.example.test/realms/syndes";
const tenantId="11111111-1111-4111-8111-111111111111";
const row={id:tenantId,displayName:"Empresa Alfa [FIXTURE]",status:"active",
 createdAt:"2026-11-09T12:00:00.000Z",activeMembers:3};
const preview=spawn(process.execPath,[vite,"preview","--host","127.0.0.1","--port","4179","--strictPort"],{
 cwd:root,windowsHide:true,stdio:["ignore","pipe","pipe"]
});
let stderr="";
preview.stderr.on("data",data=>{stderr+=data.toString()});
async function untilReady(){
 for(let i=0;i<80;i++){
  if(preview.exitCode!==null)throw Error("Vite preview exited: "+stderr);
  try{const res=await fetch(address);if(res.ok)return;}catch{}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 throw Error("Vite preview not responding: "+stderr);
}
let browser;
try{
 await untilReady();
 try{browser=await chromium.launch({headless:true});}
 catch{browser=await chromium.launch({headless:true,channel:"chrome"});}
 const calls=[];
 async function fixtureContext({deny=false}={}){
  const ctx=await browser.newContext();
  await ctx.route("**/master-runtime.json",route=>route.fulfill({
   status:200,contentType:"application/json",body:JSON.stringify({issuer,clientId:"syndes-master-admin"})
  }));
  await ctx.route("https://id.example.test/**",async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith("/auth")){
    const state=u.searchParams.get("state");
    assert.ok(state,"PKCE state must exist");
    assert.equal(u.searchParams.get("code_challenge_method"),"S256");
    await route.fulfill({status:302,headers:{location:address+"/?code=fixture-code&state="+encodeURIComponent(state)}});
   }else if(u.pathname.endsWith("/token")){
    assert.match(route.request().postData()??"",/code_verifier=/);
    await route.fulfill({status:200,headers:{"access-control-allow-origin":"*","content-type":"application/json"},
     body:JSON.stringify({access_token:"fixture-only-token"})});
   }else await route.fulfill({status:404,body:"No fixture"});
  });
  await ctx.route("**/v1/platform/admin/**",route=>{
   const u=new URL(route.request().url()),path=u.pathname;
   assert.equal(route.request().headers().authorization,"Bearer fixture-only-token");
   calls.push(u.pathname+u.search);
   let body,status=200;
   if(path.endsWith("/me")){if(deny){status=403;body={error:"Platform operator required"}}
    else body={role:"viewer",capabilities:{viewTenants:true,manageTenants:false,viewCustomerData:false}};}
   else if(path.endsWith("/summary"))body={total:1,active:1,provisioned:0,suspended:0,memberships:3};
   else if(path.endsWith("/tenants")) {
    const validState=["all","active"].includes(u.searchParams.get("state"));
    const validQuery=["","Alfa"].includes(u.searchParams.get("query"));
    body={total:validState&&validQuery?1:0,page:Number(u.searchParams.get("page")??1),
     pageSize:25,items:validState&&validQuery?[row]:[]};
   }else if(path.endsWith("/tenants/"+tenantId))body={...row,activeMembers:4};
   else {status=404;body={error:"Not found"};}
   return route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  });
  return ctx;
 }
 const context=await fixtureContext();
 const page=await context.newPage();
 await page.goto(address);
 await page.getByRole("button",{name:/Entrar com Keycloak/}).waitFor();
 await mkdir(fileURLToPath(new URL("../test-results/",import.meta.url)),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL("../test-results/platform-manager-login-FIXTURE.png",import.meta.url))});
 await page.getByRole("button",{name:/Entrar com Keycloak/}).click();
 await page.getByRole("heading",{name:"Visão geral da plataforma"}).waitFor({timeout:10000});
 await page.getByText("Empresa Alfa [FIXTURE]").first().waitFor();
 assert.equal(await page.getByRole("navigation").getByRole("button").count(),2);
 assert.equal(await page.getByText("Assinaturas").count(),0);
 await page.screenshot({path:fileURLToPath(new URL("../test-results/platform-manager-overview-FIXTURE.png",import.meta.url))});
 await page.getByRole("navigation").getByRole("button",{name:"Clientes"}).click();
 await page.getByLabel("Pesquisar clientes").fill("outro");
 await page.getByText("Nenhum cliente encontrado").waitFor();
 await page.getByLabel("Pesquisar clientes").fill("Alfa");
 await page.getByText("Empresa Alfa [FIXTURE]").waitFor();
 await page.getByLabel("Detalhes do cliente "+tenantId).click();
 await page.getByRole("dialog",{name:"Detalhes do cliente"}).waitFor();
 await page.getByRole("dialog").getByText("4",{exact:true}).waitFor();
 assert.ok(calls.some(path=>path.endsWith("/tenants/"+tenantId)),"Details must use dedicated endpoint");
 await page.getByRole("button",{name:"Fechar detalhes"}).click();
 await page.getByRole("button",{name:"Sair"}).click();
 await page.getByRole("button",{name:/Entrar com Keycloak/}).waitFor();
 assert.equal(await page.getByText("Empresa Alfa [FIXTURE]").count(),0);
 await context.close();

 const denied=await fixtureContext({deny:true});
 const unauthorized=await denied.newPage();
 await unauthorized.goto(address);
 await unauthorized.getByRole("button",{name:/Entrar com Keycloak/}).click();
 await unauthorized.getByRole("alert").waitFor({timeout:10000});
 assert.equal(await unauthorized.getByRole("navigation").count(),0,"Denied user cannot see console");
 await denied.close();
 console.log("Browser E2E: PKCE, overview, filtering, fresh details, logout and forbidden operator — PASS (FIXTURES)");
}finally{
 await browser?.close().catch(()=>{});
 preview.kill();
}
