// Splash del estudio, pantalla de título y menú principal.
import type { JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { CLASSES } from '../../../shared/balance';
import { CLASS_IDS, type ClassId } from '../../../shared/types';
import { audio } from '../../audio/audio';
import { bannerURL, onAssetsChange, portraitURL } from '../../gfx/sprites';
import { profiles } from '../../services/profile';
import { settings } from '../../services/settings';
import { Backdrop, Btn, Coins, Logo, MenuIcon, type MenuIconName, ProfileChip, StudioLogo } from '../common';
import { useProfile, useUser } from '../hooks';
import { nav, type ScreenId } from '../nav';
import { startTutorial } from './launch';

const DOCK_ITEMS: { screen: ScreenId; icon: MenuIconName; label: string; accent: string }[] = [
  { screen: 'characters', icon: 'characters', label: 'Personajes', accent: '#5ff2ff' },
  { screen: 'locker', icon: 'locker', label: 'Personalizar', accent: '#ff7ae5' },
  { screen: 'shop', icon: 'shop', label: 'Tienda', accent: '#ffd23f' },
  { screen: 'ranking', icon: 'ranking', label: 'Ranking', accent: '#ff9e2c' },
  { screen: 'profile', icon: 'profile', label: 'Perfil', accent: '#6fb0ff' },
  { screen: 'credits', icon: 'credits', label: 'Créditos', accent: '#3cff9a' },
];

export function Splash() {
  useEffect(() => {
    const t = setTimeout(() => nav.replace('title'), 2600);
    return () => clearTimeout(t);
  }, []);
  return (
    <div class="splash" onClick={() => nav.replace('title')}>
      <StudioLogo />
      <div class="studio-name">PIXELFORGE STUDIOS</div>
      <div class="studio-sub">PRESENTA</div>
    </div>
  );
}

export function Title() {
  useEffect(() => {
    const go = () => {
      audio.unlock();
      audio.play('click');
      audio.playMusic('menu');
      nav.replace('menu');
    };
    const k = (e: KeyboardEvent) => {
      if (e.repeat) return;
      go();
    };
    const t = setTimeout(() => {
      window.addEventListener('keydown', k);
      window.addEventListener('pointerdown', go);
    }, 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener('keydown', k);
      window.removeEventListener('pointerdown', go);
    };
  }, []);
  const heroes: ClassId[] = ['tanque', 'veloz', 'distancia', 'support', 'defensor', 'controlador'];
  return (
    <div class="screen" style={{ alignItems: 'center', justifyContent: 'center', gap: '30px' }}>
      <Backdrop />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '34px' }}>
        <Logo />
        <div class="row" style={{ gap: '4px' }}>
          {heroes.map((h, i) => (
            <img key={h} src={portraitURL(h, 'base', 'idle', 0, 2)} style={{ width: 'clamp(56px, 9vw, 110px)', imageRendering: 'pixelated', animation: `hero-float ${2.4 + i * 0.2}s ease-in-out infinite` }} alt={CLASSES[h].hero} />
          ))}
        </div>
        <div class="press-start">Presioná cualquier tecla para empezar</div>
      </div>
      <div style={{ position: 'absolute', bottom: '12px', fontSize: '13px', zIndex: 2 }} class="muted">
        © 2026 PixelForge Studios · Proyecto Final · v{__APP_VERSION__}
      </div>
    </div>
  );
}

