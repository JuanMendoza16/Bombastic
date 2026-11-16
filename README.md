# 💣 Bomberman — Captura la Bandera

**Battle Arena 2D** de PixelForge Studios que mezcla las bombas de Bomberman con **Captura la Bandera**, seis personajes con clases distintas y habilidades especiales llamadas **Hipercargas**. Se juega en el navegador: en PC, notebook, tablet o celular.

> «Un Battle Arena 2D donde dos equipos compiten por capturar la bandera enemiga mientras utilizan bombas, diferentes clases de personajes y habilidades especiales para atacar, defender y controlar el mapa.» — GDD, Concepto final

## Qué incluye

| Área | Contenido |
|---|---|
| **Modos** | Captura la Bandera (principal), Eliminación por rondas, Zona Bombástica (rey de la colina), Batalla Clásica (todos contra todos con muerte súbita), Tutorial interactivo y el **Festival**: 12 niveles con estrellas |
| **Personajes** | Cubert (Tanque), Giga (Defensor), Nova (Support), Cipher (Controlador), Boomslang (Distancia) y Sparks (Veloz), cada uno con ataque, Hipercarga, pasiva, historia y 4 skins |
| **Mapas** | Ruinas, Laberinto, Fábrica (cintas y compuertas), Volcán (grietas de lava) y el campo del tutorial |
| **Jugadores** | Contra bots (4 dificultades), 2 jugadores en la misma compu (teclado o mando) y **online** (partida rápida o salas privadas con código y chat) |
| **Progresión** | Experiencia y niveles, monedas, tienda de cosméticos, inventario (skins, explosiones, emotes), 16 logros, estadísticas e historial |
| **Ranking** | ELO simplificado por equipos, divisiones Bronce → Diamante, ranking global, semanal e histórico |
| **Interfaz** | Logo animado, menús, HUD, marcador, anuncios, registro de eliminaciones, pausa, ajustes (sonido, video, teclas reasignables, daltonismo, controles táctiles) y créditos |
| **Arte y sonido** | Pixel art y animaciones generados por código, efectos y música chiptune sintetizados, sin archivos externos |
| **Backend** | API REST con JWT, roles, recuperación de contraseña, SQLite, auditoría, límites de uso y panel de administración |

## Cómo se juega

| Acción | Jugador 1 | Jugador 2 | Mando |
|---|---|---|---|
| Moverse | `W A S D` | Flechas | Stick / cruceta |
| Poner bomba | `Espacio` | `Enter` | A |
| Atacar | `J` | `Shift der.` | X / RT |
| Hipercarga | `K` | `Ctrl der.` | B / RB |
| Emote | `T` o `1`-`4` | `\` | Y |
| Marcador / Pausa | `Tab` / `Esc` | | Start |

Si jugás solo, funcionan las teclas de los dos jugadores. Todas se pueden cambiar en **Ajustes → Controles**. En celular aparecen un joystick y botones en pantalla.

**Captura la Bandera:** robá la bandera enemiga y llevala a tu base mientras tu bandera está en casa. Si te eliminan, la soltás; tu equipo la recupera tocándola, y si nadie la toca vuelve sola en 15 s. Gana el primero en 3 capturas, o el que tenga más cuando se termina el tiempo. Si empatan en capturas, se desempata por puntos.

## Ejecutar

Hace falta **Node.js 22.5 o superior**.

```bash
npm install
npm run dev          # juego en http://localhost:5173 (sin servidor: bots y local)
npm run dev:server   # en otra terminal: API + online en http://localhost:8080
```

Versión completa (web + online) como en producción:

```bash
npm run build
JWT_SECRET=algo-secreto npm start      # http://localhost:8080
```

Otros comandos:

```bash
npm test             # tests (reglas, IA, seguridad, base de datos, economía, red)
npm run typecheck    # chequeo de tipos
npm run check        # todo lo anterior + build
```

## Publicar en la web

1. **Solo el juego (gratis, sin servidor):** GitHub Pages. Activá *Settings → Pages → Source: GitHub Actions* y hacé push a `main`; el workflow `pages.yml` lo publica. Funcionan los bots, los 2 jugadores locales, el Festival y el progreso guardado en el navegador.
2. **Juego + online:** cualquier hosting de Node con WebSockets.
   - **Docker:** `docker build -t bomberman . && docker run -p 8080:8080 -e JWT_SECRET=... -v bomberman-data:/app/data bomberman`
   - **Render:** *New → Blueprint* con este repo (usa `render.yaml`).
   - **Railway, Fly.io o un VPS:** `npm ci && npm run build && npm start`.

Si la web queda en GitHub Pages y el servidor en otro dominio, definí `CORS_ORIGIN` en el servidor y cargá la dirección en el juego desde *Ajustes → Cuenta y datos → Servidor online*. Las variables disponibles están en [`.env.example`](.env.example).

## Estructura

```
src/shared/     reglas del juego (compartidas por navegador y servidor)
  sim.ts          simulación: movimiento, bombas, ataques, Hipercargas, banderas, modos
  ai.ts           bots (mapa de peligro, búsqueda de caminos, roles por clase)
  balance.ts      hoja de balance: todos los números del juego
  maps.ts         mapas     profile.ts  progresión/logros    catalog.ts  cosméticos
  protocol.ts     mensajes y snapshots del online
src/client/     juego web (Preact + Canvas)
  gfx/            pixel art procedural (personajes, tiles, objetos)
  render/         renderer y partículas     audio/  sonido y música
  game/           loop, controles, sesión local y online (predicción/interpolación)
  ui/             pantallas y HUD           services/  perfil, API, ajustes
server/         Node: HTTP + API REST + WebSocket + SQLite
tests/          tests automáticos (Vitest)
docs/           documentación técnica por departamento
```

## Documentación

- [GDD técnico](docs/gdd-tecnico.md): reglas, números de balance, modos, mapas, progresión y economía.
- [Arquitectura](docs/arquitectura.md): cómo funciona por dentro, red, base de datos (DER) y seguridad.
- [API](docs/api.md) y [colección de Postman](docs/postman_collection.json).
- [Plan de QA](docs/qa.md): tests automáticos, casos de prueba manuales y reporte de bugs.
- [Manual de identidad visual](docs/identidad-visual.md): logo, colores, tipografías y estilo de arte.

## Créditos

**PixelForge Studios**: Game Design, Desarrollo del Videojuego, Arte y Multimedia, Backend Online, Frontend Web, Base de Datos y Seguridad, QA y Testing, y DevOps y Marketing. El listado completo está en la pantalla *Créditos* del juego.
