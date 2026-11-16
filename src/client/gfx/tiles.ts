// Tiles de escenario y objetos (bombas, llamas, mejoras, banderas) en pixel art procedural.
import type { PowerUpKind } from '../../shared/types';
import type { Theme } from '../../shared/maps';
import { PixelCanvas, rgba, hash2, darken, lighten, mix, withAlpha } from './pixel';

export const T = 32;
const OUT = rgba('#1a1026');

let tilesVer = 0;
let ruinasBooted = false;
const ruinasImgs = new Map<string, HTMLCanvasElement>();
const RUINAS_FILES = [
  'stone.png',
  'stone-path.png',
  'path_1.png',
  'path_2.png',
  'flower_rose.png',
  'flower_white.png',
  'oneflowerorange.png',
  'pillar_regular.png',
  'pillar_stone_broke_creeper.png',
  'pillar_stone_broke_creeper_2.png',
  'rock_creeper.png',
  'rock_plant.png',
  'rock_regular.png',
  'box_wood.png',
  'box.png',
] as const;

const RUINAS_FLOOR_SET = new Set(['stone.png', 'stone-path.png', 'path_1.png', 'path_2.png']);

const RUINAS_WALL_SET = new Set([
  'pillar_regular.png',
  'pillar_stone_broke_creeper.png',
  'pillar_stone_broke_creeper_2.png',
  'rock_creeper.png',
  'rock_plant.png',
  'rock_regular.png',
]);

const RUINAS_BLOCK_SET = new Set(['box_wood.png', 'box.png']);

function drawAnchorRivet(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#140e1f';
  ctx.fillRect(x, y, 3, 3);
  ctx.fillStyle = '#8b9cb8';
  ctx.fillRect(x, y, 2, 2);
  ctx.fillStyle = '#e2edff';
  ctx.fillRect(x, y, 1, 1);
}

export function tileVersion(): number {
  return tilesVer;
}

export function preloadTiles(onReady?: () => void) {
  if (ruinasBooted || typeof window === 'undefined' || typeof Image === 'undefined') return;
  ruinasBooted = true;
  for (const name of RUINAS_FILES) {
    const img = new Image();
    img.onload = () => {
      const cv = document.createElement('canvas');
      cv.width = T;
      cv.height = T;
      const ctx = cv.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      if (RUINAS_WALL_SET.has(name)) {
        // Muro irrompible: bloque macizo completo 32x32 con zócalo de acero/piedra y remaches en las esquinas
        ctx.fillStyle = '#140f1d';
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = '#2d2838';
        ctx.fillRect(1, 1, T - 2, T - 4);
        ctx.drawImage(img, 1, 0, T - 2, T - 3);
        ctx.fillStyle = 'rgba(20, 15, 29, 0.55)';
        ctx.fillRect(0, T - 4, T, 4);
        ctx.fillStyle = 'rgba(220, 232, 248, 0.25)';
        ctx.fillRect(1, 1, T - 2, 1);
        drawAnchorRivet(ctx, 2, 2);
        drawAnchorRivet(ctx, T - 5, 2);
        drawAnchorRivet(ctx, 2, T - 6);
        drawAnchorRivet(ctx, T - 5, T - 6);
      } else if (RUINAS_BLOCK_SET.has(name)) {
        // Bloque rompible: caja embutida 26x26 (se ve el piso alrededor), tinte cálido ámbar, cruz X y grieta frágil
        ctx.fillStyle = 'rgba(18, 10, 26, 0.38)';
        ctx.fillRect(4, 27, 25, 4);

        const tmp = document.createElement('canvas');
        tmp.width = 24;
        tmp.height = 24;
        const tctx = tmp.getContext('2d')!;
        tctx.imageSmoothingEnabled = false;
        tctx.drawImage(img, 0, 0, 24, 24);
        if (name === 'box.png') {
          // Unificar la caja gris con tinte cálido de madera para diferenciarla de las rocas irrompibles
          tctx.globalCompositeOperation = 'source-atop';
          tctx.fillStyle = 'rgba(228, 134, 44, 0.45)';
          tctx.fillRect(0, 0, 24, 24);
          tctx.globalCompositeOperation = 'source-over';
        }

        ctx.fillStyle = '#1a1026';
        ctx.fillRect(3, 2, 26, 26);
        ctx.drawImage(tmp, 4, 3, 24, 24);

        // Borde cálido destacado arriba/izquierda y sombra abajo/derecha
        ctx.fillStyle = '#ffd257';
        ctx.fillRect(4, 3, 24, 1);
        ctx.fillRect(4, 3, 1, 24);
        ctx.fillStyle = '#733814';
        ctx.fillRect(4, 26, 24, 1);
        ctx.fillRect(27, 3, 1, 24);

        // Bandas diagonales en X de caja rompible + grieta central
        for (let d = 0; d < 18; d++) {
          ctx.fillStyle = '#6b3212';
          ctx.fillRect(6 + d, 5 + d, 2, 2);
          ctx.fillRect(23 - d, 5 + d, 2, 2);
          if (d % 2 === 0) {
            ctx.fillStyle = '#f4a24c';
            ctx.fillRect(6 + d, 5 + d, 1, 1);
          }
        }
        // Grieta central luminosa de fragilidad
        ctx.fillStyle = '#1a1026';
        ctx.fillRect(15, 9, 2, 4);
        ctx.fillRect(14, 13, 3, 3);
        ctx.fillRect(16, 16, 2, 4);
        ctx.fillStyle = '#ffe57f';
        ctx.fillRect(15, 10, 1, 2);
        ctx.fillRect(14, 13, 1, 2);
      } else if (RUINAS_FLOOR_SET.has(name)) {
        // Piso más luminoso y suave para separar visualmente personajes, bloques y muros
        ctx.drawImage(img, 0, 0, T, T);
        ctx.fillStyle = 'rgba(252, 241, 210, 0.44)';
        ctx.fillRect(0, 0, T, T);
        ctx.fillStyle = 'rgba(255, 250, 235, 0.28)';
        ctx.fillRect(0, 0, T, 1);
        ctx.fillRect(0, 0, 1, T);
        ctx.fillStyle = 'rgba(180, 155, 115, 0.22)';
        ctx.fillRect(0, T - 1, T, 1);
        ctx.fillRect(T - 1, 0, 1, T);
      } else {
        ctx.drawImage(img, 0, 0, T, T);
      }
      ruinasImgs.set(name, cv);
      tilesVer++;
      onReady?.();
    };
    img.src = `/assets/nueva-version/tiles/ruinas/${name}`;
  }
}

