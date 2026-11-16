// Simulación autoritativa del juego. Se usa igual en el navegador (partidas
// contra bots / locales) y en el servidor (partidas online).
import { BOMB, CLASSES, HYPER_GAIN, MODES, POWERUPS, RULES, SCORE } from './balance';
import { parseMap, spiralOrder, type ParsedMap } from './maps';
import {
  DX,
  DY,
  Tile,
  type BombState,
  type Dir,
  type FlagState,
  type GameEvent,
  type MatchConfig,
  type MatchState,
  type PlayerInput,
  type PlayerSlot,
  type PlayerState,
  type PowerUpKind,
} from './types';

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
const R = RULES.radius;
const EPS = 1e-6;

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function rand(s: MatchState): number {
  s.rng = (s.rng + 0x6d2b79f5) | 0;
  let t = s.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function emit(s: MatchState, e: GameEvent) {
  s.events.push(e);
}

export function playerById(s: MatchState, id: number): PlayerState | undefined {
  for (const p of s.players) if (p.id === id) return p;
  return undefined;
}

export function mapOf(s: MatchState): ParsedMap {
  return parseMap(s.config.map);
}

export function tileAt(s: MatchState, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return Tile.Wall;
  return s.tiles[y * s.w + x];
}

export function bombAt(s: MatchState, x: number, y: number): BombState | undefined {
  for (const b of s.bombs) {
    if (b.carrier !== undefined || b.airDur) continue;
    if (Math.floor(b.x + 0.5) === x && Math.floor(b.y + 0.5) === y) return b;
  }
  return undefined;
}

export function barrierAt(s: MatchState, x: number, y: number, team?: number) {
  for (const b of s.barriers) if (b.x === x && b.y === y && (team === undefined || b.team !== team)) return b;
  return undefined;
}

/** ¿La casilla bloquea el paso de este jugador? */
export function solidFor(s: MatchState, p: { id: number; team: number }, x: number, y: number): boolean {
  const t = tileAt(s, x, y);
  if (t === Tile.Wall || t === Tile.Block || t === Tile.Door) return true;
  for (const b of s.barriers) if (b.x === x && b.y === y && b.team !== p.team) return true;
  for (const b of s.bombs) {
    if (b.carrier !== undefined || b.airDur) continue;
    if (Math.floor(b.x + 0.5) === x && Math.floor(b.y + 0.5) === y && !b.passers.includes(p.id)) return true;
  }
  return false;
}

function overlapsTile(p: { x: number; y: number }, tx: number, ty: number): boolean {
  return p.x + R > tx + EPS && p.x - R < tx + 1 - EPS && p.y + R > ty + EPS && p.y - R < ty + 1 - EPS;
}

function overlapsTileInset(p: { x: number; y: number }, tx: number, ty: number, pad = 0.06): boolean {
  const r = Math.max(0.05, R - pad);
  return p.x + r > tx + EPS && p.x - r < tx + 1 - EPS && p.y + r > ty + EPS && p.y - r < ty + 1 - EPS;
}

export function isTeamMode(s: MatchState): boolean {
  return MODES[s.config.mode].teams;
}

export function modeRespawns(s: MatchState): boolean {
  return MODES[s.config.mode].respawn;
}

// ---------------------------------------------------------------------------
// Creación de la partida
// ---------------------------------------------------------------------------

export function createMatch(config: MatchConfig): MatchState {
  const map = parseMap(config.map);
  const mode = MODES[config.mode];
  const teams = mode.teams ? 2 : config.slots.length;
  const s: MatchState = {
    config,
    w: map.w,
    h: map.h,
    tiles: map.tiles.slice(),
    conv: map.conv.slice(),
    regen: [],
    doors: map.doors.map((d) => ({ x: d.x, y: d.y, open: false, t: RULES.doorClosed })),
    lavaT: RULES.lavaCycle,
    lavaOn: false,
    time: 0,
    tick: 0,
    phase: config.mode === 'tutorial' ? 'playing' : 'countdown',
    phaseT: RULES.countdown,
    timeLeft: config.timeLimit,
    round: 1,
    roundWins: new Array(teams).fill(0),
    teams,
    scores: new Array(teams).fill(0),
    teamPoints: new Array(teams).fill(0),
    players: [],
    bombs: [],
    flames: [],
    projs: [],
    zones: [],
    barriers: [],
    powerups: [],
    flags: [],
    koth: null,
    hurry: null,
    winner: -1,
    roundWinner: -1,
    nextId: 1000,
    rng: config.seed | 0 || 1,
    exId: 0,
    events: [],
    roundKills: new Array(teams).fill(0),
    lastAliveT: 0,
  };
  for (const d of s.doors) s.tiles[d.y * s.w + d.x] = Tile.Door;

  if (config.mode === 'ctf' || config.mode === 'tutorial') {
    s.flags = map.flags.map(
      (f, team): FlagState => ({ team, state: 0, x: f.x + 0.5, y: f.y + 0.5, homeX: f.x, homeY: f.y, carrier: -1, dropT: 0 }),
    );
  }
  if (config.mode === 'zona' && map.zones.length) {
    const z = map.zones[0];
    s.koth = { idx: 0, x: z.x, y: z.y, t: RULES.zoneMoveEvery, owner: -1, contested: false };
  }
  if (config.mode === 'clasica') s.hurry = { on: false, i: 0, t: 0 };
  if (config.mode === 'duelo' || config.mode === 'eliminacion' || config.mode === 'clasica') {
    const mr = Math.hypot(s.w / 2, s.h / 2) + 0.5;
    s.storm = { on: false, radius: mr, maxRadius: mr, cx: s.w / 2, cy: s.h / 2 };
  }
  if (config.mode === 'tutorial') s.tut = { step: 0, t: 0, flags: {} };

  for (const slot of config.slots) s.players.push(makePlayer(s, slot));
  placeAllPlayers(s);
  return s;
}

function makePlayer(s: MatchState, slot: PlayerSlot): PlayerState {
  const c = CLASSES[slot.cls];
  const mods = s.config.mods ?? {};
  return {
    id: slot.id,
    name: slot.name,
    team: MODES[s.config.mode].teams ? slot.team : s.config.slots.indexOf(slot),
    cls: slot.cls,
    skin: slot.skin,
    fx: slot.fx ?? 'clasico',
    bot: slot.bot,
    difficulty: slot.difficulty,
    userId: slot.userId,
    local: slot.local,
    x: 1.5,
    y: 1.5,
    dir: 0,
    moving: false,
    walk: 0,
    hp: c.hp,
    maxHp: c.hp,
    alive: true,
    respawn: 0,
    invuln: 0,
    bombsMax: mods.startBombs ?? BOMB.startBombs,
    range: mods.startRange ?? BOMB.range,
    speedUps: RULES.startSpeedBonus,
    atkCd: 0,
    hyper: 0,
    hyperT: 0,
    dashT: 0,
    slowT: 0,
    slowF: 1,
    stunT: 0,
    kbx: 0,
    kby: 0,
    shieldT: 0,
    carrying: -1,
    heldBomb: 0,
    hurtT: 0,
    atkT: 0,
    castT: 0,
    emote: 0,
    emoteT: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    caps: 0,
    returns: 0,
    defends: 0,
    dmg: 0,
    heal: 0,
    points: 0,
    blocks: 0,
    zoneTime: 0,
    dmgAcc: 0,
    healAcc: 0,
    streak: 0,
    dmgBy: {},
    spawnX: 1.5,
    spawnY: 1.5,
    lastSeq: 0,
    connected: true,
    prevBomb: 0,
    prevHyper: 0,
    prevEmote: 0,
    exHit: [],
  };
}

/** Posiciones iniciales (inicio de partida y de cada ronda). */
function placeAllPlayers(s: MatchState) {
  const map = mapOf(s);
  if (isTeamMode(s)) {
    const count = [0, 0];
    for (const p of s.players) {
      const list = teamSpawnList(s, p.team);
      const sp = list[count[p.team] % list.length];
      count[p.team]++;
      setSpawn(p, sp.x, sp.y);
    }
  } else {
    const list = map.ffa.length ? map.ffa : [{ x: 1, y: 1 }];
    s.players.forEach((p, i) => {
      const sp = list[i % list.length];
      setSpawn(p, sp.x, sp.y);
    });
  }
}

function setSpawn(p: PlayerState, x: number, y: number) {
  p.x = x + 0.5;
  p.y = y + 0.5;
  p.spawnX = p.x;
  p.spawnY = p.y;
  p.dir = 0;
}

const spawnListCache = new Map<string, { x: number; y: number }[]>();

/** Lista de apariciones del equipo; si el mapa trae pocas se completa con casillas libres cercanas a la base. */
function teamSpawnList(s: MatchState, team: number): { x: number; y: number }[] {
  const key = `${s.config.map}:${team}`;
  const hit = spawnListCache.get(key);
  if (hit) return hit;
  const map = mapOf(s);
  const list = map.spawns[team].slice();
  const flag = map.flags[team];
  if (list.length < 4) {
    // BFS desde la bandera buscando suelo libre
    const seen = new Set<number>([flag.y * map.w + flag.x]);
    const q = [flag];
    while (q.length && list.length < 4) {
      const c = q.shift()!;
      for (let d = 0; d < 4; d++) {
        const nx = c.x + DX[d];
        const ny = c.y + DY[d];
        const i = ny * map.w + nx;
        if (seen.has(i) || nx < 0 || ny < 0 || nx >= map.w || ny >= map.h) continue;
        seen.add(i);
        if (map.tiles[i] !== Tile.Floor) continue;
        if (!list.some((p) => p.x === nx && p.y === ny) && !(nx === flag.x && ny === flag.y)) list.push({ x: nx, y: ny });
        q.push({ x: nx, y: ny });
      }
    }
  }
  spawnListCache.set(key, list);
  return list;
}

function respawnPoint(s: MatchState, p: PlayerState): { x: number; y: number } {
  const list = teamSpawnList(s, p.team);
  // elegimos la aparición más segura (sin llamas, sin jugadores encima)
  let best = list[0];
  let bestScore = -Infinity;
  for (const sp of list) {
    let score = rand(s);
    if (s.flames.some((f) => f.x === sp.x && f.y === sp.y)) score -= 10;
    if (bombAt(s, sp.x, sp.y)) score -= 10;
    if (tileAt(s, sp.x, sp.y) === Tile.Block) score -= 20;
    for (const q of s.players) {
      if (!q.alive || q.id === p.id) continue;
      const d = Math.abs(q.x - sp.x - 0.5) + Math.abs(q.y - sp.y - 0.5);
      if (q.team !== p.team && d < 4) score -= 4 - d;
    }
    if (score > bestScore) {
      bestScore = score;
      best = sp;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Movimiento
// ---------------------------------------------------------------------------

/** Mueve al jugador sobre un eje, deteniéndolo contra casillas sólidas. */
export function moveAxis(s: MatchState, p: PlayerState, horiz: boolean, delta: number): number {
  if (Math.abs(delta) < 1e-9) return 0;
  const sgn = delta > 0 ? 1 : -1;
  const a = horiz ? p.x : p.y;
  const b = horiz ? p.y : p.x;
  const edge = a + sgn * R;
  const newEdge = edge + delta;
  const curCell = sgn > 0 ? Math.floor(edge - EPS) : Math.floor(edge + EPS);
  const newCell = sgn > 0 ? Math.floor(newEdge - EPS) : Math.floor(newEdge + EPS);
  let na = a + delta;
  if (newCell !== curCell) {
    const lo = Math.floor(b - R + EPS);
    const hi = Math.floor(b + R - EPS);
    let blocked = false;
    for (let c = lo; c <= hi; c++) {
      if (horiz ? solidFor(s, p, newCell, c) : solidFor(s, p, c, newCell)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      na = sgn > 0 ? newCell - R : newCell + 1 + R;
      if ((sgn > 0 && na < a) || (sgn < 0 && na > a)) na = a;
    }
  }
  if (horiz) p.x = na;
  else p.y = na;
  return Math.abs(na - a);
}

function tryKickAt(s: MatchState, p: PlayerState, dir: Dir, bx: number, by: number): boolean {
  const b = bombAt(s, bx, by);
  if (!b || b.passers.includes(p.id) || b.vx || b.vy) return false;
  if (b.heavy && b.team !== p.team) return false;
  b.vx = DX[dir] * BOMB.kickSpeed;
  b.vy = DY[dir] * BOMB.kickSpeed;
  b.passers = [];
  emit(s, { t: 'kick', p: p.id, x: b.x, y: b.y });
  return true;
}

/** Camina en una dirección con "ayuda en las esquinas" al estilo Bomberman y patada a bombas. */
export function walk(s: MatchState, p: PlayerState, dir: Dir, dist: number): number {
  const horiz = dir >= 2;
  const sgn = horiz ? DX[dir] : DY[dir];
  const a = horiz ? p.x : p.y;
  const b = horiz ? p.y : p.x;
  const lane = Math.floor(b);
  const off = b - (lane + 0.5);
  const leadEdge = a + sgn * R;
  const curEdgeCell = sgn > 0 ? Math.floor(leadEdge - EPS) : Math.floor(leadEdge + EPS);
  const nextEdgeCell = sgn > 0 ? Math.floor(leadEdge + dist - EPS) : Math.floor(leadEdge - dist + EPS);
  const boundary = sgn > 0 ? curEdgeCell + 1 : curEdgeCell;
  const distToBoundary = Math.abs(boundary - leadEdge);
  const next = curEdgeCell + sgn;
  const free = (ln: number) => (horiz ? !solidFor(s, p, next, ln) : !solidFor(s, p, ln, next));

  // Si está tocando o por cruzar hacia una bomba en el carril, patearla
  if (nextEdgeCell !== curEdgeCell || distToBoundary <= dist + 0.04) {
    const kbx = horiz ? next : lane;
    const kby = horiz ? lane : next;
    tryKickAt(s, p, dir, kbx, kby);
  }

  let moved = 0;
  // Solo activar deslizamiento/centrado de esquina cuando realmente estamos junto al borde de la casilla siguiente
  if (nextEdgeCell === curEdgeCell && distToBoundary > dist + 0.06) {
    moved += moveAxis(s, p, horiz, sgn * dist);
    return moved;
  }

  if (free(lane)) {
    if (Math.abs(off) > 1e-4) {
      const fwd = moveAxis(s, p, horiz, sgn * dist);
      moved += fwd;
      if (fwd < dist * 0.5) {
        moved += moveAxis(s, p, !horiz, -Math.sign(off) * Math.min(Math.abs(off), dist));
        moved += moveAxis(s, p, horiz, sgn * Math.max(0, dist - fwd));
      } else {
        moved += moveAxis(s, p, !horiz, -Math.sign(off) * Math.min(Math.abs(off), dist * 0.75));
      }
    } else {
      moved += moveAxis(s, p, horiz, sgn * dist);
    }
  } else {
    const nb = off < 0 ? lane - 1 : lane + 1;
    const cellA = Math.floor(a);
    const canSlide =
      distToBoundary <= dist + 0.08 &&
      Math.abs(off) > 0.1 &&
      free(nb) &&
      (horiz ? !solidFor(s, p, cellA, nb) : !solidFor(s, p, nb, cellA));
    if (canSlide) {
      moved += moveAxis(s, p, !horiz, Math.sign(off) * dist);
      moved += moveAxis(s, p, horiz, sgn * dist);
    } else {
      moved += moveAxis(s, p, horiz, sgn * dist);
    }
  }
  return moved;
}

export function playerSpeed(s: MatchState, p: PlayerState): number {
  let v = CLASSES[p.cls].speed * (1 + p.speedUps * RULES.speedUp);
  if (p.carrying >= 0 && p.cls !== 'veloz') v *= RULES.carrierSlow;
  if (p.slowT > 0) v *= p.slowF;
  if (p.cls === 'veloz' && p.hyperT > 0) v *= 1.6;
  v *= s.config.mods?.speedMul ?? 1;
  return v;
}

// ---------------------------------------------------------------------------
// Paso de simulación
// ---------------------------------------------------------------------------

/**
 * Avanza la partida un tick. `inputs` indexado por id de jugador.
 * Los eventos del tick quedan en `s.events` (el llamador los consume).
 */
export function step(s: MatchState, inputs: Record<number, PlayerInput | undefined>): void {
  s.events.length = 0;
  s.tick++;
  s.time += DT;

  switch (s.phase) {
    case 'countdown': {
      const before = Math.ceil(s.phaseT);
      s.phaseT -= DT;
      const after = Math.ceil(s.phaseT);
      if (after !== before && after > 0) emit(s, { t: 'count', n: after });
      if (s.phaseT <= 0) {
        s.phase = 'playing';
        emit(s, { t: 'go' });
      }
      tickVisual(s);
      // se puede girar durante la cuenta regresiva
      for (const p of s.players) {
        const inp = inputs[p.id];
        if (inp && inp.dir >= 0) p.dir = inp.dir as Dir;
        syncEdges(p, inp);
      }
      break;
    }
    case 'playing':
      updatePlaying(s, inputs);
      break;
    case 'roundEnd':
      s.phaseT -= DT;
      tickVisual(s);
      updateFlames(s, false);
      for (const p of s.players) syncEdges(p, inputs[p.id]);
      if (s.phaseT <= 0) nextRound(s);
      break;
    case 'ended':
      tickVisual(s);
      updateFlames(s, false);
      break;
  }
}

function syncEdges(p: PlayerState, inp: PlayerInput | undefined) {
  if (!inp) return;
  p.prevBomb = inp.bomb;
  p.prevHyper = inp.hyper;
  p.prevEmote = inp.emote;
}

function tickVisual(s: MatchState) {
  for (const p of s.players) {
    if (p.hurtT > 0) p.hurtT -= DT;
    if (p.atkT > 0) p.atkT -= DT;
    if (p.castT > 0) p.castT -= DT;
    if (p.emoteT > 0) p.emoteT -= DT;
    p.moving = false;
  }
}

function updatePlaying(s: MatchState, inputs: Record<number, PlayerInput | undefined>) {
  if (s.config.timeLimit > 0) s.timeLeft = Math.max(0, s.timeLeft - DT);

  updateDoors(s);
  updateLava(s);

  for (const p of s.players) updatePlayer(s, p, inputs[p.id]);

  updateBombs(s);

  updateFlames(s, true);
  updateProjectiles(s);
  updateZones(s);
  updateBarriers(s);
  updatePowerups(s);
  updateFlags(s);
  updateRegen(s);
  updateMode(s);
}

function bombCenterCell(b: BombState): { x: number; y: number } {
  return { x: Math.floor(b.x + 0.5), y: Math.floor(b.y + 0.5) };
}

function updateBombs(s: MatchState) {
  for (let i = 0; i < s.bombs.length; i++) {
    const b = s.bombs[i];
    b.t -= DT;

    // bomba cargada por un jugador
    if (b.carrier !== undefined) {
      const c = playerById(s, b.carrier);
      if (!c || !c.alive) {
        const cell = bombCenterCell(b);
        b.carrier = undefined;
        b.x = Math.max(1, Math.min(s.w - 2, cell.x));
        b.y = Math.max(1, Math.min(s.h - 2, cell.y));
        b.z = 0;
        if (c) c.heldBomb = 0;
      } else {
        b.x = c.x - 0.5;
        b.y = c.y - 0.5;
        b.z = 0.85;
        if (b.t <= 0) {
          b.carrier = undefined;
          c.heldBomb = 0;
          b.x = Math.floor(c.x);
          b.y = Math.floor(c.y);
          b.z = 0;
        }
        continue;
      }
    }

    // bomba lanzada en el aire
    if (b.airDur && b.airT !== undefined) {
      b.airT += DT;
      const u = Math.min(1, b.airT / b.airDur);
      b.x = (b.sx ?? b.x) + ((b.tx ?? b.x) - (b.sx ?? b.x)) * u;
      b.y = (b.sy ?? b.y) + ((b.ty ?? b.y) - (b.sy ?? b.y)) * u;
      b.z = Math.sin(u * Math.PI) * 1.55;
      b.t = Math.max(b.t, 0.06);
      if (u >= 1) {
        b.x = Math.round(b.tx ?? b.x);
        b.y = Math.round(b.ty ?? b.y);
        b.z = 0;
        b.airT = undefined;
        b.airDur = undefined;
        b.sx = undefined;
        b.sy = undefined;
        b.tx = undefined;
        b.ty = undefined;
        b.passers = [];
        for (const q of s.players) if (q.alive && overlapsTile(q, b.x, b.y)) b.passers.push(q.id);
      }
      continue;
    }

    // bomba pateada deslizándose
    if (b.vx || b.vy) {
      const vx = b.vx ?? 0;
      const vy = b.vy ?? 0;
      const nx = b.x + vx * DT;
      const ny = b.y + vy * DT;
      const leadX = Math.floor(nx + 0.5 + Math.sign(vx) * 0.48);
      const leadY = Math.floor(ny + 0.5 + Math.sign(vy) * 0.48);
      const t = tileAt(s, leadX, leadY);
      const hitWall = t === Tile.Wall || t === Tile.Block || t === Tile.Door || !!barrierAt(s, leadX, leadY);
      const hitOther = s.bombs.some(
        (o) =>
          o.id !== b.id &&
          o.carrier === undefined &&
          !o.airDur &&
          Math.floor(o.x + 0.5) === leadX &&
          Math.floor(o.y + 0.5) === leadY,
      );
      const hitPlayer = s.players.some(
        (q) =>
          q.alive &&
          Math.abs(q.x - (nx + 0.5)) < R + 0.36 &&
          Math.abs(q.y - (ny + 0.5)) < R + 0.36 &&
          Math.floor(q.x) === leadX &&
          Math.floor(q.y) === leadY,
      );
      if (hitWall || hitOther || hitPlayer) {
        b.x = Math.floor(b.x + 0.5);
        b.y = Math.floor(b.y + 0.5);
        b.vx = 0;
        b.vy = 0;
      } else {
        b.x = nx;
        b.y = ny;
      }
    }

    // detonación en cadena si pisa una llama activa
    const cell = bombCenterCell(b);
    if (s.flames.some((f) => f.x === cell.x && f.y === cell.y && f.t >= f.life * 0.25)) {
      b.t = Math.min(b.t, 0.04);
    }

    // los que ya no la pisan dejan de poder atravesarla
    if (b.passers.length) {
      b.passers = b.passers.filter((id) => {
        const q = playerById(s, id);
        return !!q && q.alive && overlapsTile(q, cell.x, cell.y);
      });
    }
  }
  let guard = 0;
  while (guard++ < 64) {
    const idx = s.bombs.findIndex((b) => b.t <= 0 && b.carrier === undefined && !b.airDur);
    if (idx < 0) break;
    explode(s, s.bombs[idx]);
  }
}

function updatePlayer(s: MatchState, p: PlayerState, inp: PlayerInput | undefined) {
  if (p.hurtT > 0) p.hurtT -= DT;
  if (p.atkT > 0) p.atkT -= DT;
  if (p.castT > 0) p.castT -= DT;
  if (p.emoteT > 0) p.emoteT -= DT;
  if (p.atkCd > 0) p.atkCd -= DT;
  if (p.invuln > 0) p.invuln -= DT;
  if (p.hyperT > 0) p.hyperT -= DT;
  if (p.shieldT > 0) p.shieldT -= DT;
  if (p.stunT > 0) p.stunT -= DT;
  if (p.slowT > 0) {
    p.slowT -= DT;
    if (p.slowT <= 0) p.slowF = 1;
  }
  p.moving = false;

  if (!p.alive) {
    syncEdges(p, inp);
    if (modeRespawns(s) && p.connected) {
      p.respawn -= DT;
      if (p.respawn <= 0) respawnPlayer(s, p);
    }
    return;
  }

  const input = inp ?? { dir: -1, bomb: p.prevBomb, attack: false, hyper: p.prevHyper, emote: p.prevEmote };

  // emotes
  if (input.emote !== p.prevEmote && (input.emote & 15) > 0) {
    p.emote = input.emote & 15;
    p.emoteT = 2.2;
    emit(s, { t: 'emote', p: p.id, e: p.emote });
  }

  const stunned = p.stunT > 0;

  // movimiento
  if (p.dashT > 0) {
    p.dashT -= DT;
    const moved = walk(s, p, p.dir, 17 * DT);
    p.walk += moved;
    p.moving = true;
  } else if (!stunned && input.dir >= 0) {
    p.dir = input.dir as Dir;
    const moved = walk(s, p, p.dir, playerSpeed(s, p) * DT);
    p.walk += moved;
    p.moving = moved > 0.0005;
  }

  // empuje
  if (Math.abs(p.kbx) > 0.05 || Math.abs(p.kby) > 0.05) {
    moveAxis(s, p, true, p.kbx * DT);
    moveAxis(s, p, false, p.kby * DT);
    p.kbx *= 0.86;
    p.kby *= 0.86;
  } else {
    p.kbx = 0;
    p.kby = 0;
  }

  // cintas transportadoras
  const ti = Math.floor(p.y) * s.w + Math.floor(p.x);
  const cv = s.conv[ti];
  if (cv > 0 && p.dashT <= 0) {
    const d = (cv - 1) as Dir;
    walk(s, p, d, RULES.conveyorSpeed * DT);
  }

  if (!stunned) {
    if (input.bomb !== p.prevBomb) handleBombAction(s, p);
    if (input.attack && p.atkCd <= 0) doAttack(s, p);
    if (input.hyper !== p.prevHyper && p.hyper >= RULES.hyperMax) activateHyper(s, p);
  }
  syncEdges(p, input);
}

function findThrowLanding(s: MatchState, p: PlayerState): { x: number; y: number } {
  const px = Math.floor(p.x);
  const py = Math.floor(p.y);
  const ok = (tx: number, ty: number) => {
    if (tx < 1 || ty < 1 || tx >= s.w - 1 || ty >= s.h - 1) return false;
    const t = tileAt(s, tx, ty);
    return (t === Tile.Floor || t === Tile.Lava) && !bombAt(s, tx, ty) && !s.barriers.some((b) => b.x === tx && b.y === ty);
  };
  const clampX = (x: number) => Math.max(1, Math.min(s.w - 2, x));
  const clampY = (y: number) => Math.max(1, Math.min(s.h - 2, y));
  for (const dist of [BOMB.throwDist, BOMB.throwDist + 1, BOMB.throwDist - 1, BOMB.throwDist + 2, 1]) {
    const tx = clampX(px + DX[p.dir] * dist);
    const ty = clampY(py + DY[p.dir] * dist);
    if (ok(tx, ty)) return { x: tx, y: ty };
  }
  for (let r = 1; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const tx = clampX(px + DX[p.dir] * BOMB.throwDist + dx);
        const ty = clampY(py + DY[p.dir] * BOMB.throwDist + dy);
        if (ok(tx, ty)) return { x: tx, y: ty };
      }
    }
  }
  return { x: px, y: py };
}

function handleBombAction(s: MatchState, p: PlayerState) {
  if (p.heldBomb > 0) {
    const b = s.bombs.find((x) => x.id === p.heldBomb);
    p.heldBomb = 0;
    if (!b) return;
    const land = findThrowLanding(s, p);
    b.carrier = undefined;
    b.sx = p.x - 0.5;
    b.sy = p.y - 0.5;
    b.tx = land.x;
    b.ty = land.y;
    b.airT = 0;
    b.airDur = BOMB.throwDuration;
    b.vx = 0;
    b.vy = 0;
    b.passers = [];
    emit(s, { t: 'throw', p: p.id, x: p.x, y: p.y });
    return;
  }

  const px = Math.floor(p.x);
  const py = Math.floor(p.y);
  const fx = px + DX[p.dir];
  const fy = py + DY[p.dir];
  const under = bombAt(s, px, py);
  const front = !under ? bombAt(s, fx, fy) : undefined;
  const nearFront = front && Math.abs(p.x - (fx + 0.5)) + Math.abs(p.y - (fy + 0.5)) <= 1.08 ? front : undefined;
  const target = under ?? nearFront;
  if (target && !target.vx && !target.vy && !(target.heavy && target.team !== p.team)) {
    target.carrier = p.id;
    target.passers = [];
    target.x = p.x - 0.5;
    target.y = p.y - 0.5;
    target.z = 0.85;
    p.heldBomb = target.id;
    emit(s, { t: 'grab', p: p.id, x: p.x, y: p.y });
    return;
  }

  placeBomb(s, p);
}

function respawnPlayer(s: MatchState, p: PlayerState) {
  const sp = respawnPoint(s, p);
  p.x = sp.x + 0.5;
  p.y = sp.y + 0.5;
  p.alive = true;
  p.hp = p.maxHp;
  p.invuln = RULES.spawnInvuln;
  p.slowT = 0;
  p.slowF = 1;
  p.stunT = 0;
  p.kbx = p.kby = 0;
  p.dir = p.team === 0 ? 3 : 2;
  emit(s, { t: 'spawn', p: p.id, x: p.x, y: p.y });
}

// ---------------------------------------------------------------------------
// Bombas y explosiones
// ---------------------------------------------------------------------------

export function activeBombs(s: MatchState, id: number): number {
  let n = 0;
  for (const b of s.bombs) if (b.owner === id) n++;
  return n;
}

export function placeBomb(s: MatchState, p: PlayerState): boolean {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  if (activeBombs(s, p.id) >= p.bombsMax) return false;
  const t = tileAt(s, tx, ty);
  if (t !== Tile.Floor && t !== Tile.Lava) return false;
  if (bombAt(s, tx, ty)) return false;
  if (s.barriers.some((b) => b.x === tx && b.y === ty)) return false;
  const passers: number[] = [];
  for (const q of s.players) if (q.alive && overlapsTile(q, tx, ty)) passers.push(q.id);
  s.bombs.push({
    id: s.nextId++,
    owner: p.id,
    team: p.team,
    x: tx,
    y: ty,
    t: BOMB.fuse,
    fuse: BOMB.fuse,
    range: p.range,
    passers,
    fx: p.fx,
  });
  p.invuln = 0;
  emit(s, { t: 'bomb', x: tx, y: ty, p: p.id });
  return true;
}

/** Casillas que alcanzaría una explosión (sin efectos). Usado también por la IA. */
export function blastCells(s: MatchState, x: number, y: number, range: number, team: number): { x: number; y: number }[] {
  const out = [{ x, y }];
  for (let d = 0; d < 4; d++) {
    for (let i = 1; i <= range; i++) {
      const cx = x + DX[d] * i;
      const cy = y + DY[d] * i;
      const t = tileAt(s, cx, cy);
      if (t === Tile.Wall || t === Tile.Door) break;
      if (barrierAt(s, cx, cy, team)) break;
      out.push({ x: cx, y: cy });
      if (t === Tile.Block) break;
      if (bombAt(s, cx, cy)) break;
    }
  }
  return out;
}

function addFlame(s: MatchState, x: number, y: number, shape: number, ex: number, b: BombState) {
  // reemplaza llamas viejas en la misma casilla para no acumular
  for (let i = s.flames.length - 1; i >= 0; i--) {
    const f = s.flames[i];
    if (f.x === x && f.y === y && f.ex !== ex) {
      if (f.shape === 0 || shape !== 0) s.flames.splice(i, 1);
    }
  }
  s.flames.push({ x, y, t: BOMB.flameLife, life: BOMB.flameLife, ex, owner: b.owner, team: b.team, shape, fx: b.fx });
}

function explode(s: MatchState, b: BombState) {
  const idx = s.bombs.indexOf(b);
  if (idx >= 0) s.bombs.splice(idx, 1);
  const { x: bx, y: by } = bombCenterCell(b);
  const ex = ++s.exId;
  addFlame(s, bx, by, 0, ex, b);
  let cells = 1;
  for (let d = 0; d < 4; d++) {
    for (let i = 1; i <= b.range; i++) {
      const cx = bx + DX[d] * i;
      const cy = by + DY[d] * i;
      const t = tileAt(s, cx, cy);
      if (t === Tile.Wall || t === Tile.Door) break;
      if (barrierAt(s, cx, cy, b.team)) break;
      const end = i === b.range;
      const endShape = d === 0 ? 6 : d === 1 ? 5 : d === 2 ? 3 : 4;
      const midShape = d < 2 ? 2 : 1;
      if (t === Tile.Block) {
        addFlame(s, cx, cy, endShape, ex, b);
        destroyBlock(s, cx, cy, b.owner);
        cells++;
        break;
      }
      const other = bombAt(s, cx, cy);
      if (other) {
        other.t = Math.min(other.t, 0.06);
        addFlame(s, cx, cy, end ? endShape : midShape, ex, b);
        cells++;
        break;
      }
      // las llamas destruyen mejoras (salvo las recién aparecidas)
      s.powerups = s.powerups.filter((pu) => !(pu.x === cx && pu.y === cy && pu.t > 0.6));
      addFlame(s, cx, cy, end ? endShape : midShape, ex, b);
      cells++;
    }
  }
  emit(s, { t: 'explode', x: bx, y: by, p: b.owner, n: cells, fx: b.fx });
}

function destroyBlock(s: MatchState, x: number, y: number, by: number) {
  const i = y * s.w + x;
  if (s.tiles[i] !== Tile.Block) return;
  s.tiles[i] = Tile.Floor;
  emit(s, { t: 'break', x, y });
  const p = playerById(s, by);
  if (p) {
    p.blocks++;
    p.points += SCORE.block;
    addHyper(s, p, HYPER_GAIN.block);
  }
  if (s.config.mode !== 'tutorial') s.regen.push({ i, t: s.config.mods?.blockRegen ?? RULES.blockRegen });
  if (s.config.powerups && rand(s) < RULES.powerupChance) {
    s.powerups.push({ id: s.nextId++, x, y, kind: randomPowerup(s), t: 0 });
  }
}

function randomPowerup(s: MatchState): PowerUpKind {
  const entries = Object.entries(POWERUPS) as [PowerUpKind, { weight: number }][];
  const total = entries.reduce((a, [, v]) => a + v.weight, 0);
  let r = rand(s) * total;
  for (const [k, v] of entries) {
    r -= v.weight;
    if (r <= 0) return k;
  }
  return 'bomb';
}

function updateFlames(s: MatchState, damage: boolean) {
  for (let i = s.flames.length - 1; i >= 0; i--) {
    const f = s.flames[i];
    f.t -= DT;
    if (f.t <= 0) s.flames.splice(i, 1);
  }
  if (!damage) return;
  const dmgMul = s.config.mods?.bombDamageMul ?? 1;
  if (dmgMul <= 0) return;
  for (const p of s.players) {
    if (!p.alive) continue;
    for (const f of s.flames) {
      if (!overlapsTileInset(p, f.x, f.y, 0.06)) continue;
      if (f.t < f.life * 0.25) continue; // llama apagándose
      const hits = p.exHit;
      if (hits.includes(f.ex)) continue;
      // fuego amigo desactivado (el daño propio se reduce según BOMB.selfDamage)
      if (f.owner !== p.id && f.team === p.team) continue;
      hits.push(f.ex);
      if (hits.length > 12) hits.shift();
      const selfMul = f.owner === p.id ? BOMB.selfDamage : 1;
      const amount = Math.round(BOMB.damage * dmgMul * selfMul);
      const owner = playerById(s, f.owner);
      if (owner && owner.cls === 'controlador' && owner.team !== p.team) applySlow(p, 0.6, 1.8);
      damage_(s, p, amount, f.owner, 'bomb');
      if (!p.alive) break;
    }
  }
}

// ---------------------------------------------------------------------------
// Daño, curación, muertes
// ---------------------------------------------------------------------------

export function addHyper(s: MatchState, p: PlayerState, amount: number) {
  if (s.config.mode === 'tutorial' && s.tut && s.tut.step < 3) return;
  const before = p.hyper;
  p.hyper = Math.min(RULES.hyperMax, p.hyper + amount * (s.config.mods?.hyperMul ?? 1));
  if (before < RULES.hyperMax && p.hyper >= RULES.hyperMax) emit(s, { t: 'hyperReady', p: p.id });
}

function applySlow(p: PlayerState, f: number, t: number) {
  p.slowF = p.slowT > 0 ? Math.min(p.slowF, f) : f;
  p.slowT = Math.max(p.slowT, t);
}

export function inOwnBase(s: MatchState, p: PlayerState, radius = 2.5): boolean {
  if (!isTeamMode(s)) return false;
  const f = mapOf(s).flags[p.team];
  if (!f) return false;
  return Math.abs(p.x - (f.x + 0.5)) <= radius && Math.abs(p.y - (f.y + 0.5)) <= radius;
}

function damage_(s: MatchState, target: PlayerState, amount: number, srcId: number, how: string): number {
  if (!target.alive || target.invuln > 0) return 0;
  const src = srcId >= 0 ? playerById(s, srcId) : undefined;
  if (src && src.id !== target.id && src.team === target.team) return 0;
  if (target.shieldT > 0 && how !== 'crush' && how !== 'storm') {
    target.shieldT = 0;
    target.hurtT = 0.16;
    emit(s, { t: 'impact', x: target.x, y: target.y, cls: target.cls });
    return 0;
  }
  if (how !== 'crush' && how !== 'storm') {
    if (target.cls === 'defensor' && inOwnBase(s, target)) amount *= 0.75;
    if (target.cls === 'tanque') amount *= 0.75;
  }
  if (target.bot && target.difficulty === 0 && s.config.mode === 'tutorial') amount *= 1.5;
  const a = Math.max(1, Math.round(amount));
  target.hp -= a;
  target.hurtT = 0.22;
  emit(s, { t: 'hit', p: target.id, src: srcId, a, x: target.x, y: target.y });
  if (src && src.id !== target.id) {
    src.dmg += a;
    src.dmgAcc += a;
    while (src.dmgAcc >= 25) {
      src.dmgAcc -= 25;
      src.points += SCORE.damage;
    }
    addHyper(s, src, a * HYPER_GAIN.perDamage);
    target.dmgBy[src.id] = s.time;
  }
  if (target.hp <= 0) killPlayer(s, target, src, how);
  return a;
}
export { damage_ as damage };

export function heal(s: MatchState, target: PlayerState, amount: number, srcId: number) {
  if (!target.alive) return 0;
  const a = Math.min(amount, target.maxHp - target.hp);
  if (a <= 0) return 0;
  target.hp += a;
  emit(s, { t: 'heal', p: target.id, src: srcId, a: Math.round(a), x: target.x, y: target.y });
  const src = playerById(s, srcId);
  if (src && src.id !== target.id) {
    src.heal += a;
    src.healAcc += a;
    while (src.healAcc >= 50) {
      src.healAcc -= 50;
      src.points += SCORE.support;
    }
    addHyper(s, src, a * HYPER_GAIN.perHeal);
  }
  return a;
}

function killPlayer(s: MatchState, v: PlayerState, src: PlayerState | undefined, how: string) {
  v.hp = 0;
  v.alive = false;
  v.deaths++;
  v.streak = 0;
  v.respawn = RULES.respawn * (s.config.respawnMul ?? 1);
  if (s.config.mode === 'tutorial' && v.bot) v.respawn = 2;
  v.kbx = v.kby = 0;
  v.dashT = 0;
  if (v.heldBomb > 0) {
    const hb = s.bombs.find((b) => b.id === v.heldBomb);
    v.heldBomb = 0;
    if (hb) {
      hb.carrier = undefined;
      hb.x = Math.max(1, Math.min(s.w - 2, Math.floor(v.x)));
      hb.y = Math.max(1, Math.min(s.h - 2, Math.floor(v.y)));
      hb.z = 0;
    }
  }
  let carriedFlagOf = -1;
  if (v.carrying >= 0) {
    carriedFlagOf = v.carrying;
    dropFlag(s, v);
  }
  // las mejoras temporales se pierden al morir (conservando las iniciales pasivas al reaparecer)
  const mods = s.config.mods ?? {};
  const baseBombs = mods.startBombs ?? BOMB.startBombs;
  const baseRange = mods.startRange ?? BOMB.range;
  const hadUpgrades = v.bombsMax > baseBombs || v.range > baseRange || v.speedUps > RULES.startSpeedBonus;
  const vx = Math.floor(v.x);
  const vy = Math.floor(v.y);
  if (
    s.config.powerups &&
    hadUpgrades &&
    tileAt(s, vx, vy) === Tile.Floor &&
    !s.powerups.some((pu) => pu.x === vx && pu.y === vy)
  ) {
    s.powerups.push({ id: s.nextId++, x: vx, y: vy, kind: randomPowerup(s), t: 0 });
  }
  v.bombsMax = baseBombs;
  v.range = baseRange;
  v.speedUps = RULES.startSpeedBonus;
  v.hyperT = 0;
  v.shieldT = 0;

  const assists: number[] = [];
  if (src && src.id !== v.id) {
    src.kills++;
    src.points += SCORE.kill;
    addHyper(s, src, HYPER_GAIN.kill);
    src.streak++;
    if (src.streak === 3 || src.streak === 5 || src.streak === 8) emit(s, { t: 'streak', p: src.id, n: src.streak });
    if (s.flags.length) {
      const own = s.flags[src.team];
      const nearOwnFlag = own && Math.abs(v.x - (own.homeX + 0.5)) + Math.abs(v.y - (own.homeY + 0.5)) <= RULES.defendRadius;
      if (carriedFlagOf === src.team || nearOwnFlag) {
        src.defends++;
        src.points += SCORE.defend;
        addHyper(s, src, HYPER_GAIN.defend);
      }
    }
    if (s.roundKills) s.roundKills[src.team] = (s.roundKills[src.team] ?? 0) + 1;
  }
  for (const key of Object.keys(v.dmgBy)) {
    const id = Number(key);
    if (src && id === src.id) continue;
    if (v.dmgBy[key] < s.time - RULES.assistWindow) continue;
    const q = playerById(s, id);
    if (!q || q.team === v.team) continue;
    q.assists++;
    q.points += SCORE.assist;
    addHyper(s, q, HYPER_GAIN.assist);
    assists.push(id);
  }
  v.dmgBy = {};
  emit(s, { t: 'kill', p: v.id, src: src ? src.id : -1, as: assists, how });
}

// ---------------------------------------------------------------------------
// Ataques
// ---------------------------------------------------------------------------

function clearLineOfSight(s: MatchState, p: { id: number; team: number }, x0: number, y0: number, x1: number, y1: number, pierce = false): boolean {
  const tx0 = Math.floor(x0);
  const ty0 = Math.floor(y0);
  const steps = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 4));
  for (let i = 1; i <= steps; i++) {
    const u = i / steps;
    const sx = Math.floor(x0 + (x1 - x0) * u);
    const sy = Math.floor(y0 + (y1 - y0) * u);
    if (sx === tx0 && sy === ty0) continue;
    const t = tileAt(s, sx, sy);
    if (t === Tile.Wall || t === Tile.Door) return false;
    if (t === Tile.Block && !pierce) return false;
    if (barrierAt(s, sx, sy, p.team)) return false;
  }
  return true;
}

function doAttack(s: MatchState, p: PlayerState) {
  const a = CLASSES[p.cls].attack;
  p.atkCd = a.cooldown;
  p.atkT = 0.28;
  p.invuln = 0;
  if (a.kind === 'projectile') {
    const pierce = p.cls === 'distancia' && p.hyperT > 0;
    s.projs.push({
      id: s.nextId++,
      owner: p.id,
      team: p.team,
      cls: p.cls,
      x: p.x + DX[p.dir] * 0.3,
      y: p.y + DY[p.dir] * 0.3,
      dir: p.dir,
      speed: a.speed ?? 12,
      dmg: a.damage * (pierce ? 1.15 : 1),
      left: a.range + (pierce ? 2.5 : 0),
      pierce,
      hit: [],
    });
    emit(s, { t: 'attack', p: p.id, cls: p.cls, dir: p.dir, x: p.x, y: p.y });
    return;
  }
  // cuerpo a cuerpo: línea en la dirección de la mirada hasta chocar con algo sólido
  const reach = meleeReach(s, p, a.range);
  for (const q of s.players) {
    if (!q.alive || q.team === p.team) continue;
    const along = (q.x - p.x) * DX[p.dir] + (q.y - p.y) * DY[p.dir];
    const across = Math.abs((q.x - p.x) * DY[p.dir] - (q.y - p.y) * DX[p.dir]);
    if (along > -0.2 && along <= reach + 0.45 && across < 0.62 && clearLineOfSight(s, p, p.x, p.y, q.x, q.y)) {
      const dealt = damage_(s, q, a.damage, p.id, 'melee');
      if (dealt > 0 && a.knockback) {
        const kbMul = q.cls === 'tanque' ? 0.75 : 1;
        q.kbx += DX[p.dir] * a.knockback * kbMul;
        q.kby += DY[p.dir] * a.knockback * kbMul;
      }
    }
  }
  emit(s, { t: 'melee', p: p.id, cls: p.cls, dir: p.dir, x: p.x, y: p.y, len: reach });
}

function meleeReach(s: MatchState, p: PlayerState, range: number): number {
  const tx = Math.floor(p.x);
  const ty = Math.floor(p.y);
  // distancia hasta el borde de la casilla actual
  const edge = p.dir === 3 ? tx + 1 - p.x : p.dir === 2 ? p.x - tx : p.dir === 0 ? ty + 1 - p.y : p.y - ty;
  let reach = edge;
  for (let i = 1; i <= Math.ceil(range) + 1; i++) {
    const cx = tx + DX[p.dir] * i;
    const cy = ty + DY[p.dir] * i;
    const t = tileAt(s, cx, cy);
    if (t === Tile.Wall || t === Tile.Block || t === Tile.Door || barrierAt(s, cx, cy, p.team)) break;
    reach += 1;
    if (reach >= range) break;
  }
  return Math.min(range, reach);
}

function projBlockedAt(s: MatchState, pr: { x: number; y: number; team: number; pierce: boolean }, px: number, py: number): boolean {
  const prR = 0.1;
  for (const ox of [-prR, prR]) {
    for (const oy of [-prR, prR]) {
      const tx = Math.floor(px + ox);
      const ty = Math.floor(py + oy);
      const t = tileAt(s, tx, ty);
      if (t === Tile.Wall || t === Tile.Door || (t === Tile.Block && !pr.pierce) || barrierAt(s, tx, ty, pr.team)) {
        return true;
      }
    }
  }
  return false;
}

function updateProjectiles(s: MatchState) {
  for (let i = s.projs.length - 1; i >= 0; i--) {
    const pr = s.projs[i];
    let travel = pr.speed * DT;
    let dead = false;
    while (travel > 0 && !dead) {
      const st = Math.min(0.2, travel);
      travel -= st;
      pr.x += DX[pr.dir] * st;
      pr.y += DY[pr.dir] * st;
      pr.left -= st;
      const tx = Math.floor(pr.x);
      const ty = Math.floor(pr.y);
      if (projBlockedAt(s, pr, pr.x, pr.y)) {
        emit(s, { t: 'impact', x: pr.x - DX[pr.dir] * 0.3, y: pr.y - DY[pr.dir] * 0.3, cls: pr.cls });
        dead = true;
        break;
      }
      if (pr.cls === 'distancia') {
        const b =
          bombAt(s, tx, ty) ??
          s.bombs.find(
            (x) =>
              x.carrier === undefined &&
              !x.airDur &&
              Math.abs(x.x + 0.5 - pr.x) <= 0.48 &&
              Math.abs(x.y + 0.5 - pr.y) <= 0.48,
          );
        if (b) {
          b.t = Math.min(b.t, 0.02);
          emit(s, { t: 'impact', x: pr.x, y: pr.y, cls: pr.cls });
          dead = true;
          break;
        }
      }
      for (const q of s.players) {
        if (!q.alive || q.id === pr.owner || pr.hit.includes(q.id)) continue;
        if (Math.abs(q.x - pr.x) > 0.45 || Math.abs(q.y - pr.y) > 0.5) continue;
        if (!clearLineOfSight(s, { id: pr.owner, team: pr.team }, pr.x, pr.y, q.x, q.y, pr.pierce)) continue;
        if (q.team !== pr.team) {
          pr.hit.push(q.id);
          const dealt = damage_(s, q, pr.dmg, pr.owner, 'shot');
          const a = CLASSES[pr.cls].attack;
          if (dealt > 0 && a.slow) applySlow(q, a.slow, a.slowTime ?? 1.5);
          emit(s, { t: 'impact', x: pr.x, y: pr.y, cls: pr.cls });
          if (!pr.pierce) {
            dead = true;
            break;
          }
        } else {
          const a = CLASSES[pr.cls].attack;
          if (a.healAlly && q.hp < q.maxHp) {
            pr.hit.push(q.id);
            heal(s, q, a.healAlly, pr.owner);
            emit(s, { t: 'impact', x: pr.x, y: pr.y, cls: pr.cls });
            dead = true;
            break;
          }
        }
      }
      if (pr.left <= 0) dead = true;
    }
    if (dead) s.projs.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// Hipercarga (GDD sección 6 y 7)
// ---------------------------------------------------------------------------

export function activateHyper(s: MatchState, p: PlayerState) {
  p.hyper = 0;
  p.castT = 0.5;
  p.invuln = 0;
  const def = CLASSES[p.cls].hyper;
  switch (p.cls) {
    case 'distancia':
      p.hyperT = def.duration;
      break;
    case 'veloz':
      p.hyperT = def.duration;
      p.dashT = 0.2;
      emit(s, { t: 'dash', p: p.id, x: p.x, y: p.y });
      break;
    case 'support':
      s.zones.push({ id: s.nextId++, kind: 'heal', owner: p.id, team: p.team, x: p.x, y: p.y, r: 2.6, t: def.duration, life: def.duration });
      break;
    case 'controlador': {
      let cx = Math.floor(p.x);
      let cy = Math.floor(p.y);
      for (let i = 0; i < 2; i++) {
        const nx = cx + DX[p.dir];
        const ny = cy + DY[p.dir];
        const t = tileAt(s, nx, ny);
        if (t === Tile.Wall || t === Tile.Door) break;
        cx = nx;
        cy = ny;
      }
      s.zones.push({ id: s.nextId++, kind: 'slow', owner: p.id, team: p.team, x: cx + 0.5, y: cy + 0.5, r: 2.6, t: def.duration, life: def.duration });
      break;
    }
    case 'defensor': {
      const fx = Math.floor(p.x) + DX[p.dir];
      const fy = Math.floor(p.y) + DY[p.dir];
      const px = DY[p.dir] !== 0 ? 1 : 0;
      const py = DX[p.dir] !== 0 ? 1 : 0;
      for (let k = -1; k <= 1; k++) {
        const bx = fx + px * k;
        const by = fy + py * k;
        const t = tileAt(s, bx, by);
        if (t !== Tile.Floor && t !== Tile.Lava) continue;
        if (bombAt(s, bx, by)) continue;
        if (s.players.some((q) => q.alive && overlapsTile(q, bx, by))) continue;
        if (s.flags.some((f) => f.state === 0 && f.homeX === bx && f.homeY === by)) continue;
        s.barriers = s.barriers.filter((b) => !(b.x === bx && b.y === by));
        s.barriers.push({ x: bx, y: by, team: p.team, owner: p.id, t: def.duration });
      }
      break;
    }
    case 'tanque': {
      p.shieldT = def.duration;
      for (const q of s.players) {
        if (!q.alive || q.team === p.team) continue;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const d = Math.hypot(dx, dy);
        if (d > 2.7) continue;
        damage_(s, q, 45, p.id, 'impact');
        const n = d > 0.01 ? d : 1;
        const kbMul = q.cls === 'tanque' ? 0.75 : 1;
        q.kbx += (dx / n) * 11 * kbMul;
        q.kby += (dy / n) * 11 * kbMul;
        q.stunT = Math.max(q.stunT, 0.45);
      }
      const tx = Math.floor(p.x);
      const ty = Math.floor(p.y);
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) destroyBlock(s, tx + ox, ty + oy, p.id);
      break;
    }
  }
  emit(s, { t: 'hyper', p: p.id, cls: p.cls, x: p.x, y: p.y });
}

function updateZones(s: MatchState) {
  const sec = Math.floor(s.time) !== Math.floor(s.time - DT);
  const half = Math.floor(s.time * 2) !== Math.floor((s.time - DT) * 2);
  for (let i = s.zones.length - 1; i >= 0; i--) {
    const z = s.zones[i];
    z.t -= DT;
    if (z.t <= 0) {
      s.zones.splice(i, 1);
      continue;
    }
    for (const q of s.players) {
      if (!q.alive) continue;
      const inside = Math.hypot(q.x - z.x, q.y - z.y) <= z.r;
      if (!inside) continue;
      if (z.kind === 'heal' && q.team === z.team && half) {
        heal(s, q, 11, z.owner);
        if (q.slowT > 0) {
          q.slowT = 0;
          q.slowF = 1;
        }
      }
      if (z.kind === 'slow' && q.team !== z.team) applySlow(q, 0.42, 0.25);
    }
  }
  // pasiva de Nova
  if (sec) {
    for (const n of s.players) {
      if (!n.alive || n.cls !== 'support') continue;
      for (const q of s.players) {
        if (!q.alive || q.team !== n.team || q.id === n.id) continue;
        if (Math.hypot(q.x - n.x, q.y - n.y) <= 2.6) heal(s, q, 3, n.id);
      }
    }
  }
}

function updateBarriers(s: MatchState) {
  for (let i = s.barriers.length - 1; i >= 0; i--) {
    s.barriers[i].t -= DT;
    if (s.barriers[i].t <= 0) s.barriers.splice(i, 1);
  }
}

// ---------------------------------------------------------------------------
// Mejoras, compuertas, lava y regeneración de bloques
// ---------------------------------------------------------------------------

function updatePowerups(s: MatchState) {
  for (let i = s.powerups.length - 1; i >= 0; i--) {
    const pu = s.powerups[i];
    pu.t += DT;
    for (const p of s.players) {
      if (!p.alive) continue;
      if (!overlapsTile(p, pu.x, pu.y)) continue;
      switch (pu.kind) {
        case 'bomb':
          p.bombsMax = Math.min(BOMB.maxBombs, p.bombsMax + 1);
          break;
        case 'fire':
          p.range = Math.min(BOMB.maxRange, p.range + 1);
          break;
        case 'speed':
          p.speedUps = Math.min(RULES.maxSpeedUps, p.speedUps + 1);
          break;
        case 'heal':
          heal(s, p, 50, -1);
          break;
        case 'hyper':
          addHyper(s, p, 30);
          break;
      }
      emit(s, { t: 'power', p: p.id, kind: pu.kind, x: pu.x, y: pu.y });
      s.powerups.splice(i, 1);
      break;
    }
  }
}

function occupied(s: MatchState, x: number, y: number): boolean {
  if (s.players.some((q) => q.alive && overlapsTile(q, x, y))) return true;
  if (bombAt(s, x, y)) return true;
  if (s.powerups.some((p) => p.x === x && p.y === y)) return true;
  if (s.flags.some((f) => Math.floor(f.x) === x && Math.floor(f.y) === y)) return true;
  if (s.barriers.some((b) => b.x === x && b.y === y)) return true;
  if (s.flames.some((f) => f.x === x && f.y === y)) return true;
  return false;
}

function updateDoors(s: MatchState) {
  for (const d of s.doors) {
    d.t -= DT;
    if (d.t > 0) continue;
    const i = d.y * s.w + d.x;
    if (d.open) {
      if (occupied(s, d.x, d.y)) {
        d.t = 0.4;
        continue;
      }
      d.open = false;
      d.t = RULES.doorClosed;
      s.tiles[i] = Tile.Door;
    } else {
      d.open = true;
      d.t = RULES.doorOpen;
      s.tiles[i] = Tile.Floor;
    }
    emit(s, { t: 'door', x: d.x, y: d.y, open: d.open });
  }
}

function updateLava(s: MatchState) {
  if (s.config.map !== 'volcan') return;
  s.lavaT -= DT;
  if (s.lavaT <= 0) {
    s.lavaOn = !s.lavaOn;
    s.lavaT = s.lavaOn ? RULES.lavaActive : RULES.lavaCycle - RULES.lavaActive;
    emit(s, { t: 'lava', on: s.lavaOn });
  }
  if (!s.lavaOn) return;
  const half = Math.floor(s.time * 2) !== Math.floor((s.time - DT) * 2);
  if (!half) return;
  for (const p of s.players) {
    if (!p.alive) continue;
    const x0 = Math.floor(p.x - R + 0.06);
    const x1 = Math.floor(p.x + R - 0.06);
    const y0 = Math.floor(p.y - R + 0.06);
    const y1 = Math.floor(p.y + R - 0.06);
    let inLava = false;
    for (let ty = y0; ty <= y1 && !inLava; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tileAt(s, tx, ty) === Tile.Lava) {
          inLava = true;
          break;
        }
      }
    }
    if (inLava) damage_(s, p, RULES.lavaDamage / 2, -1, 'lava');
  }
}

