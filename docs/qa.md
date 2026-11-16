# Plan de QA y Testing

Sigue el proceso definido por el departamento de QA: smoke test, pruebas funcionales, de mecánicas, de integración, de seguridad y de rendimiento, registro de bugs, re-test, regresión y aceptación.

## 1. Pruebas automáticas

```bash
npm test          # Vitest: 26 pruebas
npm run typecheck # tipos
npm run build     # compilación
```

GitHub Actions (`.github/workflows/ci.yml`) las corre en cada push y cada pull request.

| Archivo | Qué verifica |
|---|---|
| `tests/sim.test.ts` | Mapas válidos, simétricos y conectados; cuenta regresiva; colisiones con paredes; mecha y daño de bombas; robo y captura de bandera; bandera que vuelve sola; ataque e Hipercarga de las 6 clases; rondas de Eliminación; equipos y muerte súbita de Batalla Clásica; puntos de Zona; fin por tiempo; determinismo con semilla |
| `tests/server.test.ts` | Hash de contraseñas; JWT (firma alterada o vencida); límite de peticiones; limpieza de texto; unicidad de usuarios; ranking global y semanal; códigos de recuperación de un solo uso; niveles y recompensas; ELO; logros; validación de la tienda; snapshots de red que reproducen el estado del servidor |

**Balance:** `npx tsx scripts/balance.ts ctf 60` simula partidas entre bots y muestra el % de victoria, el K/D y las capturas por clase.

**Pruebas de extremo a extremo:** para lanzar partidas cortas desde Playwright o desde la consola del navegador se puede usar el gancho de QA:

```js
bomberman.startLocal({ mode: 'ctf', map: 'ruinas', teamSize: 2, difficulty: 1, timeLimit: 30,
  humans: [{ name: 'QA', cls: 'veloz', skin: 'base', fx: 'clasico', team: 0 }] })
```

## 2. Smoke test (antes de probar cada versión)

1. La página carga, aparece el splash de PixelForge y después el logo.
2. Con una tecla se entra al menú y suena la música.
3. **Jugar → Elegir personaje → ¡A jugar!** muestra la cuenta 3-2-1 y se puede mover y poner bombas.
4. `Esc` pausa y **Abandonar** vuelve al menú.
5. Con servidor: `/api/health` responde `ok: true`.

## 3. Casos de prueba manuales

