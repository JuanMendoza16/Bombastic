// Perfil del jugador: progresión, economía, inventario, estadísticas y logros
// (GDD secciones 11 a 14). Lógica pura compartida por el cliente (perfil local)
// y el servidor (perfil de cuenta).
import { ELO, computeRewards, eloDelta, levelFromXp, PROGRESSION } from './balance';
import { LEVEL_REWARDS, defaultOwned } from './catalog';
import { CLASS_IDS, type ClassId, type Difficulty, type MapId, type ModeId } from './types';


export interface ClassStat {
  matches: number;
  wins: number;
  kills: number;
}

export interface ProfileStats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  kills: number;
  deaths: number;
  assists: number;
  caps: number;
  returns: number;
  defends: number;
  damage: number;
  heal: number;
  blocks: number;
  playTime: number;
  bestStreak: number;
  byClass: Record<ClassId, ClassStat>;
}

export interface MatchRecord {
  date: number;
  mode: ModeId;
  map: MapId;
  cls: ClassId;
  result: 'win' | 'lose' | 'draw';
  kills: number;
  deaths: number;
  assists: number;
  caps: number;
  points: number;
  xp: number;
  coins: number;
  elo: number;
  online: boolean;
  festival?: number;
}

export interface Profile {
  name: string;
  createdAt: number;
  xp: number;
  coins: number;
  owned: string[];
  equip: { skins: Partial<Record<ClassId, string>>; fx: string; emotes: number[] };
  favorite: ClassId;
  stats: ProfileStats;
  history: MatchRecord[];
  /** ELO de partidas online (lo calcula el servidor) */
  elo: number;
  /** ELO de la liga contra la IA */
  eloIA: number;
  eloPeak: number;
  week: string;
  weekGain: number;
  festival: Record<string, number>;
  achievements: Record<string, number>;
  tutorial: boolean;
}

export function newProfile(name: string): Profile {
  const byClass = Object.fromEntries(CLASS_IDS.map((c) => [c, { matches: 0, wins: 0, kills: 0 }])) as Record<ClassId, ClassStat>;
  return {
    name,
    createdAt: Date.now(),
    xp: 0,
    coins: 300,
    owned: defaultOwned(),
    equip: { skins: {}, fx: 'clasico', emotes: [1, 2, 3, 1] },
    favorite: 'tanque',
    stats: {
      matches: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      caps: 0,
      returns: 0,
      defends: 0,
      damage: 0,
      heal: 0,
      blocks: 0,
      playTime: 0,
      bestStreak: 0,
      byClass,
    },
    history: [],
    elo: ELO.start,
    eloIA: ELO.start,
    eloPeak: ELO.start,
    week: weekKey(Date.now()),
    weekGain: 0,
    festival: {},
    achievements: {},
    tutorial: false,
  };
}

/** Repara perfiles viejos o incompletos. */
export function normalizeProfile(p: Partial<Profile> & { name?: string }): Profile {
  const base = newProfile(p.name ?? 'Jugador');
  const out: Profile = {
    ...base,
    ...p,
    equip: { ...base.equip, ...(p.equip ?? {}) },
    stats: { ...base.stats, ...(p.stats ?? {}), byClass: { ...base.stats.byClass, ...(p.stats?.byClass ?? {}) } },
  } as Profile;
  for (const k of defaultOwned()) if (!out.owned.includes(k)) out.owned.push(k);
  if (out.week !== weekKey(Date.now())) {
    out.week = weekKey(Date.now());
    out.weekGain = 0;
  }
  return out;
}

