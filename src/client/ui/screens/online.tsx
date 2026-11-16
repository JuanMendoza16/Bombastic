// Online: conexión, partida rápida, salas (crear/unirse), lobby con chat.
import { useEffect, useReducer, useRef, useState } from 'preact/hooks';
import { CLASSES, MODES } from '../../../shared/balance';
import { MAPS, MAP_ORDER } from '../../../shared/maps';
import type { RoomSettings } from '../../../shared/protocol';
import { CLASS_IDS, type Difficulty, type ModeId } from '../../../shared/types';
import { audio } from '../../audio/audio';
import { net, type OnlineSession } from '../../game/net';
import { portraitURL } from '../../gfx/sprites';
import { detectServer } from '../../services/api';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Header, Modal, Seg, Toggle, mapThumb, toast } from '../common';
import { useProfile, useUser } from '../hooks';
import { nav } from '../nav';
import type { GameLaunch } from './game';

const MODE_ORDER: ModeId[] = ['ctf', 'duelo', 'eliminacion', 'zona', 'clasica'];

// cuando el servidor arranca una partida, vamos a la pantalla de juego
net.onStart = (s: OnlineSession) => {
  const launch: GameLaunch = {
    session: s,
    online: true,
    onlineRewards: () => s.waitRewards(),
    onExit: () => {
      if (s.state.phase !== 'ended') net.leave();
    },
  };
  if (nav.current.id === 'game') nav.replace('game', { launch });
  else nav.go('game', { launch });
};

function useNet() {
  const [, force] = useReducer((x: number, _a: number) => x + 1, 0);
  useEffect(() => net.subscribe(() => force(0)), []);
  return net;
}

