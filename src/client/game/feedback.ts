// Traduce los eventos del juego en sonidos, anuncios y el registro de eliminaciones.
import { CLASSES, MODES, TEAM_NAMES } from '../../shared/balance';
import { TUTORIAL_STEPS } from '../../shared/sim';
import type { ClassId, GameEvent, MatchState } from '../../shared/types';
import { audio } from '../audio/audio';

export interface Announcement {
  id: number;
  text: string;
  sub?: string;
  color: string;
  big: boolean;
  t: number;
  life: number;
  cls?: ClassId;
}

export interface FeedEntry {
  id: number;
  killer: string;
  killerColor: string;
  killerCls?: ClassId;
  victim: string;
  victimId: number;
  victimColor: string;
  how: string;
  t: number;
}

export interface PlayerReaction {
  hurtT: number;
  lastDmg: number;
  healT: number;
  lastHeal: number;
  skillT: number;
  skillName: string;
  superT: number;
  superName: string;
}

export interface GachaCutin {
  id: number;
  pid: number;
  name: string;
  cls: ClassId;
  skin: string;
  team: number;
  ally: boolean;
  color: string;
  kind: 'super' | 'heal' | 'skill';
  powerName: string;
  t: number;
  life: number;
}

let nextId = 1;

export class Feedback {
  announcements: Announcement[] = [];
  feed: FeedEntry[] = [];
  reactions = new Map<number, PlayerReaction>();
  gachaCutins: GachaCutin[] = [];
  version = 0;

  private ensureReaction(pid: number): PlayerReaction {
    let r = this.reactions.get(pid);
    if (!r) {
      r = { hurtT: 0, lastDmg: 0, healT: 0, lastHeal: 0, skillT: 0, skillName: '', superT: 0, superName: '' };
      this.reactions.set(pid, r);
    }
    return r;
  }

  reactionOf(pid: number): PlayerReaction | undefined {
    return this.reactions.get(pid);
  }

  pushGachaCutin(item: Omit<GachaCutin, 'id' | 't'>) {
    const existing = this.gachaCutins.find((c) => c.pid === item.pid && c.kind === item.kind);
    if (existing) {
      existing.powerName = item.powerName;
      existing.t = 0;
      existing.life = item.life;
      this.version++;
      return;
    }
    this.gachaCutins.push({ ...item, id: nextId++, t: 0 });
    // Máximo 1 cut-in simultáneo por lateral (aliados a la izq., rivales a la der.) para no saturar la arena
    let sideCount = 0;
    for (const c of this.gachaCutins) if (c.ally === item.ally) sideCount++;
    if (sideCount > 1) {
      const idx = this.gachaCutins.findIndex((c) => c.ally === item.ally);
      if (idx >= 0) this.gachaCutins.splice(idx, 1);
    }
    this.version++;
  }

  announce(text: string, color = '#ffffff', big = false, sub?: string, life = 2.0, cls?: ClassId) {
    // reemplaza anuncios del mismo tipo para evitar apilamiento en pantalla
    this.announcements = this.announcements.filter((a) => a.big !== big);
    this.announcements.push({ id: nextId++, text, sub, color, big, t: 0, life, cls });
    if (this.announcements.length > 2) this.announcements.shift();
    this.version++;
  }

