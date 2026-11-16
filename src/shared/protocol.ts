// Protocolo WebSocket entre el juego y el servidor online.
import type { MatchRewards, Profile } from './profile';
import type {
  BarrierState,
  BombState,
  ClassId,
  Difficulty,
  DoorState,
  FlagState,
  GameEvent,
  KothZone,
  MapId,
  MatchConfig,
  MatchState,
  ModeId,
  Phase,
  PlayerState,
  PowerUpState,
  ProjState,
  ZoneState,
} from './types';

export const PROTOCOL_VERSION = 1;

export interface RoomSettings {
  mode: ModeId;
  map: MapId;
  teamSize: number;
  difficulty: Difficulty;
  timeLimit: number;
  scoreLimit: number;
  powerups: boolean;
  public: boolean;
}

export interface RoomMember {
  id: number;
  name: string;
  team: number;
  cls: ClassId;
  skin: string;
  ready: boolean;
  host: boolean;
  userId?: number;
  elo?: number;
}

export interface RoomInfo {
  code: string;
  name: string;
  settings: RoomSettings;
  members: RoomMember[];
  state: 'lobby' | 'playing';
  quick: boolean;
  countdown?: number;
}

export interface RoomListItem {
  code: string;
  name: string;
  mode: ModeId;
  map: MapId;
  players: number;
  max: number;
  state: 'lobby' | 'playing';
}

/** [seq, dir, bomb, attack(0/1), hyper, emote] */
export type WireInput = [number, number, number, number, number, number];

export type ClientMsg =
  | { t: 'hello'; token?: string | null; name: string; v: number }
  | { t: 'lobby' }
  | { t: 'create'; settings: Partial<RoomSettings> }
  | { t: 'join'; code: string }
  | { t: 'quick'; mode?: ModeId }
  | { t: 'leave' }
  | { t: 'pick'; cls: ClassId; skin: string; fx: string }
  | { t: 'team'; team: number }
  | { t: 'ready'; ready: boolean }
  | { t: 'settings'; settings: Partial<RoomSettings> }
  | { t: 'start' }
  | { t: 'chat'; text: string }
  | { t: 'in'; i: WireInput[] }
  | { t: 'ping'; ts: number };

export interface MatchResult {
  winner: number;
  players: { id: number; name: string; team: number; cls: ClassId; bot: boolean; kills: number; deaths: number; assists: number; caps: number; returns: number; points: number; dmg: number }[];
}

export type ServerMsg =
  | { t: 'welcome'; conn: number; user: { id: number; username: string } | null; online: number }
  | { t: 'rooms'; rooms: RoomListItem[] }
  | { t: 'room'; room: RoomInfo | null; you: number }
  | { t: 'chat'; from: string; text: string; sys?: boolean }
  | { t: 'start'; config: MatchConfig; you: number; init: MatchState }
  | { t: 's'; s: Snapshot; ev: GameEvent[] }
  | { t: 'end'; result: MatchResult; rewards: MatchRewards | null; profile: Profile | null }
  | { t: 'error'; msg: string }
  | { t: 'pong'; ts: number };

// ---------------------------------------------------------------------------
// Snapshots compactos
// ---------------------------------------------------------------------------

export interface Snapshot {
  tick: number;
  time: number;
  phase: Phase;
  phaseT: number;
  timeLeft: number;
  round: number;
  roundWins: number[];
  scores: number[];
  teamPoints: number[];
  winner: number;
  roundWinner: number;
  lavaT: number;
  lavaOn: boolean;
  koth: KothZone | null;
  hurry: MatchState['hurry'];
  storm?: MatchState['storm'];
  tut?: MatchState['tut'];
  /** jugadores: arreglo de números (ver PLAYER_FIELDS) */
  p: number[][];
  bombs: BombState[];
  flames: number[][];
  projs: ProjState[];
  zones: ZoneState[];
  barriers: BarrierState[];
  powerups: PowerUpState[];
  flags: FlagState[];
  doors: DoorState[];
  /** casillas (solo cuando cambian) */
  tiles?: number[];
  /** último input procesado por jugador humano */
  ack: Record<number, number>;
}

