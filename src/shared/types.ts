// Tipos compartidos entre la simulación, el cliente y el servidor.
// Todo el estado es "plain data" (sin clases ni Map/Set) para poder serializarlo.

/** 0 abajo, 1 arriba, 2 izquierda, 3 derecha */
export type Dir = 0 | 1 | 2 | 3;
export const DX = [0, 0, -1, 1] as const;
export const DY = [1, -1, 0, 0] as const;

export type ClassId = 'tanque' | 'veloz' | 'distancia' | 'support' | 'defensor' | 'controlador';
export const CLASS_IDS: ClassId[] = ['tanque', 'defensor', 'support', 'controlador', 'distancia', 'veloz'];

export type ModeId = 'ctf' | 'eliminacion' | 'zona' | 'clasica' | 'duelo' | 'tutorial';
export type MapId = 'ruinas' | 'laberinto' | 'fabrica' | 'volcan' | 'ruinas_chico' | 'laberinto_chico' | 'fabrica_chico' | 'tutorial';
export type Difficulty = 0 | 1 | 2 | 3; // fácil, normal, difícil, experto

export const enum Tile {
  Floor = 0,
  Wall = 1,
  Block = 2,
  Door = 3,
  Lava = 4, // suelo peligroso (volcán): se activa por ciclos
}

export type PowerUpKind = 'bomb' | 'fire' | 'speed' | 'heal' | 'hyper';

export interface PlayerSlot {
  id: number;
  name: string;
  team: number;
  cls: ClassId;
  skin: string;
  bot: boolean;
  difficulty: Difficulty;
  /** cosmético de explosión */
  fx?: string;
  /** id de usuario del backend (online) */
  userId?: number;
  /** jugador humano local (0 = P1, 1 = P2) */
  local?: number;
}

export interface MatchConfig {
  mode: ModeId;
  map: MapId;
  slots: PlayerSlot[];
  /** segundos (partida o ronda según modo) */
  timeLimit: number;
  /** capturas / rondas / puntos de zona para ganar */
  scoreLimit: number;
  powerups: boolean;
  seed: number;
  /** multiplicador de tiempo de reaparición */
  respawnMul?: number;
  /** Nivel del festival (modificadores) */
  festival?: number;
  /** modificadores especiales */
  mods?: MatchMods;
}

export interface MatchMods {
  /** daño de bombas x */
  bombDamageMul?: number;
  /** velocidad global x */
  speedMul?: number;
  /** todas las bombas empiezan con más alcance */
  startRange?: number;
  /** bombas iniciales */
  startBombs?: number;
  /** hipercarga se carga x */
  hyperMul?: number;
  /** muerte súbita desde el inicio (clásica) */
  hurryAt?: number;
  /** segundos para regeneración de bloques */
  blockRegen?: number;
}

export interface PlayerInput {
  /** dirección de movimiento (-1 = quieto) */
  dir: Dir | -1;
  /** contador de pulsaciones de bomba (flanco) */
  bomb: number;
  /** ataque mantenido */
  attack: boolean;
  /** contador de pulsaciones de hipercarga */
  hyper: number;
  /** emote (0 = ninguno) */
  emote: number;
  /** número de secuencia (red) */
  seq?: number;
}

export const EMPTY_INPUT: PlayerInput = { dir: -1, bomb: 0, attack: false, hyper: 0, emote: 0 };

export interface PlayerState {
  id: number;
  name: string;
  team: number;
  cls: ClassId;
  skin: string;
  fx: string;
  bot: boolean;
  difficulty: Difficulty;
  userId?: number;
  local?: number;

  x: number;
  y: number;
  dir: Dir;
  moving: boolean;
  /** distancia recorrida (para animación de caminar) */
  walk: number;

  hp: number;
  maxHp: number;
  alive: boolean;
  respawn: number;
  invuln: number;

  bombsMax: number;
  range: number;
  speedUps: number;

  atkCd: number;
  hyper: number;
  hyperT: number;
  dashT: number;
  slowT: number;
  slowF: number;
  stunT: number;
  kbx: number;
  kby: number;
  shieldT: number;

  carrying: number;
  /** id de la bomba agarrada actualmente (0 si no lleva ninguna) */
  heldBomb: number;

  /** timers de animación (solo visuales) */
  hurtT: number;
  atkT: number;
  castT: number;
  emote: number;
  emoteT: number;

  // estadísticas
  kills: number;
  deaths: number;
  assists: number;
  caps: number;
  returns: number;
  defends: number;
  dmg: number;
  heal: number;
  points: number;
  blocks: number;
  zoneTime: number;
  dmgAcc: number;
  healAcc: number;
  streak: number;

  /** id de jugador -> instante del último daño recibido de él */
  dmgBy: Record<string, number>;

  spawnX: number;
  spawnY: number;

  // red
  lastSeq: number;
  connected: boolean;
  // entradas previas para detectar flancos
  prevBomb: number;
  prevHyper: number;
  prevEmote: number;
  /** explosiones que ya nos dañaron (daño único por explosión) */
  exHit: number[];
}

export interface BombState {
  id: number;
  owner: number;
  team: number;
  x: number;
  y: number;
  t: number;
  fuse: number;
  range: number;
  passers: number[];
  fx: string;
  /** velocidad horizontal/vertical al ser pateada (casillas/s) */
  vx?: number;
  vy?: number;
  /** altura visual al ser lanzada o cargada */
  z?: number;
  /** estado de vuelo al ser lanzada */
  airT?: number;
  airDur?: number;
  sx?: number;
  sy?: number;
  tx?: number;
  ty?: number;
  /** id del jugador que la está cargando */
  carrier?: number;
  /** bomba pesada (no pateable por rivales) */
  heavy?: boolean;
}

