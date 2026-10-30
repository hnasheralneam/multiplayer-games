import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import websocket from '@fastify/websocket';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import { normalizeCode, type ServerMessage } from '../shared/types';
import { defaultDescription, defaultTitle, injectMeta } from './meta';
import { RoomRegistry, type CreateInput } from './registry';
import { parseClientMessage } from './protocol';
import type { Client } from './client';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const CLIENT_DIR = path.resolve(process.env.CLIENT_DIR ?? 'dist/client');
const INDEX_PATH = path.join(CLIENT_DIR, 'index.html');
const ASSET_DIR = path.join(CLIENT_DIR, 'assets');
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN?.replace(/\/+$/, '');

const registry = new RoomRegistry();
const sockets = new Set<WebSocket>();
const joinAttempts = new Map<string, number[]>();

const MIME: Record<string, string> = {
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws: wss:",
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'"
].join('; ');

let cachedIndex: string | null = null;
let cachedIndexMtime = 0;

function indexHtml(): string | null {
  if (!existsSync(INDEX_PATH)) return null;
  const mtime = statSync(INDEX_PATH).mtimeMs;
  if (!cachedIndex || mtime !== cachedIndexMtime) {
    cachedIndex = readFileSync(INDEX_PATH, 'utf8');
    cachedIndexMtime = mtime;
  }
  return cachedIndex;
}

const devFallback = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Games server</title>
<style>body{background:#0b0e13;color:#e8edf7;font:16px system-ui;padding:10vh 8vw;line-height:1.6}a{color:#f5b942}code{background:#1b2230;padding:.2em .4em;border-radius:5px}</style>
</head><body>
<h1>Games server is running.</h1>
<p>The app is built and served from <code>dist/client</code> in production.</p>
<p>For development, run <code>npm run dev</code> and open <a href="http://localhost:5173">http://localhost:5173</a>.</p>
</body></html>`;

function originFor(request: FastifyRequest): string {
  if (PUBLIC_ORIGIN) return PUBLIC_ORIGIN;
  return `${request.protocol}://${request.headers.host ?? `localhost:${PORT}`}`;
}

function sendApp(reply: FastifyReply, meta: Parameters<typeof injectMeta>[1] = {}): void {
  const html = indexHtml();
  reply
    .header('Cache-Control', 'no-store')
    .type('text/html; charset=utf-8')
    .send(html ? injectMeta(html, meta) : devFallback);
}

function sendFile(reply: FastifyReply, filePath: string, cache: string): void {
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    reply.code(404).send('Not found');
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  reply
    .header('Content-Type', MIME[ext] ?? 'application/octet-stream')
    .header('Cache-Control', cache)
    .send(readFileSync(filePath));
}

function lanAddress(): string | null {
  let fallback: string | null = null;
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== 'IPv4' || address.internal) continue;
      if (address.address.startsWith('100.64.') || address.address.startsWith('169.254.')) {
        fallback ??= address.address;
        continue;
      }
      return address.address;
    }
  }
  return fallback;
}

function allowJoin(ip: string): boolean {
  const now = Date.now();
  const recent = (joinAttempts.get(ip) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= 120) {
    joinAttempts.set(ip, recent);
    return false;
  }
  recent.push(now);
  joinAttempts.set(ip, recent);
  return true;
}

const app = Fastify({
  logger: false,
  bodyLimit: 16_384,
  trustProxy: process.env.TRUST_PROXY === '1'
});

await app.register(websocket, { options: { maxPayload: 8192 } });

app.addHook('onSend', async (request, reply, payload) => {
  reply.header('X-Content-Type-Options', 'nosniff');
  reply.header('Referrer-Policy', 'no-referrer');
  reply.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  const type = String(reply.getHeader('content-type') ?? '');
  if (type.startsWith('text/html')) {
    reply.header('Content-Security-Policy', CSP);
  }
  return payload;
});

