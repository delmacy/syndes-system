import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { STATUS_CODES, type IncomingMessage, type Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import {
  INBOX_REALTIME_HEARTBEAT,
  INBOX_REALTIME_MAX_BUFFERED_BYTES,
  INBOX_REALTIME_MAX_FRAME_BYTES,
  INBOX_REALTIME_PATH,
  INBOX_REALTIME_REVOKED,
  type InboxRealtimeEvent,
} from './inbox-realtime.contracts';
import {
  InboxRealtimeHub,
  type InboxRealtimeCloseReason,
  type InboxRealtimeSink,
  type InboxRealtimeSubscription,
} from './inbox-realtime.hub';
import {
  InboxRealtimeSessionResolver,
  handshakeHttpStatus,
} from './inbox-realtime.session';

const HANDSHAKE_TIMEOUT_MS = 15_000;

/**
 * INBOX-04 realtime transport (WebSocket, one-way server -> client).
 *
 * The endpoint is `/api/v1/inbox/realtime`; the handshake is the existing
 * authenticated HTTP request, so `IdentityAuthGuard` + `TenantContextGuard`
 * resolve the actor, tenant, database, role and `customer_scope` exactly as
 * for every Inbox REST route. No tenant/database selector is accepted in the
 * URL, and client frames are not part of the protocol (mutations go through
 * the authorized REST API).
 *
 * The socket is upgraded only after the session handshake succeeds; invalid
 * sessions are rejected with the same HTTP status the REST API would return.
 * Authorization is still checked again by the hub on open and before EVERY
 * delivered event, so a revocation or scope change stops delivery even on an
 * already-open socket. There is no replay buffer: reconnect rebuilds durable
 * state through REST.
 *
 * The server attaches to the existing Nest HTTP server, which keeps the
 * WebSocket transport inside the Inbox module and avoids changing global
 * bootstrap. Fan-out remains in-process; multiple API replicas would need a
 * durable broadcast (PostgreSQL LISTEN/NOTIFY) and are out of scope until that
 * becomes a real deployment requirement.
 */
@Injectable()
export class InboxRealtimeGateway
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(InboxRealtimeGateway.name);
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly hub: InboxRealtimeHub,
    private readonly sessions: InboxRealtimeSessionResolver,
  ) {}

  onApplicationBootstrap(): void {
    const httpServer = this.adapterHost.httpAdapter?.getHttpServer() as
      Server | undefined;
    if (!httpServer) {
      throw new Error('Inbox realtime requires an HTTP server');
    }
    this.server = httpServer;
    this.wss = new WebSocketServer({
      noServer: true,
      clientTracking: true,
      perMessageDeflate: false,
      maxPayload: INBOX_REALTIME_MAX_FRAME_BYTES,
    });
    this.wss.on('error', () => {
      this.logger.error('Inbox realtime server error; details withheld.');
    });
    httpServer.on('upgrade', this.onUpgrade);
  }

  onModuleDestroy(): void {
    if (this.server) {
      this.server.off('upgrade', this.onUpgrade);
      this.server = null;
    }
    if (this.wss) {
      for (const client of this.wss.clients) {
        try {
          client.close(1001, 'server shutting down');
        } catch {
          client.terminate();
        }
      }
      this.wss.close();
      this.wss = null;
    }
  }

  private readonly onUpgrade = (
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void => {
    let url: URL;
    try {
      url = new URL(request.url ?? '', 'http://inbox-realtime.invalid');
    } catch {
      rejectUpgrade(socket, 400);
      return;
    }
    if (url.pathname !== INBOX_REALTIME_PATH) {
      // This is the only WebSocket endpoint in the API; an unknown upgrade
      // path is not silently left open.
      rejectUpgrade(socket, 404);
      return;
    }

    // Origin validation: allow same-origin, configured proxy origins, or no
    // Origin header (e.g. curl, direct client, or proxy that strips it).
    const origin = request.headers.origin;
    if (origin) {
      const apiOrigin = new URL(
        process.env.API_ORIGIN ?? 'http://localhost:3000',
      ).origin;
      const proxyOrigins = (process.env.WS_ALLOWED_ORIGINS || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const originIsAllowed =
        origin === apiOrigin || proxyOrigins.some((p) => origin.startsWith(p));
      if (!originIsAllowed) {
        rejectUpgrade(socket, 403);
        return;
      }
    }

    socketTimeout(socket, HANDSHAKE_TIMEOUT_MS);
    void this.handleUpgrade(request, socket, head, url);
  };

  private async handleUpgrade(
    request: IncomingMessage,
    socket: Duplex,
    head: Buffer,
    url: URL,
  ): Promise<void> {
    let session: Awaited<ReturnType<InboxRealtimeSessionResolver['resolve']>>;
    try {
      session = await this.sessions.resolve(request, url);
    } catch (error) {
      rejectUpgrade(socket, handshakeHttpStatus(error));
      return;
    }
    socketTimeout(socket, 0);

    const wss = this.wss;
    if (!wss) {
      rejectUpgrade(socket, 503);
      return;
    }
    try {
      wss.handleUpgrade(request, socket, head, (client) => {
        this.attach(client, session.context, session.conversationIds);
      });
    } catch {
      rejectUpgrade(socket, 400);
    }
  }

  private attach(
    client: WebSocket,
    context: Parameters<InboxRealtimeHub['open']>[0],
    conversationIds: readonly string[],
  ): void {
    let subscription: InboxRealtimeSubscription | undefined;
    let closed = false;
    const finalize = (): void => {
      if (closed) return;
      closed = true;
      subscription?.close();
    };

    client.once('close', finalize);
    client.once('error', finalize);
    // No client -> server protocol: refusing frames keeps a client from
    // injecting subscription/tenant input through the socket.
    client.on('message', () => {
      client.close(1008, 'client messages are not accepted');
    });

    const sink: InboxRealtimeSink = {
      event: (event: InboxRealtimeEvent) => sendJson(client, event),
      heartbeat: (occurredAt: string) =>
        sendJson(client, {
          type: INBOX_REALTIME_HEARTBEAT,
          occurredAt,
        }),
      closed: (reason: InboxRealtimeCloseReason) => {
        if (reason === 'revoked') {
          sendJson(client, {
            type: INBOX_REALTIME_REVOKED,
            reason: 'membership_inactive',
          });
          client.close(1008, 'membership inactive');
          return;
        }
        if (reason === 'shutdown') {
          client.close(1001, 'server shutting down');
        }
      },
    };

    void this.hub
      .open(context, conversationIds.length > 0 ? conversationIds : null, sink)
      .then((opened) => {
        if (closed || client.readyState !== WebSocket.OPEN) {
          opened.close();
          return;
        }
        subscription = opened;
      })
      .catch((error: unknown) => {
        // Membership/scope failures discovered after the upgrade are closed
        // with a policy violation; no data was sent.
        const status = handshakeHttpStatus(error);
        this.logger.warn(
          `Inbox realtime subscription refused (${status}); details withheld.`,
        );
        client.close(1008, 'not authorized');
      });
  }
}

function sendJson(client: WebSocket, payload: unknown): void {
  if (client.readyState !== WebSocket.OPEN) return;
  if (client.bufferedAmount > INBOX_REALTIME_MAX_BUFFERED_BYTES) {
    client.close(1013, 'slow consumer');
    return;
  }
  client.send(JSON.stringify(payload), (error) => {
    if (error) client.terminate();
  });
}

/** `upgrade` sockets are `net.Socket`s typed as Duplex by Node's HTTP types. */
function socketTimeout(socket: Duplex, milliseconds: number): void {
  const withTimeout = socket as Duplex & {
    setTimeout?: (timeout: number) => unknown;
  };
  withTimeout.setTimeout?.(milliseconds);
}

/** Rejects the HTTP handshake before any WebSocket frame exists. */
function rejectUpgrade(socket: Duplex, status: number): void {
  if (socket.destroyed) return;
  socketTimeout(socket, 0);
  const reason = STATUS_CODES[status] ?? 'Error';
  const body = `${status} ${reason}\n`;
  const headers = [
    `HTTP/1.1 ${status} ${reason}`,
    'Connection: close',
    'Content-Type: text/plain; charset=utf-8',
    `Content-Length: ${Buffer.byteLength(body)}`,
    status === 401 ? 'WWW-Authenticate: Bearer' : undefined,
    '',
    '',
  ].filter((line): line is string => line !== undefined);
  socket.end(`${headers.join('\r\n')}${body}`);
}