export function ruinasSprite(kind: 'floor' | 'wall' | 'block', x: number, y: number): HTMLCanvasElement | null {
  preloadTiles();
  const h = hash2(x, y, kind === 'floor' ? 11 : kind === 'wall' ? 23 : 37);
  if (kind === 'floor') {
    const baseName = h > 0.86 ? 'stone-path.png' : h > 0.72 ? 'path_1.png' : h > 0.58 ? 'path_2.png' : 'stone.png';
    return ruinasImgs.get(baseName) ?? null;
  }
  if (kind === 'wall') {
    const list = ['pillar_regular.png', 'pillar_stone_broke_creeper.png', 'pillar_stone_broke_creeper_2.png', 'rock_creeper.png', 'rock_plant.png', 'rock_regular.png'];
    return ruinasImgs.get(list[Math.floor(h * list.length) % list.length]) ?? null;
  }
  return ruinasImgs.get(h > 0.45 ? 'box_wood.png' : 'box.png') ?? null;
}

export function ruinasFloorFlower(x: number, y: number): HTMLCanvasElement | null {
  const h = hash2(x, y, 53);
  if (h < 0.89) return null;
  const name = h > 0.96 ? 'flower_rose.png' : h > 0.925 ? 'flower_white.png' : 'oneflowerorange.png';
  return ruinasImgs.get(name) ?? null;
}

export interface ThemePal {
  floor: [string, string];
  floorDetail: string;
  floorDetail2: string;
  deco: string;
  wallTop: [string, string, string];
  wallFace: [string, string];
  wallDetail: string;
  block: [string, string, string, string];
  blockDetail: string;
  bg: string;
  shadow: string;
}

export const THEMES: Record<Theme, ThemePal> = {
  ruinas: {
    floor: ['#efe2c2', '#e6d6b0'],
    floorDetail: '#d1be93',
    floorDetail2: '#f7eed6',
    deco: '#74b04e',
    wallTop: ['#c8c1b3', '#a39b8c', '#857d6e'],
    wallFace: ['#655d50', '#443e35'],
    wallDetail: '#6f9e3c',
    block: ['#f0a86a', '#d9844a', '#b0612f', '#7f4220'],
    blockDetail: '#6b3518',
    bg: '#2b2233',
    shadow: '#5a4a38',
  },
  laberinto: {
    floor: ['#ece6cc', '#e2dbb9'],
    floorDetail: '#c9bf97',
    floorDetail2: '#f6f2df',
    deco: '#ff7ab6',
    wallTop: ['#6cc45a', '#4fa244', '#3b8434'],
    wallFace: ['#2f6d29', '#1f4d1c'],
    wallDetail: '#9be07f',
    block: ['#e0a764', '#c8864a', '#a06533', '#6f4420'],
    blockDetail: '#5a3417',
    bg: '#1f2a24',
    shadow: '#4e5a3a',
  },
  fabrica: {
    floor: ['#b8c2cf', '#aeb8c6'],
    floorDetail: '#94a0b0',
    floorDetail2: '#cdd6e2',
    deco: '#f2c230',
    wallTop: ['#c3cbd6', '#a3adba', '#8a95a3'],
    wallFace: ['#5d6674', '#3e4550'],
    wallDetail: '#f2c230',
    block: ['#e3c088', '#c9a064', '#a47d47', '#6f5330'],
    blockDetail: '#efe0b3',
    bg: '#1c2029',
    shadow: '#3e4550',
  },
  volcan: {
    floor: ['#b59e96', '#aa928a'],
    floorDetail: '#8f7770',
    floorDetail2: '#c8b3ab',
    deco: '#ff6a2a',
    wallTop: ['#4a3f55', '#342b3d', '#261f2e'],
    wallFace: ['#1c1622', '#110d15'],
    wallDetail: '#ff7a2a',
    block: ['#a5705a', '#855440', '#643b2c', '#43261c'],
    blockDetail: '#ffb13b',
    bg: '#170f14',
    shadow: '#2b1f25',
  },
  tutorial: {
    floor: ['#d4e2f0', '#c8d8e8'],
    floorDetail: '#adc0d4',
    floorDetail2: '#e6eff8',
    deco: '#ffd23f',
    wallTop: ['#8c9fbd', '#7185a6', '#5d7091'],
    wallFace: ['#465775', '#33415a'],
    wallDetail: '#ffd23f',
    block: ['#e0a764', '#c8864a', '#a06533', '#6f4420'],
    blockDetail: '#5a3417',
    bg: '#1d2433',
    shadow: '#6a7b93',
  },
};