app.get('/', async (request, reply) => {
  const origin = originFor(request);
  sendApp(reply, {
    url: `${origin}/`,
    image: `${origin}/og.png`
  });
});

app.get('/join', async (request, reply) => {
  const origin = originFor(request);
  sendApp(reply, { url: `${origin}/join`, image: `${origin}/og.png` });
});

app.get<{ Params: { code: string } }>('/r/:code', async (request, reply) => {
  const code = normalizeCode(request.params.code);
  const room = code ? registry.get(code) : undefined;
  const origin = originFor(request);
  sendApp(reply, {
    title: code ? `Join the table · ${code}` : defaultTitle,
    description: 'Minesweeper, Sudoku, Klondike, FreeCell, and friends. No signup — just tap to join.',
    url: code ? `${origin}/r/${code}` : `${origin}/`,
    image: `${origin}/og.png`,
    roomCode: code ?? undefined
  });
});

app.get('/api/health', async () => {
  return { ok: true, rooms: registry.rooms.size };
});

app.get('/api/config', async () => {
  return { lanHost: lanAddress(), publicOrigin: PUBLIC_ORIGIN ?? null };
});

app.get<{ Params: { code: string } }>('/api/rooms/:code', async (request, reply) => {
  const code = normalizeCode(request.params.code);
  if (!code) return reply.code(404).send({ error: 'not_found', message: 'That room code is not valid.' });
  const room = registry.get(code);
  if (!room) return reply.code(404).send({ error: 'not_found', message: 'That room does not exist.' });
  reply.header('Cache-Control', 'no-store');
  return { room: room.toPublic(), serverNow: Date.now() };
});

app.post<{ Body: CreateInput }>('/api/rooms', async (request, reply) => {
  const body = (request.body ?? {}) as CreateInput;
  const result = registry.create(request.ip, body);
  if (!result.ok) {
    if (result.reason === 'rate_limited') {
      return reply.code(429).send({
        error: 'rate_limited',
        message: 'Too many rooms from this network. Wait a minute and try again.'
      });
    }
    return reply.code(503).send({
      error: 'unavailable',
      message: 'The room table is full right now. Try again in a moment.'
    });
  }
  return reply.code(201).send({ code: result.code, token: result.token });
});

app.get('/assets/*', async (request, reply) => {
  const relative = (request.params as Record<string, string>)['*'] ?? '';
  const target = path.resolve(ASSET_DIR, relative);
  if (!target.startsWith(ASSET_DIR + path.sep)) {
    return reply.code(404).send('Not found');
  }
  sendFile(reply, target, 'public, max-age=31536000, immutable');
});

for (const [route, file] of [
  ['/favicon.svg', 'favicon.svg'],
  ['/og.png', 'og.png'],
  ['/icon-192.png', 'icon-192.png']
] as const) {
  app.get(route, async (_request, reply) => {
    sendFile(reply, path.join(CLIENT_DIR, file), route === '/og.png' ? 'public, max-age=3600' : 'public, max-age=86400');
  });
}

app.get('/theme-init.js', async (_request, reply) => {
  sendFile(reply, path.join(CLIENT_DIR, 'theme-init.js'), 'public, max-age=3600');
});

app.get('/robots.txt', async (_request, reply) => {
  reply.type('text/plain').send('User-agent: *\nDisallow: /\n');
});

