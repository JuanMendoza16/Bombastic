import { useEffect, useReducer, useState } from 'preact/hooks';
import { profiles } from '../services/profile';
import { settings, type Settings } from '../services/settings';
import type { Profile } from '../../shared/profile';

export function useProfile(): Profile {
  const [, force] = useReducer((x: number, _a: number) => x + 1, 0);
  useEffect(() => profiles.subscribe(() => force(0)), []);
  return profiles.profile;
}

export function useUser() {
  const [, force] = useReducer((x: number, _a: number) => x + 1, 0);
  useEffect(() => profiles.subscribe(() => force(0)), []);
  return profiles.user;
}

export function useSettings(): Settings {
  const [s, setS] = useState(settings.get());
  useEffect(() => settings.subscribe(setS), []);
  return s;
}

/** Re-render periódico (para HUD y animaciones de UI). */
export function useTicker(ms: number) {
  const [, force] = useReducer((x: number, _a: number) => x + 1, 0);
  useEffect(() => {
    const id = setInterval(() => force(0), ms);
    return () => clearInterval(id);
  }, [ms]);
}
