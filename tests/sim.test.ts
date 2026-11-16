import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Feedback } from '../src/client/game/feedback';
import { ANIM_FRAMES, BASE_PAL, FH, FW, renderFrame, skinPalette, type Anim, type View } from '../src/client/gfx/characters';
import { hexToRgb } from '../src/client/gfx/pixel';
import { bannerURL } from '../src/client/gfx/sprites';
import { BOMB, CLASSES, MODES, RULES } from '../src/shared/balance';
import { MAPS, MAP_ORDER, parseMap } from '../src/shared/maps';
import { DT, createMatch, playerById, step } from '../src/shared/sim';
import { DX, DY, Tile, type ClassId, type MatchConfig, type MatchState, type ModeId, type PlayerInput } from '../src/shared/types';

function cfg(mode: ModeId, over: Partial<MatchConfig> = {}): MatchConfig {
  const m = MODES[mode];
  return {
    mode,
    map: 'ruinas',
    timeLimit: m.defaultTime,
    scoreLimit: m.defaultScore,
    powerups: false,
    seed: 42,
    slots: [
      { id: 1, name: 'Azul', team: 0, cls: 'tanque', skin: 'base', bot: false, difficulty: 1 },
      { id: 2, name: 'Rojo', team: 1, cls: 'veloz', skin: 'base', bot: false, difficulty: 1 },
    ],
    ...over,
  };
}

function run(s: MatchState, seconds: number, inputs: Record<number, PlayerInput> = {}) {
  const n = Math.round(seconds / DT);
  for (let i = 0; i < n; i++) step(s, inputs);
}

function input(p: Partial<PlayerInput> = {}): PlayerInput {
  return { dir: -1, bomb: 0, attack: false, hyper: 0, emote: 0, ...p };
}

describe('mapas', () => {
  it('todos los mapas son rectangulares y tienen banderas y apariciones', () => {
    for (const id of [...MAP_ORDER, 'tutorial' as const]) {
      const m = parseMap(id);
      expect(m.tiles.length).toBe(m.w * m.h);
      expect(m.flags.length).toBe(2);
      expect(m.spawns[0].length).toBeGreaterThan(0);
      expect(m.spawns[1].length).toBeGreaterThan(0);
    }
  });

  it('los mapas competitivos son simétricos', () => {
    for (const id of MAP_ORDER) {
      const rows = MAPS[id].rows;
      for (const row of rows) {
        for (let x = 0; x < row.length; x++) {
          const a = row[x];
          const b = row[row.length - 1 - x];
          const norm = (c: string) => ({ A: 'T', B: 'T', '1': 'S', '2': 'S', '<': 'C', '>': 'C' })[c] ?? c;
          expect(norm(a)).toBe(norm(b));
        }
      }
    }
  });

  it('hay camino (rompiendo bloques) entre las bases y todas las zonas', () => {
    for (const id of MAP_ORDER) {
      const m = parseMap(id);
      const reach = new Set<number>();
      const start = m.flags[0];
      const q = [start];
      reach.add(start.y * m.w + start.x);
      while (q.length) {
        const c = q.shift()!;
        for (let d = 0; d < 4; d++) {
          const nx = c.x + DX[d];
          const ny = c.y + DY[d];
          const i = ny * m.w + nx;
          if (reach.has(i) || m.tiles[i] === Tile.Wall) continue;
          reach.add(i);
          q.push({ x: nx, y: ny });
        }
      }
      const f = m.flags[1];
      expect(reach.has(f.y * m.w + f.x), `${id}: bandera enemiga`).toBe(true);
      for (const z of m.zones) expect(reach.has(z.y * m.w + z.x), `${id}: zona`).toBe(true);
      for (const sp of m.ffa) expect(reach.has(sp.y * m.w + sp.x), `${id}: ffa`).toBe(true);
    }
  });

  it('los mapas de duelo tienen centro abierto y los estándar mantienen corredores despejados', () => {
    for (const id of ['ruinas_chico', 'laberinto_chico', 'fabrica_chico'] as const) {
      const m = parseMap(id);
      for (let y = 4; y <= 6; y++) {
        for (let x = 6; x <= 8; x++) {
          expect(m.tiles[y * m.w + x], `${id} (${x},${y})`).toBe(Tile.Floor);
        }
      }
    }
    for (const id of ['ruinas', 'laberinto', 'fabrica', 'volcan'] as const) {
      const m = parseMap(id);
      const blocks = m.tiles.filter((t) => t === Tile.Block).length;
      const interior = (m.w - 2) * (m.h - 2);
      expect(blocks / interior, `${id} densidad de bloques`).toBeLessThan(0.2);
      // Pasillo central (fila 7): mayoría despejada sin paredes indestructibles en el centro
      for (let x = 11; x <= 15; x++) {
        expect(m.tiles[7 * m.w + x], `${id} centro (${x},7)`).not.toBe(Tile.Wall);
      }
    }
  });
});