app.get('/ws', { websocket: true }, (socket, request) => {
  const client: Client = {
    id: randomUUID(),
    ip: request.ip,
    socket,
    joinedAt: Date.now(),
    send(message: ServerMessage) {
      if (socket.readyState === 1) socket.send(JSON.stringify(message));
    },
    close(code = 1000, reason = '') {
      try {
        socket.close(code, reason);
      } catch {
      }
    }
  };

  sockets.add(socket);
  (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
  socket.on('pong', () => {
    (socket as WebSocket & { isAlive?: boolean }).isAlive = true;
  });

  let joined = false;
  const joinTimeout = setTimeout(() => {
    if (!joined) {
      client.send({
        t: 'error',
        code: 'not_found',
        message: 'The connection sat idle too long. Reload to try again.'
      });
      socket.close(4000, 'idle');
    }
  }, 15_000);

  socket.on('message', (raw) => {
    const text = typeof raw === 'string' ? raw : raw.toString();
    if (text.length > 8192) {
      client.close(4009, 'too large');
      return;
    }
    const message = parseClientMessage(text);
    if (!message) {
      client.send({ t: 'error', code: 'bad_message', message: 'That message did not make sense.' });
      return;
    }

    try {
      if (message.t === 'join') {
        if (!client.roomCode && !allowJoin(client.ip)) {
          client.send({
            t: 'error',
            code: 'rate_limited',
            message: 'Too many join attempts. Wait a minute and try again.'
          });
          return;
        }
        const code = normalizeCode(message.code);
        const room = code ? registry.get(code) : undefined;
        if (!room) {
          client.send({
            t: 'error',
            code: 'not_found',
            message: 'No room with that code. Check the letters, or ask for a new link.'
          });
          return;
        }
        if (client.roomCode && client.roomCode !== room.code) {
          registry.get(client.roomCode)?.disconnect(client);
          client.roomCode = undefined;
          client.playerId = undefined;
          client.role = undefined;
        }
        joined = true;
        clearTimeout(joinTimeout);
        room.handleJoin(client, message);
        return;
      }

      if (!joined || !client.roomCode) {
        client.send({ t: 'error', code: 'not_found', message: 'Join a room first.' });
        return;
      }
      const room = registry.get(client.roomCode);
      if (!room) {
        client.send({ t: 'error', code: 'not_found', message: 'That room has closed.' });
        return;
      }
      room.handleMessage(client, message);
    } catch (error) {
      console.error('ws message failed', error);
      client.send({ t: 'error', code: 'server_error', message: 'Something broke on our end.' });
    }
  });

  socket.on('close', () => {
    sockets.delete(socket);
    clearTimeout(joinTimeout);
    if (client.roomCode) {
      registry.get(client.roomCode)?.disconnect(client);
    }
  });

  socket.on('error', (error) => {
    console.error('ws error', error);
    sockets.delete(socket);
    clearTimeout(joinTimeout);
    if (client.roomCode) registry.get(client.roomCode)?.disconnect(client);
  });
});

app.setNotFoundHandler((request, reply) => {
  const url = request.url.split('?')[0];
  if (url.startsWith('/api') || url.startsWith('/ws') || url.startsWith('/assets')) {
    return reply.code(404).send({ error: 'not_found' });
  }
  if (request.method === 'GET' && !path.extname(url)) {
    return sendApp(reply, {});
  }
  return reply.code(404).send('Not found');
});

const sweeper = setInterval(() => registry.sweep(), 30_000);

const heartbeat = setInterval(() => {
  for (const socket of sockets) {
    const tracked = socket as WebSocket & { isAlive?: boolean };
    if (tracked.isAlive === false) {
      socket.terminate();
      sockets.delete(socket);
      continue;
    }
    tracked.isAlive = false;
    try {
      socket.ping();
    } catch {
      socket.terminate();
      sockets.delete(socket);
    }
  }
}, 30_000);

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, closing rooms.`);
  clearInterval(sweeper);
  clearInterval(heartbeat);
  registry.closeAll();
  await app.close().catch(() => undefined);
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

await app.listen({ port: PORT, host: HOST });

console.log(`\n  Games, together`);
console.log(`  local:  http://localhost:${PORT}`);
for (const addresses of Object.values(networkInterfaces())) {
  for (const address of addresses ?? []) {
    if (address.family === 'IPv4' && !address.internal) {
      console.log(`  LAN:    http://${address.address}:${PORT}`);
    }
  }
}
if (PUBLIC_ORIGIN) console.log(`  public: ${PUBLIC_ORIGIN}`);
console.log('');
