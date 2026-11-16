// Sistema de partículas simple (en coordenadas de píxel nativo del mundo).

export type PKind = 'sq' | 'circ' | 'text' | 'ring' | 'spark' | 'smoke' | 'star' | 'ghost';

export interface Particle {
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  life: number;
  max: number;
  size: number;
  grow: number;
  color: string;
  text?: string;
  drag: number;
  fade: boolean;
  bold?: boolean;
}

const MAX = 900;

export class Particles {
  list: Particle[] = [];

  add(p: Partial<Particle> & { x: number; y: number }) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push({
      kind: 'sq',
      vx: 0,
      vy: 0,
      g: 0,
      life: 0.6,
      max: p.life ?? 0.6,
      size: 2,
      grow: 0,
      color: '#ffffff',
      drag: 0,
      fade: true,
      ...p,
    } as Particle);
  }

  burst(x: number, y: number, n: number, colors: string[], speed = 60, opts: Partial<Particle> = {}) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      const life = (opts.life ?? 0.5) * (0.6 + Math.random() * 0.8);
      this.add({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        color: colors[i % colors.length],
        size: opts.size ?? 2,
        ...opts,
        life,
        max: life,
      });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 9, life = 0.9, bold = true) {
    this.add({ kind: 'text', x, y, vy: -34, drag: 2.2, text, color, size, life, max: life, bold, fade: true });
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, life = 0.4, width = 2) {
    this.add({ kind: 'ring', x, y, size: r0, grow: (r1 - r0) / life, color, life, max: life, vx: width });
  }

  update(dt: number) {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i--) {
      const p = l[i];
      p.life -= dt;
      if (p.life <= 0) {
        l.splice(i, 1);
        continue;
      }
      if (p.kind !== 'ring') {
        p.vy += p.g * dt;
        if (p.drag) {
          const k = Math.max(0, 1 - p.drag * dt);
          p.vx *= k;
          p.vy *= k;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      p.size += p.grow * dt;
    }
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const t = p.life / p.max;
      ctx.globalAlpha = p.fade ? Math.min(1, t * 1.6) : 1;
      switch (p.kind) {
        case 'sq':
          ctx.fillStyle = p.color;
          ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), p.size, p.size);
          break;
        case 'spark':
          ctx.fillStyle = p.color;
          ctx.fillRect(p.x - 0.5, p.y - 0.5, 1.5, 1.5);
          break;
        case 'circ':
        case 'smoke':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'ring':
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.vx || 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'star': {
          ctx.fillStyle = p.color;
          const s = p.size;
          ctx.fillRect(p.x - s / 2, p.y - 0.5, s, 1);
          ctx.fillRect(p.x - 0.5, p.y - s / 2, 1, s);
          break;
        }
        case 'text': {
          ctx.font = `${p.bold ? '' : ''}${p.size}px "Lilita One", "Fredoka", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.lineWidth = 3;
          ctx.strokeStyle = '#1a1026';
          ctx.strokeText(p.text ?? '', p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.fillText(p.text ?? '', p.x, p.y);
          break;
        }
        case 'ghost':
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, Math.PI, 0);
          ctx.lineTo(p.x + p.size, p.y + p.size);
          ctx.lineTo(p.x - p.size, p.y + p.size);
          ctx.fill();
          ctx.fillStyle = '#1a1026';
          ctx.fillRect(p.x - p.size / 2 - 1, p.y - 1, 2, 2);
          ctx.fillRect(p.x + p.size / 2 - 1, p.y - 1, 2, 2);
          break;
      }
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list.length = 0;
  }
}
