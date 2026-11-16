// Hoja de balance: todos los números del juego en un único lugar.
// Game Design puede ajustar estos valores sin tocar la lógica.
import type { ClassId, ModeId, PowerUpKind } from './types';

export type AttackKind = 'melee' | 'projectile';

export interface AttackDef {
  kind: AttackKind;
  name: string;
  damage: number;
  /** alcance en casillas */
  range: number;
  /** segundos entre ataques */
  cooldown: number;
  /** velocidad del proyectil (casillas/s) */
  speed?: number;
  knockback?: number;
  /** ralentización aplicada (multiplicador de velocidad) */
  slow?: number;
  slowTime?: number;
  /** curación a aliados alcanzados */
  healAlly?: number;
}

export interface HyperDef {
  name: string;
  desc: string;
  duration: number;
}

export interface ClassDef {
  id: ClassId;
  className: string;
  hero: string;
  role: string;
  hp: number;
  speed: number;
  attack: AttackDef;
  hyper: HyperDef;
  passive: string;
  /** barras de UI 1..5 */
  bars: { vida: number; dano: number; velocidad: number; alcance: number; control: number };
  species: string;
  origin: string;
  lore: string;
  color: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  tanque: {
    id: 'tanque',
    className: 'Tanque',
    hero: 'Cubert',
    role: 'Abrir caminos y aguantar el daño',
    hp: 210,
    speed: 3.1,
    attack: { kind: 'melee', name: 'Puñetazo de Roca Madre', damage: 32, range: 1.35, cooldown: 0.65, knockback: 7 },
    hyper: {
      name: 'Impacto',
      desc: 'Golpea el suelo: daña y empuja a todos los enemigos cercanos, rompe los bloques de alrededor y activa un escudo protector.',
      duration: 4,
    },
    passive: 'Coraza Bedrock: recibe un 25% menos de daño (incluidas bombas) y de empuje; su Hipercarga otorga un escudo que absorbe el próximo impacto.',
    bars: { vida: 5, dano: 4, velocidad: 1, alcance: 1, control: 3 },
    species: 'Cuboide Liso',
    origin: 'El Mundo Cúbico',
    lore:
      'El último de los Cuboides Lisos, ahora armado con casco táctico y martillo Bedrock. Tras la destrucción de su mundo vagó hasta el Universo Bombástico, donde lucha por sobrevivir y restaurar su hogar.',
    color: '#7ab356',
  },
  defensor: {
    id: 'defensor',
    className: 'Defensor',
    hero: 'Giga',
    role: 'Proteger la base y la bandera',
    hp: 175,
    speed: 3.45,
    attack: { kind: 'melee', name: 'Onda de Escudo', damage: 22, range: 2.2, cooldown: 0.7, knockback: 4 },
    hyper: {
      name: 'Barrera',
      desc: 'Levanta un muro de energía de 3 casillas que bloquea ataques, bombas y el paso de los enemigos. Tus aliados lo atraviesan.',
      duration: 6,
    },
    passive: 'Guardián: dentro de su propia base recibe un 25% menos de daño de ataques y bombas.',
    bars: { vida: 4, dano: 3, velocidad: 2, alcance: 2, control: 4 },
    species: 'Gólem',
    origin: 'El Planeta Terra',
    lore:
      'Un gólem de piedra y metal creado para proteger las antiguas ruinas de Terra. Busca a su creador, desaparecido hace siglos, y mientras tanto protege a quienes no pueden protegerse solos.',
    color: '#ff9d3a',
  },
  support: {
    id: 'support',
    className: 'Support',
    hero: 'Wimmi',
    role: 'Curar y proteger al equipo',
    hp: 120,
    speed: 3.9,
    attack: {
      kind: 'projectile',
      name: 'Dron Médico',
      damage: 13,
      range: 4.5,
      cooldown: 0.5,
      speed: 11,
      healAlly: 14,
    },
    hyper: {
      name: 'Zona de Recuperación',
      desc: 'Despliega sus drones: crea una zona que cura rápidamente a los aliados que estén dentro.',
      duration: 5,
    },
    passive: 'Botiquín de Campo: los aliados cercanos recuperan 3 de vida por segundo.',
    bars: { vida: 3, dano: 2, velocidad: 3, alcance: 3, control: 2 },
    species: 'Humana',
    origin: 'El Planeta Terra',
    lore:
      'Médica táctica de campo con traje sanitario de alta movilidad. Inventó drones curativos y escudos de energía y se unió al Festival para asistir a sus compañeros.',
    color: '#5dff9a',
  },
  controlador: {
    id: 'controlador',
    className: 'Controlador',
    hero: 'Vaskil',
    role: 'Controlar caminos y frenar enemigos',
    hp: 115,
    speed: 3.9,
    attack: {
      kind: 'projectile',
      name: 'Glifo Ralentizador',
      damage: 17,
      range: 4.5,
      cooldown: 0.6,
      speed: 10,
      slow: 0.65,
      slowTime: 1.6,
    },
    hyper: {
      name: 'Campo de Bloqueo',
      desc: 'Proyecta un campo cifrado que ralentiza muchísimo a los enemigos que lo atraviesan.',
      duration: 6,
    },
    passive: 'Criptografía: el fuego de sus bombas ralentiza a los enemigos alcanzados.',
    bars: { vida: 2, dano: 2, velocidad: 3, alcance: 3, control: 5 },
    species: 'Estratega astral',
    origin: 'El Planeta Zephyrus',
    lore:
      'Especialista en campos de fuerza y trampas energéticas escritas en código astral. Quiere demostrar que el control del mapa vence a la fuerza bruta.',
    color: '#c77dff',
  },
  distancia: {
    id: 'distancia',
    className: 'Distancia',
    hero: 'Rango',
    role: 'Atacar desde lejos y defender zonas abiertas',
    hp: 95,
    speed: 3.9,
    attack: { kind: 'projectile', name: 'Ballesta Táctica', damage: 26, range: 7.5, cooldown: 0.85, speed: 16 },
    hyper: {
      name: 'Disparo Perforante',
      desc: 'Durante unos segundos sus disparos atraviesan enemigos y bloques rompibles, y llegan más lejos.',
      duration: 6,
    },
    passive: 'Punta Explosiva: sus disparos hacen detonar las bombas que tocan.',
    bars: { vida: 2, dano: 4, velocidad: 3, alcance: 5, control: 2 },
    species: 'Humano',
    origin: 'El Planeta Jormungand',
    lore:
      'Francotirador veterano de mirada infalible y pañuelo naranja. Vino a demostrar que la precisión a larga distancia domina cualquier arena.',
    color: '#9be15d',
  },
  veloz: {
    id: 'veloz',
    className: 'Veloz',
    hero: 'Maira',
    role: 'Infiltrarse y robar la bandera',
    hp: 82,
    speed: 5.0,
    attack: { kind: 'melee', name: 'Chispazo', damage: 12, range: 1.6, cooldown: 0.32 },
    hyper: {
      name: 'Impulso',
      desc: 'Sale disparada hacia adelante y gana muchísima velocidad durante unos segundos.',
      duration: 4,
    },
    passive: 'Estela: al llevar la bandera no pierde velocidad.',
    bars: { vida: 1, dano: 2, velocidad: 5, alcance: 1, control: 1 },
    species: 'Humana',
    origin: 'El Planeta Zephyrus',
    lore:
      'Corredora acrobática con zapatillas propulsoras y cintas de energía. Se unió al Festival para probar que la velocidad pura roba cualquier bandera.',
    color: '#ff69b4',
  },
};

