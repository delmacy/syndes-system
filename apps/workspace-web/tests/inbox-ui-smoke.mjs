import { chromium } from "playwright";
import assert from "node:assert/strict";

const origin = process.env.SYNDES_UI_ORIGIN ?? "http://127.0.0.1:18084";
const actor = "agent-1";
const tenantId = "4ab44379-d557-4df6-a2be-d44e121a8077";
const id = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const crmId = "33333333-3333-4333-8333-333333333333";
const token = ["header", Buffer.from(JSON.stringify({ sub: actor })).toString("base64url"), "signature"].join(".");

async function mockWorkspace(page) {
  let records = [
    { id, subject: "Pedido inicial", status: "open", handoff: "human", channel: "simulation", assignedTo: actor, crmPersonId: crmId, updatedAt: "2026-11-01T10:00:00Z" },
    { id: id2, subject: "Conversa resolvida", status: "resolved", handoff: "human", channel: "simulation", assignedTo: null, crmPersonId: null, updatedAt: "2026-11-01T09:00:00Z" },
  ];
  const threads = {
    [id]: [{ id: "m-1", direction: "inbound", body: "Olá, preciso de ajuda", createdAt: "2026-11-01T10:00:00Z" }],
    [id2]: [],
  };

  await page.addInitScript(() => {
    sessionStorage.setItem("syndes.workspace.pkce", JSON.stringify({ verifier: "fixture", state: "fixture", created: Date.now() }));
  });
  await page.route("**/workspace-runtime.json", route => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ issuer: "https://idp.fixture.invalid/realms/syndes", clientId: "syndes-workspace-ui", tenantId, tenantLabel: "Demonstração" }),
  }));
  await page.route("https://idp.fixture.invalid/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ access_token: token }) }));
  await page.route("**/v1/tenants/**", async route => {
    const req = route.request();
    const url = new URL(req.url());
    if (!url.pathname.startsWith("/v1/tenants/" + tenantId + "/")) return route.fulfill({ status: 403 });
    const path = url.pathname.slice(("/v1/tenants/" + tenantId).length);
    const method = req.method();
    const pieces = path.split("/");
    const conversationId = pieces[3];
    const respond = (data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    const current = records.find(record => record.id === conversationId);
    if (path === "/crm/people" || path.startsWith("/crm/people?")) return respond([]);
    if (path === "/crm/people/" + crmId) return respond({ id: crmId, name: "Ana Exemplo", email: "ana@example.org", phone: "+5551999999999" });
    if (path === "/crm/people/" + crmId + "/notes") return respond([{ id: "crm-note-1", body: "Prefere contato pela manhã", createdAt: "2026-11-01T09:00:00Z", createdBy: actor }]);
    if (path === "/crm/people/" + crmId + "/timeline") return respond([{ id: 12, action: "linked_organization", recordedAt: "2026-11-01T09:15:00Z", actorId: actor }]);
    if (path === "/crm/people/" + crmId + "/organizations") return respond([{ id: "org-1", legalName: "Empresa Exemplo Ltda", tradeName: "Empresa Exemplo" }]);
    if (path === "/crm/people/" + crmId + "/tags") return respond([{ id: "tag-1", label: "VIP" }]);
    if (path === "/inbox/metrics") return respond({ open: 1, pending: 0, resolved: 1, unassigned: 1 });
    if (path === "/inbox/conversations" && method === "GET") {
      const status = url.searchParams.get("status");
      const queue = url.searchParams.get("queue") ?? "all";
      if (!["mine", "unassigned", "all"].includes(queue)) return respond({ message: "Invalid queue" }, 400);
      return respond(records.filter(record => (!status || record.status === status) &&
        (queue === "all" || (queue === "mine" && record.assignedTo === actor) ||
          (queue === "unassigned" && record.assignedTo === null))));
    }
    if (path === "/inbox/conversations" && method === "POST") {
      const body = req.postDataJSON();
      const record = { id: crypto.randomUUID(), subject: body.subject, status: "open", handoff: "human", channel: "simulation", assignedTo: null, crmPersonId: body.crmPersonId, updatedAt: new Date().toISOString() };
      records = [record, ...records];
      threads[record.id] = [];
      return respond(record, 201);
    }
    if (!current) return respond({ message: "Not found" }, 404);
    if (pieces.length === 4 && method === "GET") return respond(current);
    if (pieces[4] === "messages" && method === "GET") return respond(threads[conversationId] ?? []);
    if (method === "PATCH" && ["status", "handoff", "assignment"].includes(pieces[4])) {
      const body = req.postDataJSON();
      const field = pieces[4] === "assignment" ? "assignedTo" : pieces[4];
      current[field] = pieces[4] === "assignment" ? body.assigneeId : pieces[4] === "handoff" ? body.mode : body.status;
      return respond(current);
    }
    if (method === "POST" && ["replies", "notes", "simulator"].includes(pieces[4])) {
      const body = req.postDataJSON();
      const direction = pieces[4] === "replies" ? "outbound" : pieces[4] === "notes" ? "internal" : "inbound";
      const msg = { id: crypto.randomUUID(), direction, body: body.body, createdAt: new Date().toISOString() };
      threads[conversationId].push(msg);
      if (direction === "inbound" && current.status === "resolved") current.status = "open";
      return respond(msg, 201);
    }
    return respond({ message: "Unexpected mocked path: " + path }, 404);
  });
  await page.goto(origin + "/?code=fixture-code&state=fixture", { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: /Bem-vindo ao/ }).waitFor({ timeout: 15000 });
  // The sidebar is a drawer on mobile; hash routing is the shared navigation contract.
  const navigation = page.getByRole("button", { name: "Inbox", exact: true }).first();
  if (await navigation.isVisible()) await navigation.click();
  else await page.evaluate(() => { window.location.hash = "inbox"; });
  await page.getByRole("region", { name: "Inbox" }).waitFor();
  await page.getByLabel("Lista de conversas").first().waitFor();
  return { records, threads };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome", headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  desktop.on("pageerror", error => errors.push(error.message));
  await mockWorkspace(desktop);
  await desktop.getByRole("button", { name: "Minhas" }).click();
  await desktop.getByRole("button", { name: /Pedido inicial/ }).waitFor();
  await desktop.getByRole("button", { name: /Conversa resolvida/ }).waitFor({ state: "detached", timeout: 10000 });
  assert.equal(await desktop.getByRole("button", { name: /Conversa resolvida/ }).count(), 0, "Mine filter excludes unassigned conversations");
  await desktop.getByRole("button", { name: "Não atribuídas" }).click();
  await desktop.getByRole("button", { name: /Conversa resolvida/ }).waitFor();
  await desktop.getByRole("button", { name: /Pedido inicial/ }).waitFor({ state: "detached", timeout: 10000 });
  assert.equal(await desktop.getByRole("button", { name: /Pedido inicial/ }).count(), 0, "Unassigned filter excludes owned conversations");
  await desktop.getByRole("group", { name: "Filtrar conversas por responsável" }).getByRole("button", { name: "Todas" }).click();
  await desktop.getByRole("button", { name: /Pedido inicial/ }).click();
  await desktop.getByText("Olá, preciso de ajuda").waitFor();
  await desktop.getByRole("heading", { name: "Ana Exemplo" }).waitFor();
  await desktop.getByText("Prefere contato pela manhã").waitFor();
  await desktop.getByText("Empresa Exemplo", { exact: true }).waitFor();
  await desktop.getByText("VIP", { exact: true }).waitFor();
  console.log("PASS: server-filtered Mine/Unassigned/All queues and authorized CRM notes/context");
  assert.equal(await desktop.locator("#inbox-composer").isDisabled(), false);
  console.log("PASS: Desktop Inbox opens thread with authorized agent composer");

  await desktop.locator("#inbox-composer").fill("Resposta em rascunho");
  await desktop.getByRole("button", { name: "Nota interna" }).click();
  assert.equal(await desktop.locator("#inbox-composer").inputValue(), "", "Each mode has its own draft");
  await desktop.locator("#inbox-composer").fill("Nota em rascunho");
  await desktop.getByRole("button", { name: "Resposta" }).click();
  assert.equal(await desktop.locator("#inbox-composer").inputValue(), "Resposta em rascunho");
  await desktop.getByRole("button", { name: /Conversa resolvida/ }).click();
  await desktop.getByRole("button", { name: /Pedido inicial/ }).click();
  assert.equal(await desktop.locator("#inbox-composer").inputValue(), "Resposta em rascunho");
  await desktop.locator("#inbox-composer").press("Control+Enter");
  await desktop.getByText("Resposta em rascunho", { exact: true }).waitFor();
  await desktop.waitForFunction(() => document.querySelector("#inbox-composer")?.value === "");
  await desktop.getByRole("button", { name: "Nota interna" }).click();
  assert.equal(await desktop.locator("#inbox-composer").inputValue(), "Nota em rascunho");
  await desktop.getByRole("button", { name: "Resposta" }).click();
  console.log("PASS: per-conversation, per-mode ephemeral drafts and Ctrl+Enter send");
  await desktop.route("**/v1/tenants/**/inbox/conversations/*/replies", route =>
    route.fulfill({status:503, contentType:"application/json", body:JSON.stringify({message:"Falha temporária, tente novamente"})}), {times:1});
  await desktop.locator("#inbox-composer").fill("Rascunho não pode sumir");
  await desktop.locator("#inbox-composer").press("Control+Enter");
  await desktop.getByText("Falha temporária, tente novamente").waitFor();
  assert.equal(await desktop.locator("#inbox-composer").inputValue(),"Rascunho não pode sumir");
  await desktop.locator("#inbox-composer").press("Control+Enter");
  await desktop.getByText("Rascunho não pode sumir", {exact:true}).waitFor();
  await desktop.waitForFunction(() => document.querySelector("#inbox-composer")?.value === "");
  console.log("PASS: failed API send preserves draft; retry clears only after success");


  await desktop.getByRole("button", { name: "Liberar" }).click();
  await desktop.getByText(/Assuma a conversa antes de responder/).waitFor();
  assert.equal(await desktop.locator("#inbox-composer").isDisabled(), true);
  await desktop.getByRole("button", { name: "Assumir" }).click();
  await desktop.waitForFunction(() => !document.querySelector("#inbox-composer")?.disabled);
  console.log("PASS: release and reclaim conversation gates reply composer");

  await desktop.getByRole("button", { name: "Pendente", exact: true }).click();
  await desktop.getByRole("button", { name: "Aberta", exact: true }).click();
  await desktop.getByRole("button", { name: "Transferir ao bot" }).click();
  await desktop.getByText(/Transfira o atendimento do bot/).waitFor();
  assert.equal(await desktop.locator("#inbox-composer").isDisabled(), true);
  await desktop.getByRole("button", { name: "Transferir ao humano" }).click();
  await desktop.waitForFunction(() => !document.querySelector("#inbox-composer")?.disabled);
  console.log("PASS: status and human/bot handoff state changes");

  await desktop.getByRole("button", { name: "Nota interna" }).click();
  await desktop.locator("#inbox-composer").fill("Nota QA da equipe");
  await desktop.getByRole("button", { name: "Registrar nota" }).click();
  await desktop.getByText("Nota QA da equipe").waitFor();
  await desktop.getByRole("button", { name: "Simular entrada" }).first().click();
  await desktop.locator("#inbox-composer").fill("Mensagem simulada QA");
  await desktop.getByRole("button", { name: "Simular entrada" }).last().click();
  await desktop.getByText("Mensagem simulada QA").waitFor();
  console.log("PASS: note and inbound simulation rendered in history");
  await desktop.getByRole("button", { name: "Resolvida", exact: true }).click();
  await desktop.getByRole("button", { name: "Resposta" }).click();
  assert.equal(await desktop.locator("#inbox-composer").isDisabled(), true);
  await desktop.getByRole("button", { name: "Aberta", exact: true }).click();
  console.log("PASS: resolved conversation blocks replies until reopen");

  await desktop.getByRole("button", { name: "Nova conversa" }).click();
  await desktop.getByRole("dialog").getByLabel("Assunto").fill("Teste de criação na Inbox");
  await desktop.getByRole("dialog").getByRole("button", { name: "Criar conversa" }).click();
  await desktop.getByRole("heading", { name: "Teste de criação na Inbox" }).waitFor();
  await desktop.getByRole("button", { name: /Teste de criação na Inbox/ }).waitFor();
  assert.deepEqual(errors, [], "No browser JavaScript errors");
  console.log("PASS: create conversation opens new thread and updates queue without reload");

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mockWorkspace(mobile);
  await mobile.getByRole("button", { name: /Pedido inicial/ }).click();
  await mobile.getByRole("button", { name: "Ver contexto CRM" }).click();
  await mobile.getByRole("heading", { name: "Ana Exemplo" }).waitFor();
  await mobile.getByRole("button", { name: "Close", exact: true }).click();
  await mobile.getByRole("button", { name: "Voltar para conversas" }).waitFor();
  await mobile.getByRole("button", { name: "Voltar para conversas" }).click();
  await mobile.getByRole("button", { name: /Pedido inicial/ }).waitFor();
  const sizes = await mobile.evaluate(() => ({ scroll: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  assert.ok(sizes.scroll <= sizes.viewport + 3, "No horizontal viewport overflow");
  console.log("PASS: Mobile list/detail/back navigation without horizontal overflow");
  console.log("INBOX_UI_SMOKE_PASS (mocked API/identity, no live credentials or database writes)");
} catch (error) {
  console.error("INBOX_UI_SMOKE_FAIL:", error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
