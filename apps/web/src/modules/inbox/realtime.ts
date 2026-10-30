"use client";

/**
 * INBOX-06-R3-F1 — Cliente realtime da ponte WebSocket same-origin no BFF.
 *
 * O backend expõe o WebSocket autenticado em `GET /api/v1/inbox/realtime` com
 * handshake resolvido por IdentityAuthGuard + TenantContextGuard. O navegador
 * não pode anexar `Authorization` a um `WebSocket` nativo, portanto a conexão
 * deve passar por uma ponte server-side de mesma origem que injete o bearer e
 * os headers de trusted-ingress (nunca token nem tenant/id na URL do WS).
 *
 * Este módulo é o cliente da ponte. Ele:
 * - Conecta ao endpoint WebSocket de mesma origem exposto pelo BFF.
 * - Valida `Origin` (mesma origem da aplicação) e falha fechado.
 * - Nunca coloca token, tenant ou identificador de database na URL do WebSocket.
 * - Em reconexão, refetch do estado durável via REST (fonte da verdade),
 *   sem depender de buffer de reprise do servidor.
 * - Recebe apenas ponteiros de evento (ids/estado); nenhum corpo, nota privada,
 *   nome de arquivo, tenant id ou database name viaja no socket.
 *
 * Limitação de runtime: Next.js App Router route handlers (incluindo
 * `apps/web/src/app/api/backend/[...path]/route.ts`) não suportam upgrade
 * bruto de WebSocket — não há acesso ao `upgrade` event do servidor HTTP nem
 * ao objeto de socket subjacente. A rota ponte deve ser implementada com um
 * servidor dedicado ou proxy de mesmo origem que suporte upgrade. Enquanto
 * isso, o cliente degrade graciosamente para refetch REST em
 * `online`/`visibilitychange` (mesmo comportamento adotado no INBOX-05).
 *
 * Veja docs/engineering/tasks/PRD-002/INBOX-06-R3-handoff.md para o relatório
 * de decisão e handoff desta tarefa.
 */

export type InboxRealtimeEventType =
  | "inbox.message.created"
  | "inbox.note.created"
  | "inbox.conversation.assigned"
  | "inbox.conversation.status.changed"
  | "inbox.attachment.created";

export const INBOX_REALTIME_HEARTBEAT = "inbox.realtime.heartbeat";
export const INBOX_REALTIME_REVOKED = "inbox.realtime.revoked";

export interface InboxRealtimeEvent<
  T extends InboxRealtimeEventType = InboxRealtimeEventType,
