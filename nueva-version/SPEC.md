
# Especificación de requerimientos — Actualización del videojuego

## 1. Sistema de bombas y combate

### 1.1. Daño de las bombas
- Las bombas deben eliminar instantáneamente al jugador alcanzado por su explosión.
- El daño debe ser letal independientemente de las mejoras pasivas o estadísticas del personaje, salvo que exista una mecánica de protección expresamente diseñada.
- Verificar que el sistema de colisiones, explosiones y detección de jugadores funcione correctamente.

### 1.2. Nuevas mecánicas de interacción con bombas

Incorporar nuevas funcionalidades que permitan aprovechar las bombas de manera más dinámica:

- **Patear bombas:** permitir que los jugadores pateen bombas para desplazarlas hacia otras posiciones.
- **Agarrar y lanzar bombas:** permitir que los jugadores recojan bombas y las lancen en una dirección determinada.
- Ambas mecánicas deben funcionar para todos los personajes, sin restricciones por personaje.
- Implementar físicas, colisiones y trayectorias coherentes con estas interacciones.
- Evitar que las nuevas mecánicas generen errores de sincronización en partidas online.

### 1.3. Funcionalidades del sniper
- Mantener el rango actual del sniper, ya que se considera adecuado.
- Conservar todas sus funcionalidades actuales.
- Verificar que las nuevas mecánicas de bombas no afecten negativamente su funcionamiento ni el balance general del combate.

## 2. Mapas y escenarios

### 2.1. Tamaño de los mapas
- Incorporar mapas de menor tamaño, especialmente pensados para modos de juego específicos como Duelo.
- Evaluar y ajustar las dimensiones de los mapas según la cantidad de jugadores y el modo de juego.
- Mantener mapas grandes para los modos que requieran mayor exploración y movilidad.

### 2.2. Sistema de tormenta y cierre progresivo del mapa

Implementar una mecánica inspirada en el sistema de tormenta de Fortnite:

- En mapas grandes utilizados para el modo Duelo, iniciar un cierre progresivo del área jugable después de un tiempo determinado.
- La zona segura debe reducirse gradualmente.
- Los jugadores que permanezcan fuera de la zona segura deben recibir daño o quedar expuestos a una mecánica de eliminación.
- El cierre debe continuar hasta concentrar a los jugadores en una zona reducida.
- El sistema debe adaptarse a la duración y configuración de cada partida.

### 2.3. Obstáculos destructibles
- Aumentar considerablemente la cantidad de obstáculos rompibles en los mapas.
- Diseñar los escenarios para que las bombas tengan un impacto significativo en el entorno.
- Permitir que las explosiones destruyan los bloques y obstáculos correspondientes.
- Incorporar variedad de obstáculos con diferentes propiedades de resistencia y destrucción, si el diseño del juego lo permite.

### 2.4. Regeneración de obstáculos
- Los obstáculos destruidos deben regenerarse automáticamente después de un período de tiempo configurable.
- La regeneración debe restaurar el estado original del bloque.
- Evitar que los obstáculos reaparezcan sobre jugadores, bombas u otros elementos que puedan provocar errores de colisión.
- La regeneración debe sincronizarse correctamente entre todos los jugadores de una partida online.

## 3. Sistema de mejoras (Power-ups)

### 3.1. Frecuencia y obtención
- Las mejoras deben ser más comunes y fáciles de obtener.
- Reducir la dependencia de mejoras difíciles de conseguir.
- Ajustar las probabilidades de aparición para conseguir una progresión más dinámica y accesible.

### 3.2. Pérdida de mejoras al morir

- Las mejoras obtenidas durante una partida deben perderse cuando el jugador muere.
- Al reaparecer, el jugador no debe conservar las mejoras temporales obtenidas durante su vida anterior.
- Esta mecánica funcionará como principal mecanismo de balance para evitar que los jugadores acumulen ventajas excesivas.

**IMPORTANTE — Verificación previa:**

