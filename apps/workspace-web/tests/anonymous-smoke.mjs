import assert from "node:assert/strict";
import { chromium } from "playwright";

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH ?? "/usr/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
  headless: true,
});
try {
  const page = await browser.newPage({ viewport: { width: 1366, height: 850 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  const res = await page.goto(process.env.SYNDES_UI_ORIGIN ?? "http://127.0.0.1:18084/", { waitUntil: "domcontentloaded" });
  assert.equal(res.status(), 200);
  await page.getByRole("heading", { name: /Bem-vindo ao/ }).waitFor();
  await page.getByRole("button", { name: "CRM", exact: true }).first().click();
  await page.getByRole("heading", { name: "Acesso protegido" }).waitFor();
  await page.getByRole("button", { name: "Inbox", exact: true }).first().click();
  await page.getByRole("heading", { name: "Acesso protegido" }).waitFor();
  assert.deepEqual(errors, []);
  console.log("ANONYMOUS_SHELL_SMOKE_PASS: HTML, navigation, CRM+Inbox guard, no JS errors");
} finally {
  await browser.close();
}
