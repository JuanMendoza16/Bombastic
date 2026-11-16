// Construcción de la configuración de una partida local (jugadores humanos + bots).
import { BOT_NAMES } from '../../shared/ai';
import { MODES } from '../../shared/balance';
import { CLASS_IDS, type ClassId, type Difficulty, type MapId, type MatchConfig, type MatchMods, type ModeId, type PlayerSlot } from '../../shared/types';

export interface HumanSetup {
  name: string;
  cls: ClassId;
  skin: string;
  fx: string;
  team: number;
}

export interface MatchSetup {
  mode: ModeId;
  map: MapId;
  teamSize: number;
  difficulty: Difficulty;
  humans: HumanSetup[];
  powerups?: boolean;
  timeLimit?: number;
  scoreLimit?: number;
  festival?: number;
  mods?: MatchMods;
  /** clases forzadas para bots enemigos (festival) */
  enemyClasses?: ClassId[];
  allyClasses?: ClassId[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildConfig(setup: MatchSetup): MatchConfig {
  const mode = MODES[setup.mode];
  const slots: PlayerSlot[] = [];
  let id = 1;
  const names = shuffle(BOT_NAMES);
  let ni = 0;
  if (mode.teams) {
    for (let team = 0; team < 2; team++) {
      const humans = setup.humans.filter((h) => h.team === team);
      const used = new Set<ClassId>(humans.map((h) => h.cls));
      humans.forEach((h) => {
        slots.push({ id: id++, name: h.name, team, cls: h.cls, skin: h.skin, fx: h.fx, bot: false, difficulty: setup.difficulty, local: setup.humans.indexOf(h) });
      });
      const forced = team === 0 ? setup.allyClasses : setup.enemyClasses;
      const pool = shuffle(CLASS_IDS.filter((c) => !used.has(c)));
      let k = 0;
      for (let i = humans.length; i < setup.teamSize; i++) {
        let cls: ClassId = forced?.[i - humans.length] ?? pool[k++ % pool.length];
        if (!forced && used.has(cls)) cls = pool[k++ % pool.length];
        used.add(cls);
        slots.push({ id: id++, name: names[ni++ % names.length], team, cls, skin: 'base', fx: 'clasico', bot: true, difficulty: setup.difficulty });
      }
    }
  } else {
    setup.humans.forEach((h, i) => {
      slots.push({ id: id++, name: h.name, team: i, cls: h.cls, skin: h.skin, fx: h.fx, bot: false, difficulty: setup.difficulty, local: i });
    });
    const total = Math.max(2, Math.min(6, setup.teamSize));
    const pool = shuffle(CLASS_IDS);
    let k = 0;
    for (let i = setup.humans.length; i < total; i++) {
      const cls = setup.enemyClasses?.[i - setup.humans.length] ?? pool[k++ % pool.length];
      slots.push({ id: id++, name: names[ni++ % names.length], team: i, cls, skin: 'base', fx: 'clasico', bot: true, difficulty: setup.difficulty });
    }
  }
  return {
    mode: setup.mode,
    map: setup.map,
    slots,
    timeLimit: setup.timeLimit ?? mode.defaultTime,
    scoreLimit: setup.scoreLimit ?? mode.defaultScore,
    powerups: setup.powerups ?? mode.powerups,
    seed: (Math.random() * 2 ** 31) | 0,
    festival: setup.festival,
    mods: setup.mods,
  };
}

export function tutorialConfig(human: HumanSetup): MatchConfig {
  return {
    mode: 'tutorial',
    map: 'tutorial',
    timeLimit: 0,
    scoreLimit: 1,
    powerups: false,
    seed: 7,
    slots: [
      { id: 1, name: human.name, team: 0, cls: human.cls, skin: human.skin, fx: human.fx, bot: false, difficulty: 1, local: 0 },
      { id: 2, name: 'Muñeco de práctica', team: 1, cls: 'tanque', skin: 'base', fx: 'clasico', bot: true, difficulty: 0 },
    ],
  };
}