// ---------------------------------------------------------------------------
// Suelo
// ---------------------------------------------------------------------------

export function floorTile(theme: Theme, x: number, y: number): PixelCanvas {
  const p = THEMES[theme];
  const pc = new PixelCanvas(T, T);
  const checker = (x + y) % 2;
  const base = rgba(p.floor[checker]);
  pc.rect(0, 0, T, T, base);
  const d1 = rgba(p.floorDetail);
  const d2 = rgba(p.floorDetail2);
  switch (theme) {
    case 'ruinas': {
      // losas de piedra con juntas
      pc.hline(0, T - 1, 0, d1);
      pc.vline(0, 0, T - 1, d1);
      if (hash2(x, y, 1) > 0.5) pc.hline(1, 15, 16, d1);
      else pc.vline(16, 1, 15, d1);
      for (let i = 0; i < 18; i++) {
        const px = Math.floor(hash2(x * 31 + i, y, 2) * T);
        const py = Math.floor(hash2(x, y * 31 + i, 3) * T);
        pc.set(px, py, i % 3 ? d1 : d2);
      }
      if (hash2(x, y, 4) > 0.8) {
        // grieta
        let cx = 6 + Math.floor(hash2(x, y, 5) * 18);
        let cy = 6 + Math.floor(hash2(x, y, 6) * 18);
        for (let k = 0; k < 7; k++) {
          pc.set(cx, cy, d1);
          cx += hash2(x + k, y, 7) > 0.5 ? 1 : 0;
          cy += 1;
        }
      }
      if (hash2(x, y, 8) > 0.82) grassTuft(pc, 4 + Math.floor(hash2(x, y, 9) * 22), 8 + Math.floor(hash2(x, y, 10) * 20), p.deco);
      break;
    }
    case 'laberinto': {
      // grava con piedritas
      for (let i = 0; i < 26; i++) {
        const px = Math.floor(hash2(x * 17 + i, y, 2) * T);
        const py = Math.floor(hash2(x, y * 17 + i, 3) * T);
        pc.set(px, py, i % 2 ? d1 : d2);
        if (i % 5 === 0) pc.set(px + 1, py, d1);
      }
      if (hash2(x, y, 8) > 0.86) flower(pc, 6 + Math.floor(hash2(x, y, 9) * 20), 6 + Math.floor(hash2(x, y, 10) * 20), p.deco);
      break;
    }
    case 'fabrica': {
      // placas metálicas con remaches y juntas
      pc.rect(0, 0, T, 1, d1);
      pc.rect(0, 0, 1, T, d1);
      pc.hline(1, T - 1, 1, d2);
      pc.vline(1, 1, T - 1, d2);
      for (const [rx, ry] of [
        [4, 4],
        [27, 4],
        [4, 27],
        [27, 27],
      ]) {
        pc.set(rx, ry, d2);
        pc.set(rx + 1, ry + 1, d1);
      }
      // rombos antideslizantes
      for (let j = 8; j < 26; j += 6)
        for (let i = 8 + ((j / 6) % 2) * 3; i < 26; i += 6) {
          pc.set(i, j, d2);
          pc.set(i + 1, j + 1, d1);
        }
      break;
    }
    case 'volcan': {
      for (let i = 0; i < 22; i++) {
        const px = Math.floor(hash2(x * 13 + i, y, 2) * T);
        const py = Math.floor(hash2(x, y * 13 + i, 3) * T);
        pc.set(px, py, i % 2 ? d1 : d2);
      }
      if (hash2(x, y, 4) > 0.7) {
        const ex = Math.floor(hash2(x, y, 5) * 28) + 2;
        const ey = Math.floor(hash2(x, y, 6) * 28) + 2;
        pc.set(ex, ey, rgba(p.deco));
        pc.set(ex + 1, ey, rgba('#ffb13b', 160));
      }
      break;
    }
    case 'tutorial': {
      pc.hline(0, T - 1, 0, d1);
      pc.vline(0, 0, T - 1, d1);
      pc.hline(0, T - 1, 16, rgba(p.floorDetail, 90));
      pc.vline(16, 0, T - 1, rgba(p.floorDetail, 90));
      break;
    }
  }
  return pc;
}