describe('simulación', () => {
  it('cuenta regresiva y luego se juega', () => {
    const s = createMatch(cfg('ctf'));
    expect(s.phase).toBe('countdown');
    run(s, 3.1);
    expect(s.phase).toBe('playing');
  });

  it('el jugador se mueve y no atraviesa paredes', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const x0 = p.x;
    run(s, 1, { 1: input({ dir: 2 }) }); // izquierda hacia la pared del borde
    expect(p.x).toBeLessThan(x0);
    expect(p.x).toBeGreaterThanOrEqual(1 + 0.38 - 1e-6);
  });

  it('la bomba explota tras la mecha, aplica daño no letal y elimina al quedarse sin vida', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const hp0 = p.hp;
    step(s, { 1: input({ bomb: 1 }) });
    expect(s.bombs.length).toBe(1);
    run(s, BOMB.fuse + 0.1, { 1: input({ bomb: 1 }) });
    expect(s.bombs.length).toBe(0);
    // con vida completa sobrevive y el Tanque mitiga 25% del daño de bomba
    expect(p.alive).toBe(true);
    expect(p.hp).toBeLessThan(hp0);
    expect(p.hp).toBeGreaterThan(0);
    // con poca vida una segunda bomba lo elimina
    p.hp = 20;
    p.invuln = 0;
    step(s, { 1: input({ bomb: 2 }) });
    run(s, BOMB.fuse + 0.1, { 1: input({ bomb: 2 }) });
    expect(p.alive).toBe(false);
    expect(p.hp).toBe(0);
  });

  it('robar y capturar la bandera suma una captura', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const enemyFlag = s.flags[1];
    p.x = enemyFlag.x;
    p.y = enemyFlag.y;
    step(s, {});
    expect(p.carrying).toBe(1);
    const home = s.flags[0];
    p.x = home.homeX + 1.5;
    p.y = home.homeY + 0.5;
    step(s, {});
    expect(s.scores[0]).toBe(1);
    expect(p.caps).toBe(1);
    expect(s.flags[1].state).toBe(0);
  });

  it('la bandera caída vuelve sola después de un tiempo', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const f = s.flags[1];
    p.x = f.x;
    p.y = f.y;
    step(s, {});
    p.x = 13.5;
    p.y = 7.5;
    step(s, {});
    p.hp = 1;
    p.invuln = 0;
    // la mata un disparo simulado
    const enemy = playerById(s, 2)!;
    enemy.x = 13.5;
    enemy.y = 6.5;
    enemy.dir = 0;
    step(s, { 2: input({ attack: true }) });
    expect(p.alive).toBe(false);
    expect(f.state).toBe(2);
    run(s, 16);
    expect(f.state).toBe(0);
  });

  it('todas las clases pueden atacar y usar la hipercarga', () => {
    const classes: ClassId[] = ['tanque', 'veloz', 'distancia', 'support', 'defensor', 'controlador'];
    for (const cls of classes) {
      const s = createMatch(
        cfg('ctf', {
          slots: [
            { id: 1, name: 'A', team: 0, cls, skin: 'base', bot: false, difficulty: 1 },
            { id: 2, name: 'B', team: 1, cls: 'tanque', skin: 'base', bot: false, difficulty: 1 },
          ],
        }),
      );
      run(s, 3.1);
      const p = playerById(s, 1)!;
      const e = playerById(s, 2)!;
      p.x = 13.5;
      p.y = 7.5;
      p.dir = 3;
      e.x = 14.5;
      e.y = 7.5;
      e.invuln = 0;
      // limpiar bloques cercanos
      for (let x = 12; x <= 16; x++) if (s.tiles[7 * s.w + x] === Tile.Block) s.tiles[7 * s.w + x] = Tile.Floor;
      const hp0 = e.hp;
      run(s, 0.4, { 1: input({ attack: true }) });
      expect(e.hp, cls).toBeLessThan(hp0);
      p.hyper = 100;
      step(s, { 1: input({ hyper: 1 }) });
      expect(s.events.some((e) => e.t === 'hyper'), cls).toBe(true);
      expect(p.hyper, cls).toBeLessThan(100);
      expect(CLASSES[cls].hyper.name.length).toBeGreaterThan(0);
    }
  });

  it('eliminación: ganar rondas termina la partida', () => {
    const s = createMatch(cfg('eliminacion', { scoreLimit: 2 }));
    run(s, 3.1);
    const e = playerById(s, 2)!;
    e.invuln = 0;
    e.hp = 1;
    const p = playerById(s, 1)!;
    p.x = e.x - 1;
    p.y = e.y;
    p.dir = 3;
    step(s, { 1: input({ attack: true }) });
    run(s, 1);
    expect(s.roundWins[0]).toBe(1);
    expect(s.phase).toBe('roundEnd');
    run(s, 4);
    expect(s.round).toBe(2);
    expect(e.alive).toBe(true);
  });

  it('eliminación: al terminar el tiempo gana la ronda quien eliminó más', () => {
    const slots = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'].map((name, i) => ({
      id: i + 1,
      name,
      team: i < 3 ? 0 : 1,
      cls: (['tanque', 'veloz', 'support'] as const)[i % 3],
      skin: 'base',
      bot: false,
      difficulty: 1 as const,
    }));
    const s = createMatch(cfg('eliminacion', { timeLimit: 5, slots }));
    run(s, 3.1);
    // B1 elimina a A2 (1 eliminación para el rojo); B2 y B3 caen sin que nadie sume
    const a2 = playerById(s, 2)!;
    const b1 = playerById(s, 4)!;
    a2.invuln = 0;
    a2.hp = 1;
    b1.x = a2.x;
    b1.y = a2.y - 1;
    b1.dir = 0;
    step(s, { 4: input({ attack: true }) });
    expect(a2.alive).toBe(false);
    playerById(s, 5)!.alive = false;
    playerById(s, 6)!.alive = false;
    // quedan 2 azules vivos contra 1 rojo, pero el rojo tiene más eliminaciones
    run(s, 6);
    expect(s.roundWins[1]).toBe(1);
    expect(s.roundWins[0]).toBe(0);
  });

  it('batalla clásica usa un equipo por jugador y la muerte súbita cierra el mapa', () => {
    const s = createMatch(cfg('clasica', { timeLimit: 50 }));
    expect(s.teams).toBe(2);
    expect(playerById(s, 1)!.team).not.toBe(playerById(s, 2)!.team);
    run(s, 3.1);
    const walls0 = s.tiles.filter((t) => t === Tile.Wall).length;
    run(s, 29);
    expect(s.hurry?.on).toBe(false);
    run(s, 1.2);
    expect(s.hurry?.on).toBe(true);
    expect(s.tiles.filter((t) => t === Tile.Wall).length).toBeGreaterThan(walls0);
  });

  it('zona: controlar la zona suma puntos', () => {
    const s = createMatch(cfg('zona'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const k = s.koth!;
    p.x = k.x + 0.5;
    p.y = k.y + 0.5;
    run(s, 3.05);
    expect(s.scores[0]).toBeGreaterThanOrEqual(3);
  });

  it('la partida de CTF termina por tiempo', () => {
    const s = createMatch(cfg('ctf', { timeLimit: 5 }));
    run(s, 9);
    expect(s.phase).toBe('ended');
    expect(s.winner).toBe(-2);
  });

  it('la simulación es determinista con la misma semilla', () => {
    const mk = () => createMatch(cfg('clasica', { powerups: true }));
    const a = mk();
    const b = mk();
    const inputs = (t: number): Record<number, PlayerInput> => ({
      1: input({ dir: ((t >> 5) % 4) as 0 | 1 | 2 | 3, bomb: t >> 6, attack: t % 30 < 5 }),
      2: input({ dir: ((t >> 4) % 4) as 0 | 1 | 2 | 3, bomb: t >> 7 }),
    });
    for (let t = 0; t < 1200; t++) {
      step(a, inputs(t));
      step(b, inputs(t));
    }
    expect(JSON.stringify(a.players)).toBe(JSON.stringify(b.players));
    expect(a.tiles).toEqual(b.tiles);
  });

  it('evita deslizamiento prematuro en esquinas y bloquea ataques en diagonal tras pilares', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    // Ruinas tiene pilar pared en (2, 2); colocarse en el carril superior (1.5, 1.35) y avanzar derecha
    p.x = 1.5;
    p.y = 1.35;
    const y0 = p.y;
    step(s, { 1: input({ dir: 3 }) });
    expect(p.y).toBe(y0);
    // Ataque cuerpo a cuerpo no atraviesa pilar en diagonal
    const m = createMatch(cfg('ctf', { slots: [
      { id: 1, name: 'Azul', team: 0, cls: 'tanque', skin: 'base', bot: false, difficulty: 1 },
      { id: 2, name: 'Rojo', team: 1, cls: 'veloz', skin: 'base', bot: false, difficulty: 1 },
    ] }));
    run(m, 3.1);
    const a = playerById(m, 1)!;
    const t = playerById(m, 2)!;
    a.x = 1.65;
    a.y = 2.05;
    a.dir = 3;
    t.x = 2.55;
    t.y = 1.55;
    t.invuln = 0;
    const hp0 = t.hp;
    m.tiles[2 * m.w + 2] = Tile.Wall;
    step(m, { 1: input({ attack: true }) });
    expect(t.hp).toBe(hp0);
  });

  it('patea bombas al caminar contra ellas y agarra/lanza con el botón de bomba', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    // Limpiar carril horizontal (1..5, 1)
    for (let x = 1; x <= 5; x++) s.tiles[1 * s.w + x] = Tile.Floor;
    p.x = 2.5;
    p.y = 1.5;
    step(s, { 1: input({ bomb: 1 }) });
    expect(s.bombs.length).toBe(1);
    // Agarrar la bomba propia con nueva pulsación y lanzarla a la derecha (dir 3)
    p.dir = 3;
    step(s, { 1: input({ bomb: 2 }) });
    expect(p.heldBomb).toBe(s.bombs[0].id);
    step(s, { 1: input({ bomb: 3 }) });
    expect(p.heldBomb).toBe(0);
    expect(s.bombs[0].airDur).toBeGreaterThan(0);
    run(s, BOMB.throwDuration + 0.05, { 1: input({ bomb: 3 }) });
    expect(s.bombs[0].airDur).toBeUndefined();
    expect(s.bombs[0].x).toBe(5);

    // Ahora patear una bomba quieta en el carril: poner en (2, 1), salir a (1, 1) y caminar a la derecha
    s.bombs = [];
    p.x = 2.5;
    p.y = 1.5;
    step(s, { 1: input({ bomb: 4 }) });
    run(s, 0.35, { 1: input({ bomb: 4, dir: 2 }) });
    expect(s.bombs[0].passers.includes(p.id)).toBe(false);
    run(s, 0.25, { 1: input({ bomb: 4, dir: 3 }) });
    expect(s.bombs[0].vx).toBeGreaterThan(0);
  });

  it('la hipercarga del Tanque otorga escudo anti-bomba y al morir se pierden mejoras', () => {
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    expect(p.speedUps).toBe(RULES.startSpeedBonus);
    p.bombsMax += 2;
    p.range += 2;
    p.speedUps += 2;
    p.hyper = 100;
    step(s, { 1: input({ hyper: 1 }) });
    expect(p.shieldT).toBeGreaterThan(0);
    step(s, { 1: input({ bomb: 1, hyper: 1 }) });
    run(s, BOMB.fuse + 0.1, { 1: input({ bomb: 1, hyper: 1 }) });
    // Escudo absorbió la bomba sin perder vida y se consumió
    expect(p.alive).toBe(true);
    expect(p.hp).toBe(p.maxHp);
    expect(p.shieldT).toBe(0);
    // Sin escudo, al recibir daño letal reaparece sin mejoras acumuladas pero con pasiva común
    p.invuln = 0;
    p.hp = 20;
    step(s, { 1: input({ bomb: 2, hyper: 1 }) });
    run(s, BOMB.fuse + 0.1, { 1: input({ bomb: 2, hyper: 1 }) });
    expect(p.alive).toBe(false);
    expect(p.bombsMax).toBe(BOMB.startBombs);
    expect(p.range).toBe(BOMB.range);
    expect(p.speedUps).toBe(RULES.startSpeedBonus);
  });

  it('los bloques destruibles regeneran a los 25s en todos los modos', () => {
    expect(RULES.blockRegen).toBe(25);
    const s = createMatch(cfg('ctf'));
    run(s, 3.1);
    const bi = s.tiles.findIndex((t) => t === Tile.Block);
    expect(bi).toBeGreaterThan(-1);
    const bx = bi % s.w;
    const by = Math.floor(bi / s.w);
    const p = playerById(s, 1)!;
    p.x = bx + 0.5;
    p.y = by - 0.5;
    if (s.tiles[(by - 1) * s.w + bx] === Tile.Wall) {
      s.tiles[(by - 1) * s.w + bx] = Tile.Floor;
    }
    step(s, { 1: input({ bomb: 1 }) });
    run(s, BOMB.fuse + 0.1, { 1: input({ bomb: 1 }) });
    expect(s.tiles[bi]).toBe(Tile.Floor);
    expect(s.regen.some((r) => r.i === bi)).toBe(true);
    run(s, RULES.blockRegen + 0.1);
    expect(s.tiles[bi]).toBe(Tile.Block);
  });

  it('el modo duelo usa mapas 15x11 y la tormenta reduce la arena y daña afuera', () => {
    for (const id of ['ruinas_chico', 'laberinto_chico', 'fabrica_chico'] as const) {
      const m = parseMap(id);
      expect(m.w).toBe(15);
      expect(m.h).toBe(11);
    }
    const s = createMatch(cfg('duelo', { map: 'ruinas_chico', timeLimit: 40 }));
    run(s, 3.1);
    const p = playerById(s, 1)!;
    const e = playerById(s, 2)!;
    p.x = 1.5;
    p.y = 1.5;
    e.x = 7.5;
    e.y = 5.5;
    const hp0 = p.hp;
    run(s, 33);
    expect(s.storm?.on).toBe(true);
    expect(s.storm!.radius).toBeLessThan(s.storm!.maxRadius);
    expect(p.hp).toBeLessThan(hp0);
    expect(e.hp).toBe(e.maxHp);
  });
});

