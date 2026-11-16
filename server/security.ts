// Seguridad: hash de contraseñas (scrypt), JWT (HS256), límites de uso y validaciones.
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// ---------------------------------------------------------------------------
// Contraseñas
// ---------------------------------------------------------------------------

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const got = scryptSync(pw, Buffer.from(saltB64, 'base64'), expected.length, { N: 16384, r: 8, p: 1 });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 24): string {
  return randomBytes(bytes).toString('base64url');
}

// ---------------------------------------------------------------------------
// JWT HS256
// ---------------------------------------------------------------------------

export interface JwtPayload {
  sub: number;
  role: 'player' | 'admin';
  name: string;
  iat: number;
  exp: number;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

export function signJwt(payload: Omit<JwtPayload, 'iat' | 'exp'>, secret: string, ttlSec = 7 * 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({ ...payload, iat: now, exp: now + ttlSec });
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  try {
    const h = JSON.parse(Buffer.from(header, 'base64url').toString());
    if (h.alg !== 'HS256') return null;
    const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
    const got = Buffer.from(sig, 'base64url');
    if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as JwtPayload;
    if (typeof p.sub !== 'number' || typeof p.exp !== 'number') return null;
    if (p.exp < Math.floor(Date.now() / 1000)) return null;
    return p;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Límite de peticiones (token bucket por clave)
// ---------------------------------------------------------------------------

export class RateLimiter {
  private buckets = new Map<string, { tokens: number; last: number }>();
  constructor(
    private capacity: number,
    private perSecond: number,
  ) {}

  take(key: string, cost = 1): boolean {
    const now = Date.now() / 1000;
    let b = this.buckets.get(key);
    if (!b) {
      b = { tokens: this.capacity, last: now };
      this.buckets.set(key, b);
    }
    b.tokens = Math.min(this.capacity, b.tokens + (now - b.last) * this.perSecond);
    b.last = now;
    if (b.tokens < cost) return false;
    b.tokens -= cost;
    if (this.buckets.size > 20000) this.buckets.clear();
    return true;
  }
}

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

export const USERNAME_RE = /^[A-Za-z0-9_áéíóúÁÉÍÓÚñÑ.-]{3,16}$/;
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

export function validPassword(pw: unknown): pw is string {
  return typeof pw === 'string' && pw.length >= 6 && pw.length <= 128;
}

/** Limpia texto libre (chat, nombres): sin caracteres de control y con largo máximo. */
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);
}

const BAD_WORDS = ['puto', 'puta', 'mierda', 'pelotudo', 'boludo', 'forro', 'concha', 'verga'];
export function filterChat(s: string): string {
  let out = s;
  for (const w of BAD_WORDS) out = out.replace(new RegExp(`\\b${w}\\b`, 'gi'), '*'.repeat(w.length));
  return out;
}
