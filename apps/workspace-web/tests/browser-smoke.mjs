import assert from "node:assert/strict";
import { chromium } from "playwright";

const origin = process.env.SYNDES_SMOKE_ORIGIN ?? "https://delmacy-desktoppc.tayra-delta.ts.net:9443";
const password = process.env.SYNDES_PREVIEW_PASSWORD;
if (!password) {
  console.error("Set SYNDES_PREVIEW_PASSWORD locally before running this smoke test.");
  process.exit(2);
}
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];
let step = "initialization";
try {
  const context = await browser.newContext({
    httpCredentials: { username: "syndes-demo", password },
    ignoreHTTPSErrors: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  step = "open protected Workspace";
  const response = await page.goto(origin + "/", { waitUntil: "domcontentloaded", timeout: 30000 });
  assert.equal(response?.status(), 200, "Workspace should be served via HTTPS after Basic Auth");
  await page.getByRole("heading", { name: /Bem-vindo ao/ }).waitFor({ timeout: 20000 });
  console.log("PASS: HTTPS Workspace shell rendered");
  step = "begin OIDC login";
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await page.waitForURL(/:9444\/realms\/syndes\//, { timeout: 25000 });
  await page.locator("#username").fill("syndes-demo");
  await page.locator("#password").fill(password);
  await page.locator("#kc-login").click();
  step = "complete PKCE callback and load dashboard";
  await page.waitForURL((u) => u.origin === origin && !u.searchParams.has("code"), { timeout: 30000 });
  await page.getByText("Contatos no CRM").waitFor({ timeout: 20000 });
  await page.waitForFunction(() => { const p = [...document.querySelectorAll("p")].find(e => e.textContent?.includes("Contatos no CRM")); return p?.parentElement?.querySelector("strong")?.textContent?.trim().match(/^\d+$/); }, { timeout: 30000 });
  console.log("PASS: Keycloak OIDC login with PKCE, API dashboard loaded");
  step = "CRM navigation";
  await page.getByRole("button", { name: "CRM", exact: true }).first().click();
  await page.getByRole("heading", { name: "CRM", exact: true }).waitFor();
  await page.getByRole("button", { name: "Novo contato" }).waitFor();
  console.log("PASS: CRM view and create control");
  step = "Inbox navigation";
  await page.getByRole("button", { name: "Inbox", exact: true }).first().click();
  await page.getByRole("heading", { name: "Inbox", exact: true }).waitFor();
  await page.getByRole("button", { name: "Nova conversa" }).waitFor();
  console.log("PASS: Inbox view and create control");
  step = "logout";
  await page.getByRole("button", { name: "Sair" }).click();
  await page.getByRole("button", { name: "Entrar", exact: true }).waitFor();
  console.log("PASS: local session logout clears authenticated state");
  assert.deepEqual(errors, [], "Browser JavaScript errors");
  console.log("BROWSER_WORKSPACE_SMOKE_PASS");
  await context.close();
} catch (err) {
  console.error("BROWSER_WORKSPACE_SMOKE_FAIL at", step, "-", err.message);
  process.exitCode = 1;
} finally {
  await browser.close();
}
