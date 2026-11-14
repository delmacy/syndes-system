import { test, expect } from "@playwright/test";

test("Home e CRM carregam sem overflow e preservam identidade visual",async({page},testInfo)=>{
  for(const path of ["/","/modulos/crm/"]){
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveCount(1);
    const m=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily}));
    expect(m.content).toBeLessThanOrEqual(m.viewport+2);
    expect(m.font).toContain("IBM Plex Sans");
  }
  await page.screenshot({path:testInfo.outputPath("crm-operacoes.png"),fullPage:false});
});
test("O CRM tem seis funções e abre uma operação sem exibir catálogo interminável",async({page})=>{
  await page.goto("/modulos/crm/");
  const nav=page.getByRole("navigation",{name:"Selecionar função do CRM"});
  await expect(nav.getByRole("button")).toHaveCount(6);
  await expect(page.locator(".reading-section")).toHaveCount(2);
  await nav.getByRole("button",{name:/Cadastros/}).click();
  await expect(page.locator(".operation-choice")).toHaveCount(9);
  await expect(page.locator(".operation-detail")).toHaveCount(1);
  await expect(page.locator("#crm-create-person")).toBeVisible();
  await expect(page.locator(".reading-section")).toHaveCount(0);
  await page.locator(".operation-choice").filter({hasText:"Consultar e pesquisar contatos"}).click();
  await expect(page.locator("#crm-search-person")).toBeVisible();
  await expect(page.locator("#crm-create-person")).toHaveCount(0);
});
test("As nove abas da operação são exclusivas e exibem conteúdo correto",async({page})=>{
  await page.goto("/modulos/crm/#crm-create-person");
  const op=page.locator("#crm-create-person");
  const tabs=op.getByRole("tablist",{name:/Documentação de/});
  await expect(tabs.getByRole("tab")).toHaveCount(9);
  await expect(op.getByRole("tabpanel")).toHaveCount(1);
  await expect(op.getByText("POST /v1/tenants/:tenantId/crm/people")).not.toBeVisible();
  await tabs.getByRole("tab",{name:"Fluxo"}).click();
  await expect(op.locator(".operation-steps li")).toHaveCount(3);
  await expect(op.locator(".evidence-table")).toHaveCount(0);
  await tabs.getByRole("tab",{name:"Dados"}).click();
  await expect(op.locator(".evidence-table tbody tr")).toHaveCount(3);
  await expect(op.locator(".operation-steps")).toHaveCount(0);
  await tabs.getByRole("tab",{name:"API",exact:true}).click();
  await expect(op.getByText("POST /v1/tenants/:tenantId/crm/people")).toBeVisible();
  await expect(op.getByRole("tab",{name:"API",exact:true})).toHaveAttribute("aria-selected","true");
  await expect(op.locator(".source-footer a")).toHaveCount(7);
  await tabs.getByRole("tab",{name:"Pendências"}).click();
  await expect(op.getByRole("button",{name:"Exportar briefing .md"})).toBeVisible();
  await expect(op.locator(".proposal-area")).toHaveCount(1);
});
test("Modo referência técnica preserva os doze assuntos e links diretos",async({page})=>{
  await page.goto("/modulos/crm/#contratos");
  await expect(page.getByRole("heading",{name:"Integrações · assuntos originais"})).toBeVisible();
  await expect(page.locator(".reading-section")).toHaveCount(3);
  await expect(page.locator("#contratos")).toBeVisible();
  await expect(page.locator(".evidence-table")).toHaveCount(6);
  await expect(page.locator(".operation-detail")).toHaveCount(0);
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Cadastros/}).click();
  await expect(page.locator("#crm-create-person")).toBeVisible();
  await page.getByRole("button",{name:/Consultar os assuntos técnicos desta função/}).click();
  await expect(page.locator(".reading-section")).toHaveCount(2);
  await expect(page.locator("#dados")).toBeVisible();
  await expect(page.locator(".operation-detail")).toHaveCount(0);
});
test("Histórico e URL levam diretamente à operação correta",async({page})=>{
  await page.goto("/modulos/crm/#crm-create-note");
  await expect(page.locator("#crm-create-note")).toBeVisible();
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Cadastros/}).click();
  await expect(page.locator("#crm-create-person")).toBeVisible();
  await page.goBack();
  await expect(page.locator("#crm-create-note")).toBeVisible();
  await page.reload();
  await expect(page.locator("#crm-create-note")).toBeVisible();
});
test("Rascunho por operação persiste e é exportável sem enviar ao servidor",async({page})=>{
  await page.goto("/modulos/crm/#crm-create-person");
  await page.locator("#crm-create-person").getByRole("tab",{name:"Pendências"}).click();
  const area=page.locator(".operation-detail .proposal-area");
  await area.locator(".proposal-trigger").click();
  await area.locator("input").fill("Melhorar validação de email");
  await area.locator("textarea").fill("Revisar casos de entrada inválida mantendo o contrato.");
  await page.reload();
  await page.locator("#crm-create-person").getByRole("tab",{name:"Pendências"}).click();
  await area.locator(".proposal-trigger").click();
  await expect(area.locator("input")).toHaveValue("Melhorar validação de email");
  const download=page.waitForEvent("download");
  await area.getByRole("button",{name:/Exportar .md/}).click();
  expect((await download).suggestedFilename()).toContain("crm-create-person");
});
test("Atendimento, validações e integrações têm operações reais contextualizadas",async({page})=>{
  await page.goto("/modulos/crm/");
  const nav=page.getByRole("navigation",{name:"Selecionar função do CRM"});
  await nav.getByRole("button",{name:/Atendimento/}).click();
  await expect(page.locator("#crm-create-note")).toBeVisible();
  await expect(page.locator(".operation-choice")).toHaveCount(2);
  await nav.getByRole("button",{name:/Validações/}).click();
  await expect(page.locator("#crm-authorization")).toBeVisible();
  await nav.getByRole("button",{name:/Integrações/}).click();
  await expect(page.locator("#crm-public-contracts")).toBeVisible();
  await nav.getByRole("button",{name:/Evolução/}).click();
  await expect(page.locator("#crm-product-gate")).toBeVisible();
  await expect(page.locator(".operation-status")).toContainText("Pendente");
});
test("Navegação móvel continua acessível sem overflow",async({page,isMobile})=>{
  await page.goto("/modulos/crm/");
  const nav=page.getByRole("navigation",{name:"Selecionar função do CRM"});
  await expect(nav).toBeVisible();
  await nav.getByRole("button",{name:/Cadastros/}).click();
  await expect(page.locator(".operation-choice")).toHaveCount(9);
  const widths=await page.evaluate(()=>({a:document.documentElement.scrollWidth,b:document.documentElement.clientWidth}));
  expect(widths.a).toBeLessThanOrEqual(widths.b+2);
  if(isMobile){
    const menu=page.getByRole("button",{name:"Abrir menu"});
    await menu.click();
    await expect(page.getByRole("navigation",{name:"Navegação principal"})).toBeVisible();
  }else await expect(page.locator(".module-sidebar")).toBeVisible();
});

