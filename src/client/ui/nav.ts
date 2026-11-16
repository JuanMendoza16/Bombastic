// Navegación simple entre pantallas (pila con historial).
import { useEffect, useState } from 'preact/hooks';

export type ScreenId =
  | 'splash'
  | 'title'
  | 'menu'
  | 'play'
  | 'charselect'
  | 'game'
  | 'festival'
  | 'online'
  | 'room'
  | 'characters'
  | 'shop'
  | 'locker'
  | 'profile'
  | 'ranking'
  | 'settings'
  | 'credits'
  | 'auth'
  | 'admin';

export interface Route {
  id: ScreenId;
  params?: Record<string, unknown>;
}

type Listener = (r: Route) => void;

class Nav {
  stack: Route[] = [{ id: 'splash' }];
  private listeners = new Set<Listener>();

  get current(): Route {
    return this.stack[this.stack.length - 1];
  }

  go(id: ScreenId, params?: Record<string, unknown>) {
    this.stack.push({ id, params });
    if (this.stack.length > 20) this.stack.shift();
    this.emit();
  }

  replace(id: ScreenId, params?: Record<string, unknown>) {
    this.stack[this.stack.length - 1] = { id, params };
    this.emit();
  }

  /** Vuelve a una pantalla (limpiando lo que había arriba). */
  reset(id: ScreenId, params?: Record<string, unknown>) {
    this.stack = [{ id: 'menu' }];
    if (id !== 'menu') this.stack.push({ id, params });
    this.emit();
  }

  back() {
    if (this.stack.length > 1) this.stack.pop();
    else this.stack = [{ id: 'menu' }];
    this.emit();
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    for (const l of this.listeners) l(this.current);
  }
}

export const nav = new Nav();

export function useRoute(): Route {
  const [r, setR] = useState(nav.current);
  useEffect(() => nav.subscribe(setR), []);
  return r;
}
