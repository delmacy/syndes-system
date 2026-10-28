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

  it("shows empty search results distinctly and clears stale results after an API error", async () => {
    let failSearch = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/context"))
        return response({ role: "tenant_member", customerScope: "both" });
      if (
        url.includes("/people?") ||
        url.includes("/organizations?") ||
        url.includes("/tags?")
      )
        return response({ items: [], page: 1, pageSize: 50, total: 0 });
      if (url.includes("/search?")) {
        if (failSearch) return response({ code: "http_503" }, 503);
        if (url.includes("empty")) return response({ items: [] });
        return response({
          items: [
            { entityType: "person", id: "person-1", name: "Maria Silva" },
          ],
        });
      }
      return response({ code: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    await screen.findByRole("button", { name: "Pessoas" });
    fireEvent.change(screen.getByLabelText(/Buscar pessoas/), {
      target: { value: "Maria" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(
      await screen.findByRole("button", { name: /Maria Silva/ }),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Buscar pessoas/), {
      target: { value: "empty" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(
      await screen.findByText("Nenhum cadastro encontrado para esta busca."),
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Maria Silva/ })).toBeNull();

    failSearch = true;
    fireEvent.change(screen.getByLabelText(/Buscar pessoas/), {
      target: { value: "indisponível" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));
    expect(
      await screen.findByText("Serviço temporariamente indisponível."),
    ).toBeTruthy();
    expect(
      screen.queryByText("Nenhum cadastro encontrado para esta busca."),
    ).toBeNull();
  });

  it("lists, attaches, detaches existing tags and refreshes the timeline", async () => {
    let attached = false;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/context"))
          return response({ role: "tenant_admin", customerScope: "both" });
        if (url.includes("/people?") && !url.includes("/timeline"))
          return response({
            items: [
              { id: "person-1", entityType: "person", fullName: "Maria Silva" },
            ],
            page: 1,
            pageSize: 50,
            total: 1,
          });
        if (
          url.includes("/organizations?") ||
          url.includes("/employees?") ||
          url.endsWith("/memberships")
        )
          return url.endsWith("/memberships")
            ? response([])
            : response({ items: [], page: 1, pageSize: 100, total: 0 });
        if (url.includes("/tags/people/person-1?"))
          return response({
            items: attached ? [{ id: "tag-1", name: "VIP" }] : [],
            page: 1,
            pageSize: 100,
            total: attached ? 1 : 0,
          });
        if (url.includes("/tags?") && !url.includes("/tags/people/"))
          return response({
            items: [{ id: "tag-1", name: "VIP" }],
            page: 1,
            pageSize: 100,
            total: 1,
          });
        if (url.endsWith("/people/person-1/timeline"))
          return response({
            items: attached
              ? [
                  {
                    id: "event-1",
                    kind: "tag.attached",
                    occurredAt: "2026-10-28T10:00:00Z",
                  },
                ]
              : [],
          });
        if (url.includes("/notes?"))
          return response({ items: [], page: 1, pageSize: 50, total: 0 });
        if (url.endsWith("/people/person-1/relationships"))
          return response({ items: [] });
        if (url.endsWith("/people/person-1/channel-identities"))
          return response({ items: [] });
        if (url.endsWith("/tags/tag-1/people/person-1")) {
          attached = init?.method !== "DELETE";
          return response({ tagId: "tag-1", personId: "person-1" });
        }
        if (url.endsWith("/people/person-1"))
          return response({
            id: "person-1",
            entityType: "person",
            fullName: "Maria Silva",
          });
        return response({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Pessoas" }));
    fireEvent.click(await screen.findByRole("button", { name: /Maria Silva/ }));
    fireEvent.change(await screen.findByLabelText("Tag existente"), {
      target: { value: "tag-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vincular tag" }));
    expect(await screen.findByText("Tag vinculada.")).toBeTruthy();
    expect(await screen.findByText("tag.attached")).toBeTruthy();
    expect(
      await screen.findByRole("button", { name: "Remover tag VIP" }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Remover tag VIP" }));
    expect(await screen.findByText("Tag removida.")).toBeTruthy();
    expect(await screen.findByText("Nenhuma tag vinculada.")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([url, init]) =>
          String(url).endsWith("/tags/tag-1/people/person-1") &&
          init?.method === "DELETE",
      ),
    ).toBe(true);
  });

  it("requires explicit confirmation before archiving a record", async () => {
    let deleteCount = 0;
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/context"))
          return response({ role: "tenant_admin", customerScope: "both" });
        if (url.includes("/people?") && !url.includes("/timeline"))
          return response({
            items: [
              { id: "person-1", entityType: "person", fullName: "Maria Silva" },
            ],
            page: 1,
            pageSize: 50,
            total: 1,
          });
        if (
          url.includes("/organizations?") ||
          url.includes("/employees?") ||
          url.includes("/tags?")
        )
          return response({ items: [], page: 1, pageSize: 100, total: 0 });
        if (url.endsWith("/memberships")) return response([]);
        if (url.endsWith("/people/person-1")) {
          if (init?.method === "DELETE") {
            deleteCount += 1;
            return response({ id: "person-1" });
          }
          return response({
            id: "person-1",
            entityType: "person",
            fullName: "Maria Silva",
          });
        }
        if (
          url.endsWith("/people/person-1/timeline") ||
          url.endsWith("/people/person-1/relationships") ||
          url.endsWith("/people/person-1/channel-identities")
        )
          return response({ items: [] });
        if (url.includes("/notes?") || url.includes("/tags/people/person-1?"))
          return response({ items: [], page: 1, pageSize: 100, total: 0 });
        return response({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CoreCrmWorkspace />);
    fireEvent.click(await screen.findByRole("button", { name: "Pessoas" }));
    fireEvent.click(await screen.findByRole("button", { name: /Maria Silva/ }));
    fireEvent.click(await screen.findByRole("button", { name: "Arquivar" }));
    expect(await screen.findByRole("alertdialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(deleteCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Arquivar" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar arquivamento" }),
    );
    expect(await screen.findByText("Registro arquivado.")).toBeTruthy();
    expect(deleteCount).toBe(1);
  });
});
