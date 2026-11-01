import assert from "node:assert/strict";
import { chromium } from "playwright";

const tenant="4ab44379-d557-4df6-a2be-d44e121a8077";
const personId="33333333-3333-4333-8333-333333333333";
const orgId="44444444-4444-4444-8444-444444444444";
const token=["head",Buffer.from(JSON.stringify({sub:"employee"})).toString("base64url"),"sig"].join(".");
const allowed=Object.fromEntries(["people.read","people.write","organizations.read","organizations.write","relationships.write","tags.read","tags.write","notes.read","notes.write","employees.read","employees.write","channels.read","channels.write"].map(x=>[x,true]));
async function setup(page,limited=false){
 let people=[{id:personId,name:"Ana Exemplo",email:"ana@exemplo.com",phone:"+5551999999999"}];
 let orgs=[{id:orgId,legalName:"Empresa Exemplo Ltda",tradeName:"Empresa Exemplo",taxId:null}];
 let notes=[],tags=[],links=[],channels=[],employees=[];
 const reply=(route,obj,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(obj)});
 await page.addInitScript(()=>sessionStorage.setItem("syndes.workspace.pkce",JSON.stringify({state:"valid",verifier:"secret",created:Date.now()})));
 await page.route("**/workspace-runtime.json",r=>reply(r,{issuer:"https://idp.fixture.invalid/realms/syndes",clientId:"syndes-workspace-ui",tenantId:tenant,tenantLabel:"Demo"}));
 await page.route("https://idp.fixture.invalid/**",r=>reply(r,{access_token:token}));
 await page.route("**/v1/tenants/**",async r=>{
   const req=r.request(),url=new URL(req.url()),method=req.method(),body=()=>req.postDataJSON();
   if(!url.pathname.startsWith("/v1/tenants/"+tenant+"/"))return reply(r,{message:"Forbidden"},403);
   const path=url.pathname.split("/crm/")[1];if(!path)return reply(r,[]);
   if(path==="capabilities")return reply(r,limited?{"people.read":true,"organizations.read":true}:allowed);
   if(limited&&method!=="GET")return reply(r,{message:"Forbidden"},403);
   if(path==="people"&&method==="GET")return reply(r,people);
   if(path==="organizations"&&method==="GET")return reply(r,orgs);
   if(path==="people"&&method==="POST"){const p={id:crypto.randomUUID(),...body()};people.push(p);return reply(r,p,201);}
   if(path==="organizations"&&method==="POST"){const o={id:crypto.randomUUID(),...body()};orgs.push(o);return reply(r,o,201);}
   if(path==="people/"+personId&&method==="PATCH"){people[0]={...people[0],...body()};return reply(r,people[0]);}
   if(path==="people/"+personId&&method==="DELETE"){people=[];return reply(r,true);}
   if(path==="people/"+personId+"/organizations"&&method==="GET")return reply(r,links);
   if(path==="people/"+personId+"/organizations"&&method==="POST"){links=orgs;return reply(r,{personId,organizationId:body().organizationId});}
   if(path==="people/"+personId+"/organizations/"+orgId&&method==="DELETE"){links=[];return reply(r,true);}
   if(path==="people/"+personId+"/tags"&&method==="GET")return reply(r,tags);
   if(path==="tags"&&method==="GET")return reply(r,[{id:"tag-id",label:"Importante"}]);
   if(path==="people/"+personId+"/tags/tag-id"&&method==="DELETE"){tags=[];return reply(r,true);}
   if(path==="tags"&&method==="POST")return reply(r,{id:"tag-id",label:body().label});
   if(path==="people/"+personId+"/tags"&&method==="POST"){tags=[{id:"tag-id",label:"Importante"}];return reply(r,{ok:true});}
   if(path==="people/"+personId+"/notes"&&method==="GET")return reply(r,notes);
   if(path==="people/"+personId+"/notes"&&method==="POST"){notes.push({id:crypto.randomUUID(),body:body().body,createdAt:new Date().toISOString()});return reply(r,notes.at(-1),201);}
   if(path==="people/"+personId+"/timeline")return reply(r,[]);
   if(path==="people/"+personId+"/channels"&&method==="GET")return reply(r,channels);
   if(path==="people/"+personId+"/channels"&&method==="POST"){channels.push({id:crypto.randomUUID(),...body()});return reply(r,channels.at(-1),201);}
   if(path==="people/"+personId+"/employee"&&method==="GET")return reply(r,employees.find(x=>x.personId===personId)||null);
   if(path==="employees"&&method==="GET")return reply(r,employees);
   if(path==="people/"+personId+"/employee"&&method==="POST"){employees.push({id:crypto.randomUUID(),personId,jobTitle:body().jobTitle,active:true});return reply(r,employees.at(-1),201);}
   if(path==="duplicates"&&method==="POST")return reply(r,[]);
   if(path==="imports/csv"&&method==="POST")return reply(r,{imported:1});
   if(path==="exports/csv"&&method==="GET")return r.fulfill({status:200,contentType:"text/csv",body:"name,email,phone\n"});
   return reply(r,{message:"Unexpected "+path+" "+method},404);
 });
 await page.goto("http://127.0.0.1:4185/?code=abc&state=valid",{waitUntil:"domcontentloaded"});
 await page.getByRole("heading",{name:/Bem-vindo ao/}).waitFor();
 await page.evaluate(()=>window.location.hash="crm");
 await page.getByRole("heading",{name:"CRM",exact:true}).waitFor();
 await page.getByRole("button",{name:/Ana Exemplo/}).waitFor();
}

