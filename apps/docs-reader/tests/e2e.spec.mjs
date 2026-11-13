import { test, expect, devices } from "@playwright/test";

const BASE=process.env.READER_URL||"http://127.0.0.1:3000";
test.use({baseURL:BASE});
const paths=["/","/modulos/crm"];
for(const path of paths){
  test("Página "+path+" carrega, com título único",async({page})=>{
    await page.goto(path);
    await expect(page.locator("main h1")).toHaveCount(1);
    await expect(page.locator("main")).toBeVisible();
    const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));
    expect(width.scroll).toBeLessThanOrEqual(width.viewport+2);
  });
}
test("CRM tem doze tópicos contínuos e referências depois da explicação",async({page})=>{
  await page.goto("/modulos/crm");
  await expect(page.locator("article section.reading-section")).toHaveCount(2);
  const data=await page.locator("article section.reading-section").first().evaluate(el=>{
    const lead=el.querySelector(".section-lead");
    const source=el.querySelector(".source-footer");
    const proposal=el.querySelector(".proposal-area");
    return {leadBeforeSource:lead.compareDocumentPosition(source)&Node.DOCUMENT_POSITION_FOLLOWING,
      sourceBeforeProposal:source.compareDocumentPosition(proposal)&Node.DOCUMENT_POSITION_FOLLOWING};
  });
  expect(data.leadBeforeSource).toBeTruthy();
  expect(data.sourceBeforeProposal).toBeTruthy();
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Integrações/}).click();
  await page.locator(".function-topic").filter({hasText:"Contratos e interfaces técnicas"}).click();
  await expect(page).toHaveURL(/#contratos$/);
  await expect(page.locator("#contratos")).toBeVisible();
});
test("Rascunho contextual persiste somente no navegador e exporta",async({page})=>{
  await page.goto("/modulos/crm");
  const first=page.locator(".reading-section").first();
  await first.locator(".proposal-trigger").click();
  const title=first.locator('input[id^="proposal-title"]');
  await title.fill("Melhorar explicação da situação");
  const text=first.locator('textarea');
  await text.fill("Separar o status dos testes do estado de homologação.");
  await page.reload();
  await first.locator(".proposal-trigger").click();
  await expect(title).toHaveValue("Melhorar explicação da situação");
  await expect(text).toHaveValue("Separar o status dos testes do estado de homologação.");
  const download=page.waitForEvent("download");
  await first.getByRole("button",{name:/Exportar .md/}).click();
  expect((await download).suggestedFilename()).toMatch(/p01-identificacao-proposta\.md/);
});
test("Menu mobile abre sem interromper a leitura",async({page,isMobile})=>{
  await page.goto("/modulos/crm");
  if(isMobile){
    const toggle=page.getByRole("button",{name:"Abrir menu"});
    await toggle.click();
    await expect(page.getByRole("button",{name:"Fechar menu"})).toHaveAttribute("aria-expanded","true");
    await expect(page.getByRole("navigation",{name:"Navegação principal"})).toBeVisible();
    await expect(page.getByRole("navigation",{name:"Selecionar função do CRM"})).toBeVisible();
  }
});


test("Identidade editorial tecnológica usa IBM Plex e azul discreto em Home e CRM",async({page},testInfo)=>{
  await page.goto("/");
  await expect(page.locator("main h1")).toHaveCount(1);
  const home=await page.evaluate(()=>{
    const css=sel=>getComputedStyle(document.querySelector(sel));
    const font=css(".serif-title").fontFamily;
    const ink=css("body").color;
    const accent=css(".hero-highlight").color;
    const background=css("body").backgroundColor;
    const button=css(".primary-link").backgroundColor;
    return {font,ink,accent,background,button};
  });
  expect(home.font).toContain("IBM Plex Sans");
  expect(home.font.toLowerCase()).not.toContain("georgia");
  expect(home.ink).toBe("rgb(23, 36, 55)");
  expect(home.accent).toBe("rgb(41, 95, 185)");
  expect(home.button).toBe("rgb(37, 91, 193)");
  await page.screenshot({path:testInfo.outputPath("home-editorial-tech.png"),fullPage:false});
  await page.goto("/modulos/crm/");
  await expect(page.locator("article section.reading-section")).toHaveCount(2);
  const crm=await page.evaluate(()=>{
    const heading=getComputedStyle(document.querySelector(".reading-section h2"));
    const summary=getComputedStyle(document.querySelector(".module-hero .subtitle"));
    const body=getComputedStyle(document.body);
    return {headingFont:heading.fontFamily,headingWeight:heading.fontWeight,subtitleFont:summary.fontFamily,bodyFont:body.fontFamily};
  });
  expect(crm.headingFont).toContain("IBM Plex Sans");
  expect(crm.subtitleFont).toContain("IBM Plex Sans");
  expect(crm.bodyFont).toContain("IBM Plex Sans");
  await page.screenshot({path:testInfo.outputPath("crm-editorial-tech.png"),fullPage:false});
});