function updateRegen(s: MatchState) {
  for (let i = s.regen.length - 1; i >= 0; i--) {
    const r = s.regen[i];
    r.t -= DT;
    if (r.t > 0) continue;
    const x = r.i % s.w;
    const y = Math.floor(r.i / s.w);
    if (occupied(s, x, y)) {
      r.t = 2;
      continue;
    }
    s.tiles[r.i] = Tile.Block;
    s.regen.splice(i, 1);
    emit(s, { t: 'regen', x, y });
  }
}

// ---------------------------------------------------------------------------
// Banderas (GDD sección 5)
// ---------------------------------------------------------------------------

function dropFlag(s: MatchState, carrier: PlayerState) {
  const f = s.flags[carrier.carrying];
  carrier.carrying = -1;
  if (!f) return;
  f.state = 2;
  f.carrier = -1;
  f.dropT = RULES.flagReturnTime;
  // cae en la casilla del portador (si es sólida, en su centro igual es alcanzable)
  f.x = Math.floor(carrier.x) + 0.5;
  f.y = Math.floor(carrier.y) + 0.5;
  emit(s, { t: 'flagDrop', team: f.team, x: f.x, y: f.y });
}

function returnFlag(s: MatchState, f: FlagState, by: number) {
  f.state = 0;
  f.carrier = -1;
  f.x = f.homeX + 0.5;
  f.y = f.homeY + 0.5;
  emit(s, { t: 'flagReturn', team: f.team, p: by });
}

