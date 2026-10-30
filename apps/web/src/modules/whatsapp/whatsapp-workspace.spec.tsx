import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppWorkspace } from "./whatsapp-workspace";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,test") },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("WhatsAppWorkspace", () => {
  it("renders the standardized connection state and operator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          provider: "whatsmeow",
          status: "disconnected",
          phoneExternalId: null,
          updatedAt: null,
        }),
      ),
    );
    render(<WhatsAppWorkspace user={{ name: "Admin Teste" }} />);
    expect(await screen.findAllByText("Desconectado")).toHaveLength(2);
    expect(screen.getByText("Admin Teste")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Gerar QR de pareamento" }),
    ).toBeTruthy();
  });

  it("generates and renders a temporary pairing QR", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/pairing") && init?.method === "POST") {
          return json({
            pairingCode: "private-qr-payload",
            expiresAt: "2026-10-30T12:05:00.000Z",
          });
        }
        return json({
          provider: "whatsmeow",
          status: "disconnected",
          phoneExternalId: null,
          updatedAt: null,
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<WhatsAppWorkspace />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Gerar QR de pareamento" }),
    );
    expect(
      await screen.findByAltText("QR code temporário para parear o WhatsApp"),
    ).toBeTruthy();
    expect(screen.queryByText("private-qr-payload")).toBeNull();
  });

  it("surfaces server authorization failures without leaking response details", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ code: "forbidden", detail: "secret" }, 403)),
    );
    render(<WhatsAppWorkspace />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Somente administradores",
    );
    await waitFor(() => expect(screen.queryByText("secret")).toBeNull());
  });
});
