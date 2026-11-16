// Componente raíz: enruta entre pantallas.
import { useEffect, useState } from 'preact/hooks';
import { audio } from '../audio/audio';
import { api } from '../services/api';
import { profiles } from '../services/profile';
import { settings } from '../services/settings';
import { Toasts } from './common';
import { nav, useRoute } from './nav';
import { GameScreen, type GameLaunch } from './screens/game';
import { MainMenu, Splash, Title } from './screens/menu';
import { CharSelect, PlayScreen } from './screens/play';
import { FestivalScreen } from './screens/festival';
import { ShopScreen, LockerScreen } from './screens/shop';
import { ProfileScreen } from './screens/profile';
import { RankingScreen } from './screens/ranking';
import { SettingsScreen } from './screens/settings';
import { CreditsScreen, CharactersScreen } from './screens/info';
import { OnlineScreen, RoomScreen } from './screens/online';
import { AuthScreen } from './screens/auth';
import { AdminScreen } from './screens/admin';

const launchKeys = new WeakMap<object, number>();
let launchSeq = 1;
function launchKey(l: unknown): string {
  if (!l || typeof l !== 'object') return 'none';
  let k = launchKeys.get(l);
  if (!k) {
    k = launchSeq++;
    launchKeys.set(l, k);
  }
  return String(k);
}

export function App() {
  const route = useRoute();
  const [announcement, setAnnouncement] = useState<string | null>(null);

  useEffect(() => {
    const loadStatus = () => {
      void api<{ announcementEnabled: boolean; announcementText: string }>('GET', '/api/status')
        .then((s) => setAnnouncement(s.announcementEnabled && s.announcementText ? s.announcementText : null))
        .catch(() => {});
    };
    loadStatus();
    const statusTimer = setInterval(loadStatus, 60000);
    if (typeof window !== 'undefined' && (window.location.pathname.startsWith('/nueva-version') || window.location.hash.includes('nueva-version'))) {
      if (nav.current.id === 'splash') nav.replace('title');
    }
    const apply = () => {
      const s = settings.get();
      audio.setVolumes(s.master, s.music, s.sfx);
      document.body.classList.toggle('reduce-motion', s.reducedMotion);
    };
    apply();
    const off = settings.subscribe(apply);
    void profiles.init();
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      clearInterval(statusTimer);
      off();
    };
  }, []);

  const p = route.params ?? {};
  let screen;
  switch (route.id) {
    case 'splash':
      screen = <Splash />;
      break;
    case 'title':
      screen = <Title />;
      break;
    case 'menu':
      screen = <MainMenu />;
      break;
    case 'play':
      screen = <PlayScreen />;
      break;
    case 'charselect':
      screen = <CharSelect params={p} key={JSON.stringify(p.festival ?? '')} />;
      break;
    case 'game':
      screen = <GameScreen launch={p.launch as GameLaunch} key={launchKey(p.launch)} />;
      break;
    case 'festival':
      screen = <FestivalScreen />;
      break;
    case 'online':
      screen = <OnlineScreen />;
      break;
    case 'room':
      screen = <RoomScreen params={p} />;
      break;
    case 'characters':
      screen = <CharactersScreen />;
      break;
    case 'shop':
      screen = <ShopScreen />;
      break;
    case 'locker':
      screen = <LockerScreen />;
      break;
    case 'profile':
      screen = <ProfileScreen />;
      break;
    case 'ranking':
      screen = <RankingScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'credits':
      screen = <CreditsScreen />;
      break;
    case 'auth':
      screen = <AuthScreen params={p} />;
      break;
    case 'admin':
      screen = <AdminScreen />;
      break;
    default:
      screen = <MainMenu />;
  }
  return (
    <>
      {announcement && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 9999,
            background: 'linear-gradient(90deg,#ffb13b,#ff7b3b)',
            color: '#1b1026',
            fontWeight: 700,
            textAlign: 'center',
            padding: '6px 12px',
            fontSize: '0.9rem',
          }}
        >
          📢 {announcement}
        </div>
      )}
      {screen}
      <Toasts />
    </>
  );
}

export { nav };
