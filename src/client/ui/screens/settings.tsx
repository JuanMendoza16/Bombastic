// Ajustes: audio, video, controles (reasignables), juego y datos.
import { useEffect, useState } from 'preact/hooks';
import { audio } from '../../audio/audio';
import { InputManager } from '../../game/input';
import { detectServer } from '../../services/api';
import { profiles } from '../../services/profile';
import { DEFAULT_KEYS, keyLabel, settings, type KeyMap } from '../../services/settings';
import { Backdrop, Btn, Header, Modal, Seg, Toggle, toast } from '../common';
import { useSettings } from '../hooks';

type Tab = 'audio' | 'video' | 'controles' | 'juego' | 'datos';

const ACTIONS: [keyof KeyMap, string][] = [
  ['up', 'Arriba'],
  ['down', 'Abajo'],
  ['left', 'Izquierda'],
  ['right', 'Derecha'],
  ['bomb', 'Bomba'],
  ['attack', 'Ataque'],
  ['hyper', 'Hipercarga'],
  ['emote', 'Emote'],
];

export function SettingsScreen() {
  const s = useSettings();
  const [tab, setTab] = useState<Tab>('audio');
  const [waiting, setWaiting] = useState<{ p: 'p1' | 'p2'; a: keyof KeyMap } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [pads, setPads] = useState(InputManager.gamepadCount());
  const [server, setServer] = useState(s.serverUrl);

  useEffect(() => {
    const id = setInterval(() => setPads(InputManager.gamepadCount()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === 'Escape') {
        setWaiting(null);
        return;
      }
      const keys = { p1: { ...s.keys.p1 }, p2: { ...s.keys.p2 } };
      // si la tecla ya estaba asignada en otra acción, se intercambian
      for (const pl of ['p1', 'p2'] as const) {
        for (const [a] of ACTIONS) {
          if (keys[pl][a] === e.code) keys[pl][a] = keys[waiting.p][waiting.a];
        }
      }
      keys[waiting.p][waiting.a] = e.code;
      settings.set({ keys });
      audio.play('click');
      setWaiting(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [waiting, s.keys]);

  const fullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  };

  const vol = (key: 'master' | 'music' | 'sfx', label: string) => (
    <div class="setting">
      <div class="lbl">{label}</div>
      <span style={{ width: '44px', textAlign: 'right' }}>{Math.round(s[key] * 100)}%</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={s[key]}
        style={{ maxWidth: '260px' }}
        onInput={(e) => settings.set({ [key]: Number((e.target as HTMLInputElement).value) })}
        onChange={() => audio.play(key === 'music' ? 'coin' : 'bomb')}
      />
    </div>
  );

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Ajustes" />
      <div class="screen-body">
        <div class="tabs">
          {(
            [
              ['audio', '🔊 Sonido'],
              ['video', '🖥 Video'],
              ['controles', '🎮 Controles'],
              ['juego', '⚙ Juego'],
              ['datos', '💾 Cuenta y datos'],
            ] as [Tab, string][]
          ).map(([k, n]) => (
            <Btn key={k} variant={tab === k ? 'yellow' : 'ghost'} size="small" onClick={() => setTab(k)}>
              {n}
            </Btn>
          ))}
        </div>
        <div class="panel" style={{ maxWidth: '860px' }}>
          {tab === 'audio' && (
            <>
              {vol('master', 'Volumen general')}
              {vol('music', 'Música')}
              {vol('sfx', 'Efectos de sonido')}
              <div class="setting">
                <div class="lbl">Probar sonidos</div>
                <Btn size="small" variant="ghost" onClick={() => audio.play('explode')}>
                  💥 Explosión
                </Btn>
                <Btn size="small" variant="ghost" onClick={() => audio.play('flagCap')}>
                  🚩 Captura
                </Btn>
              </div>
            </>
          )}
          {tab === 'video' && (
            <>
              <div class="setting">
                <div class="lbl">Pantalla completa</div>
                <Btn size="small" variant="ghost" onClick={fullscreen}>
                  Alternar
                </Btn>
              </div>
              <div class="setting">
                <div class="lbl">
                  Temblor de pantalla<small>Explosiones e impactos sacuden la cámara.</small>
                </div>
                <Seg value={s.shake} options={[{ v: 0, label: 'No' }, { v: 0.5, label: 'Suave' }, { v: 1, label: 'Normal' }]} onChange={(v) => settings.set({ shake: v })} />
              </div>
              <div class="setting">
                <div class="lbl">
                  Reducir animaciones<small>Menos movimiento en menús y efectos.</small>
                </div>
                <Toggle on={s.reducedMotion} onChange={(v) => settings.set({ reducedMotion: v })} />
              </div>
              <div class="setting">
                <div class="lbl">Mostrar FPS</div>
                <Toggle on={s.showFps} onChange={(v) => settings.set({ showFps: v })} />
              </div>
              <div class="setting">
                <div class="lbl">
                  Controles táctiles<small>Joystick y botones en pantalla (celulares y tablets).</small>
                </div>
                <Seg
                  value={s.touch}
                  options={[
                    { v: 'auto', label: 'Automático' },
                    { v: 'on', label: 'Siempre' },
                    { v: 'off', label: 'Nunca' },
                  ]}
                  onChange={(v) => settings.set({ touch: v })}
                />
              </div>
            </>
          )}
          {tab === 'controles' && (
            <>
              <p class="muted" style={{ marginTop: 0 }}>
                Hacé clic en una tecla y presioná la nueva. Jugando solo podés usar las teclas de los dos jugadores. Mandos conectados: <b>{pads}</b> (A bomba, X ataque, B/RB hipercarga, Y emote, Start pausa).
              </p>
              <div class="table-scroll">
                <table class="table">
                  <thead>
                    <tr>
                      <th>Acción</th>
                      <th>Jugador 1</th>
                      <th>Jugador 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ACTIONS.map(([a, n]) => (
                      <tr key={a}>
                        <td>{n}</td>
                        {(['p1', 'p2'] as const).map((pl) => (
                          <td key={pl}>
                            <button class={`keycap ${waiting?.p === pl && waiting.a === a ? 'wait' : ''}`} onClick={() => setWaiting({ p: pl, a })}>
                              {waiting?.p === pl && waiting.a === a ? '...' : keyLabel(s.keys[pl][a])}
                            </button>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div class="row" style={{ marginTop: '12px' }}>
                <Btn size="small" variant="ghost" onClick={() => settings.set({ keys: DEFAULT_KEYS })}>
                  Restaurar teclas
                </Btn>
                <span class="muted" style={{ fontSize: '14px' }}>
                  Además: <span class="kbd">Tab</span> marcador · <span class="kbd">Esc</span>/<span class="kbd">P</span> pausa · <span class="kbd">1</span>-<span class="kbd">4</span> emotes
                </span>
              </div>
            </>
          )}
          {tab === 'juego' && (
            <>
              <div class="setting">
                <div class="lbl">Dificultad por defecto de los bots</div>
                <Seg
                  value={s.difficulty}
                  options={[
                    { v: 0 as const, label: 'Fácil' },
                    { v: 1 as const, label: 'Normal' },
                    { v: 2 as const, label: 'Difícil' },
                    { v: 3 as const, label: 'Experto' },
                  ]}
                  onChange={(v) => settings.set({ difficulty: v })}
                />
              </div>
              <div class="setting">
                <div class="lbl">Números de daño y curación</div>
                <Toggle on={s.damageNumbers} onChange={(v) => settings.set({ damageNumbers: v })} />
              </div>
              <div class="setting">
                <div class="lbl">Nombres sobre los jugadores</div>
                <Toggle on={s.names} onChange={(v) => settings.set({ names: v })} />
              </div>
              <div class="setting">
                <div class="lbl">
                  Modo daltónico<small>El equipo rojo pasa a ser naranja para distinguirlo mejor del azul.</small>
                </div>
                <Toggle on={s.colorblind} onChange={(v) => settings.set({ colorblind: v })} />
              </div>
            </>
          )}
          {tab === 'datos' && (
            <>
              <div class="setting">
                <div class="lbl">
                  Servidor online<small>Dejalo vacío para usar el mismo servidor que sirve el juego. Ej: https://mi-servidor.com</small>
                </div>
                <input class="input" style={{ maxWidth: '300px', fontSize: '15px' }} value={server} placeholder="(mismo servidor)" onInput={(e) => setServer((e.target as HTMLInputElement).value)} />
                <Btn
                  size="small"
                  variant="blue"
                  onClick={async () => {
                    settings.set({ serverUrl: server.trim() });
                    const ok = await detectServer(true);
                    profiles.serverOnline = ok;
                    toast(ok ? 'Servidor conectado' : 'No se encontró el servidor', ok ? 'ok' : 'err');
                  }}
                >
                  Probar
                </Btn>
              </div>
              <div class="setting">
                <div class="lbl">
                  Borrar progreso local<small>Elimina nivel, monedas, inventario y estadísticas guardados en este navegador.</small>
                </div>
                <Btn size="small" variant="red" onClick={() => setConfirmReset(true)}>
                  Borrar
                </Btn>
              </div>
              <div class="setting">
                <div class="lbl">Restaurar ajustes</div>
                <Btn size="small" variant="ghost" onClick={() => settings.reset()}>
                  Restaurar
                </Btn>
              </div>
            </>
          )}
        </div>
      </div>
      {confirmReset && (
        <Modal onClose={() => setConfirmReset(false)}>
          <h3>¿Borrar todo el progreso local?</h3>
          <p>Esta acción no se puede deshacer.</p>
          <div class="row" style={{ justifyContent: 'flex-end' }}>
            <Btn variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancelar
            </Btn>
            <Btn
              variant="red"
              onClick={() => {
                profiles.resetLocal();
                setConfirmReset(false);
                toast('Progreso borrado', 'ok');
              }}
            >
              Sí, borrar
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
