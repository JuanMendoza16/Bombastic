// API REST: autenticación (JWT), perfil, tienda, partidas, ranking y administración.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { priceOf } from '../src/shared/catalog';
import { MODES } from '../src/shared/balance';
import { MAP_ORDER } from '../src/shared/maps';
import { applyMatch, buyItem, equipItem, type MatchSummary } from '../src/shared/profile';
import { CLASS_IDS, type ClassId } from '../src/shared/types';
import type { Db, UserRow } from './db';
import { log } from './log';
import type { RoomManager } from './rooms';
import { EMAIL_RE, RateLimiter, USERNAME_RE, cleanText, hashPassword, randomToken, sha256, signJwt, validPassword, verifyJwt, verifyPassword, type JwtPayload } from './security';

export interface ApiCtx {
  db: Db;
  rooms: RoomManager;
  secret: string;
  version: string;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    msg: string,
  ) {
    super(msg);
  }
}

const authLimiter = new RateLimiter(10, 10 / 60);
const apiLimiter = new RateLimiter(120, 2);
const offlineLimiter = new RateLimiter(3, 1 / 20);

export function clientIp(req: IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && process.env.TRUST_PROXY === '1') return fwd.split(',')[0].trim();
  return req.socket.remoteAddress ?? '?';
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 64 * 1024) {
        reject(new HttpError(413, 'Petición demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new HttpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

function publicUser(u: UserRow) {
  return { id: u.id, username: u.username, role: u.role, email: u.email };
}

export async function handleApi(req: IncomingMessage, res: ServerResponse, path: string, ctx: ApiCtx): Promise<void> {
  const ip = clientIp(req);
  const method = req.method ?? 'GET';
  try {
    if (!apiLimiter.take(ip)) throw new HttpError(429, 'Demasiadas peticiones, esperá un momento.');
    const url = new URL(path, 'http://x');
    const p = url.pathname;
    const { db } = ctx;

    const auth = (): { jwt: JwtPayload; user: UserRow } => {
      const h = req.headers.authorization;
      const tok = h?.startsWith('Bearer ') ? h.slice(7) : null;
      const jwt = tok ? verifyJwt(tok, ctx.secret) : null;
      if (!jwt) throw new HttpError(401, 'Sesión inválida o vencida. Volvé a iniciar sesión.');
      const user = db.userById(jwt.sub);
      if (!user) throw new HttpError(401, 'Usuario inexistente.');
      if (user.banned) throw new HttpError(403, 'Tu cuenta está suspendida.');
      return { jwt, user };
    };
    const admin = () => {
      const a = auth();
      if (a.user.role !== 'admin') throw new HttpError(403, 'Se necesitan permisos de administrador.');
      return a;
    };

    // --- salud -------------------------------------------------------------------
    if (p === '/api/health' && method === 'GET') {
      return json(res, 200, { ok: true, name: 'Bomberman · PixelForge', version: ctx.version, ...ctx.rooms.stats() });
    }

    // --- autenticación -----------------------------------------------------------
    if (p === '/api/auth/register' && method === 'POST') {
      if (!authLimiter.take(ip)) throw new HttpError(429, 'Demasiados intentos. Probá en un minuto.');
      const b = (await readBody(req)) as Record<string, unknown>;
      const username = cleanText(b.username, 16);
      const email = cleanText(b.email, 254).toLowerCase();
      if (!USERNAME_RE.test(username)) throw new HttpError(400, 'El usuario debe tener entre 3 y 16 letras, números, punto, guion o guion bajo.');
      if (!EMAIL_RE.test(email)) throw new HttpError(400, 'Email inválido.');
      if (!validPassword(b.password)) throw new HttpError(400, 'La contraseña debe tener entre 6 y 128 caracteres.');
      if (db.userByName(username)) throw new HttpError(409, 'Ese nombre de usuario ya existe.');
      if (db.userByEmail(email)) throw new HttpError(409, 'Ya hay una cuenta con ese email.');
      const user = db.createUser(username, email, hashPassword(b.password));
      db.audit('register', user.id, username, ip);
      log.info('register', { user: user.id });
      const token = signJwt({ sub: user.id, role: user.role, name: user.username }, ctx.secret);
      return json(res, 201, { token, user: publicUser(user), profile: db.getProfile(user.id) });
    }

    if (p === '/api/auth/login' && method === 'POST') {
      if (!authLimiter.take(ip)) throw new HttpError(429, 'Demasiados intentos. Probá en un minuto.');
      const b = (await readBody(req)) as Record<string, unknown>;
      const username = cleanText(b.username, 254);
      const user = db.userByName(username) ?? db.userByEmail(username.toLowerCase());
      if (!user || typeof b.password !== 'string' || !verifyPassword(b.password, user.pass_hash)) {
        db.audit('login_fail', user?.id ?? null, username, ip);
        throw new HttpError(401, 'Usuario o contraseña incorrectos.');
      }
      if (user.banned) throw new HttpError(403, 'Tu cuenta está suspendida.');
      db.touchLogin(user.id);
      db.audit('login', user.id, '', ip);
      const token = signJwt({ sub: user.id, role: user.role, name: user.username }, ctx.secret);
      return json(res, 200, { token, user: publicUser(user), profile: db.getProfile(user.id) });
    }

    if (p === '/api/auth/forgot' && method === 'POST') {
      if (!authLimiter.take(ip)) throw new HttpError(429, 'Demasiados intentos. Probá en un minuto.');
      const b = (await readBody(req)) as Record<string, unknown>;
      const email = cleanText(b.email, 254).toLowerCase();
      const user = db.userByEmail(email);
      if (user) {
        const token = randomToken(9);
        db.addReset(sha256(token), user.id, Date.now() + 30 * 60000);
        db.audit('reset_request', user.id, '', ip);
        // Sin servicio de correo configurado: el código queda en el log del servidor
        // para que un administrador lo entregue (o se integre un proveedor SMTP).
        log.info('password_reset_code', { user: user.id, email, code: token });
      }
      // misma respuesta exista o no el email (evita enumerar cuentas)
      return json(res, 200, { ok: true, message: 'Si el email existe, te enviamos un código de recuperación (válido 30 minutos).' });
    }

    if (p === '/api/auth/reset' && method === 'POST') {
      if (!authLimiter.take(ip)) throw new HttpError(429, 'Demasiados intentos. Probá en un minuto.');
      const b = (await readBody(req)) as Record<string, unknown>;
      if (!validPassword(b.password)) throw new HttpError(400, 'La contraseña debe tener entre 6 y 128 caracteres.');
      const uid = db.useReset(sha256(cleanText(b.token, 64)));
      if (!uid) throw new HttpError(400, 'Código inválido o vencido.');
      db.setPassword(uid, hashPassword(b.password));
      db.audit('reset_done', uid, '', ip);
      return json(res, 200, { ok: true });
    }

    // --- perfil ------------------------------------------------------------------
    if (p === '/api/me' && method === 'GET') {
      const { user } = auth();
      return json(res, 200, { user: publicUser(user), profile: db.getProfile(user.id) });
    }

    if (p === '/api/me/profile' && method === 'PUT') {
      const { user } = auth();
      const b = (await readBody(req)) as Record<string, unknown>;
      const prof = db.getProfile(user.id);
      if (b.name !== undefined) {
        const name = cleanText(b.name, 16);
        if (name.length < 2) throw new HttpError(400, 'El nombre debe tener al menos 2 letras.');
        prof.name = name;
      }
      if (typeof b.favorite === 'string' && CLASS_IDS.includes(b.favorite as ClassId)) prof.favorite = b.favorite as ClassId;
      db.saveProfile(user.id, prof);
      return json(res, 200, { profile: prof });
    }

    if (p === '/api/me/equip' && method === 'POST') {
      const { user } = auth();
      const b = (await readBody(req)) as Record<string, unknown>;
      const prof = db.getProfile(user.id);
      const r = equipItem(prof, cleanText(b.key, 60), typeof b.slot === 'number' ? b.slot : undefined);
      if (!r.ok) throw new HttpError(400, r.error ?? 'No se pudo equipar.');
      db.saveProfile(user.id, prof);
      return json(res, 200, { profile: prof });
    }

    if (p === '/api/me/history' && method === 'GET') {
      const { user } = auth();
      return json(res, 200, { matches: db.history(user.id) });
    }

    // --- tienda ------------------------------------------------------------------
    if (p === '/api/shop/buy' && method === 'POST') {
      const { user } = auth();
      const b = (await readBody(req)) as Record<string, unknown>;
      const key = cleanText(b.key, 60);
      const price = priceOf(key);
      if (price === null) throw new HttpError(404, 'Ítem inexistente.');
      const prof = db.getProfile(user.id);
      const r = buyItem(prof, key, price);
      if (!r.ok) throw new HttpError(400, r.error ?? 'No se pudo comprar.');
      db.saveProfile(user.id, prof);
      db.logPurchase(user.id, key, price);
      db.audit('buy', user.id, key, ip);
      return json(res, 200, { profile: prof });
    }

    // --- partidas contra bots (offline) con cuenta -----------------------------
    if (p === '/api/matches/offline' && method === 'POST') {
      const { user } = auth();
      if (!offlineLimiter.take(`u${user.id}`)) throw new HttpError(429, 'Demasiados resultados seguidos.');
      const b = (await readBody(req)) as Partial<MatchSummary>;
      const sum = validateSummary(b);
      const prof = db.getProfile(user.id);
      const rewards = applyMatch(prof, sum);
      db.saveProfile(user.id, prof);
      db.audit('offline_match', user.id, `${sum.mode}/${sum.map}/${sum.result}`, ip);
      return json(res, 200, { profile: prof, rewards });
    }

    // --- ranking -------------------------------------------------------------------
    if (p === '/api/ranking' && method === 'GET') {
      const type = url.searchParams.get('type');
      const t = type === 'semanal' || type === 'historico' ? type : 'global';
      const rows = db.ranking(t).map((r, i) => ({ rank: i + 1, name: r.name, elo: r.elo, level: r.level, value: r.value }));
      return json(res, 200, { rows });
    }

    if (p === '/api/status' && method === 'GET') {
      const s = db.getServerSettings();
      return json(res, 200, {
        announcementEnabled: s.announcementEnabled,
        announcementText: s.announcementText,
        maintenanceActive: db.isMaintenanceActive(),
        maintenanceEnabled: s.maintenanceEnabled,
        maintenanceStart: s.maintenanceStart,
        maintenanceEnd: s.maintenanceEnd,
      });
    }

    // --- administración ------------------------------------------------------------
    if (p === '/api/admin/stats' && method === 'GET') {
      admin();
      return json(res, 200, { ...db.adminStats(), ...ctx.rooms.stats() });
    }
    if (p === '/api/admin/users' && method === 'GET') {
      admin();
      return json(res, 200, { users: db.adminUsers(cleanText(url.searchParams.get('q') ?? '', 60)) });
    }
    if (p === '/api/admin/matches' && method === 'GET') {
      admin();
      return json(res, 200, { matches: db.adminMatches() });
    }
    const m = /^\/api\/admin\/users\/(\d+)\/(ban|unban|role)$/.exec(p);
    if (m && method === 'POST') {
      const { user: adminUser } = admin();
      const id = Number(m[1]);
      if (id === adminUser.id) throw new HttpError(400, 'No podés modificar tu propia cuenta.');
      if (!db.userById(id)) throw new HttpError(404, 'Usuario inexistente.');
      if (m[2] === 'role') {
        const b = (await readBody(req)) as Record<string, unknown>;
        const role = b.role === 'admin' ? 'admin' : 'player';
        db.setRole(id, role);
      } else db.setBanned(id, m[2] === 'ban');
      db.audit(`admin_${m[2]}`, adminUser.id, `target=${id}`, ip);
      return json(res, 200, { ok: true });
    }
    const grantMatch = /^\/api\/admin\/users\/(\d+)\/grant$/.exec(p);
    if (grantMatch && method === 'POST') {
      const { user: adminUser } = admin();
      const id = Number(grantMatch[1]);
      if (!db.userById(id)) throw new HttpError(404, 'Usuario inexistente.');
      const b = (await readBody(req)) as Record<string, unknown>;
      const coins = typeof b.coins === 'number' && Number.isFinite(b.coins) ? Math.max(0, Math.floor(b.coins)) : 0;
      const itemId = typeof b.itemId === 'string' && b.itemId.trim() ? cleanText(b.itemId, 60) : undefined;
      if (coins === 0 && !itemId) throw new HttpError(400, 'Indicá monedas o un ítem para otorgar.');
      const result = db.grantUserResource(id, coins, itemId);
      db.audit('admin_grant', adminUser.id, `target=${id} coins=${coins} item=${itemId ?? ''}`, ip);
      return json(res, 200, { ok: true, ...result });
    }
    if (p === '/api/admin/settings' && method === 'GET') {
      admin();
      return json(res, 200, { settings: db.getServerSettings(), maintenanceActive: db.isMaintenanceActive() });
    }
    if (p === '/api/admin/settings' && method === 'PUT') {
      const { user: adminUser } = admin();
      const b = (await readBody(req)) as Record<string, unknown>;
      const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/;
      const patch: Record<string, unknown> = {};
      if (typeof b.announcementEnabled === 'boolean') patch.announcementEnabled = b.announcementEnabled;
      if (typeof b.announcementText === 'string') patch.announcementText = cleanText(b.announcementText, 240);
      if (typeof b.maintenanceEnabled === 'boolean') patch.maintenanceEnabled = b.maintenanceEnabled;
      if (typeof b.maintenanceStart === 'string' && timeRe.test(b.maintenanceStart)) patch.maintenanceStart = b.maintenanceStart;
      if (typeof b.maintenanceEnd === 'string' && timeRe.test(b.maintenanceEnd)) patch.maintenanceEnd = b.maintenanceEnd;
      if (typeof b.autoDeployEnabled === 'boolean') patch.autoDeployEnabled = b.autoDeployEnabled;
      if (typeof b.autoDeploySchedule === 'string' && timeRe.test(b.autoDeploySchedule)) patch.autoDeploySchedule = b.autoDeploySchedule;
      const settings = db.setServerSettings(patch);
      db.audit('admin_settings', adminUser.id, JSON.stringify(patch), ip);
      return json(res, 200, { settings, maintenanceActive: db.isMaintenanceActive() });
    }
    if (p === '/api/admin/deploy' && method === 'POST') {
      const { user: adminUser } = admin();
      const token = process.env.GH_DEPLOY_TOKEN;
      const repo = process.env.GH_REPO ?? 'JuanMendoza16/Bombastic';
      if (!token) {
        throw new HttpError(400, 'Falta configurar GH_DEPLOY_TOKEN en el servidor para disparar la subida manual.');
      }
      const ghRes = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/docker.yml/dispatches`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Bombastic-Admin',
        },
        body: JSON.stringify({ ref: 'main' }),
      });
      if (!ghRes.ok) {
        const txt = await ghRes.text();
        throw new HttpError(502, `GitHub respondió ${ghRes.status}: ${txt.slice(0, 160)}`);
      }
      db.audit('admin_deploy', adminUser.id, `repo=${repo}`, ip);
      return json(res, 200, { ok: true });
    }

    throw new HttpError(404, 'Ruta inexistente.');
  } catch (e) {
    if (e instanceof HttpError) return json(res, e.status, { error: e.message });
    log.error('api_error', { path, err: String(e) });
    return json(res, 500, { error: 'Error interno del servidor.' });
  }
}

function validateSummary(b: Partial<MatchSummary>): MatchSummary {
  const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)));
  const mode = b.mode && b.mode in MODES ? b.mode : null;
  const map = b.map && ([...MAP_ORDER, 'tutorial'] as string[]).includes(b.map) ? b.map : null;
  const cls = b.cls && CLASS_IDS.includes(b.cls) ? b.cls : null;
  if (!mode || !map || !cls) throw new HttpError(400, 'Resultado inválido.');
  const duration = int(b.duration, 3600);
  if (mode !== 'tutorial' && duration < 20) throw new HttpError(400, 'Partida demasiado corta.');
  const result = b.result === 'win' || b.result === 'lose' || b.result === 'draw' ? b.result : 'lose';
  // límites razonables según la duración (anti trampas)
  const perMin = Math.max(1, duration / 60);
  return {
    mode,
    map,
    cls,
    result,
    kills: int(b.kills, Math.ceil(perMin * 8)),
    deaths: int(b.deaths, 500),
    assists: int(b.assists, Math.ceil(perMin * 8)),
    caps: int(b.caps, 10),
    returns: int(b.returns, 30),
    defends: int(b.defends, 50),
    dmg: int(b.dmg, Math.ceil(perMin * 2500)),
    heal: int(b.heal, Math.ceil(perMin * 2500)),
    blocks: int(b.blocks, 400),
    points: int(b.points, Math.ceil(perMin * 3000)),
    roundWins: int(b.roundWins, 10),
    duration,
    bestStreak: int(b.bestStreak, 50),
    online: false,
    difficulty: b.difficulty !== undefined ? (int(b.difficulty, 3) as 0 | 1 | 2 | 3) : undefined,
    pointsShare: Math.max(0, Math.min(1, Number(b.pointsShare) || 0)),
    festival: b.festival ? int(b.festival, 12) || undefined : undefined,
    festivalStars: b.festivalStars !== undefined ? int(b.festivalStars, 3) : undefined,
    festivalReward: b.festival ? Math.min(400, int(b.festivalReward, 400)) : undefined,
  };
}