Antes de implementar cambios, verificar el comportamiento actual del sistema y determinar si las mejoras ya se eliminan al morir.

- Si actualmente funciona correctamente, conservar la implementación.
- Si no funciona, corregirla.
- Documentar qué mejoras se reinician y cuáles, si corresponde, son permanentes.

### 3.3. Mejoras iniciales y al reaparecer
- Todos los personajes deben comenzar cada partida con un conjunto de mejoras comunes pasivas.
- Al reaparecer después de morir, deben recibir nuevamente ese mismo conjunto de mejoras iniciales.
- Estas mejoras deben ser comunes, equilibradas y estar disponibles para todos los personajes.
- Las mejoras temporales obtenidas durante la partida deben seguir perdiéndose al morir.

## 4. Sistema de personajes

- Todos los personajes deben tener acceso a las mecánicas de patear bombas y agarrarlas para lanzarlas.
- Ningún personaje debe quedar excluido de estas funcionalidades.
- Incorporar los nuevos diseños de personajes proporcionados en los archivos adjuntos.
- Respetar la identidad visual, proporciones, animaciones y características de los diseños originales.
- Mantener compatibilidad con las mecánicas y estadísticas existentes.

## 5. Identidad visual: pixel art en toda la plataforma

### 5.1. Aplicación global del estilo

**Toda la experiencia web debe estar desarrollada visualmente en pixel art.**

No alcanza con que los personajes y los escenarios del videojuego tengan esta estética. El estilo debe aplicarse a absolutamente todas las pantallas y componentes de la plataforma.

Esto incluye:

- Pantalla de carga (Loading Screen).
- Pantalla de inicio.
- Menú principal.
- Menús secundarios.
- Selección de personajes.
- Selección de partidas.
- Salas de espera y lobbies.
- Pantallas de configuración.
- HUD (interfaz durante las partidas).
- Barras de estadísticas.
- Botones, íconos y elementos interactivos.
- Pantallas de victoria y derrota.
- Pantallas de conexión y errores.
- Cualquier otra pantalla o componente de la web.

### 5.2. Consistencia estética
- Mantener una identidad visual uniforme en toda la plataforma.
- Utilizar tipografías pixeladas.
- Aplicar bordes, paneles, botones e íconos coherentes con la estética pixel art.
- Evitar componentes con apariencia moderna, minimalista o ajena al estilo visual del videojuego.
- Utilizar el logo definitivo adjunto.
- Mantener coherencia entre la interfaz web, los personajes y los escenarios.

### 5.3. Barras de estadísticas

Las barras de estadísticas deben rediseñarse para que coincidan con el estilo visual de la referencia adjunta.

- Replicar el lenguaje visual de la referencia.
- Utilizar segmentos, píxeles y bordes acordes con la estética general.
- Mantener una lectura clara de los valores y niveles.
- Aplicar el mismo diseño en todos los lugares donde se muestren estadísticas.

## 6. Recursos gráficos y audiovisuales adjuntos

En la misma carpeta que este documento se encuentran los nuevos recursos que deben utilizarse durante la actualización.

Estos archivos incluyen:

- Nuevos diseños de personajes.
- Nuevos diseños de mapas.
- Diseños individuales de los bloques pixel art necesarios para reconstruir los mapas.
- Música correspondiente al nuevo contenido.
- Logo definitivo del videojuego.
- Referencia visual para las barras de estadísticas.

**Requerimientos de implementación:**

1. Revisar todos los archivos adjuntos antes de comenzar la implementación.
2. Identificar y clasificar los recursos según su función.
3. Utilizar los diseños proporcionados como referencia principal, evitando reemplazarlos por recursos genéricos.
4. Construir los mapas utilizando los bloques pixel art incluidos.
5. Integrar la música correspondiente en los lugares y situaciones adecuados.
6. Utilizar el logo definitivo en toda la plataforma.
7. Verificar que todos los recursos se visualicen correctamente y mantengan su calidad original.

