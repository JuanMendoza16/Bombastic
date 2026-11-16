// Caché de sprites: convierte los lienzos de píxeles en canvas del navegador bajo demanda,
// además de pósters, recortes chroma-key y logotipo definitivo de Nueva Versión.
import { CLASSES } from '../../shared/balance';
import type { ClassId, PowerUpKind } from '../../shared/types';
import type { Theme } from '../../shared/maps';
import { ANIM_FRAMES, renderFrame, skinPalette, type Anim, type View } from './characters';
import { PixelCanvas, rgba } from './pixel';
import {
  baseTint,
  blockTile,
  bombSprite,
  conveyorTile,
  doorTile,
  flagSprite,
  flagStand,
  flameSprite,
  floorTile,
  lavaTile,
  powerupSprite,
  wallTile,
} from './tiles';

function toCanvas(pc: PixelCanvas): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = pc.w;
  cv.height = pc.h;
  pc.drawTo(cv.getContext('2d')!, 0, 0);
  return cv;
}

const cache = new Map<string, HTMLCanvasElement>();

function get(key: string, make: () => PixelCanvas): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = toCanvas(make());
    cache.set(key, c);
  }
  return c;
}

const VIEW_OF: View[] = ['down', 'up', 'right', 'right'];

export const Sprites = {
  char(cls: ClassId, skin: string, dir: number, anim: Anim, f: number): HTMLCanvasElement {
    const n = ANIM_FRAMES[anim];
    const fi = ((f % n) + n) % n;
    const d = anim === 'ko' || anim === 'win' ? 0 : dir;
    const key = `c:${cls}:${skin}:${d}:${anim}:${fi}`;
    return get(key, () => {
      const pc = renderFrame(cls, skinPalette(cls, skin), VIEW_OF[d], anim, fi);
      return d === 2 ? pc.flipX() : pc;
    });
  },

  /** Silueta blanca de un cuadro (destello al recibir daño). */
  charFlash(cls: ClassId, skin: string, dir: number, anim: Anim, f: number): HTMLCanvasElement {
    const n = ANIM_FRAMES[anim];
    const fi = ((f % n) + n) % n;
    const d = anim === 'ko' || anim === 'win' ? 0 : dir;
    const key = `cf:${cls}:${skin}:${d}:${anim}:${fi}`;
    return get(key, () => {
      const pc = renderFrame(cls, skinPalette(cls, skin), VIEW_OF[d], anim, fi);
      const s = pc.silhouette(rgba('#ffffff'));
      return d === 2 ? s.flipX() : s;
    });
  },

  floor(theme: Theme, x: number, y: number) {
    return floorTile(theme, x, y);
  },
  wall(theme: Theme, x: number, y: number, below: boolean) {
    return get(`w:${theme}:${x}:${y}:${below ? 1 : 0}`, () => wallTile(theme, x, y, below));
  },
  block(theme: Theme, x: number, y: number, below: boolean) {
    return get(`b:${theme}:${x}:${y}:${below ? 1 : 0}`, () => blockTile(theme, x, y, below));
  },
  bomb(frame: number, danger: boolean, team?: string) {
    return get(`bomb:${frame % 4}:${danger ? 1 : 0}:${team ?? ''}`, () => bombSprite(frame, danger, team));
  },
  flame(shape: number, stage: number, frame: number, fx: string) {
    const k = [0.55, 1, 0.9, 0.55][stage];
    return get(`fl:${shape}:${stage}:${frame % 2}:${fx}`, () => flameSprite(shape, k, frame % 2, fx));
  },
  powerup(kind: PowerUpKind, frame: number) {
    return get(`pu:${kind}:${frame % 2}`, () => powerupSprite(kind, frame));
  },
  flag(color: string, frame: number) {
    return get(`flag:${color}:${frame % 4}`, () => flagSprite(color, frame % 4));
  },
  flagStand(color: string) {
    return get(`fs:${color}`, () => flagStand(color));
  },
  baseTint(color: string) {
    return get(`bt:${color}`, () => baseTint(color));
  },
  conveyor(dir: number, frame: number) {
    return get(`cv:${dir}:${frame % 4}`, () => conveyorTile(dir, frame % 4));
  },
  door(open: number) {
    const k = Math.round(open * 4);
    return get(`door:${k}`, () => doorTile(k / 4));
  },
  lava(state: number, frame: number, x: number, y: number) {
    return get(`lava:${state}:${frame % 2}:${x}:${y}`, () => lavaTile(state, frame % 2, x, y));
  },
  raw(key: string, make: () => PixelCanvas) {
    return get(key, make);
  },
  toCanvas,
};