export const BOMB = {
  fuse: 2.5,
  range: 2,
  damage: 70,
  flameLife: 0.55,
  /** daño que te hacen tus propias bombas (fracción) */
  selfDamage: 0.5,
  maxBombs: 5,
  maxRange: 6,
  startBombs: 1,
  kickSpeed: 9,
  throwDist: 3,
  throwDuration: 0.32,
};

export const RULES = {
  /** radio de colisión del jugador (casillas) */
  radius: 0.38,
  respawn: 4,
  spawnInvuln: 2,
  carrierSlow: 0.85,
  flagReturnTime: 15,
  blockRegen: 25,
  powerupChance: 0.55,
  /** mejoras pasivas comunes iniciales y al reaparecer */
  startSpeedBonus: 1,
  assistWindow: 6,
  hyperMax: 100,
  /** radio (casillas) alrededor de la bandera propia para contar "defensa" */
  defendRadius: 4,
  conveyorSpeed: 2.2,
  doorOpen: 4,
  doorClosed: 3,
  zoneRadius: 1,
  zoneMoveEvery: 40,
  zoneRate: 1,
  eliminationRoundTime: 90,
  countdown: 3,
  roundEndPause: 3.5,
  speedUp: 0.1,
  maxSpeedUps: 5,
  lavaCycle: 9,
  lavaActive: 3,
  lavaDamage: 60,
  stormDamagePerSec: 28,
};