function updateFlags(s: MatchState) {
  for (const f of s.flags) {
    if (f.state === 1) {
      const c = playerById(s, f.carrier);
      if (!c || !c.alive) {
        if (c) dropFlag(s, c);
        else returnFlag(s, f, -1);
        continue;
      }
      f.x = c.x;
      f.y = c.y;
      // captura: portador en su base con su propia bandera en casa
      const own = s.flags[c.team];
      if (own && own.state === 0 && Math.abs(Math.floor(c.x) - own.homeX) <= 1 && Math.abs(Math.floor(c.y) - own.homeY) <= 1) {
        capture(s, c, f);
      }
      continue;
    }
    if (f.state === 2) {
      f.dropT -= DT;
      if (f.dropT <= 0) {
        returnFlag(s, f, -1);
        continue;
      }
    }
    for (const p of s.players) {
      if (!p.alive) continue;
      if (Math.abs(p.x - f.x) > 0.62 || Math.abs(p.y - f.y) > 0.62) continue;
      if (p.team === f.team) {
        if (f.state === 2) {
          p.returns++;
          p.points += SCORE.returnFlag;
          addHyper(s, p, HYPER_GAIN.returnFlag);
          returnFlag(s, f, p.id);
          break;
        }
      } else if (p.carrying < 0) {
        f.state = 1;
        f.carrier = p.id;
        p.carrying = f.team;
        p.points += SCORE.takeFlag;
        addHyper(s, p, HYPER_GAIN.takeFlag);
        p.invuln = 0;
        emit(s, { t: 'flagTake', team: f.team, p: p.id });
        break;
      }
    }
  }
}

