import '@fontsource/lilita-one/400.css';
import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import './styles.css';
import { render } from 'preact';
import { App } from './ui/app';
import { nav } from './ui/nav';
import { startLocal } from './ui/screens/launch';
import { FESTIVAL } from './data/festival';
import { net } from './game/net';

render(<App />, document.getElementById('app')!);

// Gancho para pruebas automatizadas (QA): permite lanzar partidas cortas.
(window as unknown as Record<string, unknown>).bomberman = {
  nav,
  startLocal,
  festival: FESTIVAL,
  net,
  version: __APP_VERSION__,
};

// Evita el menú contextual y el zoom accidental en móviles durante el juego.
window.addEventListener('contextmenu', (e) => {
  if ((e.target as HTMLElement).tagName === 'CANVAS') e.preventDefault();
});
