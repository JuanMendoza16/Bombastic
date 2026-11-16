// "Pintor" de pixel art: dibuja primitivas píxel a píxel (sin antialiasing)
// sobre un buffer, con sombreado por tonos y contorno automático estilo cartoon.

export type Color = number; // RGBA empaquetado (little endian: 0xAABBGGRR)

const colorCache = new Map<string, Color>();

export function rgba(hex: string, alpha = 255): Color {
  const key = hex + ':' + alpha;
  const hit = colorCache.get(key);
  if (hit !== undefined) return hit;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  let a = alpha;
  if (h.length === 8) a = parseInt(h.slice(6, 8), 16);
  const c = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
  colorCache.set(key, c);
  return c;
}

export function alphaOf(c: Color): number {
  return c >>> 24;
}

export function withAlpha(c: Color, a: number): Color {
  return ((c & 0x00ffffff) | ((a & 255) << 24)) >>> 0;
}

/** Mezcla lineal entre dos colores hex. */
export function mix(a: string, b: string, t: number): string {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t);
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t);
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t);
  return '#' + [r, g, bl].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function hexToRgb(h: string): [number, number, number] {
  let s = h.replace('#', '');
  if (s.length === 3) s = s.split('').map((c) => c + c).join('');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

export function lighten(h: string, t: number): string {
  return mix(h, '#ffffff', t);
}

export function darken(h: string, t: number): string {
  return mix(h, '#000000', t);
}

/** Rota el tono de un color (para skins alternativas). */
export function hueShift(h: string, deg: number, satMul = 1, lightMul = 1): string {
  const [r, g, b] = hexToRgb(h).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hh = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hh = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh /= 6;
  }
  hh = (((hh * 360 + deg) % 360) + 360) % 360 / 360;
  s = Math.min(1, s * satMul);
  const L = Math.min(1, l * lightMul);
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let rr: number, gg: number, bb: number;
  if (s === 0) rr = gg = bb = L;
  else {
    const q = L < 0.5 ? L * (1 + s) : L + s - L * s;
    const p = 2 * L - q;
    rr = hue2rgb(p, q, hh + 1 / 3);
    gg = hue2rgb(p, q, hh);
    bb = hue2rgb(p, q, hh - 1 / 3);
  }
  return '#' + [rr, gg, bb].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

/** Ruido determinista 2D (0..1) para texturas. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class PixelCanvas {
  readonly w: number;
  readonly h: number;
  readonly data: Uint32Array;
  /** desplazamiento global (para animaciones) */
  ox = 0;
  oy = 0;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.data = new Uint32Array(w * h);
  }

  clear() {
    this.data.fill(0);
  }

  get(x: number, y: number): Color {
    x = Math.floor(x + this.ox);
    y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return 0;
    return this.data[y * this.w + x];
  }

  /** Pinta un píxel (con mezcla alfa simple si el color es semitransparente). */
  set(x: number, y: number, c: Color) {
    x = Math.floor(x + this.ox);
    y = Math.floor(y + this.oy);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const a = c >>> 24;
    if (a === 0) return;
    const i = y * this.w + x;
    if (a === 255) {
      this.data[i] = c;
      return;
    }
    const d = this.data[i];
    const da = d >>> 24;
    if (da === 0) {
      this.data[i] = c;
      return;
    }
    const t = a / 255;
    const r = Math.round((c & 255) * t + (d & 255) * (1 - t));
    const g = Math.round(((c >>> 8) & 255) * t + ((d >>> 8) & 255) * (1 - t));
    const b = Math.round(((c >>> 16) & 255) * t + ((d >>> 16) & 255) * (1 - t));
    const na = Math.min(255, Math.round(a + da * (1 - t)));
    this.data[i] = ((na << 24) | (b << 16) | (g << 8) | r) >>> 0;
  }

  /** Pinta solo donde ya hay un píxel opaco (para sombreados dentro de una forma). */
  setOver(x: number, y: number, c: Color) {
    if (alphaOf(this.get(x, y)) > 0) this.set(x, y, c);
  }

  rect(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }

  rectOver(x: number, y: number, w: number, h: number, c: Color) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.setOver(x + i, y + j, c);
  }

  hline(x0: number, x1: number, y: number, c: Color) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c);
  }

  vline(x: number, y0: number, y1: number, c: Color) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c);
  }

  line(x0: number, y0: number, x1: number, y1: number, c: Color) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let guard = 0; guard < 500; guard++) {
      this.set(x0, y0, c);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Elipse rellena (centro en coordenadas de píxel continuas). */
  ellipse(cx: number, cy: number, rx: number, ry: number, c: Color, over = false) {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) {
          if (over) this.setOver(x, y, c);
          else this.set(x, y, c);
        }
      }
    }
  }

  /** Anillo (borde de elipse) de 1 px. */
  ring(cx: number, cy: number, rx: number, ry: number, c: Color) {
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const d = nx * nx + ny * ny;
        const ix = (x + 0.5 - cx) / Math.max(0.5, rx - 1);
        const iy = (y + 0.5 - cy) / Math.max(0.5, ry - 1);
        if (d <= 1 && ix * ix + iy * iy > 1) this.set(x, y, c);
      }
    }
  }

  /**
   * Elipse con sombreado de 3-4 tonos según una luz que viene de arriba a la izquierda.
   * tones: [luz, base, sombra, sombra profunda?]
   */
  shaded(cx: number, cy: number, rx: number, ry: number, tones: string[], lx = -0.55, ly = -0.75, over = false) {
    const cols = tones.map((t) => rgba(t));
    const x0 = Math.floor(cx - rx - 1);
    const x1 = Math.ceil(cx + rx + 1);
    const y0 = Math.floor(cy - ry - 1);
    const y1 = Math.ceil(cy + ry + 1);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const d = nx * lx + ny * ly;
        let c = cols[1];
        if (d > 0.12 && r2 < 0.78) c = cols[0];
        else if (d < -0.48 || (r2 > 0.86 && d < -0.05)) c = cols[2];
        if (cols[3] !== undefined && d < -0.78 && r2 > 0.75) c = cols[3];
        if (over) this.setOver(x, y, c);
        else this.set(x, y, c);
      }
    }
  }

  /** Rectángulo con volumen: borde superior/izq claro, inferior/der oscuro. */
  box(x: number, y: number, w: number, h: number, tones: string[], rounded = 1) {
    const [light, base, shade, dark] = tones.map((t) => rgba(t));
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        // esquinas redondeadas
        if (rounded > 0) {
          const cx = i < rounded ? rounded - i : i >= w - rounded ? i - (w - rounded - 1) : 0;
          const cy = j < rounded ? rounded - j : j >= h - rounded ? j - (h - rounded - 1) : 0;
          if (cx > 0 && cy > 0 && cx + cy > rounded) continue;
        }
        let c = base;
        if (j === 0 || i === 0) c = light;
        if (j === h - 1 || i === w - 1) c = shade;
        if (dark !== undefined && (j === h - 1 && i > 0)) c = dark;
        this.set(x + i, y + j, c);
      }
    }
  }

  /** Polígono relleno (regla par-impar, muestreo en el centro de píxel). */
  poly(pts: [number, number][], c: Color) {
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [, y] of pts) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= sy && y1 > sy) || (y1 <= sy && y0 > sy)) {
          xs.push(x0 + ((sy - y0) / (y1 - y0)) * (x1 - x0));
        }
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) this.set(x, y, c);
      }
    }
  }

  /**
   * Contorno automático: todo píxel transparente vecino (4-conexo) de uno
   * opaco se pinta con `c`. `minAlpha` ignora píxeles semitransparentes (brillos).
   */
  outline(c: Color, minAlpha = 200, diagonal = false) {
    const src = this.data.slice();
    const w = this.w;
    const h = this.h;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (src[i] >>> 24 >= minAlpha) continue;
        let n = false;
        const check = (xx: number, yy: number) => {
          if (xx < 0 || yy < 0 || xx >= w || yy >= h) return;
          if (src[yy * w + xx] >>> 24 >= minAlpha) n = true;
        };
        check(x - 1, y);
        check(x + 1, y);
        check(x, y - 1);
        check(x, y + 1);
        if (diagonal) {
          check(x - 1, y - 1);
          check(x + 1, y - 1);
          check(x - 1, y + 1);
          check(x + 1, y + 1);
        }
        if (n) this.data[i] = c;
      }
    }
  }

  /** Copia otro lienzo encima (con offset). */
  blit(src: PixelCanvas, dx: number, dy: number, flipX = false) {
    for (let y = 0; y < src.h; y++) {
      for (let x = 0; x < src.w; x++) {
        const c = src.data[y * src.w + (flipX ? src.w - 1 - x : x)];
        if (c >>> 24) this.set(dx + x, dy + y, c);
      }
    }
  }

  /** Escala vertical (vecino más cercano) anclada abajo. */
  squashY(factor: number, anchorY: number): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      const sy = Math.floor(anchorY - (anchorY - y) / factor);
      if (sy < 0 || sy >= this.h) continue;
      for (let x = 0; x < this.w; x++) out.data[y * this.w + x] = this.data[sy * this.w + x];
    }
    return out;
  }

  /** Escala horizontal (vecino más cercano) centrada. */
  stretchX(factor: number, cx: number): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let x = 0; x < this.w; x++) {
      const sx = Math.floor(cx + (x - cx) / factor);
      if (sx < 0 || sx >= this.w) continue;
      for (let y = 0; y < this.h; y++) out.data[y * this.w + x] = this.data[y * this.w + sx];
    }
    return out;
  }

  flipX(): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) out.data[y * this.w + x] = this.data[y * this.w + (this.w - 1 - x)];
    return out;
  }

  /** Convierte todo lo opaco a un color (siluetas para destellos). */
  silhouette(c: Color): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] >>> 24) out.data[i] = withAlpha(c, this.data[i] >>> 24);
    return out;
  }

  toCanvas(): HTMLCanvasElement {
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    this.drawTo(cv.getContext('2d')!, 0, 0);
    return cv;
  }

  drawTo(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const bytes = new Uint8ClampedArray(this.w * this.h * 4);
    bytes.set(new Uint8Array(this.data.buffer, this.data.byteOffset, this.data.byteLength));
    const img = new ImageData(bytes, this.w, this.h);
    ctx.putImageData(img, x, y);
  }
}