function capture(s: MatchState, c: PlayerState, f: FlagState) {
  c.carrying = -1;
  c.caps++;
  c.points += SCORE.capture;
  addHyper(s, c, HYPER_GAIN.capture);
  for (const q of s.players) {
    if (q.id !== c.id && q.alive && q.team === c.team && Math.hypot(q.x - c.x, q.y - c.y) < 6) addHyper(s, q, HYPER_GAIN.captureTeam);
  }
  s.scores[c.team]++;
  f.state = 0;
  f.carrier = -1;
  f.x = f.homeX + 0.5;
  f.y = f.homeY + 0.5;
  emit(s, { t: 'flagCap', team: c.team, p: c.id });
}

// ---------------------------------------------------------------------------
// Reglas de cada modo
// ---------------------------------------------------------------------------

export function computeTeamPoints(s: MatchState) {
  s.teamPoints.fill(0);
  for (const p of s.players) s.teamPoints[p.team] = (s.teamPoints[p.team] ?? 0) + p.points;
}

function endMatch(s: MatchState, winner: number) {
  computeTeamPoints(s);
  s.phase = 'ended';
  s.winner = winner;
  s.phaseT = 0;
  emit(s, { t: 'end', w: winner });
}

function compareOrDraw(values: number[], tie?: number[]): number {
  let best = -1;
  let bestV = -Infinity;
  let tied = false;
  values.forEach((v, i) => {
    if (v > bestV) {
      bestV = v;
      best = i;
      tied = false;
    } else if (v === bestV) tied = true;
  });
  if (!tied) return best;
  if (tie) {
    const cands = values.map((v, i) => (v === bestV ? i : -1)).filter((i) => i >= 0);
    let b2 = -1;
    let bv = -Infinity;
    let t2 = false;
    for (const i of cands) {
      if (tie[i] > bv) {
        bv = tie[i];
        b2 = i;
        t2 = false;
      } else if (tie[i] === bv) t2 = true;
    }
    if (!t2) return b2;
  }
  return -2;
}

