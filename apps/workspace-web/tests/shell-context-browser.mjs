import assert from "node:assert/strict";
import { chromium } from "playwright";

/** One signed-in browser fixture verifies the shell changes scoped requests,
 * clears prior CRM data, and never manufactures an unavailable frontend module.
 * It never connects to Keycloak or operational tenant databases.
 */
const origin = process.env.SYNDES_FC01_ORIGIN ?? "http://127.0.0.1:18095";
const issuer = "https://auth.fc01.invalid/realms/syndes";
const tenantId = "10000000-0000-4000-8000-000000000001";
const orgA = "20000000-0000-4000-8000-000000000001";
const orgB = "20000000-0000-4000-8000-000000000002";
const wsA = "30000000-0000-4000-8000-000000000001";
const wsB = "30000000-0000-4000-8000-000000000002";
const token = ["header",Buffer.from(JSON.stringify({sub:"fc01-test-user"})).toString("base64url"),"signature"].join(".");
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true, args: ["--no-sandbox","--disable-dev-shm-usage"],
});
const context = await browser.newContext({viewport: {width: 1366,height:850}});
const page = await context.newPage();
const errors = [];
const crmHeaders = [];
const sseHeaders = [];
let holdNextA = false;
let resolveOldA;
let notifyOldA;
const oldAStarted = new Promise(resolve => { notifyOldA = resolve; });
page.on("pageerror", error => errors.push(error.message));
try {
  await page.addInitScript(() => {
    sessionStorage.setItem("syndes.workspace.pkce",JSON.stringify({
      verifier:"fc01-test-verifier",state:"fc01-state",created:Date.now(),returnHash:"#crm",
    }));
  });
  await page.route("**/workspace-runtime.json",route => route.fulfill({
    status:200, contentType:"application/json",
    body: JSON.stringify({issuer,clientId:"syndes-workspace-ui",tenantId,tenantLabel:"Tenant FC01"}),
  }));
  await page.route("https://auth.fc01.invalid/**",route => route.fulfill({
    status:200, headers:{"Access-Control-Allow-Origin":"*"},
    contentType:"application/json",body:JSON.stringify({access_token:token}),
  }));
  await page.route("**/v1/tenants/**",async route => {
    const req=route.request();
    const url=new URL(req.url());
    const path=url.pathname;
    const headers=req.headers();
    const org=headers["x-syndes-organization-id"];
    const workspace=headers["x-syndes-workspace-id"];
    if (path.endsWith("/platform/organizations")) {
      return route.fulfill({json:[
        {id:orgA,display_name:"Empresa A",is_default:true,status:"active"},
        {id:orgB,display_name:"Empresa B",is_default:false,status:"active"},
      ]});
    }
    if (path.endsWith("/platform/organizations/"+orgA+"/workspaces")) {
      return route.fulfill({json:[{id:wsA,organization_id:orgA,name:"Atendimento A",is_default:true,status:"active"}]});
    }
    if (path.endsWith("/platform/organizations/"+orgB+"/workspaces")) {
      return route.fulfill({json:[{id:wsB,organization_id:orgB,name:"Atendimento B",is_default:false,status:"active"}]});
    }
    if (path.endsWith("/crm/capabilities")) return route.fulfill({json:{"people.read":true,"organizations.read":true}});
    if (path.endsWith("/crm/people")) {
      crmHeaders.push({org,workspace});
      const entry=org===orgB?"Contato Exclusivo B":"Contato Exclusivo A";
      if (holdNextA && org===orgA) {
        holdNextA = false;
        notifyOldA();
        await new Promise(resolve => { resolveOldA = resolve; });
      }
      try {
        return await route.fulfill({json:[{id:org===orgB?"person-b":"person-a",name:entry,email:"user@example.test"}]});
      } catch {
        // Expected: aborting the old scope can cancel this intercepted request.
        return;
      }
    }
    if (path.endsWith("/inbox/events")) {
      sseHeaders.push({org,workspace});
      return route.fulfill({
        status:200,headers:{"content-type":"text/event-stream"},
        body:"event: changed\ndata: {}\n\n",
      });
    }
    if (path.endsWith("/inbox/metrics")) return route.fulfill({json:{open:0,pending:0,resolved:0,unassigned:0}});
    return route.fulfill({json:[]});
  });
  await page.goto(origin+"/?code=fc01-code&state=fc01-state", {waitUntil:"domcontentloaded"});
  const selector=page.getByRole("combobox",{name:"Organização e workspace ativos"});
  await selector.waitFor();
  assert.equal(await selector.inputValue(),orgA+":"+wsA);
  await page.getByText("Contato Exclusivo A").first().waitFor();
  // Stall a previous-scope GET while switching workspaces, then deliver the
  // old response after the new workspace has already rendered its CRM.
  holdNextA = true;
  await page.getByRole("button",{name:"Atualizar CRM"}).click();
  await oldAStarted;
  await selector.selectOption(orgB+":"+wsB);
  await page.getByText("Contato Exclusivo B").first().waitFor();
  resolveOldA();
  await page.waitForTimeout(120);
  assert.equal(await page.getByText("Contato Exclusivo A").count(),0,
    "old organization CRM data must be unmounted after changing workspace");
  assert.ok(crmHeaders.some(x=>x.org===orgA && x.workspace===wsA),"A scoped request");
  assert.ok(crmHeaders.some(x=>x.org===orgB && x.workspace===wsB),"B scoped request");
  // Inbox SSE must reconnect with the current workspace scope after a switch.
  const sseB=page.waitForRequest(req => req.url().endsWith("/inbox/events") &&
    req.headers()["x-syndes-workspace-id"]===wsB);
  await page.getByRole("button",{name:"Inbox",exact:true}).first().click();
  await page.locator('section[aria-label="Inbox"]').waitFor();
  await sseB;
  assert.ok(sseHeaders.some(x=>x.org===orgB && x.workspace===wsB),"SSE belongs to B");
  const sseA=page.waitForRequest(req => req.url().endsWith("/inbox/events") &&
    req.headers()["x-syndes-workspace-id"]===wsA);
  await selector.selectOption(orgA+":"+wsA);
  await page.locator('section[aria-label="Inbox"]').waitFor();
  await sseA;
  assert.ok(sseHeaders.some(x=>x.org===orgA && x.workspace===wsA),"SSE reconnects under A");
  await page.getByLabel("Ambiente e conta").click();
  await page.getByRole("button",{name:"Sair"}).click();
  await page.getByRole("heading",{name:"Acesso protegido"}).waitFor();
  assert.equal(await page.getByRole("combobox",{name:"Organização e workspace ativos"}).count(),0);
  assert.equal(await page.getByText("Contato Exclusivo B").count(),0);
  await page.evaluate(()=>{location.hash="#made-up-module"});
  await page.getByRole("heading",{name:"Bem-vindo ao Tenant FC01"}).waitFor();
  assert.deepEqual(errors,[],"no JavaScript page errors");
  console.log("FC01_CONTEXT_BROWSER_PASS: A/B scope isolation, delayed GET ignored, SSE B→A reconnect, logout cleanup, unknown-view fallback");
} finally {
  await context.close();
  await browser.close();
}
