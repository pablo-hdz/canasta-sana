# Pantallas en Figma

## Versión vigente: archivo en Figma, creado con el conector MCP (2026-11-13)
- **Archivo de diseño:** [Canasta sana — pantallas v0.1](https://www.figma.com/design/HuJ45RHibAnUmoXgP3ExHw). Contiene la sección «Pantallas v0.1» con las 4 pantallas y el bloque «Componentes locales».
- **Componentes locales con propiedades de texto:**
  - Botón (Primario y Secundario, mínimo 56 px de alto).
  - Etiqueta (Listo, Duda, Simulado y Beneficio).
  - Sello OPS (octágono).
  - Fila producto (Listo y Duda).
  - Producto con sellos (propiedad booleana «Segundo sello»).
  - Tarjeta cambio.
- **Tipografía:** Atkinson Hyperlegible Next, del Braille Institute, diseñada para lectores con baja visión.
- **Verificado en Figma real:**
  - Ningún texto colapsado.
  - Captura revisada a la vista, que está en `pantallas_v01_figma.png`.
  - Se corrigió un defecto: los saltos de línea entre número y unidad, resueltos con espacios de no separación.
- **Recorrido de la persona (FigJam):** [Canasta sana — recorrido v0.1](https://www.figma.com/board/mL8xm0mOMGymnSXZkF4Qm9). Copia local en `../diagramas/recorrido_figjam.svg` y `.png`.

## Alternativa: plugin de desarrollo (sin conector)

Crea en Figma las 4 pantallas de baja fidelidad de Canasta sana como frames editables con auto layout. Todos los productos y precios son `SIMULADO`.

| Pantalla | Contenido |
|---|---|
| 1 · Inicio | Foto del tiquete, galería y aviso de privacidad |
| 2 · Revise sus productos | Lista leída del tiquete y botón para escanear el código de barras si hay duda |
| 3 · Su canasta | Resumen y productos con sellos octagonales |
| 4 · Cambios fáciles | 3 cambios más sanos y no más caros |

## Cómo ejecutarlo (Figma desktop)
1. Abre o crea un archivo de diseño (Design) en tu equipo de Educación.
2. Menú principal → **Plugins → Development → Import plugin from manifest…** y elige `manifest.json` de esta carpeta. La ruta del menú puede variar según la versión de Figma (`POR VERIFICAR`).
3. Menú principal → **Plugins → Development → Canasta sana - pantallas v0.1**.
4. Debe aparecer el mensaje: «Listo: 4 pantallas, 69 textos, 8 botones y 5 sellos».

El plugin no usa internet (`networkAccess: none`) y solo crea nodos en la página actual. Para deshacerlo: Ctrl+Z, o borra los 4 frames.

## Estado
- **Probado** con una API de Figma simulada (`node prueba_simulada.js code.js`). Pasaron estos controles: fuentes cargadas, auto layout, textos de 16 px o más fuera de los sellos, botones de 48 px o más y marca `SIMULADO` en todas las pantallas.
- **Contraste WCAG 2.2 AA** calculado para todos los pares de color: el mínimo es 5,47:1, y AA pide 4,5:1.
- **`POR VERIFICAR` en Figma real:** no se ha ejecutado en Figma desktop. Si da error, anota el mensaje exacto.

## Parámetros
Al inicio de `code.js`: `ANCHO` (360 px), `ALTO_MIN` (800 px), `SEPARACION` (80 px) y `FUENTE` (Inter).
