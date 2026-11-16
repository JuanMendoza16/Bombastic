// Registro, inicio de sesión y recuperación de contraseña.
import { useEffect, useState } from 'preact/hooks';
import { profiles } from '../../services/profile';
import { Backdrop, Btn, Header, Logo, toast } from '../common';
import { nav } from '../nav';

type Mode = 'login' | 'register' | 'forgot' | 'reset';

export function AuthScreen({ params }: { params: Record<string, unknown> }) {
  const [mode, setMode] = useState<Mode>((params.mode as Mode) ?? 'login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(profiles.serverOnline);

  useEffect(() => {
    const id = setInterval(() => setOnline(profiles.serverOnline), 500);
    return () => clearInterval(id);
  }, []);

  const submit = async (e?: Event) => {
    e?.preventDefault();
    setError('');
    if (mode === 'register' && password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        await profiles.login(username, password);
        toast(`¡Hola, ${username}!`, 'ok');
        nav.back();
      } else if (mode === 'register') {
        await profiles.register(username, email, password);
        toast('¡Cuenta creada!', 'ok');
        nav.back();
      } else if (mode === 'forgot') {
        const r = await profiles.forgot(email);
        toast(r.message, 'ok');
        setMode('reset');
      } else {
        await profiles.resetPassword(token, password);
        toast('Contraseña actualizada. Ya podés ingresar.', 'ok');
        setMode('login');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="screen">
      <Backdrop />
      <Header title="Cuenta" />
      <div class="screen-body center" style={{ flexDirection: 'column', gap: '20px' }}>
        <Logo size={56} ribbon={false} />
        <form class="panel" style={{ width: 'min(460px, 94vw)' }} onSubmit={submit}>
          {!online && (
            <div class="panel" style={{ background: '#5a1f2a', marginBottom: '12px', padding: '10px' }}>
              No hay conexión con el servidor online. Podés seguir jugando con tu perfil local; el progreso se guarda en este navegador.
            </div>
          )}
          <div class="tabs">
            <Btn type="button" size="small" variant={mode === 'login' ? 'yellow' : 'ghost'} onClick={() => setMode('login')}>
              Ingresar
            </Btn>
            <Btn type="button" size="small" variant={mode === 'register' ? 'yellow' : 'ghost'} onClick={() => setMode('register')}>
              Crear cuenta
            </Btn>
          </div>
          {(mode === 'login' || mode === 'register') && (
            <div class="field">
              <label>Usuario</label>
              <input class="input" value={username} maxLength={16} autoComplete="username" onInput={(e) => setUsername((e.target as HTMLInputElement).value)} required minLength={3} />
            </div>
          )}
          {(mode === 'register' || mode === 'forgot') && (
            <div class="field">
              <label>Email</label>
              <input class="input" type="email" value={email} autoComplete="email" onInput={(e) => setEmail((e.target as HTMLInputElement).value)} required />
            </div>
          )}
          {mode === 'reset' && (
            <div class="field">
              <label>Código de recuperación</label>
              <input class="input" value={token} onInput={(e) => setToken((e.target as HTMLInputElement).value)} required />
            </div>
          )}
          {mode !== 'forgot' && (
            <div class="field">
              <label>{mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'}</label>
              <input class="input" type="password" value={password} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} onInput={(e) => setPassword((e.target as HTMLInputElement).value)} required minLength={6} />
            </div>
          )}
          {mode === 'register' && (
            <div class="field">
              <label>Repetir contraseña</label>
              <input class="input" type="password" value={password2} autoComplete="new-password" onInput={(e) => setPassword2((e.target as HTMLInputElement).value)} required minLength={6} />
            </div>
          )}
          {mode === 'register' && <div class="muted" style={{ fontSize: '13px', marginBottom: '10px' }}>La cuenta guarda tu progreso en el servidor y te suma al ranking online. Tu perfil local sigue disponible cuando jugás sin sesión.</div>}
          {error && <div style={{ color: '#ff7a7a', marginBottom: '10px', fontWeight: 700 }}>{error}</div>}
          <Btn type="submit" size="big" style={{ width: '100%' }} disabled={busy || !online}>
            {busy ? '...' : mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear cuenta' : mode === 'forgot' ? 'Enviar código' : 'Cambiar contraseña'}
          </Btn>
          <div class="row" style={{ justifyContent: 'center', marginTop: '12px' }}>
            {mode === 'login' && (
              <a href="#" style={{ color: 'var(--cyan)' }} onClick={(e) => { e.preventDefault(); setMode('forgot'); }}>
                ¿Olvidaste tu contraseña?
              </a>
            )}
            {(mode === 'forgot' || mode === 'reset') && (
              <a href="#" style={{ color: 'var(--cyan)' }} onClick={(e) => { e.preventDefault(); setMode('login'); }}>
                Volver a ingresar
              </a>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
