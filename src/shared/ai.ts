// Inteligencia artificial de los bots.
// Cada bot decide cada ~0,1-0,4 s (según dificultad) y sigue un camino por la grilla.
// Evita las explosiones con un "mapa de peligro" y elige objetivos según el modo y su rol.
import { BOMB, CLASSES, RULES } from './balance';
import { mapOf, blastCells, bombAt, activeBombs, playerSpeed, tileAt, DT } from './sim';
import { spiralOrder } from './maps';
import { DX, DY, Tile, type Dir, type MatchState, type PlayerInput, type PlayerState } from './types';

type Role = 'runner' | 'escort' | 'defender' | 'midfield';

interface Brain {
  id: number;
  role: Role;
  thinkT: number;
  path: number[];
  goal: string;
  alignT: number;
  bomb: number;
  hyper: number;
  emote: number;
  stuckT: number;
  lastX: number;
  lastY: number;
  hyperWait: number;
  wantBomb: boolean;
  wantHyper: boolean;
  hyperDir: Dir | -1;
  wanderUntil: number;
  holdT: number;
}

interface DiffParams {
  think: number;
  react: number;
  bombSafety: number;
  hyperDelay: number;
  wander: number;
  engage: number;
  aggression: number;
}

const DIFF: DiffParams[] = [
  { think: 0.42, react: 0.6, bombSafety: 0.8, hyperDelay: 2.5, wander: 0.3, engage: 4, aggression: 0.25 },
  { think: 0.26, react: 0.34, bombSafety: 0.94, hyperDelay: 1.0, wander: 0.1, engage: 6, aggression: 0.5 },
  { think: 0.16, react: 0.18, bombSafety: 0.99, hyperDelay: 0.4, wander: 0.03, engage: 7, aggression: 0.75 },
  { think: 0.1, react: 0.08, bombSafety: 1, hyperDelay: 0.1, wander: 0, engage: 9, aggression: 0.9 },
];

class Heap {
  private k: number[] = [];
  private v: number[] = [];
  get size() {
    return this.k.length;
  }
  push(key: number, val: number) {
    const k = this.k;
    const v = this.v;
    k.push(key);
    v.push(val);
    let i = k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (k[p] <= k[i]) break;
      [k[p], k[i]] = [k[i], k[p]];
      [v[p], v[i]] = [v[i], v[p]];
      i = p;
    }
  }
  pop(): number {
    const k = this.k;
    const v = this.v;
    const top = v[0];
    const lk = k.pop()!;
    const lv = v.pop()!;
    if (k.length) {
      k[0] = lk;
      v[0] = lv;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < k.length && k[l] < k[m]) m = l;
        if (r < k.length && k[r] < k[m]) m = r;
        if (m === i) break;
        [k[m], k[i]] = [k[i], k[m]];
        [v[m], v[i]] = [v[i], v[m]];
        i = m;
      }
    }
    return top;
  }
}

export class BotAI {
  private brains = new Map<number, Brain>();
  private seed: number;
  private dangerTick = -1;
  private dStart: Float32Array = new Float32Array(0);
  private dEnd: Float32Array = new Float32Array(0);

  constructor(seed = 12345) {
    this.seed = seed | 0 || 1;
  }

