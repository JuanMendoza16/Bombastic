# GDD técnico — Bomberman: Captura la Bandera

Este documento completa el GDD de Game Design con **los números y reglas concretas implementadas**. Todos los valores se ajustan en un solo archivo: [`src/shared/balance.ts`](../src/shared/balance.ts).

Unidades: las distancias se miden en **casillas** (1 casilla = 32 px) y los tiempos en **segundos**. La simulación corre a 60 ticks por segundo.

## 1. Reglas generales

| Regla | Valor |
|---|---|
| Movimiento | 4 direcciones con ayuda en las esquinas (estilo Bomberman) |
| Colisión del jugador | radio 0,38 casillas; los jugadores no chocan entre sí |
| Reaparición (Captura y Zona) | 4 s en la propia base, con 2 s de invulnerabilidad (se pierde al atacar o poner bomba) |
| Fuego amigo | desactivado (tus bombas sí te dañan al 50%) |
| Mejoras | se pierden al morir |
| Cuenta regresiva inicial | 3 s |
| Asistencia | haber dañado a la víctima en los últimos 6 s |

### Bombas (todas las clases)

| Parámetro | Valor |
|---|---|
| Bombas simultáneas iniciales | 1 (máximo 5 con mejoras) |
| Mecha | 2,5 s |
| Alcance | 2 casillas en cruz (máximo 6 con mejoras) |
| Daño | 55 (50% a uno mismo) |
| Duración de las llamas | 0,55 s (bloquean el paso) |
| Interacciones | rompe el primer bloque de cada brazo, detona otras bombas en cadena, destruye mejoras, las paredes y las barreras enemigas la frenan |

### Bandera (Captura la Bandera)

- Se roba **tocándola**. El portador va a velocidad ×0,85 (Sparks no pierde velocidad).
- **Captura:** el portador entra en el área 3×3 de su base y su propia bandera está en casa.
- Si eliminan al portador, la bandera cae en su casilla. Si la toca un aliado del dueño, **vuelve** (+100 puntos); si la toca un enemigo, **la vuelve a robar**. Si nadie la toca, vuelve sola a los **15 s**.
- Victoria: primero en **3 capturas**, o más capturas al terminar los **5 minutos**. Empate: gana quien tenga más **puntos de equipo**; si persiste, es empate.

## 2. Clases y personajes

| Clase | Personaje | Vida | Velocidad (casillas/s) | Ataque | Hipercarga | Pasiva |
|---|---|---|---|---|---|---|
| Tanque | Cubert | 210 | 3,1 | Puñetazo (cuerpo a cuerpo): 32 de daño, 1,35 casillas, cada 0,65 s, empuja | **Impacto:** 45 de daño en radio 2,7, empuja, aturde 0,45 s y rompe los bloques de alrededor | −15% de daño de bombas |
| Defensor | Giga | 175 | 3,45 | Onda de escudo: 22 de daño, 2,2 casillas, cada 0,7 s, empuja | **Barrera:** muro de 3 casillas durante 6 s; bloquea a los enemigos, sus disparos y sus explosiones; los aliados lo atraviesan | −25% de daño dentro de su base |
| Support | Nova | 120 | 3,9 | Dron médico (proyectil): 13 de daño, 4,5 casillas; **cura 14** a los aliados que toca | **Zona de recuperación:** radio 2,6 durante 5 s; cura 22 de vida por segundo y quita ralentizaciones | Aliados cercanos: +3 de vida por segundo |
| Controlador | Cipher | 115 | 3,9 | Glifo (proyectil): 17 de daño, 4,5 casillas; ralentiza al 65% durante 1,6 s | **Campo de bloqueo:** radio 2,6 durante 6 s; los enemigos van al 42% de velocidad | Sus bombas ralentizan al 60% |
| Distancia | Boomslang | 95 | 3,9 | Rifle de pulso (proyectil): 26 de daño, 7,5 casillas, cada 0,85 s | **Disparo perforante:** 6 s de disparos que atraviesan enemigos y bloques, +15% de daño y +2,5 de alcance | Sus disparos detonan bombas |
| Veloz | Sparks | 82 | 5,0 | Chispazo (cuerpo a cuerpo): 12 de daño, 1,6 casillas, cada 0,32 s | **Impulso:** embestida de ~3,4 casillas y ×1,6 de velocidad durante 4 s | No pierde velocidad con la bandera |

Los ataques se hacen en la dirección en la que mira el personaje. Los proyectiles se frenan con paredes, bloques y barreras enemigas.

