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
  await expect(page.locator("article section.reading-section")).toHaveCount(12);
  const data=await page.locator("article section.reading-section").first().evaluate(el=>{
    const lead=el.querySelector(".section-lead");
    const source=el.querySelector(".source-footer");
    const proposal=el.querySelector(".proposal-area");
    return {leadBeforeSource:lead.compareDocumentPosition(source)&Node.DOCUMENT_POSITION_FOLLOWING,
      sourceBeforeProposal:source.compareDocumentPosition(proposal)&Node.DOCUMENT_POSITION_FOLLOWING};
  });
  expect(data.leadBeforeSource).toBeTruthy();
  expect(data.sourceBeforeProposal).toBeTruthy();
  if (test.info().project.name === "mobile") {
    await page.locator(".mobile-outline summary").click();
    await page.locator('.mobile-outline a[href="#contratos"]').click();
  } else {
    await page.locator('.side-link[href="#contratos"]').click();
  }
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
    await expect(page.locator(".mobile-outline")).toBeVisible();
  }
});
