import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PlatformAdmin } from "./platform-admin";

const tenant = {
  id: "tenant-uuid-1",
  displayName: "Acme",
  provisioningState: "ready",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("PlatformAdmin screen", () => {
  it("loads only platform metadata and shows tenant provisioning details", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("tenants?page")) {
        return jsonResponse({
          items: [tenant],
          page: 1,
          pageSize: 50,
          total: 1,
        });
      }
      return jsonResponse({
        ...tenant,
        provisioning: { stage: "ready", attempt: 1, failureCode: null },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PlatformAdmin />);
    expect(await screen.findByRole("button", { name: /Acme/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Acme/ }));
    expect(await screen.findByText("ready")).toBeTruthy();
    expect(screen.getAllByText("tenant-uuid-1")).toHaveLength(2);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).includes("crm/")),
    ).toBe(false);
  });

  it("creates a tenant and starts provisioning through the authenticated BFF", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes("tenants?page")) {
          return jsonResponse({ items: [], page: 1, pageSize: 50, total: 0 });
        }
        if (url.endsWith("/tenants") && init?.method === "POST")
          return jsonResponse(tenant, 201);
        if (url.endsWith("/tenants/tenant-uuid-1")) {
          return jsonResponse({
            ...tenant,
            provisioning: { stage: "database", attempt: 1, failureCode: null },
          });
        }
        return jsonResponse({
          ...tenant,
          provisioning: { stage: "ready", attempt: 1, failureCode: null },
        });
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<PlatformAdmin />);
    await screen.findByText("Nenhum tenant cadastrado.");
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Acme" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar tenant" }));
    expect(await screen.findByText("Tenant criado.")).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/backend/platform-admin/tenants",
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("communicates authorization failures without leaking API payloads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        jsonResponse(
          { code: "forbidden", detail: "sensitive database name" },
          403,
        ),
      ),
    );
    render(<PlatformAdmin />);
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Sua conta não tem acesso",
    );
    expect(screen.queryByText("sensitive database name")).toBeNull();
  });
});
