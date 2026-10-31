import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppWorkspace } from "./whatsapp-workspace";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,test") },
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("WhatsAppWorkspace", () => {
  it("keeps administrative actions and pairing UI hidden while access is pending", async () => {
    let resolveConnection!: (response: Response) => void;
    const pendingConnection = new Promise<Response>((resolve) => {
      resolveConnection = resolve;
    });
    const fetchMock = vi.fn(() => pendingConnection);
    vi.stubGlobal("fetch", fetchMock);
    render(<WhatsAppWorkspace user={{ name: "Admin Teste" }} />);

    expect(screen.getByRole("heading", { name: "Verificando autorização" })).toBeTruthy();
    expect(screen.getByRole("status").textContent).toMatch(/Aguardando a verificação/);
    expect(
      screen.queryByRole("button", { name: "Gerar QR de pareamento" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirmar conexão" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconectar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desconectar" })).toBeNull();
    expect(
      screen.queryByAltText("QR code temporário para parear o WhatsApp"),
    ).toBeNull();
    expect(screen.queryByText(/QR temporário aparece aqui/)).toBeNull();

    await act(async () => {
      resolveConnection(
        json({
          provider: "whatsmeow",
          status: "disconnected",
          phoneExternalId: null,
          updatedAt: null,
        }),
      );
    });

    expect(
      screen.getByRole("button", { name: "Gerar QR de pareamento" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reconectar" })).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps administrative actions and pairing UI absent after connection 403", async () => {
    const fetchMock = vi.fn(async () =>
      json(
        {
          code: "forbidden",
          pairingCode: "server-private-qr-data",
          detail: "secret",
        },
        403,
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<WhatsAppWorkspace user={{ name: "Admin Teste" }} />);

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Somente administradores",
    );
    expect(screen.getByRole("heading", { name: "Configuração indisponível" })).toBeTruthy();
    expect(screen.queryByText("Desconectado")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Gerar QR de pareamento" }),
    ).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Confirmar conexão" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconectar" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Desconectar" })).toBeNull();
    expect(
      screen.queryByAltText("QR code temporário para parear o WhatsApp"),
    ).toBeNull();
    expect(screen.queryByText(/QR temporário aparece aqui/)).toBeNull();
    expect(screen.queryByText(/server-private-qr-data|secret/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/whatsapp/connection",
      expect.any(Object),
    );
  });

  it("renders the standardized connection state and operator", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json({
          provider: "fake",
          status: "disconnected",
          phoneExternalId: null,
          updatedAt: null,
        }),
      ),
    );
    render(<WhatsAppWorkspace user={{ name: "Admin Teste" }} />);
    expect(await screen.findAllByText("Desconectado")).toHaveLength(2);
    expect(screen.getByText("Admin Teste")).toBeTruthy();
    expect(screen.queryByText("Provider")).toBeNull();
    expect(screen.queryByText("fake")).toBeNull();
    expect(screen.queryByText("whatsmeow")).toBeNull();
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

  it("requests a renewed QR automatically when the current QR expires", async () => {
    vi.useFakeTimers();
    const pairing1 = {
      pairingCode: "code-1",
      expiresAt: new Date(Date.now() + 1200).toISOString(),
    };
    const pairing2 = {
      pairingCode: "code-2",
      expiresAt: new Date(Date.now() + 120000).toISOString(),
    };
    let pairingCalls = 0;
    let resolveRenewal!: (response: Response) => void;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/pairing") && init?.method === "POST") {
          pairingCalls += 1;
          if (pairingCalls === 1) return json(pairing1);
          return new Promise<Response>((resolve) => {
            resolveRenewal = resolve;
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

    // Flush the initial /connection fetch so the page is interactive.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    fireEvent.click(
      screen.getByRole("button", { name: "Gerar QR de pareamento" }),
    );
    // Flush the microtask chain of the initial pairing generation.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    expect(screen.getByAltText("QR code temporário para parear o WhatsApp")).toBeTruthy();
    expect(pairingCalls).toBe(1);

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(
      screen.queryByAltText("QR code temporário para parear o WhatsApp"),
    ).toBeNull();
    expect(screen.queryByText(/QR expirado/)).toBeTruthy();

    await act(async () => {
      resolveRenewal(json(pairing2));
    });
    // Flush every microtask round of the async renewal chain.
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    expect(pairingCalls).toBe(2);
    expect(screen.getByAltText("QR code temporário para parear o WhatsApp")).toBeTruthy();
    expect(screen.queryByText(/QR expirado/)).toBeNull();
    expect(screen.queryByText("private-qr-payload")).toBeNull();
    expect(screen.queryByText("code-1")).toBeNull();
    expect(screen.queryByText("code-2")).toBeNull();
    vi.useRealTimers();
  });

  it("keeps expired state and manual recovery when renewal fails", async () => {
    vi.useFakeTimers();
    const pairing1 = {
      pairingCode: "code-1",
      expiresAt: new Date(Date.now() + 1200).toISOString(),
    };
    let pairingCalls = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/pairing") && init?.method === "POST") {
          pairingCalls += 1;
          if (pairingCalls === 1) {
            return json(pairing1);
          }
          return json({ code: "forbidden" }, 403);
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

    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    fireEvent.click(
      screen.getByRole("button", { name: "Gerar QR de pareamento" }),
    );
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    expect(screen.getByAltText("QR code temporário para parear o WhatsApp")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    for (let i = 0; i < 8; i += 1) {
      await act(async () => {});
    }

    expect(screen.queryByText(/QR expirado/)).toBeTruthy();
    expect(screen.queryByAltText("QR code temporário para parear o WhatsApp")).toBeNull();
    expect(screen.queryByText("code-1")).toBeNull();
    expect(screen.getByRole("button", { name: "Gerar QR de pareamento" })).toBeTruthy();
    vi.useRealTimers();
  });

  it("does not expose pairing QR data when the server denies pairing", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/pairing") && init?.method === "POST") {
          return json(
            {
              code: "forbidden",
              pairingCode: "server-private-qr-data",
              detail: "secret",
            },
            403,
          );
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
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Somente administradores",
    );
    expect(
      screen.queryByAltText("QR code temporário para parear o WhatsApp"),
    ).toBeNull();
    expect(screen.queryByText(/server-private-qr-data|secret/)).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/whatsapp/pairing",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("clears stale pairing controls when the session expires during pairing", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input).endsWith("/pairing") && init?.method === "POST") {
          return json({ code: "unauthorized" }, 401);
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

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Sua sessão expirou",
    );
    expect(
      screen.getByRole("heading", { name: "Configuração indisponível" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Gerar QR de pareamento" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Reconectar" })).toBeNull();
    expect(screen.queryByText(/QR temporário aparece aqui/)).toBeNull();
  });

  it.each([
    {
      label: "connected",
      connection: {
        provider: "whatsmeow",
        status: "connected",
        phoneExternalId: "+5511999999999",
        authorized: true,
        serviceEnabled: true,
        updatedAt: "2026-10-30T12:00:00.000Z",
      },
      expected: "Conectado",
      detail: "+5511999999999",
      action: "Desconectar",
    },
    {
      label: "suspended",
      connection: {
        provider: "whatsmeow",
        status: "suspended",
        phoneExternalId: "+5511999999999",
        authorized: true,
        serviceEnabled: false,
        suspensionReason: "delinquency",
        updatedAt: "2026-10-30T12:00:00.000Z",
      },
      expected: "Suspenso",
      detail: "Suspenso por inadimplência",
      action: null,
    },
    {
      label: "error",
      connection: {
        provider: "whatsmeow",
        status: "error",
        phoneExternalId: null,
        authorized: false,
        serviceEnabled: false,
        updatedAt: null,
      },
      expected: "Atenção necessária",
      detail: "Ainda não vinculada",
      action: "Reconectar",
    },
  ])("presents approved $label connection information", async (scenario) => {
    vi.stubGlobal("fetch", vi.fn(async () => json(scenario.connection)));
    render(<WhatsAppWorkspace user={{ name: "Tenant Admin" }} />);

    expect(await screen.findAllByText(scenario.expected)).toHaveLength(2);
    expect(screen.getByText(scenario.detail)).toBeTruthy();
    if (scenario.action) {
      expect(screen.getByRole("button", { name: scenario.action })).toBeTruthy();
    }
    if (scenario.label === "suspended") {
      expect(
        screen.getByText(/sessão foi preservada e será reativada automaticamente/),
      ).toBeTruthy();
    }
    expect(screen.queryByText("whatsmeow")).toBeNull();
  });
});
