import { expect, test } from "@playwright/test";

interface AcceptanceStep {
  step: string;
  status: "passed" | "failed";
  elapsedMs: number;
}

test("Core CRM acceptance journey", async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_BASE_URL,
    "Set E2E_BASE_URL to an authorized tenant host.",
  );
  const steps: AcceptanceStep[] = [];
  const recordName = `Syndes E2E Person ${Date.now()}`;
  const organizationName = `Syndes E2E Org ${Date.now()}`;
  let lastStepStarted = Date.now();

  async function step(name: string, action: () => Promise<void>) {
    lastStepStarted = Date.now();
    try {
      await action();
      const result = {
        step: name,
        status: "passed" as const,
        elapsedMs: Date.now() - lastStepStarted,
      };
      steps.push(result);
      console.log(JSON.stringify({ type: "crm-acceptance-step", ...result }));
    } catch (error) {
      const result = {
        step: name,
        status: "failed" as const,
        elapsedMs: Date.now() - lastStepStarted,
      };
      steps.push(result);
      console.log(JSON.stringify({ type: "crm-acceptance-step", ...result }));
      throw error;
    }
  }

  try {
    await step("login_and_tenant_context", async () => {
      await page.goto("/crm");
      const login = page.getByRole("button", { name: "Entrar com SSO" });
      if (await login.isVisible().catch(() => false)) {
        await login.click();
        const username = process.env.E2E_KEYCLOAK_USERNAME;
        const password = process.env.E2E_KEYCLOAK_PASSWORD;
        if (!username || !password)
          throw new Error(
            "SSO credentials are required when no session exists.",
          );
        await page.locator('input[name="username"]').fill(username);
        await page.locator('input[name="password"]').fill(password);
        await page.locator('input[name="password"]').press("Enter");
        const otp = page.locator('input[name="otp"]');
        if (await otp.isVisible().catch(() => false)) {
          if (!process.env.E2E_KEYCLOAK_OTP)
            throw new Error("MFA OTP is required when the IdP prompts for it.");
          await otp.fill(process.env.E2E_KEYCLOAK_OTP);
          await otp.press("Enter");
        }
      }
      await expect(page.getByRole("heading", { name: "Busca" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Equipe" })).toBeVisible();
      await expect(page.getByText("Sessão segura · BOTH")).toBeVisible();
    });

    await step("create_organization", async () => {
      await page.getByRole("button", { name: "Organizações" }).click();
      await page.getByLabel("Razão / nome").fill(organizationName);
      await page.getByRole("button", { name: "Criar cadastro" }).click();
      await expect(
        page.getByRole("button", { name: new RegExp(organizationName) }),
      ).toBeVisible();
    });

    await step("create_person_and_relationship", async () => {
      await page.getByRole("button", { name: "Pessoas" }).click();
      await page.getByLabel("Nome completo").fill(recordName);
      await page
        .getByLabel(/Organização PJ/)
        .selectOption({ label: organizationName });
      await page.getByRole("button", { name: "Criar cadastro" }).click();
      await expect(
        page.getByRole("heading", { name: recordName }),
      ).toBeVisible();
      await expect(page.getByText(organizationName)).toBeVisible();
    });

    await step("tag_and_note", async () => {
      await page.getByLabel("Nova tag").fill("e2e-acceptance");
      await page.getByRole("button", { name: "Adicionar" }).click();
      await page.getByLabel("Nova nota").fill("Acceptance interaction note");
      await page.getByRole("button", { name: "Salvar" }).click();
      await expect(page.getByText("Nota adicionada.")).toBeVisible();
    });

    await step("search_and_timeline", async () => {
      await page.getByRole("button", { name: "Busca" }).click();
      await page.getByLabel(/Buscar pessoas/).fill(recordName);
      await page.getByRole("button", { name: "Buscar" }).click();
      await page.getByRole("button", { name: new RegExp(recordName) }).click();
      await expect(page.getByText("person.created")).toBeVisible();
      await expect(page.getByText("note.created")).toBeVisible();
      await expect(page.getByText("tag.attached")).toBeVisible();
    });

    await step("archive_and_csv_export", async () => {
      await page.getByRole("button", { name: "Pessoas" }).click();
      await page.getByRole("button", { name: new RegExp(recordName) }).click();
      await page.getByRole("button", { name: "Arquivar" }).click();
      await page.getByRole("button", { name: "CSV" }).click();
      const download = page.waitForEvent("download");
      await page.getByRole("button", { name: "Baixar CSV" }).click();
      expect((await download).suggestedFilename()).toContain("crm-people.csv");
    });
  } finally {
    const output = JSON.stringify({ journey: "core-crm", steps }, null, 2);
    console.log(
      JSON.stringify({
        type: "crm-acceptance-summary",
        journey: "core-crm",
        steps,
      }),
    );
    await testInfo.attach("core-crm-acceptance-steps.json", {
      body: output,
      contentType: "application/json",
    });
  }
});
