// Personajes en pixel art procedural (16-bit arcade, 48x56), basados en las hojas oficiales de G5:
// Cubert (tanque), Maira (veloz), Rango (distancia), Wimmi (support), Giga (defensor) y Vaskil (controlador).
import { CLASS_IDS, type ClassId } from '../../shared/types';
import { SKIN_META, type Rarity } from '../../shared/catalog';
import { PixelCanvas, rgba, withAlpha, type Color } from './pixel';

export const FW = 48;
export const FH = 56;
export const CX = 24;
export const GROUND = 50;

export type Anim = 'idle' | 'walk' | 'attack' | 'cast' | 'hurt' | 'ko' | 'win';
export const ANIM_FRAMES: Record<Anim, number> = { idle: 4, walk: 6, attack: 4, cast: 3, hurt: 1, ko: 5, win: 4 };
export type View = 'down' | 'up' | 'right';

export interface Pose {
  view: View;
  anim: Anim;
  f: number;
  n: number;
  t: number;
  bob: number;
  step: number;
  swing: number;
  lunge: number;
  cast: number;
  eyes: 'open' | 'blink' | 'hurt' | 'x' | 'happy';
  arms: number;
}

export type Pal = Record<string, string>;

export interface Skin {
  id: string;
  name: string;
  rarity: Rarity;
  price: number;
  colors: Pal;
}

const OUTLINE = '#1a1026';
const DARK = rgba(OUTLINE);
const DARK_T = [OUTLINE, OUTLINE, OUTLINE, OUTLINE];

// ---------------------------------------------------------------------------
// Paletas base y skins (los IDs coinciden con shared/catalog)
// ---------------------------------------------------------------------------

export const BASE_PAL: Record<ClassId, Pal> = {
  // Cubert: bloque verde oliva, gorra marrón con banda mostaza e insignia dorada, gafas negras + visor cian, hombreras oro/marrón y guanteletes carmesí
  tanque: {
    b0: '#a8ba56', b1: '#86993c', b2: '#637328', b3: '#3f4a18',
    vest0: '#657528', vest1: '#495719',
    cap0: '#8c4920', cap1: '#693414', cap2: '#421e09', band: '#bd961f', gold: '#ffdd33',
    visor: '#0d0f18', eye: '#3ce8ff', eyeHi: '#c8fbff',
    gaunt0: '#c44945', gaunt1: '#9c312e', gaunt2: '#6b1d1b',
    pad0: '#8a6432', pad1: '#5e411d', padFin: '#d9b838',
    boot0: '#78492b', boot1: '#4d2c18',
    aura: '#4af0ff',
  },
  // Maira: piel bronceada cálida, pelo dorado con destello naranja en cola, vincha azul, ojos carmesí, túnica teal + blanco, cintas rosas y bombas en cintura
  veloz: {
    s0: '#f5be8e', s1: '#de9a68', s2: '#b36f42',
    h0: '#ffe94d', h1: '#f5b81d', h2: '#c97e0c',
    flare0: '#ff771c', flare1: '#d92814',
    band0: '#3ba2ff', band1: '#1a57b5',
    eye0: '#d4222b', eye1: '#ffffff',
    suit0: '#27596e', suit1: '#193c4d', suit2: '#0f2530',
    trim: '#f7faff', trimS: '#b8c6db',
    rib0: '#ff6ba8', rib1: '#cc2f72',
    shoe0: '#db2b39', shoe1: '#941724',
    aura: '#ff7b29', zap: '#ffe94d',
  },
  // Rango: piel clara crema-durazno fiel al póster, pelo castaño con mechones dorados en flecha + ahoge flecha roja, pañuelo naranja y tapado oliva con solapas crema
  distancia: {
    s0: '#ffeedb', s1: '#f7d4b2', s2: '#d4a37d',
    scar: '#c98b6b',
    h0: '#9c5a34', h1: '#703d20', h2: '#472310',
    bang0: '#ffd55e', bang1: '#d99e26',
    crest: '#e6392e', eye: '#26cc70',
    scarf0: '#f56e28', scarf1: '#c44612',
    coat0: '#4f8042', coat1: '#355c2b', coat2: '#1f3b19',
    shirt: '#262b36', lapel: '#ebe8d5',
    pant0: '#786238', pant1: '#524122', buckle: '#ffd23f',
    bow0: '#824d2b', bow1: '#b8c4d4', bow2: '#545f70',
    bolt: '#ffef78', aura: '#ff9c38',
  },
  // Wimmi: piel muy clara marfil-rosada fiel al póster, pelo verde neón en dos rodetes, vincha/corona cian, remera blanca médica, bolso cian, dron estrella
  support: {
    s0: '#fff3eb', s1: '#ffddc9', s2: '#e0b096',
    h0: '#68f244', h1: '#3bc427', h2: '#1e8518',
    head0: '#42e3ff', head1: '#1795c4', crown: '#fff078',
    eye: '#2ab858', eyeR: '#d9381e', cheek: '#32d9f2', tongue: '#ff6b96',
    shirt0: '#ffffff', shirt1: '#dde7f2', shirt2: '#aab9cf',
    bag0: '#2cc4eb', bag1: '#157fa3', cross: '#78f538',
    short0: '#5be33b', short1: '#2ca822',
    drone0: '#6bf2ff', drone1: '#2898d4', droneEye: '#ffffff',
    aura: '#4effb5',
  },
  // Giga: gólem de roca arenisca agrietada, casco de hierro con cresta y ojos naranjas, núcleo llama en pecho, bombas al cinturón, taladro espiral y escudo torre
  defensor: {
    r0: '#d4ab79', r1: '#ad8153', r2: '#7d5834', r3: '#452c16',
    m0: '#9e978e', m1: '#706a62', m2: '#45403b',
    moss: '#5eb545', flag0: '#cf483e', flag1: '#4278b8',
    eye0: '#ff7714', eye1: '#ffea70', slit: '#12141c',
    core0: '#ff5500', core1: '#ffaa1d', core2: '#fff59e',
    drill0: '#c7c2ba', drill1: '#8c867e', drill2: '#524e48',
    shield0: '#b8966c', shield1: '#876946',
    belt: '#4a3525', gold: '#ffd23f', bomb: '#2b303a',
    aura: '#ffa229',
  },
  // Vaskil: piel clara durazno, gorra blanca plana con pin bomba y penacho dorado, pelo violeta con puntas doradas, chaleco morado ciruela con hombreras en punta y vendas
  controlador: {
    s0: '#ffebd6', s1: '#f2c6a0', s2: '#c7926b',
    cap0: '#f7f9ff', cap1: '#cfd6e8', capB: '#1a1726', pin: '#1c2642', fuse: '#e8382e', plume: '#ffd23f', tuft: '#e6cf3e',
    h0: '#c94cc9', h1: '#8f2594', h2: '#581560',
    scarf0: '#8c5538', scarf1: '#59331f',
    vest0: '#633478', vest1: '#4a255e', vest2: '#2e143d',
    shirt0: '#ecc152', shirt1: '#c7902e',
    pant0: '#453b61', pant1: '#2a223d',
    wrap: '#eef1f8', glove: '#1a1c29',
    wisp0: '#e052ff', wisp1: '#ffadff',
    eye: '#f08c1a', mark: '#722c8c',
  },
};

const SKIN_COLORS: Record<ClassId, Record<string, Pal>> = {
  tanque: {
    base: {},
    hielo: { b0: '#bceeff', b1: '#7ec4e6', b2: '#4d8fb8', b3: '#306185', vest0: '#4f8eb5', vest1: '#2c5a7a', cap0: '#dceeff', cap1: '#95bee0', cap2: '#567ea3', band: '#9ad8ff', padFin: '#4af0ff', gaunt0: '#3cb4ff', gaunt1: '#1d6ec2', gaunt2: '#123e73', pad0: '#9ad8ff', pad1: '#5894bf', boot0: '#3f7aa8', boot1: '#234a6b', eye: '#fff08a' },
    magma: { b0: '#6e4848', b1: '#4d2f2f', b2: '#331d1d', b3: '#211010', vest0: '#3a2222', vest1: '#241212', cap0: '#2e2629', cap1: '#1c1618', cap2: '#100c0e', band: '#7a190a', padFin: '#ff7b29', gaunt0: '#ff6a2a', gaunt1: '#cc3514', gaunt2: '#7a190a', eye: '#ff962a', eyeHi: '#fff3b8', gold: '#ff7b29', aura: '#ff6a2a' },
    oro: { b0: '#fff099', b1: '#ebd03c', b2: '#b88318', b3: '#7d540c', vest0: '#7b2cbf', vest1: '#4f1882', cap0: '#f7d24f', cap1: '#bf8e1b', cap2: '#7d570c', band: '#fff099', padFin: '#ff3bd4', gaunt0: '#ff3bd4', gaunt1: '#b81c98', gaunt2: '#6e0d5a', eye: '#4effd0' },
  },
  veloz: {
    base: {},
    fuego: { h0: '#fff288', h1: '#ff7e29', h2: '#c93414', flare0: '#ff4229', flare1: '#a81910', band0: '#ff4229', band1: '#a81910', suit0: '#4a1d28', suit1: '#2e1018', suit2: '#1a080c', rib0: '#ffe048', rib1: '#e08914', aura: '#ff5229' },
    toxica: { h0: '#c8ff80', h1: '#62e639', h2: '#2d9c1f', flare0: '#b04dff', flare1: '#6e1ec2', band0: '#b04dff', band1: '#6e1ec2', suit0: '#273b2f', suit1: '#16261c', suit2: '#0c1710', rib0: '#9e5cff', rib1: '#5b22b8', shoe0: '#55e05f', shoe1: '#238c2a', aura: '#6eff4d' },
    galaxia: { h0: '#ffd6ff', h1: '#c46bff', h2: '#6e2cc4', flare0: '#45e8ff', flare1: '#1988b8', band0: '#45e8ff', band1: '#1988b8', suit0: '#20184a', suit1: '#130d30', suit2: '#09061a', rib0: '#5cf2ff', rib1: '#2599bd', shoe0: '#b04dff', shoe1: '#591fa8', aura: '#b04dff' },
  },
  distancia: {
    base: {},
    desierto: { coat0: '#d9b578', coat1: '#ab8549', coat2: '#755829', scarf0: '#e04f3e', scarf1: '#99241b', pant0: '#c9a66b', pant1: '#91723e', h0: '#704426', h1: '#4d2b16', crest: '#ffd23f' },
    coral: { coat0: '#ff8a7a', coat1: '#cf4842', coat2: '#8a2323', scarf0: '#ffd23f', scarf1: '#c98816', pant0: '#2b3240', pant1: '#181c26', bang0: '#ffffff', crest: '#3ce8ff' },
    sombra: { coat0: '#4e426e', coat1: '#32284a', coat2: '#1d162e', scarf0: '#b04dff', scarf1: '#691eb8', pant0: '#2a2238', pant1: '#171221', bang0: '#d9b8ff', crest: '#ff4fd8', eye: '#ff4fd8' },
  },
  support: {
    base: {},
    neon: { h0: '#ff9ae0', h1: '#e048a8', h2: '#99206e', head0: '#ffe04d', head1: '#c4961a', bag0: '#ff4fb8', bag1: '#ad2076', short0: '#ff4fb8', short1: '#ad2076', aura: '#ff70cc' },
    espacial: { h0: '#ffa84d', h1: '#d9691c', h2: '#8a390b', shirt0: '#fff2e0', shirt1: '#ffd4a6', shirt2: '#d99e66', bag0: '#ff7a1a', bag1: '#b8490a', short0: '#ff8a2a', short1: '#b85012', head0: '#ffd23f', head1: '#bf8816' },
    noche: { h0: '#e8e8ff', h1: '#a8abcf', h2: '#6d7096', shirt0: '#3c425c', shirt1: '#262a3d', shirt2: '#161926', bag0: '#ffd23f', bag1: '#b88416', short0: '#262a3d', short1: '#161926', head0: '#ffd23f', head1: '#bf8816', drone0: '#ffd23f' },
  },
  defensor: {
    base: {},
    musgo: { r0: '#9ec489', r1: '#70945d', r2: '#4a693b', r3: '#2e4524', moss: '#8aff54', core0: '#42e88a', core1: '#9effc4', eye0: '#78ff54', shield0: '#8fb57c', shield1: '#597a49' },
    obsidiana: { r0: '#5d5378', r1: '#3d3552', r2: '#272038', r3: '#151021', m0: '#352f47', m1: '#231e30', m2: '#14111c', core0: '#c44dff', core1: '#eab8ff', eye0: '#c44dff', drill0: '#b38aff', drill1: '#6e45b8', shield0: '#4c4366', shield1: '#2e2740' },
    jade: { r0: '#9effc9', r1: '#4dc992', r2: '#258c61', r3: '#14593d', m0: '#ffd96e', m1: '#cca031', m2: '#876214', core0: '#ffffff', core1: '#fff4a6', eye0: '#ffd23f', drill0: '#ffe48a', drill1: '#c4962b', shield0: '#7de3af', shield1: '#3ca373' },
  },
  controlador: {
    base: {},
    esmeralda: { h0: '#6effb0', h1: '#29b86d', h2: '#147542', tuft: '#b8ffe0', mark: '#147542', vest0: '#276644', vest1: '#19472e', vest2: '#0f2b1c', wisp0: '#4dff9a', wisp1: '#d0ffe5', shirt0: '#ffd23f' },
    carmesi: { h0: '#ff6e78', h1: '#c92a38', h2: '#7a121d', tuft: '#ffd23f', mark: '#7a121d', vest0: '#852434', vest1: '#5e1622', vest2: '#380b13', wisp0: '#ff4757', wisp1: '#ffd0d4', shirt0: '#ffd23f' },
    nulo: { cap0: '#201e2b', cap1: '#12101a', h0: '#ffffff', h1: '#c8c8dc', h2: '#80809c', tuft: '#ff3b3b', mark: '#4e4e66', vest0: '#f5f5ff', vest1: '#bfc0d4', vest2: '#7e7f96', pant0: '#242433', pant1: '#14141e', wisp0: '#ff3b3b', wisp1: '#ffffff' },
  },
};

