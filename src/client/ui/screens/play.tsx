// Configuración de partida (modo, mapa, reglas) y selección de personaje.
import type { JSX } from 'preact';
import { useMemo, useState } from 'preact/hooks';
import { CLASSES, MODES } from '../../../shared/balance';
import { RARITY } from '../../../shared/catalog';
import { MAPS, MAP_ORDER } from '../../../shared/maps';
import { CLASS_IDS, type ClassId, type Difficulty, type MapId, type ModeId } from '../../../shared/types';
import { FESTIVAL } from '../../data/festival';
import { SKINS } from '../../gfx/characters';
import { bannerURL, onAssetsChange, portraitURL } from '../../gfx/sprites';
import type { HumanSetup, MatchSetup } from '../../game/setup';
import { profiles } from '../../services/profile';
import { settings } from '../../services/settings';
import { store } from '../../services/storage';
import { Backdrop, Btn, Header, MenuIcon, Pips, Seg, Toggle, mapThumb } from '../common';
import { useProfile } from '../hooks';
import { nav } from '../nav';
import { festivalSetup, startLocal } from './launch';

const MODE_ORDER: ModeId[] = ['ctf', 'duelo', 'eliminacion', 'zona', 'clasica'];

const ROLE_ICON: Record<ClassId, string> = {
  tanque: '🛡️',
  veloz: '⚡',
  distancia: '🎯',
  support: '💚',
  defensor: '🧱',
  controlador: '🔮',
};

const MODE_META: Record<ModeId, { icon: string; badge: string; accent: string }> = {
  ctf: { icon: '🚩', badge: 'Equipos · Banderas', accent: '#ffd23f' },
  duelo: { icon: '⚔️', badge: '1v1 / 2v2 · Tormenta', accent: '#c46bff' },
  eliminacion: { icon: '💀', badge: 'Equipos · Por rondas', accent: '#ff4d5e' },
  zona: { icon: '🎯', badge: 'Equipos · Control', accent: '#3cff9a' },
  clasica: { icon: '💣', badge: 'Todos vs Todos', accent: '#ff8a1a' },
  tutorial: { icon: '📘', badge: 'Entrenamiento', accent: '#3cff9a' },
};

const MAP_META: Record<MapId, { themeIcon: string; themeLabel: string; scale: '1v1' | '3v3'; roles: ClassId[]; hazard?: string }> = {
  ruinas: { themeIcon: '🏛️', themeLabel: 'Equilibrado', scale: '3v3', roles: ['tanque', 'veloz', 'distancia', 'support'] },
  laberinto: { themeIcon: '🧱', themeLabel: 'Pasillos estrechos', scale: '3v3', roles: ['tanque', 'defensor', 'controlador'] },
  fabrica: { themeIcon: '⚙️', themeLabel: 'Cintas y compuertas', scale: '3v3', roles: ['veloz', 'distancia'], hazard: 'Cintas' },
  volcan: { themeIcon: '🌋', themeLabel: 'Grietas de lava', scale: '3v3', roles: ['distancia', 'controlador'], hazard: 'Lava' },
  ruinas_chico: { themeIcon: '🏛️', themeLabel: 'Duelo compacto', scale: '1v1', roles: ['tanque', 'veloz', 'distancia'] },
  laberinto_chico: { themeIcon: '🧱', themeLabel: 'Duelo táctico', scale: '1v1', roles: ['tanque', 'defensor', 'controlador'] },
  fabrica_chico: { themeIcon: '⚙️', themeLabel: 'Duelo dinámico', scale: '1v1', roles: ['veloz', 'distancia'], hazard: 'Cintas' },
  tutorial: { themeIcon: '📘', themeLabel: 'Entrenamiento', scale: '1v1', roles: ['tanque'] },
};

interface PlayPrefs {
  mode: ModeId;
  map: MapId;
  teamSize: number;
  ffaSize: number;
  difficulty: Difficulty;
  locals: number;
  p2Team: number;
  powerups: Record<string, boolean>;
  time: Record<string, number>;
  score: Record<string, number>;
}