function grassTuft(pc: PixelCanvas, x: number, y: number, c: string) {
  const g = rgba(c);
  const g2 = rgba(darken(c, 0.25));
  pc.set(x, y, g2);
  pc.set(x + 1, y - 1, g);
  pc.set(x + 2, y, g2);
  pc.set(x + 3, y - 2, g);
  pc.set(x + 3, y - 1, g);
  pc.set(x + 4, y, g2);
  pc.set(x - 1, y - 1, g);
}

function flower(pc: PixelCanvas, x: number, y: number, c: string) {
  const pet = rgba(c);
  pc.set(x, y - 1, pet);
  pc.set(x - 1, y, pet);
  pc.set(x + 1, y, pet);
  pc.set(x, y + 1, pet);
  pc.set(x, y, rgba('#ffe94d'));
  pc.set(x + 1, y + 2, rgba('#4fa244'));
}

// ---------------------------------------------------------------------------
// Paredes y bloques (vista 3/4: cara superior + frente)
// ---------------------------------------------------------------------------

const FACE = 9;

export function wallTile(theme: Theme, x: number, y: number, solidBelow: boolean): PixelCanvas {
  const p = THEMES[theme];
  const pc = new PixelCanvas(T, T);
  const topH = solidBelow ? T : T - FACE;
  const [tl, tb, ts] = p.wallTop.map((c) => rgba(c));
  pc.rect(0, 0, T, topH, tb);
  const fd = rgba(p.wallFace[0]);
  const fdd = rgba(p.wallFace[1]);
  if (!solidBelow) {
    pc.rect(0, topH, T, FACE, fd);
    pc.hline(0, T - 1, T - 1, fdd);
    pc.hline(0, T - 1, topH, fdd);
  }
  switch (theme) {
    case 'ruinas': {
      // bloques de arenisca
      pc.hline(0, T - 1, 0, tl);
      pc.vline(0, 0, topH - 1, tl);
      pc.vline(T - 1, 0, topH - 1, ts);
      const rows = solidBelow ? 4 : 3;
      for (let r = 1; r < rows; r++) pc.hline(1, T - 2, Math.floor((topH * r) / rows), ts);
      for (let r = 0; r < rows; r++) {
        const off = r % 2 ? 8 : 20;
        const y0 = Math.floor((topH * r) / rows) + 1;
        const y1 = Math.floor((topH * (r + 1)) / rows) - 1;
        pc.vline(off, y0, y1, ts);
      }
      if (hash2(x, y, 3) > 0.55) {
        // musgo
        const mx = Math.floor(hash2(x, y, 4) * 20) + 2;
        const moss = rgba(p.wallDetail);
        pc.rect(mx, 1, 6, 2, moss);
        pc.rect(mx + 1, 3, 3, 1, moss);
        pc.set(mx + 2, 4, moss);
      }
      if (!solidBelow) {
        for (let i = 4; i < T; i += 8) pc.vline(i, topH + 1, T - 2, fdd);
      }
      break;
    }
    case 'laberinto': {
      // seto con hojas
      for (let j = 0; j < topH; j++)
        for (let i = 0; i < T; i++) {
          const h = hash2(x * 32 + i, y * 32 + j, 5);
          if (h > 0.82) pc.set(i, j, tl);
          else if (h < 0.14) pc.set(i, j, ts);
        }
      for (let k = 0; k < 6; k++) {
        const lx = Math.floor(hash2(x, y * 7 + k, 6) * 28) + 2;
        const ly = Math.floor(hash2(x * 7 + k, y, 7) * (topH - 4)) + 2;
        pc.set(lx, ly, rgba(p.wallDetail));
        pc.set(lx + 1, ly, rgba(p.wallDetail));
      }
      pc.hline(0, T - 1, 0, tl);
      if (!solidBelow) {
        for (let i = 0; i < T; i++) {
          if (hash2(x * 32 + i, y, 8) > 0.5) pc.set(i, topH, tb);
          if (hash2(x * 32 + i, y, 9) > 0.7) pc.set(i, topH + 2 + Math.floor(hash2(i, y, 1) * 5), fdd);
        }
        if (hash2(x, y, 10) > 0.7) flower(pc, 6 + Math.floor(hash2(x, y, 11) * 20), topH + 4, '#ff7ab6');
      }
      break;
    }
    case 'fabrica': {
      pc.box(0, 0, T, topH, [p.wallTop[0], p.wallTop[1], p.wallTop[2], p.wallTop[2]], 0);
      pc.rect(4, 4, T - 8, topH - 8, rgba(lighten(p.wallTop[1], 0.08)));
      pc.hline(4, T - 5, 4, tl);
      for (const [rx, ry] of [
        [2, 2],
        [T - 3, 2],
        [2, topH - 3],
        [T - 3, topH - 3],
      ])
        pc.set(rx, ry, ts);
      // tubería
      if (hash2(x, y, 2) > 0.5) {
        pc.rect(8, 8, T - 16, 3, rgba('#6c7684'));
        pc.hline(8, T - 9, 8, rgba('#a3adba'));
      } else {
        pc.rect(T / 2 - 3, 7, 6, 6, rgba('#3e4550'));
        pc.set(T / 2, 10, rgba((x + y) % 2 ? '#3cff9a' : '#ff3b3b'));
      }
      if (!solidBelow) {
        // franja de peligro
        for (let i = 0; i < T; i++) {
          const stripe = Math.floor((i + (T - topH)) / 4) % 2 === 0;
          pc.vline(i, topH + 2, T - 3, rgba(stripe ? p.wallDetail : '#23252b'));
        }
      }
      break;
    }
    case 'volcan': {
      for (let j = 0; j < topH; j++)
        for (let i = 0; i < T; i++) {
          const h = hash2(x * 32 + i, y * 32 + j, 5);
          if (h > 0.9) pc.set(i, j, tl);
          else if (h < 0.1) pc.set(i, j, ts);
        }
      pc.hline(0, T - 1, 0, tl);
      // grietas de magma
      let cx = Math.floor(hash2(x, y, 3) * 20) + 6;
      let cy = 2;
      const mag = rgba(p.wallDetail);
      for (let k = 0; k < topH - 4; k++) {
        pc.set(cx, cy, mag);
        cy++;
        cx += hash2(x, y + k, 4) > 0.66 ? 1 : hash2(x, y + k, 4) < 0.33 ? -1 : 0;
      }
      if (!solidBelow) {
        pc.hline(3, T - 4, topH + 3, rgba(p.wallDetail, 110));
      }
      break;
    }
    case 'tutorial': {
      pc.box(0, 0, T, topH, [p.wallTop[0], p.wallTop[1], p.wallTop[2], p.wallTop[2]], 1);
      pc.rect(10, 6, 12, Math.max(2, topH - 12), rgba(p.wallTop[2]));
      if (!solidBelow) {
        for (let i = 0; i < T; i += 8) pc.rect(i, topH + 3, 4, 3, rgba(p.wallDetail));
      }
      break;
    }
  }
  // Marco reforzado y remaches de anclaje para que el muro irrompible sea inconfundible
  const frameDark = rgba('#140c1e');
  const rivetFill = rgba('#9fb0c9');
  const rivetHi = rgba('#eef5ff');
  pc.hline(0, T - 1, 0, frameDark);
  pc.vline(0, 0, T - 1, frameDark);
  pc.vline(T - 1, 0, T - 1, frameDark);
  if (!solidBelow) pc.hline(0, T - 1, T - 1, frameDark);
  const ryBottom = Math.max(5, topH - 5);
  for (const [rx, ry] of [
    [2, 2],
    [T - 5, 2],
    [2, ryBottom],
    [T - 5, ryBottom],
  ]) {
    pc.rect(rx, ry, 3, 3, frameDark);
    pc.rect(rx, ry, 2, 2, rivetFill);
    pc.set(rx, ry, rivetHi);
  }
  return pc;
}