export const SKINS: Record<ClassId, Skin[]> = Object.fromEntries(
  CLASS_IDS.map((cls) => [cls, SKIN_META[cls].map((m) => ({ ...m, colors: SKIN_COLORS[cls][m.id] ?? {} }))]),
) as Record<ClassId, Skin[]>;

export function skinPalette(cls: ClassId, skinId: string): Pal {
  const skin = SKINS[cls].find((s) => s.id === skinId) ?? SKINS[cls][0];
  return { ...BASE_PAL[cls], ...skin.colors };
}

// ---------------------------------------------------------------------------
// Poses
// ---------------------------------------------------------------------------

export function makePose(view: View, anim: Anim, f: number): Pose {
  const n = ANIM_FRAMES[anim];
  const t = f / n;
  const p: Pose = { view, anim, f, n, t, bob: 0, step: 0, swing: 0, lunge: 0, cast: 0, eyes: 'open', arms: 0 };
  switch (anim) {
    case 'idle':
      p.bob = f === 1 || f === 2 ? 1 : 0;
      p.eyes = f === 3 ? 'blink' : 'open';
      break;
    case 'walk': {
      const s = Math.sin(t * Math.PI * 2);
      p.step = s;
      p.swing = -s;
      p.bob = -Math.round(Math.abs(Math.sin(t * Math.PI * 2)) * 2);
      break;
    }
    case 'attack': {
      const idx = Math.max(0, Math.min(n - 1, f % n));
      // 0: preparación atrás, 1: pico del golpe, 2: estela/impacto, 3: recuperación
      p.bob = [1, -1, 0, 0][idx];
      p.lunge = [-2, 4, 3, 1][idx];
      p.arms = [-1, 3, 2, 1][idx];
      break;
    }
    case 'cast':
      p.cast = [0.5, 1, 0.7][f];
      p.bob = [-1, -2, -1][f];
      p.arms = 3;
      break;
    case 'hurt':
      p.eyes = 'hurt';
      p.lunge = -2;
      break;
    case 'ko':
      p.eyes = 'x';
      break;
    case 'win':
      p.bob = [0, -1, -2, -1][f];
      p.eyes = 'happy';
      p.arms = 3;
      break;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Helpers anatómicos y de línea interna (16-bit arcade pixel art)
// ---------------------------------------------------------------------------

type DrawFn = (pc: PixelCanvas, p: Pose, c: Pal) => void;

const col = (c: Pal, k: string, a = 255): Color => rgba(c[k] ?? '#ff00ff', a);

function beginFrame(pc: PixelCanvas, p: Pose, shadowRx = 11): number {
  const [lx, ly] = p.view === 'right'
    ? [p.lunge, 0]
    : p.view === 'down'
      ? [0, Math.round(p.lunge * 0.5)]
      : [0, -Math.round(p.lunge * 0.5)];
  pc.ox = lx;
  pc.oy = ly;
  // Sombra anclada al suelo antes de elevar al personaje en saltos (win/walk/cast)
  pc.ellipse(CX, 48.5, shadowRx, 2.2, rgba('#0a0612', 85));
  if (p.bob < 0) {
    // Al saltar o rebotar hacia arriba, todo el cuerpo (incluidas piernas) se eleva unido
    pc.oy += p.bob;
    return 0;
  }
  return p.bob;
}

/** Caja con contorno interno oscuro de 1 px para separar capas anatómicas y armaduras. */
function ibox(pc: PixelCanvas, x: number, y: number, w: number, h: number, tones: string[], rounded = 1) {
  pc.box(x, y, w, h, DARK_T, rounded);
  if (w > 2 && h > 2) {
    pc.box(x + 1, y + 1, w - 2, h - 2, tones, Math.max(0, rounded - 1));
  }
}

/** Elipse sombreada con contorno interno oscuro de 1 px (cabeza, hombros, casco, etc.). */
function dshaded(
  pc: PixelCanvas,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  tones: string[],
  lx = -0.4,
  ly = -0.5,
) {
  pc.ellipse(cx, cy, rx + 0.9, ry + 0.9, DARK);
  pc.shaded(cx, cy, rx, ry, tones, lx, ly);
}

/** Polígono con borde interno oscuro de 1 px. */
function ipoly(pc: PixelCanvas, pts: [number, number][], fill: Color, stroke: Color = DARK) {
  pc.poly(pts, fill);
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    pc.line(x0, y0, x1, y1, stroke);
  }
}

/** Ojos expresivos estilo anime/arcade (3x3 con esclera, iris, brillo y pestaña superior). */
function animeEyes(
  pc: PixelCanvas,
  xs: number[],
  y: number,
  p: Pose,
  iris: Color,
  hi: Color,
  brow?: Color,
  white: Color = rgba('#ffffff'),
  irisRight?: Color,
) {
  xs.forEach((x, idx) => {
    const cIris = idx === 1 && irisRight ? irisRight : iris;
    if (brow) pc.hline(x - 1, x + 2, y - 2, brow);
    switch (p.eyes) {
      case 'blink':
        pc.hline(x, x + 2, y + 1, DARK);
        break;
      case 'hurt':
        pc.set(x, y, DARK);
        pc.set(x + 1, y + 1, DARK);
        pc.set(x, y + 2, DARK);
        pc.set(x + 2, y + 1, DARK);
        break;
      case 'x':
        pc.set(x, y, DARK);
        pc.set(x + 2, y, DARK);
        pc.set(x + 1, y + 1, DARK);
        pc.set(x, y + 2, DARK);
        pc.set(x + 2, y + 2, DARK);
        break;
      case 'happy':
        pc.set(x, y + 2, DARK);
        pc.set(x + 1, y + 1, DARK);
        pc.set(x + 2, y + 2, DARK);
        break;
      default:
        pc.hline(x, x + 2, y, DARK);
        pc.set(x, y + 1, white);
        pc.set(x + 1, y + 1, cIris);
        pc.set(x + 2, y + 1, DARK);
        pc.set(x, y + 2, white);
        pc.set(x + 1, y + 2, hi);
        pc.set(x + 2, y + 2, cIris);
    }
  });
}

// ===========================================================================
// 1. CUBERT (Tanque) — Bloque verde oliva ancho, gorra de capitán marrón con banda
//    mostaza e insignia dorada, lentes oscuros angulares + visor cian lateral,
//    hombreras con aletas doradas y masivos guanteletes facetados carmesí.
// ===========================================================================
const drawCubert: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 13);
  const cubeT = [c.b0, c.b1, c.b2, c.b3];
  const gauntT = [c.gaunt0, c.gaunt1, c.gaunt2, c.gaunt2];
  const padT = [c.pad0, c.pad1, c.cap2, c.cap2];
  const stepA = Math.round(p.step * 2.5);

  // Piernas anchas verde oliva, pelvis unida y botas militares marrones
  const boot = (x: number, lift: number) => {
    const yy = 39 - Math.max(0, lift);
    ibox(pc, x, yy, 8, 6, [c.b1, c.b2, c.b3, c.b3], 0);
    ibox(pc, x - 1, yy + 4, 9, 5, [c.boot0, c.boot1, c.cap2, c.cap2], 1);
    pc.hline(x, x + 6, yy + 7, col(c, 'cap2'));
  };
  if (p.view === 'right') {
    boot(14 - stepA, -stepA);
    boot(25 + stepA, stepA);
    ibox(pc, 15, 36 + b, 18, 5, cubeT, 0);
  } else {
    boot(13, stepA);
    boot(27, -stepA);
    ibox(pc, 14, 36 + b, 20, 5, cubeT, 0);
    pc.vline(24, 38 + b, 40 + b, DARK);
  }

  // Brazo trasero si vista lateral
  const up = p.arms === 3 ? -7 : 0;
  if (p.view === 'right') {
    const bx = 11 - Math.round(p.swing * 2);
    ibox(pc, bx, 27 + b + Math.round(up * 0.4), 7, 6, padT, 1);
    ibox(pc, bx - 1, 32 + b + up, 8, 9, gauntT, 1);
  }

  // Torso cubo ancho verde oliva con peto V-neck contorneado
  ibox(pc, 12, 26 + b, 24, 13, cubeT, 1);
  if (p.view !== 'up') {
    ipoly(
      pc,
      [
        [13, 27 + b],
        [34, 27 + b],
        [34, 32 + b],
        [24, 36 + b],
        [13, 32 + b],
      ],
      col(c, 'vest0'),
    );
    pc.poly([[17, 27 + b], [30, 27 + b], [24, 32 + b]], col(c, 'b1'));
    pc.line(17, 27 + b, 24, 32 + b, DARK);
    pc.line(30, 27 + b, 24, 32 + b, DARK);
    pc.vline(24, 36 + b, 38 + b, col(c, 'b3'));
    pc.hline(15, 32, 37 + b, col(c, 'b2'));
  } else {
    ipoly(pc, [[15, 27 + b], [32, 27 + b], [24, 33 + b]], col(c, 'vest1'));
    pc.vline(24, 34 + b, 37 + b, col(c, 'b3'));
  }

  // Cabeza cubo ancha con línea facial y gafas oscuras angulares
  ibox(pc, 11, 10 + b, 26, 17, cubeT, 1);
  pc.hline(12, 35, 11 + b, col(c, 'b0'));

  if (p.view !== 'up') {
    const blink = p.eyes === 'blink' || p.eyes === 'hurt';
    if (p.view === 'down') {
      pc.vline(24, 12 + b, 16 + b, col(c, 'b2'));
      pc.hline(12, 14, 18 + b, col(c, 'eye'));
      pc.hline(33, 35, 18 + b, col(c, 'eye'));
      pc.line(15, 15 + b, 21, 16 + b, col(c, 'vest1'));
      pc.line(26, 16 + b, 32, 15 + b, col(c, 'vest1'));
      if (p.cast > 0) {
        pc.rect(15, 17 + b, 7, 4, col(c, 'eye'));
        pc.rect(26, 17 + b, 7, 4, col(c, 'eye'));
        pc.rect(17, 18 + b, 3, 2, col(c, 'eyeHi'));
        pc.rect(28, 18 + b, 3, 2, col(c, 'eyeHi'));
      } else if (p.eyes === 'x') {
        pc.line(16, 17 + b, 20, 21 + b, col(c, 'eye'));
        pc.line(20, 17 + b, 16, 21 + b, col(c, 'eye'));
        pc.line(27, 17 + b, 31, 21 + b, col(c, 'eye'));
        pc.line(31, 17 + b, 27, 21 + b, col(c, 'eye'));
      } else if (blink) {
        pc.hline(15, 21, 19 + b, col(c, 'visor'));
        pc.hline(26, 32, 19 + b, col(c, 'visor'));
      } else {
        ipoly(pc, [[14, 17 + b], [22, 18 + b], [21, 21 + b], [15, 21 + b]], col(c, 'visor'), col(c, 'visor'));
        ipoly(pc, [[25, 18 + b], [33, 17 + b], [32, 21 + b], [26, 21 + b]], col(c, 'visor'), col(c, 'visor'));
        pc.set(16, 18 + b, col(c, 'eye', 165));
        pc.set(27, 18 + b, col(c, 'eye', 165));
      }
      pc.hline(14, 18, 22 + b, col(c, 'b2'));
      pc.hline(29, 33, 22 + b, col(c, 'b2'));
      pc.hline(17, 30, 24 + b, col(c, 'b3'));
      pc.hline(20, 27, 25 + b, col(c, 'b0'));
    } else {
      pc.hline(13, 26, 18 + b, col(c, 'eye'));
      pc.hline(14, 25, 19 + b, col(c, 'eye', 130));
      pc.rect(27, 17 + b, 9, blink ? 1 : 4, col(c, p.cast > 0 ? 'eyeHi' : 'visor'));
      pc.hline(28, 34, 17 + b, col(c, 'vest1'));
      pc.hline(28, 35, 24 + b, col(c, 'b3'));
    }
  } else {
    pc.hline(13, 34, 18 + b, col(c, 'eye'));
    pc.hline(13, 34, 19 + b, col(c, 'b2'));
  }

  // Gorra de capitán marrón con visera inclinada, cinta mostaza e insignia dorada
  const hb = b;
  ipoly(pc, [[12, 8 + hb], [18, 3 + hb], [29, 3 + hb], [35, 8 + hb]], col(c, 'cap1'));
  pc.poly([[14, 7 + hb], [19, 4 + hb], [28, 4 + hb], [32, 7 + hb]], col(c, 'cap0'));
  pc.rect(12, 8 + hb, 24, 2, col(c, 'band'));
  pc.hline(11, 36, 10 + hb, DARK);
  if (p.view === 'down') {
    ipoly(pc, [[10, 11 + hb], [36, 10 + hb], [32, 12 + hb], [11, 13 + hb]], col(c, 'cap2'));
    pc.hline(12, 33, 10 + hb, col(c, 'cap0'));
    pc.ellipse(24, 6 + hb, 2.8, 2.8, DARK);
    pc.ellipse(24, 6 + hb, 2.2, 2.2, col(c, 'gold'));
    pc.set(23, 5 + hb, rgba('#fff7bd'));
  } else if (p.view === 'right') {
    ipoly(pc, [[14, 10 + hb], [40, 11 + hb], [37, 13 + hb], [15, 12 + hb]], col(c, 'cap2'));
    pc.hline(15, 37, 10 + hb, col(c, 'cap0'));
    pc.ellipse(31, 6 + hb, 2.4, 2.4, DARK);
    pc.ellipse(31, 6 + hb, 1.9, 1.9, col(c, 'gold'));
    pc.set(31, 5 + hb, rgba('#fff7bd'));
  } else {
    pc.rect(12, 10 + hb, 24, 2, col(c, 'cap2'));
  }

  // Hombreras marrón/dorado + grandes guanteletes carmesí facetados con puños oliva
  const strike = p.anim === 'attack' && (p.f === 1 || p.f === 2);
  if (p.view === 'right') {
    const punch = p.anim === 'attack';
    ibox(pc, 18, 26 + b, 8, 6, padT, 1);
    pc.hline(19, 25, 31 + b, col(c, 'padFin'));
    if (punch) {
      const gx = 24 + p.arms * 2;
      ibox(pc, gx, 26 + b, 10, 9, gauntT, 1);
      pc.line(gx + 2, 27 + b, gx + 7, 33 + b, col(c, 'gaunt0'));
      ibox(pc, gx + 8, 27 + b, 5, 7, cubeT, 1);
      if (strike) {
        pc.ellipse(gx + 11, 30 + b, 2.5, 5.8, col(c, 'aura', 220));
        pc.vline(gx + 12, 26 + b, 34 + b, rgba('#ffffff', 230));
        pc.set(gx + 8, 24 + b, col(c, 'gold'));
        pc.set(gx + 9, 36 + b, col(c, 'gold'));
      }
    } else {
      const gx = 21 + Math.round(p.swing * 2);
      ibox(pc, gx, 31 + b + up, 9, 10, gauntT, 1);
      pc.line(gx + 2, 32 + b + up, gx + 6, 39 + b + up, col(c, 'gaunt0'));
      ibox(pc, gx + 2, 39 + b + up, 5, 4, cubeT, 1);
    }
  } else {
    const sy = Math.round(p.swing * 2);
    const punch = p.anim === 'attack';
    ibox(pc, 6, 25 + b + Math.round(up * 0.4), 7, 6, padT, 1);
    pc.hline(7, 11, 31 + b + Math.round(up * 0.4), col(c, 'padFin'));
    ibox(pc, 4, 30 + b + sy + up, 8, 11, gauntT, 1);
    pc.line(6, 32 + b + sy + up, 9, 39 + b + sy + up, col(c, 'gaunt0'));
    ibox(pc, 5, 39 + b + sy + up, 6, 4, cubeT, 1);

    ibox(pc, 35, 25 + b + Math.round(up * 0.4), 7, 6, padT, 1);
    pc.hline(36, 40, 31 + b + Math.round(up * 0.4), col(c, 'padFin'));
    if (punch && p.view === 'down') {
      const gy = 30 + b + p.arms * 2;
      ibox(pc, 34, gy, 10, 9, gauntT, 1);
      ibox(pc, 36, gy + 7, 6, 4, cubeT, 1);
      if (strike) {
        pc.ellipse(39, gy + 11, 5.5, 2.2, col(c, 'aura', 220));
        pc.hline(34, 44, gy + 12, rgba('#ffffff', 230));
        pc.rect(34, gy + 10, 2, 2, col(c, 'gold'));
      }
    } else if (punch && p.view === 'up') {
      const gy = 17 + b - p.arms * 3;
      ibox(pc, 34, gy, 10, 9, gauntT, 1);
      ibox(pc, 36, gy - 2, 6, 4, cubeT, 1);
      if (strike) {
        pc.ellipse(39, gy - 4, 5.5, 2.2, col(c, 'aura', 220));
        pc.hline(34, 44, gy - 5, rgba('#ffffff', 230));
      }
    } else {
      ibox(pc, 36, 30 + b - sy + up, 8, 11, gauntT, 1);
      pc.line(38, 32 + b - sy + up, 41, 39 + b - sy + up, col(c, 'gaunt0'));
      ibox(pc, 37, 39 + b - sy + up, 6, 4, cubeT, 1);
    }
  }

  if (p.cast > 0) {
    pc.ring(CX, 28 + b, 19 * p.cast, 19 * p.cast, col(c, 'aura', 190));
    pc.rect(6, 14 + b, 2, 2, col(c, 'gold'));
    pc.rect(40, 18 + b, 2, 2, col(c, 'aura'));
  }
};

