import {test,expect} from "@playwright/test";
const PASSWORD="e2e-only-not-production";
const TENANT="11111111-1111-4111-8111-111111111111";
const CASE_PROTOCOL=/SYN-\d{9}/;
async function login(browser,user){
 const context=await browser.newContext({ignoreHTTPSErrors:true});
 const page=await context.newPage();
 await page.goto("/");
 await expect(page).toHaveURL(/localhost:8443\/realms\/syndes-support-e2e/);
 await page.locator("#username").fill(user);
 await page.locator("#password").fill(PASSWORD);
 await page.locator("#kc-login").click();
 await expect(page.getByRole("heading",{name:"Solicitações internas"})).toBeVisible();
 return {context,page};
}
test("real Keycloak + FGA + PostgreSQL: internal requester, restricted notes and external Syndes WhatsApp",async({browser,request})=>{
 // Host must not allow unauthenticated data or other tenant IDs.
 const supportPath="http://127.0.0.1:4180/v1/tenants/"+TENANT+"/support/internal/cases";
 const anon=await request.get(supportPath);
 expect(anon.status()).toBe(401);
 // A real, Keycloak-signed Workspace client token with the SAME API audience
 // must not authenticate to Syndes Support. Only the test fixture enables ROPC.
 const wrongClientResponse=await request.post(
  "https://localhost:8443/realms/syndes-support-e2e/protocol/openid-connect/token",{
   ignoreHTTPSErrors:true,
   form:{grant_type:"password",client_id:"syndes-workspace-ci-only",username:"agent",password:PASSWORD}
  });
 expect(wrongClientResponse.status()).toBe(200);
 const wrongClientAccess=(await wrongClientResponse.json()).access_token;
 expect(typeof wrongClientAccess).toBe("string");
 const wrongClientCall=await request.get(supportPath,{
  headers:{Authorization:"Bearer "+wrongClientAccess}
 });
 expect(wrongClientCall.status()).toBe(401,"Wrong azp must fail before tenant membership or SQL");
 const employee=await login(browser,"employee");
 const agent=await login(browser,"agent");
 const outsider=await login(browser,"outsider");
 try{
  // A valid JWT does not imply tenant membership or Support access.
  await expect(outsider.page.getByRole("alert")).toContainText("permissão");
  await expect(outsider.page.getByText("Nenhum chamado encontrado")).toBeVisible();

  await employee.page.getByRole("button",{name:"Novo chamado"}).click();
  const internalForm=employee.page.getByRole("region",{name:"Criar chamado"});
  await internalForm.getByLabel("Fila").selectOption("it_infra");
  await internalForm.getByLabel("Descrição").fill("E2E solicitação interna: rede corporativa");
  await internalForm.getByLabel("Prioridade").selectOption("high");
  await employee.page.getByRole("button",{name:"Registrar",exact:true}).click();
  await expect(employee.page.getByText("Chamado registrado.",{exact:true})).toBeVisible();
  const own=employee.page.getByRole("button",{name:CASE_PROTOCOL}).first();
  await expect(own).toBeVisible();
  const ownText=await own.innerText();
  const protocol=ownText.match(CASE_PROTOCOL)?.[0];
  expect(protocol).toBeTruthy();
  await expect(employee.page.getByRole("heading",{name:protocol})).toBeVisible();
  await expect(employee.page.getByRole("heading",{name:"Ações da fila"})).toHaveCount(0);

  // Agent can only operate a queue with explicit OpenFGA grants and SQL membership.
  await agent.page.getByRole("button",{name:"Atualizar lista"}).click();
  const agentCase=agent.page.getByRole("button",{name:new RegExp(protocol)}).first();
  await expect(agentCase).toBeVisible();
  await agentCase.click();
  await expect(agent.page.getByRole("heading",{name:"Ações da fila"})).toBeVisible();
  await agent.page.getByLabel("Nota interna (não enviada ao cliente)").fill("Nota E2E só para a equipe técnica.");
  await agent.page.getByRole("button",{name:"Salvar nota"}).click();
  await expect(agent.page.getByText("Nota E2E só para a equipe técnica.")).toBeVisible();
  await agent.page.getByLabel("Alterar estado").selectOption("triage");
  await agent.page.getByRole("button",{name:"Aplicar"}).click();
  await expect(agent.page.getByRole("region",{name:"Detalhe do chamado"}).locator(".section-title .status")).toHaveText("Triagem");

  // Fresh Keycloak login and server-side history read must still hide private notes.
  await employee.page.reload();
  await expect(employee.page.getByRole("heading",{name:"Solicitações internas"})).toBeVisible();
  await employee.page.getByRole("button",{name:new RegExp(protocol)}).first().click();
  await expect(employee.page.getByRole("heading",{name:protocol})).toBeVisible();
  await expect(employee.page.getByText("Nota E2E só para a equipe técnica.")).toHaveCount(0);

  // The agent's external case goes through the REAL Inbox API, database and account gate.
  await agent.page.getByRole("button",{name:"Atendimento externo"}).click();
  await agent.page.getByRole("button",{name:"Novo chamado"}).click();
  const conversation=agent.page.getByLabel("Conversa WhatsApp com CRM vinculado");
  await expect(conversation.getByRole("option",{name:"Prospect test via WhatsApp"})).toBeAttached();
  await conversation.selectOption({label:"Prospect test via WhatsApp"});
  await agent.page.getByRole("button",{name:"Registrar",exact:true}).click();
  await expect(agent.page.getByText("Chamado registrado.",{exact:true})).toBeVisible();
  const externalCase=agent.page.getByRole("button",{name:CASE_PROTOCOL}).first();
  await expect(externalCase).toBeVisible();
  await expect(agent.page.getByText("WhatsApp").first()).toBeVisible();
  await expect(agent.page.getByRole("heading",{name:"Ações da fila"})).toBeVisible();

  // Employee has no external audience grant and no external queue membership.
  await employee.page.getByRole("button",{name:"Atendimento externo"}).click();
  await expect(employee.page.getByRole("alert")).toContainText("permissão");
  await expect(employee.page.getByText("Nenhum chamado encontrado")).toBeVisible();
 }finally{
  await employee.context.close();
  await agent.context.close();
  await outsider.context.close();
 }
});