export function weekKey(t: number): string {
  const d = new Date(t);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  return monday.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Logros
// ---------------------------------------------------------------------------

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  reward: number;
  check: (p: Profile, last?: MatchSummary) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'tutorial', name: 'Recluta', desc: 'Completá el tutorial.', reward: 50, check: (p) => p.tutorial },
  { id: 'primera', name: 'Primera Victoria', desc: 'Ganá tu primera partida.', reward: 100, check: (p) => p.stats.wins >= 1 },
  { id: 'veterano', name: 'Veterano', desc: 'Jugá 25 partidas.', reward: 200, check: (p) => p.stats.matches >= 25 },
  { id: 'ganador10', name: 'Diez de Diez', desc: 'Ganá 10 partidas.', reward: 250, check: (p) => p.stats.wins >= 10 },
  { id: 'capturador', name: 'Ladrón de Banderas', desc: 'Capturá 10 banderas.', reward: 200, check: (p) => p.stats.caps >= 10 },
  { id: 'demoledor', name: 'Demoledor', desc: 'Rompé 200 bloques.', reward: 150, check: (p) => p.stats.blocks >= 200 },
  { id: 'verdugo', name: 'Verdugo', desc: 'Conseguí 100 eliminaciones.', reward: 300, check: (p) => p.stats.kills >= 100 },
  { id: 'sanador', name: 'Ángel de la Guarda', desc: 'Curá 2000 puntos de vida.', reward: 150, check: (p) => p.stats.heal >= 2000 },
  { id: 'guardian', name: 'Guardián', desc: 'Recuperá 15 banderas.', reward: 150, check: (p) => p.stats.returns >= 15 },
  { id: 'racha', name: 'Imparable', desc: 'Lográ una racha de 5 eliminaciones.', reward: 150, check: (p) => p.stats.bestStreak >= 5 },
  { id: 'intocable', name: 'Intocable', desc: 'Ganá una partida sin morir.', reward: 150, check: (_p, m) => !!m && m.result === 'win' && m.deaths === 0 && m.mode !== 'tutorial' },
  { id: 'polivalente', name: 'Polivalente', desc: 'Ganá al menos una partida con cada clase.', reward: 400, check: (p) => CLASS_IDS.every((c) => p.stats.byClass[c].wins > 0) },
  { id: 'nivel10', name: 'Nivel 10', desc: 'Llegá al nivel 10.', reward: 250, check: (p) => levelFromXp(p.xp).level >= 10 },
  { id: 'coleccionista', name: 'Coleccionista', desc: 'Conseguí 20 cosméticos.', reward: 200, check: (p) => p.owned.length >= 20 },
  { id: 'festival', name: 'Campeón del Festival', desc: 'Superá los 12 niveles del Festival.', reward: 500, check: (p) => Object.keys(p.festival).filter((k) => p.festival[k] > 0).length >= 12 },
  { id: 'estrellas', name: 'Todas las Estrellas', desc: 'Conseguí las 36 estrellas del Festival.', reward: 1000, check: (p) => Object.values(p.festival).reduce((a, b) => a + b, 0) >= 36 },
];

// ---------------------------------------------------------------------------
// Aplicar el resultado de una partida
// ---------------------------------------------------------------------------

export interface MatchSummary {
  mode: ModeId;
  map: MapId;
  cls: ClassId;
  result: 'win' | 'lose' | 'draw';
  kills: number;
  deaths: number;
  assists: number;
  caps: number;
  returns: number;
  defends: number;
  dmg: number;
  heal: number;
  blocks: number;
  points: number;
  roundWins: number;
  duration: number;
  bestStreak: number;
  online: boolean;
  /** dificultad de los bots (partidas offline) */
  difficulty?: Difficulty;
  /** fracción de los puntos del equipo que aportó el jugador */
  pointsShare: number;
  /** ELO promedio del equipo propio/rival (online) */
  teamElo?: number;
  enemyElo?: number;
  /** delta de ELO calculado por el servidor (online) */
  eloDelta?: number;
  festival?: number;
  festivalStars?: number;
  festivalReward?: number;
}

export interface MatchRewards {
  xp: number;
  coins: number;
  levelBefore: number;
  levelAfter: number;
  xpBefore: number;
  newItems: string[];
  achievements: string[];
  eloDelta: number;
  eloKind: 'online' | 'ia' | 'none';
  festivalStarsNew: number;
}

