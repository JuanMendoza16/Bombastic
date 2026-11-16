// Servidor de Bomberman: sirve el juego web, la API REST y las partidas online (WebSocket).
//
// Variables de entorno:
//   PORT          puerto HTTP (8123)
//   JWT_SECRET    secreto para firmar sesiones (obligatorio en producción)
//   DB_PATH       ruta de la base SQLite (data/bomberman.db)
//   LOG_FILE      archivo de logs (opcional)
//   ADMIN_USER / ADMIN_PASS / ADMIN_EMAIL   crea o actualiza un administrador al iniciar
//   CORS_ORIGIN   orígenes permitidos para la API (ej: https://usuario.github.io)
//   TRUST_PROXY   1 si está detrás de un proxy (usa X-Forwarded-For)
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { handleApi, clientIp } from './api';
import { Db } from './db';
import { log, setLogFile } from './log';
import { RoomManager } from './rooms';
import { hashPassword, randomToken } from './security';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const PORT = Number(process.env.PORT ?? 8123);
const VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version as string;

let SECRET = process.env.JWT_SECRET ?? '';
if (!SECRET) {
  SECRET = randomToken(32);
  log.warn('jwt_secret_missing', { msg: 'JWT_SECRET no definido: se generó uno temporal (las sesiones se pierden al reiniciar).' });
}

setLogFile(process.env.LOG_FILE ?? null);
const db = new Db(process.env.DB_PATH ?? join(ROOT, 'data', 'bomberman.db'));
const rooms = new RoomManager(db, SECRET);

// administrador inicial
if (process.env.ADMIN_USER && process.env.ADMIN_PASS) {
  const u = db.userByName(process.env.ADMIN_USER);
  if (!u) {
    db.createUser(process.env.ADMIN_USER, process.env.ADMIN_EMAIL ?? `${process.env.ADMIN_USER}@admin.local`, hashPassword(process.env.ADMIN_PASS), 'admin');
    log.info('admin_created', { user: process.env.ADMIN_USER });
  } else if (u.role !== 'admin') db.setRole(u.id, 'admin');
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data: blob:; media-src 'self' data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' ws: wss:; script-src 'self'; frame-ancestors 'self'",
};

const allowedOrigins = (process.env.CORS_ORIGIN ?? '').split(',').map((s) => s.trim()).filter(Boolean);

const server = createServer((req, res) => {
  const url = req.url ?? '/';
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);

  if (url.startsWith('/api/')) {
    const origin = req.headers.origin;
    if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    void handleApi(req, res, url, { db, rooms, secret: SECRET, version: VERSION });
    return;
  }

  // archivos estáticos del juego
  if (!existsSync(DIST)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('El juego no está compilado. Ejecutá "npm run build".');
    return;
  }
  let pathname = decodeURIComponent(url.split('?')[0]);
  if (pathname.endsWith('/')) pathname += 'index.html';
  const file = normalize(join(DIST, pathname));
  if (!file.startsWith(DIST)) {
    res.writeHead(403);
    res.end();
    return;
  }
  const target = existsSync(file) && statSync(file).isFile() ? file : join(DIST, 'index.html');
  const ext = extname(target);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': target.includes(`${join(DIST, 'assets')}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  createReadStream(target).pipe(res);
});

const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
server.on('upgrade', (req, socket, head) => {
  if (!(req.url ?? '').startsWith('/ws')) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    rooms.connect(ws, clientIp(req));
  });
});

const hb = setInterval(() => rooms.heartbeat(), 15000);
rooms.startLoop();

server.listen(PORT, () => {
  log.info('server_start', { port: PORT, version: VERSION, dist: existsSync(DIST) });
  console.log(`\n  💣 Bomberman listo en http://localhost:${PORT}\n`);
});

const shutdown = () => {
  log.info('server_stop');
  clearInterval(hb);
  rooms.stop();
  wss.close();
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
