import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { NextAuthRequest } from "next-auth";

/**
 * INBOX-06-R3-F2 — Prova executável: Next.js App Router route handlers NÃO
 * suportam upgrade bruto de WebSocket.
 *
 * Esta prova demonstra que a rota ponte em `route.ts`:
 * 1. Exporta apenas manipuladores de método HTTP (GET/HEAD/POST/PUT/PATCH/DELETE)
 *    — não há manipulador de upgrade WebSocket.
 * 2. Mesmo com sessão autenticada válida, responde 501
 *    (`websocket_upgrade_not_supported`) em vez de 101 (Switching Protocols),
 *    provando que não estabelece um WebSocket real.
 *
 * Como consequência, não é possível implementar a ponte de upgrade dentro deste
 * `route.ts` usando apenas as APIs públicas do Next.js. É necessário um servidor
 * dedicado ou proxy de mesma origem (veja
 * docs/engineering/tasks/PRD-002/INBOX-06-R3-F2-server02-proposal.md).
 */

vi.mock("@/auth", () => ({
  // `auth()` passa o handler adiante sem NextAuth, permitindo exercer `forward()`
  // diretamente com uma sessão sintética.
  auth: (handler: (req: NextAuthRequest) => Promise<Response>) => handler,
}));

import * as routeModule from "./route";
import { GET } from "./route";

type GetHandler = (req: NextAuthRequest) => Promise<Response>;
const getHandler = GET as unknown as GetHandler;

const ORIGIN = "http://localhost:3000";
const API_BASE = "http://localhost:3001";

function fakeRequest(overrides: Partial<NextAuthRequest> = {}): NextAuthRequest {
  const base: NextAuthRequest = {
    method: "GET",
    headers: new Headers(),
    nextUrl: new URL(`${ORIGIN}/api/backend/inbox/realtime`),
    auth: { accessToken: "test-access-token" },
    ...overrides,
  } as NextAuthRequest;
  return base;
}

describe("Prova: App Router route handler não faz upgrade WebSocket", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubEnv("SYNDES_API_URL", API_BASE);
    vi.stubEnv("INGRESS_SIGNING_SECRET", "proof-secret");
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it("exporta apenas GET (maneiro HTTP), nenhum de upgrade WebSocket", () => {
    const exports = Object.keys(routeModule);
    expect(exports).toEqual(["GET"]);
    const wsExports = exports.filter((e) => /websocket|upgrade|socket/i.test(e));
    expect(wsExports).toEqual([]);
  });

  it("com sessão válida responde 501 (não 101 Switching Protocols)", async () => {
    const response = await getHandler(fakeRequest());
    expect(response.status).toBe(501);
    expect(response.status).not.toBe(101);
    const body = await response.json();
    expect(body.error).toBe("websocket_upgrade_not_supported");
    expect(body.detail).toContain(
      "Next.js App Router route handlers do not expose the HTTP upgrade event",
    );
    expect(body.target).toBe(`${API_BASE}/api/v1/inbox/realtime`);
  });

  it("não coloca token nem tenant na URL de destino do backend", async () => {
    const response = await getHandler(fakeRequest());
    const body = await response.json();
    expect(body.target).not.toContain("access_token");
    expect(body.target).not.toContain("token");
    expect(body.target).not.toContain("tenant");
    expect(body.target).not.toContain("database");
  });

  it("rejeita seletor de tenant na query (falha fechada, 400)", async () => {
    const req = fakeRequest();
    (req.nextUrl as URL).searchParams.set("tenant", "tenant-x");
    const response = await getHandler(req);
    expect(response.status).toBe(400);
  });
});
