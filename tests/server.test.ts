import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Db } from '../server/db';
import { Room, RoomManager } from '../server/rooms';
import { SimWorkerPool } from '../server/simWorker';
import { hashPassword, signJwt, verifyJwt, verifyPassword, RateLimiter, cleanText } from '../server/security';
import { applyMatch, buyItem, newProfile } from '../src/shared/profile';
import { eloDelta, levelFromXp, computeRewards } from '../src/shared/balance';
import { encodeSnapshot, applySnapshot, initState } from '../src/shared/protocol';
import { createMatch, step } from '../src/shared/sim';
import { BotAI } from '../src/shared/ai';

describe('seguridad', () => {
  it('hashea y verifica contraseñas', () => {
    const h = hashPassword('secreto1');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(verifyPassword('secreto1', h)).toBe(true);
    expect(verifyPassword('otra', h)).toBe(false);
  });

  it('firma y valida JWT, y rechaza firmas alteradas o vencidas', () => {
    const t = signJwt({ sub: 5, role: 'player', name: 'x' }, 'k');
    expect(verifyJwt(t, 'k')?.sub).toBe(5);
    expect(verifyJwt(t, 'otra-clave')).toBeNull();
    const [h, b, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 1, role: 'admin', name: 'x', iat: 0, exp: 9e9 })).toString('base64url');
    expect(verifyJwt(`${h}.${forged}.${s}`, 'k')).toBeNull();
    const old = signJwt({ sub: 5, role: 'player', name: 'x' }, 'k', -10);
    expect(verifyJwt(old, 'k')).toBeNull();
    void b;
  });

  it('limita peticiones', () => {
    const rl = new RateLimiter(3, 0.001);
    expect([rl.take('a'), rl.take('a'), rl.take('a'), rl.take('a')]).toEqual([true, true, true, false]);
    expect(rl.take('b')).toBe(true);
  });

  it('limpia texto libre', () => {
    expect(cleanText('<script>hola</script>\u0000', 50)).toBe('scripthola/script');
    expect(cleanText('x'.repeat(100), 10).length).toBe(10);
  });
});

describe('base de datos', () => {
  let db: Db;
  beforeAll(() => {
    db = new Db(':memory:');
  });
  afterAll(() => db.close());

  it('crea usuarios únicos con perfil', () => {
    const u = db.createUser('lucas', 'lucas@x.com', hashPassword('secreto1'));
    expect(u.role).toBe('player');
    expect(db.getProfile(u.id).name).toBe('lucas');
    expect(() => db.createUser('LUCAS', 'otro@x.com', 'h')).toThrow();
  });

  it('guarda partidas y arma el ranking', () => {
    const u = db.userByName('lucas')!;
    const p = db.getProfile(u.id);
    p.elo = 1234;
    db.saveProfile(u.id, p);
    const mid = db.insertMatch({ room: 'ABCDE', mode: 'ctf', map: 'ruinas', winner: 0, duration: 200, started: Date.now() - 200000 });
    db.insertMatchPlayer(mid, { userId: u.id, name: 'lucas', bot: false, team: 0, cls: 'tanque', result: 'win', kills: 3, deaths: 1, assists: 0, caps: 1, returns: 0, dmg: 300, points: 900, eloBefore: 1200, eloAfter: 1234, xp: 100, coins: 50 });
    db.logElo(u.id, 34, 1234);
    const g = db.ranking('global');
    expect(g[0].name).toBe('lucas');
    expect(g[0].value).toBe(1234);
    expect(db.ranking('semanal')[0].value).toBe(34);
    expect(db.history(u.id).length).toBe(1);
    expect(db.adminStats().matches).toBe(1);
  });

  it('los códigos de recuperación se usan una sola vez', () => {
    const u = db.userByName('lucas')!;
    db.addReset('hash1', u.id, Date.now() + 60000);
    expect(db.useReset('hash1')).toBe(u.id);
    expect(db.useReset('hash1')).toBeNull();
    db.addReset('hash2', u.id, Date.now() - 1);
    expect(db.useReset('hash2')).toBeNull();
  });

  it('transacciones atómicas hacen commit y rollback ante error', () => {
    const before = db.adminStats().matches;
    const committedId = db.tx(() =>
      db.insertMatch({ room: 'TXOK1', mode: 'duelo', map: 'ruinas_chico', winner: 0, duration: 50, started: Date.now() - 50000 }),
    );
    expect(committedId).toBeGreaterThan(0);
    expect(db.adminStats().matches).toBe(before + 1);

    expect(() =>
      db.tx(() => {
        db.insertMatch({ room: 'TXBAD', mode: 'ctf', map: 'ruinas', winner: 1, duration: 90, started: Date.now() - 90000 });
        throw new Error('fallo simulado');
      }),
    ).toThrow('fallo simulado');
    expect(db.adminStats().matches).toBe(before + 1);
  });
});