test("Briefing de agente pode ser exportado sem clipboard e sem executar ações",async({page})=>{
  await page.goto("/modulos/crm/#crm-create-person");
  const op=page.locator("#crm-create-person");
  await op.getByRole("tab",{name:"Pendências"}).click();
  const download=page.waitForEvent("download");
  await op.getByRole("button",{name:"Exportar briefing .md"}).click();
  const artifact=await download;
  expect(artifact.suggestedFilename()).toBe("syndes-p01-crm-create-person-briefing.md");
  await expect(op.getByRole("status")).toContainText("exportado");
});


test("Atlas técnico apresenta diagramas, 30 APIs, métodos e 9 tabelas",async({page})=>{
  await page.goto("/modulos/crm/");
  await page.getByRole("button",{name:/Atlas técnico, inventários e diagramas/}).click();
  await expect(page.getByRole("heading",{name:"Atlas do CRM"})).toBeVisible();
  await expect(page.getByRole("img",{name:"Camadas e dependências"})).toBeVisible();
  await page.getByRole("button",{name:"Persistência CRM — relações principais"}).click();
  await expect(page.getByRole("img",{name:"Persistência CRM — relações principais"})).toBeVisible();
  await page.getByRole("tab",{name:"APIs",exact:true}).click();
  await expect(page.getByRole("region",{name:"APIs HTTP CRM"}).locator("tbody tr")).toHaveCount(30);
  await page.getByLabel("Filtrar por rota, verbo, ação ou permissão").fill("imports/csv");
  await expect(page.getByRole("region",{name:"APIs HTTP CRM"}).locator("tbody tr")).toHaveCount(1);
  await page.getByRole("tab",{name:"Dados e SQL"}).click();
  await expect(page.locator(".crm-table-detail")).toHaveCount(9);
  await page.getByRole("tab",{name:"Classes e métodos"}).click();
  await expect(page.getByRole("region",{name:"Inventário de métodos CRM"}).locator("tbody tr").first()).toBeVisible();
});

