// Ajustes del jugador (se guardan en el navegador).
import { store } from './storage';

export interface KeyMap {
  up: string;
  down: string;
  left: string;
  right: string;
  bomb: string;
  attack: string;
  hyper: string;
  emote: string;
}

export interface Settings {
  master: number;
  music: number;
  sfx: number;
  shake: number;
  damageNumbers: boolean;
  names: boolean;
  colorblind: boolean;
  reducedMotion: boolean;
  showFps: boolean;
  touch: 'auto' | 'on' | 'off';
  keys: { p1: KeyMap; p2: KeyMap };
  difficulty: 0 | 1 | 2 | 3;
  serverUrl: string;
  seenTutorial: boolean;
}

export const DEFAULT_KEYS: { p1: KeyMap; p2: KeyMap } = {
  p1: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', bomb: 'Space', attack: 'KeyJ', hyper: 'KeyK', emote: 'KeyT' },
  p2: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', bomb: 'Enter', attack: 'ShiftRight', hyper: 'ControlRight', emote: 'Backslash' },
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.45,
  sfx: 0.8,
  shake: 1,
  damageNumbers: true,
  names: true,
  colorblind: false,
  reducedMotion: false,
  showFps: false,
  touch: 'auto',
  keys: DEFAULT_KEYS,
  difficulty: 1,
  serverUrl: '',
  seenTutorial: false,
};

type Listener = (s: Settings) => void;

class SettingsStore {
  private s: Settings;
  private listeners = new Set<Listener>();

  constructor() {
    const saved = store.get<Partial<Settings>>('settings', {});
    this.s = {
      ...DEFAULT_SETTINGS,
      ...saved,
      keys: {
        p1: { ...DEFAULT_KEYS.p1, ...(saved.keys?.p1 ?? {}) },
        p2: { ...DEFAULT_KEYS.p2, ...(saved.keys?.p2 ?? {}) },
      },
    };
  }

  get(): Settings {
    return this.s;
  }

  set(patch: Partial<Settings>) {
    this.s = { ...this.s, ...patch };
    store.set('settings', this.s);
    for (const l of this.listeners) l(this.s);
  }

  reset() {
    const keep = { seenTutorial: this.s.seenTutorial, serverUrl: this.s.serverUrl };
    this.s = { ...DEFAULT_SETTINGS, ...keep };
    store.set('settings', this.s);
    for (const l of this.listeners) l(this.s);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const settings = new SettingsStore();

const KEY_NAMES: Record<string, string> = {
  Space: 'Espacio',
  Enter: 'Enter',
  ShiftLeft: 'Shift izq.',
  ShiftRight: 'Shift der.',
  ControlLeft: 'Ctrl izq.',
  ControlRight: 'Ctrl der.',
  AltLeft: 'Alt',
  AltRight: 'Alt der.',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backslash: '\\',
  Slash: '/',
  Period: '.',
  Comma: ',',
  Semicolon: 'Ñ',
  Minus: '-',
  Tab: 'Tab',
  Backspace: 'Borrar',
};

export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num ' + code.slice(6);
  return code;
}