export function blockTile(theme: Theme, x: number, y: number, solidBelow: boolean): PixelCanvas {
  const p = THEMES[theme];
  const pc = new PixelCanvas(T, T);
  const [l, b, s, d] = p.block;
  const inset = 3;
  const top = 2;
  const faceY = solidBelow ? 27 : 22;
  const detail = rgba(p.blockDetail);
  // Sombra en el piso debajo del bloque rompible embutido (26x26)
  pc.rect(inset + 1, 27, T - inset * 2 - 1, 3, rgba('#140c1e', 110));
  if (theme === 'ruinas' || theme === 'volcan') {
    // bloque rompible agrietado con margen de piso visible alrededor
    pc.box(inset, top, T - inset * 2, faceY - top, [l, b, s, d], 3);
    if (!solidBelow) {
      pc.box(inset, faceY - 1, T - inset * 2, 6, [s, s, d, d], 2);
    }
    const crack = theme === 'volcan' ? rgba(p.blockDetail) : rgba('#ffd257');
    let cx = 11 + Math.floor(hash2(x, y, 1) * 10);
    let cy = top + 3;
    for (let k = 0; k < 11; k++) {
      pc.set(cx, cy, rgba(d));
      pc.set(cx + 1, cy, crack);
      cy++;
      cx += k % 3 === 0 ? (hash2(x, k, 2) > 0.5 ? 1 : -1) : 0;
      if (k === 5) {
        pc.set(cx + 2, cy, rgba(d));
        pc.set(cx + 3, cy + 1, crack);
      }
    }
    pc.line(inset + 3, top + 3, T - inset - 4, faceY - 3, rgba(d, 170));
    pc.line(T - inset - 4, top + 3, inset + 3, faceY - 3, rgba(d, 170));
  } else if (theme === 'fabrica') {
    // caja de cartón/madera embalada rompible
    pc.box(inset, top, T - inset * 2, faceY - top, [l, b, s, d], 1);
    if (!solidBelow) pc.box(inset, faceY - 1, T - inset * 2, 6, [s, s, d, d], 1);
    pc.rect(T / 2 - 2, top, 4, faceY - top, detail);
    pc.hline(inset + 2, T - inset - 3, top + 4, rgba(s));
    pc.line(inset + 3, top + 3, T - inset - 4, faceY - 3, rgba(d));
    pc.line(T - inset - 4, top + 3, inset + 3, faceY - 3, rgba(d));
    pc.set(20, top + 9, rgba('#ff3b3b'));
    pc.set(21, top + 9, rgba('#ff3b3b'));
  } else {
    // caja de madera con cruce en X
    pc.box(inset, top, T - inset * 2, faceY - top, [l, b, s, d], 1);
    if (!solidBelow) pc.box(inset, faceY - 1, T - inset * 2, 6, [s, s, d, d], 1);
    const plank = rgba(s);
    for (let j = top + 5; j < faceY - 2; j += 5) pc.hline(inset + 2, T - inset - 3, j, plank);
    pc.line(inset + 3, top + 2, T - inset - 4, faceY - 3, detail);
    pc.line(inset + 3, top + 3, T - inset - 5, faceY - 3, rgba(d));
    pc.line(T - inset - 4, top + 2, inset + 3, faceY - 3, detail);
    pc.set(inset + 4, top + 3, rgba('#ffe57f'));
  }
  pc.outline(OUT);
  return pc;
}

