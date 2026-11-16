// Perfil del jugador: nivel, estadísticas, historial y logros.
import { useState } from 'preact/hooks';
import { CLASSES, MODES, divisionFor, levelFromXp } from '../../../shared/balance';
import { MAPS } from '../../../shared/maps';
import { ACHIEVEMENTS } from '../../../shared/profile';
import { CLASS_IDS } from '../../../shared/types';
import { portraitURL } from '../../gfx/sprites';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Coins, Header, Modal, toast } from '../common';
import { useProfile, useUser } from '../hooks';
import { nav } from '../nav';

export function ProfileScreen() {
  const p = useProfile();
  const user = useUser();
  const [tab, setTab] = useState<'stats' | 'hist' | 'logros'>('stats');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(p.name);
  const lv = levelFromXp(p.xp);
  const s = p.stats;
  const kd = s.deaths ? (s.kills / s.deaths).toFixed(2) : s.kills.toFixed(2);
  const winRate = s.matches ? Math.round((s.wins / s.matches) * 100) : 0;
  const divIA = divisionFor(p.eloIA);
  const divOn = divisionFor(p.elo);
  const save = async () => {
    try {
      await profiles.rename(name);
      toast('Nombre actualizado', 'ok');
      setEditing(false);
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  const fmtH = (sec: number) => `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
  return (
    <div class="screen">
      <Backdrop />
      <Header title="Perfil">
        {user?.role === 'admin' && (
          <Btn variant="purple" size="small" onClick={() => nav.go('admin')}>
            Panel admin
          </Btn>
        )}
        {user ? (
          <Btn variant="red" size="small" onClick={() => profiles.logout()}>
            Cerrar sesión
          </Btn>
        ) : (
          <Btn variant="blue" size="small" onClick={() => nav.go('auth')}>
            Crear cuenta / Ingresar
          </Btn>
        )}
      </Header>
      <div class="screen-body">
        <div class="grid layout-sidebar-main">
          <div class="panel" style={{ textAlign: 'center' }}>
            <img src={portraitURL(p.favorite, profiles.skinFor(p.favorite), 'win', 1, 4)} style={{ width: 'min(170px, 100%)', imageRendering: 'pixelated' }} alt="" />
            <div class="hero-detail-title">{p.name}</div>
            <div class="muted" style={{ fontSize: '14px' }}>{user ? `Cuenta: ${user.username}` : 'Perfil local (invitado)'}</div>
            <Btn size="small" variant="ghost" style={{ marginTop: '8px' }} onClick={() => setEditing(true)}>
              ✎ Cambiar nombre
            </Btn>
            <div class="row" style={{ marginTop: '14px' }}>
              <div class="lvl-badge">{lv.level}</div>
              <div style={{ flex: 1, textAlign: 'left', minInlineSize: 0 }}>
                <div class="bar">
                  <i style={{ width: `${(lv.into / lv.need) * 100}%` }} />
                </div>
                <div class="muted" style={{ fontSize: '13px' }}>
                  {lv.into} / {lv.need} XP para el nivel {lv.level + 1}
                </div>
              </div>
            </div>
            <div class="row" style={{ justifyContent: 'center', marginTop: '10px' }}>
              <Coins n={p.coins} />
            </div>
            <div class="stat-cards-grid" style={{ marginTop: '14px' }}>
              <div class="panel" style={{ padding: '8px' }}>
                <div class="muted" style={{ fontSize: '12px' }}>Liga IA</div>
                <div class="league-name" style={{ color: divIA.color }}>{divIA.name}</div>
                <div>{p.eloIA} ELO</div>
              </div>
              <div class="panel" style={{ padding: '8px' }}>
                <div class="muted" style={{ fontSize: '12px' }}>Online</div>
                <div class="league-name" style={{ color: divOn.color }}>{divOn.name}</div>
                <div>{p.elo} ELO</div>
              </div>
            </div>
          </div>
          <div style={{ minInlineSize: 0 }}>
            <div class="tabs">
              <Btn variant={tab === 'stats' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('stats')}>
                Estadísticas
              </Btn>
              <Btn variant={tab === 'hist' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('hist')}>
                Historial
              </Btn>
              <Btn variant={tab === 'logros' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('logros')}>
                Logros ({Object.keys(p.achievements).length}/{ACHIEVEMENTS.length})
              </Btn>
            </div>
            {tab === 'stats' && (
              <>
                <div class="stat-cards-grid">
                  {(
                    [
                      ['Partidas', s.matches],
                      ['Victorias', `${s.wins} (${winRate}%)`],
                      ['Eliminaciones', s.kills],
                      ['K/D', kd],
                      ['Asistencias', s.assists],
                      ['Capturas', s.caps],
                      ['Banderas recuperadas', s.returns],
                      ['Defensas', s.defends],
                      ['Daño total', s.damage],
                      ['Curación', s.heal],
                      ['Bloques rotos', s.blocks],
                      ['Mejor racha', s.bestStreak],
                      ['Tiempo jugado', fmtH(s.playTime)],
                    ] as [string, string | number][]
                  ).map(([k, v]) => (
                    <div key={k} class="card" style={{ cursor: 'default' }}>
                      <div class="muted" style={{ fontSize: '13px' }}>{k}</div>
                      <div class="stat-card-val">{v}</div>
                    </div>
                  ))}
                </div>
                <div class="panel" style={{ marginTop: '16px' }}>
                  <h3>Por personaje</h3>
                  <div class="table-scroll">
                    <table class="table">
                      <thead>
                        <tr>
                          <th>Personaje</th>
                          <th class="num">Partidas</th>
                          <th class="num">Victorias</th>
                          <th class="num">Eliminaciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CLASS_IDS.map((c) => (
                          <tr key={c}>
                            <td>
                              <img src={portraitURL(c, profiles.skinFor(c), 'idle', 0, 1)} style={{ width: '28px', verticalAlign: 'middle', imageRendering: 'pixelated' }} alt="" /> {CLASSES[c].hero} <span class="muted">({CLASSES[c].className})</span>
                            </td>
                            <td class="num">{s.byClass[c].matches}</td>
                            <td class="num">{s.byClass[c].wins}</td>
                            <td class="num">{s.byClass[c].kills}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
            {tab === 'hist' && (
              <div class="panel">
                {p.history.length === 0 && <div class="muted">Todavía no jugaste partidas. ¡Andá a Jugar!</div>}
                {p.history.length > 0 && (
                  <div class="table-scroll">
                    <table class="table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Modo</th>
                          <th>Mapa</th>
                          <th>Personaje</th>
                          <th>Resultado</th>
                          <th class="num">E/M/A</th>
                          <th class="num">XP</th>
                          <th class="num">ELO</th>
                        </tr>
                      </thead>
                      <tbody>
                        {p.history.map((h, i) => (
                          <tr key={i}>
                            <td>{new Date(h.date).toLocaleDateString('es-AR')}</td>
                            <td>
                              {MODES[h.mode]?.short ?? h.mode}
                              {h.online ? ' 🌐' : ''}
                              {h.festival ? ` ★${h.festival}` : ''}
                            </td>
                            <td>{MAPS[h.map]?.name}</td>
                            <td>{CLASSES[h.cls]?.hero}</td>
                            <td style={{ color: h.result === 'win' ? '#3cff9a' : h.result === 'lose' ? '#ff5a5a' : '#fff', fontWeight: 700 }}>{h.result === 'win' ? 'Victoria' : h.result === 'lose' ? 'Derrota' : 'Empate'}</td>
                            <td class="num">
                              {h.kills}/{h.deaths}/{h.assists}
                            </td>
                            <td class="num">+{h.xp}</td>
                            <td class="num" style={{ color: h.elo >= 0 ? '#3cff9a' : '#ff5a5a' }}>{h.elo ? (h.elo > 0 ? `+${h.elo}` : h.elo) : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
            {tab === 'logros' && (
              <div class="cards">
                {ACHIEVEMENTS.map((a) => {
                  const got = p.achievements[a.id];
                  return (
                    <div key={a.id} class="card" style={{ cursor: 'default', opacity: got ? 1 : 0.6 }}>
                      <div style={{ fontSize: '30px' }}>{got ? '🏆' : '🔒'}</div>
                      <h4>{a.name}</h4>
                      <p>{a.desc}</p>
                      <div class="row" style={{ marginTop: '6px' }}>
                        <Coins n={a.reward} />
                        {got && <span class="muted" style={{ fontSize: '12px' }}>{new Date(got).toLocaleDateString('es-AR')}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {editing && (
        <Modal onClose={() => setEditing(false)}>
          <h3>Cambiar nombre</h3>
          <div class="field">
            <input class="input" value={name} maxLength={16} onInput={(e) => setName((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus />
          </div>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Btn>
            <Btn variant="green" onClick={save}>
              Guardar
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