  tick(dt: number) {
    let changed = false;
    for (const a of this.announcements) a.t += dt;
    const before = this.announcements.length;
    this.announcements = this.announcements.filter((a) => a.t < a.life);
    if (before !== this.announcements.length) changed = true;
    for (const f of this.feed) f.t += dt;
    const fb = this.feed.length;
    this.feed = this.feed.filter((f) => f.t < 3.2);
    if (fb !== this.feed.length) changed = true;
    for (const c of this.gachaCutins) c.t += dt;
    const cbBefore = this.gachaCutins.length;
    this.gachaCutins = this.gachaCutins.filter((c) => c.t < c.life);
    if (cbBefore !== this.gachaCutins.length) changed = true;
    for (const r of this.reactions.values()) {
      if (r.hurtT > 0) {
        r.hurtT = Math.max(0, r.hurtT - dt);
        if (r.hurtT === 0) {
          r.lastDmg = 0;
          changed = true;
        }
      }
      if (r.healT > 0) {
        r.healT = Math.max(0, r.healT - dt);
        if (r.healT === 0) {
          r.lastHeal = 0;
          changed = true;
        }
      }
      if (r.skillT > 0) {
        r.skillT = Math.max(0, r.skillT - dt);
        if (r.skillT === 0) changed = true;
      }
      if (r.superT > 0) {
        r.superT = Math.max(0, r.superT - dt);
        if (r.superT === 0) changed = true;
      }
    }
    if (changed) this.version++;
  }