**Nota de diseño:** en la ficha de G5, Cipher no tenía descripción visual. Se definió como una figura encapuchada de energía violeta, con una máscara en forma de cerradura (por su nombre, *cifrado*), aletas en la capucha, manos flotantes y tres glifos que orbitan a su alrededor. Además, el origen de Cubert se renombró «el Mundo Cúbico» para no usar una marca registrada.

### Balance verificado

Se simularon partidas de 3 contra 3 entre bots en dificultad Difícil, con clases al azar (60 de Captura y 40 de cada otro modo). El porcentaje de victorias por clase quedó entre **43% y 60% en Captura**, dentro del margen estadístico. Las diferencias por modo son intencionales: Sparks rinde en Captura (1,4 capturas por partida) y es débil en Eliminación, igual que en el GDD. Para repetir la prueba: `npx tsx scripts/balance.ts ctf 60`.

## 3. Hipercarga

La barra va de 0 a 100 y se activa en el momento que el jugador elige.

| Acción | Carga |
|---|---|
| Dañar enemigos | +0,34 por punto de daño |
| Curar aliados | +0,4 por punto curado |
| Eliminar | +20 |
| Asistencia | +10 |
| Defender la bandera (eliminar cerca de tu bandera o al portador) | +15 |
| Robar la bandera | +10 |
| Capturar | +30 (aliados cercanos: +15) |
| Recuperar la bandera | +15 |
| Romper un bloque | +1,5 |
| Estar en la zona (Zona Bombástica) | +2 por segundo |

## 4. Puntuación (GDD, sección 10)

| Acción | Puntos |
|---|---|
| Capturar la bandera | +500 |
| Eliminar enemigo | +100 |
| Recuperar la bandera | +100 |
| Defender la bandera | +50 |
| Asistencia | +50 |
| Robar la bandera | +50 |
| Dañar enemigo | +25 cada 25 de daño |
| Curación | +25 cada 50 de vida curada |
| Estar en la zona (por segundo) | +10 |
| Ganar una ronda | +100 |
| Romper un bloque | +5 |

## 5. Modos de juego

| Modo | Equipos | Duración | Para ganar | Reaparición | Mejoras |
|---|---|---|---|---|---|
| **Captura la Bandera** | 2 (1 a 4 por equipo) | 5 min | 3 capturas | Sí | No (opcional) |
| **Eliminación** | 2 | 90 s por ronda | 3 rondas | No | Sí |
| **Zona Bombástica** | 2 | 4 min | 100 puntos | Sí (4 s) | No (opcional) |
| **Batalla Clásica** | Todos contra todos (2 a 6) | 2 min por ronda | 2 rondas | No | Sí |
| **Tutorial** | Contra un muñeco de práctica | Libre | Completar los pasos | Sí | No |

- **Eliminación:** si se acaba el tiempo de una ronda, la gana el equipo con más eliminaciones en esa ronda; si empatan, el que tenga más jugadores vivos.
- **Zona Bombástica:** el área de 3×3 suma 1 punto por segundo al único equipo que esté dentro. Si hay jugadores de los dos equipos, está en disputa y nadie suma. La zona se mueve cada 40 s entre los puntos del mapa.
- **Batalla Clásica:** cuando queda el 40% del tiempo de la ronda (máximo 45 s) empieza la **muerte súbita**: caen bloques en espiral desde el borde hacia el centro y aplastan a quien esté debajo.
- **Mejoras** (30% de probabilidad al romper un bloque): bomba extra, fuego (+1 de alcance), patines (+10% de velocidad, hasta 4), botiquín (+50 de vida) y carga (+30 de Hipercarga).

## 6. Mapas (27 × 15 casillas, simétricos)

| Mapa | Características | Recomendado para |
|---|---|---|
| **Ruinas** | Grilla de pilares, pocos bloques, cuatro rutas abiertas | Aprender; todas las clases |
| **Laberinto** | Setos largos, pasillos estrechos, rutas alternativas y bloques que conviene romper | Tanque, Defensor, Controlador |
| **Fábrica** | Abierto, con cintas transportadoras (2,2 casillas/s) y compuertas (abiertas 4 s, cerradas 3 s) | Veloz, Distancia |
| **Volcán** (extra) | Grietas de lava: 6 s inactivas, aviso de 1,5 s y 3 s de erupción con 60 de daño por segundo | Jugadores con experiencia |

En Captura y Zona, los bloques rotos vuelven a aparecer a los 30 s, siempre que la casilla esté libre. Los mapas se definen en texto en [`src/shared/maps.ts`](../src/shared/maps.ts): se escribe la mitad izquierda y se refleja automáticamente para que sean simétricos.

## 7. Progresión (GDD, sección 11)