const PLAYER_FIELDS = [
  'id', 'x', 'y', 'dir', 'moving', 'walk', 'hp', 'alive', 'respawn', 'invuln', 'bombsMax', 'range', 'speedUps', 'hyper', 'hyperT', 'dashT', 'slowT', 'slowF', 'stunT',
  'carrying', 'heldBomb', 'shieldT', 'hurtT', 'atkT', 'castT', 'emote', 'emoteT', 'kills', 'deaths', 'assists', 'caps', 'returns', 'defends', 'points', 'dmg', 'heal', 'blocks', 'zoneTime', 'streak', 'atkCd', 'connected', 'bot',
] as const;

const r2 = (n: number) => Math.round(n * 100) / 100;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

const FX_LIST = ['clasico', 'azul', 'toxico', 'plasma', 'dorado', 'sombra', 'arcoiris'];

export function encodeSnapshot(s: MatchState, ack: Record<number, number>, includeTiles: boolean): Snapshot {
  return {
    tick: s.tick,
    time: r2(s.time),
    phase: s.phase,
    phaseT: r2(s.phaseT),
    timeLeft: r2(s.timeLeft),
    round: s.round,
    roundWins: s.roundWins,
    scores: s.scores,
    teamPoints: s.teamPoints,
    winner: s.winner,
    roundWinner: s.roundWinner,
    lavaT: r2(s.lavaT),
    lavaOn: s.lavaOn,
    koth: s.koth,
    hurry: s.hurry,
    storm: s.storm ?? null,
    tut: s.tut,
    p: s.players.map((p) =>
      PLAYER_FIELDS.map((f) => {
        const v = (p as unknown as Record<string, number | boolean>)[f];
        if (typeof v === 'boolean') return v ? 1 : 0;
        return f === 'x' || f === 'y' ? r3(v) : r2(v);
      }),
    ),
    bombs: s.bombs.map((b) => ({ ...b, t: r2(b.t) })),
    flames: s.flames.map((f) => [f.x, f.y, r2(f.t), f.life, f.shape, f.ex, f.owner, f.team, FX_LIST.indexOf(f.fx)]),
    projs: s.projs.map((p) => ({ ...p, x: r3(p.x), y: r3(p.y) })),
    zones: s.zones,
    barriers: s.barriers,
    powerups: s.powerups,
    flags: s.flags.map((f) => ({ ...f, x: r3(f.x), y: r3(f.y), dropT: r2(f.dropT) })),
    doors: s.doors,
    tiles: includeTiles ? s.tiles : undefined,
    ack,
  };
}

/** Aplica un snapshot sobre un estado local (mismo config y jugadores). */
export function applySnapshot(s: MatchState, snap: Snapshot) {
  s.tick = snap.tick;
  s.time = snap.time;
  s.phase = snap.phase;
  s.phaseT = snap.phaseT;
  s.timeLeft = snap.timeLeft;
  s.round = snap.round;
  s.roundWins = snap.roundWins;
  s.scores = snap.scores;
  s.teamPoints = snap.teamPoints;
  s.winner = snap.winner;
  s.roundWinner = snap.roundWinner;
  s.lavaT = snap.lavaT;
  s.lavaOn = snap.lavaOn;
  s.koth = snap.koth;
  s.hurry = snap.hurry;
  if (snap.storm !== undefined) s.storm = snap.storm;
  s.tut = snap.tut;
  for (const arr of snap.p) {
    const p = s.players.find((q) => q.id === arr[0]) as unknown as Record<string, number | boolean> | undefined;
    if (!p) continue;
    PLAYER_FIELDS.forEach((f, i) => {
      if (f === 'id') return;
      const v = arr[i];
      if (f === 'moving' || f === 'alive' || f === 'connected' || f === 'bot') p[f] = v === 1;
      else p[f] = v;
    });
  }
  s.bombs = snap.bombs;
  s.flames = snap.flames.map((a) => ({ x: a[0], y: a[1], t: a[2], life: a[3], shape: a[4], ex: a[5], owner: a[6], team: a[7], fx: FX_LIST[a[8]] ?? 'clasico' }));
  s.projs = snap.projs;
  s.zones = snap.zones;
  s.barriers = snap.barriers;
  s.powerups = snap.powerups;
  s.flags = snap.flags;
  s.doors = snap.doors;
  if (snap.tiles) s.tiles = snap.tiles;
}

/** Estado inicial "liviano" para enviar al empezar. */
export function initState(s: MatchState): MatchState {
  return { ...s, events: [], players: s.players.map((p) => ({ ...p, dmgBy: {}, exHit: [] }) as PlayerState) };
}