  private rnd(): number {
    this.seed = (this.seed + 0x6d2b79f5) | 0;
    let t = this.seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  reset() {
    this.brains.clear();
  }

  /** Entradas de todos los bots para este tick. */
  inputs(s: MatchState): Record<number, PlayerInput> {
    const out: Record<number, PlayerInput> = {};
    for (const p of s.players) {
      if (!p.bot) continue;
      out[p.id] = this.botInput(s, p);
    }
    return out;
  }

  private brain(s: MatchState, p: PlayerState): Brain {
    let b = this.brains.get(p.id);
    if (!b) {
      b = {
        id: p.id,
        role: this.pickRole(s, p),
        thinkT: this.rnd() * 0.3,
        path: [],
        goal: '',
        alignT: 0,
        bomb: 0,
        hyper: 0,
        emote: 0,
        stuckT: 0,
        lastX: p.x,
        lastY: p.y,
        hyperWait: 0,
        wantBomb: false,
        wantHyper: false,
        hyperDir: -1,
        wanderUntil: 0,
        holdT: 0,
      };
      this.brains.set(p.id, b);
    }
    return b;
  }

  private pickRole(s: MatchState, p: PlayerState): Role {
    const team = s.players.filter((q) => q.team === p.team);
    const has = (c: string) => team.some((q) => q.cls === c);
    switch (p.cls) {
      case 'veloz':
        return 'runner';
      case 'distancia':
        return has('veloz') ? 'midfield' : 'runner';
      case 'defensor':
        return 'defender';
      case 'controlador':
        return has('defensor') ? 'midfield' : 'defender';
      case 'tanque':
        return team.length <= 2 && !has('veloz') && !has('distancia') ? 'runner' : 'escort';
      case 'support':
        return team.length === 1 ? 'runner' : 'escort';
    }
  }

  // -------------------------------------------------------------------------
  // Peligro
  // -------------------------------------------------------------------------

  private computeDanger(s: MatchState) {
    if (this.dangerTick === s.tick && this.dStart.length === s.w * s.h) return;
    this.dangerTick = s.tick;
    const n = s.w * s.h;
    this.dStart = new Float32Array(n).fill(Infinity);
    this.dEnd = new Float32Array(n).fill(-Infinity);
    const mark = (i: number, a: number, b: number) => {
      if (a < this.dStart[i]) this.dStart[i] = a;
      if (b > this.dEnd[i]) this.dEnd[i] = b;
    };
    for (const f of s.flames) mark(f.y * s.w + f.x, 0, f.t);
    // tiempo efectivo de cada bomba (reacción en cadena)
    const eff = new Map<number, number>();
    const bombCell = (bm: MatchState['bombs'][number]) =>
      bm.airDur && bm.tx !== undefined && bm.ty !== undefined
        ? { x: Math.round(bm.tx), y: Math.round(bm.ty) }
        : { x: Math.floor(bm.x + 0.5), y: Math.floor(bm.y + 0.5) };
    for (const b of s.bombs) eff.set(b.id, Math.max(0, b.t));
    for (let pass = 0; pass < 4; pass++) {
      for (const b of s.bombs) {
        if (b.carrier !== undefined) continue;
        const bc = bombCell(b);
        const tb = eff.get(b.id)!;
        for (const c of blastCells(s, bc.x, bc.y, b.range, b.team)) {
          const o = bombAt(s, c.x, c.y);
          if (o && o.id !== b.id && eff.get(o.id)! > tb) eff.set(o.id, tb);
        }
      }
    }
    for (const b of s.bombs) {
      if (b.carrier !== undefined) continue;
      const bc = bombCell(b);
      const t0 = eff.get(b.id)!;
      for (const c of blastCells(s, bc.x, bc.y, b.range, b.team)) mark(c.y * s.w + c.x, t0, t0 + BOMB.flameLife);
    }
    if (s.config.map === 'volcan') {
      const soon = s.lavaOn ? 0 : s.lavaT;
      const until = s.lavaOn ? s.lavaT : s.lavaT + RULES.lavaActive;
      if (s.lavaOn || s.lavaT < 2.2) for (let i = 0; i < n; i++) if (s.tiles[i] === Tile.Lava) mark(i, Math.max(0, soon - 0.3), until);
    }
    if (s.hurry?.on) {
      const order = spiralOrder(s.w, s.h);
      for (let k = s.hurry.i; k < Math.min(order.length, s.hurry.i + 40); k++) mark(order[k], 0, 999);
    }
    if (s.storm?.on) {
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          if (Math.hypot(x + 0.5 - s.storm.cx, y + 0.5 - s.storm.cy) > s.storm.radius - 0.55) {
            mark(y * s.w + x, 0, 999);
          }
        }
      }
    }
  }

  private unsafeAt(i: number, t: number): boolean {
    return t + 0.35 >= this.dStart[i] && t - 0.12 <= this.dEnd[i];
  }

  private dangerous(i: number): boolean {
    return this.dStart[i] !== Infinity;
  }

  // -------------------------------------------------------------------------
  // Búsqueda de caminos
  // -------------------------------------------------------------------------

  private passable(s: MatchState, p: PlayerState, x: number, y: number, allowBlocks: boolean): boolean {
    const t = tileAt(s, x, y);
    if (t === Tile.Wall || t === Tile.Door) return false;
    if (t === Tile.Block && !allowBlocks) return false;
    for (const b of s.barriers) if (b.x === x && b.y === y && b.team !== p.team) return false;
    const bomb = bombAt(s, x, y);
    if (bomb && !bomb.passers.includes(p.id)) return false;
    for (const d of s.doors) if (d.x === x && d.y === y && d.open && d.t < 1.2) return false;
    return true;
  }

  /**
   * Dijkstra desde el jugador. Los bloques cuestan extra si `allowBlocks`.
   * Devuelve distancias en casillas y predecesores.
   */
  private search(s: MatchState, p: PlayerState, allowBlocks: boolean, avoidDanger = true) {
    const n = s.w * s.h;
    const dist = new Float32Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const sx = Math.floor(p.x);
    const sy = Math.floor(p.y);
    const start = sy * s.w + sx;
    const speed = Math.max(1.5, playerSpeed(s, p));
    dist[start] = 0;
    const h = new Heap();
    h.push(0, start);
    const blockCost = 5;
    while (h.size) {
      const i = h.pop();
      const d = dist[i];
      const x = i % s.w;
      const y = (i / s.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        if (!this.passable(s, p, nx, ny, allowBlocks)) continue;
        const ni = ny * s.w + nx;
        const isBlock = tileAt(s, nx, ny) === Tile.Block;
        const nd = d + 1 + (isBlock ? blockCost : 0) + (s.conv[ni] ? 0.2 : 0);
        if (avoidDanger && !isBlock && this.unsafeAt(ni, (d + 1) / speed)) continue;
        if (nd < dist[ni]) {
          dist[ni] = nd;
          prev[ni] = i;
          h.push(nd, ni);
        }
      }
    }
    return { dist, prev, start };
  }

  private pathTo(prev: Int32Array, start: number, goal: number): number[] {
    const path: number[] = [];
    let c = goal;
    let guard = 0;
    while (c !== start && c >= 0 && guard++ < 2000) {
      path.push(c);
      c = prev[c];
    }
    if (c !== start) return [];
    return path.reverse();
  }

  // -------------------------------------------------------------------------
  // Decisión
  // -------------------------------------------------------------------------

  private botInput(s: MatchState, p: PlayerState): PlayerInput {
    const b = this.brain(s, p);
    const idle: PlayerInput = { dir: -1, bomb: b.bomb, attack: false, hyper: b.hyper, emote: b.emote };
    if (!p.alive || s.phase !== 'playing') {
      b.path = [];
      // emote de festejo al ganar
      if (s.phase === 'ended' && s.winner === p.team && p.emoteT <= 0 && this.rnd() < 0.004) {
        b.emote = ((b.emote >> 4) + 1) * 16 + (1 + Math.floor(this.rnd() * 3));
        idle.emote = b.emote;
      }
      return idle;
    }
    // muñecos del tutorial: quietos
    if (s.config.mode === 'tutorial') return idle;

    const diff = DIFF[p.difficulty] ?? DIFF[1];
    this.computeDanger(s);

    // detección de atascos
    const movedSq = (p.x - b.lastX) ** 2 + (p.y - b.lastY) ** 2;
    if (b.path.length && movedSq < 0.0004) b.stuckT += DT;
    else b.stuckT = 0;
    b.lastX = p.x;
    b.lastY = p.y;
    if (b.stuckT > 0.8) {
      b.path = [];
      b.stuckT = 0;
      b.thinkT = 0;
      b.wanderUntil = s.time + 0.8;
    }

    b.thinkT -= DT;
    const myTile = Math.floor(p.y) * s.w + Math.floor(p.x);
    if (b.thinkT <= 0 || (this.dangerous(myTile) && b.goal !== 'flee')) {
      b.thinkT = diff.think * (0.75 + this.rnd() * 0.5);
      this.think(s, p, b, diff);
    }

    const input: PlayerInput = { dir: -1, bomb: b.bomb, attack: false, hyper: b.hyper, emote: b.emote };

    // bomba
    if (b.wantBomb) {
      b.wantBomb = false;
      b.bomb++;
      input.bomb = b.bomb;
    }

    // seguir camino
    let moveDir: Dir | -1 = -1;
    while (b.path.length) {
      const nxt = b.path[0];
      const tx = nxt % s.w;
      const ty = (nxt / s.w) | 0;
      const cx = tx + 0.5;
      const cy = ty + 0.5;
      const inTile = Math.floor(p.x) === tx && Math.floor(p.y) === ty;
      if (inTile && Math.abs(p.x - cx) < 0.3 && Math.abs(p.y - cy) < 0.3) {
        b.path.shift();
        continue;
      }
      // si el siguiente paso se volvió peligroso, repensar
      if (this.unsafeAt(nxt, 0.25) && !this.dangerous(myTile)) {
        b.path = [];
        b.thinkT = 0;
        break;
      }
      const ctx = Math.floor(p.x);
      const cty = Math.floor(p.y);
      if (tx > ctx) moveDir = 3;
      else if (tx < ctx) moveDir = 2;
      else if (ty > cty) moveDir = 0;
      else if (ty < cty) moveDir = 1;
      else moveDir = Math.abs(p.x - cx) > Math.abs(p.y - cy) ? (p.x < cx ? 3 : 2) : p.y < cy ? 0 : 1;
      // bloque adelante: esperar a que la bomba lo rompa
      if (tileAt(s, tx, ty) === Tile.Block) moveDir = -1;
      break;
    }
    input.dir = moveDir;

    // ataque (cada tick)
    const shot = this.attackCheck(s, p, b, diff, moveDir);
    if (shot >= 0) {
      input.dir = shot as Dir;
      input.attack = true;
    }

    // hipercarga
    if (b.wantHyper) {
      b.wantHyper = false;
      if (b.hyperDir >= 0) input.dir = b.hyperDir;
      b.hyper++;
      input.hyper = b.hyper;
    }
    return input;
  }

  /** Dirección en la que conviene atacar este tick (o -1). */
  private attackCheck(s: MatchState, p: PlayerState, b: Brain, diff: DiffParams, moveDir: Dir | -1): number {
    if (p.atkCd > 0) return -1;
    const a = CLASSES[p.cls].attack;
    const range = a.range + (p.cls === 'distancia' && p.hyperT > 0 ? 2.5 : 0);
    const fleeing = b.goal === 'flee';
    let best = -1;
    let bestD = Infinity;
    for (const q of s.players) {
      if (!q.alive || q.id === p.id) continue;
      const enemy = q.team !== p.team;
      if (!enemy && !(a.healAlly && q.hp < q.maxHp * 0.8)) continue;
      if (enemy && q.invuln > 0.3) continue;
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      let dir: Dir | -1 = -1;
      let along = 0;
      if (Math.abs(dy) < 0.45 && Math.abs(dx) <= range + 0.3) {
        dir = dx > 0 ? 3 : 2;
        along = Math.abs(dx);
      } else if (Math.abs(dx) < 0.45 && Math.abs(dy) <= range + 0.3) {
        dir = dy > 0 ? 0 : 1;
        along = Math.abs(dy);
      }
      if (dir < 0) continue;
      if (fleeing && dir !== moveDir) continue;
      if (!this.clearLine(s, p, Math.floor(p.x), Math.floor(p.y), Math.floor(q.x), Math.floor(q.y), a.kind === 'projectile' && p.hyperT > 0 && p.cls === 'distancia')) continue;
      if (along < bestD) {
        bestD = along;
        best = dir;
      }
    }
    if (best < 0) {
      b.alignT = 0;
      return -1;
    }
    b.alignT += DT;
    if (b.alignT < diff.react) return -1;
    return best;
  }

  private clearLine(s: MatchState, p: PlayerState, x0: number, y0: number, x1: number, y1: number, pierce: boolean): boolean {
    const sx = Math.sign(x1 - x0);
    const sy = Math.sign(y1 - y0);
    let x = x0;
    let y = y0;
    let guard = 0;
    while ((x !== x1 || y !== y1) && guard++ < 40) {
      x += sx;
      y += sy;
      if (x === x1 && y === y1) break;
      const t = tileAt(s, x, y);
      if (t === Tile.Wall || t === Tile.Door) return false;
      if (t === Tile.Block && !pierce) return false;
      if (s.barriers.some((bb) => bb.x === x && bb.y === y && bb.team !== p.team)) return false;
    }
    return true;
  }

  private think(s: MatchState, p: PlayerState, b: Brain, diff: DiffParams) {
    const myTile = Math.floor(p.y) * s.w + Math.floor(p.x);
    const speed = Math.max(1.5, playerSpeed(s, p));

    // 1) peligro: huir a la casilla segura más cercana
    if (this.dangerous(myTile)) {
      const { dist, prev, start } = this.search(s, p, false, true);
      let best = -1;
      let bd = Infinity;
      for (let i = 0; i < dist.length; i++) {
        if (dist[i] === Infinity || this.dangerous(i)) continue;
        if (dist[i] < bd) {
          bd = dist[i];
          best = i;
        }
      }
      if (best < 0) {
        // sin salida segura: al menos alejarse sin tener en cuenta tiempos
        const alt = this.search(s, p, false, false);
        for (let i = 0; i < alt.dist.length; i++) {
          if (alt.dist[i] === Infinity || this.dangerous(i)) continue;
          if (alt.dist[i] < bd) {
            bd = alt.dist[i];
            best = i;
          }
        }
        b.path = best >= 0 ? this.pathTo(alt.prev, alt.start, best) : [];
      } else {
        b.path = this.pathTo(prev, start, best);
      }
      b.goal = 'flee';
      this.maybeHyper(s, p, b, diff, true);
      return;
    }

    const { dist, prev, start } = this.search(s, p, false, true);
    const enemies = s.players.filter((q) => q.alive && q.team !== p.team);
    const allies = s.players.filter((q) => q.alive && q.team === p.team && q.id !== p.id);
    const toTile = (x: number, y: number) => Math.floor(y) * s.w + Math.floor(x);

    // objetivo de combate: enemigo más cercano (por camino)
    let target: PlayerState | undefined;
    let targetD = Infinity;
    for (const e of enemies) {
      const d = dist[toTile(e.x, e.y)];
      const manhattan = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
      const score = Math.min(d, manhattan * 1.6);
      if (score < targetD) {
        targetD = score;
        target = e;
      }
    }

    let goal = -1;
    let goalName = '';
    let throughBlocks = false;
    const mode = s.config.mode;

    const wander = s.time < b.wanderUntil || this.rnd() < diff.wander * 0.2;

    if (mode === 'ctf') {
      const ownFlag = s.flags[p.team];
      const enemyFlag = s.flags[1 - p.team];
      if (p.carrying >= 0) {
        goal = ownFlag.homeY * s.w + ownFlag.homeX;
        goalName = 'home';
        // si nuestra bandera no está, esperar cerca de la base
        if (ownFlag.state !== 0) {
          const near = this.nearestSafeAround(s, dist, ownFlag.homeX, ownFlag.homeY, 3);
          if (near >= 0) goal = near;
        }
        throughBlocks = true;
      } else if (ownFlag.state === 2 && (b.role !== 'runner' || dist[toTile(ownFlag.x, ownFlag.y)] < 8)) {
        goal = toTile(ownFlag.x, ownFlag.y);
        goalName = 'return';
        throughBlocks = true;
      } else if (ownFlag.state === 1 && (b.role !== 'runner' || dist[toTile(ownFlag.x, ownFlag.y)] < 6)) {
        const carrier = s.players.find((q) => q.id === ownFlag.carrier);
        if (carrier) {
          target = carrier;
          goalName = 'chase';
        }
      } else if (enemyFlag.state === 2 && (b.role === 'runner' || b.role === 'escort' || dist[toTile(enemyFlag.x, enemyFlag.y)] < 6)) {
        goal = toTile(enemyFlag.x, enemyFlag.y);
        goalName = 'pickup';
        throughBlocks = true;
      } else if (b.role === 'runner') {
        if (enemyFlag.state === 0) {
          goal = enemyFlag.homeY * s.w + enemyFlag.homeX;
          goalName = 'steal';
          throughBlocks = true;
        }
      } else if (b.role === 'escort') {
        const carrier = allies.find((q) => q.carrying >= 0);
        const buddy = carrier ?? allies.find((q) => this.brains.get(q.id)?.role === 'runner' || q.cls === 'veloz');
        if (buddy && Math.abs(buddy.x - p.x) + Math.abs(buddy.y - p.y) > 2.5) {
          goal = toTile(buddy.x, buddy.y);
          goalName = 'escort';
          throughBlocks = true;
        } else if (enemyFlag.state === 0) {
          goal = enemyFlag.homeY * s.w + enemyFlag.homeX;
          goalName = 'steal';
          throughBlocks = true;
        }
      } else if (b.role === 'defender') {
        const threat = target && Math.abs(target.x - (ownFlag.homeX + 0.5)) + Math.abs(target.y - (ownFlag.homeY + 0.5)) < 8;
        if (!threat) {
          const post = this.nearestSafeAround(s, dist, ownFlag.homeX + (p.team === 0 ? 2 : -2), ownFlag.homeY, 2);
          if (post >= 0 && dist[post] > 0) {
            goal = post;
            goalName = 'guard';
          } else goalName = 'guard';
        }
      } else if (b.role === 'midfield') {
        const cx = Math.floor(s.w / 2) + (p.team === 0 ? -3 : 3);
        const cy = Math.floor(s.h / 2);
        const threat = target && targetD < diff.engage;
        if (!threat) {
          const post = this.nearestSafeAround(s, dist, cx, cy, 3);
          if (post >= 0 && dist[post] > 1) {
            goal = post;
            goalName = 'mid';
          }
        }
      }
    } else if (mode === 'zona' && s.koth) {
      const k = s.koth;
      const inZone = Math.abs(Math.floor(p.x) - k.x) <= 1 && Math.abs(Math.floor(p.y) - k.y) <= 1;
      if (!inZone) {
        goal = this.nearestSafeAround(s, dist, k.x, k.y, 1);
        if (goal < 0) goal = k.y * s.w + k.x;
        goalName = 'zone';
        throughBlocks = true;
      }
    } else {
      // eliminación / clásica: mejoras cercanas, cazar, romper bloques
      if (s.config.powerups) {
        let bestPu = -1;
        let bestD = 6;
        for (const pu of s.powerups) {
          const d = dist[pu.y * s.w + pu.x];
          if (d < bestD) {
            bestD = d;
            bestPu = pu.y * s.w + pu.x;
          }
        }
        if (bestPu >= 0 && !(target && targetD < 3)) {
          goal = bestPu;
          goalName = 'powerup';
        }
      }
    }

    // combate: acercarse a una posición de tiro
    const brawl = mode === 'eliminacion' || mode === 'clasica' || mode === 'duelo';
    const engage =
      target &&
      goal < 0 &&
      (goalName === 'chase' || targetD <= diff.engage + (brawl ? 20 : 0) || goalName === 'guard' || goalName === '');
    if (target && (engage || (targetD < 3.5 && goalName !== 'home' && this.rnd() < diff.aggression))) {
      const fire = this.firingSpot(s, p, dist, target);
      if (fire >= 0) {
        goal = fire;
        goalName = goalName === 'chase' ? 'chase' : 'fight';
      } else if (goal < 0) {
        goal = toTile(target.x, target.y);
        goalName = goalName === 'chase' ? 'chase' : 'hunt';
        throughBlocks = true;
      }
    }

    if (wander && goalName !== 'home' && goalName !== 'flee') {
      const cands: number[] = [];
      for (let i = 0; i < dist.length; i++) if (dist[i] > 1 && dist[i] < 7 && !this.dangerous(i)) cands.push(i);
      if (cands.length) {
        goal = cands[Math.floor(this.rnd() * cands.length)];
        goalName = 'wander';
      }
    }

    // en clásica/duelo/eliminación sin enemigos alcanzables: romper bloques
    if (goal < 0 && brawl) {
      goal = this.nearestBlockSpot(s, dist);
      goalName = 'dig';
    }

    // camino
    let path: number[] = [];
    if (goal >= 0) {
      if (dist[goal] !== Infinity) path = this.pathTo(prev, start, goal);
      else if (throughBlocks || goalName === 'hunt' || goalName === 'chase') {
        const alt = this.search(s, p, true, true);
        if (alt.dist[goal] !== Infinity) path = this.pathTo(alt.prev, alt.start, goal);
      }
    }
    // no pisar casillas donde después no podríamos escapar: si el destino es peligroso, cancelar
    if (path.length && this.dangerous(path[path.length - 1]) && goalName !== 'flee') {
      path = path.slice(0, -1);
    }
    b.path = path;
    b.goal = goalName;

    // bombas
    this.maybeBomb(s, p, b, diff, target, speed);
    // hipercarga
    this.maybeHyper(s, p, b, diff, false, target);
  }

  private nearestSafeAround(s: MatchState, dist: Float32Array, cx: number, cy: number, r: number): number {
    let best = -1;
    let bd = Infinity;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
        const i = y * s.w + x;
        if (dist[i] === Infinity || this.dangerous(i)) continue;
        const d = dist[i] + (Math.abs(x - cx) + Math.abs(y - cy)) * 0.5;
        if (d < bd) {
          bd = d;
          best = i;
        }
      }
    }
    return best;
  }

  private nearestBlockSpot(s: MatchState, dist: Float32Array): number {
    let best = -1;
    let bd = Infinity;
    for (let i = 0; i < dist.length; i++) {
      if (dist[i] === Infinity || this.dangerous(i)) continue;
      const x = i % s.w;
      const y = (i / s.w) | 0;
      let adj = false;
      for (let k = 0; k < 4; k++) if (tileAt(s, x + DX[k], y + DY[k]) === Tile.Block) adj = true;
      if (!adj) continue;
      if (dist[i] < bd) {
        bd = dist[i];
        best = i;
      }
    }
    return best;
  }

  /** Mejor casilla alcanzable desde donde se puede atacar al objetivo. */
  private firingSpot(s: MatchState, p: PlayerState, dist: Float32Array, target: PlayerState): number {
    const a = CLASSES[p.cls].attack;
    const range = Math.floor(a.range);
    const tx = Math.floor(target.x);
    const ty = Math.floor(target.y);
    const minD = p.cls === 'distancia' ? 2 : 1;
    let best = -1;
    let bd = Infinity;
    for (let k = 0; k < 4; k++) {
      for (let i = 1; i <= Math.max(1, range); i++) {
        const x = tx + DX[k] * i;
        const y = ty + DY[k] * i;
        const t = tileAt(s, x, y);
        if (t === Tile.Wall || t === Tile.Door || t === Tile.Block) break;
        if (i < minD) continue;
        const idx = y * s.w + x;
        if (dist[idx] === Infinity || this.dangerous(idx)) continue;
        // preferir distancia media para los tiradores
        const pref = p.cls === 'distancia' ? Math.abs(i - 4) * 0.6 : i * 0.3;
        const d = dist[idx] + pref;
        if (d < bd) {
          bd = d;
          best = idx;
        }
      }
    }
    return best;
  }

  private maybeBomb(s: MatchState, p: PlayerState, b: Brain, diff: DiffParams, target: PlayerState | undefined, speed: number) {
    if (p.heldBomb > 0) {
      const held = s.bombs.find((bm) => bm.id === p.heldBomb);
      const facingTarget = target && Math.abs(target.x - p.x) + Math.abs(target.y - p.y) <= 4.2;
      if (!held || held.t < 0.7 || facingTarget || this.rnd() < 0.35) {
        b.wantBomb = true;
        b.thinkT = 0.05;
      }
      return;
    }
    if (activeBombs(s, p.id) >= p.bombsMax) return;
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    if (bombAt(s, tx, ty)) return;
    const cells = blastCells(s, tx, ty, p.range, p.team);
    let reason = '';
    if (target) {
      const tt = Math.floor(target.y) * s.w + Math.floor(target.x);
      const inBlast = cells.some((c) => c.y * s.w + c.x === tt);
      const close = Math.abs(target.x - p.x) + Math.abs(target.y - p.y) < 1.8;
      if (inBlast || close) reason = 'enemy';
    }
    // bloque en el camino
    if (!reason && b.path.length) {
      const nxt = b.path[0];
      if (tileAt(s, nxt % s.w, (nxt / s.w) | 0) === Tile.Block) reason = 'block';
    }
    // perseguido con la bandera: dejar una bomba atrás
    if (!reason && p.carrying >= 0 && target && Math.abs(target.x - p.x) + Math.abs(target.y - p.y) < 3.5) reason = 'cover';
    // cavar en clásica
    if (!reason && b.goal === 'dig' && b.path.length === 0) {
      if (cells.some((c) => tileAt(s, c.x, c.y) === Tile.Block)) reason = 'dig';
    }
    // defensa de la bandera: bomba cerca de la bandera propia si hay intrusos
    if (!reason && s.flags.length && target && b.role === 'defender') {
      const f = s.flags[p.team];
      if (f.state === 0 && Math.abs(target.x - f.x) + Math.abs(target.y - f.y) < 3 && Math.abs(p.x - f.x) + Math.abs(p.y - f.y) < 3) reason = 'defend';
    }
    if (!reason) return;
    if (reason === 'enemy' && this.rnd() > diff.aggression + 0.2) return;
    // ¿hay escape?
    if (this.rnd() < diff.bombSafety && !this.hasEscape(s, p, cells, speed)) return;
    b.wantBomb = true;
    // después de poner la bomba, repensar enseguida (huir)
    b.thinkT = 0.02;
  }

  private hasEscape(s: MatchState, p: PlayerState, cells: { x: number; y: number }[], speed: number): boolean {
    const blast = new Set(cells.map((c) => c.y * s.w + c.x));
    const tx = Math.floor(p.x);
    const ty = Math.floor(p.y);
    const start = ty * s.w + tx;
    const seen = new Map<number, number>([[start, 0]]);
    const q = [start];
    const fuse = BOMB.fuse - 0.45;
    while (q.length) {
      const i = q.shift()!;
      const d = seen.get(i)!;
      if (!blast.has(i) && !this.dangerous(i)) return true;
      if ((d + 1) / speed > fuse) continue;
      const x = i % s.w;
      const y = (i / s.w) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k];
        const ny = y + DY[k];
        const ni = ny * s.w + nx;
        if (seen.has(ni)) continue;
        if (!this.passable(s, p, nx, ny, false)) continue;
        if (this.unsafeAt(ni, (d + 1) / speed)) continue;
        seen.set(ni, d + 1);
        q.push(ni);
      }
    }
    return false;
  }

  private maybeHyper(s: MatchState, p: PlayerState, b: Brain, diff: DiffParams, fleeing: boolean, target?: PlayerState) {
    if (p.hyper < RULES.hyperMax) {
      b.hyperWait = 0;
      return;
    }
    b.hyperWait += Math.max(DT, diff.think);
    if (b.hyperWait < diff.hyperDelay) return;
    const enemies = s.players.filter((q) => q.alive && q.team !== p.team);
    const near = (r: number) => enemies.filter((e) => Math.hypot(e.x - p.x, e.y - p.y) <= r);
    let use = false;
    let dir: Dir | -1 = -1;
    const dirTo = (q: PlayerState): Dir => {
      const dx = q.x - p.x;
      const dy = q.y - p.y;
      return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 0 : 1;
    };
    switch (p.cls) {
      case 'tanque':
        use = near(2.4).length >= 1;
        break;
      case 'veloz': {
        const next = b.path[0];
        if ((p.carrying >= 0 || fleeing || b.goal === 'steal') && next !== undefined) {
          const nx = next % s.w;
          const ny = (next / s.w) | 0;
          dir = nx > Math.floor(p.x) ? 3 : nx < Math.floor(p.x) ? 2 : ny > Math.floor(p.y) ? 0 : 1;
          use = b.path.length >= 3 || fleeing;
        }
        break;
      }
      case 'distancia':
        use = !!target && near(9).includes(target) && (Math.abs(target.x - p.x) < 0.5 || Math.abs(target.y - p.y) < 0.5);
        break;
      case 'support': {
        const hurt = s.players.filter((q) => q.alive && q.team === p.team && q.hp < q.maxHp * 0.6 && Math.hypot(q.x - p.x, q.y - p.y) < 2.4);
        use = hurt.length >= 1 && (hurt.length >= 2 || near(5).length > 0);
        break;
      }
      case 'defensor': {
        const e = near(4)[0];
        if (e) {
          dir = dirTo(e);
          use = true;
        } else if (p.carrying >= 0 && fleeing) use = true;
        break;
      }
      case 'controlador': {
        const e = near(5);
        const carrier = e.find((q) => q.carrying >= 0);
        if (carrier || e.length >= 2) {
          dir = dirTo(carrier ?? e[0]);
          use = true;
        }
        break;
      }
    }
    if (use) {
      b.wantHyper = true;
      b.hyperDir = dir;
      b.hyperWait = 0;
    }
  }
}

/** Nombres para bots. */
export const BOT_NAMES = [
  'Chispita', 'Mecha Corta', 'Don Bombón', 'La Tromba', 'Dinamita', 'Petardo', 'Kabum', 'Fosforito',
  'Tic-Tac', 'Pólvora', 'Rayito', 'Cometa', 'Sr. Explosivo', 'Bengala', 'Estruendo', 'Detonador',
  'Nitro', 'Traca', 'Relámpago', 'Mechita', 'Big Bang', 'Zumbido', 'Trueno', 'Capitán Boom',
];
