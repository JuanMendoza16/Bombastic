// Mapas del juego (GDD sección 8).
// Cada mapa competitivo se define por su mitad izquierda (14 columnas, la
// última es la columna central) y se refleja para garantizar simetría.
//
// Leyenda:
//   #  pared indestructible        .  suelo
//   b  bloque destructible         A  bandera/base del equipo Azul (B al reflejar)
//   1  aparición equipo Azul (2)   x  aparición de Batalla Clásica
//   z  punto de Zona Bombástica    D  compuerta (se abre y cierra)
//   > < ^ v  cinta transportadora  ~  grieta de lava (volcán)
import { Tile, type MapId } from './types';

export type Theme = 'ruinas' | 'laberinto' | 'fabrica' | 'volcan' | 'tutorial';

export interface MapDef {
  id: MapId;
  name: string;
  desc: string;
  theme: Theme;
  /** filas completas (ya reflejadas) */
  rows: string[];
  recommended: string;
  hidden?: boolean;
}

const MIRROR: Record<string, string> = { A: 'B', B: 'A', '1': '2', '2': '1', '>': '<', '<': '>' };

function mirror(half: string[]): string[] {
  const hw = half[0]?.length ?? 14;
  return half.map((row) => {
    if (row.length !== hw) throw new Error(`Fila de mapa inválida (${row.length}): ${row}`);
    const left = row.slice(0, hw - 1);
    const center = row[hw - 1];
    const right = left
      .split('')
      .reverse()
      .map((c) => MIRROR[c] ?? c)
      .join('');
    return left + center + right;
  });
}

export const MAPS: Record<MapId, MapDef> = {
  ruinas: {
    id: 'ruinas',
    name: 'Ruinas',
    theme: 'ruinas',
    desc: 'Mapa equilibrado con amplios corredores, cobertura táctica y múltiples rutas hacia la bandera.',
    recommended: 'Ideal para empezar. Todas las clases.',
    rows: mirror([
      '##############',
      '#x...b....b..x',
      '#.#.#...#b#..#',
      '#..b....b....z',
      '#.#.##b.#..#..',
      '#1.1..b....b..',
      '#..b#...#b.#..',
      '#.A..b...b...z',
      '#..b#...#b.#..',
      '#1.1..b....b..',
      '#.#.##b.#..#..',
      '#..b....b....z',
      '#.#.#...#b#..#',
      '#x...b....b..x',
      '##############',
    ]),
  },
  laberinto: {
    id: 'laberinto',
    name: 'Laberinto',
    theme: 'laberinto',
    desc: 'Corredores definidos, muros estratégicos y centro despejado donde las bombas abren atajos clave.',
    recommended: 'Favorece a Tanque, Defensor y Controlador.',
    rows: mirror([
      '##############',
      '#x..#..b...#.x',
      '#.#.#b.##..#..',
      '#...b....#b..z',
      '#.##b.#..#..#.',
      '#1....#..b....',
      '##..#b.#..##..',
      '#.A..b...b...z',
      '##..#b.#..##..',
      '#1....#..b....',
      '#.##b.#..#..#.',
      '#...b....#b..z',
      '#.#.#b.##..#..',
      '#x..#..b...#.x',
      '##############',
    ]),
  },
  fabrica: {
    id: 'fabrica',
    name: 'Fábrica',
    theme: 'fabrica',
    desc: 'Arena industrial abierta con cintas transportadoras, compuertas dinámicas y largas líneas de tiro.',
    recommended: 'Favorece a Veloz y Distancia.',
    rows: mirror([
      '##############',
      '#x..b.>>>>...x',
      '#.##...b...##.',
      '#..b..##D##..z',
      '#...b.v..b...b',
      '#1....v..#b...',
      '#..#b.v..#..b.',
      '#.A..bD..b...z',
      '#..#b.^..#..b.',
      '#1....^..#b...',
      '#...b.^..b...b',
      '#..b..##D##..z',
      '#.##...b...##.',
      '#x..b.<<<<...x',
      '##############',
    ]),
  },
  volcan: {
    id: 'volcan',
    name: 'Volcán',
    theme: 'volcan',
    desc: 'Arena de roca volcánica con grietas de lava activas y corredores abiertos de alto riesgo.',
    recommended: 'Mapa bonus. Para jugadores con experiencia.',
    rows: mirror([
      '##############',
      '#x..b....~b..x',
      '#.#.#...#b#..#',
      '#..b~..b....~z',
      '#.#...#~#..b#.',
      '#1.1..b...~b..',
      '#..b#...#b.#..',
      '#.A..b.~..b..z',
      '#..b#...#b.#..',
      '#1.1..b...~b..',
      '#.#...#~#..b#.',
      '#..b~..b....~z',
      '#.#.#...#b#..#',
      '#x..b....~b..x',
      '##############',
    ]),
  },
  ruinas_chico: {
    id: 'ruinas_chico',
    name: 'Ruinas (Duelo)',
    theme: 'ruinas',
    desc: 'Versión compacta (15×11) de Ruinas con centro abierto para duelos rápidos e intensos.',
    recommended: 'Ideal para Duelo 1v1 y 2v2.',
    rows: mirror([
      '########',
      '#x..b...',
      '#.#.#b..',
      '#1.b...z',
      '#.#b....',
      '#A..b..z',
      '#.#b....',
      '#1.b...z',
      '#.#.#b..',
      '#x..b...',
      '########',
    ]),
  },
  laberinto_chico: {
    id: 'laberinto_chico',
    name: 'Laberinto (Duelo)',
    theme: 'laberinto',
    desc: 'Versión compacta (15×11) de Laberinto Oscuro con cobertura lateral y plaza central despejada.',
    recommended: 'Ideal para Duelo táctico.',
    rows: mirror([
      '########',
      '#x.#b...',
      '#.#b.#..',
      '#1..b..z',
      '#.##....',
      '#A..b..z',
      '#.##....',
      '#1..b..z',
      '#.#b.#..',
      '#x.#b...',
      '########',
    ]),
  },
  fabrica_chico: {
    id: 'fabrica_chico',
    name: 'Fábrica (Duelo)',
    theme: 'fabrica',
    desc: 'Versión compacta (15×11) de Fábrica con cintas laterales, compuertas y centro amplio.',
    recommended: 'Ideal para Duelo dinámico.',
    rows: mirror([
      '########',
      '#x.>>b..',
      '#.#b.#..',
      '#1.vD..z',
      '#.bv....',
      '#A.D.b.z',
      '#.b^....',
      '#1.^D..z',
      '#.#b.#..',
      '#x.<<b..',
      '########',
    ]),
  },
  tutorial: {
    id: 'tutorial',
    name: 'Campo de Entrenamiento',
    theme: 'tutorial',
    desc: 'Mapa del tutorial.',
    recommended: '',
    hidden: true,
    rows: [
      '#####################',
      '#.........#.........#',
      '#.#.#.#...#...#.#.#.#',
      '#1........b.........#',
      '#.#.#.#...#...#.#.#.#',
      '#.A.......b.......B.#',
      '#.#.#.#...#...#.#.#.#',
      '#.........b...2.....#',
      '#.#.#.#...#...#.#.#.#',
      '#.........#.........#',
      '#####################',
    ],
  },
};

