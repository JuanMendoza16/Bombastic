// Ranking (GDD sección 14): global, semanal e histórico. Online desde el servidor;
// sin servidor se muestra la Liga contra la IA.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { DIVISIONS, divisionFor } from '../../../shared/balance';
import { BOT_NAMES } from '../../../shared/ai';
import { api } from '../../services/api';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Header } from '../common';
import { useProfile, useUser } from '../hooks';

interface Row {
  rank: number;
  name: string;
  elo: number;
  level?: number;
  wins?: number;
  matches?: number;
  me?: boolean;
  value?: number;
}

type Kind = 'global' | 'semanal' | 'historico';

/** Rivales de la liga local contra la IA: su ELO varía un poco cada semana. */
function iaRivals(myElo: number, kind: Kind, weekGain: number, peak: number): Row[] {
  const week = Math.floor(Date.now() / (7 * 86400000));
  const rows: Row[] = BOT_NAMES.slice(0, 19).map((n, i) => {
    const base = 780 + ((i * 97) % 820);
    const drift = Math.round(Math.sin(week * 1.7 + i) * 40);
    const weekly = Math.round(Math.sin(week * 2.3 + i * 1.3) * 60);
    return { rank: 0, name: `${n} (IA)`, elo: base + drift, value: kind === 'semanal' ? weekly : kind === 'historico' ? base + 60 : base + drift };
  });
  rows.push({ rank: 0, name: profiles.profile.name, elo: myElo, me: true, value: kind === 'semanal' ? weekGain : kind === 'historico' ? peak : myElo });
  rows.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  rows.forEach((r, i) => (r.rank = i + 1));
  return rows;
}

export function RankingScreen() {
  const p = useProfile();
  const user = useUser();
  const [league, setLeague] = useState<'online' | 'ia'>(profiles.serverOnline ? 'online' : 'ia');
  const [kind, setKind] = useState<Kind>('global');
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (league !== 'online') return;
    setRows(null);
    setErr('');
    api<{ rows: Row[] }>('GET', `/api/ranking?type=${kind}`)
      .then((r) => setRows(r.rows.map((x) => ({ ...x, me: user ? x.name === p.name : false }))))
      .catch((e) => setErr((e as Error).message));
  }, [league, kind, user]);

  const iaRows = useMemo(() => iaRivals(p.eloIA, kind, p.weekGain, Math.max(p.eloPeak, p.eloIA)), [p.eloIA, kind, p.weekGain]);
  const list = league === 'ia' ? iaRows : rows;
  const myDiv = divisionFor(league === 'ia' ? p.eloIA : p.elo);

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Ranking" />
      <div class="screen-body">
        <div class="grid layout-sidebar-main">
          <div class="panel">
            <h3>Tu división</h3>
            <div class="hero-detail-title" style={{ color: myDiv.color }}>
              {myDiv.name}
            </div>
            <div>{league === 'ia' ? p.eloIA : p.elo} ELO</div>
            <div class="muted" style={{ fontSize: '14px', marginTop: '10px' }}>
              ELO simplificado: ganás puntos al vencer a rivales de mayor nivel. El resultado de la partida pesa más que las eliminaciones, y tu aporte al equipo suma un pequeño extra.
            </div>
            <div style={{ marginTop: '12px' }}>
              {DIVISIONS.map((d) => (
                <div key={d.name} class="row" style={{ gap: '8px', margin: '4px 0' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '4px', background: d.color, border: '2px solid var(--ink)' }} />
                  <b style={{ color: d.color }}>{d.name}</b>
                  <span class="muted">desde {d.min}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ minInlineSize: 0 }}>
            <div class="tabs">
              <Btn variant={league === 'online' ? 'blue' : 'ghost'} size="small" onClick={() => setLeague('online')} disabled={!profiles.serverOnline}>
                🌐 Online
              </Btn>
              <Btn variant={league === 'ia' ? 'purple' : 'ghost'} size="small" onClick={() => setLeague('ia')}>
                🤖 Liga contra la IA
              </Btn>
              <span class="spacer" />
              {(['global', 'semanal', 'historico'] as Kind[]).map((k) => (
                <Btn key={k} variant={kind === k ? 'yellow' : 'ghost'} size="small" onClick={() => setKind(k)}>
                  {k === 'global' ? 'Global' : k === 'semanal' ? 'Semanal' : 'Histórico'}
                </Btn>
              ))}
            </div>
            {!profiles.serverOnline && (
              <div class="muted" style={{ marginBottom: '8px' }}>
                No hay un servidor online disponible: se muestra la Liga contra la IA. Jugá contra bots para subir de división.
              </div>
            )}
            {league === 'online' && !user && profiles.serverOnline && <div class="muted" style={{ marginBottom: '8px' }}>Iniciá sesión para aparecer en el ranking online.</div>}
            <div class="panel">
              {err && <div style={{ color: '#ff5a5a' }}>{err}</div>}
              {!list && !err && <div class="muted">Cargando...</div>}
              {list && list.length === 0 && <div class="muted">Todavía no hay jugadores en este ranking.</div>}
              {list && list.length > 0 && (
                <div class="table-scroll">
                  <table class="table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Jugador</th>
                        <th>División</th>
                        <th class="num">{kind === 'semanal' ? 'ELO esta semana' : kind === 'historico' ? 'Mejor ELO' : 'ELO'}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r) => {
                        const d = divisionFor(r.elo);
                        return (
                          <tr key={r.rank + r.name} class={r.me ? 'me' : ''}>
                            <td class="stat-card-val">{r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1] : r.rank}</td>
                            <td>{r.name}</td>
                            <td style={{ color: d.color, fontWeight: 700 }}>{d.name}</td>
                            <td class="num">
                              <b>{kind === 'semanal' && (r.value ?? 0) > 0 ? '+' : ''}{r.value ?? r.elo}</b>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