/** Puntuación (GDD sección 10) */
export const SCORE = {
  kill: 100,
  damage: 25, // cada 25 de daño
  defend: 50,
  returnFlag: 100,
  capture: 500,
  assist: 50,
  takeFlag: 50,
  support: 25, // cada 50 de curación
  zonePerSec: 10,
  roundWin: 100,
  block: 5,
};

/** Cómo se carga la Hipercarga (GDD sección 7) */
export const HYPER_GAIN = {
  perDamage: 0.34,
  perHeal: 0.4,
  kill: 20,
  assist: 10,
  defend: 15,
  takeFlag: 10,
  capture: 30,
  captureTeam: 15,
  returnFlag: 15,
  block: 1.5,
  zonePerSec: 2,
};

export const POWERUPS: Record<PowerUpKind, { name: string; desc: string; weight: number }> = {
  bomb: { name: 'Bomba extra', desc: '+1 bomba simultánea', weight: 30 },
  fire: { name: 'Fuego', desc: '+1 casilla de alcance de explosión', weight: 30 },
  speed: { name: 'Patines', desc: 'Más velocidad', weight: 18 },
  heal: { name: 'Botiquín', desc: 'Recupera 50 de vida', weight: 14 },
  hyper: { name: 'Carga', desc: '+30 de Hipercarga', weight: 8 },
};

export interface ModeDef {
  id: ModeId;
  name: string;
  short: string;
  desc: string;
  teams: boolean;
  defaultTime: number;
  defaultScore: number;
  scoreLabel: string;
  powerups: boolean;
  respawn: boolean;
  rounds: boolean;
  icon: string;
}

export const MODES: Record<ModeId, ModeDef> = {
  ctf: {
    id: 'ctf',
    name: 'Captura la Bandera',
    short: 'CTF',
    desc: 'Robá la bandera enemiga y llevala a tu base mientras defendés la tuya. Primero en 3 capturas o más capturas al terminar el tiempo.',
    teams: true,
    defaultTime: 300,
    defaultScore: 3,
    scoreLabel: 'Capturas',
    powerups: true,
    respawn: true,
    rounds: false,
    icon: 'flag',
  },
  eliminacion: {
    id: 'eliminacion',
    name: 'Eliminación',
    short: 'ELIM',
    desc: 'Rondas sin reaparición: eliminá a todo el equipo rival. Si se acaba el tiempo gana quien tenga más eliminaciones en la ronda. Primero en ganar 3 rondas.',
    teams: true,
    defaultTime: 90,
    defaultScore: 3,
    scoreLabel: 'Rondas',
    powerups: true,
    respawn: false,
    rounds: true,
    icon: 'skull',
  },
  zona: {
    id: 'zona',
    name: 'Zona Bombástica',
    short: 'ZONA',
    desc: 'Controlá la zona que se mueve por el mapa. Cada segundo que tu equipo la domine suma un punto. Primero en 100.',
    teams: true,
    defaultTime: 240,
    defaultScore: 100,
    scoreLabel: 'Puntos',
    powerups: true,
    respawn: true,
    rounds: false,
    icon: 'zone',
  },
  clasica: {
    id: 'clasica',
    name: 'Batalla Clásica',
    short: 'FFA',
    desc: 'Todos contra todos, sin reaparición y con mejoras. El último en pie gana la ronda. ¡Cuidado con la tormenta y la muerte súbita! Primero en ganar 2 rondas.',
    teams: false,
    defaultTime: 120,
    defaultScore: 2,
    scoreLabel: 'Rondas',
    powerups: true,
    respawn: false,
    rounds: true,
    icon: 'bomb',
  },
  duelo: {
    id: 'duelo',
    name: 'Duelo',
    short: 'DUELO',
    desc: 'Combate directo de rondas en mapas compactos o con tormenta progresiva en arenas grandes. El último en pie gana la ronda.',
    teams: false,
    defaultTime: 90,
    defaultScore: 3,
    scoreLabel: 'Rondas',
    powerups: true,
    respawn: false,
    rounds: true,
    icon: 'sword',
  },
  tutorial: {
    id: 'tutorial',
    name: 'Tutorial',
    short: 'TUT',
    desc: 'Aprendé a moverte, poner bombas, atacar, usar la Hipercarga y capturar la bandera.',
    teams: true,
    defaultTime: 0,
    defaultScore: 1,
    scoreLabel: 'Capturas',
    powerups: false,
    respawn: true,
    rounds: false,
    icon: 'book',
  },
};