export const MAP_ORDER: MapId[] = ['ruinas', 'laberinto', 'fabrica', 'volcan', 'ruinas_chico', 'laberinto_chico', 'fabrica_chico'];

export interface ParsedMap {
  id: MapId;
  w: number;
  h: number;
  tiles: number[];
  /** 0 sin cinta, 1 abajo, 2 arriba, 3 izquierda, 4 derecha (dir+1) */
  conv: number[];
  flags: { x: number; y: number }[];
  spawns: { x: number; y: number }[][];
  ffa: { x: number; y: number }[];
  zones: { x: number; y: number }[];
  doors: { x: number; y: number }[];
}

const cache = new Map<MapId, ParsedMap>();

export function parseMap(id: MapId): ParsedMap {
  const hit = cache.get(id);
  if (hit) return hit;
  const def = MAPS[id];
  const h = def.rows.length;
  const w = def.rows[0].length;
  const tiles: number[] = new Array(w * h).fill(Tile.Floor);
  const conv: number[] = new Array(w * h).fill(0);
  const flags: { x: number; y: number }[] = [
    { x: 1, y: 1 },
    { x: w - 2, y: h - 2 },
  ];
  const spawns: { x: number; y: number }[][] = [[], []];
  const ffa: { x: number; y: number }[] = [];
  const zones: { x: number; y: number }[] = [];
  const doors: { x: number; y: number }[] = [];
  for (let y = 0; y < h; y++) {
    const row = def.rows[y];
    if (row.length !== w) throw new Error(`Mapa ${id}: fila ${y} con ancho distinto`);
    for (let x = 0; x < w; x++) {
      const c = row[x];
      const i = y * w + x;
      switch (c) {
        case '#':
          tiles[i] = Tile.Wall;
          break;
        case 'b':
          tiles[i] = Tile.Block;
          break;
        case 'A':
          flags[0] = { x, y };
          break;
        case 'B':
          flags[1] = { x, y };
          break;
        case '1':
          spawns[0].push({ x, y });
          break;
        case '2':
          spawns[1].push({ x, y });
          break;
        case 'x':
          ffa.push({ x, y });
          break;
        case 'z':
          zones.push({ x, y });
          break;
        case 'D':
          doors.push({ x, y });
          break;
        case 'v':
          conv[i] = 1;
          break;
        case '^':
          conv[i] = 2;
          break;
        case '<':
          conv[i] = 3;
          break;
        case '>':
          conv[i] = 4;
          break;
        case '~':
          tiles[i] = Tile.Lava;
          break;
        case '.':
          break;
        default:
          throw new Error(`Mapa ${id}: carácter desconocido '${c}'`);
      }
    }
  }
  // Orden de zonas: la central primero.
  zones.sort((a, b) => Math.abs(a.y - h / 2) - Math.abs(b.y - h / 2));
  const parsed: ParsedMap = { id, w, h, tiles, conv, flags, spawns, ffa, zones, doors };
  cache.set(id, parsed);
  return parsed;
}

/** Orden en espiral (de afuera hacia adentro) para la muerte súbita. */
const spiralCache = new Map<string, number[]>();
export function spiralOrder(w: number, h: number): number[] {
  const key = `${w}x${h}`;
  const hit = spiralCache.get(key);
  if (hit) return hit;
  const out: number[] = [];
  let x0 = 1,
    y0 = 1,
    x1 = w - 2,
    y1 = h - 2;
  while (x0 <= x1 && y0 <= y1) {
    for (let x = x0; x <= x1; x++) out.push(y0 * w + x);
    for (let y = y0 + 1; y <= y1; y++) out.push(y * w + x1);
    if (y0 < y1) for (let x = x1 - 1; x >= x0; x--) out.push(y1 * w + x);
    if (x0 < x1) for (let y = y1 - 1; y > y0; y--) out.push(y * w + x0);
    x0++;
    y0++;
    x1--;
    y1--;
  }
  spiralCache.set(key, out);
  return out;
}
