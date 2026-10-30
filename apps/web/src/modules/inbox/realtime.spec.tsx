import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  InboxRealtimeClient,
  isSameApplicationOriginClient,
  buildRealtimeUrl,
  INBOX_REALTIME_HEARTBEAT,
  INBOX_REALTIME_REVOKED,
  type InboxRealtimeEvent,
} from "./realtime";

function makeEvent(overrides: Partial<InboxRealtimeEvent> = {}): InboxRealtimeEvent {
  return {
    id: "evt-1",
    type: "inbox.message.created",
    conversationId: "conv-1",
    occurredAt: "2026-10-29T10:00:00.000Z",
    payload: { messageId: "msg-1" },
    ...overrides,
  };
}

class FakeWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = FakeWebSocket.CONNECTING;
  binaryType: string | null = null;
  url: string;
  onopen: ((this: WebSocket, ev: Event) => void) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;
  onerror: ((this: WebSocket, ev: Event) => void) | null = null;

  closedByCode?: number;
  closedByReason?: string;

  sent: Array<string | ArrayBuffer> = [];

  constructor(url: string) {
    this.url = url;
  }

  send(data: string | ArrayBuffer): void {
    this.sent.push(data);
  }

  close(code?: number, reason?: string): void {
    this.closedByCode = code;
    this.closedByReason = reason;
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose.call(
        this as unknown as WebSocket,
        new CloseEvent("close", { code: code ?? 1000, reason: reason ?? "" }),
      );
    }
  }

  simulateOpen(): void {
    this.readyState = FakeWebSocket.OPEN;
    if (this.onopen) {
      this.onopen.call(this as unknown as WebSocket, new Event("open"));
    }
  }

  simulateMessage(data: string): void {
    if (this.onmessage) {
      this.onmessage.call(this as unknown as WebSocket, new MessageEvent("message", { data }));
    }
  }

  simulateClose(code = 1000, reason = ""): void {
    this.readyState = FakeWebSocket.CLOSED;
    if (this.onclose) {
      this.onclose.call(this as unknown as WebSocket, new CloseEvent("close", { code, reason }));
    }
  }
}

const ORIGIN = "https://app.syndes.test";

describe("isSameApplicationOriginClient (cliente)", () => {
  it("aceita origem mesma aplicação", () => {
    expect(isSameApplicationOriginClient(ORIGIN, ORIGIN)).toBe(true);
  });

  it("rejeita ausência de origem", () => {
    expect(isSameApplicationOriginClient(null, ORIGIN)).toBe(false);
    expect(isSameApplicationOriginClient("", ORIGIN)).toBe(false);
  });

  it("rejeita origem cruzada", () => {
    expect(
      isSameApplicationOriginClient("https://evil.example", ORIGIN),
    ).toBe(false);
  });

  it("rejeita origem malformada", () => {
    expect(isSameApplicationOriginClient("not-a-url", ORIGIN)).toBe(false);
  });

  it("rejeita quando aplicação não informada", () => {
    expect(isSameApplicationOriginClient(ORIGIN, undefined)).toBe(false);
  });
});

describe("buildRealtimeUrl", () => {
  it("retorna path de mesma origem sem token nem tenant", () => {
    expect(buildRealtimeUrl("/api/backend/inbox/realtime")).toBe(
      "/api/backend/inbox/realtime",
    );
    expect(buildRealtimeUrl("api/backend/inbox/realtime")).toBe(
      "/api/backend/inbox/realtime",
    );
  });
});

function newClientWithFake(
  overrides: Partial<ConstructorParameters<typeof InboxRealtimeClient>[0]> = {},
) {
  const instances: FakeWebSocket[] = [];
  function FakeCtor(this: unknown, url: string) {
    const inst = new FakeWebSocket(url);
    instances.push(inst);
    return inst;
  }
  const client = new InboxRealtimeClient({
    url: "/api/backend/inbox/realtime",
    WebSocket: FakeCtor as unknown as typeof WebSocket,
    ...overrides,
  });
  return { client, instances };
}