export function OnlineScreen() {
  const n = useNet();
  const user = useUser();
  const [server, setServer] = useState<boolean | null>(profiles.serverOnline ? true : null);
  const [code, setCode] = useState('');
  const [mode, setMode] = useState<ModeId>('ctf');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    detectServer(true).then((ok) => {
      if (!alive) return;
      profiles.serverOnline = ok;
      setServer(ok);
      if (ok) net.connect();
    });
    const id = setInterval(() => net.status === 'online' && net.refreshRooms(), 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // al entrar a una sala, pasamos a su pantalla
  useEffect(() => {
    if (n.room && nav.current.id === 'online') nav.go('room');
  }, [n.room]);

  useEffect(() => {
    if (n.error) toast(n.error, 'err');
  }, [n.error]);

  if (server === false) {
    return (
      <div class="screen">
        <Backdrop />
        <Header title="Online" />
        <div class="screen-body center" style={{ flexDirection: 'column' }}>
          <div class="panel" style={{ maxWidth: '640px', textAlign: 'center' }}>
            <div style={{ fontSize: '54px' }}>🔌</div>
            <h3>No hay servidor online disponible</h3>
            <p>
              Para jugar online, el juego tiene que estar publicado con su servidor (<code>npm start</code>) o tenés que configurar la dirección del servidor en <b>Ajustes → Cuenta y datos</b>.
            </p>
            <p class="muted">Mientras tanto podés jugar contra bots, en 2 jugadores en la misma compu, y avanzar en el Festival.</p>
            <div class="row" style={{ justifyContent: 'center' }}>
              <Btn variant="ghost" onClick={() => nav.go('settings')}>
                Ajustes
              </Btn>
              <Btn onClick={() => nav.reset('play')}>Jugar contra bots</Btn>
              <Btn
                variant="blue"
                onClick={() => {
                  setServer(null);
                  detectServer(true).then((ok) => {
                    profiles.serverOnline = ok;
                    setServer(ok);
                    if (ok) net.connect();
                  });
                }}
              >
                Reintentar
              </Btn>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Online">
        <span class="tag" style={{ background: n.status === 'online' ? '#1f7a4a' : '#8a6d10', fontSize: '14px' }}>
          {n.status === 'online' ? `● Conectado · ${n.online} en línea` : '● Conectando...'}
        </span>
      </Header>
      <div class="screen-body">
        {!user && (
          <div class="panel" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span>
              Estás jugando como invitado (<b>{profiles.profile.name}</b>). Para aparecer en el ranking y guardar tu progreso en el servidor, iniciá sesión.
            </span>
            <span class="spacer" />
            <Btn size="small" variant="blue" onClick={() => nav.go('auth')}>
              Iniciar sesión
            </Btn>
          </div>
        )}
        <div class="grid layout-split-2">
          <div class="panel">
            <h3>⚡ Partida rápida</h3>
            <p class="muted" style={{ marginTop: 0 }}>Te unimos a una sala abierta. Si faltan jugadores, los completan bots.</p>
            <div class="row wrap" style={{ gap: '6px', marginBottom: '12px' }}>
              {MODE_ORDER.map((m) => (
                <Btn key={m} size="small" variant={mode === m ? 'yellow' : 'ghost'} onClick={() => setMode(m)}>
                  {MODES[m].name}
                </Btn>
              ))}
            </div>
            <Btn size="big" style={{ width: '100%' }} disabled={n.status !== 'online'} onClick={() => net.quick(mode)}>
              ¡Buscar partida!
            </Btn>
          </div>
          <div class="panel">
            <h3>🏠 Salas privadas</h3>
            <Btn variant="blue" style={{ width: '100%', marginBottom: '14px' }} disabled={n.status !== 'online'} onClick={() => setCreating(true)}>
              Crear sala
            </Btn>
            <div class="field">
              <label>Unirse con código</label>
              <div class="row wrap">
                <input class="input" style={{ flex: '1 1 160px', textTransform: 'uppercase', letterSpacing: '4px' }} maxLength={5} value={code} placeholder="ABCDE" onInput={(e) => setCode((e.target as HTMLInputElement).value)} onKeyDown={(e) => e.key === 'Enter' && code && net.join(code)} />
                <Btn disabled={code.length < 5 || n.status !== 'online'} onClick={() => net.join(code)}>
                  Entrar
                </Btn>
              </div>
            </div>
          </div>
          <div class="panel">
            <h3>🌐 Salas públicas</h3>
            {n.rooms.length === 0 && <div class="muted">No hay salas abiertas. ¡Creá una o buscá partida rápida!</div>}
            {n.rooms.map((r) => (
              <div key={r.code} class="row" style={{ padding: '8px 0', borderBottom: '2px dashed rgba(185,168,217,0.18)' }}>
                <div style={{ flex: 1 }}>
                  <b>{r.name}</b>
                  <div class="muted" style={{ fontSize: '13px' }}>
                    {MODES[r.mode].name} · {MAPS[r.map].name} · {r.players}/{r.max} · {r.state === 'playing' ? 'En juego' : 'En sala'}
                  </div>
                </div>
                <Btn size="small" disabled={r.state === 'playing' || r.players >= r.max} onClick={() => net.join(r.code)}>
                  Unirse
                </Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
      {creating && (
        <CreateRoom
          onClose={() => setCreating(false)}
          onCreate={(s) => {
            net.create(s);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function CreateRoom({ onClose, onCreate }: { onClose: () => void; onCreate: (s: Partial<RoomSettings>) => void }) {
  const [mode, setMode] = useState<ModeId>('ctf');
  const [map, setMap] = useState(MAP_ORDER[0]);
  const [pub, setPub] = useState(true);
  return (
    <Modal onClose={onClose}>
      <h3>Crear sala</h3>
      <div class="field">
        <label>Modo</label>
        <Seg
          value={mode}
          options={MODE_ORDER.map((m) => ({ v: m, label: MODES[m].short }))}
          onChange={(m) => {
            setMode(m);
            if (m === 'duelo' && !map.endsWith('_chico')) setMap('ruinas_chico');
          }}
        />
      </div>
      <div class="field">
        <label>Mapa</label>
        <div class="row wrap">
          {MAP_ORDER.map((m) => (
            <button key={m} class={`card ${map === m ? 'sel' : ''}`} style={{ width: '130px', padding: '6px' }} onClick={() => setMap(m)}>
              <img class="thumb" src={mapThumb(m)} alt="" />
              <b>{MAPS[m].name}</b>
            </button>
          ))}
        </div>
      </div>
      <div class="setting">
        <div class="lbl">Sala pública (aparece en la lista)</div>
        <Toggle on={pub} onChange={setPub} />
      </div>
      <div class="row" style={{ justifyContent: 'flex-end', marginTop: '10px' }}>
        <Btn variant="ghost" onClick={onClose}>
          Cancelar
        </Btn>
        <Btn onClick={() => onCreate({ mode, map, public: pub })}>Crear</Btn>
      </div>
    </Modal>
  );
}

export function RoomScreen(_: { params: Record<string, unknown> }) {
  const n = useNet();
  const p = useProfile();
  const [msg, setMsg] = useState('');
  const chatRef = useRef<HTMLDivElement>(null);
  const room = n.room;

  useEffect(() => {
    if (!room && nav.current.id === 'room') nav.replace('online');
  }, [room]);
  useEffect(() => {
    chatRef.current?.scrollTo(0, 99999);
  }, [n.chat.length]);
  useEffect(() => {
    if (n.error) toast(n.error, 'err');
  }, [n.error]);

  if (!room) return <div class="screen" />;
  const me = room.members.find((m) => m.id === n.you);
  const st = room.settings;
  const teams = MODES[st.mode].teams;
  const isHost = !!me?.host;

  const pick = (cls: (typeof CLASS_IDS)[number]) => {
    net.pick(cls, profiles.skinFor(cls), p.equip.fx);
    void profiles.setFavorite(cls);
    audio.play('click');
  };

  const teamCol = (t: number) => {
    const list = room.members.filter((m) => m.team === t);
    const slots = teams ? st.teamSize : st.teamSize;
    return (
      <div class="panel" style={{ flex: 1, minWidth: '240px', borderColor: '#1a1026' }}>
        <h3 style={{ color: teams ? (t === 0 ? '#6fb0ff' : '#ff7a86') : '#ffd23f' }}>{teams ? (t === 0 ? 'Equipo Azul' : 'Equipo Rojo') : 'Jugadores'}</h3>
        {list.map((m) => (
          <div key={m.id} class="row" style={{ padding: '4px 0' }}>
            <img src={portraitURL(m.cls, m.skin, 'idle', 0, 1)} style={{ width: '42px', imageRendering: 'pixelated' }} alt="" />
            <div style={{ flex: 1 }}>
              <b>
                {m.host ? '👑 ' : ''}
                {m.name}
              </b>
              {m.id === n.you && <span class="tag" style={{ marginLeft: '6px', fontSize: '11px' }}>VOS</span>}
              <div class="muted" style={{ fontSize: '13px' }}>
                {CLASSES[m.cls].hero} · {m.elo ?? 1000} ELO
              </div>
            </div>
            <span class="tag" style={{ background: m.ready || m.host ? '#1f7a4a' : '#6f5a99' }}>{m.host ? 'Anfitrión' : m.ready ? 'Listo' : 'Esperando'}</span>
          </div>
        ))}
        {Array.from({ length: Math.max(0, slots - list.length) }, (_, i) => (
          <div key={i} class="row muted" style={{ padding: '6px 0' }}>
            🤖 Lugar libre (bot)
          </div>
        ))}
        {teams && me && me.team !== t && list.length < st.teamSize && (
          <Btn size="small" variant="ghost" onClick={() => net.team(t)}>
            Cambiarme a este equipo
          </Btn>
        )}
      </div>
    );
  };

  return (
    <div class="screen">
      <Backdrop />
      <Header title={room.name} onBack={() => net.leave()}>
        <div class="panel" style={{ padding: '6px 14px', fontFamily: 'var(--title)', fontSize: '22px', letterSpacing: '4px', cursor: 'pointer' }} title="Copiar código" onClick={() => navigator.clipboard?.writeText(room.code).then(() => toast('Código copiado', 'ok'))}>
          {room.code} 📋
        </div>
      </Header>
      <div class="screen-body">
        <div class="grid layout-main-sidebar">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minInlineSize: 0 }}>
            <div class="row wrap" style={{ alignItems: 'stretch' }}>
              {teams ? (
                <>
                  {teamCol(0)}
                  {teamCol(1)}
                </>
              ) : (
                teamCol(0)
              )}
            </div>
            <div class="panel">
              <h3>Tu personaje</h3>
              <div class="char-grid compact">
                {CLASS_IDS.map((c) => {
                  const taken = teams && room.members.some((m) => m.id !== n.you && m.team === me?.team && m.cls === c);
                  return (
                    <button key={c} class={`char-tile ${me?.cls === c ? 'sel' : ''} ${taken ? 'taken' : ''}`} onClick={() => !taken && pick(c)} disabled={room.state !== 'lobby'}>
                      <img src={portraitURL(c, profiles.skinFor(c), 'idle', 0, 2)} alt="" />
                      <div class="cname">{CLASSES[c].hero}</div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div class="panel">
              <h3>Reglas {isHost && !room.quick ? '(sos el anfitrión)' : ''}</h3>
              {isHost && !room.quick ? (
                <>
                  <div class="setting">
                    <div class="lbl">Modo</div>
                    <Seg value={st.mode} options={MODE_ORDER.map((m) => ({ v: m, label: MODES[m].short }))} onChange={(v) => net.setSettings({ mode: v })} />
                  </div>
                  <div class="setting">
                    <div class="lbl">Mapa</div>
                    <Seg value={st.map} options={MAP_ORDER.map((m) => ({ v: m, label: MAPS[m].name }))} onChange={(v) => net.setSettings({ map: v })} />
                  </div>
                  <div class="setting">
                    <div class="lbl">{teams ? 'Jugadores por equipo' : 'Jugadores'}</div>
                    <Seg value={st.teamSize} options={(teams ? [1, 2, 3, 4] : [2, 3, 4, 5, 6]).map((v) => ({ v, label: String(v) }))} onChange={(v) => net.setSettings({ teamSize: v })} />
                  </div>
                  <div class="setting">
                    <div class="lbl">Bots</div>
                    <Seg
                      value={st.difficulty}
                      options={[
                        { v: 0 as Difficulty, label: 'Fácil' },
                        { v: 1 as Difficulty, label: 'Normal' },
                        { v: 2 as Difficulty, label: 'Difícil' },
                        { v: 3 as Difficulty, label: 'Experto' },
                      ]}
                      onChange={(v) => net.setSettings({ difficulty: v })}
                    />
                  </div>
                  <div class="setting">
                    <div class="lbl">Mejoras</div>
                    <Toggle on={st.powerups} onChange={(v) => net.setSettings({ powerups: v })} />
                  </div>
                  <div class="setting">
                    <div class="lbl">Sala pública</div>
                    <Toggle on={st.public} onChange={(v) => net.setSettings({ public: v })} />
                  </div>
                </>
              ) : (
                <div class="row wrap" style={{ gap: '8px' }}>
                  <span class="tag">{MODES[st.mode].name}</span>
                  <span class="tag">{MAPS[st.map].name}</span>
                  <span class="tag">{teams ? `${st.teamSize} vs ${st.teamSize}` : `${st.teamSize} jugadores`}</span>
                  <span class="tag">{st.powerups ? 'Con mejoras' : 'Sin mejoras'}</span>
                </div>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div class="panel" style={{ textAlign: 'center' }}>
              {room.quick && room.countdown !== undefined && room.state === 'lobby' && (
                <div style={{ fontFamily: 'var(--title)', fontSize: '26px', marginBottom: '8px' }}>La partida empieza en {Math.ceil(room.countdown)} s</div>
              )}
              {room.state === 'playing' && <div style={{ fontFamily: 'var(--title)', fontSize: '22px' }}>Partida en curso...</div>}
              {room.state === 'lobby' && !room.quick && (
                <>
                  {isHost ? (
                    <Btn size="big" style={{ width: '100%' }} onClick={() => net.start()}>
                      ▶ Empezar partida
                    </Btn>
                  ) : (
                    <Btn size="big" variant={me?.ready ? 'green' : 'yellow'} style={{ width: '100%' }} onClick={() => net.ready(!me?.ready)}>
                      {me?.ready ? '✔ ¡Listo!' : 'Estoy listo'}
                    </Btn>
                  )}
                  <div class="muted" style={{ fontSize: '13px', marginTop: '6px' }}>Compartí el código {room.code} con tus amigos.</div>
                </>
              )}
              <Btn variant="red" size="small" style={{ marginTop: '10px' }} onClick={() => net.leave()}>
                Salir de la sala
              </Btn>
            </div>
            <div class="panel">
              <h3>Chat</h3>
              <div ref={chatRef} style={{ height: '240px', overflow: 'auto', fontSize: '15px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {n.chat.map((c) => (
                  <div key={c.id} style={{ color: c.sys ? 'var(--muted)' : undefined, fontStyle: c.sys ? 'italic' : undefined }}>
                    {!c.sys && <b style={{ color: '#ffd23f' }}>{c.from}: </b>}
                    {c.text}
                  </div>
                ))}
              </div>
              <div class="row" style={{ marginTop: '8px' }}>
                <input
                  class="input"
                  style={{ flex: 1, fontSize: '15px', padding: '8px' }}
                  maxLength={120}
                  value={msg}
                  placeholder="Escribí un mensaje..."
                  onInput={(e) => setMsg((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && msg.trim()) {
                      net.say(msg);
                      setMsg('');
                    }
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
