// Cliente de la API REST del backend (si hay servidor disponible).
import { settings } from './settings';
import { store } from './storage';

export class ApiError extends Error {
  status: number;
  constructor(status: number, msg: string) {
    super(msg);
    this.status = status;
  }
}

export function apiBase(): string {
  const custom = settings.get().serverUrl.trim().replace(/\/$/, '');
  return custom;
}

export function wsUrl(): string {
  const base = apiBase();
  if (base) return base.replace(/^http/, 'ws') + '/ws';
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}${basePath()}ws`;
}

function basePath(): string {
  // soporta que el juego esté servido en una subcarpeta
  const p = location.pathname;
  return p.endsWith('/') ? p : p.slice(0, p.lastIndexOf('/') + 1);
}

function url(path: string): string {
  const base = apiBase();
  if (base) return base + path;
  return basePath() + path.replace(/^\//, '');
}

export function getToken(): string | null {
  return store.get<string | null>('token', null);
}

export function setToken(t: string | null) {
  if (t) store.set('token', t);
  else store.remove('token');
}

export async function api<T>(method: string, path: string, body?: unknown, timeoutMs = 8000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const tok = getToken();
    if (tok) headers.Authorization = `Bearer ${tok}`;
    const res = await fetch(url(path), { method, headers, body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const text = await res.text();
    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      throw new ApiError(res.status, 'Respuesta inválida del servidor');
    }
    if (!res.ok) throw new ApiError(res.status, (data as { error?: string })?.error ?? `Error ${res.status}`);
    return data as T;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'No se pudo conectar con el servidor');
  } finally {
    clearTimeout(timer);
  }
}

let serverChecked: Promise<boolean> | null = null;
export let serverInfo: { name: string; version: string; online: number } | null = null;

/** ¿Hay un servidor online disponible? */
export function detectServer(force = false): Promise<boolean> {
  if (serverChecked && !force) return serverChecked;
  serverChecked = api<{ ok: boolean; name: string; version: string; online: number }>('GET', '/api/health', undefined, 2500)
    .then((r) => {
      serverInfo = r;
      return !!r?.ok;
    })
    .catch(() => {
      serverInfo = null;
      return false;
    });
  return serverChecked;
}
