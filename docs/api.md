# API REST y protocolo online

Base: el mismo servidor que sirve el juego (por defecto `http://localhost:8080`). Todas las respuestas son JSON. Los errores vienen como `{ "error": "mensaje" }` con el código HTTP correspondiente. Hay una [colección de Postman](postman_collection.json) lista para importar.

Autenticación: cabecera `Authorization: Bearer <token>` (el token se obtiene al registrarse o iniciar sesión).

## Salud

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | `{ ok, name, version, online, rooms, playing }` |

## Autenticación

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| POST | `/api/auth/register` | `{ username, email, password }` | `201 { token, user, profile }` |
| POST | `/api/auth/login` | `{ username, password }` (acepta el usuario o el email) | `{ token, user, profile }` |
| POST | `/api/auth/forgot` | `{ email }` | `{ ok, message }`: el código de 30 minutos queda en el log del servidor (`password_reset_code`) hasta que se integre un servicio de correo |
| POST | `/api/auth/reset` | `{ token, password }` | `{ ok }` |

Validaciones:

- **Usuario:** de 3 a 16 caracteres (letras, números, `_`, `.` y `-`), único sin distinguir mayúsculas.
- **Email:** válido y único.
- **Contraseña:** de 6 a 128 caracteres.
- **Límite:** 10 intentos por minuto por IP.

## Perfil (requiere token)

| Método | Ruta | Cuerpo | Respuesta |
|---|---|---|---|
| GET | `/api/me` | | `{ user, profile }` |
| PUT | `/api/me/profile` | `{ name?, favorite? }` | `{ profile }` |
| POST | `/api/me/equip` | `{ key, slot? }`, por ejemplo `skin:tanque:hielo`, `fx:azul` o `emote:4` (con `slot` de 0 a 3) | `{ profile }` |
| GET | `/api/me/history` | | `{ matches }`: partidas online |
| POST | `/api/shop/buy` | `{ key }` | `{ profile }`: el servidor valida el precio y el saldo |
| POST | `/api/matches/offline` | `MatchSummary` (resultado de una partida contra bots) | `{ profile, rewards }`: valores con tope según la duración, máximo 3 envíos cada ~20 s |

## Ranking

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/ranking?type=global\|semanal\|historico` | `{ rows: [{ rank, name, elo, level, value }] }` |

## Administración (rol `admin`)

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/stats` | Usuarios, partidas, conexiones, salas y distribución por modo, mapa y clase (con % de victoria), más la actividad de los últimos 7 días |
| GET | `/api/admin/users?q=` | Búsqueda de usuarios |
| POST | `/api/admin/users/:id/ban` | Suspender |
| POST | `/api/admin/users/:id/unban` | Rehabilitar |
| POST | `/api/admin/users/:id/role` | `{ role: "admin" \| "player" }` |
| GET | `/api/admin/matches` | Últimas 100 partidas |

## WebSocket `/ws`

Mensajes JSON con un campo `t` que indica el tipo. Tipos completos: [`src/shared/protocol.ts`](../src/shared/protocol.ts).

**Cliente → servidor**

| `t` | Datos | Uso |
|---|---|---|
| `hello` | `token?, name, v` | Primer mensaje (versión del protocolo `v = 1`) |
| `lobby` | | Pide la lista de salas públicas |
| `quick` | `mode?` | Partida rápida (se completa con bots; empieza en 12 s o antes si se llena) |
| `create` | `settings` | Crea una sala privada; el creador es el anfitrión |
| `join` | `code` | Entra a una sala con el código de 5 caracteres |
| `leave` | | Sale de la sala |
| `pick` | `cls, skin, fx` | Elige personaje (único por equipo) |
| `team` | `team` | Cambia de equipo |
| `ready` | `ready` | Listo o no listo |
| `settings` | `settings` | El anfitrión cambia modo, mapa, tamaño, bots, mejoras o visibilidad |
| `start` | | El anfitrión inicia la partida (todos tienen que estar listos) |
| `chat` | `text` | Mensaje de hasta 120 caracteres (se filtran palabras) |
| `in` | `i: [[seq, dir, bomba, ataque, hiper, emote], ...]` | Entradas del jugador, una por tick |
| `ping` | `ts` | Medición de latencia |

**Servidor → cliente**

| `t` | Datos |
|---|---|
| `welcome` | `conn, user, online` |
| `rooms` | Lista de salas |
| `room` | Estado de la sala (miembros, reglas, cuenta regresiva) y tu id |
| `chat` | `from, text, sys?` |
| `start` | `config, you, init`: estado inicial completo |
| `s` | Snapshot compacto (20 Hz) y los eventos desde el anterior |
| `end` | Resultado final; con cuenta, también las `rewards` y el `profile` actualizado |
| `error` | Mensaje para mostrar |
| `pong` | `ts` |

Si un jugador se desconecta en medio de una partida, un bot controla a su personaje. Si vuelve a conectarse con su cuenta, recupera el control.