export const TEAM_NAMES = ['Equipo Azul', 'Equipo Rojo'];
export const TEAM_COLORS = ['#3d8bff', '#ff4d5e'];
export const TEAM_COLORS_CB = ['#3d8bff', '#ff9f1c'];
export const FFA_COLORS = ['#3d8bff', '#ff4d5e', '#4ade80', '#facc15', '#c084fc', '#f97316'];

// ---------------------------------------------------------------------------
// Progresión, economía y ranking (GDD secciones 11, 12 y 14)
// ---------------------------------------------------------------------------

export const PROGRESSION = {
  xp: { played: 50, win: 100, draw: 50, capture: 40, kill: 10, assist: 5, defend: 10, returnFlag: 10, roundWin: 15 },
  coins: { played: 20, win: 30, draw: 15, capture: 10, kill: 3, perLevel: 100 },
  maxLevel: 50,
};

/** XP necesaria para pasar del nivel `level` al siguiente */
export function xpForLevel(level: number): number {
  return 150 + (level - 1) * 60;
}

export function levelFromXp(totalXp: number): { level: number; into: number; need: number } {
  let level = 1;
  let rest = totalXp;
  while (level < PROGRESSION.maxLevel && rest >= xpForLevel(level)) {
    rest -= xpForLevel(level);
    level++;
  }
  return { level, into: rest, need: xpForLevel(level) };
}

export const ELO = {
  start: 1000,
  k: 32,
  /** ajuste individual máximo según rendimiento dentro del equipo */
  perfBonus: 6,
  botRating: [850, 1050, 1250, 1450],
};

export const DIVISIONS = [
  { name: 'Bronce', min: 0, color: '#cd7f32' },
  { name: 'Plata', min: 1100, color: '#c0c7d1' },
  { name: 'Oro', min: 1300, color: '#ffd23f' },
  { name: 'Diamante', min: 1500, color: '#6ee7ff' },
];

export function divisionFor(elo: number) {
  let d = DIVISIONS[0];
  for (const div of DIVISIONS) if (elo >= div.min) d = div;
  return d;
}

export function expectedScore(a: number, b: number): number {
  return 1 / (1 + Math.pow(10, (b - a) / 400));
}

/**
 * ELO simplificado por equipos: se compara el promedio de cada equipo y se
 * ajusta levemente según el aporte (puntos) del jugador dentro de su equipo.
 */
export function eloDelta(myTeamAvg: number, otherAvg: number, result: 1 | 0.5 | 0, pointsShare: number): number {
  const exp = expectedScore(myTeamAvg, otherAvg);
  let d = ELO.k * (result - exp);
  // pointsShare: 0..1 (fracción de los puntos del equipo). 1/n es "promedio".
  d += ELO.perfBonus * (pointsShare - 0.33) * 2;
  return Math.round(d);
}

export interface MatchRewardInput {
  won: boolean;
  draw: boolean;
  kills: number;
  assists: number;
  caps: number;
  defends: number;
  returns: number;
  roundWins?: number;
}

export function computeRewards(r: MatchRewardInput): { xp: number; coins: number } {
  const X = PROGRESSION.xp;
  const C = PROGRESSION.coins;
  let xp = X.played + r.kills * X.kill + r.assists * X.assist + r.caps * X.capture + r.defends * X.defend + r.returns * X.returnFlag;
  let coins = C.played + r.kills * C.kill + r.caps * C.capture;
  if (r.won) {
    xp += X.win;
    coins += C.win;
  } else if (r.draw) {
    xp += X.draw;
    coins += C.draw;
  }
  if (r.roundWins) xp += r.roundWins * X.roundWin;
  return { xp: Math.min(xp, 600), coins: Math.min(coins, 250) };
}
