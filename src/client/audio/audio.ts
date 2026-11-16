// Audio procedural: efectos de sonido sintetizados y música chiptune con WebAudio.

export type Sfx =
  | 'hover'
  | 'click'
  | 'back'
  | 'buy'
  | 'error'
  | 'bomb'
  | 'explode'
  | 'hit'
  | 'hurt'
  | 'kill'
  | 'death'
  | 'shoot_distancia'
  | 'shoot_support'
  | 'shoot_controlador'
  | 'melee_tanque'
  | 'melee_veloz'
  | 'melee_defensor'
  | 'hyper'
  | 'hyperReady'
  | 'flagTake'
  | 'flagCap'
  | 'flagReturn'
  | 'flagDrop'
  | 'power'
  | 'break'
  | 'count'
  | 'go'
  | 'win'
  | 'lose'
  | 'levelup'
  | 'door'
  | 'lava'
  | 'hurry'
  | 'spawn'
  | 'dash'
  | 'kick'
  | 'grab'
  | 'throw'
  | 'storm'
  | 'emote'
  | 'heal'
  | 'coin'
  | 'zone';

type Wave = OscillatorType;

const NOTE: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

export function noteFreq(n: string): number {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  if (!m) return 0;
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function transpose(n: string, semis: number): string {
  const m = /^([A-G]#?)(-?\d)$/.exec(n);
  if (!m) return n;
  const names = Object.keys(NOTE);
  let idx = NOTE[m[1]] + semis;
  let oct = Number(m[2]);
  while (idx < 0) {
    idx += 12;
    oct--;
  }
  while (idx >= 12) {
    idx -= 12;
    oct++;
  }
  return names[idx] + oct;
}

interface Song {
  bpm: number;
  lead: string; // "E5:2 G5:2 -:4 ..." en semicorcheas
  bass: string;
  drums: string; // por semicorchea: k kick, s snare, h hihat, . nada
  leadWave: Wave;
  bassWave: Wave;
  transpose?: number;
  leadVol?: number;
}

const MENU_LEAD =
  'E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 A5:4 ' +
  'G5:2 B5:2 D6:4 B5:2 G5:2 A5:2 B5:2 ' +
  'C6:3 B5:1 A5:2 E5:2 A5:4 G5:4 ' +
  'F5:2 A5:2 C6:2 A5:2 G5:4 -:4 ' +
  'E5:2 G5:2 C6:2 G5:2 E5:2 G5:2 A5:4 ' +
  'G5:2 B5:2 D6:4 B5:2 G5:2 A5:2 B5:2 ' +
  'C6:2 D6:2 E6:4 D6:2 C6:2 B5:4 ' +
  'A5:2 C6:2 B5:2 G5:2 C6:8';
const MENU_BASS =
  'C3:2 C4:2 C3:2 C4:2 C3:2 C4:2 C3:2 C4:2 ' +
  'G2:2 G3:2 G2:2 G3:2 G2:2 G3:2 G2:2 G3:2 ' +
  'A2:2 A3:2 A2:2 A3:2 A2:2 A3:2 A2:2 A3:2 ' +
  'F2:2 F3:2 F2:2 F3:2 G2:2 G3:2 G2:2 G3:2';

const BATTLE_LEAD =
  'A4:2 C5:2 E5:2 A5:2 G5:2 E5:2 C5:2 E5:2 ' +
  'F5:4 E5:2 D5:2 C5:4 A4:4 ' +
  'B4:2 D5:2 G5:2 B5:2 A5:2 G5:2 D5:2 B4:2 ' +
  'E5:4 G#5:4 B5:4 E6:4 ' +
  'A5:2 -:2 A5:2 G5:2 E5:2 -:2 C5:2 D5:2 ' +
  'F5:2 -:2 F5:2 E5:2 D5:2 C5:2 A4:4 ' +
  'G4:2 B4:2 D5:2 G5:2 F5:2 D5:2 B4:2 G4:2 ' +
  'E5:2 D5:2 C5:2 B4:2 G#4:4 E4:4';
const BATTLE_BASS =
  'A2:2 A2:2 A3:2 A2:2 A2:2 A3:2 A2:2 A3:2 ' +
  'F2:2 F2:2 F3:2 F2:2 F2:2 F3:2 F2:2 F3:2 ' +
  'G2:2 G2:2 G3:2 G2:2 G2:2 G3:2 G2:2 G3:2 ' +
  'E2:2 E2:2 E3:2 E2:2 E2:2 E3:2 E2:2 E3:2';

const SONGS: Record<string, Song> = {
  menu: { bpm: 126, lead: MENU_LEAD, bass: MENU_BASS, drums: 'k.h.s.h.k.h.s.hh', leadWave: 'square', bassWave: 'triangle', leadVol: 0.09 },
  ruinas: { bpm: 148, lead: BATTLE_LEAD, bass: BATTLE_BASS, drums: 'k.hks.h.k.hks.hh', leadWave: 'square', bassWave: 'triangle' },
  laberinto: { bpm: 138, lead: BATTLE_LEAD, bass: BATTLE_BASS, drums: 'k.h.s.hkk.h.s.h.', leadWave: 'triangle', bassWave: 'square', transpose: 5, leadVol: 0.14 },
  fabrica: { bpm: 162, lead: BATTLE_LEAD, bass: BATTLE_BASS, drums: 'khhhskhhkhhhskhs', leadWave: 'square', bassWave: 'sawtooth', transpose: 7 },
  volcan: { bpm: 154, lead: BATTLE_LEAD, bass: BATTLE_BASS, drums: 'k.hks.hkk.hks.hs', leadWave: 'sawtooth', bassWave: 'square', transpose: 3, leadVol: 0.06 },
  tutorial: { bpm: 118, lead: MENU_LEAD, bass: MENU_BASS, drums: 'k...s...k...s...', leadWave: 'triangle', bassWave: 'triangle', transpose: -5, leadVol: 0.13 },
  hurry: { bpm: 190, lead: BATTLE_LEAD, bass: BATTLE_BASS, drums: 'khkhskhkkhkhskhs', leadWave: 'square', bassWave: 'square', transpose: 1 },
};

function parseSeq(s: string, tr: number): { f: number; len: number }[] {
  return s
    .trim()
    .split(/\s+/)
    .map((tok) => {
      const [n, l] = tok.split(':');
      return { f: n === '-' ? 0 : noteFreq(transpose(n, tr)), len: Number(l) || 1 };
    });
}

const MP3_TRACKS: Record<string, string> = {
  menu: '/assets/nueva-version/audio/menu.mp3',
  ruinas: '/assets/nueva-version/audio/ruinas.mp3',
  laberinto: '/assets/nueva-version/audio/laberinto.mp3',
  fabrica: '/assets/nueva-version/audio/fabrica.mp3',
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noiseBuf!: AudioBuffer;
  private vol = { master: 0.8, music: 0.5, sfx: 0.8 };
  private song: string | null = null;
  private songData: { lead: { f: number; len: number }[]; bass: { f: number; len: number }[]; song: Song } | null = null;
  private timer: number | null = null;
  private mp3: HTMLAudioElement | null = null;
  private step16 = 0;
  private nextTime = 0;
  private leadIdx = 0;
  private leadLeft = 0;
  private bassIdx = 0;
  private bassLeft = 0;
  private lastPlay = new Map<string, number>();

  /** Hay que llamarlo desde un gesto del usuario (click/tecla). */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.sfxBus = this.ctx.createGain();
    this.musicBus = this.ctx.createGain();
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.master.connect(comp);
    comp.connect(this.ctx.destination);
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.song) {
      const s = this.song;
      this.song = null;
      this.playMusic(s);
    }
  }

  setVolumes(master: number, music: number, sfx: number) {
    this.vol = { master, music, sfx };
    this.applyVolumes();
  }

  private applyVolumes() {
    if (this.mp3) this.mp3.volume = Math.max(0, Math.min(1, this.vol.master * this.vol.music));
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.musicBus.gain.value = this.vol.music;
    this.sfxBus.gain.value = this.vol.sfx;
  }

  // -------------------------------------------------------------------------
  // Primitivas
  // -------------------------------------------------------------------------

  private tone(opts: { wave: Wave; f0: number; f1?: number; t?: number; dur: number; vol: number; attack?: number; bus?: GainNode; pan?: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = opts.t ?? ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.wave;
    o.frequency.setValueAtTime(Math.max(20, opts.f0), t0);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.f1), t0 + opts.dur);
    const a = opts.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(opts.vol, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    o.connect(g);
    let out: AudioNode = g;
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      out = p;
    }
    out.connect(opts.bus ?? this.sfxBus);
    o.start(t0);
    o.stop(t0 + opts.dur + 0.02);
  }

  private noise(opts: { dur: number; vol: number; type?: BiquadFilterType; f0?: number; f1?: number; q?: number; t?: number; bus?: GainNode; pan?: number }) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = opts.t ?? ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.f0 ?? 2000, t0);
    if (opts.f1) f.frequency.exponentialRampToValueAtTime(opts.f1, t0 + opts.dur);
    f.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f);
    f.connect(g);
    let out: AudioNode = g;
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      out = p;
    }
    out.connect(opts.bus ?? this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + opts.dur + 0.02);
  }

  private arp(notes: string[], step: number, wave: Wave, vol: number, dur = step * 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    notes.forEach((n, i) => this.tone({ wave, f0: noteFreq(n), t: t + i * step, dur, vol }));
  }

  // -------------------------------------------------------------------------
  // Efectos
  // -------------------------------------------------------------------------

  play(name: Sfx, opts: { pan?: number; vol?: number } = {}) {
    if (!this.ctx) return;
    // evita saturar con el mismo sonido en el mismo instante
    const now = this.ctx.currentTime;
    const last = this.lastPlay.get(name) ?? -1;
    if (now - last < 0.03) return;
    this.lastPlay.set(name, now);
    const v = opts.vol ?? 1;
    const pan = opts.pan;
    switch (name) {
      case 'hover':
        this.tone({ wave: 'sine', f0: 1200, f1: 1500, dur: 0.04, vol: 0.05 * v });
        break;
      case 'click':
        this.tone({ wave: 'square', f0: 520, f1: 880, dur: 0.07, vol: 0.07 * v });
        break;
      case 'back':
        this.tone({ wave: 'square', f0: 700, f1: 330, dur: 0.09, vol: 0.06 * v });
        break;
      case 'buy':
      case 'coin':
        this.arp(['B5', 'E6', 'G#6'], 0.06, 'square', 0.06 * v);
        break;
      case 'error':
        this.tone({ wave: 'square', f0: 180, f1: 140, dur: 0.18, vol: 0.08 * v });
        break;
      case 'bomb':
        this.tone({ wave: 'sine', f0: 180, f1: 60, dur: 0.12, vol: 0.28 * v, pan });
        this.noise({ dur: 0.05, vol: 0.12 * v, f0: 3000, pan });
        break;
      case 'explode':
        this.noise({ dur: 0.7, vol: 0.55 * v, f0: 3200, f1: 120, pan });
        this.tone({ wave: 'sine', f0: 110, f1: 32, dur: 0.55, vol: 0.5 * v, pan });
        this.tone({ wave: 'square', f0: 70, f1: 30, dur: 0.25, vol: 0.12 * v, pan });
        break;
      case 'break':
        this.noise({ dur: 0.18, vol: 0.25 * v, type: 'bandpass', f0: 900, f1: 300, q: 2, pan });
        break;
      case 'hit':
        this.noise({ dur: 0.06, vol: 0.18 * v, type: 'bandpass', f0: 2400, q: 1.5, pan });
        this.tone({ wave: 'square', f0: 300, f1: 180, dur: 0.06, vol: 0.06 * v, pan });
        break;
      case 'hurt':
        this.tone({ wave: 'square', f0: 420, f1: 160, dur: 0.14, vol: 0.12 * v });
        break;
      case 'kill':
        this.noise({ dur: 0.35, vol: 0.2 * v, f0: 1500, f1: 200, pan });
        this.arp(['E5', 'C5', 'A4'], 0.05, 'square', 0.06 * v);
        break;
      case 'death':
        this.arp(['G4', 'E4', 'C4', 'G3'], 0.08, 'square', 0.08 * v, 0.14);
        break;
      case 'shoot_distancia':
        this.tone({ wave: 'square', f0: 1400, f1: 260, dur: 0.14, vol: 0.09 * v, pan });
        this.noise({ dur: 0.06, vol: 0.06 * v, type: 'highpass', f0: 3000, pan });
        break;
      case 'shoot_support':
        this.tone({ wave: 'triangle', f0: 700, f1: 1300, dur: 0.1, vol: 0.12 * v, pan });
        break;
      case 'shoot_controlador':
        this.tone({ wave: 'sine', f0: 500, f1: 900, dur: 0.12, vol: 0.12 * v, pan });
        this.tone({ wave: 'sine', f0: 505, f1: 880, dur: 0.12, vol: 0.08 * v, pan });
        break;
      case 'melee_tanque':
        this.noise({ dur: 0.12, vol: 0.3 * v, f0: 600, f1: 100, pan });
        this.tone({ wave: 'sine', f0: 140, f1: 50, dur: 0.12, vol: 0.25 * v, pan });
        break;
      case 'melee_veloz':
        this.tone({ wave: 'sawtooth', f0: 1800, f1: 600, dur: 0.07, vol: 0.06 * v, pan });
        this.noise({ dur: 0.05, vol: 0.08 * v, type: 'highpass', f0: 4000, pan });
        break;
      case 'melee_defensor':
        this.noise({ dur: 0.2, vol: 0.18 * v, type: 'bandpass', f0: 400, f1: 2400, q: 3, pan });
        break;
      case 'hyper':
        this.tone({ wave: 'sawtooth', f0: 200, f1: 1600, dur: 0.35, vol: 0.08 * v });
        this.arp(['C5', 'E5', 'G5', 'C6'], 0.05, 'square', 0.07 * v, 0.2);
        break;
      case 'hyperReady':
        this.arp(['C6', 'E6', 'G6', 'C7'], 0.045, 'triangle', 0.08 * v, 0.12);
        break;
      case 'flagTake':
        this.arp(['A5', 'E5', 'A5', 'E5'], 0.09, 'square', 0.08 * v, 0.1);
        break;
      case 'flagCap':
        this.arp(['C5', 'E5', 'G5', 'C6', 'E6', 'G6'], 0.07, 'square', 0.1 * v, 0.2);
        this.arp(['C4', 'G4', 'C5'], 0.14, 'triangle', 0.12 * v, 0.3);
        break;
      case 'flagReturn':
        this.arp(['G5', 'D5', 'G4'], 0.08, 'triangle', 0.12 * v);
        break;
      case 'flagDrop':
        this.tone({ wave: 'triangle', f0: 300, f1: 120, dur: 0.2, vol: 0.15 * v });
        break;
      case 'power':
        this.arp(['C5', 'G5', 'C6', 'E6'], 0.04, 'square', 0.07 * v, 0.08);
        break;
      case 'heal':
        this.tone({ wave: 'sine', f0: 880, f1: 1320, dur: 0.12, vol: 0.05 * v });
        break;
      case 'count':
        this.tone({ wave: 'square', f0: 440, dur: 0.15, vol: 0.1 * v });
        break;
      case 'go':
        this.tone({ wave: 'square', f0: 880, dur: 0.4, vol: 0.12 * v });
        this.tone({ wave: 'square', f0: 1320, dur: 0.4, vol: 0.06 * v });
        break;
      case 'win':
        this.arp(['C5', 'E5', 'G5', 'C6', 'G5', 'C6', 'E6'], 0.11, 'square', 0.1 * v, 0.25);
        this.arp(['C3', 'G3', 'C4', 'E4'], 0.2, 'triangle', 0.15 * v, 0.4);
        break;
      case 'lose':
        this.arp(['G4', 'F#4', 'F4', 'E4'], 0.22, 'triangle', 0.14 * v, 0.4);
        break;
      case 'levelup':
        this.arp(['G5', 'C6', 'E6', 'G6', 'C7'], 0.07, 'square', 0.09 * v, 0.2);
        break;
      case 'door':
        this.noise({ dur: 0.25, vol: 0.06 * v, type: 'highpass', f0: 1500, pan });
        break;
      case 'lava':
        this.noise({ dur: 0.8, vol: 0.2 * v, f0: 300, f1: 60 });
        break;
      case 'hurry':
        this.arp(['A5', 'E5', 'A5', 'E5', 'A5', 'E5'], 0.12, 'square', 0.08 * v, 0.12);
        break;
      case 'spawn':
        this.tone({ wave: 'sine', f0: 400, f1: 1200, dur: 0.2, vol: 0.06 * v, pan });
        break;
      case 'dash':
        this.noise({ dur: 0.25, vol: 0.18 * v, type: 'bandpass', f0: 600, f1: 3000, q: 2 });
        break;
      case 'kick':
        this.tone({ wave: 'triangle', f0: 190, f1: 390, dur: 0.08, vol: 0.18 * v, pan });
        break;
      case 'grab':
        this.tone({ wave: 'square', f0: 320, f1: 620, dur: 0.07, vol: 0.12 * v, pan });
        break;
      case 'throw':
        this.tone({ wave: 'sawtooth', f0: 540, f1: 220, dur: 0.12, vol: 0.14 * v, pan });
        break;
      case 'storm':
        this.arp(['E4', 'B4', 'E5', 'G5'], 0.08, 'sawtooth', 0.1 * v, 0.16);
        break;
      case 'emote':
        this.tone({ wave: 'sine', f0: 900, f1: 1400, dur: 0.08, vol: 0.06 * v });
        break;
      case 'zone':
        this.arp(['E5', 'B5'], 0.08, 'triangle', 0.08 * v);
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Música
  // -------------------------------------------------------------------------

  private stopMp3() {
    if (this.mp3) {
      this.mp3.pause();
      this.mp3.src = '';
      this.mp3 = null;
    }
  }

  private startChiptune(name: string) {
    if (!this.ctx) return;
    const song = SONGS[name] ?? SONGS.menu;
    const tr = song.transpose ?? 0;
    this.songData = { lead: parseSeq(song.lead, tr), bass: parseSeq(song.bass, tr), song };
    this.step16 = 0;
    this.leadIdx = this.bassIdx = 0;
    this.leadLeft = this.bassLeft = 0;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.schedule(), 25);
  }

  playMusic(name: string | null) {
    if (name === this.song) return;
    this.song = name;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.stopMp3();
    if (!name) return;
    const url = MP3_TRACKS[name];
    if (url && typeof Audio !== 'undefined') {
      const el = new Audio(url);
      el.loop = true;
      el.volume = Math.max(0, Math.min(1, this.vol.master * this.vol.music));
      this.mp3 = el;
      void el.play().catch(() => {
        if (this.song === name) {
          this.stopMp3();
          this.startChiptune(name);
        }
      });
      return;
    }
    this.startChiptune(name);
  }

  get currentSong() {
    return this.song;
  }

  private schedule() {
    const ctx = this.ctx;
    const d = this.songData;
    if (!ctx || !d) return;
    const stepDur = 60 / d.song.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.12) {
      const t = this.nextTime;
      // melodía
      if (this.leadLeft <= 0) {
        const n = d.lead[this.leadIdx % d.lead.length];
        this.leadIdx++;
        this.leadLeft = n.len;
        if (n.f) {
          this.tone({ wave: d.song.leadWave, f0: n.f, t, dur: stepDur * n.len * 0.92, vol: d.song.leadVol ?? 0.08, attack: 0.01, bus: this.musicBus });
        }
      }
      this.leadLeft--;
      // bajo
      if (this.bassLeft <= 0) {
        const n = d.bass[this.bassIdx % d.bass.length];
        this.bassIdx++;
        this.bassLeft = n.len;
        if (n.f) this.tone({ wave: d.song.bassWave, f0: n.f, t, dur: stepDur * n.len * 0.85, vol: d.song.bassWave === 'triangle' ? 0.16 : 0.05, bus: this.musicBus });
      }
      this.bassLeft--;
      // batería
      const dr = d.song.drums[this.step16 % d.song.drums.length];
      if (dr === 'k') this.tone({ wave: 'sine', f0: 150, f1: 40, t, dur: 0.12, vol: 0.28, bus: this.musicBus });
      else if (dr === 's') this.noise({ t, dur: 0.1, vol: 0.12, type: 'bandpass', f0: 1800, q: 0.8, bus: this.musicBus });
      else if (dr === 'h') this.noise({ t, dur: 0.03, vol: 0.05, type: 'highpass', f0: 7000, bus: this.musicBus });
      this.step16++;
      this.nextTime += stepDur;
    }
  }
}

export const audio = new AudioEngine();
