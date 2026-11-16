// Pantalla de juego: canvas + HUD + pausa + resultados.
import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { CLASSES, DIVISIONS, MODES, TEAM_NAMES, divisionFor, levelFromXp } from '../../../shared/balance';
import { itemName } from '../../../shared/catalog';
import { ACHIEVEMENTS, type MatchRewards, type MatchSummary } from '../../../shared/profile';
import { TUTORIAL_STEPS, activeBombs, ranked, resultFor } from '../../../shared/sim';
import type { Dir, MatchState, PlayerState } from '../../../shared/types';
import { audio } from '../../audio/audio';
import type { FestivalLevel } from '../../data/festival';
import { Feedback, type PlayerReaction } from '../../game/feedback';
import { input } from '../../game/input';
import { LocalSession, type Session } from '../../game/session';
import { net, type OnlineSession } from '../../game/net';
import type { MatchSetup } from '../../game/setup';
import { buildConfig } from '../../game/setup';
import { ANIM_FRAMES, type Anim } from '../../gfx/characters';
import { bannerURL, onAssetsChange, portraitURL } from '../../gfx/sprites';
import { Renderer, teamColor, type RenderOpts } from '../../render/renderer';
import { profiles } from '../../services/profile';
import { keyLabel, settings } from '../../services/settings';
import { Btn, Coins, fmtTime, StarIcon, Toggle } from '../common';
import { useSettings, useTicker } from '../hooks';
import { nav } from '../nav';

export interface GameLaunch {
  session: Session;
  setup?: MatchSetup;
  festival?: FestivalLevel;
  tutorial?: boolean;
  /** resultado calculado por el servidor (online) */
  onlineRewards?: () => Promise<MatchRewards | null>;
  onExit?: () => void;
  online?: boolean;
}

const MUSIC_FOR: Record<string, string> = {
  ruinas: 'ruinas',
  ruinas_chico: 'ruinas',
  laberinto: 'laberinto',
  laberinto_chico: 'laberinto',
  fabrica: 'fabrica',
  fabrica_chico: 'fabrica',
  volcan: 'volcan',
  tutorial: 'tutorial',
};

