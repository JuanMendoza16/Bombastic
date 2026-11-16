# Manual de identidad visual — Bomberman

Completa el índice del *Manual de Identidad Visual* de Arte y Multimedia con lo que se implementó en el juego.

## 1. Introducción y visión

**Bomberman — Captura la Bandera** es un juego caricaturesco, colorido y rápido de leer. La identidad mezcla **pixel art** en el juego (personajes, mapas y objetos) con una **interfaz cartoon** de bordes gruesos, sombras sólidas y animaciones con rebote. Prioridad: claridad antes que detalle (GDD, sección 16).

## 2. Logotipo y marca

- **Logo del juego:** la palabra **BOMBERMAN** con letras que rebotan de a una. «BOMBER» va en degradé amarillo → naranja y «MAN» en celeste → azul, todo con contorno grueso y sombra.
- **La «O» es una bomba** con la mecha encendida y, en el frente, el emblema del boceto 3 de G5: un rayo con flechas que representa robar y escapar.
- **Cinta roja** con el lema «CAPTURA LA BANDERA», flanqueada por una bandera azul y una roja que ondean.
- **Logo del estudio:** el boceto 1 de G5, una bandera sobre una base entre llaves `{ }`, en violeta. Aparece en el splash «PixelForge Studios presenta» y en los créditos.
- **Ícono:** bomba con rayo (`public/favicon.svg`).
- **Nombre:** en el juego siempre se escribe «Bomberman» en mayúsculas dentro del logo.

## 3. Color

| Uso | Color | Hex |
|---|---|---|
| Fondo noche | Violeta profundo | `#140b24` |
| Paneles | Violeta | `#2a1a4a` → `#35215c` |
| Contorno (tinta) | Casi negro violáceo | `#1a1026` |
| Texto | Crema | `#fff7e6` |
| Acento principal | Amarillo | `#ffd23f` |
| Acento secundario | Naranja | `#ff8a1a` |
| Equipo Azul | Azul | `#3d8bff` |
| Equipo Rojo | Rojo | `#ff4d5e` |
| Equipo Rojo en modo daltónico | Naranja | `#ff9f1c` |
| Éxito / curación | Verde | `#3cff9a` |
| Hipercarga | Amarillo eléctrico | `#ffe94d` |

**Rarezas:** Común `#b8c1cc` · Raro `#3cb4ff` · Épico `#c46bff` · Legendario `#ffb13b`.

**Divisiones:** Bronce `#cd7f32` · Plata `#c0c7d1` · Oro `#ffd23f` · Diamante `#6ee7ff`.

**Color de cada personaje** (en los menús): Cubert `#5fd4e6`, Giga `#ff9d3a`, Nova `#5dff9a`, Cipher `#c77dff`, Boomslang `#9be15d` y Sparks `#ffe066`.

## 4. Tipografía

- **Lilita One:** títulos, botones, logo y números grandes (marcador y anuncios).
- **Fredoka** (400 a 700): textos, descripciones y tablas.

Las dos van incluidas en el juego, así que funcionan sin internet.

## 5. Guía de estilo artístico

- **Casilla** de 32×32 px con vista 3/4: las paredes y los bloques muestran la cara superior y el frente, y proyectan una sombra en el suelo.
- **Personajes** en cuadros de 48×56 px, con los pies en y = 50 y un contorno de 1 px en `#1a1026`. El sombreado usa 3 o 4 tonos con la luz arriba a la izquierda.
- **Animaciones:** quieto (4 cuadros), caminar (6), ataque (3), Hipercarga (3), daño (1), KO (5) y festejo (4), en las 4 direcciones (la izquierda es el espejo de la derecha).
- **Legibilidad en partida:** anillo del color del equipo a los pies, barra de vida sobre la cabeza y destello blanco al recibir daño. Sparks tiene un aura translúcida, pero su núcleo va contorneado para que no se pierda contra el piso.
- **Temas de los mapas:**
  - Ruinas: arena y piedra gris con musgo.
  - Laberinto: setos y grava.
  - Fábrica: acero, franjas de peligro, cintas y compuertas.
  - Volcán: basalto y magma.
  - Tutorial: azul de entrenamiento.
- **Bloques rompibles** en tonos cálidos (madera, arcilla o cartón), claramente distintos de las paredes indestructibles.

## 6. Interfaz de usuario (UI/UX branding)

- **Botones** de colores planos con degradé suave, borde de 3 px, sombra sólida de 6 px y un «hundido» al presionar. Emiten sonido al pasar el mouse y al hacer clic.
- **Paneles** redondeados (18 px) con borde de tinta.
- **Animaciones:** entrada de pantallas con desplazamiento suave, logo que rebota, anuncios que entran con escala. Se pueden reducir desde Ajustes.
- **HUD:** tarjeta del jugador (retrato, vida, Hipercarga, bombas y alcance), marcador por equipo con el estado de las banderas, reloj, registro de eliminaciones y anuncios centrales.
- **Accesibilidad:** modo daltónico, teclas reasignables, reducción de animaciones, controles táctiles y soporte para mandos.

## 7. Nomenclatura y exportación técnica

El arte se genera por código, así que no hay archivos de imagen que exportar. Sus fuentes son:

| Qué | Dónde |
|---|---|
| Personajes, poses y paletas de skins | `src/client/gfx/characters.ts` (`BASE_PAL`, `SKIN_COLORS`) |
| Tiles, bombas, llamas, mejoras y banderas | `src/client/gfx/tiles.ts` (`THEMES`, `FX_PALETTES`) |
| Nombres, rareza y precio de cada skin | `src/shared/catalog.ts` |

**Para agregar una skin:**

1. Sumar una entrada en `SKIN_META[clase]` (id en minúsculas sin espacios, nombre, rareza y precio).
2. Sumar sus colores en `SKIN_COLORS[clase][id]`, usando las claves de la paleta base.

Convención de claves: `b0` es el tono claro, `b1` el base, `b2` la sombra y `b3` la sombra profunda.

**Para importar sprites dibujados a mano** en el futuro: cuadros PNG de 48×56 px (personajes) o 32×32 px (tiles) con fondo transparente, nombrados `personaje_direccion_animacion_cuadro.png` (por ejemplo, `cubert_down_walk_0.png`). Se cargarían en `Sprites.char()` en lugar del dibujo procedural.
