// Salas y partidas online: emparejamiento, lobby y simulación autoritativa.
import type { WebSocket } from 'ws';
import { BotAI, BOT_NAMES } from '../src/shared/ai';
import { ELO, MODES, eloDelta } from '../src/shared/balance';
import { MAP_ORDER } from '../src/shared/maps';
import { applyMatch, type MatchSummary } from '../src/shared/profile';
import {
  PROTOCOL_VERSION,
  encodeSnapshot,
  initState,
  type ClientMsg,
  type MatchResult,
  type RoomInfo,
  type RoomListItem,
  type RoomMember,
  type RoomSettings,
  type ServerMsg,
  type WireInput,
} from '../src/shared/protocol';
import { DT, createMatch, resultFor } from '../src/shared/sim';
import { CLASS_IDS, type ClassId, type Difficulty, type GameEvent, type MatchConfig, type MatchState, type ModeId, type PlayerInput, type PlayerSlot } from '../src/shared/types';
import type { Db } from './db';
import { log } from './log';
import { RateLimiter, cleanText, filterChat, verifyJwt } from './security';
import { SimWorkerPool } from './simWorker';

export interface Conn {
  id: number;
  ws: WebSocket;
  ip: string;
  user: { id: number; username: string; role: 'player' | 'admin' } | null;
  name: string;
  room: Room | null;
  alive: boolean;
}

interface Member extends RoomMember {
  conn: Conn | null;
  fx: string;
  /** id del jugador dentro de la partida en curso */
  pid?: number;
}

const SNAP_EVERY = 3; // 60 Hz / 3 = 20 snapshots por segundo
const QUICK_WAIT = 12;
const MAX_QUEUE = 8;