function updateMode(s: MatchState) {
  const mode = s.config.mode;
  computeTeamPoints(s);
  switch (mode) {
    case 'ctf': {
      for (let t = 0; t < s.teams; t++) {
        if (s.scores[t] >= s.config.scoreLimit) return endMatch(s, t);
      }
      if (s.config.timeLimit > 0 && s.timeLeft <= 0) return endMatch(s, compareOrDraw(s.scores, s.teamPoints));
      break;
    }
    case 'zona': {
      const k = s.koth;
      if (k) {
        const present = new Set<number>();
        const inside: PlayerState[] = [];
        for (const p of s.players) {
          if (!p.alive) continue;
          if (Math.abs(Math.floor(p.x) - k.x) <= RULES.zoneRadius && Math.abs(Math.floor(p.y) - k.y) <= RULES.zoneRadius) {
            present.add(p.team);
            inside.push(p);
          }
        }
        k.contested = present.size > 1;
        if (present.size === 1) {
          const team = [...present][0];
          if (k.owner !== team) {
            k.owner = team;
            emit(s, { t: 'zoneOwner', team });
          }
          k.acc = (k.acc ?? 0) + DT * RULES.zoneRate;
          for (const p of inside) {
            p.zoneTime += DT;
          }
          while (k.acc >= 1) {
            k.acc -= 1;
            s.scores[team]++;
            for (const p of inside) {
              p.points += SCORE.zonePerSec;
              addHyper(s, p, HYPER_GAIN.zonePerSec);
            }
          }
        }
        k.t -= DT;
        if (k.t <= 0) {
          const zones = mapOf(s).zones;
          if (zones.length > 1) {
            let n = Math.floor(rand(s) * (zones.length - 1));
            if (n >= k.idx) n++;
            k.idx = n;
            k.x = zones[n].x;
            k.y = zones[n].y;
            k.owner = -1;
            k.acc = 0;
            // limpiamos bloques dentro de la nueva zona
            for (let oy = -1; oy <= 1; oy++)
              for (let ox = -1; ox <= 1; ox++) {
                const i = (k.y + oy) * s.w + (k.x + ox);
                if (s.tiles[i] === Tile.Block) {
                  s.tiles[i] = Tile.Floor;
                  emit(s, { t: 'break', x: k.x + ox, y: k.y + oy });
                }
              }
            emit(s, { t: 'zoneMove', x: k.x, y: k.y });
          }
          k.t = RULES.zoneMoveEvery;
        }
      }
      for (let t = 0; t < s.teams; t++) if (s.scores[t] >= s.config.scoreLimit) return endMatch(s, t);
      if (s.config.timeLimit > 0 && s.timeLeft <= 0) return endMatch(s, compareOrDraw(s.scores, s.teamPoints));
      break;
    }
    case 'duelo':
    case 'eliminacion':
    case 'clasica': {
      if (mode === 'clasica') updateHurry(s);
      updateStorm(s);
      const aliveTeams = new Set<number>();
      for (const p of s.players) if (p.alive) aliveTeams.add(p.team);
      if (aliveTeams.size <= 1) {
        // pequeña espera para que se vea la última explosión
        s.lastAliveT = (s.lastAliveT ?? 0) + DT;
        if (s.lastAliveT < 0.6) return;
        return endRound(s, aliveTeams.size === 1 ? [...aliveTeams][0] : -2);
      }
      s.lastAliveT = 0;
      if (s.config.timeLimit > 0 && s.timeLeft <= 0) {
        if (mode === 'eliminacion' || mode === 'duelo') {
          const alive = new Array(s.teams).fill(0);
          for (const p of s.players) if (p.alive) alive[p.team]++;
          const kills = new Array(s.teams).fill(0).map((_, i) => s.roundKills?.[i] ?? 0);
          return endRound(s, compareOrDraw(kills, alive));
        }
        const hp = new Array(s.teams).fill(-1);
        for (const p of s.players) if (p.alive) hp[p.team] = p.hp / p.maxHp;
        return endRound(s, compareOrDraw(hp));
      }
      break;
    }
    case 'tutorial':
      updateTutorial(s);
      break;
  }
}

