import { test, expect } from "@playwright/test";

const BASE=process.env.MOBILE_PREVIEW_BASE||"http://127.0.0.1:8766/syndes-system/";
const address=part=>new URL(part,BASE).href;
const mainRoutes=[
 ["inicio",""],
 ["CRM","modulos/crm/"],
 ["Ficha CRM","modulos/crm/ficha/"],
 ["P05","modulos/atendimentos/"],
 ["Inbox","modulos/inbox/"],
 ["Ações Inbox","modulos/inbox/acoes/"],
 ["Ação Inbox","modulos/inbox/acoes/p02-message-reply/"],
 ["Core","modulos/core-platform/"],
 ["WhatsApp","modulos/whatsapp/"],
 ["Security","modulos/security/"],
 ["Blueprint","modulos/blueprint/"]
];
const issue=(page)=>page.evaluate(()=>{
 const root=document.documentElement, width=root.clientWidth;
 const offenders=[...document.querySelectorAll("body *")].filter(node=>{
   const rect=node.getBoundingClientRect(),style=getComputedStyle(node);
   return rect.width>0 && style.position!=="fixed" &&
     (rect.left < -0.5 || rect.right > width+0.5) &&
     style.overflowX!=="auto" && style.overflowX!=="scroll";
 }).slice(0,24).map(node=>({tag:node.tagName,cls:typeof node.className==="string"?node.className.slice(0,90):"",
                       right:Math.round(node.getBoundingClientRect().right),
                       overflow:getComputedStyle(node).overflowX,
                       text:node.textContent?.trim().slice(0,50)}));
 return {viewport:width,scroll:root.scrollWidth,offenders};
});
async function noGlobalOverflow(page,label){
 const size=await issue(page);
 expect(size.scroll,JSON.stringify({label,...size})).toBeLessThanOrEqual(size.viewport+2);
}
async function tapTarget(page,selector,description){
 const box=await page.locator(selector).first().boundingBox();
 expect(box,description+" must exist").toBeTruthy();
 expect(box.height,description+" height").toBeGreaterThanOrEqual(43);
 expect(box.width,description+" width").toBeGreaterThanOrEqual(43);
}

test("larguras 320/360/390/430: páginas essenciais cabem sem rolagem lateral global",async({page},testInfo)=>{
 const pageErrors=[];
 page.on("pageerror",error=>pageErrors.push(error.message));
 for(const width of [320,360,390,430]){
   await page.setViewportSize({width,height:844});
   const group=width===320?mainRoutes.slice(0,4):width===360?mainRoutes.slice(4):width===390?mainRoutes:mainRoutes.slice(0,4);
   for(const [label,path] of group){
     const response=await page.goto(address(path),{waitUntil:"networkidle"});
     expect(response?.status(),label+" @"+width).toBe(200);
     await expect(page.locator("main h1").first()).toBeVisible();
     await noGlobalOverflow(page,label+" @"+width);
     if(width===390 && ["inicio","Ficha CRM","P05"].includes(label)){
       await page.screenshot({path:testInfo.outputPath("mobile-"+label.replace(/\s/g,"-")+".png"),animations:"disabled",fullPage:false});
     }
   }
 }
 expect(pageErrors,"fatal client-side exceptions").toEqual([]);
});

test("menu móvel funciona em telefone e tablet sem esconder módulos",async({page})=>{
 for(const width of [390,768,1024]){
   await page.setViewportSize({width,height:850});
   await page.goto(address(""));
   const toggle=page.getByRole("button",{name:"Abrir menu"});
   await expect(toggle).toBeVisible();
   await tapTarget(page,'.mobile-toggle',"menu");
   await expect(toggle).toHaveAttribute("aria-expanded","false");
   await toggle.click();
   const nav=page.getByRole("navigation",{name:"Navegação principal"});
   await expect(nav).toBeVisible();
   await expect(page.getByRole("button",{name:"Fechar menu"})).toHaveAttribute("aria-expanded","true");
   for(const name of ["Core Platform","Blueprint","WhatsApp","Security","Atendimentos","Inbox"]){
     await expect(nav.getByRole("link",{name:new RegExp(name)})).toBeVisible();
   }
   await noGlobalOverflow(page,"menu open "+width);
   await page.keyboard.press("Escape");
   await expect(page.getByRole("button",{name:"Abrir menu"})).toBeVisible();
   await expect(nav).toBeHidden();
 }
 await page.setViewportSize({width:390,height:844});
 await page.goto(address(""));
 await page.getByRole("button",{name:"Abrir menu"}).click();
 await page.getByRole("navigation",{name:"Navegação principal"}).getByRole("link",{name:/Atendimentos/}).click();
 await expect(page).toHaveURL(/\/modulos\/atendimentos\/$/);
 await expect(page.getByRole("navigation",{name:"Navegação principal"})).toBeHidden();
});