/** Retrato de personaje como dataURL (para la UI). */
const portraitCache = new Map<string, string>();
export function portraitURL(cls: ClassId, skin = 'base', anim: Anim = 'idle', f = 0, scale = 4): string {
  const key = `${cls}:${skin}:${anim}:${f}:${scale}`;
  const hit = portraitCache.get(key);
  if (hit) return hit;
  const src = Sprites.char(cls, skin, 0, anim, f);
  const cv = document.createElement('canvas');
  cv.width = src.width * scale;
  cv.height = src.height * scale;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0, cv.width, cv.height);
  const url = cv.toDataURL();
  portraitCache.set(key, url);
  return url;
}

export function spriteURL(canvas: HTMLCanvasElement, scale = 3): string {
  const cv = document.createElement('canvas');
  cv.width = canvas.width * scale;
  cv.height = canvas.height * scale;
  const ctx = cv.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(canvas, 0, 0, cv.width, cv.height);
  return cv.toDataURL();
}

const POSTER_SRC: Record<ClassId, string> = {
  tanque: '/assets/nueva-version/posters/tanque.jpg',
  defensor: '/assets/nueva-version/posters/defensor.jpg',
  veloz: '/assets/nueva-version/posters/veloz.jpg',
  distancia: '/assets/nueva-version/posters/distancia.jpg',
  support: '/assets/nueva-version/posters/support.png',
  controlador: '/assets/nueva-version/posters/controlador.jpg',
};

const CUTOUT_SRC: Record<ClassId, string> = {
  tanque: '/assets/nueva-version/cutouts/tanque.png',
  defensor: '/assets/nueva-version/cutouts/defensor.jpg',
  support: '/assets/nueva-version/cutouts/support.png',
  controlador: '/assets/nueva-version/cutouts/controlador.png',
  distancia: '/assets/nueva-version/cutouts/distancia.jpg',
  veloz: '/assets/nueva-version/cutouts/veloz.png',
};

const HERO_THEME: Record<ClassId, { bg0: string; bg1: string; accent: string; tag: string }> = {
  tanque: { bg0: '#27311e', bg1: '#485937', accent: '#ff5a36', tag: 'TANQUE' },
  defensor: { bg0: '#2c1e16', bg1: '#523424', accent: '#ffaa38', tag: 'GOLEM' },
  support: { bg0: '#162f3b', bg1: '#215463', accent: '#58d854', tag: 'SOPORTE' },
  controlador: { bg0: '#24143d', bg1: '#442473', accent: '#d26bff', tag: 'ASTRAL' },
  distancia: { bg0: '#1b2c1a', bg1: '#354d2b', accent: '#f59842', tag: 'TIRADOR' },
  veloz: { bg0: '#162933', bg1: '#264452', accent: '#ff6e3a', tag: 'VELOZ' },
};

const bannerCache = new Map<string, string>();
const cutoutCache = new Map<ClassId, string>();
const cutoutCanvasCache = new Map<ClassId, HTMLCanvasElement>();
let logoKeyedUrl = '';
const assetListeners = new Set<() => void>();
let assetsBooted = false;

function notifyAssets() {
  for (const fn of assetListeners) fn();
}