function endRound(s: MatchState, w: number) {
  s.roundWinner = w;
  if (w >= 0) {
    s.roundWins[w]++;
    s.scores[w] = s.roundWins[w];
    for (const p of s.players) if (p.team === w) p.points += SCORE.roundWin;
  }
  emit(s, { t: 'roundEnd', w });
  if (w >= 0 && s.roundWins[w] >= s.config.scoreLimit) return endMatch(s, w);
  if (s.round >= s.config.scoreLimit * 2 + 1) {
    return endMatch(s, compareOrDraw(s.roundWins));
  }
  s.phase = 'roundEnd';
  s.phaseT = RULES.roundEndPause;
}

function nextRound(s: MatchState) {
  const map = mapOf(s);
  s.round++;
  s.tiles = map.tiles.slice();
  for (const d of s.doors) {
    d.open = false;
    d.t = RULES.doorClosed;
    s.tiles[d.y * s.w + d.x] = Tile.Door;
  }
  s.bombs = [];
  s.flames = [];
  s.projs = [];
  s.zones = [];
  s.barriers = [];
  s.powerups = [];
  s.regen = [];
  s.roundKills = new Array(s.teams).fill(0);
  s.lastAliveT = 0;
  if (s.hurry) s.hurry = { on: false, i: 0, t: 0 };
  if (s.storm) s.storm = { on: false, radius: s.storm.maxRadius, maxRadius: s.storm.maxRadius, cx: s.w / 2, cy: s.h / 2 };
  s.timeLeft = s.config.timeLimit;
  const mods = s.config.mods ?? {};
  for (const p of s.players) {
    p.alive = p.connected;
    p.hp = p.maxHp;
    p.bombsMax = mods.startBombs ?? BOMB.startBombs;
    p.range = mods.startRange ?? BOMB.range;
    p.speedUps = RULES.startSpeedBonus;
    p.carrying = -1;
    p.heldBomb = 0;
    p.slowT = 0;
    p.slowF = 1;
    p.stunT = 0;
    p.dashT = 0;
    p.hyperT = 0;
    p.shieldT = 0;
    p.kbx = p.kby = 0;
    p.invuln = 0;
    p.dmgBy = {};
  }
  placeAllPlayers(s);
  s.phase = 'countdown';
  s.phaseT = RULES.countdown;
  s.roundWinner = -1;
  emit(s, { t: 'roundStart', n: s.round });
}

