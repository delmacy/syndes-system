import http from 'node:http';
import next from 'next';
import { decode } from '@auth/core/jwt';
import { WebSocket, WebSocketServer } from 'ws';

const hostname = process.env.WEB_HOSTNAME || '0.0.0.0';
const port = Number(process.env.PORT || 18080);
const apiBase = new URL(process.env.SYNDES_API_URL || 'http://127.0.0.1:18081');
const authSecret = process.env.AUTH_SECRET;
const cookieNames = process.env.NODE_ENV === 'production'
  ? ['__Host-syndes.session-token', 'syndes.session-token']
  : ['syndes.session-token', '__Host-syndes.session-token'];
const ingressSecret = process.env.INGRESS_SIGNING_SECRET;
const appOrigin = new URL(process.env.AUTH_URL || `http://${hostname}:${port}`).origin;
const wsPath = '/api/v1/inbox/realtime';

if (!authSecret || !ingressSecret) throw new Error('web bridge secrets are required');

const app = next({ dev: false, hostname, port });
await app.prepare();
const handle = app.getRequestHandler();
const server = http.createServer((req, res) => handle(req, res));
const bridgeServer = new WebSocketServer({ noServer: true, clientTracking: false });
const upstreamSockets = new Set();

server.on('upgrade', (request, socket, head) => {
  let url;
  try { url = new URL(request.url || '/', appOrigin); } catch { return reject(socket, 400); }
  if (url.pathname !== '/api/backend/inbox/realtime') return reject(socket, 404);
  if (request.headers.origin && request.headers.origin !== appOrigin) return reject(socket, 403);
  void bridge(request, socket, head, url);
});

async function bridge(request, clientSocket, head, url) {
  const cookies = parseCookies(request.headers.cookie || '');
  let session = null;
  for (const cookieName of cookieNames) {
    const sessionToken = cookies[cookieName] || Object.keys(cookies)
      .filter((name) => name.startsWith(`${cookieName}.`))
      .sort((left, right) => Number(left.slice(left.lastIndexOf('.') + 1)) - Number(right.slice(right.lastIndexOf('.') + 1)))
      .map((name) => cookies[name]).join('');
    if (sessionToken) {
      session = await decode({ token: sessionToken, secret: authSecret, salt: cookieName }).catch(() => null);
      if (session) break;
    }
  }
  const accessToken = typeof session?.accessToken === 'string' ? session.accessToken : null;
  if (!accessToken) return reject(clientSocket, 401);
  if ([...url.searchParams.keys()].some((key) => /tenant|database|customer.?scope/i.test(key))) return reject(clientSocket, 400);

  const target = new URL(wsPath + (url.search || ''), apiBase);
  target.protocol = apiBase.protocol === 'https:' ? 'wss:' : 'ws:';
  const forwardedHost = request.headers['x-forwarded-host'];
  const hostHeader = Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost || request.headers.host || '';
  const host = hostHeader.split(',')[0].trim().split(':')[0].toLowerCase();
  if (!/^[a-z0-9.-]{1,253}$/.test(host)) return reject(clientSocket, 400);
  const timestamp = Date.now().toString();
  const signature = await hmac(`${host}.${timestamp}`, ingressSecret);
  bridgeServer.handleUpgrade(request, clientSocket, head, (client) => {
    const upstream = new WebSocket(target, {
      headers: {
        authorization: `Bearer ${accessToken}`,
        'x-syndes-validated-host': host,
        'x-syndes-validated-at': timestamp,
        'x-syndes-validated-signature': signature,
      },
      maxPayload: 64 * 1024,
    });
    upstreamSockets.add(upstream);
    upstream.once('open', () => {
      upstream.on('message', (data, isBinary) => {
        if (client.readyState === WebSocket.OPEN) client.send(data, { binary: isBinary });
      });
      client.on('message', () => client.close(1008, 'client messages are not accepted'));
      client.on('close', () => upstream.close());
    });
    upstream.once('error', () => { if (client.readyState === WebSocket.OPEN) client.close(1011, 'upstream unavailable'); });
    upstream.once('close', () => { upstreamSockets.delete(upstream); if (client.readyState === WebSocket.OPEN) client.close(1001, 'upstream closed'); });
  });
}

function parseCookies(value) {
  return Object.fromEntries(value.split(';').map((part) => part.trim().split('=')));
}
async function hmac(value, secret) {
  const crypto = await import('node:crypto');
  return crypto.createHmac('sha256', secret).update(value).digest('hex');
}
function reject(socket, status) {
  if (socket.destroyed) return;
  socket.end(`HTTP/1.1 ${status} Error\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

server.listen(port, hostname, () => console.log(`web listening on ${hostname}:${port}`));
process.on('SIGTERM', () => { for (const ws of upstreamSockets) ws.close(); server.close(() => process.exit(0)); });