// ---------------------------------------------------------------------------
// Elementos especiales del mapa
// ---------------------------------------------------------------------------

export function conveyorTile(dir: number, frame: number): PixelCanvas {
  // dir: 1 abajo, 2 arriba, 3 izquierda, 4 derecha
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, rgba('#2f343d'));
  pc.rect(2, 2, T - 4, T - 4, rgba('#3b414c'));
  const chev = rgba('#f2c230');
  const chev2 = rgba('#8a6d10');
  const shift = frame * 2;
  for (let k = -1; k < 4; k++) {
    const o = ((k * 8 + shift) % 32) + 0;
    for (let i = 0; i < 6; i++) {
      // chevron apuntando a la derecha, luego rotamos
      const a: [number, number] = [o + i * 0.5, 10 + i];
      const b: [number, number] = [o + i * 0.5, 22 - i];
      pc.set(Math.round(a[0]), a[1], chev);
      pc.set(Math.round(b[0]), b[1], chev);
      pc.set(Math.round(a[0]) - 1, a[1], chev2);
      pc.set(Math.round(b[0]) - 1, b[1], chev2);
    }
  }
  pc.hline(0, T - 1, 0, rgba('#1d2027'));
  pc.hline(0, T - 1, T - 1, rgba('#1d2027'));
  if (dir === 4) return pc;
  const out = new PixelCanvas(T, T);
  for (let y = 0; y < T; y++)
    for (let x = 0; x < T; x++) {
      let sx = x;
      let sy = y;
      if (dir === 3) sx = T - 1 - x;
      else if (dir === 1) {
        sx = y;
        sy = x;
      } else if (dir === 2) {
        sx = T - 1 - y;
        sy = x;
      }
      out.data[y * T + x] = pc.data[sy * T + sx];
    }
  return out;
}

export function doorTile(open: number): PixelCanvas {
  // open: 0 cerrada ... 1 abierta
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, rgba('#2f343d'));
  pc.rect(0, 0, 3, T, rgba('#5d6674'));
  pc.rect(T - 3, 0, 3, T, rgba('#5d6674'));
  const h = Math.round((1 - open) * (T - 4));
  if (h > 0) {
    for (let y = 0; y < h; y++) {
      const stripe = Math.floor((y + 2) / 4) % 2 === 0;
      pc.hline(3, T - 4, y + 2, rgba(stripe ? '#f2c230' : '#23252b'));
    }
    pc.hline(3, T - 4, h + 1, rgba('#1a1026'));
  }
  pc.set(1, 2, rgba(open > 0.5 ? '#3cff9a' : '#ff3b3b'));
  pc.set(T - 2, 2, rgba(open > 0.5 ? '#3cff9a' : '#ff3b3b'));
  return pc;
}

/** Grieta de lava: state 0 dormida, 1 aviso, 2 activa. */
export function lavaTile(state: number, frame: number, x: number, y: number): PixelCanvas {
  const pc = new PixelCanvas(T, T);
  const base = state === 2 ? '#ff5a1f' : state === 1 ? '#8a2f1a' : '#3a2126';
  const hot = state === 2 ? '#ffd23f' : state === 1 ? (frame % 2 ? '#ff7a2a' : '#c9461f') : '#6b2a22';
  pc.ellipse(16, 16, 13, 11, rgba('#241418'));
  pc.ellipse(16, 16, 11, 9, rgba(base));
  for (let i = 0; i < 16; i++) {
    const px = 6 + Math.floor(hash2(x * 9 + i, y + frame, 3) * 20);
    const py = 8 + Math.floor(hash2(x, y * 9 + i + frame, 4) * 16);
    pc.setOver(px, py, rgba(hot));
  }
  if (state === 2) {
    for (let k = 0; k < 3; k++) {
      const bx = 8 + Math.floor(hash2(k, frame, x) * 16);
      const by = 8 + Math.floor(hash2(frame, k, y) * 14);
      pc.ellipse(bx, by, 2, 2, rgba('#fff3b0'), true);
    }
  }
  return pc;
}

export function baseTint(team: string): PixelCanvas {
  const pc = new PixelCanvas(T, T);
  pc.rect(0, 0, T, T, rgba(team, 55));
  pc.rect(0, 0, T, 2, rgba(team, 120));
  pc.rect(0, T - 2, T, 2, rgba(team, 120));
  pc.rect(0, 0, 2, T, rgba(team, 120));
  pc.rect(T - 2, 0, 2, T, rgba(team, 120));
  return pc;
}