- **Experiencia por partida:** 50 por jugar, 100 por ganar (50 por empatar), 40 por captura, 10 por eliminación, 5 por asistencia, 10 por defensa o recuperación y 15 por ronda ganada. Máximo 600 por partida.
- **Nivel:** para pasar del nivel N al siguiente hacen falta `150 + (N − 1) × 60` de experiencia. El máximo es 50.
- **Premios por nivel:** 100 monedas en cada nivel, más un cosmético en los niveles 3, 5, 7, 10, 12, 15, 18, 20, 25, 30, 35, 40, 45 y 50.
- Los niveles **no dan ventajas**: solo desbloquean cosméticos.

## 8. Economía (GDD, secciones 12 y 13)

- **Monedas por partida:** 20 por jugar, 30 por ganar (15 por empatar), 10 por captura y 3 por eliminación. Máximo 250 por partida.
- **Otras fuentes de monedas:** logros, primera victoria en cada nivel del Festival (100 a 400) y 25 por cada estrella nueva.
- **Monedas iniciales:** 300.
- **Precios por rareza:** Común 100 · Raro 250 · Épico 500 · Legendario 1000.
- **Catálogo:** 18 skins (3 por personaje, además de la base), 6 efectos de explosión y 6 emotes pagos, más 3 emotes gratuitos. Ninguno cambia estadísticas.
- **Inventario:** una skin equipada por personaje, un efecto de explosión y 4 emotes (teclas 1 a 4).
- **Tienda:** 3 ítems destacados que cambian cada día.

## 9. Ranking (GDD, sección 14)

- **ELO simplificado por equipos:** se compara el ELO promedio de cada equipo (los bots cuentan como 850, 1050, 1250 o 1450 según la dificultad). El cambio es `32 × (resultado − esperado)`, donde el resultado vale 1 al ganar, 0,5 al empatar y 0 al perder, más un ajuste de ±6 según la fracción de los puntos del equipo que hizo el jugador. Así, **el resultado pesa más que las eliminaciones**.
- **Divisiones:** Bronce (< 1100), Plata (1100), Oro (1300) y Diamante (1500).
- **Online:** ranking global (ELO actual), semanal (ELO ganado desde el lunes) e histórico (mejor ELO). Lo calcula y guarda el servidor.
- **Sin servidor:** la Liga contra la IA usa el mismo ELO contra rivales bot.

## 10. Logros

Recluta (tutorial), Primera Victoria, Veterano (25 partidas), Diez de Diez (10 victorias), Ladrón de Banderas (10 capturas), Demoledor (200 bloques), Verdugo (100 eliminaciones), Ángel de la Guarda (2000 de curación), Guardián (15 recuperaciones), Imparable (racha de 5), Intocable (ganar sin morir), Polivalente (ganar con las 6 clases), Nivel 10, Coleccionista (20 cosméticos), Campeón del Festival y Todas las Estrellas. Dan entre 50 y 1000 monedas.

## 11. Festival de la Gran Deflagración (niveles)

| N.º | Nivel | Modo · Mapa | Formato | Bots |
|---|---|---|---|---|
| 1 | Primer Encendido | Captura · Ruinas | 2v2 | Fácil |
| 2 | Duelo en las Ruinas | Eliminación · Ruinas | 1v1 | Fácil |
| 3 | La Primera Zona | Zona · Ruinas | 2v2 | Fácil |
| 4 | Perdidos en el Laberinto | Captura · Laberinto | 3v3 | Normal |
| 5 | Batalla Clásica | Clásica · Laberinto | 4 jugadores | Normal |
| 6 | Cintas y Compuertas | Captura · Fábrica | 3v3 | Normal |
| 7 | Guerra de Zonas | Zona · Fábrica | 3v3 | Normal |
| 8 | Reacción en Cadena | Clásica · Ruinas (3 bombas y 3 de fuego al inicio) | 6 jugadores | Normal |
| 9 | Tierra Ardiente | Captura · Volcán | 3v3 | Difícil |
| 10 | Supervivientes | Eliminación · Laberinto | 3v3 | Difícil |
| 11 | Hipercarga Total (Hipercarga ×2,5) | Captura · Fábrica | 3v3 | Difícil |
| 12 | La Gran Deflagración | Captura · Volcán | 4v4 | Experto |

Cada nivel tiene 3 estrellas: ganar más dos objetivos. Las dos estrellas extra solo cuentan si se gana. Cada nivel se desbloquea al ganar el anterior.

## 12. Tutorial (GDD, sección 15)

Tiene 7 pasos guiados, con marcas en el mapa:

1. Moverse.
2. Poner una bomba para romper un bloque.
3. Atacar al muñeco de práctica.
4. Usar la Hipercarga, que se llena automáticamente.
5. Robar la bandera enemiga.
6. Capturarla en la propia base.
7. Cierre.
