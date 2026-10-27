import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CoreCrmWorkspace } from "./core-crm-workspace";

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Core CRM workspace", () => {
  it("keeps CPF members inside their scope and searches through the CRM API", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/context"))
        return response({ role: "tenant_member", customerScope: "cpf" });
      if (url.includes("/people?"))
        return response({ items: [], page: 1, pageSize: 50, total: 0 });
      if (url.includes("/tags?"))
        return response({ items: [], page: 1, pageSize: 100, total: 0 });
      if (url.includes("/search?"))
        return response({
          items: [
            {
              entityType: "person",
              id: "person-1",
              name: "Maria Silva",
              email: "maria@example.test",
            },
          ],
        });
      return response({ code: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    await screen.findByRole("button", { name: /Pessoas/ });
    expect(screen.queryByRole("button", { name: "Organizações" })).toBeNull();
    fireEvent.change(screen.getByLabelText(/Buscar pessoas/), {
      target: { value: "Maria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(
      await screen.findByRole("button", { name: /Maria Silva/ }),
    ).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(([url]) =>
        String(url).includes("/organizations?"),
      ),
    ).toBe(false);
  });

  it("lets tenant admins update member customer scope through the backend contract", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.endsWith("/context"))
          return response({ role: "tenant_admin", customerScope: "both" });
        if (
          url.includes("/people?") ||
          url.includes("/organizations?") ||
          url.includes("/tags?") ||
          url.includes("/employees?")
        )
          return response({ items: [], page: 1, pageSize: 100, total: 0 });
        if (url.endsWith("/memberships"))
          return response([
            {
              actorId: "actor-1",
              role: "tenant_member",
              customerScope: "both",
              status: "active",
            },
          ]);
        if (url.endsWith("/actor-1/scope") && init?.method === "PUT")
          return response({
            actorId: "actor-1",
            role: "tenant_member",
            customerScope: "pj",
            status: "active",
          });
        return response({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Equipe" }));
    expect(await screen.findAllByText("actor-1")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Atendente"), {
      target: { value: "actor-1" },
    });
    fireEvent.change(screen.getByLabelText("Escopo"), {
      target: { value: "pj" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar escopo" }));
    expect(
      await screen.findByText("Escopo do atendente atualizado."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/backend/crm/memberships/actor-1/scope",
        expect.objectContaining({ method: "PUT" }),
      ),
    );
  });

  it("warns about an existing CPF before creating another person", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.endsWith("/context"))
          return response({ role: "tenant_member", customerScope: "both" });
        if (
          url.includes("/people?") ||
          url.includes("/organizations?") ||
          url.includes("/tags?")
        )
          return response({ items: [], page: 1, pageSize: 50, total: 0 });
        if (url.includes("/duplicates/possible?"))
          return response({
            possibleDuplicates: [
              {
                entityType: "person",
                id: "person-existing",
                name: "Maria Existente",
                matchedOn: ["cpf"],
              },
            ],
            truncated: false,
          });
        return response({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Pessoas" }));
    fireEvent.change(screen.getByLabelText("Nome completo"), {
      target: { value: "Maria Nova" },
    });
    fireEvent.change(screen.getByLabelText("CPF"), {
      target: { value: "12345678900" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Criar cadastro" }));
    expect(await screen.findByText("Possíveis duplicatas")).toBeTruthy();
    expect(screen.getByText("Maria Existente")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).includes("/people") && init?.method === "POST",
      ),
    ).toBe(false);
  });
});