describe("InboxRealtimeClient", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("expõe estado desconectado inicialmente", () => {
    const { client } = newClientWithFake();
    expect(client.isConnected).toBe(false);
    expect(client.attempts).toBe(0);
  });

  it("conecta, chama onConnect e refetch de estado na abertura", () => {
    const onConnect = vi.fn();
    const onRefetchState = vi.fn();
    const { client, instances } = newClientWithFake({ onConnect, onRefetchState });
    client.connect();

    expect(instances).toHaveLength(1);
    expect(instances[0].url).toBe("/api/backend/inbox/realtime");
    instances[0].simulateOpen();

    expect(client.isConnected).toBe(true);
    expect(onConnect).toHaveBeenCalledTimes(1);
    expect(onRefetchState).toHaveBeenCalledTimes(1);
  });

  it("despacha evento de mensagem recebida para onEvent", () => {
    const onEvent = vi.fn();
    const { client, instances } = newClientWithFake({ onEvent });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateMessage(JSON.stringify(makeEvent()));

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent.mock.calls[0][0]).toMatchObject({
      id: "evt-1",
      type: "inbox.message.created",
      conversationId: "conv-1",
    });
  });

  it("ignora heartbeat de transporte sem chamar onEvent", () => {
    const onEvent = vi.fn();
    const { client, instances } = newClientWithFake({ onEvent });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateMessage(
      JSON.stringify({ type: INBOX_REALTIME_HEARTBEAT, occurredAt: "t" }),
    );

    expect(onEvent).not.toHaveBeenCalled();
  });

  it("chama onRevoke e fecha ao receber inbox.realtime.revoked", () => {
    const onRevoke = vi.fn();
    const onDisconnect = vi.fn();
    const { client, instances } = newClientWithFake({ onRevoke, onDisconnect });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateMessage(
      JSON.stringify({ type: INBOX_REALTIME_REVOKED, reason: "membership_inactive" }),
    );

    expect(onRevoke).toHaveBeenCalledTimes(1);
    expect(instances[0].closedByCode).toBe(1008);
    expect(onDisconnect).toHaveBeenCalledWith("revoked");
  });

  it("reconecta com refetch de estado ao fechar normalmente", () => {
    const onDisconnect = vi.fn();
    const onRefetchState = vi.fn();
    const { client, instances } = newClientWithFake({
      onDisconnect,
      onRefetchState,
      reconnectInterval: 100,
      maxReconnectAttempts: 3,
    });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateClose(1000, "");

    // Primeiro refetch aconteceu na abertura.
    expect(onRefetchState).toHaveBeenCalledTimes(1);

    // Agenda reconexão.
    expect(onDisconnect).toHaveBeenCalledWith("closed");
    vi.advanceTimersByTime(100);
    expect(instances).toHaveLength(2);
    expect(client.attempts).toBe(1);
  });

  it("para de tentar reconexão após exceder maxReconnectAttempts", () => {
    const { client, instances } = newClientWithFake({
      reconnectInterval: 100,
      maxReconnectAttempts: 2,
    });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateClose(1000, "");

    vi.advanceTimersByTime(100); // tentativa 1
    instances[1].simulateClose(1000, "");

    vi.advanceTimersByTime(100); // tentativa 2
    instances[2].simulateClose(1000, "");

    // Não deve haver terceira instância.
    expect(instances).toHaveLength(3);
    expect(client.attempts).toBe(2);
    expect(client.isConnected).toBe(false);
  });

  it("disconnect cancela reconexões pendentes", () => {
    const onDisconnect = vi.fn();
    const { client, instances } = newClientWithFake({
      onDisconnect,
      reconnectInterval: 100,
      maxReconnectAttempts: 5,
    });
    client.connect();
    instances[0].simulateOpen();
    instances[0].simulateClose(1000, "");

    vi.advanceTimersByTime(50);
    client.disconnect();

    expect(client.isConnected).toBe(false);
    expect(onDisconnect).toHaveBeenCalledWith("client_disconnected");
    vi.advanceTimersByTime(100);
    expect(instances).toHaveLength(1); // nenhuma nova instância
  });

  it("não reconecta se client foi explicitamente fechado (closed = true)", () => {
    const { client, instances } = newClientWithFake({
      reconnectInterval: 100,
      maxReconnectAttempts: 5,
    });
    client.disconnect();
    client.connect(); // chamado após disconnect: não deve abrir novo socket

    expect(instances).toHaveLength(0);
    expect(client.isConnected).toBe(false);
  });

  it("não abre conexão duplicada enquanto já está conectado", () => {
    const { client, instances } = newClientWithFake();
    client.connect();
    instances[0].simulateOpen();
    client.connect();

    expect(instances).toHaveLength(1);
  });
});