const DEFAULT_PREFS: PlayPrefs = {
  mode: 'ctf',
  map: 'ruinas',
  teamSize: 3,
  ffaSize: 4,
  difficulty: 1,
  locals: 1,
  p2Team: 1,
  powerups: {},
  time: {},
  score: {},
};

export function PlayScreen() {
  const [pr, setPr] = useState<PlayPrefs>(() => ({ ...DEFAULT_PREFS, difficulty: settings.get().difficulty, ...store.get<Partial<PlayPrefs>>('playPrefs', {}) }));
  const [showRules, setShowRules] = useState(false);
  const set = (patch: Partial<PlayPrefs>) => {
    const next = { ...pr, ...patch };
    setPr(next);
    store.set('playPrefs', next);
  };
  const mode = MODES[pr.mode];
  const time = pr.time[pr.mode] ?? mode.defaultTime;
  const score = pr.score[pr.mode] ?? mode.defaultScore;
  const powerups = pr.powerups[pr.mode] ?? mode.powerups;

  const timeOpts: Record<string, number[]> = { ctf: [180, 300, 480, 600], duelo: [45, 60, 90, 120], eliminacion: [60, 90, 120], zona: [180, 240, 360], clasica: [90, 120, 180] };
  const scoreOpts: Record<string, number[]> = { ctf: [1, 3, 5, 7], duelo: [1, 2, 3, 5], eliminacion: [2, 3, 5], zona: [60, 100, 150], clasica: [1, 2, 3, 5] };
  const diffNames = ['Fácil', 'Normal', 'Difícil', 'Experto'];
  const sizeLabel = mode.teams ? `${pr.teamSize} vs ${pr.teamSize}` : `${pr.ffaSize} jugadores`;
  const timeLabel = time >= 60 ? `${Math.floor(time / 60)}:${String(time % 60).padStart(2, '0')}` : `${time}s`;

  const next = () => {
    const setup: MatchSetup = {
      mode: pr.mode,
      map: pr.map,
      teamSize: mode.teams ? pr.teamSize : pr.ffaSize,
      difficulty: pr.difficulty,
      humans: [],
      timeLimit: time,
      scoreLimit: score,
      powerups,
    };
    nav.go('charselect', { setup, locals: pr.locals, p2Team: pr.p2Team });
  };

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Nueva partida">
        <Btn size="big" class="cta-primary-btn" onClick={next}>
          Elegir personaje ▶
        </Btn>
      </Header>
      <div class="screen-body">
        <div class="panel play-rules-bar">
          <div class="play-rules-summary">
            <span class="rule-chip is-mode" style={{ '--rc': MODE_META[pr.mode].accent } as JSX.CSSProperties}>
              {MODE_META[pr.mode].icon} {mode.name}
            </span>
            <span class="rule-chip is-map">
              {MAP_META[pr.map].themeIcon} {MAPS[pr.map].name}
            </span>
            <span class="rule-chip" title="Cantidad de jugadores">👥 {sizeLabel}</span>
            <span class="rule-chip" title="Dificultad de la IA">🤖 {diffNames[pr.difficulty]}</span>
            <span class="rule-chip" title="Duración">⏱ {timeLabel}</span>
            <span class="rule-chip" title={`Meta: ${score} ${mode.scoreLabel.toLowerCase()}`}>🏆 {score}</span>
          </div>
          <div class="play-quick-actions">
            <Btn
              variant={pr.locals === 2 ? 'blue' : 'ghost'}
              size="small"
              class="icon-quick-btn"
              onClick={() => set({ locals: pr.locals === 1 ? 2 : 1 })}
              aria-label={pr.locals === 2 ? '2 jugadores locales' : '1 jugador local'}
              data-tip={pr.locals === 2 ? '2 Jugadores (Local)' : '1 Jugador'}
              title={pr.locals === 2 ? '2 Jugadores (Local)' : '1 Jugador'}
            >
              <MenuIcon name={pr.locals === 2 ? 'players2' : 'players1'} size={20} />
              <span>{pr.locals}J</span>
            </Btn>
            <Btn
              variant={powerups ? 'green' : 'ghost'}
              size="small"
              class="icon-quick-btn"
              onClick={() => set({ powerups: { ...pr.powerups, [pr.mode]: !powerups } })}
              aria-pressed={powerups}
              aria-label={powerups ? 'Mejoras activadas' : 'Mejoras desactivadas'}
              data-tip={powerups ? 'Mejoras: SÍ' : 'Mejoras: NO'}
              title={powerups ? 'Mejoras: SÍ' : 'Mejoras: NO'}
            >
              <MenuIcon name="powerups" size={20} />
            </Btn>
            <Btn
              variant={showRules ? 'yellow' : 'ghost'}
              size="small"
              class="icon-quick-btn"
              onClick={() => setShowRules((v) => !v)}
              aria-expanded={showRules}
              aria-label="Configurar reglas"
              data-tip="Reglas"
              title="Reglas"
            >
              <MenuIcon name="rules" size={20} />
            </Btn>
          </div>
        </div>

        {showRules && (
          <div class="panel play-rules-drawer">
            {mode.teams ? (
              <div class="setting">
                <div class="lbl">
                  Jugadores por equipo<small>Los lugares libres los ocupan bots.</small>
                </div>
                <Seg value={pr.teamSize} options={[1, 2, 3, 4].map((v) => ({ v, label: `${v} vs ${v}` }))} onChange={(v) => set({ teamSize: v })} />
              </div>
            ) : (
              <div class="setting">
                <div class="lbl">Jugadores en la arena</div>
                <Seg value={pr.ffaSize} options={[2, 3, 4, 5, 6].map((v) => ({ v, label: String(v) }))} onChange={(v) => set({ ffaSize: v })} />
              </div>
            )}
            <div class="setting">
              <div class="lbl">
                Dificultad de los bots<small>Afecta reflejos, puntería y estrategia.</small>
              </div>
              <Seg
                value={pr.difficulty}
                options={[
                  { v: 0 as Difficulty, label: 'Fácil' },
                  { v: 1 as Difficulty, label: 'Normal' },
                  { v: 2 as Difficulty, label: 'Difícil' },
                  { v: 3 as Difficulty, label: 'Experto' },
                ]}
                onChange={(v) => set({ difficulty: v })}
              />
            </div>
            <div class="setting">
              <div class="lbl">{mode.rounds ? 'Tiempo por ronda' : 'Duración'}</div>
              <Seg value={time} options={timeOpts[pr.mode].map((v) => ({ v, label: v >= 60 ? `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` : `${v}s` }))} onChange={(v) => set({ time: { ...pr.time, [pr.mode]: v } })} />
            </div>
            <div class="setting">
              <div class="lbl">Para ganar ({mode.scoreLabel.toLowerCase()})</div>
              <Seg value={score} options={scoreOpts[pr.mode].map((v) => ({ v, label: String(v) }))} onChange={(v) => set({ score: { ...pr.score, [pr.mode]: v } })} />
            </div>
            <div class="setting">
              <div class="lbl">
                Mejoras en los bloques<small>Se pierden al morir.</small>
              </div>
              <Toggle on={powerups} onChange={(v) => set({ powerups: { ...pr.powerups, [pr.mode]: v } })} />
            </div>
            <div class="setting">
              <div class="lbl">
                Jugadores en esta compu<small>J2 usa flechas + Enter / Shift der. / Ctrl der.</small>
              </div>
              <Seg value={pr.locals} options={[{ v: 1, label: '1 jugador' }, { v: 2, label: '2 jugadores' }]} onChange={(v) => set({ locals: v })} />
            </div>
            {pr.locals === 2 && mode.teams && (
              <div class="setting" style={{ borderBottom: 'none' }}>
                <div class="lbl">El Jugador 2 juega...</div>
                <Seg value={pr.p2Team} options={[{ v: 0, label: 'En mi equipo' }, { v: 1, label: 'En contra' }]} onChange={(v) => set({ p2Team: v })} />
              </div>
            )}
          </div>
        )}

        <h3 class="play-section-title">1. Modo de juego</h3>
        <div class="cards play-modes-grid">
          {MODE_ORDER.map((m) => {
            const meta = MODE_META[m];
            const active = pr.mode === m;
            return (
              <button
                key={m}
                type="button"
                class={`card play-compact-card play-mode-card ${active ? 'sel' : ''}`}
                style={{ '--mc': meta.accent } as JSX.CSSProperties}
                onClick={() => set({ mode: m, ...(m === 'duelo' ? { map: pr.map.endsWith('_chico') ? pr.map : 'ruinas_chico', ffaSize: 2 } : {}) })}
                aria-pressed={active}
                title={MODES[m].desc}
              >
                {active && <span class="sel-check-badge" aria-hidden="true">✓</span>}
                <div class="play-card-head">
                  <span class="play-mode-ico-wrap" aria-hidden="true">{meta.icon}</span>
                  <div class="play-mode-meta">
                    <h4>{MODES[m].name}</h4>
                    <span class="mode-meta-pill">{meta.badge}</span>
                  </div>
                </div>
                <p class="card-desc-compact">{MODES[m].desc}</p>
              </button>
            );
          })}
        </div>

        <h3 class="play-section-title">2. Mapa</h3>
        <div class="cards play-maps-grid">
          {MAP_ORDER.map((m) => {
            const meta = MAP_META[m];
            const active = pr.map === m;
            return (
              <button
                key={m}
                type="button"
                class={`card play-compact-card play-map-card ${active ? 'sel' : ''}`}
                onClick={() => set({ map: m })}
                aria-pressed={active}
                title={`${MAPS[m].desc} — ${MAPS[m].recommended}`}
              >
                <div class="map-thumb-wrap">
                  <img class="thumb" src={mapThumb(m)} alt={MAPS[m].name} />
                  <span class={`map-scale-pill is-${meta.scale}`}>{meta.scale === '1v1' ? '⚔️ 1v1' : '🏰 3v3'}</span>
                  {active && <span class="sel-check-badge" aria-hidden="true">✓</span>}
                </div>
                <div class="map-card-footer">
                  <div class="map-card-title-row">
                    <h4>{MAPS[m].name}</h4>
                    <span class="map-theme-pill" title={meta.themeLabel}>
                      {meta.themeIcon} {meta.hazard ?? meta.themeLabel}
                    </span>
                  </div>
                  <div class="map-roles-strip" aria-label={MAPS[m].recommended} title={MAPS[m].recommended}>
                    {meta.roles.map((r) => (
                      <span key={r} class="map-role-chip" title={`${CLASSES[r].hero} (${CLASSES[r].className})`}>
                        {ROLE_ICON[r]}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <div style={{ height: '16px' }} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selección de personaje
// ---------------------------------------------------------------------------

export function CharSelect({ params }: { params: Record<string, unknown> }) {
  const p = useProfile();
  const festivalN = params.festival as number | undefined;
  const festival = festivalN ? FESTIVAL.find((f) => f.n === festivalN) : undefined;
  const baseSetup = params.setup as MatchSetup | undefined;
  const locals = festival ? 1 : ((params.locals as number) ?? (baseSetup?.humans.length || 1));
  const p2Team = (params.p2Team as number) ?? (baseSetup?.humans[1]?.team ?? 1);
  const teams = festival ? MODES[festival.mode].teams : baseSetup ? MODES[baseSetup.mode].teams : true;

  const initial = (i: number): HumanSetup => {
    const prev = baseSetup?.humans[i];
    if (prev) return prev;
    const cls = i === 0 ? p.favorite : (CLASS_IDS.find((c) => c !== p.favorite) ?? 'veloz');
    return { name: i === 0 ? p.name : 'Jugador 2', cls, skin: i === 0 ? profiles.skinFor(cls) : 'base', fx: i === 0 ? p.equip.fx : 'clasico', team: i === 0 ? 0 : teams ? p2Team : 1 };
  };
  const [humans, setHumans] = useState<HumanSetup[]>(() => Array.from({ length: locals }, (_, i) => initial(i)));
  const [active, setActive] = useState(0);
  const cur = humans[active];
  const c = CLASSES[cur.cls];

  const pick = (cls: ClassId) => {
    const other = humans.find((h, i) => i !== active && h.cls === cls && h.team === cur.team);
    if (teams && other) return;
    const skin = active === 0 ? profiles.skinFor(cls) : 'base';
    const next = humans.map((h, i) => (i === active ? { ...h, cls, skin } : h));
    setHumans(next);
    if (active === 0) void profiles.setFavorite(cls);
    if (locals > 1 && active === 0) setActive(1);
  };

  const setSkin = (skin: string) => {
    setHumans(humans.map((h, i) => (i === active ? { ...h, skin } : h)));
    if (active === 0) void profiles.equip(`skin:${cur.cls}:${skin}`);
  };

  const go = () => {
    if (festival) {
      startLocal(festivalSetup(festival, humans[0]), festival);
      return;
    }
    if (!baseSetup) return;
    startLocal({ ...baseSetup, humans });
  };

  const owned = (skinId: string) => active !== 0 || p.owned.includes(`skin:${cur.cls}:${skinId}`);
  const skins = SKINS[cur.cls];
  const activeSkin = skins.find((s) => s.id === cur.skin) ?? skins[0];

  return (
    <div class="screen">
      <Backdrop />
      <Header title={festival ? `Nivel ${festival.n}: ${festival.name}` : 'Elegí tu personaje'}>
        <Btn size="big" class="cta-primary-btn" onClick={go}>
          ¡A JUGAR! ▶
        </Btn>
      </Header>
      <div class="screen-body">
        <div class="grid layout-char-select">
          <div>
            {locals > 1 && (
              <div class="row wrap" style={{ marginBottom: '12px' }}>
                {humans.map((h, i) => (
                  <Btn key={i} variant={active === i ? 'yellow' : 'ghost'} size="small" onClick={() => setActive(i)}>
                    Jugador {i + 1}: {CLASSES[h.cls].hero}
                  </Btn>
                ))}
              </div>
            )}
            <div class="char-grid">
              {CLASS_IDS.map((id) => {
                const takenBy = humans.findIndex((h, i) => i !== active && h.cls === id && h.team === cur.team);
                const mine = humans.findIndex((h) => h.cls === id);
                const selected = cur.cls === id;
                return (
                  <button
                    key={id}
                    type="button"
                    class={`char-tile ${selected ? 'sel' : ''} ${teams && takenBy >= 0 ? 'taken' : ''}`}
                    style={{ '--cc': CLASSES[id].color, '--cc-glow': CLASSES[id].color + '66' } as JSX.CSSProperties}
                    onClick={() => pick(id)}
                    aria-pressed={selected}
                    title={`${CLASSES[id].hero} · ${CLASSES[id].className}`}
                  >
                    <span class="char-role-badge" title={CLASSES[id].className} aria-hidden="true">
                      {ROLE_ICON[id]}
                    </span>
                    {selected && <span class="char-sel-check" aria-hidden="true">✓</span>}
                    <img src={portraitURL(id, humans[Math.max(0, mine)]?.cls === id ? humans[Math.max(0, mine)].skin : profiles.skinFor(id), 'idle', 0, 3)} alt="" />
                    <div class="cname">{CLASSES[id].hero}</div>
                    {locals > 1 && mine >= 0 && (
                      <span class="pmark" style={{ background: mine === 0 ? '#3d8bff' : '#ff4d5e' }}>
                        P{mine + 1}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {locals > 1 && teams && (
              <div class="panel" style={{ marginTop: '14px' }}>
                <div class="setting" style={{ borderBottom: 'none' }}>
                  <div class="lbl">Equipo del Jugador 2</div>
                  <Seg value={humans[1].team} options={[{ v: 0, label: 'Azul (conmigo)' }, { v: 1, label: 'Rojo (rival)' }]} onChange={(t) => setHumans(humans.map((h, i) => (i === 1 ? { ...h, team: t } : h)))} />
                </div>
              </div>
            )}
            {festival && (
              <div class="panel" style={{ marginTop: '14px' }}>
                <h3>Objetivos</h3>
                <div class="muted" style={{ marginBottom: '6px' }}>{festival.desc}</div>
                {festival.stars.map((s, i) => (
                  <div key={i}>
                    ★ {s.text}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div class="panel char-inspector-panel">
            <div class="grid layout-char-detail" style={{ gap: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                <img class="poster-preview" src={bannerURL(cur.cls, cur.skin, 'poster')} alt={c.hero} />
              </div>
              <div style={{ flex: 1, minInlineSize: 0 }}>
                <div class="hero-detail-title" style={{ color: c.color }}>
                  {c.hero}
                </div>
                <div class="hero-vitals-strip">
                  <span class="tag hero-role-tag" style={{ background: c.color, color: '#120820' }}>
                    {ROLE_ICON[cur.cls]} {c.className}
                  </span>
                  <span class="vital-chip" title="Vida base">❤️ {c.hp}</span>
                  <span class="vital-chip" title="Velocidad">👟 {c.speed}</span>
                </div>
                <div class="muted" style={{ marginTop: '6px' }}>{c.role}</div>
                <div style={{ marginTop: '10px' }}>
                  {(
                    [
                      ['❤️', 'VIDA', 'Vida', c.bars.vida],
                      ['⚔️', 'DAÑO', 'Daño', c.bars.dano],
                      ['👟', 'VEL', 'Velocidad', c.bars.velocidad],
                      ['🎯', 'ALC', 'Alcance', c.bars.alcance],
                      ['🌀', 'CTRL', 'Control', c.bars.control],
                    ] as [string, string, string, number][]
                  ).map(([ico, shortLabel, fullLabel, v]) => (
                    <div class="stat-row" key={shortLabel}>
                      <span class="stat-lbl-chip" title={fullLabel}>
                        <i aria-hidden="true">{ico}</i> {shortLabel}
                      </span>
                      <Pips n={v} color={c.color} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div class="char-ability-list">
              <div class="ability-row is-atk">
                <span class="ability-ico" aria-hidden="true">⚔️</span>
                <div class="ability-copy">
                  <div class="ability-head">
                    <b>{c.attack.name}</b>
                    <div class="ability-chips">
                      <span class="ability-chip" title="Daño">💥 {c.attack.damage}</span>
                      <span class="ability-chip" title="Alcance">📏 {c.attack.range}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div class="ability-row is-super">
                <span class="ability-ico" aria-hidden="true">⚡</span>
                <div class="ability-copy">
                  <div class="ability-head">
                    <b>SÚPER · {c.hyper.name}</b>
                  </div>
                  <div class="ability-desc">{c.hyper.desc}</div>
                </div>
              </div>
              <div class="ability-row is-passive">
                <span class="ability-ico" aria-hidden="true">🛡️</span>
                <div class="ability-copy">
                  <div class="ability-head">
                    <b>PASIVA</b>
                  </div>
                  <div class="ability-desc">{c.passive}</div>
                </div>
              </div>
            </div>
            <div class="skin-swatch-section">
              <div class="skin-section-head">
                <h3>🎨 Skin</h3>
                <span class="skin-active-pill" style={{ color: RARITY[activeSkin.rarity].color }}>
                  {activeSkin.name} · {RARITY[activeSkin.rarity].name}
                </span>
              </div>
              <div class="skin-swatch-strip">
                {skins.map((s) => {
                  const has = owned(s.id);
                  const activeSkinBtn = cur.skin === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      class={`skin-swatch-btn ${activeSkinBtn ? 'sel' : ''} ${has ? '' : 'locked'}`}
                      style={{ '--rc': RARITY[s.rarity].color } as JSX.CSSProperties}
                      onClick={() => (has ? setSkin(s.id) : nav.go('shop'))}
                      aria-label={`${s.name} (${RARITY[s.rarity].name})`}
                      aria-pressed={activeSkinBtn}
                      data-tip={`${s.name} · ${RARITY[s.rarity].name}`}
                      title={has ? `${s.name} (${RARITY[s.rarity].name})` : `${s.name} — Conseguila en la Tienda`}
                    >
                      <img src={portraitURL(cur.cls, s.id, 'idle', 0, 2)} alt="" />
                      <span class="swatch-rarity-bar" aria-hidden="true" />
                      {activeSkinBtn && <span class="swatch-check" aria-hidden="true">✓</span>}
                      {!has && <span class="swatch-lock" aria-hidden="true">🔒</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function useModeList() {
  return useMemo(() => MODE_ORDER.map((m) => MODES[m]), []);
}