// ===========================================================================
// 2. MAIRA (Veloz) — Pelo dorado picudo con estallido naranja trasero y vincha azul,
//    ojos carmesí + marca blanca de rayo en mejilla, túnica teal con bordes blancos,
//    insignia calavera, cintas rosas con mini-bombas y zapatillas rojas con banda blanca.
// ===========================================================================
const drawMaira: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 11);
  const stepA = Math.round(p.step * 2.5);
  const skinT = [c.s0, c.s1, c.s2, c.s2];

  // Dos colas largas de cintas rosas ondeantes detrás
  const fl = Math.round(Math.sin((p.f + 1) * 1.4) * 2);
  if (p.view === 'right') {
    ipoly(pc, [[17, 31 + b], [6, 33 + b + fl], [8, 36 + b + fl], [18, 34 + b]], col(c, 'rib0'));
    ipoly(pc, [[17, 34 + b], [8, 39 + b - fl], [11, 41 + b - fl], [19, 36 + b]], col(c, 'rib1'));
  } else {
    ipoly(pc, [[15, 31 + b], [6, 35 + b + fl], [8, 38 + b + fl], [16, 34 + b]], col(c, 'rib0'));
    ipoly(pc, [[32, 31 + b], [41, 35 + b - fl], [39, 38 + b - fl], [31, 34 + b]], col(c, 'rib1'));
  }

  // Piernas atléticas, calcetas blancas altas y zapatillas rojas con tira diagonal blanca
  const sneaker = (x: number, y: number) => {
    ibox(pc, x, y - 6, 6, 6, skinT, 0);
    ibox(pc, x, y - 2, 6, 3, [c.trim, c.trim, c.trimS, c.trimS], 0);
    ibox(pc, x - 1, y, 8, 6, [c.shoe0, c.shoe1, c.shoe1, c.shoe1], 1);
    pc.hline(x, x + 5, y + 4, col(c, 'trim'));
    pc.line(x + 1, y + 1, x + 4, y + 3, col(c, 'trim'));
  };
  if (p.view === 'right') {
    sneaker(15 - stepA, 43 - Math.max(0, -stepA));
    sneaker(26 + stepA, 43 - Math.max(0, stepA));
  } else {
    sneaker(14, 43 - Math.max(0, stepA));
    sneaker(27, 43 - Math.max(0, -stepA));
  }

  // Túnica teal acampanada con borde inferior blanco + cuello V blanco + banda rosa y mini-bombas
  ipoly(pc, [[15, 24 + b], [32, 24 + b], [35, 39 + b], [12, 39 + b]], col(c, 'suit0'));
  pc.poly([[23, 25 + b], [32, 25 + b], [34, 38 + b], [24, 38 + b]], col(c, 'suit1'));
  pc.hline(13, 34, 37 + b, col(c, 'trimS'));
  pc.hline(13, 34, 38 + b, col(c, 'trim'));
  pc.hline(12, 35, 39 + b, DARK);

  if (p.view !== 'up') {
    pc.poly([[20, 24 + b], [27, 24 + b], [24, 28 + b]], col(c, 's1'));
    pc.line(18, 24 + b, 24, 30 + b, col(c, 'trim'));
    pc.line(29, 24 + b, 24, 30 + b, col(c, 'trim'));
    pc.line(16, 26 + b, 32, 33 + b, col(c, 'rib0'));
    pc.hline(15, 32, 32 + b, col(c, 'rib0'));
    pc.hline(15, 32, 33 + b, col(c, 'rib1'));
    // Dos mini-bombas en cintura con chispa
    pc.ellipse(21, 34 + b, 1.8, 1.8, DARK);
    pc.set(21, 34 + b, rgba('#223254'));
    pc.set(21, 32 + b, col(c, 'zap'));
    pc.ellipse(26, 35 + b, 1.8, 1.8, DARK);
    pc.set(26, 35 + b, rgba('#223254'));
    pc.set(26, 33 + b, col(c, 'flare0'));
    pc.set(17, 35 + b, col(c, 'shoe0'));
    pc.set(18, 35 + b, col(c, 'trim'));
  } else {
    pc.hline(15, 32, 31 + b, col(c, 'rib0'));
    pc.hline(15, 32, 32 + b, col(c, 'rib1'));
    pc.set(24, 32 + b, col(c, 'zap'));
  }

  // Estallido naranja-rojo de la coleta trasera (arriba-derecha)
  ipoly(
    pc,
    [[27, 8 + b], [33, 3 + b], [35, 6 + b], [41, 5 + b], [38, 10 + b], [41, 13 + b], [33, 14 + b]],
    col(c, 'flare0'),
  );
  pc.poly([[30, 8 + b], [34, 4 + b], [38, 9 + b]], col(c, 'flare1'));

  // Cabeza y cara contorneada
  dshaded(pc, 24, 16 + b, 8, 7, [c.s0, c.s1, c.s2]);

  // Cabellera picuda dorada estilo anime
  ipoly(
    pc,
    [[14, 14 + b], [8, 13 + b], [13, 9 + b], [12, 4 + b], [20, 6 + b], [24, 3 + b], [28, 6 + b], [35, 4 + b], [33, 10 + b], [38, 14 + b], [32, 15 + b]],
    col(c, 'h1'),
  );
  pc.poly([[16, 10 + b], [23, 4 + b], [29, 9 + b]], col(c, 'h0'));

  if (p.view === 'up') {
    dshaded(pc, 24, 14 + b, 8.2, 6.8, [c.h0, c.h1, c.h2]);
    // Puntas picudas traseras en vista superior/espalda (no círculo liso)
    ipoly(pc, [[14, 15 + b], [10, 18 + b], [16, 21 + b], [20, 19 + b], [24, 23 + b], [28, 19 + b], [32, 21 + b], [37, 17 + b], [33, 15 + b]], col(c, 'h1'));
    pc.rect(28, 8 + b, 4, 2, col(c, 'band0'));
  } else {
    pc.rect(16, 9 + b, 16, 3, DARK);
    pc.hline(17, 30, 10 + b, col(c, 'band0'));
    pc.hline(17, 30, 11 + b, col(c, 'band1'));
    ipoly(pc, [[15, 11 + b], [19, 11 + b], [17, 16 + b]], col(c, 'h0'));
    ipoly(pc, [[20, 11 + b], [25, 11 + b], [23, 15 + b]], col(c, 'h0'));
    ipoly(pc, [[26, 11 + b], [32, 11 + b], [30, 17 + b]], col(c, 'h1'));
    // Ojos carmesí en y=14 + rayo blanco en mejilla + sonrisa abierta sobre barbilla limpia
    const exs = p.view === 'right' ? [26] : [18, 26];
    animeEyes(pc, exs, 14 + b, p, col(c, 'eye0'), rgba('#ff9ca2'), col(c, 'h2'), col(c, 'eye1'));
    if (p.view === 'down') {
      pc.hline(29, 31, 18 + b, col(c, 'trim'));
      pc.set(28, 19 + b, col(c, 'trim'));
      if (p.eyes === 'open') {
        pc.rect(22, 19 + b, 3, 2, col(c, 'shoe1'));
        pc.set(23, 20 + b, col(c, 'rib0'));
      }
    } else {
      pc.hline(27, 30, 18 + b, col(c, 'trim'));
      if (p.eyes === 'open') pc.rect(28, 20 + b, 2, 2, col(c, 'shoe1'));
    }
  }

  // Brazos bronceados con muñequeras blancas gruesas + golpe eléctrico
  const up = p.arms === 3 ? -7 : 0;
  const strike = p.anim === 'attack' && (p.f === 1 || p.f === 2);
  const arm = (x: number, y: number, punch = false) => {
    if (punch) {
      ibox(pc, x, y, 9, 5, skinT, 1);
      ibox(pc, x + 2, y, 4, 5, [c.trim, c.trim, c.trimS, c.trimS], 0);
      pc.ellipse(x + 10, y + 2, 2.8, 2.8, col(c, 'zap', 220));
    } else {
      ibox(pc, x, y, 5, 6, skinT, 1);
      ibox(pc, x, y + 3, 5, 4, [c.trim, c.trim, c.trimS, c.trimS], 0);
    }
  };
  if (p.view === 'right') {
    if (p.anim === 'attack') {
      const ax = 24 + p.arms * 2;
      arm(ax, 25 + b, true);
      if (strike) {
        pc.line(ax + 6, 18 + b, ax + 12, 26 + b, col(c, 'zap'));
        pc.line(ax + 12, 26 + b, ax + 7, 34 + b, col(c, 'zap'));
        pc.line(ax + 5, 20 + b, ax + 10, 26 + b, rgba('#ffffff', 235));
        pc.line(ax + 10, 26 + b, ax + 6, 32 + b, rgba('#ffffff', 235));
        pc.set(ax + 13, 22 + b, col(c, 'aura'));
        pc.set(ax + 13, 30 + b, rgba('#5ff2ff'));
      }
    } else arm(24 + Math.round(p.swing * 3), 26 + b + up);
  } else if (p.anim === 'attack' && p.view === 'down') {
    arm(11, 26 + b + p.arms);
    arm(31, 28 + b + p.arms * 2, true);
    if (strike) {
      pc.line(14, 37 + b + p.arms, 24, 44 + b + p.arms, col(c, 'zap'));
      pc.line(24, 44 + b + p.arms, 36, 38 + b + p.arms, col(c, 'zap'));
      pc.line(16, 36 + b + p.arms, 24, 42 + b + p.arms, rgba('#ffffff', 235));
      pc.line(24, 42 + b + p.arms, 34, 37 + b + p.arms, rgba('#ffffff', 235));
      pc.set(24, 45 + b + p.arms, rgba('#5ff2ff'));
    }
  } else if (p.anim === 'attack' && p.view === 'up') {
    arm(11, 25 + b);
    arm(32, 17 + b - p.arms * 2);
    if (strike) {
      pc.line(13, 12 + b, 24, 5 + b, col(c, 'zap'));
      pc.line(24, 5 + b, 37, 12 + b, col(c, 'zap'));
      pc.line(15, 13 + b, 24, 7 + b, rgba('#ffffff', 235));
      pc.line(24, 7 + b, 35, 13 + b, rgba('#ffffff', 235));
      pc.set(24, 4 + b, rgba('#5ff2ff'));
    }
  } else {
    arm(11, 25 + b + Math.round(p.swing * 2) + up);
    arm(32, 25 + b - Math.round(p.swing * 2) + up);
  }

  if (p.cast > 0) {
    pc.line(4, 21 + b, 12, 21 + b, col(c, 'rib0'));
    pc.line(5, 28 + b, 13, 28 + b, col(c, 'zap'));
    pc.ring(CX, 27 + b, 17 * p.cast, 19 * p.cast, col(c, 'aura', 180));
  }
};