function chromaKeyToCanvas(
  img: HTMLImageElement,
  opts: { maxW?: number; cropBounds?: boolean } = {},
): { url: string; canvas?: HTMLCanvasElement } {
  const maxW = opts.maxW ?? 480;
  const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  ctx.drawImage(img, 0, 0, w, h);
  try {
    const id = ctx.getImageData(0, 0, w, h);
    const d = id.data;
    const corners = [0, (w - 1) * 4, (h - 1) * w * 4, ((h - 1) * w + (w - 1)) * 4];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    let opaqueCorners = 0;
    let transparentCorners = 0;
    for (const c of corners) {
      if (d[c + 3] < 24) {
        transparentCorners++;
      } else {
        bgR += d[c];
        bgG += d[c + 1];
        bgB += d[c + 2];
        opaqueCorners++;
      }
    }
    if (opaqueCorners > 0) {
      bgR /= opaqueCorners;
      bgG /= opaqueCorners;
      bgB /= opaqueCorners;
    }
    const neutralBg =
      transparentCorners === 0 &&
      opaqueCorners > 0 &&
      Math.max(bgR, bgG, bgB) - Math.min(bgR, bgG, bgB) < 32 &&
      (bgR + bgG + bgB) / 3 > 175;

    // Solo ejecutamos flood-fill desde los bordes cuando la imagen NO trae canal alfa transparente
    // (ej. .jpg con fondo blanco o gris). Así preservamos intactos los blancos internos como "BLAST &".
    if (neutralBg) {
      const total = w * h;
      const visited = new Uint8Array(total);
      const isBg = new Uint8Array(total);
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;

      const matchesBg = (idx: number): boolean => {
        const p = idx * 4;
        const a = d[p + 3];
        if (a < 24) return true;
        const r = d[p];
        const g = d[p + 1];
        const b = d[p + 2];
        const sat = Math.max(r, g, b) - Math.min(r, g, b);
        const luma = (r + g + b) / 3;
        const dist = Math.hypot(r - bgR, g - bgG, b - bgB);
        return (luma > 230 && sat < 28) || (sat < 34 && dist < 48);
      };

      const seed = (x: number, y: number) => {
        const idx = y * w + x;
        if (visited[idx]) return;
        visited[idx] = 1;
        if (matchesBg(idx)) {
          isBg[idx] = 1;
          queue[tail++] = idx;
        }
      };

      for (let x = 0; x < w; x++) {
        seed(x, 0);
        seed(x, h - 1);
      }
      for (let y = 1; y < h - 1; y++) {
        seed(0, y);
        seed(w - 1, y);
      }

      while (head < tail) {
        const idx = queue[head++];
        const x = idx % w;
        const y = (idx - x) / w;
        if (x > 0) seed(x - 1, y);
        if (x + 1 < w) seed(x + 1, y);
        if (y > 0) seed(x, y - 1);
        if (y + 1 < h) seed(x, y + 1);
      }

      for (let idx = 0; idx < total; idx++) {
        if (isBg[idx]) {
          d[idx * 4 + 3] = 0;
        } else {
          const x = idx % w;
          const y = (idx - x) / w;
          const adjBg =
            (x > 0 && isBg[idx - 1]) ||
            (x + 1 < w && isBg[idx + 1]) ||
            (y > 0 && isBg[idx - w]) ||
            (y + 1 < h && isBg[idx + w]);
          if (adjBg) {
            const p = idx * 4;
            const sat = Math.max(d[p], d[p + 1], d[p + 2]) - Math.min(d[p], d[p + 1], d[p + 2]);
            const dist = Math.hypot(d[p] - bgR, d[p + 1] - bgG, d[p + 2] - bgB);
            if (sat < 36 && dist < 64) {
              d[p + 3] = Math.round(d[p + 3] * Math.max(0.15, (dist - 36) / 28));
            }
          }
        }
      }
      ctx.putImageData(id, 0, 0);
    }

    if (opts.cropBounds) {
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (d[(y * w + x) * 4 + 3] > 16) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX >= minX && maxY >= minY) {
        const pad = 4;
        const sx = Math.max(0, minX - pad);
        const sy = Math.max(0, minY - pad);
        const sw = Math.min(w - sx, maxX - minX + 1 + pad * 2);
        const sh = Math.min(h - sy, maxY - minY + 1 + pad * 2);
        const out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        out.getContext('2d')!.drawImage(cv, sx, sy, sw, sh, 0, 0, sw, sh);
        return { url: out.toDataURL(), canvas: out };
      }
    }

    return { url: cv.toDataURL(), canvas: cv };
  } catch {
    return { url: img.src };
  }
}