describe('progresión y economía', () => {
  it('niveles y recompensas', () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(150).level).toBe(2);
    const r = computeRewards({ won: true, draw: false, kills: 3, assists: 1, caps: 1, defends: 0, returns: 0 });
    expect(r.xp).toBeGreaterThan(0);
    expect(r.coins).toBeGreaterThan(0);
  });

  it('ELO: ganar a un rival más fuerte da más puntos', () => {
    expect(eloDelta(1000, 1200, 1, 0.33)).toBeGreaterThan(eloDelta(1000, 800, 1, 0.33));
    expect(eloDelta(1000, 1000, 0, 0.33)).toBeLessThan(0);
  });

  it('aplica una partida al perfil y desbloquea logros', () => {
    const p = newProfile('x');
    const r = applyMatch(p, { mode: 'ctf', map: 'ruinas', cls: 'veloz', result: 'win', kills: 2, deaths: 0, assists: 1, caps: 2, returns: 0, defends: 0, dmg: 200, heal: 0, blocks: 3, points: 1500, roundWins: 0, duration: 200, bestStreak: 2, online: false, difficulty: 1, pointsShare: 0.5 });
    expect(p.stats.wins).toBe(1);
    expect(r.achievements).toContain('primera');
    expect(r.achievements).toContain('intocable');
    expect(p.eloIA).toBeGreaterThan(1000);
    expect(p.history.length).toBe(1);
  });

  it('la tienda valida monedas y duplicados', () => {
    const p = newProfile('x');
    p.coins = 300;
    expect(buyItem(p, 'skin:tanque:hielo', 250).ok).toBe(true);
    expect(buyItem(p, 'skin:tanque:hielo', 250).ok).toBe(false);
    expect(buyItem(p, 'skin:tanque:oro', 1000).ok).toBe(false);
    expect(p.coins).toBe(50);
  });
});

describe('red', () => {
  it('los snapshots reproducen el estado del servidor', () => {
    const cfg = {
      mode: 'ctf' as const,
      map: 'fabrica' as const,
      timeLimit: 120,
      scoreLimit: 3,
      powerups: false,
      seed: 3,
      slots: [
        { id: 1, name: 'a', team: 0, cls: 'veloz' as const, skin: 'base', bot: true, difficulty: 2 as const },
        { id: 2, name: 'b', team: 1, cls: 'tanque' as const, skin: 'base', bot: true, difficulty: 2 as const },
      ],
    };
    const server = createMatch(cfg);
    const client = JSON.parse(JSON.stringify(initState(server)));
    const ai = new BotAI(1);
    for (let i = 0; i < 900; i++) step(server, ai.inputs(server));
    const snap = JSON.parse(JSON.stringify(encodeSnapshot(server, { 1: 10 }, true)));
    applySnapshot(client, snap);
    expect(client.players[0].x).toBeCloseTo(server.players[0].x, 2);
    expect(client.players[1].hp).toBeCloseTo(server.players[1].hp, 1);
    expect(client.tiles).toEqual(server.tiles);
    expect(client.bombs.length).toBe(server.bombs.length);
    expect(client.phase).toBe(server.phase);
  });
});

describe('concurrencia y worker pool', () => {
  it('aisla el estado entre múltiples salas concurrentes y resiste fallo de una sala', () => {
    const isoDb = new Db(':memory:');
    const mgr = new RoomManager(isoDb, 'secret');
    try {
      const r1 = new Room(
        mgr,
        { mode: 'duelo', map: 'ruinas_chico', teamSize: 1, difficulty: 1, timeLimit: 120, scoreLimit: 3, powerups: true, public: true },
        false,
        'Sala 1',
      );
      const r2 = new Room(
        mgr,
        { mode: 'ctf', map: 'ruinas', teamSize: 2, difficulty: 1, timeLimit: 180, scoreLimit: 3, powerups: true, public: true },
        false,
        'Sala 2',
      );
      mgr.rooms.set(r1.code, r1);
      mgr.rooms.set(r2.code, r2);

      r1.start();
      r2.start();
      expect(r1.state).toBe('playing');
      expect(r2.state).toBe('playing');
      expect(r1.match!.w).toBe(15);
      expect(r2.match!.w).toBe(27);

      const r2StartTick = r2.match!.tick;
      for (let i = 0; i < 10; i++) {
        r1.tick();
        r2.tick();
      }
      expect(r2.match!.tick).toBe(r2StartTick + 10);
      expect(r1.match!.tick).toBe(10);

      // Destruir Sala 1 no altera Sala 2
      mgr.destroy(r1);
      expect(mgr.rooms.has(r1.code)).toBe(false);
      r2.tick();
      expect(r2.match!.tick).toBe(r2StartTick + 11);
    } finally {
      mgr.stop();
      isoDb.close();
    }
  });

  it('SimWorkerPool ejecuta simulación síncrona y en Worker Thread aislado', async () => {
    const pool = new SimWorkerPool(2);
    try {
      const s1 = createMatch({
        mode: 'duelo',
        map: 'ruinas_chico',
        timeLimit: 90,
        scoreLimit: 3,
        powerups: true,
        seed: 7,
        slots: [
          { id: 1, name: 'a', team: 0, cls: 'tanque', skin: 'base', bot: true, difficulty: 1 },
          { id: 2, name: 'b', team: 1, cls: 'veloz', skin: 'base', bot: true, difficulty: 1 },
        ],
      });
      const s2 = createMatch({
        mode: 'ctf',
        map: 'ruinas',
        timeLimit: 120,
        scoreLimit: 3,
        powerups: false,
        seed: 9,
        slots: [
          { id: 1, name: 'c', team: 0, cls: 'support', skin: 'base', bot: true, difficulty: 1 },
          { id: 2, name: 'd', team: 1, cls: 'distancia', skin: 'base', bot: true, difficulty: 1 },
        ],
      });

      pool.stepSync(s1, {});
      expect(s1.tick).toBe(1);

      const nextS2 = await pool.stepAsync(s2, {}, 'ROOM_TEST');
      expect(pool.activeWorkers).toBe(1);
      expect(nextS2.tick).toBe(1);
      expect(s1.tick).toBe(1);
      expect(nextS2.config.map).toBe('ruinas');
    } finally {
      await pool.close();
    }
  });
});