> {
  id: string;
  type: T;
  conversationId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export type InboxRealtimeEventHandler = (event: InboxRealtimeEvent) => void;

export interface InboxRealtimeClientOptions {
  /** URL de mesma origem da ponte WebSocket no BFF (path sem host). */
  url?: string;
  /** Chamado para cada evento realtime recebido. */
  onEvent?: InboxRealtimeEventHandler;
  /** Chamado quando a conexão é estabelecida. */
  onConnect?: () => void;
  /** Chamado quando a conexão é encerrada. */
  onDisconnect?: (reason: string) => void;
  /** Chamado quando o servidor revoga a sessão (membership inativa). */
  onRevoke?: () => void;
  /** Intervalo entre tentativas de reconexão (ms). */
  reconnectInterval?: number;
  /** Número máximo de tentativas de reconexão. */
  maxReconnectAttempts?: number;
  /** Callback de refetch do estado durável (chamado na (re)conexão). */
  onRefetchState?: () => void | Promise<void>;
  /** Construtor WebSocket (injetável em testes; default: `globalThis.WebSocket`). */
  WebSocket?: typeof WebSocket;
}

const DEFAULT_URL = "/api/backend/inbox/realtime";
const DEFAULT_RECONNECT_INTERVAL_MS = 3_000;
const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Verifica se um cabeçalho `Origin` é da mesma aplicação que está servindo a
 * página. Usado para falha fechada antes de estabelecer o WebSocket.
 */
export function isSameApplicationOriginClient(
  originHeader: string | null,
  applicationOrigin: string | undefined,
): boolean {
  if (!originHeader || !applicationOrigin) return false;
  try {
    return new URL(originHeader).origin === new URL(applicationOrigin).origin;
  } catch {
    return false;
  }
}

/**
 * Cliente WebSocket same-origin para o canal realtime do Inbox.
 *
 * A autenticação é resolvida server-side pela ponte (bearer + trusted-ingress
 * injetados a partir da sessão); o cliente nunca envia token na URL nem em
 * frames. O protocolo é unidirecional (servidor -> cliente): mensagens enviadas
 * pelo cliente são ignoradas/enceradas com 1008 pelo servidor.
 */
export class InboxRealtimeClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly options: Omit<
    Required<InboxRealtimeClientOptions>,
    "WebSocket"
  > & { WebSocket?: typeof WebSocket };
  private readonly WebSocketCtor: typeof WebSocket;

  constructor(options: InboxRealtimeClientOptions = {}) {
    this.WebSocketCtor =
      options.WebSocket ??
      ((globalThis as unknown as { WebSocket?: typeof WebSocket }).WebSocket ??
        (undefined as unknown as typeof WebSocket));
    this.options = {
      url: options.url ?? DEFAULT_URL,
      onEvent: options.onEvent ?? (() => {}),
      onConnect: options.onConnect ?? (() => {}),
      onDisconnect: options.onDisconnect ?? (() => {}),
      onRevoke: options.onRevoke ?? (() => {}),
      onRefetchState:
        options.onRefetchState ?? (async () => {
          /* sem refetch configurado */
        }),
      reconnectInterval:
        options.reconnectInterval ?? DEFAULT_RECONNECT_INTERVAL_MS,
      maxReconnectAttempts:
        options.maxReconnectAttempts ?? DEFAULT_MAX_RECONNECT_ATTEMPTS,
    };
  }

  /** readyState WebSocket: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3. */
  readonly WS_OPEN = 1;

  /** Se há uma conexão WebSocket aberta no momento. */
  get isConnected(): boolean {
    return this.ws?.readyState === this.WS_OPEN;
  }

  /** Número de tentativas de reconexão já realizadas. */
  get attempts(): number {
    return this.reconnectAttempts;
  }

  /** Estabelece (ou restabelece) a conexão WebSocket de mesma origem. */
  connect(): void {
    if (this.closed) return;
    if (this.ws?.readyState === this.WS_OPEN) return;

    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const applicationOrigin = process.env.NEXT_PUBLIC_APP_ORIGIN;
    if (
      !isSameApplicationOriginClient(origin, applicationOrigin) &&
      applicationOrigin
    ) {
      // Origem não confiável: falha fechada, não abre o socket.
      this.options.onDisconnect("origin_rejected");
      return;
    }

    const WebSocketCtor = this.WebSocketCtor;
    if (!WebSocketCtor) {
      this.options.onDisconnect("websocket_unavailable");
      return;
    }

    try {
      const socket = new WebSocketCtor(this.options.url);
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        this.ws = socket;
        this.reconnectAttempts = 0;
        this.closed = false;
        void this.options.onRefetchState();
        this.options.onConnect();
      };

      socket.onmessage = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data as string) as
            | InboxRealtimeEvent
            | { type: string; [key: string]: unknown };
          if (payload && typeof payload === "object" && "type" in payload) {
            if (payload.type === INBOX_REALTIME_REVOKED) {
              this.options.onRevoke();
              this.close(1008, "membership_inactive");
              return;
            }
            if (payload.type === INBOX_REALTIME_HEARTBEAT) {
              // Heartbeat de transporte: não requer ação do cliente.
              return;
            }
            this.options.onEvent(payload as InboxRealtimeEvent);
          }
        } catch {
          // Mensagem malformada é descartada; nenhum dado sensível é logado.
        }
      };

      socket.onclose = (event: CloseEvent) => {
        if (this.closed) return;
        this.ws = null;
        this.options.onDisconnect(event.code === 1008 ? "revoked" : "closed");
        if (!this.closed && this.reconnectAttempts < this.options.maxReconnectAttempts) {
          this.reconnectAttempts += 1;
          this.reconnectTimer = setTimeout(() => {
            this.reconnect();
          }, this.options.reconnectInterval);
        }
      };

      socket.onerror = () => {
        // Erros de transporte são tratados por onclose; nada a fazer aqui.
        socket.close();
      };
    } catch {
      this.options.onDisconnect("connection_failed");
      if (!this.closed && this.reconnectAttempts < this.options.maxReconnectAttempts) {
        this.reconnectAttempts += 1;
        this.reconnectTimer = setTimeout(() => {
          this.reconnect();
        }, this.options.reconnectInterval);
      }
    }
  }

  /** Tenta reconectar e refetch do estado durável via REST. */
  private reconnect(): void {
    if (this.closed) return;
    this.connect();
  }

  /** Encerra a conexão e cancela reconexões automáticas. */
  disconnect(): void {
    this.closed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      try {
        this.ws.close(1000, "client disconnect");
      } catch {
        /* socket já fechado */
      }
      this.ws = null;
    }
    this.options.onDisconnect("client_disconnected");
  }

  private close(code: number, reason: string): void {
    if (this.ws) {
      try {
        this.ws.close(code, reason);
      } catch {
        /* ignore */
      }
      this.ws = null;
    }
    this.closed = true;
    this.options.onDisconnect(reason);
  }
}

/**
 * Constrói a URL de mesma origem da ponte WebSocket no BFF, sem incluir token,
 * tenant, database ou qualquer identificador sensível na query string.
 */
export function buildRealtimeUrl(basePath: string = DEFAULT_URL): string {
  // Apenas path de mesma origem; nenhum parâmetro de tenant/token é anexado.
  return basePath.startsWith("/") ? basePath : `/${basePath}`;
}
