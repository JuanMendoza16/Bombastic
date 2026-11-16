// Cliente de red: conexión WebSocket con el servidor, lobby/salas y sesión online
// con predicción del movimiento propio e interpolación del resto.
import { RULES } from '../../shared/balance';
import type { MatchRewards } from '../../shared/profile';
import { PROTOCOL_VERSION, applySnapshot, type ClientMsg, type MatchResult, type RoomInfo, type RoomListItem, type RoomSettings, type ServerMsg, type Snapshot, type WireInput } from '../../shared/protocol';
import { DT, moveAxis, playerSpeed, walk } from '../../shared/sim';
import type { ClassId, Dir, GameEvent, MatchConfig, MatchState, ModeId } from '../../shared/types';
import { getToken, wsUrl } from '../services/api';
import { profiles } from '../services/profile';
import { input } from './input';
import type { Session } from './session';

export interface ChatLine {
  id: number;
  from: string;
  text: string;
  sys?: boolean;
}

type Listener = () => void;

export class OnlineSession implements Session {
  readonly kind = 'online';
  state: MatchState;
  localIds: number[];
  paused = false;
  alpha = 1;
  prev = new Map<number, { x: number; y: number }>();
  canPause = false;
  status?: string;
  ping = 0;
  private events: GameEvent[] = [];
  private acc = 0;
  private seq = 0;
  private history: { seq: number; dir: Dir | -1 }[] = [];
  private outbox: WireInput[] = [];
  private prevPos = new Map<number, { x: number; y: number }>();
  private curPos = new Map<number, { x: number; y: number }>();
  private lastSnapAt = 0;
  private snapInterval = 50;
  private me: number;
  ended: { result: MatchResult; rewards: MatchRewards | null } | null = null;
  endWaiters: ((r: MatchRewards | null) => void)[] = [];

  constructor(
    private net: NetClient,
    config: MatchConfig,
    you: number,
    init: MatchState,
  ) {
    this.state = { ...init, config, events: [] };
    this.me = you;
    this.localIds = [you];
    for (const p of this.state.players) {
      p.local = p.id === you ? 0 : undefined;
      this.curPos.set(p.id, { x: p.x, y: p.y });
      this.prevPos.set(p.id, { x: p.x, y: p.y });
    }
    input.localCount = 1;
  }

  onSnapshot(snap: Snapshot, ev: GameEvent[]) {
    const now = performance.now();
    if (this.lastSnapAt) this.snapInterval = this.snapInterval * 0.8 + Math.min(200, now - this.lastSnapAt) * 0.2;
    this.lastSnapAt = now;
    // guardamos posiciones para interpolar
    for (const [id, pos] of this.curPos) this.prevPos.set(id, pos);
    applySnapshot(this.state, snap);
    for (const p of this.state.players) this.curPos.set(p.id, { x: p.x, y: p.y });
    // reconciliación: desde la posición del servidor, re-aplicamos las entradas no confirmadas
    const me = this.state.players.find((p) => p.id === this.me);
    const ack = snap.ack[this.me] ?? 0;
    this.history = this.history.filter((h) => h.seq > ack);
    if (me && me.alive && this.state.phase === 'playing') {
      for (const h of this.history) this.predictStep(me, h.dir);
    }
    if (ev.length) this.events.push(...ev);
    this.status = undefined;
  }

  private predictStep(me: MatchState['players'][number], dir: Dir | -1) {
    if (me.slowT > 0) {
      me.slowT -= DT;
      if (me.slowT <= 0) me.slowF = 1;
    }
    if (me.stunT <= 0) {
      if (me.dashT > 0) {
        walk(this.state, me, me.dir, 17 * DT);
      } else if (dir !== -1) {
        me.dir = dir;
        const moved = walk(this.state, me, dir, playerSpeed(this.state, me) * DT);
        me.walk += moved;
        me.moving = moved > 0.0005;
      } else me.moving = false;
    } else me.moving = false;
    if (Math.abs(me.kbx) > 0.05 || Math.abs(me.kby) > 0.05) {
      moveAxis(this.state, me, true, me.kbx * DT);
      moveAxis(this.state, me, false, me.kby * DT);
      me.kbx *= 0.86;
      me.kby *= 0.86;
    } else {
      me.kbx = 0;
      me.kby = 0;
    }
    if (me.dashT <= 0) {
      const cv = this.state.conv[Math.floor(me.y) * this.state.w + Math.floor(me.x)];
      if (cv > 0) walk(this.state, me, (cv - 1) as Dir, RULES.conveyorSpeed * DT);
    }
  }

  update(dt: number): GameEvent[] {
    const s = this.state;
    const me = s.players.find((p) => p.id === this.me);
    this.acc += Math.min(0.25, dt);
    let steps = 0;
    while (this.acc >= DT && steps < 8) {
      this.acc -= DT;
      steps++;
      this.seq++;
      const inp = input.read(0);
      this.outbox.push([this.seq, inp.dir, inp.bomb, inp.attack ? 1 : 0, inp.hyper, inp.emote]);
      this.history.push({ seq: this.seq, dir: inp.dir });
      if (this.history.length > 120) this.history.shift();
      if (me && me.alive && s.phase === 'playing') this.predictStep(me, inp.dir);
    }
    if (this.outbox.length) {
      this.net.send({ t: 'in', i: this.outbox });
      this.outbox = [];
    }
    // interpolación del resto de los jugadores
    const k = Math.max(0, Math.min(1, (performance.now() - this.lastSnapAt) / Math.max(20, this.snapInterval)));
    for (const p of s.players) {
      if (p.id === this.me && p.alive && s.phase === 'playing') continue;
      const a = this.prevPos.get(p.id);
      const b = this.curPos.get(p.id);
      if (!a || !b) continue;
      if (Math.abs(a.x - b.x) > 1.5 || Math.abs(a.y - b.y) > 1.5) {
        p.x = b.x;
        p.y = b.y;
      } else {
        p.x = a.x + (b.x - a.x) * k;
        p.y = a.y + (b.y - a.y) * k;
      }
    }
    if (performance.now() - this.lastSnapAt > 3000 && s.phase !== 'ended') this.status = 'Conexión inestable... reconectando';
    const out = this.events;
    this.events = [];
    return out;
  }