export function applyMatch(p: Profile, m: MatchSummary): MatchRewards {
  const levelBefore = levelFromXp(p.xp).level;
  const xpBefore = p.xp;
  const newItems: string[] = [];
  const achievements: string[] = [];
  let xp = 0;
  let coins = 0;
  let elo = 0;
  let eloKind: MatchRewards['eloKind'] = 'none';
  let festivalStarsNew = 0;

  if (m.mode === 'tutorial') {
    if (!p.tutorial) {
      p.tutorial = true;
      xp = 100;
      coins = 50;
    }
  } else {
    const r = computeRewards({
      won: m.result === 'win',
      draw: m.result === 'draw',
      kills: m.kills,
      assists: m.assists,
      caps: m.caps,
      defends: m.defends,
      returns: m.returns,
      roundWins: m.roundWins,
    });
    xp = r.xp;
    coins = r.coins;
    // estadísticas
    const s = p.stats;
    s.matches++;
    if (m.result === 'win') s.wins++;
    else if (m.result === 'lose') s.losses++;
    else s.draws++;
    s.kills += m.kills;
    s.deaths += m.deaths;
    s.assists += m.assists;
    s.caps += m.caps;
    s.returns += m.returns;
    s.defends += m.defends;
    s.damage += m.dmg;
    s.heal += Math.round(m.heal);
    s.blocks += m.blocks;
    s.playTime += m.duration;
    s.bestStreak = Math.max(s.bestStreak, m.bestStreak);
    const cs = s.byClass[m.cls];
    cs.matches++;
    if (m.result === 'win') cs.wins++;
    cs.kills += m.kills;

    // ELO
    const resNum = m.result === 'win' ? 1 : m.result === 'draw' ? 0.5 : 0;
    if (m.online) {
      if (m.eloDelta !== undefined) {
        elo = m.eloDelta;
      } else if (m.teamElo !== undefined && m.enemyElo !== undefined) {
        elo = eloDelta(m.teamElo, m.enemyElo, resNum as 1 | 0.5 | 0, m.pointsShare);
      }
      p.elo = Math.max(100, p.elo + elo);
      p.eloPeak = Math.max(p.eloPeak, p.elo);
      eloKind = 'online';
    } else if (m.difficulty !== undefined && !m.festival) {
      elo = eloDelta(p.eloIA, ELO.botRating[m.difficulty], resNum as 1 | 0.5 | 0, m.pointsShare);
      p.eloIA = Math.max(100, p.eloIA + elo);
      eloKind = 'ia';
    }
    const wk = weekKey(Date.now());
    if (p.week !== wk) {
      p.week = wk;
      p.weekGain = 0;
    }
    if (eloKind !== 'none') p.weekGain += elo;

    // festival
    if (m.festival) {
      const key = String(m.festival);
      const prevStars = p.festival[key] ?? 0;
      const stars = m.festivalStars ?? 0;
      if (stars > prevStars) {
        festivalStarsNew = stars - prevStars;
        p.festival[key] = stars;
        if (prevStars === 0 && stars > 0) coins += m.festivalReward ?? 0;
        coins += festivalStarsNew * 25;
      }
    }
  }

  p.xp += xp;
  p.coins += coins;
  const levelAfter = levelFromXp(p.xp).level;
  for (let l = levelBefore + 1; l <= levelAfter; l++) {
    p.coins += PROGRESSION.coins.perLevel;
    coins += PROGRESSION.coins.perLevel;
    const item = LEVEL_REWARDS[l];
    if (item && !p.owned.includes(item)) {
      p.owned.push(item);
      newItems.push(item);
    }
  }

  // historial
  if (m.mode !== 'tutorial') {
    p.history.unshift({
      date: Date.now(),
      mode: m.mode,
      map: m.map,
      cls: m.cls,
      result: m.result,
      kills: m.kills,
      deaths: m.deaths,
      assists: m.assists,
      caps: m.caps,
      points: m.points,
      xp,
      coins,
      elo,
      online: m.online,
      festival: m.festival,
    });
    if (p.history.length > 40) p.history.length = 40;
  }

  // logros
  for (const a of ACHIEVEMENTS) {
    if (p.achievements[a.id]) continue;
    if (a.check(p, m)) {
      p.achievements[a.id] = Date.now();
      p.coins += a.reward;
      coins += a.reward;
      achievements.push(a.id);
    }
  }

  return { xp, coins, levelBefore, levelAfter, xpBefore, newItems, achievements, eloDelta: elo, eloKind, festivalStarsNew };
}

/** Compra validada (misma regla en cliente y servidor). */
export function buyItem(p: Profile, key: string, price: number): { ok: boolean; error?: string } {
  if (p.owned.includes(key)) return { ok: false, error: 'Ya tenés este ítem.' };
  if (p.coins < price) return { ok: false, error: 'No te alcanzan las monedas.' };
  p.coins -= price;
  p.owned.push(key);
  return { ok: true };
}

export function equipItem(p: Profile, key: string, slot?: number): { ok: boolean; error?: string } {
  if (!p.owned.includes(key)) return { ok: false, error: 'No tenés este ítem.' };
  const [kind, a, b] = key.split(':');
  if (kind === 'skin') p.equip.skins[a as ClassId] = b;
  else if (kind === 'fx') p.equip.fx = a;
  else if (kind === 'emote') {
    const s = Math.max(0, Math.min(3, slot ?? 0));
    p.equip.emotes[s] = Number(a);
  }
  return { ok: true };
}
