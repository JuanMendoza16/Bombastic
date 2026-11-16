// Festival de la Gran Deflagración: modo campaña por niveles.
import type { ClassId, Difficulty, MapId, MatchMods, ModeId } from '../../shared/types';

export interface StarGoal {
  text: string;
  /** evalúa el resultado del jugador */
  check: (r: FestivalResult) => boolean;
}

export interface FestivalResult {
  won: boolean;
  kills: number;
  deaths: number;
  caps: number;
  points: number;
  time: number;
  scoreFor: number;
  scoreAgainst: number;
  blocks: number;
  assists: number;
}

export interface FestivalLevel {
  n: number;
  name: string;
  desc: string;
  mode: ModeId;
  map: MapId;
  teamSize: number;
  difficulty: Difficulty;
  timeLimit?: number;
  scoreLimit?: number;
  powerups?: boolean;
  mods?: MatchMods;
  enemyClasses?: ClassId[];
  stars: [StarGoal, StarGoal, StarGoal];
  reward: number;
}

const win: StarGoal = { text: 'Ganá la partida', check: (r) => r.won };

export const FESTIVAL: FestivalLevel[] = [
  {
    n: 1,
    name: 'Primer Encendido',
    desc: 'Tu primera prueba en el Festival: una captura de bandera tranquila en las Ruinas.',
    mode: 'ctf', map: 'ruinas', teamSize: 2, difficulty: 0, timeLimit: 180, scoreLimit: 2,
    stars: [win, { text: 'Capturá al menos 1 bandera', check: (r) => r.caps >= 1 }, { text: 'Ganá sin que te capturen', check: (r) => r.won && r.scoreAgainst === 0 }],
    reward: 100,
  },
  {
    n: 2,
    name: 'Duelo en las Ruinas',
    desc: 'Uno contra uno, sin reaparición. Mostrá lo que aprendiste.',
    mode: 'eliminacion', map: 'ruinas', teamSize: 1, difficulty: 0, scoreLimit: 2,
    stars: [win, { text: 'Hacé 2 eliminaciones', check: (r) => r.kills >= 2 }, { text: 'Ganá sin perder rondas', check: (r) => r.won && r.scoreAgainst === 0 }],
    reward: 100,
  },
  {
    n: 3,
    name: 'La Primera Zona',
    desc: 'Dominá la Zona Bombástica junto a un compañero.',
    mode: 'zona', map: 'ruinas', teamSize: 2, difficulty: 0, timeLimit: 180, scoreLimit: 60,
    stars: [win, { text: 'Hacé 3 eliminaciones', check: (r) => r.kills >= 3 }, { text: 'Ganá por 20 puntos o más', check: (r) => r.won && r.scoreFor - r.scoreAgainst >= 20 }],
    reward: 120,
  },
  {
    n: 4,
    name: 'Perdidos en el Laberinto',
    desc: 'Pasillos estrechos y bloques por todas partes: las bombas abren camino.',
    mode: 'ctf', map: 'laberinto', teamSize: 3, difficulty: 1, timeLimit: 240,
    stars: [win, { text: 'Rompé 10 bloques', check: (r) => r.blocks >= 10 }, { text: 'Capturá 2 banderas', check: (r) => r.caps >= 2 }],
    reward: 150,
  },
  {
    n: 5,
    name: 'Batalla Clásica',
    desc: 'Todos contra todos, como en los viejos tiempos. ¡Que no te encierre la muerte súbita!',
    mode: 'clasica', map: 'laberinto', teamSize: 4, difficulty: 1,
    stars: [win, { text: 'Hacé 3 eliminaciones', check: (r) => r.kills >= 3 }, { text: 'Ganá muriendo como mucho 1 vez', check: (r) => r.won && r.deaths <= 1 }],
    reward: 150,
  },
  {
    n: 6,
    name: 'Cintas y Compuertas',
    desc: 'La Fábrica no para nunca: usá las cintas para moverte rápido.',
    mode: 'ctf', map: 'fabrica', teamSize: 3, difficulty: 1,
    stars: [win, { text: 'Capturá 2 banderas', check: (r) => r.caps >= 2 }, { text: 'Ganá 3 a 0', check: (r) => r.won && r.scoreAgainst === 0 }],
    reward: 180,
  },
  {
    n: 7,
    name: 'Guerra de Zonas',
    desc: 'Tres contra tres por el control de la Fábrica.',
    mode: 'zona', map: 'fabrica', teamSize: 3, difficulty: 1,
    stars: [win, { text: 'Hacé 5 eliminaciones', check: (r) => r.kills >= 5 }, { text: 'Ganá por 30 puntos o más', check: (r) => r.won && r.scoreFor - r.scoreAgainst >= 30 }],
    reward: 180,
  },
  {
    n: 8,
    name: 'Reacción en Cadena',
    desc: 'Seis jugadores, tres bombas y mucho fuego desde el primer segundo.',
    mode: 'clasica', map: 'ruinas', teamSize: 6, difficulty: 1, mods: { startBombs: 3, startRange: 3 },
    stars: [win, { text: 'Hacé 4 eliminaciones', check: (r) => r.kills >= 4 }, { text: 'Rompé 15 bloques', check: (r) => r.blocks >= 15 }],
    reward: 200,
  },
  {
    n: 9,
    name: 'Tierra Ardiente',
    desc: 'El Volcán entra en erupción cada pocos segundos. Rivales difíciles.',
    mode: 'ctf', map: 'volcan', teamSize: 3, difficulty: 2,
    stars: [win, { text: 'Capturá 1 bandera', check: (r) => r.caps >= 1 }, { text: 'Ganá muriendo como mucho 3 veces', check: (r) => r.won && r.deaths <= 3 }],
    reward: 220,
  },
  {
    n: 10,
    name: 'Supervivientes',
    desc: 'Eliminación en el Laberinto contra un escuadrón experimentado.',
    mode: 'eliminacion', map: 'laberinto', teamSize: 3, difficulty: 2,
    stars: [win, { text: 'Hacé 5 eliminaciones', check: (r) => r.kills >= 5 }, { text: 'Ganá sin perder rondas', check: (r) => r.won && r.scoreAgainst === 0 }],
    reward: 240,
  },
  {
    n: 11,
    name: 'Hipercarga Total',
    desc: 'La Hipercarga se llena al doble de velocidad. ¡Caos garantizado!',
    mode: 'ctf', map: 'fabrica', teamSize: 3, difficulty: 2, mods: { hyperMul: 2.5 },
    stars: [win, { text: 'Hacé 6 eliminaciones', check: (r) => r.kills >= 6 }, { text: 'Capturá 2 banderas', check: (r) => r.caps >= 2 }],
    reward: 260,
  },
  {
    n: 12,
    name: 'La Gran Deflagración',
    desc: 'La final del Festival: cuatro contra cuatro en el Volcán contra la élite.',
    mode: 'ctf', map: 'volcan', teamSize: 4, difficulty: 3,
    enemyClasses: ['defensor', 'tanque', 'veloz', 'distancia'],
    stars: [win, { text: 'Capturá 2 banderas', check: (r) => r.caps >= 2 }, { text: 'Ganá sin que te capturen', check: (r) => r.won && r.scoreAgainst === 0 }],
    reward: 400,
  },
];
