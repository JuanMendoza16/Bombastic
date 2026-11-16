// Entrada de jugadores locales: teclado, mando (Gamepad API) y controles táctiles.
import type { Dir, PlayerInput } from '../../shared/types';
import { settings, type KeyMap } from '../services/settings';

interface LocalState {
  bomb: number;
  hyper: number;
  emote: number;
  emoteCount: number;
  /** direcciones mantenidas, la última presionada manda */
  dirStack: Dir[];
  padPrev: boolean[];
}

export interface TouchState {
  dir: Dir | -1;
  attack: boolean;
  bombTaps: number;
  hyperTaps: number;
}

type Action = 'bomb' | 'hyper' | 'emote' | 'pause' | 'scores';

export class InputManager {
  private down = new Set<string>();
  private locals: LocalState[] = [this.newLocal(), this.newLocal()];
  touch: TouchState = { dir: -1, attack: false, bombTaps: 0, hyperTaps: 0 };
  private touchPrev = { bomb: 0, hyper: 0 };
  /** cantidad de jugadores locales */
  localCount = 1;
  /** emotes equipados (ids) */
  emotes: number[] = [1, 2, 3, 4];
  onAction: ((a: Action, player: number) => void) | null = null;
  enabled = true;
  scoresHeld = false;

  private newLocal(): LocalState {
    return { bomb: 0, hyper: 0, emote: 0, emoteCount: 0, dirStack: [], padPrev: [] };
  }

  attach() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  reset() {
    this.down.clear();
    this.locals = [this.newLocal(), this.newLocal()];
    this.touch = { dir: -1, attack: false, bombTaps: 0, hyperTaps: 0 };
    this.touchPrev = { bomb: 0, hyper: 0 };
    this.scoresHeld = false;
  }

  private maps(player: number): KeyMap[] {
    const k = settings.get().keys;
    if (this.localCount <= 1) return [k.p1, k.p2];
    return [player === 0 ? k.p1 : k.p2];
  }

  private onBlur = () => {
    this.down.clear();
    for (const l of this.locals) l.dirStack = [];
  };

  private onDown = (e: KeyboardEvent) => {
    if (!this.enabled) return;
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    const code = e.code;
    if (code === 'Escape' || code === 'KeyP') {
      this.onAction?.('pause', 0);
      e.preventDefault();
      return;
    }
    if (code === 'Tab') {
      this.scoresHeld = true;
      e.preventDefault();
      return;
    }
    const repeat = this.down.has(code);
    this.down.add(code);
    let handled = false;
    for (let p = 0; p < this.localCount; p++) {
      const st = this.locals[p];
      for (const m of this.maps(p)) {
        const dir = code === m.down ? 0 : code === m.up ? 1 : code === m.left ? 2 : code === m.right ? 3 : -1;
        if (dir >= 0) {
          st.dirStack = st.dirStack.filter((d) => d !== dir);
          st.dirStack.push(dir as Dir);
          handled = true;
        }
        if (!repeat) {
          if (code === m.bomb) {
            st.bomb++;
            handled = true;
          }
          if (code === m.hyper) {
            st.hyper++;
            handled = true;
          }
          if (code === m.emote) {
            this.sendEmote(p, 0);
            handled = true;
          }
          if (code === m.attack) handled = true;
        }
      }
      // emotes con números (solo P1)
      if (p === 0 && !repeat && /^Digit[1-4]$/.test(code)) {
        this.sendEmote(0, Number(code.slice(5)) - 1);
        handled = true;
      }
    }
    if (handled) e.preventDefault();
  };

  private onUp = (e: KeyboardEvent) => {
    const code = e.code;
    this.down.delete(code);
    if (code === 'Tab') this.scoresHeld = false;
    for (let p = 0; p < this.localCount; p++) {
      const st = this.locals[p];
      for (const m of this.maps(p)) {
        const dir = code === m.down ? 0 : code === m.up ? 1 : code === m.left ? 2 : code === m.right ? 3 : -1;
        if (dir >= 0) st.dirStack = st.dirStack.filter((d) => d !== dir);
      }
    }
  };

  sendEmote(player: number, slot: number) {
    const st = this.locals[player];
    const id = this.emotes[slot] ?? this.emotes[0] ?? 1;
    st.emoteCount++;
    st.emote = st.emoteCount * 16 + (id & 15);
  }

  /** Lee el estado de un jugador local y devuelve su entrada del tick. */
  read(player: number): PlayerInput {
    const st = this.locals[player];
    let dir: Dir | -1 = st.dirStack.length ? st.dirStack[st.dirStack.length - 1] : -1;
    let attack = false;
    for (const m of this.maps(player)) if (this.down.has(m.attack)) attack = true;

    // mando
    const pad = this.pad(player);
    if (pad) {
      const ax = pad.axes[0] ?? 0;
      const ay = pad.axes[1] ?? 0;
      const b = (i: number) => !!pad.buttons[i]?.pressed;
      let pdir: Dir | -1 = -1;
      if (b(12)) pdir = 1;
      else if (b(13)) pdir = 0;
      else if (b(14)) pdir = 2;
      else if (b(15)) pdir = 3;
      else if (Math.abs(ax) > 0.45 || Math.abs(ay) > 0.45) pdir = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 3 : 2) : ay > 0 ? 0 : 1;
      if (pdir >= 0) dir = pdir;
      if (b(2) || b(7)) attack = true;
      const edge = (i: number) => b(i) && !st.padPrev[i];
      if (edge(0)) st.bomb++;
      if (edge(1) || edge(5)) st.hyper++;
      if (edge(3)) this.sendEmote(player, 0);
      if (edge(9)) this.onAction?.('pause', player);
      st.padPrev = pad.buttons.map((x) => x.pressed);
    }

    // táctil (P1)
    if (player === 0) {
      const t = this.touch;
      if (t.dir >= 0) dir = t.dir;
      if (t.attack) attack = true;
      if (t.bombTaps !== this.touchPrev.bomb) {
        st.bomb += t.bombTaps - this.touchPrev.bomb;
        this.touchPrev.bomb = t.bombTaps;
      }
      if (t.hyperTaps !== this.touchPrev.hyper) {
        st.hyper += t.hyperTaps - this.touchPrev.hyper;
        this.touchPrev.hyper = t.hyperTaps;
      }
    }
    return { dir, bomb: st.bomb, attack, hyper: st.hyper, emote: st.emote };
  }

  private pad(player: number): Gamepad | null {
    if (!navigator.getGamepads) return null;
    const pads = [...navigator.getGamepads()].filter((p): p is Gamepad => !!p && p.connected);
    return pads[player] ?? null;
  }

  static gamepadCount(): number {
    if (!navigator.getGamepads) return 0;
    return [...navigator.getGamepads()].filter((p) => !!p && p.connected).length;
  }
}

export const input = new InputManager();
