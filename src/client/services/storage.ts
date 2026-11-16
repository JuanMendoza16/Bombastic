// Acceso seguro a localStorage (puede no estar disponible en modo privado).
const PREFIX = 'bomberman.';

export const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(PREFIX + key);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      /* sin almacenamiento: se juega igual */
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(PREFIX + key);
    } catch {
      /* nada */
    }
  },
};
