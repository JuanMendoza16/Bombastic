// Servicio de perfil: guarda el progreso en el navegador (invitado) o en la cuenta
// del servidor (sesión iniciada).
import { priceOf } from '../../shared/catalog';
import { applyMatch, buyItem, equipItem, newProfile, normalizeProfile, type MatchRewards, type MatchSummary, type Profile } from '../../shared/profile';
import type { ClassId } from '../../shared/types';
import { api, detectServer, getToken, setToken } from './api';
import { store } from './storage';

export interface User {
  id: number;
  username: string;
  role: 'player' | 'admin';
  email?: string;
}

type Listener = () => void;

class ProfileService {
  profile: Profile;
  user: User | null = null;
  serverOnline = false;
  private listeners = new Set<Listener>();

  constructor() {
    const saved = store.get<Profile | null>('profile', null);
    this.profile = saved ? normalizeProfile(saved) : newProfile(randomName());
  }

  get remote() {
    return !!this.user;
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    if (!this.user) store.set('profile', this.profile);
    for (const l of this.listeners) l();
  }

  /** Detecta servidor y restaura la sesión si había token. */
  async init() {
    this.serverOnline = await detectServer();
    if (this.serverOnline && getToken()) {
      try {
        const r = await api<{ user: User; profile: Profile }>('GET', '/api/me');
        this.user = r.user;
        this.profile = normalizeProfile(r.profile);
      } catch {
        setToken(null);
      }
    }
    this.emit();
  }

  async login(username: string, password: string) {
    const r = await api<{ token: string; user: User; profile: Profile }>('POST', '/api/auth/login', { username, password });
    setToken(r.token);
    this.user = r.user;
    this.profile = normalizeProfile(r.profile);
    this.emit();
  }

  async register(username: string, email: string, password: string) {
    const r = await api<{ token: string; user: User; profile: Profile }>('POST', '/api/auth/register', { username, email, password });
    setToken(r.token);
    this.user = r.user;
    this.profile = normalizeProfile(r.profile);
    this.emit();
  }

  async forgot(email: string) {
    return api<{ ok: boolean; message: string }>('POST', '/api/auth/forgot', { email });
  }

  async resetPassword(token: string, password: string) {
    return api<{ ok: boolean }>('POST', '/api/auth/reset', { token, password });
  }

  logout() {
    setToken(null);
    this.user = null;
    const saved = store.get<Profile | null>('profile', null);
    this.profile = saved ? normalizeProfile(saved) : newProfile(randomName());
    this.emit();
  }

  async refresh() {
    if (!this.user) return;
    const r = await api<{ user: User; profile: Profile }>('GET', '/api/me');
    this.profile = normalizeProfile(r.profile);
    this.emit();
  }

  async rename(name: string) {
    const clean = name.trim().slice(0, 16);
    if (clean.length < 2) throw new Error('El nombre debe tener al menos 2 letras.');
    if (this.user) {
      const r = await api<{ profile: Profile }>('PUT', '/api/me/profile', { name: clean });
      this.profile = normalizeProfile(r.profile);
    } else this.profile.name = clean;
    this.emit();
  }

  async setFavorite(cls: ClassId) {
    this.profile.favorite = cls;
    if (this.user) {
      try {
        await api('PUT', '/api/me/profile', { favorite: cls });
      } catch {
        /* no es crítico */
      }
    }
    this.emit();
  }

  async buy(key: string): Promise<{ ok: boolean; error?: string }> {
    const price = priceOf(key);
    if (price === null) return { ok: false, error: 'Ítem inexistente.' };
    if (this.user) {
      try {
        const r = await api<{ profile: Profile }>('POST', '/api/shop/buy', { key });
        this.profile = normalizeProfile(r.profile);
        this.emit();
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
    const r = buyItem(this.profile, key, price);
    this.emit();
    return r;
  }

  async equip(key: string, slot?: number): Promise<{ ok: boolean; error?: string }> {
    const r = equipItem(this.profile, key, slot);
    if (r.ok && this.user) {
      try {
        const res = await api<{ profile: Profile }>('POST', '/api/me/equip', { key, slot });
        this.profile = normalizeProfile(res.profile);
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    }
    this.emit();
    return r;
  }

  /** Registra el resultado de una partida offline (contra bots / local). */
  async reportMatch(m: MatchSummary): Promise<MatchRewards> {
    if (this.user) {
      try {
        const r = await api<{ profile: Profile; rewards: MatchRewards }>('POST', '/api/matches/offline', m);
        this.profile = normalizeProfile(r.profile);
        this.emit();
        return r.rewards;
      } catch {
        /* si el servidor falla, se aplica localmente para no perder la experiencia */
      }
    }
    const r = applyMatch(this.profile, m);
    this.emit();
    return r;
  }

  /** Aplica un perfil actualizado que llega del servidor (partida online). */
  setRemoteProfile(p: Profile) {
    this.profile = normalizeProfile(p);
    this.emit();
  }

  /** Borra el progreso local. */
  resetLocal() {
    store.remove('profile');
    this.profile = newProfile(randomName());
    this.emit();
  }

  skinFor(cls: ClassId): string {
    return this.profile.equip.skins[cls] ?? 'base';
  }
}

function randomName(): string {
  const a = ['Bomber', 'Chispa', 'Mecha', 'Pólvora', 'Kaboom', 'Petardo', 'Trueno', 'Fénix'];
  return `${a[Math.floor(Math.random() * a.length)]}${Math.floor(Math.random() * 900 + 100)}`;
}

export const profiles = new ProfileService();