// ===========================================================================
// 3. RANGO (Distancia) — Piel clara crema-durazno fiel al póster, pelo castaño con
//    dos mechones rubios curvos en punta de flecha + ahoge rojo, cicatrices, pañuelo
//    naranja con triángulo interior, tapado oliva con solapas crema y ballesta.
// ===========================================================================
const drawRango: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 12);
  const stepA = Math.round(p.step * 2);
  const coatT = [c.coat0, c.coat1, c.coat2, c.coat2];
  const pantT = [c.pant0, c.pant1, c.h2, c.h2];
  const skinT = [c.s0, c.s1, c.s2, c.s2];

  // Piernas con pantalón oliva-marrón, pelvis unida y botas oscuras
  const leg = (x: number, lift: number) => {
    const yy = 37 - Math.max(0, lift);
    ibox(pc, x, yy, 7, 7, pantT, 0);
    ibox(pc, x, yy + 6, 7, 5, [c.h1, c.h2, c.h2, c.h2], 1);
    pc.hline(x + 1, x + 5, yy + 6, col(c, 'pant0'));
  };
  if (p.view === 'right') {
    leg(15 - stepA, -stepA);
    leg(25 + stepA, stepA);
    ibox(pc, 15, 34 + b, 17, 5, pantT, 0);
  } else {
    leg(14, stepA);
    leg(27, -stepA);
    ibox(pc, 14, 34 + b, 19, 5, pantT, 0);
  }

  // Tapado verde oliva largo con solapas anchas crema + remera carbón + hebilla X-O
  ipoly(pc, [[13, 24 + b], [34, 24 + b], [37, 41 + b], [10, 41 + b]], col(c, 'coat1'));
  pc.vline(12, 26 + b, 40 + b, col(c, 'coat0'));
  pc.vline(35, 26 + b, 40 + b, col(c, 'coat2'));
  if (p.view !== 'up') {
    ibox(pc, 19, 25 + b, 10, 10, [c.shirt, c.shirt, c.bow2, c.bow2], 0);
    pc.vline(24, 28 + b, 32 + b, col(c, 'bow2'));
    pc.poly([[12, 35 + b], [17, 35 + b], [15, 40 + b], [11, 40 + b]], col(c, 'lapel'));
    pc.poly([[30, 35 + b], [35, 35 + b], [36, 40 + b], [32, 40 + b]], col(c, 'lapel'));
    ipoly(pc, [[15, 25 + b], [20, 25 + b], [19, 33 + b], [14, 30 + b]], col(c, 'lapel'));
    ipoly(pc, [[27, 25 + b], [32, 25 + b], [33, 30 + b], [28, 33 + b]], col(c, 'lapel'));
    pc.rect(16, 33 + b, 15, 3, DARK);
    pc.hline(17, 30, 34 + b, col(c, 'h2'));
    ibox(pc, 21, 32 + b, 6, 5, [c.buckle, c.bang1, c.h2, c.h2], 0);
    pc.set(23, 34 + b, col(c, 'h1'));
    pc.set(24, 34 + b, col(c, 'h1'));
  } else {
    pc.hline(12, 35, 39 + b, col(c, 'lapel'));
    pc.line(18, 25 + b, 17, 38 + b, col(c, 'coat2'));
    pc.line(29, 25 + b, 30, 38 + b, col(c, 'coat2'));
  }

  // Cola en flecha dorada saliendo atrás + pañuelo triangular naranja con triángulo interior
  ipoly(pc, [[14, 22 + b], [8, 21 + b], [10, 24 + b], [14, 24 + b]], col(c, 'bang0'));
  ipoly(pc, [[15, 22 + b], [32, 22 + b], [29, 27 + b], [24, 29 + b], [18, 27 + b]], col(c, 'scarf0'));
  if (p.view !== 'up') {
    pc.poly([[21, 24 + b], [26, 24 + b], [24, 27 + b]], col(c, 's1'));
    pc.hline(17, 30, 22 + b, col(c, 'scarf1'));
  }

  // Cabeza amplia piel clara crema-durazno + orejas + cicatrices
  dshaded(pc, 24, 15 + b, 7.8, 7.2, [c.s0, c.s1, c.s2]);
  if (p.view === 'down') {
    pc.rect(15, 14 + b, 2, 3, DARK);
    pc.set(15, 15 + b, col(c, 's1'));
    pc.rect(31, 14 + b, 2, 3, DARK);
    pc.set(31, 15 + b, col(c, 's1'));
  }

  // Ahoge flecha roja arriba
  ipoly(pc, [[22, 6 + b], [24, 3 + b], [28, 4 + b], [25, 6 + b]], col(c, 'crest'));

  // Cabello castaño en capas pegado a la cabeza (sin forma de sombrero)
  dshaded(pc, 24, 10 + b, 8.2, 4.4, [c.h0, c.h1, c.h2]);
  ipoly(pc, [[15, 10 + b], [11, 12 + b], [14, 15 + b], [17, 13 + b]], col(c, 'h1'));
  ipoly(pc, [[32, 10 + b], [36, 12 + b], [33, 15 + b], [30, 13 + b]], col(c, 'h2'));

  if (p.view === 'up') {
    dshaded(pc, 24, 14 + b, 8.2, 6.8, [c.h0, c.h1, c.h2]);
    ipoly(pc, [[15, 18 + b], [19, 22 + b], [24, 19 + b], [29, 22 + b], [33, 18 + b]], col(c, 'h1'));
  } else {
    // Dos mechones rubios curvos bajando por la frente con puntas en flecha hacia los lados
    ipoly(pc, [[23, 7 + b], [19, 8 + b], [17, 13 + b], [14, 14 + b], [17, 16 + b], [21, 11 + b]], col(c, 'bang0'));
    ipoly(pc, [[25, 7 + b], [29, 8 + b], [31, 13 + b], [34, 14 + b], [31, 16 + b], [27, 11 + b]], col(c, 'bang1'));
    // Ojos verde esmeralda + cicatriz en nariz y mejilla
    const exs = p.view === 'right' ? [26] : [18, 26];
    animeEyes(pc, exs, 14 + b, p, col(c, 'eye'), col(c, 'lapel'), col(c, 'h1'));
    if (p.view === 'down') {
      pc.hline(23, 25, 17 + b, col(c, 'scar'));
      pc.line(18, 18 + b, 21, 20 + b, col(c, 'scar'));
      pc.hline(22, 25, 20 + b, col(c, 'scar'));
    } else {
      pc.hline(26, 28, 17 + b, col(c, 'scar'));
      pc.hline(27, 29, 20 + b, col(c, 'scar'));
    }
  }

  // Mangas recogidas con puño crema + antebrazos piel clara + ballesta táctica
  const up = p.arms === 3 ? -6 : 0;
  const strike = p.anim === 'attack' && (p.f === 1 || p.f === 2);
  const sleeveArm = (x: number, y: number) => {
    ibox(pc, x, y, 5, 6, coatT, 1);
    ibox(pc, x, y + 4, 5, 3, [c.lapel, c.lapel, c.s2, c.s2], 0);
    ibox(pc, x, y + 6, 5, 4, skinT, 1);
  };
  const drawCrossbow = (x: number, y: number, aiming: boolean) => {
    pc.rect(x - 1, y - 1, 10, 4, DARK);
    pc.hline(x, x + 7, y, col(c, 'bow0'));
    pc.hline(x + 2, x + 8, y + 1, col(c, 'h2'));
    pc.vline(x + 7, y - 4, y + 5, DARK);
    pc.vline(x + 8, y - 3, y + 4, col(c, 'bow1'));
    pc.set(x + 6, y - 4, col(c, 'bow2'));
    pc.set(x + 6, y + 5, col(c, 'bow2'));
    if (aiming && !strike) {
      pc.line(x + 6, y - 3, x + 2, y, col(c, 'lapel'));
      pc.line(x + 6, y + 4, x + 2, y, col(c, 'lapel'));
      pc.hline(x + 2, x + 10, y, col(c, 'bolt'));
    } else if (strike || p.cast > 0) {
      pc.hline(x + 8, x + 14, y, col(c, 'bolt'));
      pc.ellipse(x + 11, y, 3, 3, col(c, 'aura', 215));
      pc.set(x + 13, y - 2, rgba('#ffffff'));
      pc.set(x + 13, y + 2, rgba('#ffffff'));
    } else {
      pc.line(x + 7, y - 3, x + 4, y, col(c, 'lapel'));
      pc.line(x + 7, y + 4, x + 4, y, col(c, 'lapel'));
    }
  };
  if (p.view === 'right') {
    sleeveArm(21, 25 + b + up);
    drawCrossbow(24 + (p.anim === 'attack' ? p.arms : 0), 29 + b + up, p.anim === 'attack');
  } else if (p.anim === 'attack' && p.view === 'down') {
    sleeveArm(10, 26 + b);
    sleeveArm(32, 26 + b + p.arms);
    drawCrossbow(28, 34 + b + p.arms, true);
    if (strike) {
      pc.vline(35, 37 + b + p.arms, 45 + b + p.arms, col(c, 'bolt'));
      pc.ellipse(35, 41 + b + p.arms, 3.2, 2.5, col(c, 'aura', 215));
    }
  } else if (p.anim === 'attack' && p.view === 'up') {
    sleeveArm(10, 26 + b);
    sleeveArm(32, 21 + b - p.arms * 2);
    drawCrossbow(29, 17 + b - p.arms * 2, true);
    if (strike) {
      pc.vline(36, 7 + b - p.arms * 2, 16 + b - p.arms * 2, col(c, 'bolt'));
      pc.ellipse(36, 11 + b - p.arms * 2, 3.2, 2.5, col(c, 'aura', 215));
    }
  } else {
    sleeveArm(10, 26 + b + up);
    sleeveArm(32, 26 + b + up);
    drawCrossbow(29, 33 + b, false);
  }

  if (p.cast > 0) {
    pc.ring(CX, 27 + b, 17 * p.cast, 19 * p.cast, col(c, 'aura', 180));
  }
};

