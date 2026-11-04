import { chromium } from "playwright";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, resolve, sep } from "node:path";

const root = resolve(new URL("../dist", import.meta.url).pathname);
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2" };
const tenant = "00000000-0000-4000-8000-000000000001";
const personalId = "11111111-1111-4111-8111-111111111111";
const groupId = "22222222-2222-4222-8222-222222222222";
const person = { id:personalId, subject:"Maria WhatsApp", displayName:null, phoneNumber:"+5551999999999", isGroup:false, channel:"whatsapp", status:"open", assignedTo:null, handoff:"human", updatedAt:"2026-11-03T10:00:00Z" };
const group = { id:groupId, subject:"Equipe WhatsApp", displayName:"Equipe WhatsApp", isGroup:true, channel:"whatsapp", status:"open", assignedTo:null, handoff:"human", updatedAt:"2026-11-03T10:00:00Z" };
const token = ["header", Buffer.from(JSON.stringify({sub:"agent-1"})).toString("base64url"), "sig"].join(".");
const server=createServer(async(req,res)=>{
  const pathname=decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  const file=resolve(root,"."+ (pathname === "/" ? "/index.html" : pathname));
  if(!file.startsWith(root+sep) && file !== root){res.writeHead(403).end();return;}
  try {const bytes=await readFile(file);res.writeHead(200,{"Content-Type":mime[extname(file)]??"application/octet-stream"});res.end(bytes);}
  catch {try{res.writeHead(200,{"Content-Type":"text/html"});res.end(await readFile(join(root,"index.html")));}catch{res.writeHead(404).end();}}
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const origin="http://127.0.0.1:"+server.address().port;
const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  const uncaught=[];page.on("pageerror",error=>uncaught.push(error.message));
  await page.addInitScript(()=>sessionStorage.setItem("syndes.workspace.pkce",JSON.stringify({verifier:"fixture",state:"fixture",created:Date.now()})));
  await page.route("**/workspace-runtime.json",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({issuer:"https://idp.fixture.invalid/realms/syndes",clientId:"syndes-workspace-ui",tenantId:tenant,tenantLabel:"Lab"})}));
  await page.route("https://idp.fixture.invalid/**",route=>route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({access_token:token})}));
  let unavailable=false;
  let groupDetails={jid:"120363012345678901@g.us",name:"Equipe WhatsApp",
    description:"Descrição antiga",participantCount:7,canEdit:true,locked:false,announce:false};
  await page.route("**/v1/tenants/**",route=>{
    const url=new URL(route.request().url());
    if(!url.pathname.startsWith("/v1/tenants/"+tenant+"/"))return route.fulfill({status:403,body:"Forbidden"});
    if(unavailable)return route.fulfill({status:503,contentType:"application/json",body:JSON.stringify({message:"Serviço temporariamente indisponível"})});
    const path=url.pathname.split("/"+tenant)[1];
    let response=[];
    if(path==="/whatsapp/conversations/"+personalId+"/avatar"){
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({
        available:true,imageData:"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg=="
      })});
    }
    if(path==="/whatsapp/conversations/"+groupId+"/avatar"){
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify({available:false})});
    }
    if(path==="/whatsapp/conversations/"+groupId+"/group"){
      if(route.request().method()==="PATCH"){
        const change=route.request().postDataJSON();
        groupDetails={...groupDetails,...change};
      }
      return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(groupDetails)});
    }
    if(path === "/inbox/conversations"){
      const scope=url.searchParams.get("scope");
      response=scope==="groups"?[group]:[person,group];
    } else if(path==="/inbox/conversations/"+personalId)response=person;
    else if(path==="/inbox/conversations/"+groupId)response=group;
    else if(path?.endsWith("/messages")){
      if(path.includes(personalId)){
        response=Array.from({length:45},(_,i)=>({
         id:"sample-"+i,body:i===44?"Mensagem real sincronizada":"Histórico de teste "+i+" — ".repeat(7),
         direction:i%3===0?"outbound":"inbound",
         deliveryStatus:i===0?"sent":i===3?"delivered":i===6?"read":"synced",
         createdAt:new Date(Date.UTC(2026,10,3,10,i)).toISOString(),
        }));
      }else response=[{id:"g-1",body:"Mensagem real sincronizada",direction:"inbound",createdAt:"2026-11-03T10:00:00Z"}];
    }
    else if(path==="/inbox/metrics")response={open:2,pending:0,resolved:0,unassigned:2};
    return route.fulfill({status:200,contentType:"application/json",body:JSON.stringify(response)});
  });
  await page.goto(origin+"/?code=fixture&state=fixture#inbox");
  try {await page.getByRole("button",{name:/Maria WhatsApp/}).waitFor({timeout:6000});} catch(e){console.log("DEBUG",(await page.locator("body").innerText()).slice(0,1800),"JS",uncaught);throw e;}
  assert.equal(await page.locator("#syndes-inbox-sidebar").isVisible(),true,"Desktop queue must occupy the global sidebar");
  const sidebar=page.locator("#syndes-inbox-sidebar");
  const bar=sidebar.getByLabel("Filtros de conversas");
  await bar.waitFor();
  const bounds=await Promise.all([bar.boundingBox(),bar.locator("button").first().boundingBox(),bar.locator("button").last().boundingBox()]);
  assert.ok(bounds.every(Boolean),"Icon filter toolbar and controls must be visible");
  assert.equal(await bar.locator("button").count(),11,"All filters share one compact toolbar");
  assert.ok(bounds[2].x+bounds[2].width<=bounds[0].x+bounds[0].width+2,"Filter icons cannot overflow sidebar");
  await sidebar.getByRole("group",{name:"Filtrar conversas por responsável"}).getByRole("button",{name:"Minhas"}).click();
  assert.equal(await sidebar.getByRole("button",{name:"Minhas"}).getAttribute("aria-pressed"),"true");
  await sidebar.getByRole("group",{name:"Filtrar conversas por responsável"}).getByRole("button",{name:"Todas as atribuições"}).click();
  await sidebar.getByRole("group",{name:"Filtrar conversas por status"}).getByRole("button",{name:"Abertas"}).click();
  assert.equal(await sidebar.getByRole("button",{name:"Abertas"}).getAttribute("aria-pressed"),"true");
  await sidebar.getByRole("group",{name:"Filtrar conversas por status"}).getByRole("button",{name:"Todos os estados"}).click();
  console.log("PASS compact icon toolbar, accessible labels, states and no horizontal overflow");
  await sidebar.locator('[data-avatar-for="'+personalId+'"] img').waitFor({timeout:7000});
  assert.ok((await sidebar.locator('[data-avatar-for="'+personalId+'"] img').getAttribute("src"))?.startsWith("data:image/png;base64,"),"Contact avatar must be fetched through authorized conversation route");
  console.log("PASS WhatsApp contact avatar rendered in sidebar");
  assert.equal(await page.getByRole("button",{name:/Equipe WhatsApp/}).count(),0,"Groups must not leak into phone tab");
  await page.getByRole("button",{name:/Maria WhatsApp/}).click();
  await page.getByText("Mensagem real sincronizada").waitFor();
  const viewport=page.getByLabel("Histórico de mensagens");
  await page.waitForFunction(()=>{const el=document.querySelector('[data-scroll-pane="messages"]');return el&&el.scrollHeight>el.clientHeight*2});
  const atBottom=()=>viewport.evaluate(el=>el.scrollHeight-el.scrollTop-el.clientHeight);
  assert.ok(await atBottom()<3,"Opening a conversation must start at its latest message");
  assert.equal(await viewport.getByRole("status",{name:"Enviada pelo WhatsApp"}).count(),1,"Sent is not delivered");
  assert.equal(await viewport.getByRole("status",{name:"Entregue"}).count(),1,"Delivery receipt shows dual gray check");
  assert.equal(await viewport.getByRole("status",{name:"Lida"}).count(),1,"Read receipt shows dual blue check");
  console.log("PASS latest-first scroll and provider-confirmed double-check icons");
  await page.getByRole("button",{name:/Grupos/}).click();
  await page.getByRole("button",{name:/Equipe WhatsApp/}).waitFor();
  await sidebar.locator('[data-avatar-for="'+groupId+'"]').waitFor();
  assert.equal(await sidebar.locator('[data-avatar-for="'+groupId+'"] img').count(),0,
   "Group without public avatar must show an icon rather than a broken image");
  console.log("PASS WhatsApp group avatar fallback without exposure of private URL");
  assert.equal(await page.getByRole("button",{name:/Maria WhatsApp/}).count(),0,"Phone must not leak into groups tab");
  console.log("PASS desktop sidebar and separate WhatsApp phones/groups with sender names and history");
  await page.getByRole("button",{name:/Equipe WhatsApp/}).click();
  await page.getByRole("button",{name:"Informações do grupo WhatsApp"}).click();
  await page.getByText("7 participantes").waitFor();
  await page.getByLabel("Nome do grupo").fill("Equipe atualizada");
  await page.getByRole("button",{name:"Salvar",exact:true}).click();
  await page.getByText("Estado confirmado pelo WhatsApp.").waitFor();
  await page.getByLabel("Descrição").fill("Nova descrição");
  await page.getByRole("button",{name:"Atualizar descrição no WhatsApp"}).click();
  await page.getByText("Estado confirmado pelo WhatsApp.").waitFor();
  assert.equal(groupDetails.name,"Equipe atualizada");
  assert.equal(groupDetails.description,"Nova descrição");
  await page.getByRole("button",{name:"Fechar",exact:true}).click();
  console.log("PASS group canonical details and confirmed WhatsApp name/description updates");
  unavailable=true;
  await page.getByRole("button",{name:"Atualizar fila"}).click();
  await page.getByRole("alert").filter({hasText:"Falha ao atualizar a fila"}).waitFor();
  assert.equal(await page.getByRole("button",{name:/Equipe atualizada/}).count(),1,"Transient API failure must not silently erase cached conversations");
  assert.deepEqual(uncaught,[],"No uncaught JS errors");
  console.log("PASS backend outage is visible without erasing the last list");
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
