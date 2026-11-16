// Panel de administración (solo rol admin): usuarios, partidas y métricas.
import { useEffect, useState } from 'preact/hooks';
import { CLASSES, MODES } from '../../../shared/balance';
import { MAPS } from '../../../shared/maps';
import { api } from '../../services/api';
import { Backdrop, Btn, Header, toast } from '../common';
import { useUser } from '../hooks';

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  banned: number;
  elo: number;
  level: number;
  created_at: number;
  matches: number;
}

interface AdminStats {
  users: number;
  matches: number;
  online: number;
  rooms: number;
  byMode: { mode: string; n: number }[];
  byMap: { map: string; n: number }[];
  byClass: { cls: string; n: number; wins: number }[];
  last7: { day: string; n: number }[];
}

interface AdminMatch {
  id: number;
  mode: string;
  map: string;
  winner: number;
  duration: number;
  ended_at: number;
  players: string;
}

interface ServerSettings {
  announcementEnabled: boolean;
  announcementText: string;
  maintenanceEnabled: boolean;
  maintenanceStart: string;
  maintenanceEnd: string;
  autoDeployEnabled: boolean;
  autoDeploySchedule: string;
}

export function AdminScreen() {
  const user = useUser();
  const [tab, setTab] = useState<'dash' | 'users' | 'matches' | 'server'>('dash');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [matches, setMatches] = useState<AdminMatch[]>([]);
  const [q, setQ] = useState('');
  const [settings, setSettings] = useState<ServerSettings | null>(null);
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [grantUser, setGrantUser] = useState<AdminUser | null>(null);
  const [grantCoins, setGrantCoins] = useState('100');
  const [grantItem, setGrantItem] = useState('');

  const load = async () => {
    try {
      if (tab === 'dash') setStats(await api<AdminStats>('GET', '/api/admin/stats'));
      if (tab === 'users') setUsers((await api<{ users: AdminUser[] }>('GET', `/api/admin/users?q=${encodeURIComponent(q)}`)).users);
      if (tab === 'matches') setMatches((await api<{ matches: AdminMatch[] }>('GET', '/api/admin/matches')).matches);
      if (tab === 'server') {
        const res = await api<{ settings: ServerSettings; maintenanceActive: boolean }>('GET', '/api/admin/settings');
        setSettings(res.settings);
        setMaintenanceActive(res.maintenanceActive);
      }
    } catch (e) {
      toast((e as Error).message, 'err');
    }
  };
  useEffect(() => {
    void load();
  }, [tab]);

  if (user?.role !== 'admin')
    return (
      <div class="screen">
        <Backdrop />
        <Header title="Administración" />
        <div class="screen-body">No tenés permisos para ver esta sección.</div>
      </div>
    );

  const ban = async (u: AdminUser) => {
    await api('POST', `/api/admin/users/${u.id}/${u.banned ? 'unban' : 'ban'}`);
    toast(u.banned ? 'Usuario habilitado' : 'Usuario suspendido', 'ok');
    void load();
  };
  const setRole = async (u: AdminUser, role: string) => {
    await api('POST', `/api/admin/users/${u.id}/role`, { role });
    void load();
  };

  const bar = (v: number, max: number) => (
    <div class="bar" style={{ height: '14px' }}>
      <i style={{ width: `${max ? (v / max) * 100 : 0}%`, background: 'linear-gradient(180deg,#ffe98a,#ffb13b)' }} />
    </div>
  );

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Administración">
        <Btn size="small" variant="ghost" onClick={load}>
          ↻ Actualizar
        </Btn>
      </Header>
      <div class="screen-body">
        <div class="tabs">
          <Btn size="small" variant={tab === 'dash' ? 'yellow' : 'ghost'} onClick={() => setTab('dash')}>
            Métricas
          </Btn>
          <Btn size="small" variant={tab === 'users' ? 'yellow' : 'ghost'} onClick={() => setTab('users')}>
            Usuarios
          </Btn>
          <Btn size="small" variant={tab === 'matches' ? 'yellow' : 'ghost'} onClick={() => setTab('matches')}>
            Partidas
          </Btn>
          <Btn size="small" variant={tab === 'server' ? 'yellow' : 'ghost'} onClick={() => setTab('server')}>
            Servidor
          </Btn>
        </div>
        {tab === 'dash' && stats && (
          <div class="grid layout-split-2">
            <div class="panel">
              <h3>General</h3>
              <div>Usuarios registrados: <b>{stats.users}</b></div>
              <div>Partidas online jugadas: <b>{stats.matches}</b></div>
              <div>Jugadores conectados: <b>{stats.online}</b></div>
              <div>Salas activas: <b>{stats.rooms}</b></div>
            </div>
            <div class="panel">
              <h3>Partidas por modo</h3>
              {stats.byMode.map((m) => (
                <div key={m.mode} style={{ marginBottom: '6px' }}>
                  {MODES[m.mode as keyof typeof MODES]?.name ?? m.mode} ({m.n}){bar(m.n, Math.max(...stats.byMode.map((x) => x.n)))}
                </div>
              ))}
            </div>
            <div class="panel">
              <h3>Partidas por mapa</h3>
              {stats.byMap.map((m) => (
                <div key={m.map} style={{ marginBottom: '6px' }}>
                  {MAPS[m.map as keyof typeof MAPS]?.name ?? m.map} ({m.n}){bar(m.n, Math.max(...stats.byMap.map((x) => x.n)))}
                </div>
              ))}
            </div>
            <div class="panel">
              <h3>Clases (balance)</h3>
              <div class="table-scroll">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Clase</th>
                      <th class="num">Usos</th>
                      <th class="num">% victoria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.byClass.map((c) => (
                      <tr key={c.cls}>
                        <td>{CLASSES[c.cls as keyof typeof CLASSES] ? `${CLASSES[c.cls as keyof typeof CLASSES].hero} (${CLASSES[c.cls as keyof typeof CLASSES].className})` : c.cls}</td>
                        <td class="num">{c.n}</td>
                        <td class="num">{c.n ? Math.round((c.wins / c.n) * 100) : 0}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div class="panel">
              <h3>Últimos 7 días</h3>
              {stats.last7.map((d) => (
                <div key={d.day} style={{ marginBottom: '6px' }}>
                  {d.day} ({d.n}){bar(d.n, Math.max(1, ...stats.last7.map((x) => x.n)))}
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === 'users' && (
          <div class="panel">
            <div class="row wrap" style={{ marginBottom: '10px' }}>
              <input class="input" style={{ flex: '1 1 200px' }} placeholder="Buscar usuario o email" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && load()} />
              <Btn size="small" onClick={load}>
                Buscar
              </Btn>
            </div>
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th class="num">Nivel</th>
                    <th class="num">ELO</th>
                    <th class="num">Partidas</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} style={{ opacity: u.banned ? 0.5 : 1 }}>
                      <td>{u.id}</td>
                      <td>{u.username}</td>
                      <td>{u.email}</td>
                      <td>{u.role}</td>
                      <td class="num">{u.level}</td>
                      <td class="num">{u.elo}</td>
                      <td class="num">{u.matches}</td>
                      <td>
                        <div class="row wrap" style={{ gap: '6px' }}>
                          <Btn size="small" variant={u.banned ? 'green' : 'red'} onClick={() => ban(u)}>
                            {u.banned ? 'Habilitar' : 'Suspender'}
                          </Btn>
                          <Btn size="small" variant="ghost" onClick={() => setRole(u, u.role === 'admin' ? 'player' : 'admin')}>
                            {u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}
                          </Btn>
                          <Btn size="small" variant="yellow" onClick={() => setGrantUser(u)}>
                            + Recursos
                          </Btn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {grantUser && (
              <div class="panel" style={{ marginTop: '12px' }}>
                <h4>Otorgar recursos a {grantUser.username}</h4>
                <div class="row wrap" style={{ gap: '8px', alignItems: 'center' }}>
                  <input type="number" min="0" value={grantCoins} onInput={(e) => setGrantCoins((e.target as HTMLInputElement).value)} placeholder="Monedas" style={{ width: '120px' }} />
                  <input type="text" value={grantItem} onInput={(e) => setGrantItem((e.target as HTMLInputElement).value)} placeholder="ID de ítem (opcional)" style={{ width: '200px' }} />
                  <Btn
                    size="small"
                    variant="green"
                    onClick={async () => {
                      try {
                        await api('POST', `/api/admin/users/${grantUser.id}/grant`, {
                          coins: Number(grantCoins) || 0,
                          itemId: grantItem.trim() || undefined,
                        });
                        toast(`Recursos otorgados a ${grantUser.username}`, 'ok');
                        setGrantUser(null);
                        setGrantItem('');
                      } catch (e) {
                        toast((e as Error).message, 'err');
                      }
                    }}
                  >
                    Otorgar
                  </Btn>
                  <Btn size="small" variant="ghost" onClick={() => setGrantUser(null)}>
                    Cancelar
                  </Btn>
                </div>
              </div>
            )}
          </div>
        )}
        {tab === 'matches' && (
          <div class="panel">
            <div class="table-scroll">
              <table class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha</th>
                    <th>Modo</th>
                    <th>Mapa</th>
                    <th>Ganador</th>
                    <th class="num">Duración</th>
                    <th>Jugadores</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td>{new Date(m.ended_at).toLocaleString('es-AR')}</td>
                      <td>{MODES[m.mode as keyof typeof MODES]?.name ?? m.mode}</td>
                      <td>{MAPS[m.map as keyof typeof MAPS]?.name ?? m.map}</td>
                      <td>{m.winner === -2 ? 'Empate' : m.winner === 0 ? 'Azul' : m.winner === 1 ? 'Rojo' : `#${m.winner}`}</td>
                      <td class="num">{Math.round(m.duration)}s</td>
                      <td style={{ fontSize: '13px' }}>{m.players}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {tab === 'server' && settings && (
          <div class="grid layout-split-2">
            <div class="panel">
              <h3>Anuncio global</h3>
              <label class="row" style={{ gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.announcementEnabled}
                  onChange={(e) => setSettings({ ...settings, announcementEnabled: (e.target as HTMLInputElement).checked })}
                />
                Habilitar anuncio en el juego
              </label>
              <input
                type="text"
                value={settings.announcementText}
                onInput={(e) => setSettings({ ...settings, announcementText: (e.target as HTMLInputElement).value })}
                placeholder="Texto del anuncio..."
                style={{ width: '100%', marginBottom: '12px' }}
              />
              <h3>Mantenimiento (deshabilitar partidas)</h3>
              <label class="row" style={{ gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.maintenanceEnabled}
                  onChange={(e) => setSettings({ ...settings, maintenanceEnabled: (e.target as HTMLInputElement).checked })}
                />
                Bloquear partidas en horario fijo {maintenanceActive ? '(ACTIVO AHORA)' : ''}
              </label>
              <div class="row" style={{ gap: '8px', marginBottom: '12px' }}>
                <input type="time" value={settings.maintenanceStart} onInput={(e) => setSettings({ ...settings, maintenanceStart: (e.target as HTMLInputElement).value })} />
                <span>a</span>
                <input type="time" value={settings.maintenanceEnd} onInput={(e) => setSettings({ ...settings, maintenanceEnd: (e.target as HTMLInputElement).value })} />
              </div>
              <Btn
                size="small"
                variant="green"
                onClick={async () => {
                  try {
                    const res = await api<{ settings: ServerSettings; maintenanceActive: boolean }>('PUT', '/api/admin/settings', settings);
                    setSettings(res.settings);
                    setMaintenanceActive(res.maintenanceActive);
                    toast('Configuración guardada', 'ok');
                  } catch (e) {
                    toast((e as Error).message, 'err');
                  }
                }}
              >
                Guardar configuración
              </Btn>
            </div>
            <div class="panel">
              <h3>Imagen Docker (GHCR)</h3>
              <label class="row" style={{ gap: '8px', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={settings.autoDeployEnabled}
                  onChange={(e) => setSettings({ ...settings, autoDeployEnabled: (e.target as HTMLInputElement).checked })}
                />
                Subida automática programada (horario UTC)
              </label>
              <div class="row" style={{ gap: '8px', marginBottom: '12px' }}>
                <input type="time" value={settings.autoDeploySchedule} onInput={(e) => setSettings({ ...settings, autoDeploySchedule: (e.target as HTMLInputElement).value })} />
              </div>
              <Btn
                size="small"
                variant="yellow"
                onClick={async () => {
                  try {
                    await api('POST', '/api/admin/deploy');
                    toast('Build y subida de imagen iniciados en GitHub Actions', 'ok');
                  } catch (e) {
                    toast((e as Error).message, 'err');
                  }
                }}
              >
                Subir nueva imagen ahora (Manual)
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
