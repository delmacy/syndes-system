import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InboxWorkspace } from "./inbox-workspace";

const CONVERSATION_ID = "conversation-1";
const AGENT_ID = "agent-actor-1";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function queueItem() {
  return {
    id: CONVERSATION_ID,
    subject: "Cliente teste",
    preview: "Mensagem de teste",
    status: "open",
    unreadCount: 1,
    createdAt: "2026-10-28T12:00:00.000Z",
    updatedAt: "2026-10-28T12:00:00.000Z",
  };
}

function conversationDetail() {
  return jsonResponse({
    id: CONVERSATION_ID,
    subject: "Cliente teste",
    status: "open",
    unreadCount: 0,
    lastActivity: "2026-10-28T12:02:00.000Z",
    assigneeActorId: AGENT_ID,
  });
}

function conversationMessages() {
  return jsonResponse([
    {
      id: "msg-in-1",
      kind: "inbound",
      content: "Mensagem de teste",
      author: { role: "customer", name: "Cliente" },
      createdAt: "2026-10-28T12:00:00.000Z",
    },
    {
      id: "msg-out-1",
      kind: "outbound",
      content: "Obrigado pelo contato",
      author: { role: "agent", name: "Atendente", actorId: AGENT_ID },
      createdAt: "2026-10-28T12:01:00.000Z",
    },
    {
      id: "msg-note-1",
      kind: "note",
      content: "Nota interna de teste",
      author: { role: "agent", name: "Atendente" },
      createdAt: "2026-10-28T12:02:00.000Z",
    },
  ]);
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("InboxWorkspace", () => {
  it("renders the loading state while the authorized queue is being fetched", async () => {
    let resolveQueue: (value: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveQueue = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    expect(screen.getByText("Carregando conversas…")).toBeTruthy();

    resolveQueue(jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }));
    expect(await screen.findByText("Não há conversas na fila.")).toBeTruthy();
  });

  it("renders the empty queue state when the authorized API returns no conversations", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    expect(await screen.findByText("Não há conversas na fila.")).toBeTruthy();
  });

  it("renders an alert when the queue request fails with a backend error", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: "http_500" }, 500));
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    expect(await screen.findByText("Serviço temporariamente indisponível.")).toBeTruthy();
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders a session expired alert when the BFF answers 401", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: "http_401" }, 401));
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    expect(await screen.findByText("Sua sessão expirou. Entre novamente.")).toBeTruthy();
  });

  it("renders a permission alert when the operator is outside the tenant scope", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ code: "forbidden" }, 403));
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    expect(
      await screen.findByText("Sua conta não tem permissão para esta operação."),
    ).toBeTruthy();
  });

  it("greets the operator from the session summary before loading the queue", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ items: [], page: 1, pageSize: 20, total: 0 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(
      <InboxWorkspace
        user={{ name: "Atendente Silva", email: "atendente@syndes.test", image: null }}
      />,
    );

    expect(await screen.findByText(/Atendido por Atendente Silva/)).toBeTruthy();
  });

  it("opens a conversation from the queue and renders its history with the private note marker", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/conversations?")) {
        return jsonResponse({
          items: [queueItem()],
          page: 1,
          pageSize: 20,
          total: 1,
        });
      }
      if (url === `/api/backend/inbox/conversations/${CONVERSATION_ID}`) {
        return conversationDetail();
      }
      if (
        url.startsWith(
          `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
        )
      ) {
        return conversationMessages();
      }
      return jsonResponse({ code: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));

    expect(await screen.findByText("Mensagem de teste")).toBeTruthy();
    expect(screen.getByText("Obrigado pelo contato")).toBeTruthy();
    expect(screen.getByText("Nota interna de teste")).toBeTruthy();
    expect(
      screen.getByText("Nota privada", { selector: ".message-note-tag" }),
    ).toBeTruthy();
  });

  it("sends a reply through the BFF messages endpoint with an idempotency key", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages` &&
          method === "POST"
        ) {
          return jsonResponse({ success: true, messageId: "msg-out-2" });
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    fireEvent.change(screen.getByLabelText(/Conteúdo da resposta/i), {
      target: { value: "Resposta do atendente" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));

    expect(await screen.findByText("Resposta enviada com sucesso.")).toBeTruthy();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ body: "Resposta do atendente" }),
        }),
      ),
    );
    const sentCall = fetchMock.mock.calls.find(
      ([url, init]) =>
        String(url) ===
          `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages` &&
        (init?.method ?? "GET") === "POST",
    );
    expect((sentCall?.[1] as RequestInit | undefined)?.headers).toMatchObject({
      "Idempotency-Key": expect.any(String),
    });
  });

  it("keeps the reply draft when the send fails", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages` &&
          method === "POST"
        ) {
          return jsonResponse({ code: "http_503" }, 503);
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    const replyField = screen.getByLabelText(
      /Conteúdo da resposta/i,
    ) as HTMLTextAreaElement;
    fireEvent.change(replyField, { target: { value: "Resposta do atendente" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar resposta" }));

    expect(await screen.findByText("Serviço temporariamente indisponível.")).toBeTruthy();
    expect(replyField.value).toBe("Resposta do atendente");
  });

  it("saves a private note through the notes endpoint without a public reply", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/notes` &&
          method === "POST"
        ) {
          return jsonResponse({ success: true, noteId: "note-1" });
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    fireEvent.change(screen.getByLabelText(/Nota privada/i), {
      target: { value: "Nota interna de teste" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nota" }));

    expect(await screen.findByText("Nota privada salva.")).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/backend/inbox/conversations/${CONVERSATION_ID}/notes`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ body: "Nota interna de teste" }),
        }),
      ),
    );
    const publicReplyCalls = fetchMock.mock.calls.filter(
      (call) =>
        String(call[0]) ===
          `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages` &&
        (call[1] as RequestInit | undefined)?.method === "POST",
    );
    expect(publicReplyCalls).toHaveLength(0);
  });

  it("updates the conversation status through the status endpoint", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/status` &&
          method === "PATCH"
        ) {
          return jsonResponse({ success: true });
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "resolved" },
    });

    expect(await screen.findByText("Status atualizado.")).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/backend/inbox/conversations/${CONVERSATION_ID}/status`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "resolved" }),
        }),
      ),
    );
  });

  it("assigns the conversation through the assignment endpoint", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/assignment` &&
          method === "PATCH"
        ) {
          return jsonResponse({ success: true });
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    fireEvent.change(screen.getByLabelText("Atribuir a"), {
      target: { value: AGENT_ID },
    });

    expect(
      await screen.findByText("Conversa atribuída ao atendente."),
    ).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/backend/inbox/conversations/${CONVERSATION_ID}/assignment`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ assigneeActorId: AGENT_ID }),
        }),
      ),
    );
  });

  it("uploads an allowed attachment through the multipart endpoint", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/attachments` &&
          method === "POST"
        ) {
          return jsonResponse({
            success: true,
            attachment: {
              id: "attachment-1",
              name: "anexo.txt",
              size: 8,
              type: "text/plain",
            },
          });
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    const file = new File(["conteudo"], "anexo.txt", { type: "text/plain" });
    const input = screen.getByLabelText(/anexo/i);
    await user.upload(input, file);

    expect(await screen.findByText("Anexo carregado com sucesso.")).toBeTruthy();
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `/api/backend/inbox/conversations/${CONVERSATION_ID}/attachments`,
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });

  it("rejects an attachment that exceeds the reviewed size limit", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    const file = new File([new Uint8Array(11 * 1024 * 1024)], "big.txt", {
      type: "text/plain",
    });
    const input = screen.getByLabelText(/anexo/i);
    await user.upload(input, file);

    expect(await screen.findByText(/Anexo rejeitado/)).toBeTruthy();
  });

  it("refetches the authorized queue after the browser reports connectivity restored", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/conversations?")) {
        return jsonResponse({
          items: [queueItem()],
          page: 1,
          pageSize: 20,
          total: 1,
        });
      }
      if (url === `/api/backend/inbox/conversations/${CONVERSATION_ID}`) {
        return conversationDetail();
      }
      if (
        url.startsWith(
          `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
        )
      ) {
        return conversationMessages();
      }
      return jsonResponse({ code: "not_found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<InboxWorkspace />);

    await screen.findByText("Cliente teste");
    const callsBefore = fetchMock.mock.calls.length;

    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("shows an error alert when the attachment upload fails", async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const method = init?.method ?? "GET";
        if (url.includes("/conversations?") && method === "GET") {
          return jsonResponse({
            items: [queueItem()],
            page: 1,
            pageSize: 20,
            total: 1,
          });
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}` &&
          method === "GET"
        ) {
          return conversationDetail();
        }
        if (
          url.startsWith(
            `/api/backend/inbox/conversations/${CONVERSATION_ID}/messages`,
          ) &&
          method === "GET"
        ) {
          return conversationMessages();
        }
        if (
          url === `/api/backend/inbox/conversations/${CONVERSATION_ID}/attachments` &&
          method === "POST"
        ) {
          return jsonResponse({ code: "http_500" }, 500);
        }
        return jsonResponse({ code: "not_found" }, 404);
      },
    );
    vi.stubGlobal("fetch", fetchMock);

    const user = userEvent.setup();
    render(<InboxWorkspace />);

    fireEvent.click(await screen.findByRole("button", { name: /Cliente teste/ }));
    await screen.findByText("Mensagem de teste");

    const file = new File(["conteudo"], "anexo.txt", { type: "text/plain" });
    const input = screen.getByLabelText(/anexo/i);
    await user.upload(input, file);

    expect(
      await screen.findByText("Serviço temporariamente indisponível."),
    ).toBeTruthy();
    expect(
      screen.queryByText("Anexo carregado com sucesso."),
    ).toBeNull();
  });
});