test("Cinco núcleos navegáveis e 9 abas independentes por ação",async({page})=>{
  await page.goto("/");
  const directory=page.locator(".pilot-directory-grid");
  await expect(directory.locator("a")).toHaveCount(5);
  for(const slug of ["core-platform","blueprint","whatsapp","security"]){
    await page.goto("/modulos/"+slug+"/");
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator(".pilot-operation")).toHaveCount(1);
    const t=page.locator(".pilot-operation").getByRole("tablist");
    await expect(t.getByRole("tab")).toHaveCount(9);
    await t.getByRole("tab",{name:"API",exact:true}).click();
    await expect(page.locator(".pilot-operation").getByRole("tabpanel")).toHaveCount(1);
    await t.getByRole("tab",{name:"Pendências"}).click();
    await expect(page.getByRole("button",{name:"Copiar prompt de planejamento"})).toBeVisible();
    await expect(page.getByRole("button",{name:"Exportar implementação .md"})).toBeVisible();
    await expect(page.locator(".pilot-operation .proposal-area")).toHaveCount(1);
    await page.getByRole("button",{name:"Mapa e fontes do módulo"}).click();
    await expect(page.getByRole("img",{name:new RegExp("Mapa de fronteiras")})).toBeVisible();
    await expect(page.locator(".pilot-operation")).toHaveCount(0);
  }
});
test("Nova documentação não provoca overflow horizontal no mobile",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  for(const slug of ["core-platform","blueprint","whatsapp","security"]){
    await page.goto("/modulos/"+slug+"/");
    const sizes=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    expect(sizes.scroll).toBeLessThanOrEqual(sizes.width+2);
    await expect(page.locator(".operation-tabpanel")).toHaveCount(1);
  }
});


test("Biblioteca expõe o template mestre sem abrir um sexto módulo",async({page})=>{
 await page.goto("/");
 await expect(page.locator(".pilot-directory-grid a")).toHaveCount(5);
 const link=page.getByRole("link",{name:/Abrir template/});
 await expect(link).toBeVisible();
 await expect(link).toHaveAttribute("href",/TEMPLATE-FICHA-MODULO\.md$/);
});


test("CRM: Ficha detalhada da ação é acessível pelo leitor",async({page})=>{
 await page.goto("/modulos/crm/#crm-create-person");
 const link=page.locator("#crm-create-person .operation-action-dossier");
 await expect(link).toBeVisible();
 await expect(link).toHaveAttribute("href","https://github.com/delmacy/syndes-system/blob/main/docs/subprojects/P01-crm/acoes/crm-create-person.md");
 await expect(link).toHaveAttribute("target","_blank");
});