// ===========================================================================
// 4. WIMMI (Support) — Piel muy clara marfil-rosada fiel al póster, pelo verde neón
//    en dos rodetes esponjosos + auriculares cian + tiara de cristal, pinturas
//    triangulares bajo ojos heterocromáticos y lengüita rosa, remera blanca médica
//    con colgante triángulo, cruz verde neón en X, bolso cian y dron estrella.
// ===========================================================================
const drawWimmi: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 11);
  const stepA = Math.round(p.step * 2);
  const shirtT = [c.shirt0, c.shirt1, c.shirt2, c.shirt2];
  const shortT = [c.short0, c.short1, c.h2, c.h2];
  const skinT = [c.s0, c.s1, c.s2, c.s2];

  // Piernas muy claras, shorts verde neón con bomba blanca y zapatillas cian/blancas
  const leg = (x: number, lift: number, hasBomb: boolean) => {
    const yy = 36 - Math.max(0, lift);
    ibox(pc, x, yy, 6, 6, shortT, 0);
    if (hasBomb) pc.rect(x + 2, yy + 3, 2, 2, col(c, 'shirt0'));
    ibox(pc, x + 1, yy + 5, 4, 4, skinT, 0);
    ibox(pc, x, yy + 8, 6, 4, [c.head0, c.head1, c.shirt2, c.shirt2], 1);
    pc.hline(x + 1, x + 4, yy + 10, col(c, 'shirt0'));
  };
  if (p.view === 'right') {
    leg(15 - stepA, -stepA, false);
    leg(25 + stepA, stepA, true);
    ibox(pc, 16, 34 + b, 15, 4, shortT, 0);
  } else {
    leg(15, stepA, true);
    leg(27, -stepA, false);
    ibox(pc, 15, 34 + b, 17, 4, shortT, 0);
    pc.vline(20, 35 + b, 37 + b, col(c, 'shirt0'));
    pc.vline(27, 35 + b, 37 + b, col(c, 'shirt0'));
  }

  // Remera blanca médica limpia (interior blanco nítido) + triángulo dorado + parche X + bolso cian
  ibox(pc, 15, 24 + b, 18, 12, [c.shirt0, c.shirt0, c.shirt1, c.shirt1], 1);
  if (p.view !== 'up') {
    pc.vline(24, 25 + b, 34 + b, col(c, 'head0'));
    // Colgante triángulo dorado invertido al cuello
    pc.poly([[21, 25 + b], [26, 25 + b], [24, 28 + b]], col(c, 'crown'));
    pc.line(21, 25 + b, 24, 28 + b, DARK);
    pc.line(26, 25 + b, 24, 28 + b, DARK);
    // Correa fina diagonal + parche X verde neón bien visible en la cadera izquierda
    pc.line(17, 25 + b, 29, 33 + b, col(c, 'bag1'));
    pc.line(26, 29 + b, 30, 33 + b, col(c, 'cross'));
    pc.line(30, 29 + b, 26, 33 + b, col(c, 'cross'));
    // Bolso mensajero cian con hebilla dorada y cruz verde
    ibox(pc, 29, 32 + b, 9, 8, [c.bag0, c.bag1, c.bag1, c.bag1], 1);
    pc.set(32, 32 + b, col(c, 'crown'));
    pc.hline(32, 34, 36 + b, col(c, 'cross'));
    pc.vline(33, 35 + b, 37 + b, col(c, 'cross'));
  } else {
    pc.line(17, 26 + b, 30, 34 + b, col(c, 'bag1'));
    pc.hline(22, 25, 29 + b, col(c, 'cross'));
  }

  // Rodetes gemelos esponjosos verde neón (arriba izq/der) + mechones laterales
  dshaded(pc, 13, 10 + b, 3.6, 3.4, [c.h0, c.h1, c.h2]);
  pc.set(9, 8 + b, col(c, 'h0'));
  dshaded(pc, 35, 10 + b, 3.6, 3.4, [c.h0, c.h1, c.h2]);
  pc.set(39, 8 + b, col(c, 'h0'));
  ipoly(pc, [[15, 15 + b], [10, 18 + b], [14, 20 + b]], col(c, 'h1'));
  ipoly(pc, [[32, 15 + b], [37, 18 + b], [33, 20 + b]], col(c, 'h1'));

  // Cabeza con piel muy clara marfil-rosada
  dshaded(pc, 24, 16 + b, 7.6, 6.8, [c.s0, c.s1, c.s2]);

  // Masa de pelo verde neón + tiara de cristal cian y amarillo + vincha cian
  dshaded(pc, 24, 10 + b, 8.2, 4.4, [c.h0, c.h1, c.h2]);
  ipoly(pc, [[19, 8 + b], [20, 4 + b], [22, 6 + b], [24, 3 + b], [26, 6 + b], [28, 4 + b], [29, 8 + b]], col(c, 'head0'));
  pc.rect(22, 5 + b, 4, 3, col(c, 'crown'));
  pc.rect(16, 8 + b, 16, 3, DARK);
  pc.hline(17, 30, 9 + b, col(c, 'head0'));
  pc.hline(17, 30, 10 + b, col(c, 'head1'));

  if (p.view === 'up') {
    dshaded(pc, 24, 15 + b, 8.4, 6.6, [c.h0, c.h1, c.h2]);
    ipoly(pc, [[15, 19 + b], [19, 23 + b], [24, 20 + b], [29, 23 + b], [33, 19 + b]], col(c, 'h1'));
  } else {
    ipoly(pc, [[16, 11 + b], [22, 11 + b], [19, 14 + b]], col(c, 'h0'));
    ipoly(pc, [[24, 11 + b], [31, 11 + b], [29, 14 + b]], col(c, 'h1'));
    pc.poly([[15, 14 + b], [17, 14 + b], [16, 24 + b]], col(c, 'h1'));
    pc.poly([[31, 14 + b], [33, 14 + b], [32, 24 + b]], col(c, 'h1'));
    // Ojos heterocromáticos en y=13 + triángulos verdes + rayas cian + sonrisa con lengüita rosa en y=19..20 (sobre barbilla sólida)
    const exs = p.view === 'right' ? [26] : [18, 26];
    animeEyes(pc, exs, 13 + b, p, col(c, 'eyeR'), col(c, 'crown'), col(c, 'h2'), rgba('#ffffff'), col(c, 'eye'));
    if (p.view === 'down') {
      pc.hline(17, 20, 17 + b, col(c, 'cross'));
      pc.hline(27, 30, 17 + b, col(c, 'cross'));
      pc.hline(17, 19, 18 + b, col(c, 'cheek'));
      pc.hline(28, 30, 18 + b, col(c, 'cheek'));
      if (p.eyes === 'open' || p.eyes === 'happy') {
        pc.hline(22, 25, 19 + b, DARK);
        pc.set(24, 20 + b, col(c, 'tongue'));
      }
    } else {
      pc.hline(26, 29, 17 + b, col(c, 'cross'));
      pc.hline(27, 29, 18 + b, col(c, 'cheek'));
    }
    pc.ellipse(14, 15 + b, 2.2, 2.5, DARK);
    pc.ellipse(14, 15 + b, 1.4, 1.7, col(c, 'head0'));
    pc.ellipse(34, 15 + b, 2.2, 2.5, DARK);
    pc.ellipse(34, 15 + b, 1.4, 1.7, col(c, 'head1'));
  }

  // Brazos claros con manga asimétrica cian/verde, pulsera y guantes oscuros sin dedos
  const up = p.arms === 3 ? -7 : 0;
  const arm = (x: number, y: number, hasBand: boolean) => {
    ibox(pc, x, y, 5, 5, shirtT, 1);
    if (hasBand) pc.hline(x + 1, x + 3, y + 2, col(c, 'head0'));
    ibox(pc, x, y + 4, 5, 5, skinT, 1);
    if (!hasBand) pc.hline(x + 1, x + 3, y + 6, col(c, 'head0'));
    pc.rect(x + 1, y + 7, 3, 2, DARK);
  };
  if (p.view === 'right') {
    arm(23 + (p.anim === 'attack' ? p.arms * 2 : Math.round(p.swing * 2)), 25 + b + up, true);
  } else if (p.anim === 'attack' && p.view === 'up') {
    arm(11, 25 + b, false);
    arm(32, 19 + b - p.arms * 2, true);
  } else {
    arm(11, 25 + b + Math.round(p.swing * 2) + up, false);
    arm(32, 25 + b - Math.round(p.swing * 2) + up + (p.anim === 'attack' ? p.arms : 0), true);
  }

  // Dron médico flotante en estrella de 4 puntas + pulso al atacar (dentro de x<=41)
  const atk = p.anim === 'attack';
  const strike = atk && (p.f === 1 || p.f === 2);
  const dy = atk
    ? p.view === 'down'
      ? 24 + b + p.arms * 2
      : p.view === 'up'
        ? 11 + b - p.arms * 2
        : 21 + b
    : 13 + Math.round(Math.sin(p.f * 1.4) * 2);
  const dx = p.view === 'right' ? (atk ? 34 + p.arms : 38) : 39;
  pc.ellipse(dx, dy, 3.2, 3.2, DARK);
  pc.ellipse(dx, dy, 2.3, 2.3, col(c, 'drone1'));
  pc.ellipse(dx, dy, 1.4, 1.4, col(c, 'drone0'));
  if (atk && p.f === 1) {
    pc.line(dx - 3, dy - 3, dx + 3, dy + 3, col(c, 'droneEye'));
    pc.line(dx - 3, dy + 3, dx + 3, dy - 3, col(c, 'droneEye'));
  } else {
    pc.hline(dx - 3, dx + 3, dy, col(c, 'droneEye'));
    pc.vline(dx, dy - 3, dy + 3, col(c, 'droneEye'));
  }
  if (strike) {
    if (p.view === 'right') {
      pc.hline(dx + 3, dx + 6, dy, col(c, 'aura'));
      pc.ellipse(dx + 4, dy, 2, 3, rgba('#ffffff', 220));
    } else if (p.view === 'down') {
      pc.vline(dx, dy + 3, dy + 7, col(c, 'aura'));
      pc.ellipse(dx, dy + 5, 3, 2, rgba('#ffffff', 220));
    } else {
      pc.vline(dx, dy - 7, dy - 3, col(c, 'aura'));
      pc.ellipse(dx, dy - 5, 3, 2, rgba('#ffffff', 220));
    }
  }

  if (p.cast > 0) {
    pc.ring(CX, 28 + b, 18 * p.cast, 18 * p.cast, col(c, 'aura', 190));
    pc.hline(7, 9, 20 + b, col(c, 'cross'));
    pc.vline(8, 19 + b, 21 + b, col(c, 'cross'));
  }
};

