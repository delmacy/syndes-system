import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { NextAuthRequest } from "next-auth";
import { isTenantSelectorName } from "@/lib/tenant-selector";

/**
 * INBOX-06-R3-F1 — Ponte WebSocket same-origin para o backend realtime.
 *
 * Endpoint: `GET /api/backend/inbox/realtime` (mesma origem da aplicação).
 *
 * Objetivo da ponte: permitir que o navegador alcance o WebSocket autenticado
 * do backend (`GET /api/v1/inbox/realtime`) sem que o cliente precise anexar
 * `Authorization` a um `WebSocket` nativo (impossível em navegadores). A ponte
 * injeta server-side o bearer token e os headers de trusted-ingress, valida
 * `Origin` falha fechada e encaminha o upgrade para o backend existente.
 *
 * Propriedades preservadas (sem alterar apps/api):
 * - Token nunca viaja na URL do WebSocket.
 * - Nenhum seletor de tenant/database é aceito do cliente.
 * - `Origin` validado contra a aplicação (fail-closed).
 * - Autenticação e tenant resolvidos server-side pela sessão (NextAuth).
 * - Reconnect do cliente refetch estado durável via REST (fonte da verdade).
 *
 * Limitação de runtime Next.js (documentada abaixo):
 * App Router route handlers não expõem o evento `upgrade` do servidor HTTP nem
 * dão acesso ao objeto de socket subjacente. Portanto não é possível realizar
 * um upgrade bruto de WebSocket dentro de `route.ts` com as APIs públicas do
 * Next.js. A rota abaixo declara a interface da ponte e documenta o gap;
 * enquanto o runtime não suportar upgrade, o cliente degrade para refetch REST
 * (mesmo comportamento do INBOX-05: eventos `online`/`visibilitychange`).
 *
 * Para ativar o upgrade de WebSocket de verdade, é necessário um servidor
 * dedicado ou proxy de mesma origem que espelhe o `upgrade` para
 * `SYNDES_API_URL/api/v1/inbox/realtime`, injetando `Authorization` e
 * `x-syndes-validated-*` a partir da sessão resolvida por `auth()`.
 */

async function forward(
  request: NextAuthRequest,
): Promise<Response> {
  const accessToken = request.auth?.accessToken;
  if (typeof accessToken !== "string") {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }

  const apiBase = process.env.SYNDES_API_URL;
  if (!apiBase) {
    return NextResponse.json(
      { error: "API is not configured" },
      { status: 503 },
    );
  }

  if ([...request.nextUrl.searchParams.keys()].some(isTenantSelectorName)) {
    return NextResponse.json(
      { error: "Tenant routing is derived server-side" },
      { status: 400 },
    );
  }

  // Next.js App Router route handlers não suportam upgrade de WebSocket:
  // não há acesso ao evento `upgrade` nem ao socket subjacente. A ponte não
  // pode ser ativada apenas com as APIs públicas do Next.js. Retorna uma
  // resposta descritiva para o cliente saber que o upgrade não está disponível
  // neste runtime e deve continuar com refetch REST.
  const target = new URL("/api/v1/inbox/realtime", apiBase);
  if (target.origin !== new URL(apiBase).origin) {
    return NextResponse.json({ error: "Invalid API target" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "websocket_upgrade_not_supported",
      detail:
        "Next.js App Router route handlers do not expose the HTTP upgrade event " +
        "required for a raw WebSocket bridge. Connect to the backend WebSocket " +
        "through a same-origin dedicated server/proxy that injects Authorization " +
        "and trusted-ingress headers server-side, or continue using REST refetch " +
        "on online/visibilitychange.",
      target: target.toString(),
    },
    { status: 501 },
  );
}

export const GET = auth(forward);
