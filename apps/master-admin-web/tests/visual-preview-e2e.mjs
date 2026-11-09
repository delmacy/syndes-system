import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {chromium} from "playwright";

const root=fileURLToPath(new URL("../",import.meta.url));
const vite=fileURLToPath(new URL("../node_modules/vite/bin/vite.js",import.meta.url));
const port=4188;
const url="http://127.0.0.1:"+port;
const server=spawn(process.execPath,[vite,"preview","--host","127.0.0.1",
 "--port",String(port),"--strictPort"],{cwd:root,stdio:"ignore",windowsHide:true});
let browser;
try{
 let up=false;
 for(let i=0;i<60;i++){
  try{up=(await fetch(url)).ok;}catch{}
  if(up)break;
  await new Promise(r=>setTimeout(r,200));
 }
 assert.equal(up,true,"Vite preview started");
 try{browser=await chromium.launch({headless:true});}
 catch{browser=await chromium.launch({headless:true,channel:"chrome"});}
 const context=await browser.newContext({viewport:{width:1440,height:900}});
 const network=[];
 const page=await context.newPage();
 page.on("request",r=>{if(/\/v1\/|\/realms\/|\/protocol\/openid-connect\//.test(r.url()))network.push(r.url());});
 await page.goto(url);
 await page.getByTestId("visual-preview-banner").waitFor();
 await page.getByRole("heading",{name:"Visão geral da plataforma"}).waitFor();
 assert.equal(await page.getByRole("button",{name:/Entrar com Keycloak/}).count(),0,
  "Visual preview must not require a login");
 assert.equal(await page.getByRole("navigation").getByRole("button").count(),2,
  "No invented menu entries");
 await page.getByText("Empresa Alfa [DEMONSTRAÇÃO]").first().waitFor();
 await mkdir(fileURLToPath(new URL("../test-results/",import.meta.url)),{recursive:true});
 await page.screenshot({path:fileURLToPath(new URL("../test-results/platform-manager-visual-preview.png",import.meta.url)),fullPage:true});
 await page.getByRole("navigation").getByRole("button",{name:"Clientes"}).click();
 await page.getByRole("heading",{name:"Clientes da plataforma"}).waitFor();
 await page.getByLabel("Pesquisar clientes").fill("Beta");
 await page.getByText("Empresa Beta [DEMONSTRAÇÃO]").waitFor();
 await page.getByText("Empresa Alfa [DEMONSTRAÇÃO]").waitFor({state:"detached",timeout:5000});
 await page.getByLabel("Filtrar status").selectOption("active");
 await page.getByText("Nenhum cliente encontrado").waitFor();
 await page.getByLabel("Pesquisar clientes").fill("");
 await page.getByText("Empresa Alfa [DEMONSTRAÇÃO]").waitFor();
 await page.getByText("Empresa Beta [DEMONSTRAÇÃO]").waitFor({state:"detached",timeout:5000});
 await page.getByLabel("Detalhes do cliente 11111111-1111-4111-8111-111111111111").click();
 await page.getByRole("dialog",{name:"Detalhes do cliente"}).waitFor();
 await page.getByRole("button",{name:"Fechar detalhes"}).click();
 assert.deepEqual(network,[],"Preview must not call protected APIs or OIDC");
 console.log("VISUAL PREVIEW E2E PASS: no login, current navigation, demonstration banner, search, filtering, details and zero protected requests");
 await context.close();
}finally{
 await browser?.close().catch(()=>{});
 server.kill();
}
