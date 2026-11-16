// Festival de la Gran Deflagración (niveles con estrellas).
import { useState } from 'preact/hooks';
import { MODES } from '../../../shared/balance';
import { MAPS } from '../../../shared/maps';
import { FESTIVAL, type FestivalLevel } from '../../data/festival';
import { Backdrop, Btn, Coins, Header, Modal, StarIcon, mapThumb } from '../common';
import { useProfile } from '../hooks';
import { nav } from '../nav';

const DIFF = ['Fácil', 'Normal', 'Difícil', 'Experto'];

export function FestivalScreen() {
  const p = useProfile();
  const [sel, setSel] = useState<FestivalLevel | null>(null);
  const stars = (n: number) => p.festival[String(n)] ?? 0;
  const unlocked = (n: number) => n === 1 || stars(n - 1) > 0;
  const total = FESTIVAL.reduce((a, l) => a + stars(l.n), 0);
  return (
    <div class="screen">
      <Backdrop />
      <Header title="Festival de la Gran Deflagración">
        <div class="panel stat-card-val" style={{ padding: '6px 12px' }}>
          ★ {total} / {FESTIVAL.length * 3}
        </div>
      </Header>
      <div class="screen-body">
        <p class="muted" style={{ maxWidth: '800px', marginTop: 0 }}>
          En el Universo Bombástico, una realeza despiadada organiza el Festival de la Gran Deflagración. Superá los 12 desafíos, conseguí estrellas cumpliendo objetivos y ganá monedas para la tienda.
        </p>
        <div class="festival-path">
          {FESTIVAL.map((l) => {
            const open = unlocked(l.n);
            return (
              <button key={l.n} class={`card level-node ${open ? '' : 'locked'}`} onClick={() => open && setSel(l)} disabled={!open}>
                <div class="lnum">{open ? l.n : '🔒'}</div>
                <h4 style={{ textAlign: 'center' }}>{l.name}</h4>
                <p style={{ textAlign: 'center' }}>
                  {MODES[l.mode].name} · {MAPS[l.map].name}
                </p>
                <div class="stars" style={{ marginTop: '6px', transform: 'scale(0.6)', height: '30px' }}>
                  {[0, 1, 2].map((i) => (
                    <StarIcon key={i} on={i < stars(l.n)} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </div>
      {sel && (
        <Modal onClose={() => setSel(null)}>
          <img class="thumb" src={mapThumb(sel.map)} style={{ width: '100%', borderRadius: '12px', border: '3px solid var(--ink)', imageRendering: 'pixelated' }} alt="" />
          <h2 class="hero-detail-title" style={{ color: 'var(--yellow)', marginTop: '8px' }}>
            {sel.n}. {sel.name}
          </h2>
          <p>{sel.desc}</p>
          <div class="row wrap" style={{ gap: '8px', marginBottom: '10px' }}>
            <span class="tag">{MODES[sel.mode].name}</span>
            <span class="tag">{MAPS[sel.map].name}</span>
            <span class="tag">{MODES[sel.mode].teams ? `${sel.teamSize} vs ${sel.teamSize}` : `${sel.teamSize} jugadores`}</span>
            <span class="tag">Bots: {DIFF[sel.difficulty]}</span>
            {sel.mods?.hyperMul && <span class="tag" style={{ background: '#b0880a' }}>Hipercarga x{sel.mods.hyperMul}</span>}
            {sel.mods?.startBombs && <span class="tag" style={{ background: '#d8323f' }}>{sel.mods.startBombs} bombas iniciales</span>}
          </div>
          <h3>Objetivos</h3>
          {sel.stars.map((s, i) => (
            <div key={i} class="row" style={{ gap: '6px' }}>
              <span style={{ transform: 'scale(0.55)', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center' }}>
                <StarIcon on={i < stars(sel.n)} />
              </span>
              {s.text}
            </div>
          ))}
          <div class="row" style={{ marginTop: '12px' }}>
            <span class="muted">Primera victoria:</span> <Coins n={sel.reward} /> <span class="muted">+ 25 por estrella</span>
          </div>
          <div class="row" style={{ marginTop: '16px', justifyContent: 'flex-end' }}>
            <Btn variant="ghost" sound="back" onClick={() => setSel(null)}>
              Cerrar
            </Btn>
            <Btn size="big" onClick={() => nav.go('charselect', { festival: sel.n })}>
              ¡Jugar! ▶
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