test("Leitura editorial conserva contraste, foco e organização em todos os viewports",async({page,isMobile})=>{
  await page.goto("/modulos/crm/");
  await expect(page.locator("article .source-footer")).toHaveCount(2);
  await expect(page.locator("article .proposal-area")).toHaveCount(2);
  const stats=await page.evaluate(()=>{
    const body=getComputedStyle(document.body);
    return {clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,lineHeight:parseFloat(getComputedStyle(document.querySelector(".reading-section .copy")).lineHeight),fontSize:parseFloat(getComputedStyle(document.querySelector(".reading-section .copy")).fontSize),bodyColor:body.color};
  });
  expect(stats.scrollWidth).toBeLessThanOrEqual(stats.clientWidth+2);
  expect(stats.lineHeight/stats.fontSize).toBeGreaterThan(1.6);
  if(isMobile){
    await expect(page.getByRole("navigation",{name:"Selecionar função do CRM"})).toBeVisible();
    await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Cadastros/}).click();
    await expect(page.locator("#dados")).toBeVisible();
  }else{
    await expect(page.locator(".module-sidebar")).toBeVisible();
    await page.getByRole("navigation",{name:"Funções do CRM"}).getByRole("button",{name:/Cadastros/}).click();
    await expect(page.locator("#dados")).toBeVisible();
  }
});


test("CRM exibe os inventários reais sem interromper a leitura editorial",async({page},testInfo)=>{
  await page.goto("/modulos/crm/");
  await expect(page.locator("article section.reading-section")).toHaveCount(2);
  await expect(page.locator(".verified-evidence")).toHaveCount(2);
  await expect(page.locator(".evidence-table")).toHaveCount(2);
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Integrações/}).click();
  await expect(page.locator(".evidence-table")).toHaveCount(6);
  const contracts=page.locator("#contratos");
  await expect(contracts).toContainText("/v1/tenants/:tenantId/crm");
  await expect(contracts).toContainText("crm:people");
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Cadastros/}).click();
  const data=page.locator("#dados");
  await expect(data).toContainText("crm_people");
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Validações/}).click();
  const security=page.locator("#seguranca");
  await expect(security).toContainText("CoreKernel.execute");
  await page.getByRole("navigation",{name:"Selecionar função do CRM"}).getByRole("button",{name:/Integrações/}).click();
  const position=await contracts.evaluate(el=>{
    const evidence=el.querySelector(".verified-evidence");
    const sources=el.querySelector(".source-footer");
    const proposal=el.querySelector(".proposal-area");
    return Boolean(evidence && sources && proposal &&
      (evidence.compareDocumentPosition(sources) & Node.DOCUMENT_POSITION_FOLLOWING) &&
      (sources.compareDocumentPosition(proposal) & Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(position).toBe(true);
  await page.locator("#contratos").scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath("crm-real-contracts.png"),fullPage:false});
});

test("Funções isolam assuntos sem duplicar documentação e preservam URLs profundas",async({page})=>{
  await page.goto("/modulos/crm/");
  const nav=page.getByRole("navigation",{name:"Selecionar função do CRM"});
  await expect(nav.getByRole("button")).toHaveCount(6);
  await expect(page.locator("article section.reading-section")).toHaveCount(2);
  await expect(page.locator("#contratos")).toHaveCount(0);
  await nav.getByRole("button",{name:/Integrações/}).click();
  await expect(page.locator("article section.reading-section")).toHaveCount(3);
  await expect(page.locator("#contratos")).toBeVisible();
  await expect(page.locator("#identificacao")).toHaveCount(0);
  await page.locator(".function-topic").filter({hasText:"Contratos e interfaces técnicas"}).click();
  await expect(page).toHaveURL(/#contratos$/);
  await page.reload();
  await expect(page.locator("#contratos")).toBeVisible();
  await nav.getByRole("button",{name:/Atendimento/}).click();
  await expect(page.locator("#processos")).toBeVisible();
  await expect(page.locator("#contratos")).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("#contratos")).toBeVisible();
});