const browser=await chromium.launch({executablePath:"/usr/bin/google-chrome",headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]});
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await setup(page);
 await page.getByRole("button",{name:/Ana Exemplo/}).click();
 await page.getByRole("button",{name:"Editar",exact:true}).click();
 await page.getByRole("dialog").getByLabel("Nome do cadastro").fill("Ana Atualizada");
 await page.getByRole("dialog").getByRole("button",{name:"Salvar cadastro"}).click();
 await page.getByText("Ana Atualizada").first().waitFor();
 console.log("PASS: CRM person update");
 await page.getByLabel("Selecionar organização").selectOption(orgId);
 await page.getByRole("region",{name:"Organizações vinculadas"}).getByRole("button",{name:"Vincular"}).click();
 await page.getByText("Empresa Exemplo",{exact:true}).waitFor();
 await page.getByLabel("Escrever nota CRM").fill("Nota de teste");
 await page.getByRole("button",{name:"Registrar nota"}).click();
 await page.getByText("Nota de teste").waitFor();
 await page.getByLabel("Nova tag").fill("Importante");
 await page.getByRole("button",{name:"Adicionar",exact:true}).click();
 await page.getByText("Importante").waitFor();
 console.log("PASS: relationships, notes and tags");
 await page.getByRole("button",{name:"Desvincular organização Empresa Exemplo Ltda"}).click();
 await page.getByText("Nenhuma empresa vinculada.").waitFor();
 await page.getByRole("button",{name:"Desvincular tag Importante"}).click();
 await page.getByText("Nenhuma tag vinculada.").waitFor();
 await page.getByLabel("Selecionar tag existente").selectOption("tag-id");
 await page.getByRole("region",{name:"Tags do contato"}).getByRole("button",{name:"Vincular"}).click();
 await page.getByText("Importante").waitFor();
 console.log("PASS: relationship/tag unlink, existing tag reuse");
 await page.getByLabel("ID externo do canal").fill("5511988889999");
 await page.getByRole("button",{name:"Vincular canal"}).click();
 await page.getByText("5511988889999").waitFor();
 await page.getByLabel("Cargo do funcionário").fill("Atendente");
 await page.getByRole("button",{name:"Registrar",exact:true}).click();
 await page.getByText(/Atendente — Ativo/).waitFor();
 console.log("PASS: channel and employee");
 await page.getByRole("button",{name:"Arquivar",exact:true}).click();
 await page.getByRole("dialog").getByRole("button",{name:"Confirmar arquivamento"}).click();
 await page.getByRole("button",{name:/Ana Atualizada/}).waitFor({state:"detached"});
 console.log("PASS: archive confirmation");
 await page.getByRole("button",{name:"Novo contato"}).click();
 await page.getByRole("dialog").getByLabel("Nome do cadastro").fill("Contato de Teste");
 await page.getByRole("dialog").getByLabel("Contato principal").fill("novo@exemplo.com");
 await page.getByRole("dialog").getByRole("button",{name:"Salvar cadastro"}).click();
 await page.getByRole("heading",{name:"Contato de Teste"}).waitFor();
 await page.locator('[data-slot="sheet-close"]').click();
 console.log("PASS: create new contact");
 await page.getByRole("button",{name:"Importar CSV"}).click();
 await page.getByLabel("Selecionar CSV").setInputFiles({name:"contatos.csv",mimeType:"text/csv",buffer:Buffer.from("name,email,phone\nCliente Teste,cliente@exemplo.com,51999999999\n")});
 await page.getByRole("dialog").getByRole("button",{name:"Confirmar importação"}).click();
 await page.getByText("1 contatos importados.").waitFor();
 console.log("PASS: CSV import UI");
 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await setup(mobile,true);
 await mobile.getByRole("button",{name:/Ana Exemplo/}).click();
 await mobile.getByRole("heading",{name:"Ana Exemplo"}).waitFor();
 const width=await mobile.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
 assert.ok(width.document<=width.viewport+4, "CRM mobile must not overflow horizontally");
 console.log("PASS: mobile CRM detail and no horizontal overflow");
 assert.deepEqual(errors,[]);
 const limited=await browser.newPage();await setup(limited,true);
 assert.equal(await limited.getByRole("button",{name:"Novo contato"}).count(),0);
 await limited.getByRole("button",{name:/Ana Exemplo/}).click();
 assert.equal(await limited.getByRole("button",{name:"Editar",exact:true}).count(),0);
 console.log("PASS: capability-restricted interface");
 console.log("CRM_UI_SMOKE_PASS (mocked API, no real tenant writes)");
}catch(e){console.error("CRM_UI_SMOKE_FAIL:",e.message);process.exitCode=1;}
finally{await browser.close();}