export function GameScreen({ launch }: { launch: GameLaunch }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<Session>(launch.session);
  const feedback = useMemo(() => new Feedback(), [session]);
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [fps, setFps] = useState(0);
  const st = useSettings();
  const pausedRef = useRef(false);
  pausedRef.current = paused;
  // sesión activa: el loop de una sesión anterior se detiene solo al detectar el cambio
  const activeRef = useRef<Session>(launch.session);

  // loop principal
  useEffect(() => {
    const canvas = canvasRef.current!;
    const stage = stageRef.current!;
    const renderer = new Renderer(canvas);
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    let fpsT = 0;
    let endT = -1;
    let hurryMusic = false;
    const s0 = session.state;
    audio.playMusic(MUSIC_FOR[s0.config.map] ?? 'ruinas');
    input.reset();
    input.emotes = profiles.profile.equip.emotes;
    input.attach();
    input.onAction = (a) => {
      if (a === 'pause') {
        if (session.state.phase === 'ended') return;
        setPaused((p) => !p);
      }
    };
    let lastStageW = 0;
    let lastStageH = 0;
    const resize = () => {
      const r = stage.getBoundingClientRect();
      const w = Math.round(r.width);
      const h = Math.round(r.height);
      if (Math.abs(w - lastStageW) < 2 && Math.abs(h - lastStageH) < 2 && renderer.worldW === session.state.w * 32) return;
      lastStageW = w;
      lastStageH = h;
      renderer.resize(session.state, w - 16, h - 12);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(stage);
    resize();

    const loop = (now: number) => {
      if (activeRef.current !== session) return;
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      const s = session.state;
      if (session.kind === 'local') session.paused = pausedRef.current;
      const events = session.update(dt);
      const opts: RenderOpts = {
        shake: settings.get().reducedMotion ? 0 : settings.get().shake,
        damageNumbers: settings.get().damageNumbers,
        names: settings.get().names,
        colorblind: settings.get().colorblind,
        localIds: session.localIds,
        reducedMotion: settings.get().reducedMotion,
      };
      if (events.length) {
        renderer.handleEvents(events, s, opts);
        feedback.handle(events, s, session.localIds, (t) => teamColor(s, t, opts.colorblind));
        if (!hurryMusic && events.some((e) => e.t === 'hurry')) {
          hurryMusic = true;
          audio.playMusic('hurry');
        }
        if (events.some((e) => e.t === 'roundStart') && hurryMusic) {
          hurryMusic = false;
          audio.playMusic(MUSIC_FOR[s.config.map] ?? 'ruinas');
        }
      }
      if (renderer.worldW !== s.w * 32) resize();
      renderer.render(s, session.alpha, session.prev, pausedRef.current ? 0 : dt, opts);
      feedback.tick(dt);
      if (s.phase === 'ended') {
        if (endT < 0) endT = now;
        else if (now - endT > (launch.tutorial ? 2500 : 3800)) {
          setEnded(true);
        }
      }
      frames++;
      fpsT += dt;
      if (fpsT >= 0.5) {
        setFps(Math.round(frames / fpsT));
        frames = 0;
        fpsT = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      input.detach();
      input.onAction = null;
      session.dispose();
    };
  }, [session]);

  // la pausa también suelta las teclas
  useEffect(() => {
    input.enabled = !paused;
    if (paused) input.reset();
  }, [paused]);

  const quit = () => {
    audio.playMusic('menu');
    launch.onExit?.();
    session.dispose();
    nav.reset(launch.festival ? 'festival' : launch.online ? 'online' : 'menu');
  };

  const restart = () => {
    if (!launch.setup) return;
    const s = new LocalSession(buildConfig(launch.setup));
    activeRef.current = s;
    setEnded(false);
    setPaused(false);
    setSession(s);
  };

  const touchOn = st.touch === 'on' || (st.touch === 'auto' && matchMedia('(pointer: coarse)').matches);

  return (
    <div class="game-root">
      <Hud session={session} feedback={feedback} />
      <div class="game-stage" ref={stageRef}>
        <canvas ref={canvasRef} />
        <CountdownBanners session={session} />
        <GachaSideCutins session={session} feedback={feedback} />
        <Announcements session={session} feedback={feedback} />
        <KillFeed feedback={feedback} />
        <StatusMsgs session={session} feedback={feedback} tutorial={!!launch.tutorial} touch={touchOn} />
        {launch.tutorial && <TutorialBox session={session} />}
        <ScoresHold session={session} />
        {touchOn && !paused && !ended && <TouchControls session={session} />}
        <div class="pause-btn">
          <Btn variant="ghost" size="small" onClick={() => setPaused(true)} aria-label="Pausa">
            ❚❚
          </Btn>
        </div>
        {session.kind === 'online' && <PingBadge session={session} />}
        {st.showFps && (
          <div style={{ position: 'absolute', bottom: '6px', right: '10px', fontSize: '12px', opacity: 0.7, zIndex: 9 }}>{fps} FPS</div>
        )}
      </div>
      {paused && !ended && <PauseMenu session={session} onResume={() => setPaused(false)} onQuit={quit} onRestart={launch.setup ? restart : undefined} />}
      {ended && <Results launch={launch} session={session} onRematch={launch.setup ? restart : undefined} onQuit={quit} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// HUD superior
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HUD superior: Tu Equipo (izq.) vs Equipo Contrario (der.) + Señales Gacha
// ---------------------------------------------------------------------------

interface HudExpr {
  anim: Anim;
  frame: number;
  stateClass: 'is-ko' | 'is-hurt' | 'is-heal' | 'is-super' | 'is-skill' | 'is-moving' | 'is-idle';
  exprTag: { icon: string; label: string; tone: 'ko' | 'hurt' | 'heal' | 'super' | 'skill' } | null;
}

function resolveHudExpression(s: MatchState, p: PlayerState, react?: PlayerReaction): HudExpr {
  if (!p.alive) {
    return {
      anim: 'ko',
      frame: 4,
      stateClass: 'is-ko',
      exprTag: { icon: '💀', label: 'KO', tone: 'ko' },
    };
  }
  if (p.hurtT > 0.05 || (react && react.hurtT > 0)) {
    return {
      anim: 'hurt',
      frame: 0,
      stateClass: 'is-hurt',
      exprTag: { icon: '💥', label: react?.lastDmg ? `-${react.lastDmg}` : '¡DAÑO!', tone: 'hurt' },
    };
  }
  if (p.hyperT > 0 || p.castT > 0 || (react && react.superT > 0)) {
    return {
      anim: 'cast',
      frame: Math.floor(s.time * 8) % ANIM_FRAMES.cast,
      stateClass: 'is-super',
      exprTag: { icon: '⚡', label: CLASSES[p.cls].hyper.name, tone: 'super' },
    };
  }
  const inHealZone = s.zones.some(
    (z) => z.kind === 'heal' && z.team === p.team && Math.hypot(p.x - z.x, p.y - z.y) <= z.r && (p.hp < p.maxHp || z.owner === p.id),
  );
  if ((react && react.healT > 0) || inHealZone) {
    const label = react?.lastHeal ? `+${react.lastHeal}` : 'CURA';
    return {
      anim: 'win',
      frame: Math.floor(s.time * 6) % ANIM_FRAMES.win,
      stateClass: 'is-heal',
      exprTag: { icon: '💚', label, tone: 'heal' },
    };
  }
  if (p.atkT > 0 || (react && react.skillT > 0)) {
    return {
      anim: 'attack',
      frame: Math.floor(s.time * 10) % ANIM_FRAMES.attack,
      stateClass: 'is-skill',
      exprTag: { icon: '✦', label: CLASSES[p.cls].attack.name, tone: 'skill' },
    };
  }
  if (p.moving || p.dashT > 0) {
    return {
      anim: 'walk',
      frame: Math.floor(s.time * 8) % ANIM_FRAMES.walk,
      stateClass: 'is-moving',
      exprTag: null,
    };
  }
  return {
    anim: 'idle',
    frame: Math.floor(s.time * 3 + p.id) % ANIM_FRAMES.idle,
    stateClass: 'is-idle',
    exprTag: null,
  };
}

function Hud({ session, feedback }: { session: Session; feedback: Feedback }) {
  useTicker(100);
  const [, setVer] = useState(0);
  useEffect(() => onAssetsChange(() => setVer((v) => v + 1)), []);
  const s = session.state;
  const cb = settings.get().colorblind;
  const mode = MODES[s.config.mode];
  const locals = s.players.filter((p) => session.localIds.includes(p.id));
  const me = locals[0] ?? s.players[0];
  const myTeam = me?.team ?? 0;
  const p2 = locals[1];
  const allies = s.players.filter((p) => p.id !== me?.id && p.id !== p2?.id && p.team === myTeam);
  const enemies = s.players.filter((p) => p.id !== p2?.id && p.team !== myTeam);

  return (
    <div class="hud-top">
      <div class="hud-wing ally-wing" style={{ '--tc': teamColor(s, myTeam, cb) } as JSX.CSSProperties}>
        <div class="wing-header ally">
          <span class="wing-badge">★ {mode.teams || allies.length > 0 ? 'TU EQUIPO' : 'TU HÉROE'}</span>
        </div>
        <div class="wing-cards">
          {me ? <PlayerCard p={me} s={s} feedback={feedback} keysFor={locals.length > 1 ? 'p1' : 'solo'} /> : <div class="hud-card" style={{ visibility: 'hidden' }} />}
          {p2 && p2.team === myTeam && <PlayerCard p={p2} s={s} feedback={feedback} keysFor="p2" />}
          {allies.map((q) => (
            <GachaUnitBanner key={q.id} p={q} s={s} feedback={feedback} side="ally" cb={cb} />
          ))}
        </div>
      </div>

      <ScoreBoard s={s} cb={cb} />

      <div class="hud-wing enemy-wing" style={{ '--tc': teamColor(s, enemies[0]?.team ?? (myTeam === 0 ? 1 : 0), cb) } as JSX.CSSProperties}>
        <div class="wing-header enemy">
          <span class="wing-mode-info">
            {mode.name}
            {s.config.mode === 'ctf' && ` · a ${s.config.scoreLimit}`}
            {s.config.mode === 'zona' && ` · ${s.config.scoreLimit}p`}
            {(s.config.mode === 'eliminacion' || s.config.mode === 'clasica' || s.config.mode === 'duelo') && ` · R${s.round}/${s.config.scoreLimit}`}
            {s.storm?.on && <span class="storm-pill"> · 🌀 TORMENTA</span>}
          </span>
          <span class="wing-badge enemy">⚔ {mode.teams ? 'EQUIPO CONTRARIO' : 'RIVALES'}</span>
        </div>
        <div class="wing-cards enemy">
          {enemies.slice(0, 4).map((q) => (
            <GachaUnitBanner key={q.id} p={q} s={s} feedback={feedback} side="enemy" cb={cb} />
          ))}
          {p2 && p2.team !== myTeam && <PlayerCard p={p2} s={s} feedback={feedback} right keysFor="p2" />}
        </div>
      </div>
    </div>
  );
}

function GachaUnitBanner({ p, s, feedback, side, cb }: { p: PlayerState; s: MatchState; feedback: Feedback; side: 'ally' | 'enemy'; cb: boolean }) {
  const tc = teamColor(s, p.team, cb);
  const c = CLASSES[p.cls];
  const expr = resolveHudExpression(s, p, feedback.reactionOf(p.id));
  const hpPct = Math.max(0, (p.hp / p.maxHp) * 100);
  const hyperFull = p.hyper >= 100;
  return (
    <div
      class={`gacha-unit-card ${side} ${expr.stateClass}`}
      style={{ '--tc': tc } as JSX.CSSProperties}
      title={`${p.name} · ${c.hero} (${c.role})`}
    >
      <img class="gacha-unit-bg" src={bannerURL(p.cls, p.skin, 'hud')} alt="" />
      <div class="gacha-unit-body">
        <div class="gacha-port-wrap">
          <img class={`gacha-unit-port ${expr.stateClass}`} src={portraitURL(p.cls, p.skin, expr.anim, expr.frame, 2)} alt="" />
          {expr.exprTag && <span class={`gacha-expr-dot tone-${expr.exprTag.tone}`}>{expr.exprTag.icon}</span>}
        </div>
        <div class="gacha-unit-meta">
          <div class="gacha-unit-name" style={{ color: tc }}>
            <span>{p.name.slice(0, 10)}</span>
            {p.cls === 'support' && <span title="Healer"> 💚</span>}
            {p.shieldT > 0 && <span title="Escudo"> 🛡️</span>}
          </div>
          <div class="gacha-mini-hp">
            <i style={{ width: `${hpPct}%`, background: expr.stateClass === 'is-heal' ? '#5dff9a' : hpPct < 30 ? '#ff4d5e' : undefined }} />
          </div>
          <div class={`gacha-mini-hyper ${hyperFull ? 'full' : ''}`}>
            <i style={{ width: `${Math.min(100, p.hyper)}%` }} />
          </div>
        </div>
      </div>
      {expr.exprTag && (
        <div class={`gacha-signal tone-${expr.exprTag.tone}`}>
          <span>{expr.exprTag.icon}</span>
          <span>{expr.exprTag.label}</span>
        </div>
      )}
    </div>
  );
}

function PlayerCard({ p, s, feedback, right, keysFor }: { p: PlayerState; s: MatchState; feedback: Feedback; right?: boolean; keysFor: 'solo' | 'p1' | 'p2' }) {
  const c = CLASSES[p.cls];
  const tc = teamColor(s, p.team, settings.get().colorblind);
  const hyperFull = p.hyper >= 100;
  const km = keysFor === 'p2' ? settings.get().keys.p2 : settings.get().keys.p1;
  const expr = resolveHudExpression(s, p, feedback.reactionOf(p.id));
  return (
    <div class={`hud-card pixel-banner ${right ? 'right' : ''} ${expr.stateClass}`} style={{ '--tc': tc } as JSX.CSSProperties}>
      <img class="hud-banner-bg" src={bannerURL(p.cls, p.skin, 'hud')} alt="" />
      <div class="hud-port-wrap">
        <img class={`hud-portrait ${expr.stateClass}`} src={portraitURL(p.cls, p.skin, expr.anim, expr.frame, 2)} style={{ '--tc': tc } as JSX.CSSProperties} alt="" />
        {expr.exprTag && (
          <span class={`hud-port-badge tone-${expr.exprTag.tone}`} title={expr.exprTag.label}>
            {expr.exprTag.icon}
          </span>
        )}
      </div>
      <div class="info">
        <div class="pname" style={{ color: tc }}>
          {p.name} <span class="muted hud-hero-sub" style={{ fontSize: '12px' }}>· {c.hero}</span>
          {p.shieldT > 0 && <span class="shield-pill"> 🛡️</span>}
        </div>
        <div class="hp-bar">
          <i
            style={{
              width: `${Math.max(0, (p.hp / p.maxHp) * 100)}%`,
              background:
                expr.stateClass === 'is-heal'
                  ? 'linear-gradient(180deg,#b7ffd8,#28e07c)'
                  : p.hp / p.maxHp < 0.3
                    ? 'linear-gradient(180deg,#ff9a9a,#ff3b3b)'
                    : undefined,
            }}
          />
          <span>
            {Math.ceil(p.hp)} / {p.maxHp}
          </span>
        </div>
        <div class={`hyper-bar ${hyperFull ? 'full' : ''}`} title={c.hyper.name}>
          <i style={{ width: `${p.hyper}%` }} />
        </div>
        <div class="hud-mini">
          <span title="Bombas">💣 <b>{p.bombsMax - activeBombs(s, p.id)}/{p.bombsMax}</b></span>
          <span title="Alcance">🔥 <b>{p.range}</b></span>
          {p.speedUps > 0 && <span title="Velocidad">👟 <b>+{p.speedUps}</b></span>}
          {p.heldBomb > 0 && <span style={{ color: '#ffe94d' }}>⚡¡Lanzá!</span>}
          <span style={{ color: hyperFull ? '#ffe94d' : undefined }}>
            <span class="kbd">{keyLabel(km.hyper)}</span>
            {hyperFull ? '¡LISTA!' : `${Math.floor(p.hyper)}%`}
          </span>
        </div>
        {expr.exprTag && (
          <div class={`gacha-signal compact tone-${expr.exprTag.tone}`}>
            <span>{expr.exprTag.icon}</span>
            <span>{expr.exprTag.label}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function GachaSideCutins({ session, feedback }: { session: Session; feedback: Feedback }) {
  useTicker(80);
  if (session.state.phase === 'countdown' && session.state.config.mode !== 'tutorial') return null;
  const allies = feedback.gachaCutins.filter((c) => c.ally);
  const enemies = feedback.gachaCutins.filter((c) => !c.ally);
  if (!allies.length && !enemies.length) return null;

  const renderCard = (c: (typeof feedback.gachaCutins)[number], side: 'left' | 'right') => {
    const pose: Anim = c.kind === 'super' ? 'cast' : c.kind === 'heal' ? 'win' : 'attack';
    const frame = Math.floor(c.t * 8) % ANIM_FRAMES[pose];
    const teamTag = c.ally ? '★ TU EQUIPO' : '⚔ RIVAL';
    const kindText = c.kind === 'super' ? `${teamTag} · ⚡ SÚPER` : c.kind === 'heal' ? `${teamTag} · 💚 CURACIÓN` : `${teamTag} · ✦ HABILIDAD`;
    const fading = c.t > c.life - 0.25;
    return (
      <div
        key={c.id}
        class={`gacha-cutin-card ${side} kind-${c.kind} ${c.ally ? 'is-ally' : 'is-enemy'} ${fading ? 'fade' : ''}`}
        style={{ '--tc': c.color } as JSX.CSSProperties}
      >
        <img class="gacha-cutin-bg" src={bannerURL(c.cls, c.skin, 'hud')} alt="" />
        <img class="gacha-cutin-port" src={portraitURL(c.cls, c.skin, pose, frame, 2)} alt="" />
        <div class="gacha-cutin-info">
          <div class="gacha-cutin-kind">{kindText}</div>
          <div class="gacha-cutin-who" style={{ color: c.color }}>
            {c.name} · {CLASSES[c.cls].hero}
          </div>
          <div class="gacha-cutin-power">{c.powerName}</div>
        </div>
      </div>
    );
  };

  return (
    <>
      {allies.length > 0 && (
        <div class="gacha-side-col left">
          {allies.map((c) => renderCard(c, 'left'))}
        </div>
      )}
      {enemies.length > 0 && (
        <div class="gacha-side-col right">
          {enemies.map((c) => renderCard(c, 'right'))}
        </div>
      )}
    </>
  );
}

function FlagIcon({ color, state }: { color: string; state: number }) {
  const label = state === 0 ? 'en base' : state === 1 ? 'robada' : 'caída';
  return (
    <span class="tag" style={{ background: state === 0 ? color : state === 1 ? '#ff3b3b' : '#ffb13b', fontSize: '11px', color: '#fff', textShadow: '0 1px 0 #1a1026' }}>
      ⚑ {label}
    </span>
  );
}

function ScoreBoard({ s, cb }: { s: MatchState; cb: boolean }) {
  const mode = s.config.mode;
  const low = s.config.timeLimit > 0 && s.timeLeft <= 15 && s.phase === 'playing';
  const timer = s.config.timeLimit > 0 ? <div class={`timer ${low ? 'low' : ''}`}>{fmtTime(s.timeLeft)}</div> : null;
  if (mode === 'tutorial') return <div class="scoreboard">{timer}</div>;
  if (!MODES[mode].teams) {
    return (
      <div class="scoreboard is-ffa">
        {s.players.map((p) => (
          <div key={p.id} class="team-score is-ffa-cell" style={{ background: teamColor(s, p.team, cb), opacity: p.alive ? 1 : 0.45 }} title={p.name}>
            {s.roundWins[p.team]}
          </div>
        ))}
        {timer}
      </div>
    );
  }
  const score = (t: number) => (mode === 'eliminacion' ? s.roundWins[t] : s.scores[t]);
  const sub = (t: number) => {
    if (mode === 'ctf' && s.flags[t]) return <FlagIcon color={teamColor(s, t, cb)} state={s.flags[t].state} />;
    if (mode === 'eliminacion') return <small>{s.players.filter((p) => p.team === t && p.alive).length} vivos</small>;
    if (mode === 'zona') return <small>/{s.config.scoreLimit}</small>;
    return null;
  };
  return (
    <div class="scoreboard">
      <div style={{ textAlign: 'center' }}>
        <div class="team-score" style={{ background: `linear-gradient(180deg, ${teamColor(s, 0, cb)}, #1f4f9e)` }}>{score(0)}</div>
        <div class="flag-status">{sub(0)}</div>
      </div>
      <div style={{ textAlign: 'center' }}>
        {timer ?? <div class="timer">∞</div>}
        {mode === 'zona' && s.koth && (
          <div class="muted" style={{ fontSize: '12px', marginTop: '3px' }}>
            Zona se mueve en {Math.ceil(s.koth.t)}s
          </div>
        )}
        {(mode === 'eliminacion' || mode === 'duelo') && <div class="muted" style={{ fontSize: '12px', marginTop: '3px' }}>Ronda {s.round}</div>}
      </div>
      <div style={{ textAlign: 'center' }}>
        <div class="team-score" style={{ background: `linear-gradient(180deg, ${teamColor(s, 1, cb)}, #9e1f2a)` }}>{score(1)}</div>
        <div class="flag-status">{sub(1)}</div>
      </div>
    </div>
  );
}

function CountdownBanners({ session }: { session: Session }) {
  useTicker(120);
  const s = session.state;
  if (s.phase !== 'countdown' || s.config.mode === 'tutorial') return null;
  const cb = settings.get().colorblind;
  const isTeams = MODES[s.config.mode].teams;
  const countNum = Math.max(1, Math.ceil(s.phaseT));
  const compact = s.players.length > 4;

  const renderParticipant = (p: PlayerState) => {
    const localIdx = session.localIds.indexOf(p.id);
    const isLocal = localIdx !== -1;
    const tc = teamColor(s, p.team, cb);
    const frameColor = localIdx === 0 ? '#ffd23f' : '#3cff9a';
    const badgeText = session.localIds.length > 1 ? `★ JUGADOR ${localIdx + 1}` : '★ TÚ';
    return (
      <div
        key={p.id}
        class={`vs-card ${isLocal ? 'is-local-player' : 'is-other-player'} ${compact ? 'is-compact' : ''}`}
        style={{ '--tc': tc, ...(isLocal ? { '--player-frame': frameColor } : {}) } as JSX.CSSProperties}
      >
        {isLocal && <div class="vs-you-badge">{badgeText}</div>}
        <div class="vs-poster-wrap">
          <img src={bannerURL(p.cls, p.skin, 'poster')} alt={CLASSES[p.cls].hero} />
        </div>
        <div class="vs-meta">
          <b>{p.name}</b>
          <span>
            {CLASSES[p.cls].hero}
            {isLocal ? ' · TÚ' : p.bot ? ' · BOT' : ''}
          </span>
        </div>
      </div>
    );
  };

  if (isTeams) {
    const blueTeam = s.players.filter((p) => p.team === 0);
    const redTeam = s.players.filter((p) => p.team === 1);
    return (
      <div class="vs-banner-overlay is-teams">
        <div class={`vs-roster-side is-blue ${blueTeam.length >= 3 ? 'is-grid' : ''}`}>
          <div class="vs-team-title is-blue">EQUIPO AZUL</div>
          <div class="vs-roster-cards">{blueTeam.map(renderParticipant)}</div>
        </div>
        <div class="vs-badge">
          <div class="vs-word">VS</div>
          <div class="vs-mode">{MODES[s.config.mode].name}</div>
          <div class="vs-countdown-pill">EMPIEZA EN {countNum}</div>
        </div>
        <div class={`vs-roster-side is-red ${redTeam.length >= 3 ? 'is-grid' : ''}`}>
          <div class="vs-team-title is-red">EQUIPO ROJO</div>
          <div class="vs-roster-cards">{redTeam.map(renderParticipant)}</div>
        </div>
      </div>
    );
  }

  return (
    <div class="vs-banner-overlay is-ffa">
      <div class="vs-badge is-ffa">
        <div class="vs-word">{s.players.length === 2 ? 'DUELO' : 'ARENA'}</div>
        <div class="vs-mode">{MODES[s.config.mode].name}</div>
        <div class="vs-countdown-pill">EMPIEZA EN {countNum}</div>
      </div>
      <div class={`vs-roster-cards is-ffa ${compact ? 'is-grid' : ''}`}>{s.players.map(renderParticipant)}</div>
    </div>
  );
}

function Announcements({ session, feedback }: { session: Session; feedback: Feedback }) {
  useTicker(80);
  if (session.state.phase === 'countdown' && session.state.config.mode !== 'tutorial') return null;
  return (
    <div class="announce-layer">
      {feedback.announcements.map((a) => (
        <div key={a.id} class={`announce ${a.big ? 'big' : 'small'} ${a.cls ? 'with-banner' : ''} ${a.t > a.life - 0.3 ? 'fade' : ''}`} style={{ color: a.color }}>
          {a.cls && <img class="announce-cutin" src={bannerURL(a.cls, 'base', 'hud')} alt="" />}
          <div class="announce-copy">
            <span>{a.text}</span>
            {a.sub && <span class="sub">{a.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function KillFeed({ feedback }: { feedback: Feedback }) {
  useTicker(200);
  return (
    <div class="killfeed">
      {feedback.feed.map((f) => (
        <div key={f.id}>
          <span style={{ color: f.killerColor }}>{f.killer}</span>{' '}
          <span class="muted">{f.how === 'bomb' ? '💣' : f.how === 'crush' ? '🧱' : f.how === 'storm' ? '🌀' : f.how === 'lava' ? '🌋' : f.how === 'impact' ? '💥' : '⚔'}</span>{' '}
          <span style={{ color: f.victimColor }}>{f.victim}</span>
        </div>
      ))}
    </div>
  );
}

function StatusMsgs({ session, feedback, tutorial, touch }: { session: Session; feedback: Feedback; tutorial: boolean; touch: boolean }) {
  useTicker(150);
  const s = session.state;
  const me = s.players.find((p) => session.localIds.includes(p.id));
  const k = settings.get().keys.p1;
  if (session.status) return <div class="respawn-msg">{session.status}</div>;
  if (me && !me.alive && s.phase === 'playing') {
    const lastKill = [...feedback.feed].reverse().find((f) => f.victimId === me.id);
    const killerBanner = lastKill?.killerCls ? (
      <span class="killer-banner">
        <img src={bannerURL(lastKill.killerCls, 'base', 'hud')} alt="" />
        <span>Por {lastKill.killer}</span>
      </span>
    ) : null;
    const statusText = MODES[s.config.mode].respawn
      ? `Reaparece en ${Math.max(1, Math.ceil(me.respawn))}s`
      : 'Esperando ronda';
    return (
      <div class="respawn-msg">
        {killerBanner}
        <span>{killerBanner ? `· ${statusText}` : statusText}</span>
      </div>
    );
  }
  if (!tutorial && !touch && s.phase === 'playing' && s.time < 6) {
    return (
      <div class="hint-bar">
        <span>
          <span class="kbd">{keyLabel(k.up)}</span>
          <span class="kbd">{keyLabel(k.left)}</span>
          <span class="kbd">{keyLabel(k.down)}</span>
          <span class="kbd">{keyLabel(k.right)}</span> mover
        </span>
        <span>
          <span class="kbd">{keyLabel(k.bomb)}</span> bomba
        </span>
        <span>
          <span class="kbd">{keyLabel(k.attack)}</span> ataque
        </span>
        <span>
          <span class="kbd">{keyLabel(k.hyper)}</span> súper
        </span>
        <span>
          <span class="kbd">Tab</span> marcador
        </span>
      </div>
    );
  }
  return null;
}

function TutorialBox({ session }: { session: Session }) {
  useTicker(150);
  const s = session.state;
  const step = s.tut?.step ?? 0;
  const info = TUTORIAL_STEPS[Math.min(step, TUTORIAL_STEPS.length - 1)];
  const k = settings.get().keys.p1;
  const text = info.text
    .replace('WASD', `${keyLabel(k.up)}${keyLabel(k.left)}${keyLabel(k.down)}${keyLabel(k.right)}`)
    .replace('ESPACIO', keyLabel(k.bomb).toUpperCase())
    .replace('tecla J', `tecla ${keyLabel(k.attack)}`)
    .replace('tecla K', `tecla ${keyLabel(k.hyper)}`);
  return (
    <div class="tut-box">
      <div class="panel">
        <div class="tut-steps">
          {TUTORIAL_STEPS.map((_, i) => (
            <i key={i} class={i < step ? 'done' : i === step ? 'cur' : ''} />
          ))}
        </div>
        <h3 style={{ margin: 0 }}>
          {step + 1}. {info.title}
        </h3>
        <div style={{ fontSize: '17px' }}>{text}</div>
      </div>
    </div>
  );
}

function ScoresHold({ session }: { session: Session }) {
  useTicker(120);
  if (!input.scoresHeld) return null;
  return (
    <div class="scores-overlay">
      <div class="panel score-modal-panel">
        <ScoreTable s={session.state} localIds={session.localIds} />
      </div>
    </div>
  );
}

export function ScoreTable({ s, localIds }: { s: MatchState; localIds: number[] }) {
  const cb = settings.get().colorblind;
  const teams = MODES[s.config.mode].teams;
  const rows = teams ? [0, 1].flatMap((t) => ranked(s).filter((p) => p.team === t)) : ranked(s);
  const ctf = s.config.mode === 'ctf';
  return (
    <div class="table-scroll">
      <table class="table">
        <thead>
          <tr>
            <th>Jugador</th>
            <th>Clase</th>
            <th class="num">Elim.</th>
            <th class="num">Muertes</th>
            <th class="num">Asist.</th>
            {ctf && <th class="num">Capt.</th>}
            {ctf && <th class="num">Recup.</th>}
            {s.config.mode === 'zona' && <th class="num">En zona</th>}
            <th class="num">Daño</th>
            <th class="num">Puntos</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} class={localIds.includes(p.id) ? 'me' : ''}>
              <td>
                <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', background: teamColor(s, p.team, cb), border: '2px solid #1a1026', marginRight: '6px' }} />
                {p.name}
                {p.bot && <span class="muted"> (IA)</span>}
              </td>
              <td>
                <span class="score-hero-cell">
                  <img class="score-mini-banner" src={bannerURL(p.cls, p.skin, 'hud')} alt="" />
                  <span>{CLASSES[p.cls].hero}</span>
                </span>
              </td>
              <td class="num">{p.kills}</td>
              <td class="num">{p.deaths}</td>
              <td class="num">{p.assists}</td>
              {ctf && <td class="num">{p.caps}</td>}
              {ctf && <td class="num">{p.returns}</td>}
              {s.config.mode === 'zona' && <td class="num">{Math.round(p.zoneTime)}s</td>}
              <td class="num">{p.dmg}</td>
              <td class="num">
                <b>{p.points}</b>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PingBadge({ session }: { session: Session }) {
  useTicker(1000);
  const ping = (session as OnlineSession).ping ?? 0;
  const color = ping < 80 ? '#3cff9a' : ping < 160 ? '#ffd23f' : '#ff5a5a';
  return <div style={{ position: 'absolute', bottom: '6px', left: '12px', fontSize: '12px', zIndex: 9, color }}>● {ping} ms</div>;
}

// ---------------------------------------------------------------------------
// Controles táctiles
// ---------------------------------------------------------------------------

function TouchControls({ session }: { session: Session }) {
  useTicker(200);
  const knob = useRef<HTMLDivElement>(null);
  const me = session.state.players.find((p) => session.localIds.includes(p.id));
  const onJoy = (e: PointerEvent) => {
    const el = e.currentTarget as HTMLDivElement;
    const r = el.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    const mag = Math.hypot(dx, dy);
    let dir: Dir | -1 = -1;
    if (mag > 18) dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 3 : 2) : dy > 0 ? 0 : 1;
    input.touch.dir = dir;
    const k = Math.min(1, 50 / Math.max(1, mag));
    if (knob.current) knob.current.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  };
  const endJoy = () => {
    input.touch.dir = -1;
    if (knob.current) knob.current.style.transform = '';
  };
  return (
    <div class="touch-layer">
      <div
        class="joy"
        onPointerDown={(e) => {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          onJoy(e);
        }}
        onPointerMove={(e) => e.buttons && onJoy(e)}
        onPointerUp={endJoy}
        onPointerCancel={endJoy}
      >
        <div class="knob" ref={knob} />
      </div>
      <div class="tbtns">
        <button class={`tbtn hyp ${me && me.hyper >= 100 ? 'ready' : ''}`} onPointerDown={() => input.touch.hyperTaps++}>
          HIPER
        </button>
        <button
          class="tbtn atk"
          onPointerDown={() => (input.touch.attack = true)}
          onPointerUp={() => (input.touch.attack = false)}
          onPointerCancel={() => (input.touch.attack = false)}
          onPointerLeave={() => (input.touch.attack = false)}
        >
          ATAQUE
        </button>
        <button class="tbtn bomb" onPointerDown={() => input.touch.bombTaps++}>
          BOMBA
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pausa
// ---------------------------------------------------------------------------

function PauseMenu({ session, onResume, onQuit, onRestart }: { session: Session; onResume: () => void; onQuit: () => void; onRestart?: () => void }) {
  const st = useSettings();
  const [tab, setTab] = useState<'menu' | 'ajustes' | 'controles'>('menu');
  const s = session.state;
  const k = st.keys.p1;
  const me = s.players.find((p) => session.localIds.includes(p.id));
  useEffect(() => {
    audio.setVolumes(st.master, st.music, st.sfx);
  }, [st.master, st.music, st.sfx]);
  return (
    <div class="overlay">
      <div class="panel modal" style={{ maxWidth: '560px' }}>
        <h2 style={{ fontSize: '42px', color: 'var(--yellow)', textAlign: 'center', textShadow: '0 4px 0 var(--ink)' }}>PAUSA</h2>
        {session.kind === 'online' && <p class="muted" style={{ textAlign: 'center' }}>La partida online sigue corriendo.</p>}
        <div class="tabs" style={{ justifyContent: 'center' }}>
          <Btn variant={tab === 'menu' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('menu')}>
            Partida
          </Btn>
          <Btn variant={tab === 'ajustes' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('ajustes')}>
            Sonido
          </Btn>
          <Btn variant={tab === 'controles' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('controles')}>
            Controles
          </Btn>
        </div>
        {tab === 'menu' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' }}>
            {me && (
              <div class="panel" style={{ padding: '10px 14px' }}>
                <b style={{ fontFamily: 'var(--title)', color: CLASSES[me.cls].color }}>
                  {CLASSES[me.cls].hero} · {CLASSES[me.cls].className}
                </b>
                <div class="muted" style={{ fontSize: '14px' }}>
                  <b>Ataque:</b> {CLASSES[me.cls].attack.name} · <b>Hipercarga:</b> {CLASSES[me.cls].hyper.name} — {CLASSES[me.cls].hyper.desc}
                </div>
                <div class="muted" style={{ fontSize: '14px', marginTop: '4px' }}>
                  <b>Pasiva:</b> {CLASSES[me.cls].passive}
                </div>
              </div>
            )}
            <Btn size="big" onClick={onResume}>
              ▶ Continuar
            </Btn>
            {onRestart && (
              <Btn variant="blue" onClick={onRestart}>
                ↻ Reiniciar partida
              </Btn>
            )}
            <Btn variant="red" onClick={onQuit}>
              ✖ Abandonar
            </Btn>
          </div>
        )}
        {tab === 'ajustes' && (
          <div>
            {(['master', 'music', 'sfx'] as const).map((key) => (
              <div class="setting" key={key}>
                <div class="lbl">{key === 'master' ? 'Volumen general' : key === 'music' ? 'Música' : 'Efectos'}</div>
                <input type="range" min={0} max={1} step={0.05} value={st[key]} onInput={(e) => settings.set({ [key]: Number((e.target as HTMLInputElement).value) })} style={{ maxWidth: '220px' }} />
              </div>
            ))}
            <div class="setting">
              <div class="lbl">Temblor de pantalla</div>
              <Toggle on={st.shake > 0} onChange={(v) => settings.set({ shake: v ? 1 : 0 })} />
            </div>
            <div class="setting">
              <div class="lbl">Números de daño</div>
              <Toggle on={st.damageNumbers} onChange={(v) => settings.set({ damageNumbers: v })} />
            </div>
          </div>
        )}
        {tab === 'controles' && (
          <div style={{ fontSize: '16px', lineHeight: 1.9 }}>
            <div>
              <span class="kbd">{keyLabel(k.up)}</span>
              <span class="kbd">{keyLabel(k.left)}</span>
              <span class="kbd">{keyLabel(k.down)}</span>
              <span class="kbd">{keyLabel(k.right)}</span> Moverse
            </div>
            <div>
              <span class="kbd">{keyLabel(k.bomb)}</span> Poner bomba
            </div>
            <div>
              <span class="kbd">{keyLabel(k.attack)}</span> Atacar (mantener)
            </div>
            <div>
              <span class="kbd">{keyLabel(k.hyper)}</span> Hipercarga (cuando la barra está llena)
            </div>
            <div>
              <span class="kbd">{keyLabel(k.emote)}</span> / <span class="kbd">1</span>-<span class="kbd">4</span> Emotes
            </div>
            <div>
              <span class="kbd">Tab</span> Marcador · <span class="kbd">Esc</span> Pausa
            </div>
            <div class="muted">Mando: stick/cruceta mover · A bomba · X ataque · B/RB hipercarga · Y emote · Start pausa</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resultados
// ---------------------------------------------------------------------------

export function summaryFor(s: MatchState, p: PlayerState, online: boolean): MatchSummary {
  const result = resultFor(s, p);
  const teamPts = s.players.filter((q) => q.team === p.team).reduce((a, q) => a + q.points, 0);
  return {
    mode: s.config.mode,
    map: s.config.map,
    cls: p.cls,
    result,
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
    online,
    difficulty: s.players.find((q) => q.bot && q.team !== p.team)?.difficulty,
    pointsShare: teamPts > 0 ? p.points / teamPts : 0.33,
  };
}

function Results({ launch, session, onRematch, onQuit }: { launch: GameLaunch; session: Session; onRematch?: () => void; onQuit: () => void }) {
  const s = session.state;
  const cb = settings.get().colorblind;
  const me = s.players.find((p) => session.localIds.includes(p.id));
  const [rewards, setRewards] = useState<MatchRewards | null>(null);
  const [stars, setStars] = useState<boolean[]>([]);
  const [xpAnim, setXpAnim] = useState(0);
  const reported = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => audio.playMusic('menu'), 2500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (reported.current || !me) return;
    reported.current = true;
    (async () => {
      if (launch.onlineRewards) {
        let r = await launch.onlineRewards();
        if (!r) {
          // invitado: el progreso se guarda en el perfil local (sin ranking)
          const sum = summaryFor(s, me, false);
          sum.difficulty = undefined;
          r = await profiles.reportMatch(sum);
        }
        setRewards(r);
        return;
      }
      const sum = summaryFor(s, me, false);
      if (launch.festival) {
        const f = launch.festival;
        const theirs = MODES[s.config.mode].teams ? (s.config.mode === 'eliminacion' ? s.roundWins[1 - me.team] : s.scores[1 - me.team]) : Math.max(...s.roundWins.filter((_, i) => i !== me.team));
        const mine = s.config.mode === 'eliminacion' || s.config.mode === 'clasica' ? s.roundWins[me.team] : s.scores[me.team];
        const fr = {
          won: sum.result === 'win',
          kills: me.kills,
          deaths: me.deaths,
          caps: me.caps,
          points: me.points,
          time: s.time,
          scoreFor: mine,
          scoreAgainst: theirs,
          blocks: me.blocks,
          assists: me.assists,
        };
        const got = f.stars.map((g) => g.check(fr));
        // la primera estrella (ganar) es requisito para las demás
        const valid = got[0] ? got : [false, false, false];
        setStars(valid);
        sum.festival = f.n;
        sum.festivalStars = valid.filter(Boolean).length;
        sum.festivalReward = f.reward;
      }
      if (launch.tutorial) sum.mode = 'tutorial';
      const r = await profiles.reportMatch(sum);
      setRewards(r);
      if (r.levelAfter > r.levelBefore) setTimeout(() => audio.play('levelup'), 900);
      if (r.coins > 0) setTimeout(() => audio.play('coin'), 500);
    })();
  }, []);

  useEffect(() => {
    if (!rewards) return;
    let v = 0;
    const id = setInterval(() => {
      v = Math.min(1, v + 0.04);
      setXpAnim(v);
      if (v >= 1) clearInterval(id);
    }, 30);
    return () => clearInterval(id);
  }, [rewards]);

  const result = me ? resultFor(s, me) : s.winner >= 0 ? 'win' : 'draw';
  const banner = launch.tutorial ? '¡TUTORIAL COMPLETO!' : result === 'win' ? '¡VICTORIA!' : result === 'lose' ? 'DERROTA' : 'EMPATE';
  const bannerColor = launch.tutorial ? '#3cff9a' : result === 'win' ? '#ffd23f' : result === 'lose' ? '#ff5a5a' : '#ffffff';
  const mvp = ranked(s)[0];
  const winnerName = s.winner >= 0 ? (MODES[s.config.mode].teams ? TEAM_NAMES[s.winner] : s.players.find((p) => p.team === s.winner)?.name) : null;
  const xpNow = rewards ? rewards.xpBefore + rewards.xp * xpAnim : 0;
  const lv = levelFromXp(xpNow);
  const div = divisionFor(rewards?.eloKind === 'online' ? profiles.profile.elo : profiles.profile.eloIA);

  return (
    <div class="overlay" style={{ alignItems: 'flex-start', overflow: 'auto' }}>
      <div style={{ width: 'min(1100px, 98vw)', margin: 'auto' }}>
        <div class="result-banner" style={{ color: bannerColor }}>
          {banner}
        </div>
        {winnerName && !launch.tutorial && (
          <div style={{ textAlign: 'center', fontFamily: 'var(--title)', fontSize: '22px', marginBottom: '10px', color: teamColor(s, s.winner, cb), textShadow: '0 2px 0 var(--ink)' }}>
            Ganó {winnerName}
            {(s.config.mode === 'ctf' || s.config.mode === 'zona') && s.scores[0] === s.scores[1] && <span class="muted" style={{ fontSize: '16px' }}> (desempate por puntos: {s.teamPoints[0]} a {s.teamPoints[1]})</span>}
          </div>
        )}
        {launch.festival && (
          <div class="panel" style={{ maxWidth: '560px', margin: '0 auto 14px', textAlign: 'center' }}>
            <h3>
              Nivel {launch.festival.n}: {launch.festival.name}
            </h3>
            <div class="stars">
              {launch.festival.stars.map((g, i) => (
                <StarIcon key={i} on={!!stars[i]} pop delay={0.3 + i * 0.35} />
              ))}
            </div>
            <div style={{ fontSize: '14px', marginTop: '6px' }}>
              {launch.festival.stars.map((g, i) => (
                <div key={i} style={{ color: stars[i] ? '#ffd23f' : 'var(--muted)' }}>
                  {stars[i] ? '★' : '☆'} {g.text}
                </div>
              ))}
            </div>
          </div>
        )}
        <div class="results">
          <div class="panel">
            {!launch.tutorial && mvp && (
              <div class="mvp" style={{ marginBottom: '8px' }}>
                <img src={portraitURL(mvp.cls, mvp.skin, 'win', 2, 2)} alt="" />
                <div>
                  <div class="tag" style={{ background: '#ffd23f', color: '#1a1026' }}>
                    MVP
                  </div>
                  <div class="hero-detail-title" style={{ color: teamColor(s, mvp.team, cb) }}>
                    {mvp.name}
                  </div>
                  <div class="muted">
                    {CLASSES[mvp.cls].hero} · {mvp.points} puntos · {mvp.kills} eliminaciones
                  </div>
                </div>
              </div>
            )}
            <ScoreTable s={s} localIds={session.localIds} />
          </div>
          <div class="panel">
            <h3>Recompensas</h3>
            {!rewards && <div class="muted">Calculando...</div>}
            {rewards && (
              <div>
                <div class="row" style={{ marginBottom: '6px' }}>
                  <div class="lvl-badge">{lv.level}</div>
                  <div style={{ flex: 1 }}>
                    <div class="bar">
                      <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
                    </div>
                    <div class="muted" style={{ fontSize: '13px' }}>
                      {Math.floor(lv.into)} / {lv.need} XP
                    </div>
                  </div>
                </div>
                {rewards.levelAfter > rewards.levelBefore && xpAnim >= 1 && (
                  <div class="announce small" style={{ color: '#ffd23f', margin: '6px 0' }}>
                    ¡SUBISTE AL NIVEL {rewards.levelAfter}!
                  </div>
                )}
                <div class="reward-line">
                  <span>Experiencia</span>
                  <b style={{ color: '#3cff9a' }}>+{rewards.xp} XP</b>
                </div>
                <div class="reward-line">
                  <span>Monedas</span>
                  <b>
                    <Coins n={rewards.coins} />
                  </b>
                </div>
                {rewards.eloKind !== 'none' && (
                  <div class="reward-line">
                    <span>{rewards.eloKind === 'online' ? 'Ranking online' : 'Liga contra la IA'}</span>
                    <b style={{ color: rewards.eloDelta >= 0 ? '#3cff9a' : '#ff5a5a' }}>
                      {rewards.eloDelta >= 0 ? '+' : ''}
                      {rewards.eloDelta} ELO · <span style={{ color: div.color }}>{div.name}</span>
                    </b>
                  </div>
                )}
                {rewards.newItems.map((it) => (
                  <div class="reward-line" key={it}>
                    <span>¡Nuevo ítem!</span>
                    <b style={{ color: '#c46bff' }}>{itemName(it)}</b>
                  </div>
                ))}
                {rewards.achievements.map((a) => {
                  const ach = ACHIEVEMENTS.find((x) => x.id === a);
                  return (
                    <div class="reward-line" key={a}>
                      <span>🏆 Logro: {ach?.name}</span>
                      <b>
                        <Coins n={ach?.reward ?? 0} />
                      </b>
                    </div>
                  );
                })}
                {rewards.festivalStarsNew > 0 && (
                  <div class="reward-line">
                    <span>Estrellas nuevas</span>
                    <b style={{ color: '#ffd23f' }}>+{rewards.festivalStarsNew} ★</b>
                  </div>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
              {onRematch && !launch.tutorial && (
                <Btn size="big" onClick={onRematch}>
                  {launch.festival ? '↻ Reintentar nivel' : '↻ Revancha'}
                </Btn>
              )}
              {launch.setup && !launch.festival && !launch.tutorial && (
                <Btn variant="blue" onClick={() => nav.replace('charselect', { setup: launch.setup })}>
                  Cambiar personaje
                </Btn>
              )}
              {launch.festival && (
                <Btn variant="blue" onClick={onQuit}>
                  Volver al Festival
                </Btn>
              )}
              {launch.online && (
                <Btn size="big" onClick={() => nav.reset('room')}>
                  Volver a la sala
                </Btn>
              )}
              <Btn variant={launch.tutorial ? 'yellow' : 'ghost'} size={launch.tutorial ? 'big' : undefined} onClick={() => { audio.playMusic('menu'); launch.onExit?.(); if (launch.online) net.leave(); nav.reset('menu'); }}>
                Menú principal
              </Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

void DIVISIONS;