| ID | Área | Pasos | Resultado esperado |
|---|---|---|---|
| F-01 | Registro | Crear una cuenta con datos válidos | Entra con sesión iniciada; el perfil aparece como ONLINE |
| F-02 | Registro | Usuario de 2 letras, email inválido o contraseña corta | Mensaje de error claro; no se crea la cuenta |
| F-03 | Registro | Usuario ya existente (con otras mayúsculas) | «Ese nombre de usuario ya existe» |
| F-04 | Login | Contraseña incorrecta o usuario inexistente | «Usuario o contraseña incorrectos» (no dice cuál de los dos) |
| F-05 | Login | 11 intentos seguidos | Bloqueo temporal (429) |
| F-06 | Sesión | Cerrar sesión desde Perfil | Vuelve al perfil local |
| F-07 | Recuperación | Olvidé mi contraseña, código del log, nueva contraseña | Se puede ingresar con la nueva; el código no sirve una segunda vez |
| F-08 | Partidas | Terminar una partida contra bots | Pantalla de resultados con MVP, tabla, XP, monedas y ELO de la liga IA |
| F-09 | Partidas | Terminar una partida online con cuenta | El servidor guarda la partida; el ELO online cambia; aparece en el ranking y en el panel admin |
| F-10 | Ranking | Ver Global, Semanal e Histórico | Orden correcto y la fila propia resaltada |
| F-11 | Tienda | Comprar con y sin monedas suficientes | Descuenta monedas o muestra «No te alcanzan las monedas» |
| F-12 | Personalizar | Equipar una skin, un efecto y emotes | Se ven en la partida (skin, color de la explosión, burbuja de emote con las teclas 1 a 4) |
| M-01 | Mecánicas | Caminar contra una pared | No la atraviesa; en las esquinas desliza |
| M-02 | Mecánicas | Poner una bomba y quedarse encima | Recibe 50% del daño; puede salir de la bomba pero no volver a entrar |
| M-03 | Mecánicas | Bomba al lado de otra bomba | Explosión en cadena |
| M-04 | Mecánicas | Robar la bandera con la propia robada | No captura hasta recuperar la propia |
| M-05 | Mecánicas | Morir con la bandera | Cae; un aliado la devuelve y un enemigo la vuelve a robar; a los 15 s vuelve sola |
| M-06 | Mecánicas | Usar la Hipercarga de cada clase | El efecto coincide con la descripción (ver GDD técnico) |
| M-07 | Mecánicas | Barrera de Giga frente a una bomba enemiga | La explosión no la atraviesa; los aliados sí pasan |
| M-08 | Mecánicas | Fábrica: pararse en una cinta | Te arrastra; las compuertas no se cierran con alguien encima |
| M-09 | Mecánicas | Volcán: quedarse en la lava durante la erupción | Recibe daño; hay aviso 1,5 s antes |
| M-10 | Mecánicas | Batalla Clásica hasta la muerte súbita | Caen bloques en espiral; el que queda debajo es eliminado |
| M-11 | Mecánicas | Presionar bomba o ataque muy rápido | No se ponen más bombas que el máximo; se respeta el tiempo de recarga |
| M-12 | Mecánicas | Recibir daño justo cuando termina el tiempo | La partida termina una sola vez y el resultado es coherente |
| U-01 | Experiencia | Tutorial completo | 7 pasos con marcas en el mapa; al final se desbloquea el logro «Recluta» |
| U-02 | Experiencia | Cambiar teclas y jugar | Las nuevas teclas funcionan y los carteles de ayuda las muestran |
| U-03 | Experiencia | Resoluciones de 1920×1080, 1366×768 y celular horizontal | El mapa entra completo y el HUD no tapa lo importante; en táctil aparecen los controles |
| U-04 | Experiencia | Modo daltónico | El equipo rojo pasa a naranja en el HUD, los anillos y las bases |
| I-01 | Juego ↔ Backend | Cortar la red durante unos segundos en una partida online | Aviso de conexión perdida y reintento automático; con cuenta, al reconectarse vuelve a la partida. Si el servidor se reinició, la partida se pierde y se sale con Pausa → Abandonar |
| I-02 | Juego ↔ Backend | Cerrar la pestaña de un jugador online | Un bot lo reemplaza; si vuelve a entrar con su cuenta, recupera el control |
| I-03 | Backend ↔ BD | Reiniciar el servidor | Cuentas, perfiles, ranking y partidas persisten |
| S-01 | Seguridad | Llamar a `/api/admin/stats` con una cuenta de jugador | 403 |
| S-02 | Seguridad | Token alterado o vencido | 401 |
| S-03 | Seguridad | Mandar un resultado offline con 999 eliminaciones | Se recorta al tope según la duración |
| S-04 | Seguridad | Chat con `<script>` | Se muestra como texto, sin ejecutarse |
| R-01 | Rendimiento | 6 salas con 8 jugadores durante 10 minutos | Sin caída del servidor; tick estable |

## 4. Reporte de bugs

Usar la plantilla de *Issues* de GitHub con estos campos: ID, título, fecha, versión (se ve en `/api/health`), severidad (baja, media, alta o crítica), prioridad, pasos para reproducir, resultado esperado, resultado obtenido, evidencia (captura, video o log) y estado (abierto, en proceso, solucionado o cerrado).

Ciclo: **bug encontrado → desarrollo lo corrige → QA vuelve a probar → bug cerrado.** Si sigue pasando, se reabre. Antes de cada versión se corre la batería completa (regresión).
