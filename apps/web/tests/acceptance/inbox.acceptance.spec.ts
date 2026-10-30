import { expect, test } from "@playwright/test";

interface AcceptanceStep {
  step: string;
  status: "passed" | "failed";
  elapsedMs: number;
}

test("Inbox acceptance journey (fake inbound → fila → assignment → reply → note → status → attachment → reconnect)", async ({ page }, testInfo) => {
  test.skip(
    !process.env.E2E_BASE_URL,
    "Set E2E_BASE_URL to an authorized tenant host.",
  );

  const steps: AcceptanceStep[] = [];
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
      console.log(JSON.stringify({ type: "inbox-acceptance-step", ...result }));
    } catch (error) {
      const result = {
        step: name,
        status: "failed" as const,
        elapsedMs: Date.now() - lastStepStarted,
      };
      steps.push(result);
      console.log(JSON.stringify({ type: "inbox-acceptance-step", ...result }));
      throw error;
    }
  }

  async function waitForStepResult(name: string, predicate: () => boolean) {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      if (predicate()) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`Timeout aguardando resultado do passo: ${name}`);
  }

  try {
    await step("login_and_tenant_context", async () => {
      await page.goto("/inbox");
      await expect(page).toHaveURL(/\/inbox$/);
      const login = page.getByRole("button", { name: "Entrar com SSO" });
      if (await login.isVisible().catch(() => false)) {
        await login.click();
        const username = process.env.E2E_KEYCLOAK_USERNAME;
        const password = process.env.E2E_KEYCLOAK_PASSWORD;
        if (!username || !password) {
          throw new Error(
            "SSO credentials are required when no session exists.",
          );
        }
        await page.locator('input[name="username"]').fill(username);
        await page.locator('input[name="password"]').fill(password);
        await page.locator('input[name="password"]').press("Enter");
        const otp = page.locator('input[name="otp"]');
        if (await otp.isVisible().catch(() => false)) {
          if (!process.env.E2E_KEYCLOAK_OTP) {
            throw new Error("MFA OTP is required when the IdP prompts for it.");
          }
          await otp.fill(process.env.E2E_KEYCLOAK_OTP);
          await otp.press("Enter");
        }
      }
      await expect(
        page.getByRole("heading", { name: "Caixa de Entrada" }),
      ).toBeVisible();
    });

    await step("queue_visible", async () => {
      await expect(
        page.getByText(/conversa(s)? na fila/).or(
          page.getByText("Não há conversas na fila."),
        ),
      ).toBeVisible();
    });

    await step("open_conversation", async () => {
      const firstConversation = page
        .getByRole("button")
        .filter({ has: page.getByText(/Conversa sem assunto|Cliente|mensagem/i) })
        .first();
      const hasConversation = await firstConversation
        .isVisible()
        .catch(() => false);
      if (!hasConversation) {
        throw new Error(
          "Fila vazia: nenhuma conversa disponível para abrir (fake inbound não persistiu ou fila não carregou).",
        );
      }
      await firstConversation.click();
      await expect(
        page.getByRole("heading", { name: /Conversa sem assunto|Cliente/ }),
      ).toBeVisible();
      await expect(
        page.getByRole("region", { name: "Timeline" }),
      ).toBeVisible();
    });

    await step("assign_conversation", async () => {
      const assignSelect = page.getByLabel("Atribuir a");
      const agentOptions = assignSelect.locator("option");
      const count = await agentOptions.count();
      if (count <= 1) {
        throw new Error(
          "Nenhum atendente disponível no seletor de atribuição.",
        );
      }
      await assignSelect.selectOption({ index: 1 });
      await expect(
        page.getByText("Conversa atribuída ao atendente."),
      ).toBeVisible();
    });

    await step("send_reply", async () => {
      const replyField = page.getByLabel(/Conteúdo da resposta/i);
      await replyField.fill("Resposta de aceitação do inbox");
      await page.getByRole("button", { name: "Enviar resposta" }).click();
      await expect(
        page.getByText("Resposta enviada com sucesso."),
      ).toBeVisible();
      await expect(
        page.getByText("Resposta de aceitação do inbox"),
      ).toBeVisible();
    });

    await step("save_private_note", async () => {
      const noteField = page.getByLabel(/Nota privada/i);
      await noteField.fill("Nota interna privada de aceitação");
      await page.getByRole("button", { name: "Salvar nota" }).click();
      await expect(page.getByText("Nota privada salva.")).toBeVisible();
      await expect(
        page.locator(".message-note-tag").filter({ hasText: "Nota privada" }),
      ).toBeVisible();
      await expect(
        page.getByText("Nota interna privada de aceitação"),
      ).toBeVisible();
    });

    await step("change_status", async () => {
      const statusSelect = page.getByLabel("Status");
      await statusSelect.selectOption("resolved");
      await expect(page.getByText("Status atualizado.")).toBeVisible();
      await expect(
        page.locator(".conversation-header .state").filter({ hasText: "Resolvido" }),
      ).toBeVisible();
    });

    await step("upload_attachment", async () => {
      const fileInput = page.getByLabel(/anexo/i);
      const file = {
        name: "anexo-aceitacao.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("conteudo de anexo de aceitação"),
      };
      await fileInput.setInputFiles(file);
      await expect(page.getByText("Anexo carregado com sucesso.")).toBeVisible();
      await expect(page.getByText("anexo-aceitacao.txt")).toBeVisible();
    });

    await step("reconnect_refresh", async () => {
      await page.reload();
      await expect(
        page.getByRole("heading", { name: "Caixa de Entrada" }),
      ).toBeVisible();
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
      await waitForStepResult("queue_refresh_after_reconnect", () =>
        page
          .getByText(/conversa(s)? na fila|Não há conversas na fila/)
          .isVisible()
          .catch(() => false),
      );
    });
  } finally {
    const output = JSON.stringify({ journey: "inbox", steps }, null, 2);
    console.log(
      JSON.stringify({
        type: "inbox-acceptance-summary",
        journey: "inbox",
        steps,
      }),
    );
    await testInfo.attach("inbox-acceptance-steps.json", {
      body: output,
      contentType: "application/json",
    });
  }
});