## 7. Servidor online, concurrencia y estabilidad

### 7.1. Auditoría del servidor

Realizar una revisión integral del funcionamiento del servidor online.

- Verificar que los jugadores puedan conectarse correctamente.
- Revisar el funcionamiento de las salas y partidas.
- Detectar y corregir bugs existentes.
- Comprobar la sincronización de movimientos, bombas, explosiones, obstáculos, mejoras y estados de los jugadores.
- Verificar el comportamiento ante desconexiones y reconexiones.
- Evitar estados inconsistentes entre clientes.

### 7.2. Concurrencia y procesamiento paralelo

Optimizar el servidor para permitir la ejecución simultánea de múltiples partidas y conexiones.

- Implementar soporte adecuado para concurrencia.
- Priorizar el uso de múltiples hilos (multithreading) cuando la arquitectura y el entorno tecnológico lo permitan.
- Aprovechar los recursos disponibles del servidor para distribuir el procesamiento.
- Evitar bloqueos y cuellos de botella.
- Asegurar que una partida no interfiera con el estado de otra.
- Mantener la integridad de los datos compartidos y la sincronización entre procesos e hilos.

### 7.3. Rendimiento y escalabilidad
- Reducir la latencia de las partidas.
- Optimizar el procesamiento de eventos en tiempo real.
- Evitar caídas ante aumentos de jugadores concurrentes.
- Implementar mecanismos de manejo de errores y recuperación.
- Evaluar el consumo de CPU, memoria y ancho de banda.
- Verificar que el servidor soporte múltiples partidas simultáneas de manera estable.

## 8. Criterios generales de implementación

- Antes de modificar funcionalidades existentes, analizar su implementación actual.
- Reutilizar sistemas existentes siempre que sean compatibles con los nuevos requerimientos.
- Evitar duplicar lógica o crear sistemas paralelos innecesarios.
- Mantener compatibilidad entre las nuevas mecánicas y las funcionalidades actuales.
- No eliminar características existentes que no estén explícitamente incluidas en los cambios solicitados.
- Mantener una arquitectura modular y escalable.
- Verificar que las modificaciones no introduzcan regresiones.

## 9. Pruebas y validación final

Antes de considerar finalizada la actualización, realizar pruebas que contemplen:

### Gameplay
- [ ] Las bombas eliminan instantáneamente.
- [ ] Todos los personajes pueden patear, agarrar y lanzar bombas.
- [ ] El sniper conserva su rango y funcionalidades.
- [ ] Los obstáculos se destruyen y regeneran correctamente.
- [ ] La tormenta reduce progresivamente el área jugable.

### Mejoras
- [ ] Las mejoras son más frecuentes.
- [ ] Los jugadores comienzan con mejoras pasivas comunes.
- [ ] Las mejoras iniciales se restauran al reaparecer.
- [ ] Las mejoras temporales se pierden al morir.

### Interfaz y recursos
- [ ] Todas las pantallas respetan el estilo pixel art.
- [ ] Las barras de estadísticas coinciden con la referencia.
- [ ] Los personajes, mapas, bloques, música y logo adjuntos están correctamente integrados.

### Servidor
- [ ] Múltiples partidas pueden ejecutarse simultáneamente.
- [ ] Varios jugadores pueden interactuar sin inconsistencias.
- [ ] No existen errores críticos de sincronización.
- [ ] El servidor mantiene estabilidad bajo concurrencia.

## 10. Resultado esperado

Obtener una versión mejorada del videojuego que conserve sus funcionalidades actuales, pero incorpore un combate más dinámico y destructivo, una progresión equilibrada, mapas más estratégicos, una identidad visual pixel art integral y una infraestructura online estable, concurrente y escalable.

La implementación debe respetar los recursos gráficos y audiovisuales proporcionados y garantizar que todas las nuevas funcionalidades trabajen correctamente tanto en partidas individuales como multijugador.