describe('tutorial', () => {
  it('avanza paso a paso hasta terminar', () => {
    const s = createMatch({
      mode: 'tutorial',
      map: 'tutorial',
      timeLimit: 0,
      scoreLimit: 1,
      powerups: false,
      seed: 7,
      slots: [
        { id: 1, name: 'Yo', team: 0, cls: 'distancia', skin: 'base', bot: false, difficulty: 1 },
        { id: 2, name: 'Muñeco', team: 1, cls: 'tanque', skin: 'base', bot: true, difficulty: 0 },
      ],
    });
    const me = playerById(s, 1)!;
    const dummy = playerById(s, 2)!;
    expect(s.tut!.step).toBe(0);
    run(s, 1.2);
    me.x = 7.5;
    run(s, 0.1);
    expect(s.tut!.step).toBe(1);
    // romper un bloque
    me.x = 9.5;
    me.y = 3.5;
    step(s, { 1: input({ bomb: 1 }) });
    run(s, 3, { 1: input({ bomb: 1, dir: 2 }) });
    expect(s.tut!.step).toBe(2);
    // eliminar al muñeco
    dummy.hp = 1;
    me.x = dummy.x - 2;
    me.y = dummy.y;
    me.dir = 3;
    me.invuln = 0;
    run(s, 1, { 1: input({ bomb: 1, attack: true, dir: -1 }) });
    expect(s.tut!.step).toBe(3);
    expect(me.hyper).toBe(100);
    step(s, { 1: input({ bomb: 1, hyper: 1 }) });
    run(s, 0.1, { 1: input({ bomb: 1, hyper: 1 }) });
    expect(s.tut!.step).toBe(4);
    const f = s.flags[1];
    me.x = f.x;
    me.y = f.y;
    run(s, 0.1, { 1: input({ bomb: 1, hyper: 1 }) });
    expect(s.tut!.step).toBe(5);
    me.x = s.flags[0].homeX + 0.5;
    me.y = s.flags[0].homeY + 1.5;
    run(s, 0.1, { 1: input({ bomb: 1, hyper: 1 }) });
    expect(s.tut!.step).toBe(6);
    run(s, 5, { 1: input({ bomb: 1, hyper: 1 }) });
    expect(s.phase).toBe('ended');
    expect(s.winner).toBe(0);
  });

  it('sprites procedurales de los 6 personajes generan siluetas distintas 48x56 en todas las vistas', () => {
    const classes: ClassId[] = ['tanque', 'veloz', 'distancia', 'support', 'defensor', 'controlador'];
    const views: View[] = ['down', 'up', 'right'];
    const anims = Object.keys(ANIM_FRAMES) as Anim[];
    const signatures = new Set<string>();

    for (const cls of classes) {
      const pal = skinPalette(cls, 'base');
      const downIdle = renderFrame(cls, pal, 'down', 'idle', 0);
      expect(downIdle.w, cls).toBe(FW);
      expect(downIdle.h, cls).toBe(FH);

      let opaque = 0;
      let hash = 2166136261;
      for (let i = 0; i < downIdle.data.length; i++) {
        const px = downIdle.data[i];
        if ((px >>> 24) !== 0) opaque++;
        hash = Math.imul(hash ^ px, 16777619) >>> 0;
      }
      expect(opaque, cls).toBeGreaterThan(450);
      signatures.add(`${opaque}:${hash}`);

      for (const view of views) {
        for (const anim of anims) {
          const frameCount = anim === 'attack' ? ANIM_FRAMES[anim] : 1;
          let prevSig = '';
          for (let f = 0; f < frameCount; f++) {
            const frame = renderFrame(cls, pal, view, anim, f);
            expect(frame.w, `${cls}:${view}:${anim}:${f}`).toBe(FW);
            expect(frame.h, `${cls}:${view}:${anim}:${f}`).toBe(FH);
            let count = 0;
            let fhash = 2166136261;
            for (let i = 0; i < frame.data.length; i++) {
              const px = frame.data[i];
              if ((px >>> 24) !== 0) count++;
              fhash = Math.imul(fhash ^ px, 16777619) >>> 0;
            }
            expect(count, `${cls}:${view}:${anim}:${f}`).toBeGreaterThan(250);
            if (anim === 'attack' && f === 1) {
              expect(`${count}:${fhash}`, `${cls}:${view}:attack frame 1 differs from frame 0`).not.toBe(prevSig);
            }
            if (anim === 'attack' && f === 0) prevSig = `${count}:${fhash}`;
          }
        }
      }
    }

    expect(signatures.size).toBe(classes.length);

    for (const cls of ['distancia', 'support'] as const) {
      const s0 = hexToRgb(BASE_PAL[cls].s0);
      const s1 = hexToRgb(BASE_PAL[cls].s1);
      for (const ch of s0) expect(ch, `${cls}.s0`).toBeGreaterThanOrEqual(210);
      for (const ch of s1) expect(ch, `${cls}.s1`).toBeGreaterThanOrEqual(175);
    }

    expect(existsSync(resolve(process.cwd(), 'public/assets/nueva-version/posters/defensor.jpg'))).toBe(true);
    expect(bannerURL('defensor', 'base', 'poster')).toBe('/assets/nueva-version/posters/defensor.jpg');
  });

  it('mantiene notificaciones de muerte/hipercarga compactas sin duplicar anuncios ni redimensionar el HUD', () => {
    const s = createMatch(cfg('ctf'));
    const fb = new Feedback();

    fb.handle(
      [
        { t: 'hyperReady', p: 1 },
        { t: 'hyper', p: 1, cls: 'tanque', x: 2, y: 2 },
        { t: 'kill', p: 2, src: 1, as: [], how: 'bomb' },
        { t: 'streak', p: 1, n: 3 },
      ],
      s,
      [1],
      () => '#ffd23f',
    );

    expect(fb.gachaCutins.length).toBe(1);
    expect(fb.gachaCutins[0].kind).toBe('super');
    expect(fb.gachaCutins[0].life).toBeLessThanOrEqual(1.25);
    expect(fb.reactions.get(1)?.superT).toBeGreaterThan(0);

    // No duplicar el evento hyper en announcements, y a lo sumo 1 anuncio pequeño activo sin banner gigante
    expect(fb.announcements.filter((a) => !a.big).length).toBeLessThanOrEqual(1);
    for (const a of fb.announcements.filter((x) => !x.big)) {
      expect(a.cls).toBeUndefined();
      expect(a.life).toBeLessThanOrEqual(1.4);
    }

    // KillFeed capado a 3 entradas y expira en <= 3.2s
    fb.handle(
      [
        { t: 'kill', p: 2, src: 1, as: [], how: 'bomb' },
        { t: 'kill', p: 2, src: 1, as: [], how: 'bomb' },
        { t: 'kill', p: 2, src: 1, as: [], how: 'bomb' },
        { t: 'kill', p: 2, src: 1, as: [], how: 'bomb' },
      ],
      s,
      [1],
      () => '#ffd23f',
    );
    expect(fb.feed.length).toBeLessThanOrEqual(3);
    fb.tick(3.25);
    expect(fb.feed.length).toBe(0);
    expect(fb.announcements.length).toBe(0);

    // Invariantes de estabilidad de layout en CSS
    const css = readFileSync(resolve(process.cwd(), 'src/client/styles.css'), 'utf8');
    expect(css).toMatch(/\.hud-top\s*\{[^}]*height:\s*92px/s);
    expect(css).toMatch(/\.hud-card\.pixel-banner\s*\{[^}]*height:\s*58px/s);
    expect(css).toMatch(/\.gacha-unit-card\s*\{[^}]*height:\s*58px/s);
    expect(css).toMatch(/\.wing-cards\s*\{[^}]*flex-wrap:\s*nowrap/s);
    expect(css).toMatch(/\.gacha-signal\s*\{[^}]*position:\s*absolute/s);
  });
});