export interface FlameState {
  x: number;
  y: number;
  t: number;
  life: number;
  /** id de explosión (para daño único por explosión) */
  ex: number;
  owner: number;
  team: number;
  /** forma: 0 centro, 1 horizontal, 2 vertical, 3 fin izq, 4 fin der, 5 fin arriba, 6 fin abajo */
  shape: number;
  fx: string;
}

export interface ProjState {
  id: number;
  owner: number;
  team: number;
  cls: ClassId;
  x: number;
  y: number;
  dir: Dir;
  speed: number;
  dmg: number;
  left: number;
  pierce: boolean;
  hit: number[];
}

export interface ZoneState {
  id: number;
  kind: 'heal' | 'slow';
  owner: number;
  team: number;
  x: number;
  y: number;
  r: number;
  t: number;
  life: number;
}

export interface BarrierState {
  x: number;
  y: number;
  team: number;
  owner: number;
  t: number;
}

export interface PowerUpState {
  id: number;
  x: number;
  y: number;
  kind: PowerUpKind;
  t: number;
}

export interface FlagState {
  team: number;
  /** 0 en base, 1 transportada, 2 caída */
  state: 0 | 1 | 2;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  carrier: number;
  dropT: number;
}

export interface DoorState {
  x: number;
  y: number;
  open: boolean;
  t: number;
}

export interface KothZone {
  idx: number;
  x: number;
  y: number;
  t: number;
  owner: number;
  contested: boolean;
  acc?: number;
}

export type Phase = 'countdown' | 'playing' | 'roundEnd' | 'ended';

export interface MatchState {
  config: MatchConfig;
  w: number;
  h: number;
  tiles: number[];
  conv: number[];
  regen: { i: number; t: number }[];
  doors: DoorState[];
  lavaT: number;
  lavaOn: boolean;

  time: number;
  tick: number;
  phase: Phase;
  phaseT: number;
  timeLeft: number;
  round: number;
  roundWins: number[];
  teams: number;
  scores: number[];
  teamPoints: number[];

  players: PlayerState[];
  bombs: BombState[];
  flames: FlameState[];
  projs: ProjState[];
  zones: ZoneState[];
  barriers: BarrierState[];
  powerups: PowerUpState[];
  flags: FlagState[];
  koth: KothZone | null;
  hurry: { on: boolean; i: number; t: number } | null;
  storm?: { on: boolean; radius: number; maxRadius: number; cx: number; cy: number } | null;

  /** -1 en juego, -2 empate, >=0 equipo ganador */
  winner: number;
  roundWinner: number;
  nextId: number;
  rng: number;
  exId: number;
  events: GameEvent[];
  /** eliminaciones por equipo en la ronda actual */
  roundKills?: number[];
  lastAliveT?: number;
  /** tutorial: paso actual */
  tut?: { step: number; t: number; flags: Record<string, number> };
}

export type GameEvent =
  | { t: 'bomb'; x: number; y: number; p: number }
  | { t: 'explode'; x: number; y: number; p: number; n: number; fx: string }
  | { t: 'hit'; p: number; src: number; a: number; x: number; y: number; crit?: boolean }
  | { t: 'heal'; p: number; src: number; a: number; x: number; y: number }
  | { t: 'kill'; p: number; src: number; as: number[]; how: string }
  | { t: 'attack'; p: number; cls: ClassId; dir: Dir; x: number; y: number }
  | { t: 'melee'; p: number; cls: ClassId; dir: Dir; x: number; y: number; len: number }
  | { t: 'impact'; x: number; y: number; cls: ClassId }
  | { t: 'hyper'; p: number; cls: ClassId; x: number; y: number }
  | { t: 'hyperReady'; p: number }
  | { t: 'flagTake'; team: number; p: number }
  | { t: 'flagDrop'; team: number; x: number; y: number }
  | { t: 'flagReturn'; team: number; p: number }
  | { t: 'flagCap'; team: number; p: number }
  | { t: 'power'; p: number; kind: PowerUpKind; x: number; y: number }
  | { t: 'break'; x: number; y: number }
  | { t: 'regen'; x: number; y: number }
  | { t: 'spawn'; p: number; x: number; y: number }
  | { t: 'count'; n: number }
  | { t: 'go' }
  | { t: 'roundStart'; n: number }
  | { t: 'roundEnd'; w: number }
  | { t: 'end'; w: number }
  | { t: 'zoneMove'; x: number; y: number }
  | { t: 'zoneOwner'; team: number }
  | { t: 'hurry' }
  | { t: 'fall'; x: number; y: number }
  | { t: 'emote'; p: number; e: number }
  | { t: 'door'; x: number; y: number; open: boolean }
  | { t: 'lava'; on: boolean }
  | { t: 'dash'; p: number; x: number; y: number }
  | { t: 'kick'; p: number; x: number; y: number }
  | { t: 'grab'; p: number; x: number; y: number }
  | { t: 'throw'; p: number; x: number; y: number }
  | { t: 'storm' }
  | { t: 'streak'; p: number; n: number }
  | { t: 'tut'; step: number };
