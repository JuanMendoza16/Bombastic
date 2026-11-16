// Renderizador del mundo en canvas 2D (pixel art nítido con escalado interno entero).
import { CLASSES, FFA_COLORS, MODES, RULES, TEAM_COLORS, TEAM_COLORS_CB } from '../../shared/balance';
import { MAPS, parseMap, type Theme } from '../../shared/maps';
import { DX, DY, Tile, type ClassId, type GameEvent, type MatchState, type PlayerState } from '../../shared/types';
import { FH, FW, GROUND, type Anim } from '../gfx/characters';
import { Sprites } from '../gfx/sprites';
import { T, THEMES, ruinasFloorFlower, ruinasSprite, tileVersion } from '../gfx/tiles';
import { EMOTES } from '../data/cosmetics';
import { Particles } from './particles';

export interface RenderOpts {
  shake: number;
  damageNumbers: boolean;
  names: boolean;
  colorblind: boolean;
  localIds: number[];
  reducedMotion: boolean;
}

export function teamColor(s: MatchState, team: number, cb = false): string {
  if (!MODES[s.config.mode].teams) return FFA_COLORS[team % FFA_COLORS.length];
  return (cb ? TEAM_COLORS_CB : TEAM_COLORS)[team] ?? '#ffffff';
}

const CLASS_FX: Record<ClassId, string> = {
  tanque: '#8fe9ff',
  defensor: '#4de8d0',
  support: '#5dff9a',
  controlador: '#c77dff',
  distancia: '#7dff6b',
  veloz: '#ffe94d',
};