function buildPosterCanvas(cls: ClassId, skin: string, variant: 'poster' | 'hud'): string {
  const w = variant === 'hud' ? 280 : 220;
  const h = variant === 'hud' ? 84 : 300;
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext('2d')!;
  const th = HERO_THEME[cls];
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, th.bg0);
  g.addColorStop(1, th.bg1);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 4; y < h; y += 8) {
    for (let x = 4 + ((y / 8) % 2) * 4; x < w; x += 8) ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = th.accent;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.moveTo(w * 0.55, 0);
  ctx.lineTo(w, 0);
  ctx.lineTo(w, h);
  ctx.lineTo(w * 0.3, h);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.imageSmoothingEnabled = false;
  const cut = skin === 'base' ? cutoutCanvasCache.get(cls) : undefined;
  if (cut && cut.width > 0 && cut.height > 0) {
    const drawH = variant === 'hud' ? h - 6 : h * 0.7;
    const drawW = drawH * (cut.width / cut.height);
    const dx = variant === 'hud' ? w - drawW - 6 : (w - drawW) / 2;
    const dy = variant === 'hud' ? 3 : h * 0.08;
    ctx.drawImage(cut, dx, dy, drawW, drawH);
  } else {
    const sp = Sprites.char(cls, skin, 0, 'idle', 0);
    const scale = variant === 'hud' ? 2 : 4;
    const dw = sp.width * scale;
    const dh = sp.height * scale;
    const dx = variant === 'hud' ? w - dw - 10 : Math.round((w - dw) / 2);
    const dy = variant === 'hud' ? Math.round((h - dh) / 2) : 28;
    ctx.drawImage(sp, dx, dy, dw, dh);
  }

  // marco escalonado y título del héroe
  ctx.fillStyle = th.accent;
  ctx.fillRect(0, 0, w, 4);
  ctx.fillRect(0, h - 4, w, 4);
  ctx.fillStyle = 'rgba(10, 6, 18, 0.78)';
  if (variant === 'hud') {
    ctx.fillRect(0, 4, 155, h - 8);
    ctx.font = 'bold 9px monospace';
    const tagW = Math.min(130, Math.ceil(ctx.measureText(th.tag).width) + 10);
    ctx.fillStyle = th.accent;
    ctx.fillRect(10, 14, tagW, 14);
    ctx.fillStyle = '#100a1c';
    ctx.fillText(th.tag, 15, 24);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(CLASSES[cls].hero.toUpperCase(), 10, 52, 138);
    ctx.fillStyle = th.accent;
    ctx.font = '11px monospace';
    ctx.fillText(CLASSES[cls].className, 10, 70, 138);
  } else {
    ctx.fillRect(8, h - 76, w - 16, 64);
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 2;
    ctx.strokeRect(8, h - 76, w - 16, 64);
    ctx.fillStyle = th.accent;
    ctx.font = 'bold 11px monospace';
    ctx.fillText(th.tag, 18, h - 55, w - 36);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(CLASSES[cls].hero.toUpperCase(), 18, h - 30, w - 36);
    ctx.fillStyle = '#cfd4e6';
    ctx.font = '12px monospace';
    ctx.fillText(CLASSES[cls].role.slice(0, 26), 18, h - 16, w - 36);
  }
  return cv.toDataURL();
}

export function preloadNuevaVersionAssets() {
  if (assetsBooted || typeof window === 'undefined' || typeof Image === 'undefined') return;
  assetsBooted = true;
  const logoImg = new Image();
  logoImg.onload = () => {
    logoKeyedUrl = chromaKeyToCanvas(logoImg, { maxW: 960, cropBounds: true }).url;
    notifyAssets();
  };
  logoImg.src = '/assets/nueva-version/logo.png';

  (Object.keys(CUTOUT_SRC) as ClassId[]).forEach((cls) => {
    const im = new Image();
    im.onload = () => {
      const keyed = chromaKeyToCanvas(im, { maxW: 420, cropBounds: true });
      cutoutCache.set(cls, keyed.url);
      if (keyed.canvas) cutoutCanvasCache.set(cls, keyed.canvas);
      bannerCache.delete(`${cls}:base:hud`);
      bannerCache.delete(`${cls}:base:poster`);
      notifyAssets();
    };
    im.src = CUTOUT_SRC[cls];
  });
}

export function onAssetsChange(cb: () => void): () => void {
  preloadNuevaVersionAssets();
  assetListeners.add(cb);
  return () => assetListeners.delete(cb);
}

export function bannerURL(cls: ClassId, skin = 'base', variant: 'poster' | 'hud' = 'poster'): string {
  preloadNuevaVersionAssets();
  if (skin === 'base' && variant === 'poster' && POSTER_SRC[cls]) return POSTER_SRC[cls]!;
  const key = `${cls}:${skin}:${variant}`;
  const hit = bannerCache.get(key);
  if (hit) return hit;
  const url = buildPosterCanvas(cls, skin, variant);
  bannerCache.set(key, url);
  return url;
}

export function cutoutURL(cls: ClassId): string {
  preloadNuevaVersionAssets();
  return cutoutCache.get(cls) ?? CUTOUT_SRC[cls];
}

export function logoURL(): string {
  preloadNuevaVersionAssets();
  return logoKeyedUrl || '/assets/nueva-version/logo.png';
}