function code(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function send(c: Conn | null | undefined, msg: ServerMsg) {
  if (!c || c.ws.readyState !== 1) return;
  c.ws.send(JSON.stringify(msg));
}

function sanitizeSettings(s: Partial<RoomSettings>, base: RoomSettings): RoomSettings {
  const out = { ...base };
  if (s.mode && s.mode in MODES && s.mode !== 'tutorial') out.mode = s.mode;
  if (s.map && (MAP_ORDER as string[]).includes(s.map)) out.map = s.map;
  if (typeof s.teamSize === 'number') out.teamSize = Math.max(1, Math.min(MODES[out.mode].teams ? 4 : 6, Math.round(s.teamSize)));
  if (typeof s.difficulty === 'number') out.difficulty = Math.max(0, Math.min(3, Math.round(s.difficulty))) as Difficulty;
  if (typeof s.timeLimit === 'number') out.timeLimit = Math.max(30, Math.min(900, Math.round(s.timeLimit)));
  if (typeof s.scoreLimit === 'number') out.scoreLimit = Math.max(1, Math.min(200, Math.round(s.scoreLimit)));
  if (typeof s.powerups === 'boolean') out.powerups = s.powerups;
  if (typeof s.public === 'boolean') out.public = s.public;
  if (s.mode && s.mode !== base.mode) {
    // al cambiar de modo, se toman los valores por defecto del modo
    out.timeLimit = MODES[out.mode].defaultTime;
    out.scoreLimit = MODES[out.mode].defaultScore;
    out.powerups = MODES[out.mode].powerups;
    if (!MODES[out.mode].teams) out.teamSize = Math.max(2, Math.min(6, out.teamSize * 2));
    else out.teamSize = Math.max(1, Math.min(4, Math.ceil(out.teamSize / 2)));
  }
  return out;
}

function defaultSettings(mode: ModeId = 'ctf'): RoomSettings {
  const m = MODES[mode];
  return {
    mode,
    map: MAP_ORDER[Math.floor(Math.random() * 3)],
    teamSize: m.teams ? 3 : 4,
    difficulty: 1,
    timeLimit: m.defaultTime,
    scoreLimit: m.defaultScore,
    powerups: m.powerups,
    public: true,
  };
}

export class Room {
  code = code();
  name: string;
  settings: RoomSettings;
  members: Member[] = [];
  state: 'lobby' | 'playing' = 'lobby';
  quick: boolean;
  countdown: number | null = null;
  match: MatchState | null = null;
  private ai = new BotAI(Date.now());
  private queues = new Map<number, WireInput[]>();
  private last = new Map<number, PlayerInput>();
  private ack: Record<number, number> = {};
  private events: GameEvent[] = [];
  private tilesSig = '';
  private startedAt = 0;
  private endT = -1;
  private nextMemberId = 1;
  lastActivity = Date.now();

  constructor(
    private mgr: RoomManager,
    settings: RoomSettings,
    quick: boolean,
    name: string,
  ) {
    this.settings = settings;
    this.quick = quick;
    this.name = name;
  }

  get capacity() {
    return MODES[this.settings.mode].teams ? this.settings.teamSize * 2 : this.settings.teamSize;
  }

  humans() {
    return this.members.filter((m) => m.conn);
  }

  info(): RoomInfo {
    return {
      code: this.code,
      name: this.name,
      settings: this.settings,
      members: this.members.map(({ conn: _c, fx: _f, pid: _p, ...m }) => m),
      state: this.state,
      quick: this.quick,
      countdown: this.countdown ?? undefined,
    };
  }

  listItem(): RoomListItem {
    return { code: this.code, name: this.name, mode: this.settings.mode, map: this.settings.map, players: this.humans().length, max: this.capacity, state: this.state };
  }

  broadcastRoom() {
    for (const m of this.members) if (m.conn) send(m.conn, { t: 'room', room: this.info(), you: m.id });
  }

  chat(from: string, text: string, sys = false) {
    for (const m of this.members) if (m.conn) send(m.conn, { t: 'chat', from, text, sys });
  }

  // --- miembros ----------------------------------------------------------------

  add(c: Conn, elo: number): boolean {
    // reconexión a una partida en curso
    if (c.user) {
      const prev = this.members.find((m) => m.userId === c.user!.id);
      if (prev) {
        prev.conn = c;
        c.room = this;
        if (this.match && prev.pid !== undefined) {
          const p = this.match.players.find((q) => q.id === prev.pid);
          if (p) p.bot = false;
          send(c, { t: 'start', config: this.match.config, you: prev.pid, init: initState(this.match) });
        }
        this.chat('', `${prev.name} volvió a la partida`, true);
        this.broadcastRoom();
        return true;
      }
    }
    if (this.state === 'playing') return false;
    if (this.humans().length >= this.capacity) return false;
    const teams = MODES[this.settings.mode].teams;
    const count = [0, 0];
    for (const m of this.members) count[m.team]++;
    const team = teams ? (count[0] <= count[1] ? 0 : 1) : 0;
    const used = new Set(this.members.filter((m) => m.team === team).map((m) => m.cls));
    const cls = CLASS_IDS.find((x) => !used.has(x)) ?? 'tanque';
    const member: Member = {
      id: this.nextMemberId++,
      name: c.name,
      team,
      cls,
      skin: 'base',
      fx: 'clasico',
      ready: this.quick,
      host: this.members.length === 0,
      userId: c.user?.id,
      elo,
      conn: c,
    };
    this.members.push(member);
    c.room = this;
    this.lastActivity = Date.now();
    if (this.quick) {
      if (this.countdown === null) this.countdown = QUICK_WAIT;
      if (this.humans().length >= this.capacity) this.countdown = Math.min(this.countdown, 3);
    }
    this.chat('', `${member.name} entró a la sala`, true);
    this.broadcastRoom();
    return true;
  }

  remove(c: Conn) {
    const m = this.members.find((x) => x.conn === c);
    c.room = null;
    if (!m) return;
    if (this.state === 'playing' && this.match) {
      // el jugador se desconectó: un bot toma su lugar hasta que vuelva
      m.conn = null;
      const p = this.match.players.find((q) => q.id === m.pid);
      if (p) {
        p.bot = true;
        p.difficulty = this.settings.difficulty;
      }
      this.chat('', `${m.name} se desconectó (lo reemplaza un bot)`, true);
    } else {
      this.members = this.members.filter((x) => x !== m);
      if (m.host && this.members.length) this.members[0].host = true;
      this.chat('', `${m.name} salió de la sala`, true);
    }
    if (this.humans().length === 0) {
      this.mgr.destroy(this);
      return;
    }
    this.broadcastRoom();
  }

  member(c: Conn) {
    return this.members.find((m) => m.conn === c);
  }

  // --- mensajes de lobby -----------------------------------------------------

  handle(c: Conn, msg: ClientMsg) {
    const me = this.member(c);
    if (!me) return;
    this.lastActivity = Date.now();
    switch (msg.t) {
      case 'pick': {
        if (this.state !== 'lobby') return;
        if (!CLASS_IDS.includes(msg.cls)) return;
        if (MODES[this.settings.mode].teams && this.members.some((m) => m !== me && m.team === me.team && m.cls === msg.cls)) {
          send(c, { t: 'error', msg: 'Ese personaje ya lo eligió alguien de tu equipo.' });
          return;
        }
        me.cls = msg.cls;
        me.skin = cleanText(msg.skin, 20) || 'base';
        me.fx = cleanText(msg.fx, 20) || 'clasico';
        this.broadcastRoom();
        break;
      }
      case 'team': {
        if (this.state !== 'lobby' || !MODES[this.settings.mode].teams) return;
        const t = msg.team === 1 ? 1 : 0;
        if (this.members.filter((m) => m.team === t).length >= this.settings.teamSize) return;
        me.team = t;
        if (this.members.some((m) => m !== me && m.team === t && m.cls === me.cls)) {
          const used = new Set(this.members.filter((m) => m.team === t).map((m) => m.cls));
          me.cls = CLASS_IDS.find((x) => !used.has(x)) ?? me.cls;
        }
        this.broadcastRoom();
        break;
      }
      case 'ready':
        me.ready = !!msg.ready;
        this.broadcastRoom();
        break;
      case 'settings':
        if (!me.host || this.quick || this.state !== 'lobby') return;
        this.settings = sanitizeSettings(msg.settings, this.settings);
        this.rebalance();
        this.broadcastRoom();
        break;
      case 'start':
        if (!me.host || this.state !== 'lobby') return;
        if (this.humans().some((m) => !m.ready && !m.host)) {
          send(c, { t: 'error', msg: 'Todavía hay jugadores que no están listos.' });
          return;
        }
        this.start();
        break;
      case 'chat': {
        const text = filterChat(cleanText(msg.text, 120));
        if (text) this.chat(me.name, text);
        break;
      }
      case 'in': {
        if (!this.match || me.pid === undefined || !Array.isArray(msg.i)) return;
        const q = this.queues.get(me.pid) ?? [];
        for (const w of msg.i.slice(0, 10)) {
          if (!Array.isArray(w) || w.length !== 6 || !w.every((n) => Number.isFinite(n))) continue;
          q.push(w);
        }
        while (q.length > MAX_QUEUE) q.shift();
        this.queues.set(me.pid, q);
        break;
      }
    }
  }

  private rebalance() {
    const teams = MODES[this.settings.mode].teams;
    if (!teams) {
      for (const m of this.members) m.team = 0;
      return;
    }
    const count = [0, 0];
    for (const m of this.members) {
      if (m.team > 1) m.team = count[0] <= count[1] ? 0 : 1;
      count[m.team]++;
    }
    while (count[0] > this.settings.teamSize || count[1] > this.settings.teamSize) {
      const from = count[0] > count[1] ? 0 : 1;
      const m = [...this.members].reverse().find((x) => x.team === from)!;
      m.team = 1 - from;
      count[from]--;
      count[1 - from]++;
    }
  }

  // --- partida ------------------------------------------------------------------

  start() {
    const st = this.settings;
    const teams = MODES[st.mode].teams;
    const slots: PlayerSlot[] = [];
    let id = 1;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    let ni = 0;
    const humans = this.humans();
    if (teams) {
      for (let t = 0; t < 2; t++) {
        const used = new Set<ClassId>();
        for (const m of humans.filter((x) => x.team === t)) {
          let cls = m.cls;
          if (used.has(cls)) cls = CLASS_IDS.find((x) => !used.has(x)) ?? cls;
          used.add(cls);
          m.pid = id;
          slots.push({ id: id++, name: m.name, team: t, cls, skin: m.skin, fx: m.fx, bot: false, difficulty: st.difficulty, userId: m.userId });
        }
        const count = humans.filter((x) => x.team === t).length;
        for (let i = count; i < st.teamSize; i++) {
          const cls = CLASS_IDS.filter((x) => !used.has(x))[Math.floor(Math.random() * Math.max(1, 6 - used.size))] ?? 'tanque';
          used.add(cls);
          slots.push({ id: id++, name: names[ni++ % names.length], team: t, cls, skin: 'base', fx: 'clasico', bot: true, difficulty: st.difficulty });
        }
      }
    } else {
      humans.forEach((m, i) => {
        m.pid = id;
        slots.push({ id: id++, name: m.name, team: i, cls: m.cls, skin: m.skin, fx: m.fx, bot: false, difficulty: st.difficulty, userId: m.userId });
      });
      for (let i = humans.length; i < Math.max(2, st.teamSize); i++) {
        slots.push({ id: id++, name: names[ni++ % names.length], team: i, cls: CLASS_IDS[Math.floor(Math.random() * 6)], skin: 'base', fx: 'clasico', bot: true, difficulty: st.difficulty });
      }
    }
    const config: MatchConfig = {
      mode: st.mode,
      map: st.map,
      slots,
      timeLimit: st.timeLimit,
      scoreLimit: st.scoreLimit,
      powerups: st.powerups,
      seed: (Math.random() * 2 ** 31) | 0,
    };
    this.match = createMatch(config);
    this.ai = new BotAI(config.seed);
    this.queues.clear();
    this.last.clear();
    this.ack = {};
    this.events = [];
    this.tilesSig = '';
    this.state = 'playing';
    this.countdown = null;
    this.startedAt = Date.now();
    this.endT = -1;
    const init = initState(this.match);
    for (const m of humans) send(m.conn, { t: 'start', config, you: m.pid!, init });
    this.broadcastRoom();
    log.info('match_start', { room: this.code, mode: st.mode, map: st.map, humans: humans.length });
  }

  /** Un tick de 60 Hz. */
  tick() {
    if (this.state === 'lobby') {
      if (this.quick && this.countdown !== null) {
        const before = Math.ceil(this.countdown);
        this.countdown -= DT;
        if (Math.ceil(this.countdown) !== before) this.broadcastRoom();
        if (this.countdown <= 0) this.start();
      }
      return;
    }
    const s = this.match;
    if (!s) return;
    const inputs: Record<number, PlayerInput> = this.ai.inputs(s);
    for (const p of s.players) {
      if (p.bot) continue;
      const q = this.queues.get(p.id);
      let w = q?.shift();
      // si el cliente va adelantado, se procesan dos entradas por tick
      if (q && q.length > 4) w = q.shift();
      if (w) {
        const inp: PlayerInput = { dir: (w[1] >= 0 && w[1] <= 3 ? w[1] : -1) as PlayerInput['dir'], bomb: w[2] | 0, attack: w[3] === 1, hyper: w[4] | 0, emote: w[5] | 0 };
        this.last.set(p.id, inp);
        this.ack[p.id] = w[0];
      }
      inputs[p.id] = this.last.get(p.id) ?? { dir: -1, bomb: p.prevBomb, attack: false, hyper: p.prevHyper, emote: p.prevEmote };
    }
    this.mgr.simPool.stepSync(s, inputs);
    if (s.events.length) this.events.push(...s.events);
    if (s.tick % SNAP_EVERY === 0) this.sendSnapshot();
    if (s.phase === 'ended') {
      if (this.endT < 0) {
        this.endT = s.time;
        this.sendSnapshot();
        this.finish();
      }
    }
  }

  private sendSnapshot() {
    const s = this.match!;
    const sig = s.tiles.join('');
    const includeTiles = sig !== this.tilesSig;
    this.tilesSig = sig;
    const snap = encodeSnapshot(s, this.ack, includeTiles);
    const msg = JSON.stringify({ t: 's', s: snap, ev: this.events } satisfies ServerMsg);
    this.events = [];
    for (const m of this.members) if (m.conn && m.conn.ws.readyState === 1) m.conn.ws.send(msg);
  }

  private finish() {
    const s = this.match!;
    const db = this.mgr.db;
    const result: MatchResult = {
      winner: s.winner,
      players: s.players.map((p) => ({ id: p.id, name: p.name, team: p.team, cls: p.cls, bot: p.bot, kills: p.kills, deaths: p.deaths, assists: p.assists, caps: p.caps, returns: p.returns, points: p.points, dmg: p.dmg })),
    };
    const outbox: Array<{ conn: Conn | null | undefined; msg: ServerMsg }> = [];
    const matchId = db.tx(() => {
      const teams = MODES[s.config.mode].teams;
      // ELO de cada jugador (bots según dificultad)
      const ratingOf = (pid: number) => {
        const m = this.members.find((x) => x.pid === pid);
        if (m?.userId) return db.getProfile(m.userId).elo;
        const p = s.players.find((q) => q.id === pid)!;
        return ELO.botRating[p.difficulty];
      };
      const avg = (ids: number[]) => (ids.length ? ids.reduce((a, id) => a + ratingOf(id), 0) / ids.length : ELO.start);
      const id = db.insertMatch({ room: this.code, mode: s.config.mode, map: s.config.map, winner: s.winner, duration: s.time, started: this.startedAt });
      for (const p of s.players) {
        const member = this.members.find((x) => x.pid === p.id);
        const userId = member?.userId ?? null;
        const res = resultFor(s, p);
        let eloBefore: number | null = null;
        let eloAfter: number | null = null;
        let xp: number | null = null;
        let coins: number | null = null;
        if (userId) {
          const profile = db.getProfile(userId);
          const mine = s.players.filter((q) => q.team === p.team).map((q) => q.id);
          const others = s.players.filter((q) => q.team !== p.team).map((q) => q.id);
          const teamPts = s.players.filter((q) => q.team === p.team).reduce((a, q) => a + q.points, 0);
          const share = teamPts > 0 ? p.points / teamPts : 1 / Math.max(1, mine.length);
          const myAvg = teams ? avg(mine) : ratingOf(p.id);
          const delta = eloDelta(myAvg, avg(others), res === 'win' ? 1 : res === 'draw' ? 0.5 : 0, share);
          eloBefore = profile.elo;
          const sum: MatchSummary = {
            mode: s.config.mode,
            map: s.config.map,
            cls: p.cls,
            result: res,
            kills: p.kills,
            deaths: p.deaths,
            assists: p.assists,
            caps: p.caps,
            returns: p.returns,
            defends: p.defends,
            dmg: p.dmg,
            heal: Math.round(p.heal),
            blocks: p.blocks,
            points: p.points,
            roundWins: s.roundWins[p.team] ?? 0,
            duration: Math.round(s.time),
            bestStreak: p.streak,
            online: true,
            pointsShare: share,
            eloDelta: delta,
          };
          const rewards = applyMatch(profile, sum);
          db.saveProfile(userId, profile);
          db.logElo(userId, rewards.eloDelta, profile.elo);
          eloAfter = profile.elo;
          xp = rewards.xp;
          coins = rewards.coins;
          outbox.push({ conn: member?.conn, msg: { t: 'end', result, rewards, profile } });
        } else if (member?.conn) {
          outbox.push({ conn: member.conn, msg: { t: 'end', result, rewards: null, profile: null } });
        }
        db.insertMatchPlayer(id, {
          userId,
          name: p.name,
          bot: p.bot && !member,
          team: p.team,
          cls: p.cls,
          result: res,
          kills: p.kills,
          deaths: p.deaths,
          assists: p.assists,
          caps: p.caps,
          returns: p.returns,
          dmg: p.dmg,
          points: p.points,
          eloBefore,
          eloAfter,
          xp,
          coins,
        });
      }
      return id;
    });
    for (const item of outbox) send(item.conn, item.msg);
    log.info('match_end', { room: this.code, match: matchId, winner: s.winner, duration: Math.round(s.time) });
    // la sala vuelve al lobby (revancha) después de un rato
    setTimeout(() => this.backToLobby(), 6000);
  }

  private backToLobby() {
    this.match = null;
    this.state = 'lobby';
    this.members = this.members.filter((m) => m.conn);
    for (const m of this.members) {
      m.ready = this.quick;
      m.pid = undefined;
      if (m.userId) m.elo = this.mgr.db.getProfile(m.userId).elo;
    }
    if (!this.members.length) {
      this.mgr.destroy(this);
      return;
    }
    if (!this.members.some((m) => m.host)) this.members[0].host = true;
    if (this.quick) this.countdown = QUICK_WAIT + 8;
    this.broadcastRoom();
  }
}

export class RoomManager {
  rooms = new Map<string, Room>();
  conns = new Set<Conn>();
  private nextConn = 1;
  private msgLimiter = new RateLimiter(200, 120);
  private timer: NodeJS.Timeout | null = null;
  readonly simPool = new SimWorkerPool();

  constructor(
    readonly db: Db,
    private secret: string,
  ) {}

  startLoop() {
    let last = performance.now();
    let acc = 0;
    const loop = () => {
      const now = performance.now();
      acc += Math.min(250, now - last);
      last = now;
      let n = 0;
      while (acc >= DT * 1000 && n < 10) {
        acc -= DT * 1000;
        n++;
        for (const r of this.rooms.values()) {
          try {
            r.tick();
          } catch (e) {
            log.error('room_tick', { room: r.code, err: String(e) });
          }
        }
      }
      // limpieza de salas abandonadas
      for (const r of this.rooms.values()) if (r.state === 'lobby' && Date.now() - r.lastActivity > 30 * 60000) this.destroy(r);
      this.timer = setTimeout(loop, 4);
    };
    loop();
  }

  stop() {
    if (this.timer) clearTimeout(this.timer);
    void this.simPool.close();
  }

  destroy(r: Room) {
    this.rooms.delete(r.code);
    for (const m of r.members) if (m.conn) m.conn.room = null;
  }

  connect(ws: WebSocket, ip: string): Conn {
    const c: Conn = { id: this.nextConn++, ws, ip, user: null, name: `Invitado${Math.floor(Math.random() * 900 + 100)}`, room: null, alive: true };
    this.conns.add(c);
    ws.on('message', (data) => {
      if (!this.msgLimiter.take(`c${c.id}`)) return;
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object' || typeof (msg as { t?: unknown }).t !== 'string') return;
      try {
        this.handle(c, msg);
      } catch (e) {
        log.error('ws_handle', { err: String(e) });
      }
    });
    ws.on('close', () => {
      this.conns.delete(c);
      c.room?.remove(c);
    });
    ws.on('pong', () => (c.alive = true));
    return c;
  }

  heartbeat() {
    for (const c of this.conns) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }

  private handle(c: Conn, msg: ClientMsg) {
    switch (msg.t) {
      case 'hello': {
        if (msg.v !== PROTOCOL_VERSION) {
          send(c, { t: 'error', msg: 'Versión del juego desactualizada: recargá la página.' });
          return;
        }
        if (msg.token) {
          const jwt = verifyJwt(msg.token, this.secret);
          const u = jwt ? this.db.userById(jwt.sub) : undefined;
          if (u && !u.banned) {
            c.user = { id: u.id, username: u.username, role: u.role };
            c.name = this.db.getProfile(u.id).name || u.username;
          }
        }
        if (!c.user) c.name = cleanText(msg.name, 16) || c.name;
        send(c, { t: 'welcome', conn: c.id, user: c.user ? { id: c.user.id, username: c.user.username } : null, online: this.conns.size });
        // ¿estaba en una partida en curso?
        if (c.user) {
          for (const r of this.rooms.values()) {
            if (r.state === 'playing' && r.members.some((m) => m.userId === c.user!.id && !m.conn)) {
              r.add(c, this.eloOf(c));
              return;
            }
          }
        }
        break;
      }
      case 'lobby':
        send(c, { t: 'rooms', rooms: [...this.rooms.values()].filter((r) => r.settings.public).map((r) => r.listItem()) });
        break;
      case 'create': {
        if (this.db.isMaintenanceActive()) {
          send(c, { t: 'error', msg: 'Las partidas están deshabilitadas temporalmente por mantenimiento programado.' });
          return;
        }
        c.room?.remove(c);
        const settings = sanitizeSettings(msg.settings ?? {}, defaultSettings(msg.settings?.mode));
        const r = new Room(this, settings, false, `Sala de ${c.name}`);
        this.rooms.set(r.code, r);
        r.add(c, this.eloOf(c));
        log.info('room_create', { room: r.code, by: c.name });
        break;
      }
      case 'join': {
        if (this.db.isMaintenanceActive()) {
          send(c, { t: 'error', msg: 'Las partidas están deshabilitadas temporalmente por mantenimiento programado.' });
          return;
        }
        const code = cleanText(msg.code, 8).toUpperCase();
        const r = this.rooms.get(code);
        if (!r) {
          send(c, { t: 'error', msg: 'No existe una sala con ese código.' });
          return;
        }
        if (c.room && c.room !== r) c.room.remove(c);
        if (!r.add(c, this.eloOf(c))) send(c, { t: 'error', msg: r.state === 'playing' ? 'La partida ya empezó.' : 'La sala está llena.' });
        break;
      }
      case 'quick': {
        c.room?.remove(c);
        const mode: ModeId = msg.mode && msg.mode in MODES && msg.mode !== 'tutorial' ? msg.mode : 'ctf';
        let r = [...this.rooms.values()].find((x) => x.quick && x.state === 'lobby' && x.settings.mode === mode && x.humans().length < x.capacity);
        if (!r) {
          r = new Room(this, defaultSettings(mode), true, `Partida rápida · ${MODES[mode].name}`);
          this.rooms.set(r.code, r);
        }
        r.add(c, this.eloOf(c));
        break;
      }
      case 'leave':
        c.room?.remove(c);
        send(c, { t: 'room', room: null, you: 0 });
        break;
      case 'ping':
        send(c, { t: 'pong', ts: Number(msg.ts) || 0 });
        break;
      default:
        c.room?.handle(c, msg);
    }
  }

  private eloOf(c: Conn): number {
    return c.user ? this.db.getProfile(c.user.id).elo : ELO.start;
  }

  stats() {
    return { online: this.conns.size, rooms: this.rooms.size, playing: [...this.rooms.values()].filter((r) => r.state === 'playing').length };
  }
}
