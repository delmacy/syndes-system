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
  await expect(page.locator(".operation-choice")).toHaveCount(4);
  await expect(page.locator(".operation-detail")).toHaveCount(1);
  await expect(page.locator("#crm-create-person")).toBeVisible();
  await expect(page.locator(".reading-section")).toHaveCount(0);
  await page.locator(".operation-choice").filter({hasText:"Consultar e pesquisar contatos"}).click();
  await expect(page.locator("#crm-search-person")).toBeVisible();
  await expect(page.locator("#crm-create-person")).toHaveCount(0);
});
test("A operação apresenta comportamento, campos, contrato, critérios e referências nesta ordem",async({page})=>{
  await page.goto("/modulos/crm/#crm-create-person");
  const op=page.locator("#crm-create-person");
  await expect(op).toBeVisible();
  await expect(op).toContainText("CrmService");
  await expect(op.locator(".operation-steps li")).toHaveCount(3);
  await expect(op.locator(".evidence-table tbody tr")).toHaveCount(3);
  await expect(op.locator(".source-footer a")).toHaveCount(6);
  await expect(op.locator(".operation-expander")).toHaveCount(2);
  await expect(op.getByText("POST /v1/tenants/:tenantId/crm/people")).not.toBeVisible();
  await op.locator(".operation-expander").first().locator("summary").click();
  await expect(op.getByText("POST /v1/tenants/:tenantId/crm/people")).toBeVisible();
  await op.locator(".operation-expander").nth(1).locator("summary").click();
  await expect(op.locator(".operation-checklist li")).toHaveCount(5);
  const ordered=await op.evaluate(el=>{
    const refs=el.querySelector(".source-footer");
    const proposal=el.querySelector(".proposal-area");
    const rules=el.querySelector(".operation-rules");
    return Boolean(rules&&refs&&proposal&&(rules.compareDocumentPosition(refs)&Node.DOCUMENT_POSITION_FOLLOWING)&&(refs.compareDocumentPosition(proposal)&Node.DOCUMENT_POSITION_FOLLOWING));
  });
  expect(ordered).toBe(true);
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
  const area=page.locator(".operation-detail .proposal-area");
  await area.locator(".proposal-trigger").click();
  await area.locator("input").fill("Melhorar validação de email");
  await area.locator("textarea").fill("Revisar casos de entrada inválida mantendo o contrato.");
  await page.reload();
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
  await expect(page.locator(".operation-choice")).toHaveCount(4);
  const widths=await page.evaluate(()=>({a:document.documentElement.scrollWidth,b:document.documentElement.clientWidth}));
  expect(widths.a).toBeLessThanOrEqual(widths.b+2);
  if(isMobile){
    const menu=page.getByRole("button",{name:"Abrir menu"});
    await menu.click();
    await expect(page.getByRole("navigation",{name:"Navegação principal"})).toBeVisible();
  }else await expect(page.locator(".module-sidebar")).toBeVisible();
});