  handle(events: GameEvent[], s: MatchState, localIds: number[], teamColor: (t: number) => string) {
    const pl = (id: number) => s.players.find((p) => p.id === id);
    const locals = s.players.filter((p) => localIds.includes(p.id));
    const myTeam = locals[0]?.team ?? -1;
    const allyOf = (team: number) =>
      myTeam >= 0 ? team === myTeam : localIds.includes(s.players.find((p) => p.team === team)?.id ?? -1);
    const pan = (x: number) => (x / s.w) * 2 - 1;
    const teamName = (t: number) => (MODES[s.config.mode].teams ? TEAM_NAMES[t] : (s.players.find((p) => p.team === t)?.name ?? `Jugador ${t + 1}`));
    for (const e of events) {
      switch (e.t) {
        case 'count':
          audio.play('count');
          this.announce(String(e.n), '#ffffff', true, undefined, 0.9);
          break;
        case 'go':
          audio.play('go');
          this.announce('¡YA!', '#ffd23f', true, undefined, 0.9);
          break;
        case 'bomb':
          audio.play('bomb', { pan: pan(e.x), vol: 0.8 });
          break;
        case 'explode':
          audio.play('explode', { pan: pan(e.x) });
          break;
        case 'break':
          audio.play('break', { pan: pan(e.x), vol: 0.7 });
          break;
        case 'hit': {
          const r = this.ensureReaction(e.p);
          r.hurtT = 0.85;
          r.lastDmg = e.a;
          this.version++;
          if (localIds.includes(e.p)) audio.play('hurt');
          else audio.play('hit', { vol: localIds.includes(e.src) ? 1 : 0.5 });
          break;
        }
        case 'heal': {
          const r = this.ensureReaction(e.p);
          const keepBigHeal = r.healT > 0.25 && e.a < r.lastHeal;
          r.healT = 1.25;
          if (e.a > 0 && !keepBigHeal) r.lastHeal = e.a;
          const healer = e.src >= 0 ? pl(e.src) : undefined;
          if (healer && healer.id !== e.p) {
            const rh = this.ensureReaction(healer.id);
            rh.healT = Math.max(rh.healT, 1.1);
            rh.skillT = Math.max(rh.skillT, 1.1);
            rh.skillName = CLASSES[healer.cls].attack.name;
          }
          const target = pl(e.p);
          const cutSource = healer ?? target;
          if (e.a >= 15 && cutSource) {
            this.pushGachaCutin({
              pid: cutSource.id,
              name: cutSource.name,
              cls: cutSource.cls,
              skin: cutSource.skin,
              team: cutSource.team,
              ally: allyOf(cutSource.team),
              color: teamColor(cutSource.team),
              kind: 'heal',
              powerName: healer && healer.id !== e.p ? `${CLASSES[healer.cls].attack.name} (+${e.a} PV)` : `CURACIÓN (+${e.a} PV)`,
              life: 1.05,
            });
          }
          this.version++;
          if (localIds.includes(e.p) || localIds.includes(e.src)) audio.play('heal');
          break;
        }
        case 'attack': {
          const p = pl(e.p);
          if (p) {
            const r = this.ensureReaction(p.id);
            r.skillT = 0.75;
            r.skillName = CLASSES[p.cls].attack.name;
          }
          audio.play(`shoot_${e.cls}` as 'shoot_distancia', { pan: pan(e.x), vol: localIds.includes(e.p) ? 1 : 0.55 });
          break;
        }
        case 'melee': {
          const p = pl(e.p);
          if (p) {
            const r = this.ensureReaction(p.id);
            r.skillT = 0.75;
            r.skillName = CLASSES[p.cls].attack.name;
          }
          audio.play(`melee_${e.cls}` as 'melee_tanque', { pan: pan(e.x), vol: localIds.includes(e.p) ? 1 : 0.55 });
          break;
        }
        case 'kill': {
          const v = pl(e.p);
          const k = e.src >= 0 ? pl(e.src) : undefined;
          if (v) {
            const rv = this.ensureReaction(v.id);
            rv.hurtT = 0;
            rv.healT = 0;
            rv.skillT = 0;
            rv.superT = 0;
            this.feed.push({
              id: nextId++,
              killer: k ? k.name : e.how === 'crush' ? 'Muerte súbita' : e.how === 'storm' ? 'Tormenta' : e.how === 'lava' ? 'Lava' : v.name,
              killerColor: k ? teamColor(k.team) : e.how === 'storm' ? '#e066ff' : '#ffb13b',
              killerCls: k?.cls,
              victim: v.name,
              victimId: v.id,
              victimColor: teamColor(v.team),
              how: e.how,
              t: 0,
            });
            if (this.feed.length > 3) this.feed.shift();
            this.version++;
          }
          if (localIds.includes(e.p)) audio.play('death');
          else audio.play('kill', { vol: k && localIds.includes(k.id) ? 1 : 0.6 });
          if (k && localIds.includes(k.id) && v) this.announce(`Eliminaste a ${v.name}`, '#ffe94d', false, undefined, 1.25);
          break;
        }
        case 'hyper': {
          audio.play('hyper');
          const p = pl(e.p);
          if (p) {
            const r = this.ensureReaction(p.id);
            r.superT = 2.0;
            r.superName = CLASSES[e.cls].hyper.name;
            if (e.cls === 'support') r.healT = 2.0;
            this.pushGachaCutin({
              pid: p.id,
              name: p.name,
              cls: p.cls,
              skin: p.skin,
              team: p.team,
              ally: allyOf(p.team),
              color: teamColor(p.team),
              kind: 'super',
              powerName: CLASSES[e.cls].hyper.name,
              life: 1.2,
            });
          }
          break;
        }
        case 'hyperReady':
          if (localIds.includes(e.p)) {
            audio.play('hyperReady');
            this.announce('¡HIPERCARGA LISTA!', '#ffe94d', false, undefined, 1.2);
          }
          break;
        case 'flagTake': {
          audio.play('flagTake');
          const p = pl(e.p);
          if (myTeam < 0) this.announce(`¡${p?.name ?? '?'} robó la bandera ${e.team === 0 ? 'azul' : 'roja'}!`, teamColor(1 - e.team), true);
          else if (e.team === myTeam) this.announce('¡NOS ROBARON LA BANDERA!', '#ff5a5a', true, `${p?.name ?? ''} la tiene: ¡atrapalo!`);
          else this.announce('¡TENEMOS SU BANDERA!', teamColor(myTeam), true, `${p?.name ?? ''} vuelve a la base`);
          break;
        }
        case 'flagCap': {
          audio.play('flagCap');
          const p = pl(e.p);
          this.announce('¡CAPTURA!', teamColor(e.team), true, `${p?.name ?? ''} anotó para el ${TEAM_NAMES[e.team]}`, 2.6);
          break;
        }
        case 'flagReturn':
          audio.play('flagReturn');
          this.announce(`Bandera ${e.team === 0 ? 'azul' : 'roja'} recuperada`, teamColor(e.team), false, undefined, 1.6);
          break;
        case 'flagDrop':
          audio.play('flagDrop');
          this.announce(`¡Bandera ${e.team === 0 ? 'azul' : 'roja'} en el suelo!`, teamColor(e.team), false, undefined, 1.6);
          break;
        case 'power':
          if (e.kind === 'heal') {
            const r = this.ensureReaction(e.p);
            r.healT = 1.3;
            r.lastHeal = 50;
            this.version++;
          }
          if (localIds.includes(e.p)) audio.play('power');
          break;
        case 'spawn':
          if (localIds.includes(e.p)) audio.play('spawn');
          break;
        case 'roundStart':
          this.reactions.clear();
          this.gachaCutins = [];
          this.announce(`RONDA ${e.n}`, '#ffffff', true, undefined, 1.8);
          break;
        case 'roundEnd':
          if (e.w === -2) this.announce('RONDA EMPATADA', '#ffffff', true);
          else {
            if (myTeam >= 0) audio.play(e.w === myTeam ? 'flagCap' : 'flagDrop');
            this.announce(`¡Ronda para ${teamName(e.w)}!`, teamColor(e.w), true, undefined, 3);
          }
          break;
        case 'hurry':
          audio.play('hurry');
          this.announce('¡MUERTE SÚBITA!', '#ff3b3b', true, 'El mapa se está cerrando', 2.5);
          break;
        case 'zoneMove':
          audio.play('zone');
          this.announce('¡LA ZONA SE MOVIÓ!', '#ffd23f', false, undefined, 1.8);
          break;
        case 'zoneOwner':
          audio.play('zone');
          this.announce(`${teamName(e.team)} controla la zona`, teamColor(e.team), false, undefined, 1.5);
          break;
        case 'door':
          audio.play('door', { pan: pan(e.x), vol: 0.5 });
          break;
        case 'lava':
          if (e.on) {
            audio.play('lava');
            this.announce('¡ERUPCIÓN!', '#ff7a2a', false, undefined, 1.2);
          }
          break;
        case 'dash': {
          const p = pl(e.p);
          if (p) {
            const r = this.ensureReaction(p.id);
            r.skillT = 0.75;
            r.skillName = CLASSES[p.cls].attack.name;
          }
          audio.play('dash');
          break;
        }
        case 'kick':
          audio.play('kick', { pan: pan(e.x), vol: localIds.includes(e.p) ? 0.9 : 0.5 });
          break;
        case 'grab':
          audio.play('grab', { pan: pan(e.x), vol: localIds.includes(e.p) ? 0.9 : 0.5 });
          break;
        case 'throw':
          audio.play('throw', { pan: pan(e.x), vol: localIds.includes(e.p) ? 0.95 : 0.55 });
          break;
        case 'storm':
          audio.play('storm');
          this.announce('¡LA TORMENTA SE CIERRA!', '#e066ff', true, 'Entrá al círculo seguro', 2.4);
          break;
        case 'emote':
          audio.play('emote', { vol: 0.6 });
          break;
        case 'streak': {
          const p = pl(e.p);
          if (p) this.announce(`${p.name}: ${e.n >= 8 ? '¡IMPARABLE!' : e.n >= 5 ? '¡ARRASANDO!' : '¡RACHA DE 3!'}`, '#ffb13b', false, undefined, 1.35);
          break;
        }
        case 'tut': {
          const st = TUTORIAL_STEPS[e.step];
          if (st) {
            audio.play('levelup');
            this.announce(`¡Bien! ${st.title}`, '#3cff9a', false, undefined, 1.6);
          }
          break;
        }
        case 'end':
          if (myTeam < 0) break;
          if (e.w === -2) this.announce('EMPATE', '#ffffff', true, undefined, 4);
          else if (e.w === myTeam) {
            audio.play('win');
            this.announce('¡VICTORIA!', '#ffd23f', true, undefined, 4);
          } else {
            audio.play('lose');
            this.announce('DERROTA', '#ff5a5a', true, undefined, 4);
          }
          break;
      }
    }
  }
}