function updateHurry(s: MatchState) {
  const h = s.hurry;
  if (!h) return;
  const hurryAt = s.config.mods?.hurryAt ?? Math.min(45, s.config.timeLimit * 0.4);
  if (!h.on) {
    if (s.timeLeft <= hurryAt) {
      h.on = true;
      h.t = 0;
      emit(s, { t: 'hurry' });
    }
    return;
  }
  const order = spiralOrder(s.w, s.h);
  const interval = Math.max(0.05, hurryAt / Math.max(1, order.length * 0.9));
  h.t -= DT;
  while (h.t <= 0 && h.i < order.length) {
    h.t += interval;
    const i = order[h.i++];
    if (s.tiles[i] === Tile.Wall) continue;
    const x = i % s.w;
    const y = Math.floor(i / s.w);
    s.tiles[i] = Tile.Wall;
    s.bombs = s.bombs.filter((b) => Boolean(b.carrier || b.airDur) || !(Math.floor(b.x + 0.5) === x && Math.floor(b.y + 0.5) === y));
    s.powerups = s.powerups.filter((p) => !(p.x === x && p.y === y));
    s.doors = s.doors.filter((d) => !(d.x === x && d.y === y));
    s.conv[i] = 0;
    emit(s, { t: 'fall', x, y });
    for (const p of s.players) {
      if (p.alive && overlapsTile(p, x, y)) {
        p.invuln = 0;
        damage_(s, p, 9999, -1, 'crush');
      }
    }
  }
}