test("CRM e P05: grupos, seções, busca, navegação e histórico operam por toque",async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of ["modulos/crm/ficha/","modulos/atendimentos/","modulos/inbox/"]){
   await page.goto(address(path));
   const groups=page.getByRole("tablist",{name:"Grupos da Ficha Mestre"});
   await expect(groups.getByRole("tab")).toHaveCount(5);
   await expect(page.locator(".master-detail h2")).toHaveCount(1);
   await tapTarget(page,".master-group-tab","grupo da ficha");
   await tapTarget(page,".master-index-item","seção da ficha");
   await groups.getByRole("tab",{name:/Arquitetura e contratos/}).click();
   await expect(page.locator(".master-detail-head")).toContainText("04 / 21");
   await page.locator(".master-index-item").nth(3).click();
   await expect(page.locator(".master-detail-head")).toContainText("07 / 21");
   await tapTarget(page,".master-step-actions button:not([disabled])","próxima seção");
   await page.getByRole("button",{name:/Próxima seção/}).click();
   await expect(page.locator(".master-detail-head")).toContainText("08 / 21");
   const search=page.getByRole("searchbox",{name:"Buscar nas 22 seções"});
   await search.fill("segurança");
   await expect(page.locator(".master-index-item").first()).toBeVisible();
   expect(Number(await page.locator(".master-index-item").count())).toBeGreaterThan(0);
   const font=await page.locator(".master-prose").evaluate(node=>parseFloat(getComputedStyle(node).fontSize));
   expect(font,"document reading font size").toBeGreaterThanOrEqual(15);
   await noGlobalOverflow(page,path);
 }
});

test("tabelas extensas têm rolagem local e referências legíveis",async({page})=>{
 await page.setViewportSize({width:320,height:760});
 for(const path of ["modulos/crm/ficha/","modulos/atendimentos/"]){
   await page.goto(address(path));
   const table=page.locator(".master-table-scroll").first();
   await expect(table).toBeVisible();
   const metrics=await table.evaluate(node=>({width:node.clientWidth,scroll:node.scrollWidth,doc:document.documentElement.scrollWidth,vw:document.documentElement.clientWidth}));
   expect(metrics.width).toBeLessThanOrEqual(metrics.vw);
   expect(metrics.doc).toBeLessThanOrEqual(metrics.vw+2);
   if(metrics.scroll>metrics.width+2){
     await table.evaluate(node=>{node.scrollLeft=node.scrollWidth;});
     const offset=await table.evaluate(node=>node.scrollLeft);
     expect(offset,"long table can be scrolled horizontally within its container").toBeGreaterThan(0);
   }
   await expect(page.locator(".master-prose a").first()).toHaveAttribute("href",/^https:\/\/github[.]com\/delmacy\/syndes-system\//);
 }
});

test("CRM: abas e comandos permanecem selecionáveis em 320px",async({page})=>{
 await page.setViewportSize({width:320,height:760});
 await page.goto(address("modulos/crm/#crm-create-person"));
 const tabs=page.locator("#crm-create-person").getByRole("tablist",{name:/Documentação de/});
 await expect(tabs.getByRole("tab")).toHaveCount(9);
 await tapTarget(page,"#crm-create-person .operation-tab","aba da ação");
 await tabs.getByRole("tab",{name:"API",exact:true}).click();
 await expect(tabs.getByRole("tab",{name:"API",exact:true})).toHaveAttribute("aria-selected","true");
 await expect(page.locator("#crm-create-person .operation-tabpanel")).toContainText("POST /v1/tenants");
 await noGlobalOverflow(page,"CRM action tabs 320");
 await tabs.getByRole("tab",{name:"Pendências"}).click();
 await expect(page.locator("#crm-create-person .proposal-area")).toBeVisible();
});


test("P02 Inbox: navegação mobile por função e ação sem rolagem global",async({page})=>{
 await page.setViewportSize({width:320,height:780});
 await page.goto(address("modulos/inbox/"));
 await noGlobalOverflow(page,"P02 master 320");
 await page.getByRole("link",{name:/Explorar ações do módulo/}).click();
 await expect(page.locator(".inbox-function-tab")).toHaveCount(7);
 await noGlobalOverflow(page,"P02 functions 320");
 await page.getByRole("tab",{name:/Mensagens e notas/}).click();
 await expect(page.locator(".inbox-action-card")).toHaveCount(3);
 await tapTarget(page,".inbox-function-tab","função P02");
 await page.locator(".inbox-action-card").filter({hasText:"Responder à conversa"}).click();
 await expect(page.locator(".master-index-item")).toHaveCount(10);
 await tapTarget(page,".master-index-item","seção da ação P02");
 await page.locator(".master-index-item").nth(5).click();
 await expect(page.locator(".master-detail-head")).toContainText("F / J");
 await noGlobalOverflow(page,"P02 action 320");
});
