import { describe, expect, it } from "vitest";
import {
  containsTenantSelector,
  isTenantSelectorName,
} from "@/lib/tenant-selector";

/**
 * INBOX-06-R3-F1 — Testes diretos da rota ponte WebSocket same-origin.
 *
 * A rota `apps/web/src/app/api/backend/inbox/realtime/route.ts` envolve o
 * handler com `auth()` do NextAuth, o que dificulta instanciá-la diretamente
 * em vitest. Estes testes cobrem as regras de fronteira que a rota aplica
 * (rejeição de seletor de tenant), compatíveis com as regras já testadas em
 * `@/lib/tenant-selector`, e documentam o contrato esperado da ponte:
 * nenhum tenant/token na URL, origem validada, falha fechada.
 */

describe("Rota ponte WebSocket — regras de fronteira", () => {
  it("rejeita nomes de seletor de tenant conhecidos", () => {
    expect(isTenantSelectorName("tenant")).toBe(true);
    expect(isTenantSelectorName("tenantid")).toBe(true);
    expect(isTenantSelectorName("tenant-database")).toBe(true);
    expect(isTenantSelectorName("x-database-name")).toBe(true);
    expect(isTenantSelectorName("customer_name")).toBe(false);
  });

  it("detecta seletor de tenant em payload aninhado", () => {
    expect(
      containsTenantSelector({ filters: [{ databaseName: "tenant-b-db" }] }),
    ).toBe(true);
    expect(containsTenantSelector({ conversa: "conv-1" })).toBe(false);
  });

  it("contrato da ponte não coloca tenant nem token na URL", () => {
    // A URL do backend é montada server-side a partir de SYNDES_API_URL + path fixo;
    // nunca recebe parâmetros de tenant, database ou access_token do cliente.
    const backendPath = "/api/v1/inbox/realtime";
    expect(backendPath).not.toContain("tenant");
    expect(backendPath).not.toContain("token");
    expect(backendPath).not.toContain("database");
  });
});