export function flagStand(team: string): PixelCanvas {
  const pc = new PixelCanvas(T, T);
  pc.ellipse(16, 22, 13, 7, rgba('#2a2533'));
  pc.ellipse(16, 20, 12, 6, rgba('#8e8a9b'));
  pc.ellipse(16, 19, 10, 4.5, rgba('#b9b5c4'));
  pc.ring(16, 19, 10, 4.5, rgba(team));
  pc.ring(16, 19, 7, 3, rgba(team, 140));
  return pc;
}

// ---------------------------------------------------------------------------
// Bomba, llamas, mejoras y bandera
// ---------------------------------------------------------------------------

export function bombSprite(frame: number, danger: boolean, team?: string): PixelCanvas {
  const pc = new PixelCanvas(T, T);
  const r = [10, 10.6, 11.2, 10.6][frame % 4];
  const body = danger ? ['#ff8a8a', '#e0303f', '#8a1420', '#4a0a12'] : ['#6d6b80', '#34333f', '#1d1c24', '#101015'];
  pc.shaded(16, 19, r, r, body);
  // brillo
  pc.ellipse(12, 14, 2.6, 2, rgba('#ffffff', 200));
  pc.set(11, 17, rgba('#ffffff', 120));
  // banda del equipo
  if (team) {
    for (let x = 6; x < 27; x++) pc.setOver(x, 23, rgba(team, 190));
  }
  // tapa y mecha
  pc.rect(13, 6, 7, 4, rgba('#7c818c'));
  pc.hline(13, 19, 6, rgba('#b4b9c4'));
  pc.line(18, 6, 20, 3, rgba('#8a6238'));
  pc.line(20, 3, 23, 2, rgba('#8a6238'));
  pc.outline(OUT);
  // chispa
  const sp = frame % 2;
  const spark = rgba('#ffe94d');
  const spark2 = rgba('#ff7a1a');
  pc.set(24, 1, spark);
  pc.set(24, 2, spark2);
  if (sp) {
    pc.set(26, 0, spark);
    pc.set(22, 0, spark2);
    pc.set(26, 3, spark2);
  } else {
    pc.set(25, 1, spark);
    pc.set(23, 1, spark);
    pc.set(24, 0, spark);
    pc.set(24, 3, spark2);
  }
  return pc;
}

export const FX_PALETTES: Record<string, [string, string, string, string]> = {
  clasico: ['#ff3d1f', '#ff8a1a', '#ffd23a', '#fff7d6'],
  azul: ['#1f5dff', '#3cb4ff', '#9ff0ff', '#ffffff'],
  toxico: ['#1f9e3a', '#5cff4f', '#d0ff6b', '#faffe0'],
  plasma: ['#8a1fff', '#d04fff', '#ff9ff3', '#ffffff'],
  dorado: ['#c47a0a', '#f2b52c', '#ffe98a', '#ffffff'],
  sombra: ['#2a0f3d', '#5a1f7a', '#b03cff', '#ffd6ff'],
  arcoiris: ['#ff3d1f', '#ffd23a', '#3cff9a', '#ffffff'],
};

/**
 * Llama. shape: 0 centro, 1 horizontal, 2 vertical, 3 fin izq, 4 fin der, 5 fin arriba, 6 fin abajo.
 * k: intensidad 0..1 (crece y se apaga).
 */
export function flameSprite(shape: number, k: number, frame: number, fx: string): PixelCanvas {
  const pal = (FX_PALETTES[fx] ?? FX_PALETTES.clasico).map((c) => rgba(c));
  const pc = new PixelCanvas(T, T);
  const half = 15.5;
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const px = x + 0.5 - 16;
      const py = y + 0.5 - 16;
      // coordenadas a lo largo (u) y a lo ancho (v) del brazo
      let u = 0;
      let v = 0;
      let horizontal = true;
      if (shape === 1 || shape === 3 || shape === 4) {
        u = px;
        v = py;
      } else if (shape === 2 || shape === 5 || shape === 6) {
        u = py;
        v = px;
        horizontal = false;
      }
      let d: number;
      const wob = Math.sin((horizontal ? x : y) * 0.9 + frame * 2.1) * 1.2 + (hash2(x, y, frame) - 0.5) * 1.2;
      if (shape === 0) {
        const r = Math.hypot(px, py);
        // centro: cruz redondeada + círculo
        const cross = Math.min(Math.abs(px), Math.abs(py));
        d = Math.min(r / (13 * k + 2), cross / (9 * k + 1.5) + 0.02 * Math.max(0, Math.max(Math.abs(px), Math.abs(py)) - 12));
        d = Math.min(d, 1.2);
        d += wob * 0.03;
      } else {
        let width = 10 * k + 1.5 + wob * 0.5;
        const isEnd = shape >= 3;
        if (isEnd) {
          // la punta se redondea hacia el extremo
          const dirSign = shape === 3 || shape === 5 ? -1 : 1;
          const along = u * dirSign; // -16..16 hacia la punta
          const tip = 10 + 4 * k;
          if (along > tip - width) {
            const t = (along - (tip - width)) / width;
            width = width * Math.sqrt(Math.max(0, 1 - t * t));
          }
          if (along > tip) width = 0;
        }
        d = Math.abs(v) / Math.max(0.01, width);
        void half;
      }
      if (d > 1) continue;
      let c = pal[0];
      if (d < 0.25) c = pal[3];
      else if (d < 0.5) c = pal[2];
      else if (d < 0.75) c = pal[1];
      if (fx === 'arcoiris' && d >= 0.5) {
        const hue = ((x + y) * 12 + frame * 40) % 360;
        c = rgba(`#${hslToHex(hue, 90, 60)}`);
      }
      pc.set(x, y, withAlpha(c, d > 0.9 ? 200 : 255));
    }
  }
  return pc;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

