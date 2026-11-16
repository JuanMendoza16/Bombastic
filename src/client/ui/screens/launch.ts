// Atajos para lanzar partidas locales.
import type { FestivalLevel } from '../../data/festival';
import { LocalSession } from '../../game/session';
import { buildConfig, tutorialConfig, type MatchSetup } from '../../game/setup';
import { profiles } from '../../services/profile';
import { settings } from '../../services/settings';
import { nav } from '../nav';
import type { GameLaunch } from './game';

export function startTutorial() {
  const p = profiles.profile;
  settings.set({ seenTutorial: true });
  const cls = p.favorite;
  const cfg = tutorialConfig({ name: p.name, cls, skin: profiles.skinFor(cls), fx: p.equip.fx, team: 0 });
  const launch: GameLaunch = { session: new LocalSession(cfg), tutorial: true };
  nav.go('game', { launch });
}

export function startLocal(setup: MatchSetup, festival?: FestivalLevel) {
  const launch: GameLaunch = { session: new LocalSession(buildConfig(setup)), setup, festival };
  nav.replace('game', { launch });
}

export function festivalSetup(level: FestivalLevel, human: MatchSetup['humans'][number]): MatchSetup {
  return {
    mode: level.mode,
    map: level.map,
    teamSize: level.teamSize,
    difficulty: level.difficulty,
    humans: [human],
    timeLimit: level.timeLimit,
    scoreLimit: level.scoreLimit,
    powerups: level.powerups,
    festival: level.n,
    mods: level.mods,
    enemyClasses: level.enemyClasses,
  };
}