// ===========================================================================
// 5. GIGA / GOLEM (Defensor) — Gólem masivo de roca arenisca agrietada, casco de
//    hierro remachado con cresta y visor naranja, núcleo bombilla en el pecho,
//    bombas en el cinturón, hombreras rocosas con aguja/picos/bandera, taladro
//    cónico gigante con engranaje en el codo y escudo torre remachado.
// ===========================================================================
const drawGiga: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 15);
  const stepA = Math.round(p.step * 2);
  const rockT = [c.r0, c.r1, c.r2, c.r3];
  const metalT = [c.m0, c.m1, c.m2, c.m2];

  // Piernas robustas de piedra con rodilleras metálicas y botas anchas con correas de acero
  const leg = (x: number, lift: number) => {
    const yy = 36 - Math.max(0, lift);
    ibox(pc, x, yy, 8, 8, rockT, 1);
    ibox(pc, x + 1, yy + 1, 6, 4, metalT, 0);
    ibox(pc, x - 1, yy + 7, 10, 5, metalT, 1);
    pc.rect(x + 1, yy + 8, 6, 2, col(c, 'r1'));
  };
  if (p.view === 'right') {
    leg(14 - stepA, -stepA);
    leg(25 + stepA, stepA);
    ibox(pc, 15, 34 + b, 17, 5, rockT, 1);
  } else {
    leg(12, stepA);
    leg(28, -stepA);
    ibox(pc, 14, 34 + b, 20, 5, rockT, 1);
  }

  // Escudo lejano detrás del cuerpo en vista derecha
  const drawShield = (sx: number, sy: number) => {
    ibox(pc, sx, sy, 10, 17, metalT, 1);
    ibox(pc, sx + 1, sy + 2, 8, 13, [c.shield0, c.shield1, c.r2, c.r2], 1);
    pc.hline(sx + 3, sx + 7, sy + 7, col(c, 'r3'));
    pc.vline(sx + 5, sy + 4, sy + 12, col(c, 'r3'));
    pc.set(sx + 1, sy + 1, col(c, 'drill0'));
    pc.set(sx + 8, sy + 1, col(c, 'drill0'));
    pc.set(sx + 1, sy + 15, col(c, 'drill0'));
    pc.set(sx + 8, sy + 15, col(c, 'drill0'));
  };
  if (p.view === 'right') {
    drawShield(30 + (p.anim === 'attack' ? p.arms : 0), 21 + b);
  }

  // Torso macizo de piedra arenisca con grietas estructurales limpias, placas, cinturón y bombas
  ibox(pc, 11, 18 + b, 26, 18, rockT, 2);
  // Fisuras geométricas limpias de piedra (en lugar de ruido aleatorio)
  pc.line(14, 22 + b, 19, 25 + b, col(c, 'r3'));
  pc.line(19, 25 + b, 17, 30 + b, col(c, 'r3'));
  pc.line(33, 23 + b, 28, 27 + b, col(c, 'r3'));
  pc.line(28, 27 + b, 30, 31 + b, col(c, 'r3'));
  pc.line(15, 29 + b, 22, 31 + b, col(c, 'r2'));
  // Placas metálicas laterales del pecho
  ibox(pc, 12, 19 + b, 5, 8, metalT, 0);
  ibox(pc, 31, 19 + b, 5, 8, metalT, 0);
  // Cinturón de cuero con hebilla metálica y dos bombas con mecha encendida
  pc.rect(12, 33 + b, 24, 3, DARK);
  pc.hline(13, 34, 34 + b, col(c, 'belt'));
  ibox(pc, 22, 32 + b, 5, 4, metalT, 0);
  if (p.view !== 'up') {
    pc.ellipse(15, 35 + b, 2.2, 2.2, DARK);
    pc.set(15, 35 + b, col(c, 'bomb'));
    pc.set(14, 32 + b, col(c, 'core1'));
    pc.ellipse(19, 35 + b, 2, 2, DARK);
    pc.set(19, 35 + b, col(c, 'bomb'));
  }

  // Núcleo ardiente tipo bombilla en el centro del pecho
  if (p.view !== 'up') {
    const glow = p.anim === 'cast' || p.f % 2 === 0;
    pc.ellipse(24, 26 + b, 4, 4, DARK);
    pc.ellipse(24, 26 + b, 3, 3, col(c, glow ? 'core1' : 'core0'));
    pc.set(24, 25 + b, col(c, 'core2'));
    pc.set(23, 26 + b, col(c, 'core2'));
  }

  // Estandarte desgarrado rojo/azul en el hombro + hombreras rocosas
  pc.vline(10, 4 + b, 17 + b, DARK);
  ipoly(pc, [[10, 4 + b], [4, 6 + b], [5, 10 + b], [10, 9 + b]], col(c, 'flag0'));
  pc.rect(6, 6 + b, 3, 2, col(c, 'flag1'));

  if (p.view === 'right') {
    ibox(pc, 17, 15 + b, 11, 9, rockT, 1);
    ipoly(pc, [[18, 15 + b], [21, 10 + b], [24, 15 + b]], col(c, 'r1'));
    pc.rect(23, 15 + b, 3, 2, col(c, 'moss'));
  } else {
    ibox(pc, 4, 15 + b, 10, 9, rockT, 1);
    ipoly(pc, [[5, 15 + b], [7, 11 + b], [9, 15 + b]], col(c, 'r1'));
    ipoly(pc, [[9, 15 + b], [11, 12 + b], [13, 15 + b]], col(c, 'r0'));
    pc.rect(11, 15 + b, 3, 2, col(c, 'moss'));

    ipoly(pc, [[35, 15 + b], [38, 7 + b], [41, 15 + b]], col(c, 'r1'));
    ibox(pc, 34, 15 + b, 10, 9, rockT, 1);
    pc.rect(35, 16 + b, 3, 2, col(c, 'moss'));
  }

  // Casco de hierro redondeado con cresta Mohawk, banda remachada y visor negro con ojos naranjas
  dshaded(pc, 24, 13 + b, 8, 6.8, [c.m0, c.m1, c.m2]);
  ibox(pc, 22, 5 + b, 4, 6, metalT, 0);
  pc.hline(17, 31, 11 + b, DARK);
  pc.hline(17, 31, 10 + b, col(c, 'm0'));
  if (p.view !== 'up') {
    const sx = p.view === 'right' ? 23 : 18;
    const sw = p.view === 'right' ? 9 : 13;
    pc.rect(sx, 13 + b, sw, 4, col(c, 'slit'));
    const ec = p.eyes === 'x' ? col(c, 'core2') : col(c, 'eye0');
    if (p.eyes === 'blink' || p.eyes === 'hurt') {
      pc.hline(sx + 1, sx + sw - 2, 15 + b, ec);
    } else if (p.view === 'right') {
      pc.rect(sx + 4, 14 + b, 3, 2, ec);
      pc.set(sx + 5, 14 + b, col(c, 'eye1'));
    } else {
      pc.rect(sx + 2, 14 + b, 3, 2, ec);
      pc.rect(sx + 8, 14 + b, 3, 2, ec);
      pc.set(sx + 3, 14 + b, col(c, 'eye1'));
      pc.set(sx + 9, 14 + b, col(c, 'eye1'));
    }
  }

  // TALADRO cónico gigante espiralado + engranaje en codo
  const strike = p.anim === 'attack' && (p.f === 1 || p.f === 2);
  const spin = p.anim === 'attack' ? (p.f % 2) : 0;
  const drawDrill = (dx: number, dy: number, orient: 'right' | 'down' | 'up', big = false) => {
    const len = big ? 14 : 12;
    if (orient === 'right') {
      ibox(pc, dx - 3, dy - 4, 4, 8, metalT, 0);
      ipoly(pc, [[dx, dy - 5], [dx + len, dy], [dx, dy + 5]], col(c, 'drill1'));
      pc.line(dx + 2 + spin, dy - 4, dx + 6 + spin, dy + 3, col(c, 'drill0'));
      pc.line(dx + 7 + spin, dy - 3, dx + 10 + spin, dy + 2, col(c, 'drill0'));
      pc.line(dx + 1, dy + 2, dx + 7, dy + 4, col(c, 'drill2'));
    } else if (orient === 'down') {
      ibox(pc, dx - 5, dy - 3, 10, 4, metalT, 0);
      ipoly(pc, [[dx - 5, dy], [dx + 5, dy], [dx, dy + len]], col(c, 'drill1'));
      pc.line(dx - 4, dy + 2 + spin, dx + 4, dy + 5 + spin, col(c, 'drill0'));
      pc.line(dx - 3, dy + 7 + spin, dx + 3, dy + 9 + spin, col(c, 'drill0'));
      pc.line(dx - 1, dy + 6, dx + 1, dy + len - 1, col(c, 'drill2'));
    } else {
      ibox(pc, dx - 5, dy, 10, 4, metalT, 0);
      ipoly(pc, [[dx - 5, dy], [dx + 5, dy], [dx, dy - len]], col(c, 'drill1'));
      pc.line(dx - 4, dy - 2 - spin, dx + 4, dy - 5 - spin, col(c, 'drill0'));
      pc.line(dx - 3, dy - 7 - spin, dx + 3, dy - 9 - spin, col(c, 'drill0'));
      pc.line(dx - 1, dy - 6, dx + 1, dy - len + 1, col(c, 'drill2'));
    }
  };

  const drillUp = p.arms === 3 ? -7 : 0;
  if (p.view === 'right') {
    if (p.anim === 'attack') {
      const dx = 22 + p.arms * 2;
      drawDrill(dx, 28 + b, 'right', strike);
      if (strike) {
        pc.ellipse(dx + 14, 28 + b, 2.8, 5.8, rgba('#ffea70', 225));
        pc.vline(dx + 15, 24 + b, 32 + b, rgba('#ffffff', 230));
      }
    } else {
      pc.ellipse(20, 24 + b, 2.5, 2.5, DARK);
      pc.set(20, 24 + b, col(c, 'm0'));
      drawDrill(22, 29 + b + drillUp, p.anim === 'cast' ? 'right' : 'down');
    }
  } else if (p.anim === 'attack' && p.view === 'up') {
    drawDrill(7, 22 + b - p.arms * 2, 'up', strike);
    drawShield(35, 20 + b - p.arms);
    if (strike) {
      pc.ellipse(7, 8 + b - p.arms * 2, 5.2, 2.2, rgba('#ffea70', 225));
      pc.hline(3, 11, 7 + b - p.arms * 2, rgba('#ffffff', 230));
    }
  } else if (p.anim === 'attack' && p.view === 'down') {
    drawDrill(7, 26 + b + p.arms, 'down', strike);
    drawShield(35, 23 + b + p.arms);
    if (strike) {
      pc.ellipse(7, 41 + b + p.arms, 5.2, 2.2, rgba('#ffea70', 225));
      pc.hline(3, 11, 42 + b + p.arms, rgba('#ffffff', 230));
    }
  } else {
    pc.ellipse(7, 24 + b, 2.5, 2.5, DARK);
    pc.set(7, 24 + b, col(c, 'm0'));
    drawDrill(7, 28 + b + Math.round(p.swing * 2) + drillUp, 'down');
    drawShield(35, 22 + b + (p.anim === 'cast' ? -3 : 0));
  }

  if (p.cast > 0) {
    pc.ring(CX, 30 + b, 20 * p.cast, 18 * p.cast, col(c, 'aura', 185));
    pc.rect(7, 43, 5, 3, col(c, 'r1'));
    pc.rect(35, 43, 5, 3, col(c, 'r1'));
  }
};