interface MeleeFx {
  x: number;
  y: number;
  dir: number;
  cls: ClassId;
  len: number;
  t: number;
}

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  S = 2;
  fit = 1;
  private floor: HTMLCanvasElement | null = null;
  private floorKey = '';
  readonly particles = new Particles();
  private shakeAmt = 0;
  private time = 0;
  private deaths = new Map<number, number>();
  private heals = new Map<number, number>();
  private falling = new Map<number, number>();
  private melee: MeleeFx[] = [];
  private doorAnim = new Map<number, number>();
  private trails = new Map<number, { x: number; y: number; t: number; dir: number; f: number }[]>();
  private bombBorn = new Map<number, number>();
  private flash = 0;
  private flashColor = '#ffffff';
  worldW = 0;
  worldH = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
  }

  reset() {
    this.particles.clear();
    this.deaths.clear();
    this.heals.clear();
    this.falling.clear();
    this.melee = [];
    this.trails.clear();
    this.bombBorn.clear();
    this.doorAnim.clear();
    this.floor = null;
    this.floorKey = '';
    this.shakeAmt = 0;
  }

  /** Ajusta el tamaño del canvas al área disponible (px CSS). */
  resize(s: MatchState, availW: number, availH: number) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.worldW = s.w * T;
    this.worldH = s.h * T;
    const fit = Math.max(0.2, Math.min(availW / this.worldW, availH / this.worldH));
    this.fit = fit;
    const devScale = fit * dpr;
    const S = Math.max(1, Math.min(4, Math.ceil(devScale - 0.01)));
    this.S = S;
    const cw = this.worldW * S;
    const ch = this.worldH * S;
    if (this.canvas.width !== cw || this.canvas.height !== ch) {
      this.canvas.width = cw;
      this.canvas.height = ch;
    }
    this.canvas.style.width = `${Math.round(this.worldW * fit)}px`;
    this.canvas.style.height = `${Math.round(this.worldH * fit)}px`;
    this.canvas.style.imageRendering = Math.abs(devScale - S) < 0.01 ? 'pixelated' : 'auto';
  }

  private theme(s: MatchState): Theme {
    return MAPS[s.config.map].theme;
  }

  // -------------------------------------------------------------------------
  // Eventos -> efectos
  // -------------------------------------------------------------------------

  handleEvents(events: GameEvent[], s: MatchState, opts: RenderOpts) {
    const pl = (id: number) => s.players.find((p) => p.id === id);
    const theme = THEMES[this.theme(s)];
    for (const e of events) {
      switch (e.t) {
        case 'bomb':
          this.particles.burst(e.x * T + 16, e.y * T + 26, 6, ['#e9e2d0', '#b9ae96'], 30, { kind: 'smoke', size: 2.5, life: 0.35, g: -20 });
          break;
        case 'explode': {
          const cx = e.x * T + 16;
          const cy = e.y * T + 16;
          this.addShake(Math.min(6, 2.2 + e.n * 0.25) * opts.shake);
          this.particles.burst(cx, cy, 14, ['#6b6570', '#4d4852', '#8d8791'], 45, { kind: 'smoke', size: 4, grow: 6, life: 0.8, g: -18, drag: 1.5 });
          this.particles.burst(cx, cy, 16, ['#ffd23a', '#ff8a1a', '#fff7d6'], 140, { kind: 'spark', life: 0.45, g: 60, drag: 1 });
          this.particles.ring(cx, cy, 6, 28, 'rgba(255,240,200,0.8)', 0.25, 3);
          break;
        }
        case 'break': {
          const cx = e.x * T + 16;
          const cy = e.y * T + 16;
          this.particles.burst(cx, cy, 14, [theme.block[0], theme.block[1], theme.block[2], theme.blockDetail], 110, { kind: 'sq', size: 3, g: 260, life: 0.7, drag: 0.5 });
          this.particles.burst(cx, cy, 5, ['#9d958a', '#bdb4a8'], 30, { kind: 'smoke', size: 5, grow: 4, life: 0.6, g: -15 });
          break;
        }
        case 'regen': {
          this.particles.ring(e.x * T + 16, e.y * T + 16, 18, 4, 'rgba(255,255,255,0.6)', 0.35, 2);
          break;
        }
        case 'hit': {
          const p = pl(e.p);
          if (!p) break;
          const x = e.x * T;
          const y = e.y * T - 30;
          if (opts.damageNumbers) {
            const mine = opts.localIds.includes(e.p);
            this.particles.text(x + (Math.random() - 0.5) * 10, y, `-${e.a}`, mine ? '#ff5a5a' : '#ffe0a0', e.a >= 40 ? 13 : 10);
          }
          this.particles.burst(e.x * T, e.y * T - 8, 6, ['#ffffff', '#ffd23a'], 70, { kind: 'spark', life: 0.25 });
          if (opts.localIds.includes(e.p)) this.addShake(1.5 * opts.shake);
          break;
        }
        case 'heal':
          this.heals.set(e.p, this.time);
          if (e.src >= 0) this.heals.set(e.src, this.time);
          if (opts.damageNumbers && e.a >= 3) this.particles.text(e.x * T + (Math.random() - 0.5) * 10, e.y * T - 30, `+${e.a}`, '#5dff9a', 9);
          this.particles.burst(e.x * T, e.y * T - 10, 3, ['#5dff9a', '#c8ffd9'], 20, { kind: 'star', size: 3, g: -40, life: 0.6 });
          break;
        case 'kill': {
          const p = pl(e.p);
          if (!p) break;
          this.deaths.set(p.id, this.time);
          const x = p.x * T;
          const y = p.y * T;
          this.particles.burst(x, y - 10, 12, ['#ffffff', '#e0dce8', '#c9c5d4'], 60, { kind: 'smoke', size: 4, grow: 5, life: 0.7, g: -20, drag: 1.5 });
          this.particles.add({ kind: 'ghost', x, y: y - 16, vy: -22, size: 5, life: 1.2, max: 1.2, color: 'rgba(255,255,255,0.85)' });
          this.particles.burst(x, y - 10, 8, ['#ffe94d'], 80, { kind: 'star', size: 4, life: 0.6 });
          break;
        }
        case 'attack': {
          const p = pl(e.p);
          if (!p) break;
          const fx = p.x * T + DX[e.dir] * 15;
          const fy = p.y * T - 8 + DY[e.dir] * 13;
          this.particles.ring(fx, fy, 2, 11, CLASS_FX[e.cls], 0.18, 2);
          this.particles.burst(fx, fy, 7, [CLASS_FX[e.cls], '#ffffff'], 65, { kind: 'spark', life: 0.22 });
          break;
        }
        case 'melee':
          this.melee.push({ x: e.x, y: e.y, dir: e.dir, cls: e.cls, len: e.len, t: 0 });
          break;
        case 'impact':
          this.particles.burst(e.x * T, e.y * T - 6, 8, [CLASS_FX[e.cls], '#ffffff'], 70, { kind: 'spark', life: 0.3 });
          this.particles.ring(e.x * T, e.y * T - 6, 2, 10, CLASS_FX[e.cls], 0.2, 2);
          break;
        case 'hyper': {
          const cx = e.x * T;
          const cy = e.y * T - 8;
          const c = CLASS_FX[e.cls];
          this.particles.ring(cx, cy, 6, e.cls === 'tanque' ? 2.7 * T : 40, c, 0.45, 4);
          this.particles.burst(cx, cy, 24, [c, '#ffffff'], 120, { kind: 'star', size: 4, life: 0.6, drag: 2 });
          this.particles.text(cx, cy - 26, CLASSES[e.cls].hyper.name.toUpperCase() + '!', c, 12, 1.2);
          if (e.cls === 'tanque') {
            this.addShake(7 * opts.shake);
            this.particles.burst(cx, cy + 10, 20, ['#a39b8c', '#857d6e'], 90, { kind: 'smoke', size: 5, grow: 5, life: 0.8, g: -10, drag: 1.2 });
          } else this.addShake(2 * opts.shake);
          break;
        }
        case 'dash':
          this.particles.burst(e.x * T, e.y * T - 6, 12, ['#ffe94d', '#8fd8ff'], 90, { kind: 'spark', life: 0.4 });
          break;
        case 'kick':
          this.particles.burst(e.x * T + 16, e.y * T + 22, 7, ['#ffffff', '#ffe94d'], 75, { kind: 'smoke', size: 2.5, life: 0.35 });
          break;
        case 'grab':
          this.particles.burst(e.x * T, e.y * T - 14, 6, ['#ffffff', '#5ff2ff'], 50, { kind: 'spark', life: 0.25 });
          break;
        case 'throw':
          this.particles.burst(e.x * T, e.y * T - 16, 9, ['#ffe94d', '#ffffff'], 85, { kind: 'spark', life: 0.35 });
          break;
        case 'storm':
          this.flash = 0.25;
          this.flashColor = '#c77dff';
          break;
        case 'flagCap':
          this.flash = 0.35;
          this.flashColor = teamColor(s, e.team, opts.colorblind);
          {
            const p = pl(e.p);
            if (p) this.particles.burst(p.x * T, p.y * T - 10, 40, ['#ffd23f', '#ffffff', teamColor(s, e.team, opts.colorblind)], 150, { kind: 'star', size: 4, life: 1, g: 80, drag: 1 });
          }
          break;
        case 'flagTake': {
          const p = pl(e.p);
          if (p) this.particles.ring(p.x * T, p.y * T - 8, 4, 30, teamColor(s, e.team, opts.colorblind), 0.4, 3);
          break;
        }
        case 'flagReturn': {
          const f = s.flags[e.team];
          if (f) this.particles.ring(f.homeX * T + 16, f.homeY * T + 16, 30, 4, teamColor(s, e.team, opts.colorblind), 0.45, 3);
          break;
        }
        case 'power': {
          const p = pl(e.p);
          if (e.kind === 'heal') this.heals.set(e.p, this.time);
          const txt = { bomb: '+1 BOMBA', fire: '+1 FUEGO', speed: '¡VELOCIDAD!', heal: '+50 VIDA', hyper: '+CARGA' }[e.kind];
          if (p) this.particles.text(p.x * T, p.y * T - 38, txt, '#ffffff', 9, 1);
          this.particles.burst(e.x * T + 16, e.y * T + 16, 10, ['#ffffff', '#ffd23f'], 60, { kind: 'star', size: 3, life: 0.5 });
          break;
        }
        case 'spawn':
          this.deaths.delete(e.p);
          this.particles.ring(e.x * T, e.y * T - 8, 22, 2, 'rgba(255,255,255,0.9)', 0.4, 3);
          this.particles.burst(e.x * T, e.y * T - 8, 12, ['#ffffff', '#bfe8ff'], 50, { kind: 'star', size: 3, life: 0.5, g: -30 });
          break;
        case 'fall':
          this.falling.set(e.y * s.w + e.x, this.time);
          break;
        case 'hurry':
          this.flash = 0.25;
          this.flashColor = '#ff3b3b';
          break;
        case 'roundStart':
          this.deaths.clear();
          this.heals.clear();
          this.falling.clear();
          this.floorKey = '';
          break;
        case 'streak': {
          const p = pl(e.p);
          if (p) this.particles.text(p.x * T, p.y * T - 44, e.n >= 8 ? '¡IMPARABLE!' : e.n >= 5 ? '¡ARRASANDO!' : '¡RACHA x3!', '#ffb13b', 11, 1.3);
          break;
        }
        case 'zoneMove':
          this.particles.ring(e.x * T + 16, e.y * T + 16, 60, 10, '#ffd23f', 0.6, 3);
          break;
        case 'lava':
          if (e.on) this.addShake(2 * opts.shake);
          break;
      }
    }
  }

  addShake(a: number) {
    this.shakeAmt = Math.min(10, Math.max(this.shakeAmt, a));
  }

  // -------------------------------------------------------------------------
  // Dibujo
  // -------------------------------------------------------------------------

  private buildFloor(s: MatchState, cb: boolean) {
    const theme = this.theme(s);
    const key = `${s.config.map}:${s.config.mode}:${cb}:${s.round}:${tileVersion()}`;
    if (this.floor && this.floorKey === key) return;
    const map = parseMap(s.config.map);
    const cv = document.createElement('canvas');
    cv.width = s.w * T;
    cv.height = s.h * T;
    const ctx = cv.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < s.h; y++)
      for (let x = 0; x < s.w; x++) {
        const rs = theme === 'ruinas' ? ruinasSprite('floor', x, y) : null;
        if (rs) {
          ctx.drawImage(rs, x * T, y * T);
          const fl = ruinasFloorFlower(x, y);
          if (fl) ctx.drawImage(fl, x * T, y * T);
        } else {
          Sprites.floor(theme, x, y).drawTo(ctx, x * T, y * T);
        }
      }
    // bases de cada equipo
    if (MODES[s.config.mode].teams) {
      map.flags.forEach((f, team) => {
        const tint = Sprites.baseTint(teamColor(s, team, cb));
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const tx = f.x + dx;
            const ty = f.y + dy;
            if (map.tiles[ty * s.w + tx] === Tile.Wall) continue;
            ctx.drawImage(tint, tx * T, ty * T);
          }
        ctx.drawImage(Sprites.flagStand(teamColor(s, team, cb)), f.x * T, f.y * T);
      });
    }
    this.floor = cv;
    this.floorKey = key;
  }

  render(s: MatchState, alpha: number, prev: Map<number, { x: number; y: number }> | null, dt: number, opts: RenderOpts) {
    this.time += dt;
    const ctx = this.ctx;
    const theme = this.theme(s);
    const pal = THEMES[theme];
    this.buildFloor(s, opts.colorblind);
    this.particles.update(dt);

    // sacudida de cámara
    let sx = 0;
    let sy = 0;
    if (this.shakeAmt > 0.05 && !opts.reducedMotion) {
      sx = (Math.random() - 0.5) * this.shakeAmt * 2;
      sy = (Math.random() - 0.5) * this.shakeAmt * 2;
    }
    this.shakeAmt *= Math.pow(0.0015, dt);

    const S = this.S;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(S, 0, 0, S, Math.round(sx * S), Math.round(sy * S));
    ctx.imageSmoothingEnabled = false;

    ctx.drawImage(this.floor!, 0, 0);

    const frame4 = Math.floor(this.time * 8);
    // cintas, lava, sombras de paredes
    for (let y = 0; y < s.h; y++) {
      for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        const t = s.tiles[i];
        if (s.conv[i] && t !== Tile.Wall) ctx.drawImage(Sprites.conveyor(s.conv[i], frame4), x * T, y * T);
        if (t === Tile.Lava) {
          const st = s.lavaOn ? 2 : s.lavaT < 1.6 ? 1 : 0;
          ctx.drawImage(Sprites.lava(st, frame4 >> 1, x, y), x * T, y * T);
          if (st === 2 && Math.random() < 0.05) this.particles.add({ kind: 'circ', x: x * T + 8 + Math.random() * 16, y: y * T + 16, vy: -40, g: 80, size: 1.5, life: 0.5, color: '#ffd23f' });
        }
        if (y > 0 && t !== Tile.Wall && t !== Tile.Block) {
          const above = s.tiles[i - s.w];
          if (above === Tile.Wall || above === Tile.Block || above === Tile.Door) {
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.fillRect(x * T, y * T, T, 5);
          }
        }
      }
    }

    // zona (Zona Bombástica)
    if (s.koth) this.drawKoth(s, opts);

    // zonas de hipercarga
    for (const z of s.zones) this.drawZone(s, z, opts);

    // entidades por fila (profundidad)
    const players = s.players.slice().sort((a, b) => a.y - b.y);
    const pos = (p: PlayerState) => {
      const pv = prev?.get(p.id);
      if (!pv || Math.abs(pv.x - p.x) > 1.5 || Math.abs(pv.y - p.y) > 1.5) return { x: p.x, y: p.y };
      return { x: pv.x + (p.x - pv.x) * alpha, y: pv.y + (p.y - pv.y) * alpha };
    };
    let pi = 0;
    for (let y = 0; y < s.h; y++) {
      // paredes y bloques de la fila
      for (let x = 0; x < s.w; x++) {
        const i = y * s.w + x;
        const t = s.tiles[i];
        const below = y + 1 >= s.h || s.tiles[i + s.w] === Tile.Wall || s.tiles[i + s.w] === Tile.Block;
        if (t === Tile.Wall) {
          const rsWall = theme === 'ruinas' ? ruinasSprite('wall', x, y) : null;
          const sprWall = rsWall ?? Sprites.wall(theme, x, y, below);
          const ft = this.falling.get(i);
          if (ft !== undefined) {
            const k = Math.min(1, (this.time - ft) / 0.28);
            ctx.fillStyle = `rgba(0,0,0,${0.35 * k})`;
            ctx.fillRect(x * T + 2, y * T + 4, T - 4, T - 4);
            ctx.drawImage(rsWall ?? Sprites.wall(theme, x, y, false), x * T, y * T - (1 - k) * 90);
            if (k >= 1) {
              this.falling.delete(i);
              this.particles.burst(x * T + 16, y * T + 28, 6, ['#9d958a', '#bdb4a8'], 40, { kind: 'smoke', size: 4, life: 0.4 });
              this.addShake(1 * opts.shake);
            }
          } else ctx.drawImage(sprWall, x * T, y * T);
        } else if (t === Tile.Block) {
          const rsBlk = theme === 'ruinas' ? ruinasSprite('block', x, y) : null;
          ctx.drawImage(rsBlk ?? Sprites.block(theme, x, y, below), x * T, y * T);
        }
      }
      // indicador de bloques próximos a regenerar (universal 15s)
      for (const rg of s.regen) {
        if (Math.floor(rg.i / s.w) !== y || s.tiles[rg.i] !== Tile.Floor) continue;
        const rx = (rg.i % s.w) * T;
        const ry = y * T;
        const pct = 1 - Math.max(0, Math.min(1, rg.t / RULES.blockRegen));
        const blink = rg.t < 2.2 && Math.floor(this.time * 10) % 2 === 0;
        ctx.save();
        ctx.globalAlpha = blink ? 0.65 : 0.35;
        ctx.strokeStyle = rg.t < 2.2 ? '#ffe94d' : '#a8e6ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(rx + 4, ry + 4, T - 8, T - 8);
        ctx.fillStyle = rg.t < 2.2 ? '#ffe94d' : '#5ff2ff';
        ctx.fillRect(rx + 6, ry + T - 7, Math.round((T - 12) * pct), 3);
        ctx.restore();
      }
      // compuertas
      for (const d of s.doors) {
        if (d.y !== y) continue;
        const key = d.y * s.w + d.x;
        const cur = this.doorAnim.get(key) ?? (d.open ? 1 : 0);
        const target = d.open ? 1 : 0;
        const nv = cur + Math.sign(target - cur) * Math.min(Math.abs(target - cur), dt * 5);
        this.doorAnim.set(key, nv);
        ctx.drawImage(Sprites.door(nv), d.x * T, d.y * T);
      }
      // barreras
      for (const b of s.barriers) if (b.y === y) this.drawBarrier(s, b, opts);
      // llamas
      for (const f of s.flames) {
        if (f.y !== y) continue;
        const r = 1 - f.t / f.life;
        const stage = r < 0.12 ? 0 : r < 0.55 ? 1 : r < 0.8 ? 2 : 3;
        ctx.drawImage(Sprites.flame(f.shape, stage, frame4, f.fx), f.x * T, f.y * T);
      }
      // mejoras
      for (const pu of s.powerups) {
        if (pu.y !== y) continue;
        const bob = Math.round(Math.sin(this.time * 4 + pu.id) * 1.5);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath();
        ctx.ellipse(pu.x * T + 16, pu.y * T + 27, 9, 3, 0, 0, Math.PI * 2);
        ctx.fill();
        const sc = pu.t < 0.3 ? pu.t / 0.3 : 1;
        const spr = Sprites.powerup(pu.kind, Math.floor(this.time * 3));
        ctx.drawImage(spr, pu.x * T + 16 - 16 * sc, pu.y * T + bob + 16 - 16 * sc, 32 * sc, 32 * sc);
      }
      // bombas
      if (this.bombBorn.size > 200) {
        const alive = new Set(s.bombs.map((b) => b.id));
        for (const id of this.bombBorn.keys()) if (!alive.has(id)) this.bombBorn.delete(id);
      }
      for (const b of s.bombs) {
        if (b.carrier !== undefined) continue;
        const cellY = b.airDur && b.ty !== undefined ? Math.floor(b.ty) : Math.floor(b.y + 0.5);
        if (cellY !== y) continue;
        if (!this.bombBorn.has(b.id)) this.bombBorn.set(b.id, this.time);
        const age = this.time - this.bombBorn.get(b.id)!;
        const danger = b.t < 0.7 && Math.floor(this.time * 14) % 2 === 0;
        const pulse = Math.floor((b.fuse - b.t) * (b.t < 1 ? 10 : 4));
        const pop = age < 0.15 ? 0.6 + (age / 0.15) * 0.4 : 1;
        const lift = (b.z ?? 0) * 20;
        const spr = Sprites.bomb(pulse, danger, MODES[s.config.mode].teams ? teamColor(s, b.team, opts.colorblind) : undefined);
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(b.x * T + 16, b.y * T + 28, Math.max(5, 10 - (b.z ?? 0) * 3), 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(spr, b.x * T + 16 - 16 * pop, b.y * T + 32 - 32 * pop + 2 - lift, 32 * pop, 32 * pop);
        if (Math.random() < 0.3) this.particles.add({ kind: 'spark', x: b.x * T + 24, y: b.y * T + 3 - lift, vx: (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 20, g: 60, life: 0.3, color: Math.random() < 0.5 ? '#ffe94d' : '#ff7a1a' });
      }
      // banderas en el suelo
      for (const f of s.flags) {
        if (f.state === 1) continue;
        if (Math.floor(f.y) !== y) continue;
        this.drawFlag(s, f.team, f.x * T - 8, f.y * T - 26, opts);
        if (f.state === 2) {
          // anillo de retorno automático
          const k = f.dropT / 15;
          ctx.strokeStyle = teamColor(s, f.team, opts.colorblind);
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(f.x * T, f.y * T + 6, 11, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k);
          ctx.stroke();
        }
      }
      // jugadores cuyo pie está en esta fila
      while (pi < players.length && Math.floor(players[pi].y) <= y) {
        this.drawPlayer(s, players[pi], pos(players[pi]), opts);
        pi++;
      }
    }
    while (pi < players.length) this.drawPlayer(s, players[pi], pos(players[pi]), opts), pi++;

    // proyectiles
    for (const pr of s.projs) this.drawProj(pr.cls, pr.x * T, pr.y * T, pr.dir, pr.pierce);
    // golpes cuerpo a cuerpo
    for (let i = this.melee.length - 1; i >= 0; i--) {
      const m = this.melee[i];
      m.t += dt;
      if (m.t > 0.28) {
        this.melee.splice(i, 1);
        continue;
      }
      this.drawMelee(m);
    }

    this.particles.draw(ctx);

    if (s.tut) this.drawTutorial(s);

    // capa de información: nombres, vida, indicadores
    for (const p of players) this.drawOverlay(s, p, pos(p), opts);

    // tormenta circular tipo Battle Royale
    if (s.storm?.on) {
      const cx = s.storm.cx * T;
      const cy = s.storm.cy * T;
      const r = Math.max(8, s.storm.radius * T);
      ctx.save();
      ctx.fillStyle = 'rgba(130, 36, 198, 0.36)';
      ctx.beginPath();
      ctx.rect(-20, -20, this.worldW + 40, this.worldH + 40);
      ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.strokeStyle = Math.floor(this.time * 6) % 2 === 0 ? '#e066ff' : '#ff5ac8';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.lineDashOffset = -this.time * 28;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    // destello de pantalla
    if (this.flash > 0) {
      ctx.globalAlpha = Math.min(0.35, this.flash);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(-10, -10, this.worldW + 20, this.worldH + 20);
      ctx.globalAlpha = 1;
      this.flash -= dt;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  /** Marcas de ayuda del tutorial: zona objetivo y flechas. */
  private drawTutorial(s: MatchState) {
    const ctx = this.ctx;
    const step = s.tut!.step;
    const pulse = 0.5 + Math.sin(this.time * 5) * 0.5;
    const arrow = (x: number, y: number, color: string) => {
      const by = y - 10 - pulse * 6;
      ctx.fillStyle = color;
      ctx.strokeStyle = '#1a1026';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, by - 12);
      ctx.lineTo(x + 9, by - 12);
      ctx.lineTo(x, by);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    };
    if (step === 0) {
      ctx.globalAlpha = 0.18 + pulse * 0.15;
      ctx.fillStyle = '#3cff9a';
      ctx.fillRect(6 * T, T, T * 3, (s.h - 2) * T);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = '#3cff9a';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineDashOffset = -this.time * 20;
      ctx.strokeRect(6 * T + 1, T + 1, T * 3 - 2, (s.h - 2) * T - 2);
      ctx.setLineDash([]);
      arrow(7.5 * T, 3 * T, '#3cff9a');
    } else if (step === 1) {
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) if (s.tiles[y * s.w + x] === Tile.Block) arrow(x * T + 16, y * T + 4, '#ffd23f');
    } else if (step === 2) {
      for (const p of s.players) if (p.bot && p.alive) arrow(p.x * T, p.y * T - 48, '#ff5a5a');
    } else if (step === 4) {
      const f = s.flags[1];
      if (f && f.state !== 1) arrow(f.x * T, f.y * T - 34, '#ff5a5a');
    } else if (step === 5) {
      const f = s.flags[0];
      if (f) {
        ctx.globalAlpha = 0.2 + pulse * 0.2;
        ctx.fillStyle = '#3d8bff';
        ctx.fillRect((f.homeX - 1) * T, (f.homeY - 1) * T, T * 3, T * 3);
        ctx.globalAlpha = 1;
        arrow(f.homeX * T + 16, f.homeY * T - 20, '#3d8bff');
      }
    }
  }

  private drawFlag(s: MatchState, team: number, x: number, y: number, opts: RenderOpts, scale = 1) {
    const spr = Sprites.flag(teamColor(s, team, opts.colorblind), Math.floor(this.time * 7));
    this.ctx.drawImage(spr, x, y, spr.width * scale, spr.height * scale);
  }

  private drawKoth(s: MatchState, opts: RenderOpts) {
    const k = s.koth!;
    const ctx = this.ctx;
    const x0 = (k.x - 1) * T;
    const y0 = (k.y - 1) * T;
    const color = k.contested ? (Math.floor(this.time * 6) % 2 ? '#ffffff' : '#ff3b3b') : k.owner >= 0 ? teamColor(s, k.owner, opts.colorblind) : '#ffd23f';
    const pulse = 0.18 + Math.sin(this.time * 4) * 0.06;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = color;
    ctx.fillRect(x0, y0, T * 3, T * 3);
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -this.time * 20;
    ctx.strokeRect(x0 + 1, y0 + 1, T * 3 - 2, T * 3 - 2);
    ctx.setLineDash([]);
    // indicador de tiempo hasta que se mueva
    ctx.fillStyle = color;
    ctx.fillRect(x0 + 2, y0 - 5, (T * 3 - 4) * (k.t / 40), 3);
    ctx.globalAlpha = 1;
  }

  private drawZone(s: MatchState, z: MatchState['zones'][number], opts: RenderOpts) {
    const ctx = this.ctx;
    const cx = z.x * T;
    const cy = z.y * T;
    const r = z.r * T;
    const fade = Math.min(1, z.t / 0.5, (z.life - z.t) / 0.25 + 0.2);
    const c = z.kind === 'heal' ? '93,255,154' : '199,125,255';
    ctx.globalAlpha = 0.16 * fade;
    ctx.fillStyle = `rgb(${c})`;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85 * fade;
    ctx.strokeStyle = `rgb(${c})`;
    ctx.lineWidth = 2;
    ctx.setLineDash(z.kind === 'slow' ? [5, 5] : [2, 0]);
    ctx.lineDashOffset = this.time * (z.kind === 'slow' ? 30 : 0);
    ctx.beginPath();
    ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const pr = r * (0.3 + ((this.time * 0.8) % 1) * 0.7);
    ctx.globalAlpha = 0.4 * fade * (1 - ((this.time * 0.8) % 1));
    ctx.beginPath();
    ctx.arc(cx, cy, pr, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (Math.random() < 0.25) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * r;
      if (z.kind === 'heal') this.particles.add({ kind: 'text', x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vy: -20, text: '+', color: '#5dff9a', size: 9, life: 0.6, max: 0.6 });
      else this.particles.add({ kind: 'sq', x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, vy: -10, size: 2, color: Math.random() < 0.5 ? '#ff4fd8' : '#6ff3ff', life: 0.5, max: 0.5 });
    }
    void opts;
    void s;
  }

  private drawBarrier(s: MatchState, b: MatchState['barriers'][number], opts: RenderOpts) {
    const ctx = this.ctx;
    const c = teamColor(s, b.team, opts.colorblind);
    const blink = b.t < 1.2 && Math.floor(this.time * 10) % 2 === 0;
    ctx.globalAlpha = blink ? 0.3 : 0.55;
    ctx.fillStyle = c;
    ctx.fillRect(b.x * T + 2, b.y * T - 6, T - 4, T + 4);
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#ffffff';
    for (let yy = 0; yy < T + 4; yy += 4) {
      const off = (yy + Math.floor(this.time * 30)) % 8 < 4;
      if (off) ctx.fillRect(b.x * T + 4, b.y * T - 6 + yy, T - 8, 1);
    }
    ctx.strokeStyle = c;
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x * T + 2, b.y * T - 6, T - 4, T + 4);
    ctx.globalAlpha = 1;
  }

  private isHealing(s: MatchState, p: PlayerState, windowSec: number): boolean {
    if (!p.alive) return false;
    if (this.time - (this.heals.get(p.id) ?? -10) < windowSec) return true;
    return s.zones.some((z) => z.kind === 'heal' && z.team === p.team && Math.hypot(p.x - z.x, p.y - z.y) <= z.r && p.hp < p.maxHp);
  }

  private animFor(s: MatchState, p: PlayerState): { anim: Anim; f: number } {
    if (!p.alive) {
      const dt = this.time - (this.deaths.get(p.id) ?? this.time - 10);
      return { anim: 'ko', f: Math.min(4, Math.floor(dt * 9)) };
    }
    if (s.phase === 'ended' && (s.winner === p.team || s.winner === -2)) return { anim: 'win', f: Math.floor(this.time * 7) };
    if (p.castT > 0) return { anim: 'cast', f: Math.min(2, Math.floor((0.5 - p.castT) * 6)) };
    if (p.atkT > 0) return { anim: 'attack', f: Math.min(3, Math.floor((0.28 - p.atkT) * 15)) };
    if (p.hurtT > 0.1) return { anim: 'hurt', f: 0 };
    if (!p.moving && p.dashT <= 0 && this.isHealing(s, p, 0.75)) return { anim: 'win', f: Math.floor(this.time * 7) };
    if (p.moving || p.dashT > 0) return { anim: 'walk', f: Math.floor(p.walk * 3.2) };
    return { anim: 'idle', f: Math.floor((this.time + p.id * 0.37) * 4) };
  }

  private drawPlayer(s: MatchState, p: PlayerState, pos: { x: number; y: number }, opts: RenderOpts) {
    const ctx = this.ctx;
    const deadT = p.alive ? 0 : this.time - (this.deaths.get(p.id) ?? this.time - 10);
    if (!p.alive && deadT > 1.1) return;
    const x = pos.x * T;
    const y = pos.y * T;
    const color = teamColor(s, p.team, opts.colorblind);
    // estela de Sparks / Impulso
    const trail = this.trails.get(p.id) ?? [];
    if (p.alive && (p.dashT > 0 || (p.cls === 'veloz' && p.hyperT > 0 && p.moving))) {
      trail.push({ x, y, t: this.time, dir: p.dir, f: Math.floor(p.walk * 3.2) });
      this.trails.set(p.id, trail);
    }
    while (trail.length && this.time - trail[0].t > 0.25) trail.shift();
    for (const tr of trail) {
      ctx.globalAlpha = 0.35 * (1 - (this.time - tr.t) / 0.25);
      ctx.drawImage(Sprites.char(p.cls, p.skin, tr.dir, 'walk', tr.f), Math.round(tr.x - FW / 2), Math.round(tr.y + 10 - GROUND));
    }
    ctx.globalAlpha = 1;

    // sombra y anillo de equipo
    const alive = p.alive;
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    if (alive) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.ellipse(x, y + 10, 12, 4.5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // aura de hipercarga activa
    if (alive && p.hyperT > 0) {
      const c = CLASS_FX[p.cls];
      ctx.globalAlpha = 0.25 + Math.sin(this.time * 12) * 0.1;
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(x, y - 8, 16, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // halo verde de curación cuando recupera vida o recibe apoyo del Healer
    if (this.isHealing(s, p, 0.85)) {
      ctx.save();
      ctx.strokeStyle = '#5dff9a';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.55 + Math.sin(this.time * 8) * 0.25;
      ctx.beginPath();
      ctx.ellipse(x, y - 4, 15, 17, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // bandera en la espalda (detrás si mira abajo)
    if (alive && p.carrying >= 0 && p.dir !== 1) this.drawFlag(s, p.carrying, x - 18, y - 46, opts, 0.8);

    const { anim, f } = this.animFor(s, p);
    const spr = Sprites.char(p.cls, p.skin, p.dir, anim, f);
    let a = 1;
    if (alive && p.invuln > 0 && Math.floor(this.time * 12) % 2 === 0) a = 0.45;
    if (!alive) a = deadT > 0.6 ? Math.max(0, 1 - (deadT - 0.6) / 0.5) : 1;
    ctx.globalAlpha = a;
    const dx = Math.round(x - FW / 2);
    const dy = Math.round(y + 10 - GROUND);
    ctx.drawImage(spr, dx, dy);
    if (alive && p.hurtT > 0.12) {
      ctx.globalAlpha = 0.75;
      ctx.drawImage(Sprites.charFlash(p.cls, p.skin, p.dir, anim, f), dx, dy);
    }
    ctx.globalAlpha = 1;
    if (alive && p.carrying >= 0 && p.dir === 1) this.drawFlag(s, p.carrying, x - 14, y - 44, opts, 0.8);

    // estados
    if (alive && p.slowT > 0) {
      for (let k = 0; k < 3; k++) {
        const ang = this.time * 3 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = k % 2 ? '#ff4fd8' : '#c77dff';
        ctx.fillRect(Math.round(x + Math.cos(ang) * 12) - 1, Math.round(y + 6 + Math.sin(ang) * 3) - 1, 3, 3);
      }
    }
    if (alive && p.stunT > 0) {
      for (let k = 0; k < 3; k++) {
        const ang = this.time * 6 + (k * Math.PI * 2) / 3;
        ctx.fillStyle = '#ffe94d';
        ctx.fillRect(Math.round(x + Math.cos(ang) * 10), Math.round(y - 40 + Math.sin(ang) * 3), 2, 2);
      }
    }
    if (alive && p.shieldT > 0) {
      ctx.save();
      ctx.strokeStyle = Math.floor(this.time * 8) % 2 === 0 ? '#4de8d0' : '#ffe94d';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y - 10, 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (alive && p.heldBomb > 0) {
      const hb = s.bombs.find((b) => b.id === p.heldBomb);
      const danger = hb ? hb.t < 0.7 && Math.floor(this.time * 14) % 2 === 0 : false;
      const pulse = hb ? Math.floor((hb.fuse - hb.t) * (hb.t < 1 ? 10 : 4)) : Math.floor(this.time * 6);
      const bspr = Sprites.bomb(pulse, danger, MODES[s.config.mode].teams ? teamColor(s, p.team, opts.colorblind) : undefined);
      ctx.drawImage(bspr, Math.round(x - 14), Math.round(y - 54), 28, 28);
    }
  }

  private drawOverlay(s: MatchState, p: PlayerState, pos: { x: number; y: number }, opts: RenderOpts) {
    if (!p.alive) return;
    const ctx = this.ctx;
    const x = pos.x * T;
    const y = pos.y * T;
    const color = teamColor(s, p.team, opts.colorblind);
    const top = y - 44;
    const local = opts.localIds.includes(p.id);
    // barra de vida
    const w = 26;
    const hpk = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = 'rgba(20,12,30,0.85)';
    ctx.fillRect(Math.round(x - w / 2) - 1, Math.round(top) - 1, w + 2, 5);
    ctx.fillStyle = hpk > 0.5 ? color : hpk > 0.25 ? '#ffb13b' : '#ff3b3b';
    ctx.fillRect(Math.round(x - w / 2), Math.round(top), Math.round(w * hpk), 3);
    // hipercarga lista
    if (p.hyper >= 100) {
      ctx.fillStyle = Math.floor(this.time * 6) % 2 ? '#ffe94d' : '#ffffff';
      ctx.fillRect(Math.round(x - w / 2), Math.round(top) + 3, w, 1);
    }
    if (opts.names || local) {
      ctx.font = '8px "Fredoka", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1a1026';
      const label = local && opts.localIds.length > 1 ? `P${(p.local ?? 0) + 1} ${p.name}` : p.name;
      ctx.strokeText(label, x, top - 1);
      ctx.fillStyle = local ? '#ffffff' : color;
      ctx.fillText(label, x, top - 1);
    }
    if (local) {
      // flechita indicadora
      const by = top - 12 + Math.sin(this.time * 5) * 1.5;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x - 4, by - 4);
      ctx.lineTo(x + 4, by - 4);
      ctx.lineTo(x, by);
      ctx.fill();
    }
    // emote
    if (p.emoteT > 0) {
      const em = EMOTES.find((e) => e.id === p.emote);
      if (em) {
        const k = Math.min(1, (2.2 - p.emoteT) / 0.12);
        ctx.font = `${Math.round(9 * k)}px "Lilita One", sans-serif`;
        const tw = ctx.measureText(em.text).width;
        const bx = x - tw / 2 - 5;
        const byy = top - 30;
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, bx, byy, tw + 10, 15, 4);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x - 3, byy + 15);
        ctx.lineTo(x + 3, byy + 15);
        ctx.lineTo(x, byy + 19);
        ctx.fill();
        ctx.strokeStyle = '#1a1026';
        ctx.lineWidth = 1;
        roundRect(ctx, bx, byy, tw + 10, 15, 4);
        ctx.stroke();
        ctx.fillStyle = '#1a1026';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(em.text, x, byy + 8);
        ctx.fillStyle = em.color;
        ctx.fillRect(bx + 2, byy + 12, tw + 6, 1);
      }
    }
  }

  private drawProj(cls: ClassId, x: number, y: number, dir: number, pierce: boolean) {
    const ctx = this.ctx;
    const yy = y - 10;
    const horiz = dir >= 2;
    const t = this.time;
    switch (cls) {
      case 'distancia': {
        const len = pierce ? 16 : 12;
        ctx.fillStyle = pierce ? 'rgba(220,255,210,0.55)' : 'rgba(155,225,93,0.4)';
        if (horiz) ctx.fillRect(x - len / 2 - DX[dir] * 7, yy - 3, len + 7, 6);
        else ctx.fillRect(x - 3, yy - len / 2 - DY[dir] * 7, 6, len + 7);
        ctx.fillStyle = '#1a1026';
        if (horiz) ctx.fillRect(x - len / 2 - 1, yy - 3, len + 2, 6);
        else ctx.fillRect(x - 3, yy - len / 2 - 1, 6, len + 2);
        ctx.fillStyle = pierce ? '#e3ffd9' : '#9be15d';
        if (horiz) ctx.fillRect(x - len / 2, yy - 2, len, 4);
        else ctx.fillRect(x - 2, yy - len / 2, 4, len);
        ctx.fillStyle = '#ffef78';
        ctx.fillRect(x + DX[dir] * (len / 2 - 1) - 2, yy + DY[dir] * (len / 2 - 1) - 2, 4, 4);
        ctx.fillStyle = '#ffffff';
        if (horiz) ctx.fillRect(x - len / 2 + 2, yy - 1, len - 4, 2);
        else ctx.fillRect(x - 1, yy - len / 2 + 2, 2, len - 4);
        if (Math.random() < 0.65) this.particles.add({ kind: 'spark', x, y: yy, vx: -DX[dir] * 35, vy: -DY[dir] * 35, life: 0.22, color: '#9be15d' });
        break;
      }
      case 'support': {
        ctx.fillStyle = 'rgba(93,255,154,0.32)';
        ctx.beginPath();
        ctx.arc(x, yy, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2898d4';
        ctx.fillRect(x - 4, yy - 3, 8, 6);
        ctx.fillStyle = '#6bf2ff';
        ctx.fillRect(x - 3, yy - 2, 6, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 4, yy - 1, 8, 2);
        ctx.fillRect(x - 1, yy - 4, 2, 8);
        if (Math.random() < 0.35) this.particles.add({ kind: 'text', x, y: yy, vy: -12, text: '+', size: 7, color: '#5dff9a', life: 0.35, max: 0.35 });
        break;
      }
      case 'controlador': {
        ctx.save();
        ctx.translate(x, yy);
        ctx.rotate(t * 12);
        ctx.fillStyle = 'rgba(224,82,255,0.4)';
        ctx.fillRect(-7, -7, 14, 14);
        ctx.fillStyle = '#ffd23f';
        ctx.fillRect(-5, -5, 10, 10);
        ctx.fillStyle = '#e052ff';
        ctx.fillRect(-3, -3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-1, -1, 2, 2);
        ctx.restore();
        break;
      }
      default:
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - 2, yy - 2, 4, 4);
    }
  }

  private drawMelee(m: MeleeFx) {
    const ctx = this.ctx;
    const k = Math.min(1, m.t / 0.28);
    const x = m.x * T;
    const y = m.y * T - 8;
    const dx = DX[m.dir];
    const dy = DY[m.dir];
    const reach = m.len * T;
    const base = Math.atan2(dy, dx);
    ctx.globalAlpha = 1 - k * 0.85;
    switch (m.cls) {
      case 'tanque': {
        const px = x + dx * (12 + reach * (0.45 + 0.35 * k));
        const py = y + dy * (12 + reach * (0.45 + 0.35 * k));
        // Onda expansiva cian + impacto Bedrock dorado/carmesí
        ctx.strokeStyle = '#ffd23f';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(px, py, 5 + k * 14, base - 1.05, base + 1.05);
        ctx.stroke();
        ctx.strokeStyle = '#8fe9ff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(px, py, 8 + k * 15, base - 0.85, base + 0.85);
        ctx.stroke();
        ctx.fillStyle = '#d9413d';
        ctx.fillRect(px - 4, py - 4, 8, 8);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 2, py - 2, 4, 4);
        break;
      }
      case 'veloz': {
        // Doble corte eléctrico rápido en zig-zag
        for (const offset of [-4, 4]) {
          ctx.strokeStyle = offset < 0 ? '#ffe94d' : '#5ff2ff';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          let cx = x + dx * 6 + dy * offset;
          let cy = y + dy * 6 - dx * offset;
          ctx.moveTo(cx, cy);
          const steps = 6;
          for (let i = 1; i <= steps; i++) {
            const along = 6 + (reach * i) / steps;
            const j = (i % 2 ? 1 : -1) * 4.5;
            cx = x + dx * along + dy * (j + offset * 0.5);
            cy = y + dy * along - dx * (j + offset * 0.5);
            ctx.lineTo(cx, cy);
          }
          ctx.stroke();
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + dx * (reach + 6) - 2, y + dy * (reach + 6) - 2, 5, 5);
        break;
      }
      case 'defensor': {
        const along = 10 + reach * Math.min(1, k * 1.15);
        const px = x + dx * along;
        const py = y + dy * along;
        // Onda de escudo turquesa + ráfaga naranja del taladro
        ctx.strokeStyle = '#4de8d0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x + dx * Math.max(0, along - 12), y + dy * Math.max(0, along - 12), 15 + k * 4, base - 1.0, base + 1.0);
        ctx.stroke();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(x + dx * Math.max(0, along - 11), y + dy * Math.max(0, along - 11), 13 + k * 4, base - 0.75, base + 0.75);
        ctx.stroke();
        ctx.fillStyle = '#ffa229';
        ctx.fillRect(px - 3, py - 3, 6, 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px - 1, py - 1, 2, 2);
        break;
      }
    }
    ctx.globalAlpha = 1;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

void FH;