const PU_COLORS: Record<PowerUpKind, string> = {
  bomb: '#3d8bff',
  fire: '#ff5a1f',
  speed: '#3cff9a',
  heal: '#ff3b6b',
  hyper: '#ffd23f',
};

export function powerupSprite(kind: PowerUpKind, frame: number): PixelCanvas {
  const pc = new PixelCanvas(T, T);
  const c = PU_COLORS[kind];
  pc.box(4, 4, 24, 24, [lighten(c, 0.5), c, darken(c, 0.3), darken(c, 0.5)], 4);
  pc.box(7, 7, 18, 18, ['#2a2340', '#1d1830', '#15111f', '#15111f'], 3);
  const w = rgba('#ffffff');
  const cc = rgba(lighten(c, 0.2));
  switch (kind) {
    case 'bomb':
      pc.ellipse(16, 18, 5.5, 5.5, rgba('#34333f'));
      pc.ellipse(14, 16, 1.5, 1.2, w);
      pc.rect(15, 10, 3, 3, rgba('#b4b9c4'));
      pc.set(18, 9, rgba('#ffe94d'));
      pc.set(19, 8, rgba('#ff7a1a'));
      break;
    case 'fire':
      pc.poly([[16, 8], [22, 17], [20, 23], [12, 23], [10, 17]], rgba('#ff5a1f'));
      pc.poly([[16, 12], [19, 18], [18, 22], [14, 22], [13, 18]], rgba('#ffd23a'));
      pc.ellipse(16, 20, 1.5, 2, rgba('#fff7d6'));
      break;
    case 'speed':
      pc.rect(10, 12, 7, 8, cc);
      pc.rect(10, 18, 12, 3, cc);
      pc.rect(10, 22, 3, 2, w);
      pc.rect(19, 22, 3, 2, w);
      pc.hline(18, 23, 12, w);
      pc.hline(19, 23, 14, w);
      break;
    case 'heal':
      pc.ellipse(13, 14, 3.5, 3.5, cc);
      pc.ellipse(19, 14, 3.5, 3.5, cc);
      pc.poly([[9.5, 15], [22.5, 15], [16, 23]], cc);
      pc.rect(15, 12, 2, 6, w);
      pc.rect(13, 14, 6, 2, w);
      break;
    case 'hyper':
      pc.poly([[18, 8], [11, 17], [15, 17], [13, 24], [21, 14], [17, 14]], cc);
      pc.set(17, 10, w);
      break;
  }
  pc.outline(OUT);
  if (frame % 2 === 1) pc.ring(16, 16, 15, 15, rgba('#ffffff', 90));
  return pc;
}

export function flagSprite(team: string, frame: number, small = false): PixelCanvas {
  const pc = new PixelCanvas(T, T + 8);
  const oy = 4;
  // mástil
  pc.rect(7, oy + 1, 2, 30, rgba('#8e8a9b'));
  pc.vline(7, oy + 1, oy + 30, rgba('#c9c5d4'));
  pc.ellipse(8, oy + 1, 2, 2, rgba('#ffd23f'));
  // tela ondulante
  const light = lighten(team, 0.35);
  const dark = darken(team, 0.3);
  for (let x = 9; x < 29; x++) {
    const wave = Math.round(Math.sin((x - 9) * 0.45 - frame * 1.4) * 2 * ((x - 9) / 20));
    const top = oy + 3 + wave;
    const bot = oy + 16 + wave - Math.round((x - 9) * 0.1);
    for (let y = top; y <= bot; y++) {
      const shade = Math.sin((x - 9) * 0.45 - frame * 1.4) > 0.3 ? light : Math.sin((x - 9) * 0.45 - frame * 1.4) < -0.5 ? dark : team;
      pc.set(x, y, rgba(shade));
    }
  }
  // emblema: bomba
  const ex = 18;
  const ey = oy + 9 + Math.round(Math.sin(9 * 0.45 - frame * 1.4) * 1.2);
  pc.ellipse(ex, ey + 1, 3, 3, rgba('#ffffff'));
  pc.rect(ex - 1, ey - 3, 2, 2, rgba('#ffffff'));
  pc.outline(OUT);
  if (small) return pc;
  return pc;
}

/** Ícono de clase (para HUD): silueta simple. */
export function mixColor(a: string, b: string, t: number) {
  return mix(a, b, t);
}
