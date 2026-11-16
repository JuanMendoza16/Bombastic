// Componentes comunes de la interfaz.
import type { ComponentChildren, JSX } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { levelFromXp, TEAM_COLORS } from '../../shared/balance';
import { RARITY, type Rarity } from '../../shared/catalog';
import { MAPS, parseMap } from '../../shared/maps';
import { Tile, type MapId } from '../../shared/types';
import { audio } from '../audio/audio';
import { Sprites, logoURL, onAssetsChange } from '../gfx/sprites';
import { T } from '../gfx/tiles';
import { useProfile, useUser } from './hooks';
import { nav } from './nav';

// ---------------------------------------------------------------------------
// Botón con sonido
// ---------------------------------------------------------------------------

interface BtnProps extends Omit<JSX.HTMLAttributes<HTMLButtonElement>, 'class' | 'size'> {
  variant?: 'yellow' | 'blue' | 'red' | 'green' | 'purple' | 'ghost';
  size?: 'small' | 'big';
  sound?: 'click' | 'back' | 'none';
  class?: string;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export function Btn({ variant = 'yellow', size, sound = 'click', class: cls = '', onClick, children, ...rest }: BtnProps) {
  return (
    <button
      {...rest}
      class={`btn ${variant === 'yellow' ? '' : variant} ${size ?? ''} ${cls}`}
      onMouseEnter={() => audio.play('hover')}
      onClick={(e) => {
        audio.unlock();
        if (sound !== 'none') audio.play(sound);
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Fondo animado con bombas flotando
// ---------------------------------------------------------------------------

export function Backdrop() {
  const floaters = useMemo(() => {
    const items: { left: number; size: number; dur: number; delay: number; src: string }[] = [];
    const bomb = Sprites.bomb(0, false).toDataURL();
    const flags = [Sprites.flag('#3d8bff', 0).toDataURL(), Sprites.flag('#ff4d5e', 2).toDataURL()];
    for (let i = 0; i < 14; i++) {
      items.push({
        left: Math.random() * 100,
        size: 28 + Math.random() * 40,
        dur: 14 + Math.random() * 16,
        delay: -Math.random() * 30,
        src: i % 5 === 0 ? flags[i % 2] : bomb,
      });
    }
    return items;
  }, []);
  return (
    <div class="backdrop">
      {floaters.map((f, i) => (
        <img
          key={i}
          class="floater"
          src={f.src}
          style={{ left: `${f.left}%`, width: `${f.size}px`, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s` }}
          alt=""
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Logo animado BOMBERMAN
// ---------------------------------------------------------------------------

function FlagGlyph({ color = '#3d8bff' }: { color?: string }) {
  return (
    <svg class="logo-flag" viewBox="0 0 40 40" aria-hidden="true">
      <rect x="6" y="3" width="4" height="34" rx="2" fill="#e6e1ee" stroke="#1a1026" stroke-width="2" />
      <path d="M10 5 Q20 1 26 6 T36 7 L36 21 Q30 18 24 22 T10 20 Z" fill={color} stroke="#1a1026" stroke-width="2.5" stroke-linejoin="round">
        <animate attributeName="d" dur="1.2s" repeatCount="indefinite" values="M10 5 Q20 1 26 6 T36 7 L36 21 Q30 18 24 22 T10 20 Z;M10 5 Q20 9 26 5 T36 5 L36 19 Q30 24 24 20 T10 20 Z;M10 5 Q20 1 26 6 T36 7 L36 21 Q30 18 24 22 T10 20 Z" />
      </path>
    </svg>
  );
}

export function Logo({ size, ribbon = true }: { size?: number; ribbon?: boolean }) {
  const [, setVer] = useState(0);
  useEffect(() => onAssetsChange(() => setVer((v) => v + 1)), []);
  const w = size ? Math.round(size * 5.2) : 440;
  return (
    <div class="logo pixel-logo">
      <img class="logo-img" src={logoURL()} style={{ maxWidth: `min(${w}px, 88vw)` }} alt="Blast & Banner" />
      {ribbon && (
        <div class="logo-ribbon">
          <FlagGlyph color={TEAM_COLORS[0]} />
          NUEVA VERSIÓN · BATTLE ARENA
          <FlagGlyph color={TEAM_COLORS[1]} />
        </div>
      )}
    </div>
  );
}

/** Logo del estudio (boceto de G5: bandera entre llaves). */
export function StudioLogo() {
  return (
    <svg class="studio-logo" viewBox="0 0 200 180" aria-label="PixelForge Studios">
      <path d="M52 20 Q30 22 32 50 L34 76 Q34 88 20 90 Q34 92 34 104 L32 130 Q30 158 52 160" fill="none" stroke="#1a1026" stroke-width="16" stroke-linecap="round" />
      <path d="M52 20 Q30 22 32 50 L34 76 Q34 88 20 90 Q34 92 34 104 L32 130 Q30 158 52 160" fill="none" stroke="#c46bff" stroke-width="9" stroke-linecap="round" />
      <path d="M148 20 Q170 22 168 50 L166 76 Q166 88 180 90 Q166 92 166 104 L168 130 Q170 158 148 160" fill="none" stroke="#1a1026" stroke-width="16" stroke-linecap="round" />
      <path d="M148 20 Q170 22 168 50 L166 76 Q166 88 180 90 Q166 92 166 104 L168 130 Q170 158 148 160" fill="none" stroke="#c46bff" stroke-width="9" stroke-linecap="round" />
      <ellipse cx="100" cy="140" rx="36" ry="9" fill="#35215c" stroke="#1a1026" stroke-width="5" />
      <path d="M98 140 L112 46" stroke="#1a1026" stroke-width="10" stroke-linecap="round" />
      <path d="M98 140 L112 46" stroke="#e6e1ee" stroke-width="5" stroke-linecap="round" />
      <circle cx="113" cy="42" r="7" fill="#ffd23f" stroke="#1a1026" stroke-width="4" />
      <path d="M110 52 Q90 40 72 54 Q84 66 76 86 Q94 74 106 86 Z" fill="#ff8a1a" stroke="#1a1026" stroke-width="5" stroke-linejoin="round">
        <animate attributeName="d" dur="1.4s" repeatCount="indefinite" values="M110 52 Q90 40 72 54 Q84 66 76 86 Q94 74 106 86 Z;M110 52 Q92 48 72 50 Q80 68 74 84 Q94 80 106 86 Z;M110 52 Q90 40 72 54 Q84 66 76 86 Q94 74 106 86 Z" />
      </path>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Pequeños componentes
// ---------------------------------------------------------------------------

export function Coins({ n }: { n: number }) {
  return (
    <span class="coins">
      <i class="coin" />
      {n.toLocaleString('es-AR')}
    </span>
  );
}

export function ProfileChip() {
  const p = useProfile();
  const user = useUser();
  const lv = levelFromXp(p.xp);
  return (
    <div class="panel profile-chip" onClick={() => nav.go('profile')} title="Ver perfil">
      <div class="lvl-badge">{lv.level}</div>
      <div class="profile-chip-body">
        <div class="profile-chip-name">
          <span>{p.name}</span>
          {user ? <span class="tag">ONLINE</span> : null}
        </div>
        <div class="bar" style={{ marginTop: '4px' }}>
          <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
        </div>
        <div class="muted" style={{ fontSize: '12px', marginTop: '2px' }}>
          {lv.into} / {lv.need} XP
        </div>
      </div>
    </div>
  );
}

export type MenuIconName =
  | 'characters'
  | 'locker'
  | 'shop'
  | 'ranking'
  | 'profile'
  | 'credits'
  | 'settings'
  | 'back'
  | 'rules'
  | 'players1'
  | 'players2'
  | 'powerups'
  | 'festival'
  | 'online'
  | 'tutorial';

export function MenuIcon({ name, size = 24 }: { name: MenuIconName; size?: number }) {
  const s = '#120820';
  return (
    <svg class="menu-svg-ico" viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      {name === 'festival' && (
        <>
          <path d="M12 2.5L14.9 8.4L21.4 9.3L16.7 13.9L17.8 20.4L12 17.3L6.2 20.4L7.3 13.9L2.6 9.3L9.1 8.4L12 2.5Z" fill="#ffd23f" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
        </>
      )}
      {name === 'online' && (
        <>
          <circle cx="12" cy="12" r="9" fill="#5ff2ff" stroke={s} stroke-width="1.8" />
          <ellipse cx="12" cy="12" rx="4.2" ry="9" fill="none" stroke={s} stroke-width="1.5" />
          <path d="M3.5 9.5H20.5M3.5 14.5H20.5" stroke={s} stroke-width="1.5" />
        </>
      )}
      {name === 'tutorial' && (
        <>
          <path d="M5 4.5C5 3.4 5.9 2.5 7 2.5H19V19.5H7C5.9 19.5 5 18.6 5 17.5V4.5Z" fill="#5ff2ff" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M5 17.5C5 16.4 5.9 15.5 7 15.5H19V20.5H7C5.9 20.5 5 19.6 5 18.5V17.5Z" fill="#fff7e6" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M9 6.5H15.5M9 10H15.5" stroke={s} stroke-width="1.6" stroke-linecap="round" />
        </>
      )}
      {name === 'characters' && (
        <>
          <path d="M12 2L14.5 6H9.5L12 2Z" fill="#ffd23f" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M5 12C5 7.5 8 5.5 12 5.5C16 5.5 19 7.5 19 12V19L15 21H9L5 19V12Z" fill="#e9e4f5" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <path d="M7.5 11.5H16.5V15H13.5L12 13.8L10.5 15H7.5V11.5Z" fill="#5ff2ff" stroke={s} stroke-width="1.6" stroke-linejoin="round" />
          <rect x="9.5" y="17" width="5" height="2.2" fill="#ffd23f" stroke={s} stroke-width="1.2" />
        </>
      )}
      {name === 'locker' && (
        <>
          <path d="M12 3C6.8 3 3 6.8 3 11.5C3 16.5 6.8 20.5 12 20.5C14.3 20.5 15.8 19.3 15.8 17.7C15.8 16.4 14.9 15.6 15.9 14.6C16.7 13.8 18.8 14.1 19.9 12.6C20.7 11.4 20.8 9.2 19.8 7.3C18.3 4.6 15.4 3 12 3Z" fill="#ff7ae5" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <circle cx="8" cy="10" r="1.7" fill="#ffd23f" stroke={s} stroke-width="1.2" />
          <circle cx="12.2" cy="7.3" r="1.7" fill="#5ff2ff" stroke={s} stroke-width="1.2" />
          <circle cx="16.2" cy="9.7" r="1.7" fill="#3cff9a" stroke={s} stroke-width="1.2" />
          <circle cx="8.8" cy="15.2" r="2" fill="#120820" stroke="#fff7e6" stroke-width="1" />
        </>
      )}
      {name === 'shop' && (
        <>
          <path d="M3.5 9.5L5.2 5H18.8L20.5 9.5V19.5H3.5V9.5Z" fill="#ff8a1a" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <rect x="3.5" y="9.5" width="17" height="3" fill="#ffd23f" stroke={s} stroke-width="1.6" />
          <rect x="9.5" y="9.5" width="5" height="5.5" fill="#ffd23f" stroke={s} stroke-width="1.5" />
          <rect x="10.8" y="10.8" width="2.4" height="2.8" fill="#3cff9a" stroke={s} stroke-width="1" />
        </>
      )}
      {name === 'ranking' && (
        <>
          <path d="M4 5H7.5V11C5.2 10.8 4 9.2 4 6.8V5Z" fill="#ff8a1a" stroke={s} stroke-width="1.7" stroke-linejoin="round" />
          <path d="M20 5H16.5V11C18.8 10.8 20 9.2 20 6.8V5Z" fill="#ff8a1a" stroke={s} stroke-width="1.7" stroke-linejoin="round" />
          <path d="M7 4H17V10.5C17 13.6 14.8 15.8 12 15.8C9.2 15.8 7 13.6 7 10.5V4Z" fill="#ffe94d" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <rect x="10.2" y="15.5" width="3.6" height="3" fill="#ff8a1a" stroke={s} stroke-width="1.4" />
          <rect x="7.5" y="18.2" width="9" height="2.8" fill="#ffd23f" stroke={s} stroke-width="1.6" />
          <path d="M12 6.6L12.9 8.5L15 8.8L13.5 10.2L13.9 12.2L12 11.2L10.1 12.2L10.5 10.2L9 8.8L11.1 8.5Z" fill="#fff7e6" />
        </>
      )}
      {name === 'profile' && (
        <>
          <path d="M12 2.8L19.5 5.6V11.8C19.5 16.5 16.2 19.8 12 21.4C7.8 19.8 4.5 16.5 4.5 11.8V5.6L12 2.8Z" fill="#6fb0ff" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <circle cx="12" cy="9.2" r="2.7" fill="#fff7e6" stroke={s} stroke-width="1.5" />
          <path d="M7.6 16.2C8.3 13.8 10 12.8 12 12.8C14 12.8 15.7 13.8 16.4 16.2" fill="#ffd23f" stroke={s} stroke-width="1.6" stroke-linecap="round" />
        </>
      )}
      {name === 'credits' && (
        <>
          <path d="M8.5 14L6.5 21.5L10.5 19.8L12 21.5L13.5 19.8L17.5 21.5L15.5 14" fill="#3cff9a" stroke={s} stroke-width="1.7" stroke-linejoin="round" />
          <path d="M12 2.6L14.6 7.8L20.3 8.6L16.1 12.6L17.1 18.2L12 15.5L6.9 18.2L7.9 12.6L3.7 8.6L9.4 7.8Z" fill="#ffd23f" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <circle cx="12" cy="10.8" r="2" fill="#fff7e6" />
        </>
      )}
      {name === 'settings' && (
        <>
          <path d="M10.2 3H13.8L14.4 5.4C15 5.6 15.6 6 16.1 6.4L18.5 5.5L20.3 8.6L18.4 10.4C18.5 11.1 18.5 11.9 18.4 12.6L20.3 14.4L18.5 17.5L16.1 16.6C15.6 17 15 17.4 14.4 17.6L13.8 20H10.2L9.6 17.6C9 17.4 8.4 17 7.9 16.6L5.5 17.5L3.7 14.4L5.6 12.6C5.5 11.9 5.5 11.1 5.6 10.4L3.7 8.6L5.5 5.5L7.9 6.4C8.4 6 9 5.6 9.6 5.4L10.2 3Z" fill="#e9e4f5" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <circle cx="12" cy="11.5" r="3.2" fill="#ffd23f" stroke={s} stroke-width="1.7" />
        </>
      )}
      {name === 'back' && (
        <>
          <path d="M11.5 5L4.5 12L11.5 19V14.5H19.5V9.5H11.5V5Z" fill="#ffd23f" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <rect x="13" y="11" width="4.5" height="2" fill="#fff7e6" />
        </>
      )}
      {name === 'rules' && (
        <>
          <line x1="4" y1="6.5" x2="20" y2="6.5" stroke="#e9e4f5" stroke-width="2.4" stroke-linecap="round" />
          <line x1="4" y1="12" x2="20" y2="12" stroke="#e9e4f5" stroke-width="2.4" stroke-linecap="round" />
          <line x1="4" y1="17.5" x2="20" y2="17.5" stroke="#e9e4f5" stroke-width="2.4" stroke-linecap="round" />
          <rect x="7" y="4" width="4.2" height="5" fill="#ffd23f" stroke={s} stroke-width="1.6" />
          <rect x="13.5" y="9.5" width="4.2" height="5" fill="#5ff2ff" stroke={s} stroke-width="1.6" />
          <rect x="8.5" y="15" width="4.2" height="5" fill="#3cff9a" stroke={s} stroke-width="1.6" />
        </>
      )}
      {name === 'players1' && (
        <>
          <circle cx="12" cy="7.5" r="3.8" fill="#5ff2ff" stroke={s} stroke-width="1.8" />
          <path d="M5.5 20C5.8 15.6 8.3 13.5 12 13.5C15.7 13.5 18.2 15.6 18.5 20H5.5Z" fill="#5ff2ff" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
          <circle cx="10.8" cy="6.6" r="1" fill="#fff7e6" />
        </>
      )}
      {name === 'players2' && (
        <>
          <circle cx="16.2" cy="8.4" r="3" fill="#ffd23f" stroke={s} stroke-width="1.6" />
          <path d="M12.2 19.5C12.5 16 14.2 14.3 16.6 14.3C19 14.3 20.6 16 21 19.5H12.2Z" fill="#ffd23f" stroke={s} stroke-width="1.6" stroke-linejoin="round" />
          <circle cx="8.6" cy="7.6" r="3.4" fill="#5ff2ff" stroke={s} stroke-width="1.8" />
          <path d="M3 20C3.3 15.8 5.4 13.8 8.6 13.8C11.8 13.8 13.9 15.8 14.2 20H3Z" fill="#5ff2ff" stroke={s} stroke-width="1.8" stroke-linejoin="round" />
        </>
      )}
      {name === 'powerups' && (
        <>
          <path d="M13 3L16 5.5L19 3.5L17.5 7L20.5 8.5L17 9.5L16.5 12.5L14.5 9.5L11.5 9L13.5 6.5Z" fill="#ff4d5e" stroke={s} stroke-width="1.3" stroke-linejoin="round" />
          <circle cx="10" cy="14.5" r="6.5" fill="#4f3585" stroke={s} stroke-width="1.8" />
          <path d="M10.8 10L7.5 14.8H10.2L9.2 19L13 14H10.2L10.8 10Z" fill="#ffd23f" stroke={s} stroke-width="1.2" stroke-linejoin="round" />
        </>
      )}
    </svg>
  );
}

export function Header({ title, children, onBack }: { title: string; children?: ComponentChildren; onBack?: () => void }) {
  return (
    <div class="screen-header">
      <Btn variant="ghost" class="back-btn small icon-ref-btn" sound="back" onClick={onBack ?? (() => nav.back())} aria-label="Volver" data-tip="Volver" title="Volver">
        <MenuIcon name="back" size={20} />
        <span class="back-btn-lbl">Volver</span>
      </Btn>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <div
      class={`toggle ${on ? 'on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-label={label}
      tabIndex={0}
      onClick={() => {
        audio.play('click');
        onChange(!on);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onChange(!on);
        }
      }}
    />
  );
}

export function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div class="seg">
      {options.map((o) => (
        <button
          key={String(o.v)}
          class={o.v === value ? 'on' : ''}
          onClick={() => {
            audio.play('click');
            onChange(o.v);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PIXEL_INK = '#1f1a24';
const CHEV_ACTIVE_BANDS = ['#fff6a3', '#ffe360', '#ffd038', '#ffb82b', '#f29a20', '#e08219', '#cf7315'] as const;
const CHEV_OFF_BANDS = ['#30224a', '#291c40', '#231738', '#1e1330', '#1a1029', '#160d24', '#130b1f'] as const;
const CHEV_XOFF = [0, 1, 2, 2, 2, 1, 0] as const;

const BOLT_ROWS: readonly string[] = [
  '....KKKKKKK....',
  '...KHHHHYYYK...',
  '..KHHYYYYKKK...',
  '..KHHYYYKKKK...',
  '.KHHYYYK.......',
  'KHHYYYYKKKK....',
  'KHHYYYYYAAK....',
  'KKKKKYYYAAK....',
  '...KYYYAAK.....',
  '...KYYAAK......',
  '..KYYAAK.......',
  '..KYAAK........',
  '..KAAK.........',
  '..KKK..........',
];

const BOLT_PAL: Record<string, string> = {
  K: PIXEL_INK,
  H: '#fff6a3',
  Y: '#ffd23f',
  A: '#e08219',
};

const BOLT_RECTS: { x: number; y: number; w: number; fill: string }[] = (() => {
  const out: { x: number; y: number; w: number; fill: string }[] = [];
  for (let y = 0; y < BOLT_ROWS.length; y++) {
    const row = BOLT_ROWS[y];
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      out.push({ x, y, w: end - x, fill: BOLT_PAL[ch] });
      x = end;
    }
  }
  return out;
})();

export function Pips({ n, max = 5, color }: { n: number; max?: number; color?: string }) {
  const count = Math.max(1, max);
  const startX = 9;
  const step = 6;
  const segW = 5;
  const svgW = startX + count * step + 4;
  return (
    <div
      class="pips pixel-chevron-bar"
      style={color ? ({ '--pc': color } as JSX.CSSProperties) : undefined}
      role="img"
      aria-label={`${n} de ${count}`}
    >
      <svg
        class="pixel-chevron-svg"
        viewBox={`0 0 ${svgW} 14`}
        shape-rendering="crispEdges"
        style={{ aspectRatio: `${svgW} / 14` }}
        aria-hidden="true"
      >
        {Array.from({ length: count }, (_, i) => {
          const bx = startX + i * step;
          const bands = i < n ? CHEV_ACTIVE_BANDS : CHEV_OFF_BANDS;
          return (
            <g key={i}>
              <rect x={bx} y={2} width={segW} height={1} fill={PIXEL_INK} />
              <rect x={bx} y={10} width={segW} height={1} fill={PIXEL_INK} />
              {CHEV_XOFF.map((dx, r) => (
                <g key={r}>
                  <rect x={bx - 1 + dx} y={3 + r} width={1} height={1} fill={PIXEL_INK} />
                  <rect x={bx + dx} y={3 + r} width={segW} height={1} fill={bands[r]} />
                  {i === count - 1 && <rect x={bx + segW + dx} y={3 + r} width={1} height={1} fill={PIXEL_INK} />}
                </g>
              ))}
            </g>
          );
        })}
        {BOLT_RECTS.map((r, idx) => (
          <rect key={idx} x={r.x} y={r.y} width={r.w} height={1} fill={r.fill} />
        ))}
      </svg>
      <span class="battery-num">
        {n}/{count}
      </span>
    </div>
  );
}

export function StarIcon({ on, pop, delay = 0 }: { on: boolean; pop?: boolean; delay?: number }) {
  return (
    <svg class={`star ${on ? '' : 'off'} ${pop && on ? 'pop' : ''}`} viewBox="0 0 40 40" style={{ animationDelay: `${delay}s` }}>
      <path d="M20 2 L25 14 L38 15 L28 24 L31 37 L20 30 L9 37 L12 24 L2 15 L15 14 Z" fill="#ffd23f" stroke="#1a1026" stroke-width="3" stroke-linejoin="round" />
      <path d="M20 8 L23 15 L14 16 Z" fill="#fff6a8" />
    </svg>
  );
}

export function RarityTag({ r }: { r: Rarity }) {
  return (
    <span class="rarity" style={{ background: RARITY[r].color }}>
      {RARITY[r].name}
    </span>
  );
}

export function Modal({ children, onClose }: { children: ComponentChildren; onClose?: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div class="overlay" onClick={(e) => e.target === e.currentTarget && onClose?.()}>
      <div class="panel modal">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Avisos (toasts)
// ---------------------------------------------------------------------------

interface ToastMsg {
  id: number;
  text: string;
  kind: 'ok' | 'err' | 'info';
}
let toastId = 1;
let toastSetter: ((f: (l: ToastMsg[]) => ToastMsg[]) => void) | null = null;

export function toast(text: string, kind: 'ok' | 'err' | 'info' = 'info') {
  if (kind === 'err') audio.play('error');
  const id = toastId++;
  toastSetter?.((l) => [...l, { id, text, kind }]);
  setTimeout(() => toastSetter?.((l) => l.filter((t) => t.id !== id)), 2800);
}

export function Toasts() {
  const [list, setList] = useState<ToastMsg[]>([]);
  useEffect(() => {
    toastSetter = setList;
    return () => {
      toastSetter = null;
    };
  }, []);
  return (
    <div class="toast-wrap">
      {list.map((t) => (
        <div key={t.id} class={`toast ${t.kind}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Miniatura de mapa
// ---------------------------------------------------------------------------

const thumbCache = new Map<string, string>();

export function mapThumb(id: MapId): string {
  const hit = thumbCache.get(id);
  if (hit) return hit;
  const m = parseMap(id);
  const theme = MAPS[id].theme;
  const cv = document.createElement('canvas');
  cv.width = m.w * T;
  cv.height = m.h * T;
  const ctx = cv.getContext('2d')!;
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) Sprites.floor(theme, x, y).drawTo(ctx, x * T, y * T);
  m.flags.forEach((f, team) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) ctx.drawImage(Sprites.baseTint(TEAM_COLORS[team]), (f.x + dx) * T, (f.y + dy) * T);
  });
  for (let y = 0; y < m.h; y++)
    for (let x = 0; x < m.w; x++) {
      const i = y * m.w + x;
      const below = y + 1 >= m.h || m.tiles[i + m.w] === Tile.Wall || m.tiles[i + m.w] === Tile.Block;
      if (m.conv[i]) ctx.drawImage(Sprites.conveyor(m.conv[i], 0), x * T, y * T);
      if (m.tiles[i] === Tile.Lava) ctx.drawImage(Sprites.lava(1, 0, x, y), x * T, y * T);
      if (m.tiles[i] === Tile.Wall) ctx.drawImage(Sprites.wall(theme, x, y, below), x * T, y * T);
      if (m.tiles[i] === Tile.Block) ctx.drawImage(Sprites.block(theme, x, y, below), x * T, y * T);
    }
  for (const d of m.doors) ctx.drawImage(Sprites.door(0), d.x * T, d.y * T);
  m.flags.forEach((f, team) => ctx.drawImage(Sprites.flag(TEAM_COLORS[team], 1), f.x * T, f.y * T - 14));
  const small = document.createElement('canvas');
  small.width = Math.round(cv.width / 2);
  small.height = Math.round(cv.height / 2);
  const sctx = small.getContext('2d')!;
  sctx.imageSmoothingEnabled = true;
  sctx.drawImage(cv, 0, 0, small.width, small.height);
  const url = small.toDataURL();
  thumbCache.set(id, url);
  return url;
}

export function fmtTime(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