// ===========================================================================
// 6. VASKIL (Controlador) — Piel clara durazno, gorra blanca plana con pin de bomba
//    y penacho dorado, pelo violeta picudo con puntas doradas, ojos naranjas espiral,
//    sonrisa amplia con marcas violetas en mejillas, chaleco ciruela con hombreras en
//    punta y broches dorados, faja con rombos, vendas blancas y llamas astrales.
// ===========================================================================
const drawVaskil: DrawFn = (pc, p, c) => {
  const b = beginFrame(pc, p, 11);
  const stepA = Math.round(p.step * 2);
  const vestT = [c.vest0, c.vest1, c.vest2, c.vest2];
  const pantT = [c.pant0, c.pant1, c.vest2, c.vest2];
  const skinT = [c.s0, c.s1, c.s2, c.s2];

  // Piernas moradas con franja blanca horizontal en cadera + botas
  const leg = (x: number, lift: number) => {
    const yy = 36 - Math.max(0, lift);
    ibox(pc, x, yy, 7, 8, pantT, 0);
    ibox(pc, x, yy + 7, 7, 5, [c.scarf0, c.scarf1, c.vest2, c.vest2], 1);
  };
  if (p.view === 'right') {
    leg(15 - stepA, -stepA);
    leg(25 + stepA, stepA);
    ibox(pc, 15, 35 + b, 17, 5, pantT, 0);
    pc.hline(16, 30, 37 + b, col(c, 'wrap'));
  } else {
    leg(14, stepA);
    leg(27, -stepA);
    ibox(pc, 14, 35 + b, 19, 5, pantT, 0);
    pc.hline(15, 31, 37 + b, col(c, 'wrap'));
  }

  // Chaleco morado ciruela luminoso con hombreras angulosas puntiagudas + camisa ocre + faja con rombos
  ipoly(pc, [[9, 23 + b], [38, 23 + b], [35, 34 + b], [12, 34 + b]], col(c, 'vest1'));
  pc.hline(11, 36, 24 + b, col(c, 'vest0'));
  if (p.view !== 'up') {
    ibox(pc, 18, 24 + b, 12, 11, [c.shirt0, c.shirt1, c.scarf1, c.scarf1], 0);
    for (let k = 0; k < 4; k++) {
      const yy = 25 + k * 2 + b;
      pc.set(17, yy, col(c, 'plume'));
      pc.set(30, yy, col(c, 'plume'));
    }
    ibox(pc, 16, 32 + b, 16, 5, [c.shirt0, c.shirt1, c.scarf1, c.scarf1], 0);
    pc.set(19, 34 + b, col(c, 'plume'));
    pc.set(24, 34 + b, col(c, 'plume'));
    pc.set(28, 34 + b, col(c, 'plume'));
    pc.set(24, 33 + b, DARK);
    pc.set(24, 35 + b, DARK);
  } else {
    pc.poly([[14, 25 + b], [33, 25 + b], [34, 35 + b], [13, 35 + b]], col(c, 'vest0'));
    pc.line(18, 25 + b, 16, 34 + b, col(c, 'vest2'));
    pc.line(29, 25 + b, 31, 34 + b, col(c, 'vest2'));
    pc.set(20, 29 + b, col(c, 'wisp0'));
    pc.set(27, 32 + b, col(c, 'wisp0'));
  }

  // Pañuelo/bufanda marrón enrollado al cuello
  ibox(pc, 16, 21 + b, 16, 4, [c.scarf0, c.scarf1, c.vest2, c.vest2], 1);
  pc.hline(18, 29, 22 + b, col(c, 'scarf1'));

  // Cabeza con piel clara + pelo violeta picudo con puntas doradas saliendo a los lados
  ipoly(pc, [[15, 11 + b], [8, 12 + b], [11, 15 + b], [9, 19 + b], [16, 20 + b]], col(c, 'h0'));
  pc.set(9, 12 + b, col(c, 'tuft'));
  pc.set(10, 19 + b, col(c, 'tuft'));
  ipoly(pc, [[32, 11 + b], [39, 12 + b], [36, 15 + b], [38, 19 + b], [31, 20 + b]], col(c, 'h1'));
  pc.set(38, 12 + b, col(c, 'tuft'));
  pc.set(37, 19 + b, col(c, 'tuft'));

  dshaded(pc, 24, 15 + b, 7.6, 6.8, [c.s0, c.s1, c.s2]);

  if (p.view === 'up') {
    dshaded(pc, 24, 15 + b, 8.2, 6.2, [c.h0, c.h1, c.h2]);
    ipoly(pc, [[15, 18 + b], [19, 22 + b], [24, 19 + b], [29, 22 + b], [33, 18 + b]], col(c, 'h0'));
  } else {
    ipoly(pc, [[16, 11 + b], [21, 11 + b], [18, 15 + b]], col(c, 'h0'));
    ipoly(pc, [[27, 11 + b], [32, 11 + b], [29, 15 + b]], col(c, 'h1'));
    const exs = p.view === 'right' ? [26] : [18, 26];
    animeEyes(pc, exs, 14 + b, p, col(c, 'eye'), col(c, 'plume'), col(c, 'h2'));
    if (p.view === 'down') {
      pc.rect(17, 18 + b, 2, 2, col(c, 'mark'));
      pc.rect(29, 18 + b, 2, 2, col(c, 'mark'));
      if (p.eyes === 'open' || p.eyes === 'happy') {
        pc.hline(21, 26, 19 + b, DARK);
        pc.hline(21, 26, 20 + b, col(c, 'wrap'));
        pc.hline(22, 25, 21 + b, DARK);
      }
    } else {
      pc.rect(27, 18 + b, 2, 2, col(c, 'mark'));
      if (p.eyes === 'open') pc.hline(28, 30, 20 + b, col(c, 'wrap'));
    }
  }

  // Gorra blanca plana + penacho doble amarillo-dorado + pin bomba oscura con mecha roja
  const hb = b;
  ipoly(pc, [[17, 6 + hb], [15, 3 + hb], [19, 4 + hb], [21, 3 + hb], [23, 6 + hb]], col(c, 'tuft'));
  ibox(pc, 14, 5 + hb, 20, 7, [c.cap0, c.cap0, c.cap1, c.cap1], 2);
  pc.hline(16, 31, 6 + hb, col(c, 'cap0'));
  if (p.view === 'down') {
    pc.rect(13, 10 + hb, 22, 2, col(c, 'capB'));
    pc.ellipse(18, 8 + hb, 2.2, 2.2, col(c, 'pin'));
    pc.set(17, 6 + hb, col(c, 'fuse'));
  } else if (p.view === 'right') {
    pc.rect(16, 10 + hb, 22, 2, col(c, 'capB'));
    pc.ellipse(27, 8 + hb, 2.2, 2.2, col(c, 'pin'));
    pc.set(26, 6 + hb, col(c, 'fuse'));
  } else {
    pc.rect(14, 10 + hb, 20, 2, col(c, 'capB'));
  }

  // Brazos: piel clara + vendas blancas en antebrazo + guantes negros sin dedos + golpe astral
  const up = p.arms === 3 ? -7 : 0;
  const strike = p.anim === 'attack' && (p.f === 1 || p.f === 2);
  const arm = (x: number, y: number, wisp: boolean) => {
    ibox(pc, x, y, 5, 4, vestT, 1);
    ibox(pc, x, y + 3, 5, 4, skinT, 0);
    pc.rect(x + 1, y + 5, 3, 3, col(c, 'wrap'));
    pc.hline(x + 1, x + 3, y + 6, col(c, 'cap1'));
    pc.rect(x, y + 8, 5, 3, DARK);
    pc.rect(x + 1, y + 8, 3, 2, col(c, 'glove'));
    pc.hline(x + 1, x + 3, y + 10, col(c, 's1'));
    if (wisp) {
      pc.ellipse(x + 2, y + 2, 2.4, 2.8, col(c, 'wisp0', 220));
      pc.set(x + 2, y + 2, col(c, 'wisp1'));
    }
  };
  if (p.view === 'right') {
    const ax = p.anim === 'attack' ? 25 + p.arms * 2 : 22 + Math.round(p.swing * 2);
    arm(ax, 25 + b + up, true);
    if (strike) {
      pc.ring(ax + 9, 28 + b, 4.5, 4.5, col(c, 'plume', 220));
      pc.ellipse(ax + 9, 28 + b, 3.2, 3.8, col(c, 'wisp0', 225));
      pc.set(ax + 9, 28 + b, rgba('#ffffff'));
    }
  } else if (p.anim === 'attack' && p.view === 'down') {
    arm(9, 25 + b, false);
    arm(33, 26 + b + p.arms, true);
    if (strike) {
      pc.ring(35, 36 + b + p.arms, 4.5, 3.2, col(c, 'plume', 220));
      pc.ellipse(35, 36 + b + p.arms, 3.2, 2.5, col(c, 'wisp0', 225));
      pc.set(35, 36 + b + p.arms, rgba('#ffffff'));
    }
  } else if (p.anim === 'attack' && p.view === 'up') {
    arm(9, 25 + b, false);
    arm(33, 17 + b - p.arms * 2, true);
    if (strike) {
      pc.ring(35, 12 + b - p.arms * 2, 4.5, 3.2, col(c, 'plume', 220));
      pc.ellipse(35, 12 + b - p.arms * 2, 3.2, 2.5, col(c, 'wisp0', 225));
      pc.set(35, 12 + b - p.arms * 2, rgba('#ffffff'));
    }
  } else {
    arm(9, 25 + b + Math.round(p.swing * 2) + up, false);
    arm(34, 25 + b - Math.round(p.swing * 2) + up, false);
  }

  // Llamas / orbes astrales púrpura orbitando alrededor
  for (let i = 0; i < 3; i++) {
    const ang = p.t * Math.PI * 2 + (i * Math.PI * 2) / 3;
    const rx = p.cast > 0 ? 18 : 15;
    const wx = Math.round(CX + Math.cos(ang) * rx);
    const wy = Math.round(27 + b + Math.sin(ang * 1.5) * 6);
    pc.ellipse(wx, wy, 2.2, 2.6, col(c, 'wisp0', 210));
    pc.set(wx, wy, col(c, 'wisp1'));
  }

  if (p.cast > 0) {
    pc.ring(CX, 28 + b, 18 * p.cast, 18 * p.cast, col(c, 'wisp0', 180));
    pc.ring(CX, 28 + b, 14 * p.cast, 10 * p.cast, col(c, 'plume', 150));
  }
};