function updateStorm(s: MatchState) {
  const st = s.storm;
  if (!st || s.config.timeLimit <= 0) return;
  const stormStart = Math.min(45, s.config.timeLimit * 0.4);
  if (!st.on) {
    if (s.timeLeft <= stormStart) {
      st.on = true;
      emit(s, { t: 'storm' });
    }
    return;
  }
  const minRadius = 2.6;
  const dur = Math.max(8, stormStart * 0.85);
  const frac = Math.max(0, Math.min(1, 1 - (stormStart - s.timeLeft) / dur));
  st.radius = minRadius + (st.maxRadius - minRadius) * frac;
  const half = Math.floor((s.tick - 1) * DT * 2) !== Math.floor(s.tick * DT * 2);
  if (!half) return;
  for (const p of s.players) {
    if (!p.alive || p.invuln > 0) continue;
    if (Math.hypot(p.x - st.cx, p.y - st.cy) > st.radius) {
      damage_(s, p, RULES.stormDamagePerSec / 2, -1, 'storm');
    }
  }
}

// ---------------------------------------------------------------------------
// Tutorial (GDD sección 15)
// ---------------------------------------------------------------------------

export const TUTORIAL_STEPS = [
  { title: 'Moverse', text: 'Movete con WASD o las flechas. Llegá hasta la zona marcada.' },
  { title: 'Bombas', text: 'Poné una bomba con ESPACIO al lado del bloque de madera y alejate. ¡Rompé el bloque!' },
  { title: 'Atacar', text: 'Cada personaje tiene su ataque (tecla J). Eliminá al muñeco de práctica.' },
  { title: 'Hipercarga', text: 'Tu Hipercarga está llena: activala con la tecla K.' },
  { title: 'Tomar la bandera', text: 'Tocá la bandera roja del equipo enemigo para robarla.' },
  { title: 'Capturar', text: 'Volvé a tu base (bandera azul) para capturarla. ¡Tu bandera tiene que estar en casa!' },
  { title: '¡Listo!', text: 'Ya sabés lo básico. Cada clase juega distinto: probalas todas en Jugar.' },
];

function updateTutorial(s: MatchState) {
  const tut = s.tut;
  if (!tut) return;
  const human = s.players.find((p) => !p.bot);
  if (!human) return;
  const next = () => {
    tut.step++;
    tut.t = 0;
    emit(s, { t: 'tut', step: tut.step });
  };
  tut.t += DT;
  switch (tut.step) {
    case 0:
      if (human.x > 5.5 && tut.t > 1) next();
      break;
    case 1:
      if (human.blocks > 0) next();
      break;
    case 2:
      if (human.kills > 0) {
        next();
        human.hyper = RULES.hyperMax;
        emit(s, { t: 'hyperReady', p: human.id });
      }
      break;
    case 3:
      if (human.hyper < RULES.hyperMax) next();
      break;
    case 4:
      if (human.carrying >= 0) next();
      break;
    case 5:
      if (human.caps > 0) next();
      break;
    case 6:
      if (tut.t > 4) endMatch(s, 0);
      break;
  }
}

/** Resultado para un jugador (según equipo ganador). */
export function resultFor(s: MatchState, p: PlayerState): 'win' | 'lose' | 'draw' {
  if (s.winner === -2) return 'draw';
  if (s.winner === p.team) return 'win';
  return 'lose';
}

/** Ordena jugadores por puntos (para MVP y tablas). */
export function ranked(s: MatchState): PlayerState[] {
  return s.players.slice().sort((a, b) => b.points - a.points || b.kills - a.kills);
}