  onEnd(result: MatchResult, rewards: MatchRewards | null) {
    this.ended = { result, rewards };
    for (const w of this.endWaiters) w(rewards);
    this.endWaiters = [];
  }

  waitRewards(): Promise<MatchRewards | null> {
    if (this.ended) return Promise.resolve(this.ended.rewards);
    return new Promise((res) => this.endWaiters.push(res));
  }

  dispose() {
    /* la conexión la maneja NetClient */
  }
}

export class NetClient {
  ws: WebSocket | null = null;
  status: 'offline' | 'connecting' | 'online' = 'offline';
  user: { id: number; username: string } | null = null;
  online = 0;
  rooms: RoomListItem[] = [];
  room: RoomInfo | null = null;
  you = 0;
  chat: ChatLine[] = [];
  error = '';
  session: OnlineSession | null = null;
  onStart: ((s: OnlineSession) => void) | null = null;
  private listeners = new Set<Listener>();
  private retry = 0;
  private want = false;
  private pingTimer: number | null = null;
  private chatId = 1;

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  private emit() {
    for (const l of this.listeners) l();
  }

  connect() {
    this.want = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.status = 'connecting';
    this.emit();
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      this.status = 'offline';
      this.emit();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.send({ t: 'hello', token: getToken(), name: profiles.profile.name, v: PROTOCOL_VERSION });
    };
    ws.onmessage = (e) => {
      let msg: ServerMsg;
      try {
        msg = JSON.parse(String(e.data));
      } catch {
        return;
      }
      this.handle(msg);
    };
    ws.onclose = () => {
      this.status = 'offline';
      this.ws = null;
      if (this.session) this.session.status = 'Se perdió la conexión... reconectando';
      this.emit();
      if (this.want) {
        const delay = Math.min(10000, 800 * 2 ** this.retry++);
        setTimeout(() => this.want && this.connect(), delay);
      }
    };
    if (this.pingTimer === null) {
      this.pingTimer = window.setInterval(() => {
        if (this.status === 'online') this.send({ t: 'ping', ts: performance.now() });
      }, 2000);
    }
  }

  disconnect() {
    this.want = false;
    this.ws?.close();
    this.ws = null;
    this.status = 'offline';
    this.room = null;
    this.emit();
  }

  send(msg: ClientMsg) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  private handle(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        this.status = 'online';
        this.user = msg.user;
        this.online = msg.online;
        this.send({ t: 'lobby' });
        break;
      case 'rooms':
        this.rooms = msg.rooms;
        break;
      case 'room':
        this.room = msg.room;
        this.you = msg.you;
        if (!msg.room) this.chat = [];
        break;
      case 'chat':
        this.chat.push({ id: this.chatId++, from: msg.from, text: msg.text, sys: msg.sys });
        if (this.chat.length > 60) this.chat.shift();
        break;
      case 'start': {
        const s = new OnlineSession(this, msg.config, msg.you, msg.init);
        this.session = s;
        this.onStart?.(s);
        break;
      }
      case 's':
        this.session?.onSnapshot(msg.s, msg.ev);
        return; // sin re-render de la UI por cada snapshot
      case 'end':
        if (msg.profile) profiles.setRemoteProfile(msg.profile);
        this.session?.onEnd(msg.result, msg.rewards);
        break;
      case 'error':
        this.error = msg.msg;
        setTimeout(() => {
          if (this.error === msg.msg) {
            this.error = '';
            this.emit();
          }
        }, 4000);
        break;
      case 'pong':
        if (this.session) this.session.ping = Math.round(performance.now() - msg.ts);
        return;
    }
    this.emit();
  }

  // atajos
  refreshRooms() {
    this.send({ t: 'lobby' });
  }
  quick(mode: ModeId) {
    this.send({ t: 'quick', mode });
  }
  create(settings: Partial<RoomSettings>) {
    this.send({ t: 'create', settings });
  }
  join(code: string) {
    this.send({ t: 'join', code: code.trim().toUpperCase() });
  }
  leave() {
    this.send({ t: 'leave' });
    this.room = null;
    this.session = null;
    this.emit();
  }
  pick(cls: ClassId, skin: string, fx: string) {
    this.send({ t: 'pick', cls, skin, fx });
  }
  team(team: number) {
    this.send({ t: 'team', team });
  }
  ready(ready: boolean) {
    this.send({ t: 'ready', ready });
  }
  setSettings(settings: Partial<RoomSettings>) {
    this.send({ t: 'settings', settings });
  }
  start() {
    this.send({ t: 'start' });
  }
  say(text: string) {
    this.send({ t: 'chat', text });
  }
}

export const net = new NetClient();