const DRAW: Record<ClassId, DrawFn> = {
  tanque: drawCubert,
  veloz: drawMaira,
  distancia: drawRango,
  support: drawWimmi,
  defensor: drawGiga,
  controlador: drawVaskil,
};

/** Dibuja un cuadro completo (con contorno y deformaciones de KO/daño). */
export function renderFrame(cls: ClassId, pal: Pal, view: View, anim: Anim, f: number): PixelCanvas {
  const pose = makePose(view, anim === 'ko' ? 'hurt' : anim, anim === 'ko' ? 0 : f);
  if (anim === 'ko') pose.eyes = 'x';
  let pc = new PixelCanvas(FW, FH);
  DRAW[cls](pc, pose, pal);
  pc.ox = 0;
  pc.oy = 0;
  pc.outline(rgba(OUTLINE));
  if (anim === 'hurt') pc = pc.stretchX(1.08, CX).squashY(0.92, GROUND);
  if (anim === 'ko') {
    const k = f / (ANIM_FRAMES.ko - 1);
    pc = pc.stretchX(1 + k * 0.35, CX).squashY(Math.max(0.25, 1 - k * 0.75), GROUND);
    if (f >= 1) {
      const star = rgba('#ffe94d');
      for (let s = 0; s < 3; s++) {
        const a = f * 1.3 + s * 2.1;
        const sx = Math.round(CX + Math.cos(a) * 10);
        const sy = Math.round(GROUND - 22 * Math.max(0.3, 1 - k * 0.7) + Math.sin(a) * 3);
        pc.set(sx, sy, star);
        pc.set(sx - 1, sy, withAlpha(star, 160));
        pc.set(sx + 1, sy, withAlpha(star, 160));
        pc.set(sx, sy - 1, withAlpha(star, 160));
        pc.set(sx, sy + 1, withAlpha(star, 160));
      }
    }
  }
  return pc;
}

/** Retrato grande (para menús): cuadro idle escalado. */
export function portraitFrame(cls: ClassId, pal: Pal, anim: Anim = 'idle', f = 0): PixelCanvas {
  return renderFrame(cls, pal, 'down', anim, f);
}