export function MainMenu() {
  const p = useProfile();
  const user = useUser();
  const [hero, setHero] = useState<ClassId>(p.favorite);
  const [heroAnim, setHeroAnim] = useState(0);
  const [, setVer] = useState(0);
  useEffect(() => {
    audio.playMusic('menu');
    const id = setInterval(() => setHeroAnim((a) => a + 1), 180);
    const off = onAssetsChange(() => setVer((v) => v + 1));
    return () => {
      clearInterval(id);
      off();
    };
  }, []);
  const tutorialPending = !p.tutorial && !settings.get().seenTutorial;
  const c = CLASSES[hero];
  return (
    <div class="screen">
      <Backdrop />
      <div class="topbar">
        <ProfileChip />
        <div class="spacer" />
        <button type="button" class="panel topbar-coins-btn" onClick={() => nav.go('shop')} aria-label="Ir a la Tienda" data-tip="Tienda" title="Tienda">
          <Coins n={p.coins} />
        </button>
        {user ? (
          <Btn variant="ghost" size="small" class="topbar-auth-btn" onClick={() => nav.go('profile')}>
            👤 {user.username}
          </Btn>
        ) : (
          <Btn variant="ghost" size="small" class="topbar-auth-btn" onClick={() => nav.go('auth')}>
            Iniciar sesión
          </Btn>
        )}
        <Btn
          variant="ghost"
          size="small"
          class="icon-dock-btn topbar-icon-btn"
          style={{ '--dock-accent': '#ffd23f' } as JSX.CSSProperties}
          onClick={() => nav.go('settings')}
          aria-label="Ajustes"
          data-tip="Ajustes"
          title="Ajustes"
        >
          <MenuIcon name="settings" size={22} />
        </Btn>
      </div>
      <div class="menu-layout">
        <div class="menu-brand">
          <Logo size={96} />
          <div class="menu-buttons">
            <Btn size="big" class="menu-play-cta" onClick={() => nav.go('play')}>
              <span class="cta-play-badge" aria-hidden="true">▶</span>
              <span>JUGAR</span>
            </Btn>
            <div class="menu-modes-row">
              <Btn variant="purple" class="menu-mode-btn" onClick={() => nav.go('festival')}>
                <span class="mode-btn-ico" aria-hidden="true">★</span>
                <span>FESTIVAL</span>
              </Btn>
              <Btn variant="blue" class="menu-mode-btn" onClick={() => nav.go('online')}>
                <span class="mode-btn-ico" aria-hidden="true">🌐</span>
                <span>ONLINE</span>
              </Btn>
              <Btn variant={tutorialPending ? 'green' : 'blue'} class="menu-mode-btn tutorial-btn" onClick={() => startTutorial()}>
                <span class="mode-btn-ico" aria-hidden="true">📘</span>
                <span>TUTORIAL</span>
                {tutorialPending && <span class="tag mode-new-pill">¡Nuevo!</span>}
              </Btn>
            </div>
            <div class="menu-divider">Accesos</div>
            <div class="menu-icon-dock" role="toolbar" aria-label="Accesos rápidos">
              {DOCK_ITEMS.map((item) => (
                <Btn
                  key={item.screen}
                  variant="ghost"
                  class="icon-dock-btn"
                  style={{ '--dock-accent': item.accent } as JSX.CSSProperties}
                  onClick={() => nav.go(item.screen)}
                  aria-label={item.label}
                  data-tip={item.label}
                  title={item.label}
                >
                  <MenuIcon name={item.icon} size={26} />
                </Btn>
              ))}
            </div>
          </div>
        </div>
        <div class="hero-stage">
          <div class="hero-showcase">
            <img class="hero-poster-card" src={bannerURL(hero, profiles.skinFor(hero), 'poster')} alt={c.hero} />
            <img class="hero-pixel-char" src={portraitURL(hero, profiles.skinFor(hero), heroAnim % 12 < 6 ? 'idle' : 'win', heroAnim % 4, 4)} alt={c.hero} />
          </div>
          <div class="pedestal" />
          <div class="panel hero-namecard">
            <div class="showcase-title" style={{ color: c.color }}>
              {c.hero}
            </div>
            <div class="muted">
              {c.className} · {c.role}
            </div>
            <div class="hero-quick-strip">
              {CLASS_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  class={`hero-quick-btn ${id === hero ? 'sel' : ''}`}
                  style={{ '--hc': CLASSES[id].color } as JSX.CSSProperties}
                  onClick={() => {
                    audio.play('click');
                    setHero(id);
                    void profiles.setFavorite(id);
                  }}
                  aria-label={CLASSES[id].hero}
                  aria-pressed={id === hero}
                  data-tip={CLASSES[id].hero}
                  title={CLASSES[id].hero}
                >
                  <img src={portraitURL(id, profiles.skinFor(id), 'idle', 0, 1)} alt="" />
                  {id === hero && <span class="hero-quick-check" aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
