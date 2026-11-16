// Personajes (galería con historia), Cómo jugar y Créditos.
import { useEffect, useState } from 'preact/hooks';
import { BOMB, CLASSES, HYPER_GAIN, MODES, POWERUPS, RULES, SCORE } from '../../../shared/balance';
import { CLASS_IDS, type ClassId, type PowerUpKind } from '../../../shared/types';
import type { Anim } from '../../gfx/characters';
import { SKINS } from '../../gfx/characters';
import { Sprites, bannerURL, onAssetsChange, portraitURL, spriteURL } from '../../gfx/sprites';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Header, Logo, Pips, StudioLogo } from '../common';

const ANIMS: Anim[] = ['idle', 'walk', 'attack', 'cast', 'win'];
const ANIM_N: Record<string, number> = { idle: 4, walk: 6, attack: 3, cast: 3, win: 4 };
const ANIM_LABEL: Record<string, string> = { idle: 'Quieto', walk: 'Caminar', attack: 'Ataque', cast: 'Hipercarga', win: 'Festejo' };

export function CharactersScreen() {
  const [tab, setTab] = useState<'personajes' | 'reglas'>('personajes');
  const [cls, setCls] = useState<ClassId>(profiles.profile.favorite);
  const [skin, setSkin] = useState('base');
  const [anim, setAnim] = useState<Anim>('walk');
  const [dir, setDir] = useState(0);
  const [f, setF] = useState(0);
  const [, setVer] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setF((x) => x + 1), 140);
    const off = onAssetsChange(() => setVer((v) => v + 1));
    return () => {
      clearInterval(id);
      off();
    };
  }, []);
  const c = CLASSES[cls];
  const frame = Sprites.char(cls, skin, anim === 'win' ? 0 : dir, anim, f % ANIM_N[anim]);
  return (
    <div class="screen">
      <Backdrop />
      <Header title={tab === 'personajes' ? 'Personajes' : 'Cómo jugar'}>
        <Btn variant={tab === 'personajes' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('personajes')}>
          Personajes
        </Btn>
        <Btn variant={tab === 'reglas' ? 'yellow' : 'ghost'} size="small" onClick={() => setTab('reglas')}>
          Cómo jugar
        </Btn>
      </Header>
      <div class="screen-body">
        {tab === 'personajes' && (
          <div class="grid layout-sidebar-main">
            <div class="char-grid">
              {CLASS_IDS.map((id) => (
                <button
                  key={id}
                  class={`char-tile ${id === cls ? 'sel' : ''}`}
                  style={{ '--cc': CLASSES[id].color + '66' } as never}
                  onClick={() => {
                    setCls(id);
                    setSkin('base');
                  }}
                >
                  <img src={portraitURL(id, 'base', 'idle', 0, 3)} alt="" />
                  <div class="cname">{CLASSES[id].hero}</div>
                </button>
              ))}
            </div>
            <div class="panel">
              <div class="grid layout-char-detail" style={{ gap: '18px' }}>
                <div style={{ textAlign: 'center' }}>
                  <img class="poster-preview" src={bannerURL(cls, skin, 'poster')} style={{ marginBottom: '8px' }} alt={c.hero} />
                  <div style={{ background: 'radial-gradient(circle at 50% 70%, ' + c.color + '55, #1a1026 70%)', border: '3px solid var(--ink)', padding: '6px' }}>
                    <img src={spriteURL(frame, 4)} style={{ width: 'min(180px, 100%)', imageRendering: 'pixelated' }} alt="" />
                  </div>
                  <div class="row wrap" style={{ gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                    {ANIMS.map((a) => (
                      <Btn key={a} size="small" variant={anim === a ? 'yellow' : 'ghost'} onClick={() => setAnim(a)}>
                        {ANIM_LABEL[a]}
                      </Btn>
                    ))}
                  </div>
                  <div class="row wrap" style={{ gap: '4px', justifyContent: 'center', marginTop: '6px' }}>
                    {['↓', '↑', '←', '→'].map((l, i) => (
                      <Btn key={l} size="small" variant={dir === i ? 'blue' : 'ghost'} onClick={() => setDir(i)}>
                        {l}
                      </Btn>
                    ))}
                  </div>
                  <div class="row wrap" style={{ gap: '4px', justifyContent: 'center', marginTop: '8px' }}>
                    {SKINS[cls].map((s) => (
                      <button key={s.id} class={`card ${skin === s.id ? 'sel' : ''}`} style={{ padding: '2px', width: '54px' }} onClick={() => setSkin(s.id)} title={s.name}>
                        <img src={portraitURL(cls, s.id, 'idle', 0, 1)} style={{ width: '100%', imageRendering: 'pixelated' }} alt="" />
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ minInlineSize: 0 }}>
                  <div class="hero-detail-title" style={{ color: c.color }}>
                    {c.hero}
                  </div>
                  <div class="row wrap" style={{ gap: '6px' }}>
                    <span class="tag" style={{ background: c.color, color: '#1a1026' }}>
                      Clase {c.className}
                    </span>
                    <span class="tag">{c.species}</span>
                    <span class="tag">{c.origin}</span>
                  </div>
                  <p style={{ lineHeight: 1.5 }}>{c.lore}</p>
                  <div class="grid layout-two-col" style={{ gap: '12px' }}>
                    <div>
                      {(
                        [
                          ['Vida', c.bars.vida],
                          ['Daño', c.bars.dano],
                          ['Velocidad', c.bars.velocidad],
                          ['Alcance', c.bars.alcance],
                          ['Control', c.bars.control],
                        ] as [string, number][]
                      ).map(([n, v]) => (
                        <div class="stat-row" key={n}>
                          <span>{n}</span>
                          <Pips n={v} color={c.color} />
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: '14px', lineHeight: 1.5 }}>
                      <div>
                        <b style={{ color: '#ffd23f' }}>Función:</b> {c.role}
                      </div>
                      <div>
                        <b style={{ color: '#ffd23f' }}>Ataque:</b> {c.attack.name} ({c.attack.damage} de daño, {c.attack.range} casillas)
                      </div>
                      <div>
                        <b style={{ color: '#ffd23f' }}>Hipercarga «{c.hyper.name}»:</b> {c.hyper.desc}
                      </div>
                      <div>
                        <b style={{ color: '#ffd23f' }}>Pasiva:</b> {c.passive}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {tab === 'reglas' && <HowTo />}
      </div>
    </div>
  );
}

function HowTo() {
  const pu = (k: PowerUpKind) => spriteURL(Sprites.powerup(k, 0), 2);
  return (
    <div class="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      <div class="panel">
        <h3>🚩 Captura la Bandera</h3>
        <ul style={{ lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
          <li>Dos equipos, cada uno con su base y su bandera.</li>
          <li>Tocá la bandera enemiga para robarla y llevala a tu base.</li>
          <li>Solo podés capturar si tu propia bandera está en tu base.</li>
          <li>Si te eliminan con la bandera, la soltás. Tu equipo la recupera tocándola; si nadie la toca, vuelve sola en {RULES.flagReturnTime} s.</li>
          <li>El portador va un poco más lento (menos Maira).</li>
          <li>Gana el primero en {MODES.ctf.defaultScore} capturas o quien tenga más al terminar el tiempo. Empate: decide el total de puntos.</li>
          <li>Reaparecés en tu base a los {RULES.respawn} s, con {RULES.spawnInvuln} s de invulnerabilidad.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>💣 Bombas</h3>
        <ul style={{ lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
          <li>Todos los personajes ponen bombas. Explotan a los {BOMB.fuse} s en forma de cruz ({BOMB.range} casillas de alcance).</li>
          <li>Hacen {BOMB.damage} de daño a los enemigos y la mitad a vos. No dañan a tus aliados.</li>
          <li>Rompen bloques de madera/roca y hacen explotar otras bombas en cadena.</li>
          <li>Bloquean el camino: ¡usalas para defender tu bandera o cortar la huida del ladrón!</li>
          <li>En Captura y Zona, los bloques rotos vuelven a aparecer a los {RULES.blockRegen} s.</li>
        </ul>
      </div>
      <div class="panel">
        <h3>⚡ Hipercarga</h3>
        <p style={{ marginTop: 0 }}>Cada personaje tiene una habilidad especial. Se carga jugando:</p>
        <ul style={{ lineHeight: 1.6, paddingLeft: '18px', margin: 0 }}>
          <li>Dañar enemigos · Eliminar (+{HYPER_GAIN.kill}) · Asistir (+{HYPER_GAIN.assist})</li>
          <li>Curar aliados · Defender la bandera (+{HYPER_GAIN.defend})</li>
          <li>Robar (+{HYPER_GAIN.takeFlag}), capturar (+{HYPER_GAIN.capture}) o recuperar (+{HYPER_GAIN.returnFlag}) banderas</li>
        </ul>
        <p>Cuando la barra está llena, activala en el mejor momento.</p>
      </div>
      <div class="panel">
        <h3>🏆 Puntos</h3>
        <div class="table-scroll">
          <table class="table">
            <tbody>
              {(
                [
                  ['Capturar la bandera', SCORE.capture],
                  ['Eliminar a un enemigo', SCORE.kill],
                  ['Recuperar tu bandera', SCORE.returnFlag],
                  ['Defender la bandera', SCORE.defend],
                  ['Asistencia', SCORE.assist],
                  ['Robar la bandera', SCORE.takeFlag],
                  ['Cada 25 de daño', SCORE.damage],
                  ['Cada 50 de curación', SCORE.support],
                ] as [string, number][]
              ).map(([k, v]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td class="num">+{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div class="panel">
        <h3>🎁 Mejoras (modos con mejoras)</h3>
        {(Object.keys(POWERUPS) as PowerUpKind[]).map((k) => (
          <div key={k} class="row" style={{ margin: '6px 0' }}>
            <img src={pu(k)} style={{ width: '40px', imageRendering: 'pixelated' }} alt="" />
            <div>
              <b>{POWERUPS[k].name}</b>
              <div class="muted" style={{ fontSize: '14px' }}>{POWERUPS[k].desc}</div>
            </div>
          </div>
        ))}
        <div class="muted" style={{ fontSize: '14px' }}>Aparecen al romper bloques. Se pierden al morir.</div>
      </div>
      <div class="panel">
        <h3>🎮 Otros modos</h3>
        {(['eliminacion', 'zona', 'clasica'] as const).map((m) => (
          <div key={m} style={{ marginBottom: '8px' }}>
            <b style={{ color: '#ffd23f' }}>{MODES[m].name}:</b> {MODES[m].desc}
          </div>
        ))}
      </div>
    </div>
  );
}

const TEAM: [string, string[]][] = [
  ['Game Design', ['Nahuel Ancelmo', 'Gabriel Vázquez', 'Santiago Albertarelli', 'Lara Bouso', 'Lucas Bonavera']],
  ['Desarrollo del Videojuego', ['Tobias Vera', 'Santiago Albertarelli', 'Juan Mendoza']],
  ['Arte y Multimedia', ['Rolando Quispe', 'Luz Huanca', 'Belen Fernandez', 'Damian Orellana']],
  ['Backend Online', ['Joaquín Herreros', 'Tobias Vera', 'Juan Jimenez', 'Juan Mendoza', 'Ezequiel Charca']],
  ['Frontend Web', ['Rachael Nicole Choque', 'Thiago Ezequiel Angrisani', 'Kevin Machaca', 'Leonardo Huaman', 'Kevin Sunavi']],
  ['Base de Datos y Seguridad', ['Ezequiel Portuguez', 'Tiago López', 'Emiliano Buttarelli']],
  ['QA y Testing', ['Dante Battiato', 'Ramiro Miraglia', 'Fernando Faccini']],
  ['DevOps y Marketing', ['Evelyn Vazquez', 'Nahuel Ancelmo', 'Luciano Campos']],
];

export function CreditsScreen() {
  return (
    <div class="screen">
      <Backdrop />
      <Header title="Créditos" />
      <div class="screen-body" style={{ textAlign: 'center' }}>
        <Logo size={70} />
        <div style={{ margin: '26px 0 10px' }}>
          <StudioLogo />
          <div class="studio-name">PIXELFORGE STUDIOS</div>
        </div>
        <div class="cards" style={{ maxWidth: '1100px', margin: '10px auto', textAlign: 'left' }}>
          {TEAM.map(([dep, people]) => (
            <div key={dep} class="card" style={{ cursor: 'default' }}>
              <h4>{dep}</h4>
              {people.map((n) => (
                <div key={n} style={{ marginTop: '4px' }}>
                  {n}
                </div>
              ))}
            </div>
          ))}
        </div>
        <p class="muted" style={{ maxWidth: '760px', margin: '18px auto', lineHeight: 1.5 }}>
          Personajes creados por Arte y Multimedia: Cubert, Maira, Rango, Wimmi, Giga y Vaskil. Diseño del juego basado en el GDD de Game Design: Bomberman + Captura la Bandera con clases e Hipercargas. Arte en pixel art, música y efectos de sonido generados por código.
        </p>
      </div>
    </div>
  );
}
