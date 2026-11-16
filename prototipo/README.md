# Prototipo v0.3.0 — Canasta sana (2026-11-15)

App web (PWA) que funciona dentro del teléfono:

tiquete o factura → productos → sellos de la OPS → qué conviene cambiar y qué buscar en su lugar (D-23: sin sugerir un producto ni un precio).

## Cómo ejecutarla
```
cd Canasta_sana/prototipo/web
npm install          # una vez; versiones fijas en package.json
npm run dev          # http://localhost:5173
npm test             # 284 pruebas (vitest 5.1.0)
npm run build        # vite 6.4.6: versión de producción en dist/ (sin servicio: no define VITE_API_URL)
npm run iconos       # vuelve a generar los íconos PNG desde public/icono.svg (sin dependencias)
```
Servicio opcional (precios de la comunidad): ver `api/README.md` (85 pruebas). En desarrollo, `web/.env.development` apunta a `http://localhost:8000`; se inicia con `uvicorn` (ver `api/README.md`).
Base de productos:
- `python -I datos/descargar_off.py` descarga la base completa. Es reanudable, porque el servidor de Open Food Facts devuelve 503 cuando hay mucha carga.
- Con `--con-busqueda` arma una base parcial con la caché y el índice de búsqueda.

## Probarla en su teléfono (misma red Wi-Fi)
1. En la computadora: `cd Canasta_sana/prototipo/web` y `npm run dev -- --host`. Vite muestra una dirección «Network», p. ej. `http://192.168.1.20:5173`.
2. En el teléfono, abra esa dirección. La cámara funciona con el botón «Tomar foto del tiquete».
3. **Límites:**
   - El modo sin conexión (service worker) solo funciona con HTTPS o en `localhost`, así que no se activa por la red local. Para probarlo, use `npm run build` y `npm run preview` en la computadora.
   - Los precios de la comunidad desde el teléfono necesitan el servicio con su dirección: `VITE_API_URL=http://192.168.1.20:8000` y `CANASTA_ORIGENES=http://192.168.1.20:5173`. Sin eso, la app funciona igual, con sus propios precios y los estimados.
4. Windows puede pedir permiso en el cortafuegos para Node. Esa decisión es suya.

## Qué hace
| Función | Estado |
|---|---|
| Foto del tiquete → OCR en el teléfono (Tesseract.js, español, una columna) | Funciona. Con la primera foto real leyó mal. **Exactitud sin medir con tiquetes reales.** |
| Factura electrónica XML de Hacienda (v4.3/v4.4) | Funciona. Lee las líneas exactas, el código de barras (CodigoComercial tipo 03) para identificar sin errores, el total, el comercio y la fecha. **No lee ni guarda los datos del receptor.** |
| Factura en PDF | Extrae el texto y usa el mismo lector del tiquete. No se ha probado con un PDF real. |
| Identificación | Por código de barras impreso → alias aprendido → palabras, abreviaturas y tamaño → si hay duda, pregunta con 3 candidatos o pide el código. |
| Sellos OPS 2016 | Verificados contra el documento oficial (págs. 16-19): panel C (umbrales), panel D (azúcares libres) y panel B (alcance). |
| Cambios con filtros de seguridad (RF-07) | **Sin uso en pantalla desde D-23:** el motor y sus pruebas siguen en el código.  Sin sustitutos de sal, alérgenos del hogar ni edulcorantes con niños; sin sellos nuevos; misma categoría específica. |
| Precios | Esta compra → historial de sus compras (solo si el total cuadra) → estimado «≈» por tamaño y categoría. El ahorro solo se afirma con dos precios reales. |
| Privacidad | Todo en el teléfono (localStorage): perfil, alias e historial de precios. Hay un botón para borrarlo todo. |
| Sin conexión (v0.1.1) | Tipografía y OCR (motor y español, 9,6 MiB) servidos desde la app. Un service worker guarda la app, la base y el OCR (`precarga.json` se genera al compilar). **Verificado:** con el servidor apagado, la app abre y lee un tiquete; ninguna petición sale de `localhost`. |
| Tiquete largo (v0.1.1) | «Agregar otra parte»: une varias fotos sin contar dos veces las líneas repetidas entre fotos. |
| Gráfico (v0.1.1) | «¿De dónde viene el azúcar, el sodio o la grasa de su compra?»: barras por producto (cantidad en la compra = por 100 g × tamaño × unidades), total con equivalencia (cucharaditas de azúcar o gramos de sal), detalle al tocar y vista en tabla. Color validado con el script de la skill de visualización. **B-23 (2026-11-15):** si la base no trae el tamaño del empaque, se usa el impreso en la línea del tiquete (g, kg, ml o l; no «25 PAQ», «80» sin unidad, «6X200ML» ni «1.000ML») y se dice «tamaño leído del tiquete» en el detalle, en la tabla y en una nota. Si la base lo trae, manda la base. |
| Navegación (v0.2) | Barra inferior (Inicio, Mi lista, Progreso, Ajustes) e indicador de pasos Leer → Revisar → Canasta → Cambios. El foco pasa al título de cada pantalla (lectores de pantalla). «Tiene una compra sin terminar» permite volver. |
| Mi lista (v0.2) | Los cambios elegidos se guardan en el teléfono, se marcan como comprados y se comparten con la hoja del teléfono, WhatsApp o copiando el texto. Solo se comparte la lista, nada del tiquete ni del hogar. |
| Su progreso (v0.2) | Por mes, % del gasto en empacados que fue en productos con sellos, con tendencia («¡Va mejorando!» si baja ≥ 5 puntos), barras y tabla con azúcar y sal compradas. Solo compras reales; se guarda un resumen, no la lista de productos. Hay un ejemplo SIMULADO que no se guarda. |
| Ajustes (v0.2) | Hogar (niños y alergias), tema (como el teléfono, claro u oscuro), precios de la comunidad, cantón opcional, privacidad con conteo de lo guardado y botón de borrar (con confirmación). |
| Modo oscuro (v0.2) | Tonos propios, no una inversión automática. `contraste.test.ts` comprueba 18 pares de texto y fondo en los dos temas (WCAG ≥ 4,5:1 en texto, ≥ 3:1 en foco y barras). |
| Comercio detectado (v0.2) | La cadena (Palí, Maxi Palí, Más x Menos, Walmart, Auto Mercado…) se toma del encabezado del tiquete o del nombre comercial de la factura: la persona no escribe nada. |
| Precios de la comunidad (v0.2, D-17, RF-15) | Opcional y apagado por defecto. La app descarga la tabla completa del servicio (renovada una vez por semana) y busca en el teléfono: mediana de la misma cadena y cantón → cadena → país. Se muestra «mediana de N aportes». |
| Aporte anónimo (v0.2, D-17, RF-16) | Opcional y apagado por defecto. Con el permiso activado, después de una compra real cuyo total cuadra, la app **ofrece** aportar y muestra la lista exacta (producto, código y precio, más comercio, cantón y semana). Nada se envía sin tocar «Aportar» en esa compra (RNF-02, RF-10). Una compra aportada o rechazada no se vuelve a ofrecer, ni después de recargar. Solo productos identificados con seguridad (código de barras, alias o elegidos por la persona); en una demostración no se aprenden alias. |
| Aviso de dato dudoso (v0.2) | En la canasta, un producto con un dato no creíble lo explica y, si hay servicio, ofrece «Avisar de este dato dudoso»: envía solo el código y qué dato es (opciones cerradas). También se muestran los productos sin sellos que tienen datos dudosos (antes no aparecían). |
| Copia de seguridad (v0.2) | En Ajustes → Su privacidad: «Guardar copia» descarga un archivo .json con el hogar, la lista, el progreso y los precios; «Restaurar copia» lo carga en otro teléfono. No se envía a ningún lado. Al restaurar, cada dato pasa por los mismos controles (lo dañado se descarta) y se rechazan archivos ajenos o de una versión más nueva. |
| Descarga liviana (v0.3, D-24) | Al instalar se bajan ~1 MiB (app y base), antes 12,2 MiB. El lector de fotos (~5,9 MiB) y el de PDF (~1,6 MiB) se bajan la primera vez que se usan y quedan para usar sin conexión. Si la primera lectura es sin conexión, la app lo explica. **Verificado** con el servidor apagado: abre y el OCR lee 12/12 líneas desde la caché. |
| Privacidad garantizada (v0.3, D-24) | La versión de producción lleva una política de seguridad (CSP) que solo permite la propia app y el servicio de precios, si existe: el navegador bloquea cualquier petición a terceros. Sin `unsafe-eval` (el OCR usa `wasm-unsafe-eval`; el PDF, `isEvalSupported: false`). Enlaces externos sin referente. **Verificado:** OCR 12/12 sin violaciones de la CSP. |
| Versión nueva (v0.3, D-24) | El service worker nuevo espera y la app avisa «Hay una versión nueva de Canasta sana · Actualizar · Después». Revisa cada hora. **Verificado:** de v0.1.3 a v0.3.0, se recarga y borra la caché vieja. La compilación pone en `dist/sw.js` una versión con la huella de los archivos generados, así que cada compilación con cambios dispara el aviso. Respaldo previo: `respaldos/web-v0.3.0-antes-de-version-automatica-sw-2026-11-14/`. |
| Qué conviene cambiar (v0.2, D-23) | El paso 4 lista los productos empacados con sellos, de más sellos a menos, con sus octágonos y qué buscar («una opción con menos azúcar»). No nombra un producto de reemplazo (evita errores como «frijoles molidos → Nescafé»). «Recordármelo en mi lista» guarda el recordatorio y lo comparte por WhatsApp. |
| Pegar texto (v0.2) | En el inicio, «Pegar el texto de una factura o tiquete»: para la factura que llega al correo como texto o representación gráfica. Lee precios con ₡ y decimales, columnas separadas por tabulador, IVA antes o después del total, cantidades en kilos, totales con viñeta («• TOTAL COMPROBANTE») y la fecha impresa. La columna **CAByS** (clasificación de Hacienda) nunca se usa como código de barras. Caso fijo: `FACTURA_TEXTO_SIMULADA` (28 líneas, cuadra con ₡106 059,50; SIMULADO). |
| Frescos y no comida (v0.2) | Lo fresco (a granel, por kilo, o fruta, verdura, huevo o carne cruda como primera palabra) se aparta solo: «Alimentos frescos: no llevan sellos ✓». Lo que no es comida (detergente, cloro, champú, papel higiénico…) también: «No son comida: no se revisan». Cada uno se puede devolver con un toque. En la factura de prueba, las preguntas bajaron de 25 a 11. |
| Colorantes (v0.2, D-19) | En la canasta, sección «Colorantes»: qué productos llevan colorantes con advertencia en la UE (E102, E104, E110, E122, E124, E129), prohibidos en la UE (E171) o retirados en EE. UU. (E127), con la norma, su explicación y el enlace oficial. Los cambios nunca agregan uno de estos colorantes; con niños en el hogar no sugieren ninguno. Para productos sin ingredientes en la base: «Foto» de la lista de ingredientes (OCR en el teléfono). **Medido** en la base: 13 productos con alguno de los 6 de la UE, pero solo 137 de 1235 traen ingredientes y 77 aditivos, así que es un mínimo. |
| Estilo visual (v0.2.3, D-22, D-25 y D-26) | Pastel periwinkle y amarillo mantequilla, suave pero serio. El texto va en azul marino (`#1F2240`) y el botón principal en periwinkle (`#5462D4`, texto blanco); los botones secundarios son tonales y las tarjetas blancas con sombra suave. **Claro por defecto** aunque el teléfono esté en oscuro (D-25, «no parece algo médico» en oscuro); el modo oscuro se elige en Ajustes. La portada presenta las formas de empezar en filas con su explicación, en lugar de tres mosaicos iguales. Los sellos «Gratis · Sin cuenta · Sin anuncios · Nada sale de su teléfono» se quitaron a pedido de Pablo; la nota de privacidad del inicio se mantiene. El anillo del gasto con sellos es de un solo tono, sin verde de «logro»: el nivel lo dice la etiqueta. Los íconos de la barra se rellenan al estar activos. La barra sigue cabiendo con la letra al 200 %. `contraste.test.ts` comprueba 44 pares en los dos temas. |
| Letra (v0.2.1, D-20; v0.2.3) | Por defecto, la del teléfono, como las apps más usadas: Roboto en Android, San Francisco en iPhone y Segoe UI en Windows (gratis y sin descargar nada). Títulos con la escala de Material 3. En Ajustes → Apariencia → «Más fácil de leer» se cambia a Atkinson Hyperlegible (D-07, para baja visión), que solo se descarga si se elige. **Verificado** en el navegador. **v0.2.3:** todos los tamaños están en `rem` (salvo el texto dentro del anillo, que es SVG), y la meta `text-scale` respeta el tamaño de letra del teléfono en Chrome. Se probó con la letra al 200 %: nada se sale de la pantalla y las tablas se desplazan hacia el lado dentro de su tarjeta. |
| Ilustraciones y animaciones (v0.2.5, D-22, D-26 y D-27) | `src/ilustraciones.tsx`, rehecho a pedido de Pablo («mejora todas las imágenes»). Todo sigue el mismo estilo: la luz viene de arriba a la derecha, donde está el sol. Cada pieza tiene degradado de volumen, sombra propia, luz rebotada, brillo, contorno fino y sombra de contacto. **Frutas y verduras (9):** naranja con poros y cáliz, media naranja con gajos y vesículas, manzana con vetas, fresa con semillas, uvas, banano con motas, zanahoria con anillos, brócoli con botones y aguacate con cáscara rugosa. **Tazón:** de cerámica, con interior, labio delantero y trasero, franja periwinkle, puntos amarillos, reflejo y pie. **Escenas:** la portada (sol con halo y resplandor, ramas con venas, tazón y frutas en la mesa), «Leyendo su tiquete», «¡Buena compra!» y los estados vacíos (tiquete con lupa, portapapeles y barras). **Íconos ilustrados:** 4 para las formas de empezar (fotos con un bodegón, sobre con tiquete y sello, naranja con fresa y portapapeles con nota) y 10 por categoría de producto, en las listas (naranja, zanahoria, jugo, leche, galleta, pan, salsa, saco de frijoles, muslo y bolsa). Los degradados se definen una sola vez en la página (`DefinicionesIlustraciones`, 45). `ilustraciones.test.tsx` comprueba que todos los usados existan y que no haya recursos externos. **Animaciones según el informe de diseño** (`movimiento.test.ts`): ninguna en bucle ni más larga que 5 s (WCAG 2.2.2), entradas de 300 ms o menos y anillo y barras de 500 ms o menos. Los sellos aparecen con un fundido, sin rebote. Se apagan con «reducir movimiento» del teléfono o con Ajustes → «Quitar las animaciones». El escáner ya no vibra. **Al pasar el cursor** (v0.2.4, pedido de Pablo): el botón principal brinca (`@keyframes brinco`, 0,5 s) y su ícono se ladea; los botones secundarios, las opciones del inicio y los selectores se elevan con sombra (`transform`); el ícono de la barra salta. Solo con mouse (`hover: hover`) y sin «reducir movimiento»; en el teléfono queda la respuesta al tocar. Sin librerías ni archivos externos. |
| Íconos (v0.2.1) | Nuevas categorías con ícono y color propios: fruta (naranja) y verdura (zanahoria). Por nombre solo si el nombre empieza con la fruta o la verdura, así que «Galleta sabor fresa» sigue siendo snack. Íconos por nutriente en la explicación de los sellos (cubo de azúcar, salero, gota de grasa) y en botones (cámara, código de barras, descarga). |
| Por qué cada sello (v0.2.1) | En la canasta, cada producto con sellos explica cada uno con números: «Sodio: 850 mg por 100 g. La OPS marca exceso desde 1 mg por cada caloría; este tiene 3,2 (850 mg en 265 calorías)». En grasas y azúcares da el % de las calorías y la cuenta (g × 4 o × 9), y dice cómo se estimaron los azúcares libres (panel D). Los umbrales salen de `UMBRALES` y `KCAL_POR_G` (`ops.ts`), sin copiar números. **Comprobado** en la base: 1624 sellos de 845 productos, cada uno con su explicación, y el valor que se lee en pantalla nunca queda por debajo del umbral. |
| Guardar caso de prueba (v0.2.1) | Inicio → Herramientas de prueba. Descarga un .json con el texto que leyó la app (una parte por foto) y las líneas como quedaron después de revisarlas: descripción, cantidad, precio, código elegido, cómo se identificó y si se quitó. **Nunca guarda la foto ni datos del receptor:** quita las líneas con nombre, cédula, correo, teléfono, tarjeta o autorización y tapa números de cédula, teléfono, tarjeta y clave. No guarda la fecha de la compra ni el comercio exacto, solo la cadena. Si se copia a `web/src/casos/`, `casos.test.ts` lo prueba solo: mismas líneas y total, sin más ruido, y la identificación nunca contradice la revisión. Hay un ejemplo SIMULADO (`ejemplo-SIMULADO.json`). **Límite:** un nombre suelto, sin rótulo, no se puede detectar; hay que revisar el archivo antes de compartirlo. |
| Escáner en vivo (v0.2.1, RF-03) | En «¿Cuál es?», «Escanear el código con la cámara» abre la cámara (`getUserMedia`) y lee con `BarcodeDetector` unas 5 veces por segundo. Acepta un código solo si su dígito de control es válido y se lee igual en 2 cuadros seguidos; pasa los UPC-E a UPC-A. Al leerlo, vibra, apaga la cámara y elige el producto. Si el navegador no tiene cámara o lector, o la persona niega el permiso, explica por qué y vuelve a la foto del código o a escribirlo. La imagen no se guarda ni se envía. **Verificado** en el navegador con cámara y lector SIMULADO (Chrome en Windows no trae `BarcodeDetector`). **Falta:** probarlo en un Android real. |
| Instalar en Android (v0.2.1) | Íconos PNG de 192 y 512 px, normales y «maskable», generados desde `icono.svg` con `scripts/iconos.mjs` (Node puro, sin dependencias). **Comprobado:** cada PNG mide lo que dice el manifiesto (prueba) y, contra el SVG dibujado por el navegador, difiere en promedio 0,2 de 255 por canal; el dibujo queda dentro de la zona segura (36 % del lado, máximo 40 %). El service worker los guarda. **Falta:** instalarla en un Android real. |
| Robustez (v0.2) | Protección ante errores: un fallo inesperado muestra «Algo salió mal» y cómo volver, no una pantalla en blanco. El almacenamiento valida cada dato al leerlo: un dato dañado o de otra versión se ignora, y una preferencia rara nunca activa un envío. |
| Verosimilitud de datos (v0.1.1) | Open Food Facts trae errores de unidad (sodio ×1000). Más de 40 000 mg/100 g de sodio es imposible; más de 5000 solo vale en sal, salsas y caldos; los azúcares no pueden superar a los carbohidratos ni las saturadas a la grasa total. Un dato dudoso no genera sello ni se grafica: 29 productos (2,3 %) de la base. |

## Grado de procesamiento (NOVA) con reglas, gratis y en el teléfono (D-16)
El 73 % de la base no trae NOVA. `src/dominio/clasificar.ts` lo estima en cascada:
1. **Ingredientes y aditivos:** marcadores de ultraprocesado (saborizantes, colorantes, emulsificantes, edulcorantes, jarabes, proteínas aisladas, aditivos E de uso industrial).
2. **Categoría** de Open Food Facts.
3. **Palabras del nombre**, en español e inglés. «Sin procesar» solo para lo que nombra el panel B de la OPS (leche simple, arroz, frijol seco, avena en hojuelas, huevo…). En la duda, se supone procesado.

Medición contra 328 productos con NOVA conocido (`nova.medicion.test.ts`):

| Nivel | Cobertura | Exacto | Binario (procesado o no) |
|---|---|---|---|
| Cascada completa | 86,0 % | 87,6 % | **96,8 %** |
| Solo nombre | 36,3 % | 77,3 % | **95,0 %** |

- Estima 442 de los 907 productos sin NOVA (48,7 %).
- La app muestra el motivo, por ejemplo «NOVA 4 estimado: categoría breakfast-cereals».
- **Desacuerdo deliberado:** Open Food Facts marca la leche semidescremada como NOVA 4, pero el panel B de la OPS excluye la leche pasteurizada o UHT, y aquí manda la OPS.

## IA de clasificación: Jev (TypeSafe AI). DESCARTADA (D-15)
Pablo decidió no usarla (no es gratis y requiere acceso anticipado). El script queda en `datos/` sin uso: sin clave no hace ninguna petición, y la app funciona igual sin `ia_jev.json`. Se documenta por si se retoma.
- **Qué es:** un modelo «System One» de 2026. Recibe texto y devuelve decisiones tipadas (elegir entre opciones) con probabilidades calibradas, mucho más rápido y barato que un chat. Está en acceso anticipado desde el 2026-09-15.
- **Uso aquí:** solo con la base pública de productos.
  - Estima el NOVA del 73 % de productos que no lo traen.
  - Asigna una categoría limpia de sustitutos.
  - Nunca recibe tiquetes ni datos de personas.
- **Script:** `datos/enriquecer_jev.py`.
  - Sin clave hace una simulación: ejemplo de petición, tokens y costo.
  - `--validar 200` mide la exactitud contra el NOVA conocido.
  - `--ejecutar` genera `web/public/datos/ia_jev.json`, que la app carga si existe.
  - La app usa el NOVA de Jev solo con confianza ≥ 0,8 y lo dice («NOVA estimado por IA, 95 %»).
  - La categoría de Jev se usa como filtro extra en los cambios.
- **Costo (`CALCULADO`):** ≈ 840 000 tokens, unos USD 0,035 para la base de 1235 productos. Para un millón de productos serían ≈ USD 28,6.
- **Tiempo realista con este script** (4 peticiones en paralelo, latencia oficial de 70 a 500 ms): de 22 a 154 s para la base. En lote (MotherDuck) midieron 1217 filas/s, unos 14 min por millón. **«Millones en segundos» no lo respalda ninguna medición publicada.**
- **`POR VERIFICAR`:**
  - No tiene plan gratis publicado: USD 0,042 por millón de tokens de entrada; la salida es gratis.
  - El acceso es por lista de espera, y la clave la crea Pablo en console.typesafe.ai.
  - No confirma soporte de español.
  - Su exactitud es variable: entre 61,8 % y 78,5 % de acuerdo en pruebas de terceros.
  - El formato de la API se escribió según el esquema de docs.typesafe.ai, sin probarlo contra el servicio.

## Medido (ver `src/dominio/flujo.test.ts`)
Base parcial de 1235 productos y 50 tiquetes SIMULADO:
- Líneas leídas: 600 de 600.
- Totales que cuadran: 50 de 50.
- Identificación: cobertura 70,0 %, precisión 99,8 % (meta de RF-02: ≥ 95 %).
- Cambios: 27 de 50 tiquetes con al menos uno.

**Límite:** los tiquetes simulados usan abreviaturas generadas a partir del nombre real, así que estas cifras son optimistas. Con tiquetes reales hay que medir de nuevo.

## Problemas encontrados y corregidos
1. **Cambio sin sentido** (Powerade → café): ahora exige la categoría más específica. Tiene prueba.
2. **OCR con foto real:** aceptaba teléfonos y ruido como productos. Ahora descarta teléfonos y cédulas, precios menores de ₡50 y descripciones sin letras, separa el código de barras impreso y avisa si no hay TOTAL.
3. **La API de búsqueda clásica de Open Food Facts devolvía 503 y 401:** el script ahora es reanudable y usa una fuente alterna.

## Corregido en v0.2
4. **«Palí» con tilde no se reconocía como comercio:** en JavaScript, `` no ve la «í» como letra. Tiene prueba.
5. **El encabezado de la app usaba la misma clase CSS que las barras del gráfico** (`barra`) y heredaba su altura y su fondo verde.
6. **Fecha UTC:** el historial guardaba la fecha UTC, que después de las 6 p. m. en Costa Rica ya es el día siguiente. Ahora usa la fecha local.
7. **Una factura marcada SIMULADO, subida por el botón normal, se trataba como compra real:** guardaba precios y progreso. Ahora todo lo que dice SIMULADO en el comercio o en el encabezado se trata como demostración. Tiene prueba y se verificó en el navegador.
9. **Primer tiquete real (Palí, anonimizado en el repositorio)**. Quedó como prueba fija (`TIQUETE_PALI_REAL` en `tiquete.test.ts`). Fallaba de cuatro formas:
   - tomaba el encabezado «TDA# OP# TE# TR# 53258» como un producto de ₡53 258;
   - perdía la leche porque su cantidad («2 X ¢1,070 2,140») viene en la línea siguiente;
   - no reconocía los códigos, porque **Palí imprime el EAN-13 sin su dígito de control** (ahora se calcula);
   - afirmaba «leche en polvo Dos Pinos» por texto, aunque el código impreso era de otra empresa (ahora pregunta).

   Ahora lee los 6 productos (7 artículos), cuadra con ₡9 000, identifica 2 por código y pregunta por los demás. Además, ninguna línea puede costar más que el total del tiquete.
8. **Hallazgos de la revisión independiente (12), todos corregidos con prueba:**
   - publicar solo semanas cerradas y quitar el conteo en vivo;
   - recordar las compras aportadas;
   - límite de uso: tiempo de espera, proxy y limpieza;
   - consentimiento en cada compra;
   - fecha y cantón validados antes de ofrecer;
   - caché sin carrera entre hilos;
   - selectores de archivo alcanzables con teclado;
   - el aviso de dato dudoso solo con permiso;
   - códigos 04 y 05 excluidos;
   - un registro dañado ya no borra todo el historial, y «0 x precio» ya no divide entre 0;
   - la prueba que comprobaba el orden de las filas por la razón equivocada se corrigió;
   - menores: reintentos acotados, sin alias en las demostraciones y el botón «Borrar mis datos» siempre activo.

## Verificado en v0.2 (2026-11-14)
- **Rendimiento** (`MEDIDO` en la computadora, base de 1235 productos, 20 tiquetes SIMULADO de 12 líneas): leer la base ≈ 3 ms; identificar ≈ 22 ms por tiquete; sellos ≈ 0,1 ms; cambios ≈ 1 ms. En un teléfono de gama baja (5 a 10 veces más lento, `SUPUESTO`) serían ≈ 0,1 a 0,2 s por tiquete; el OCR tarda segundos. No hace falta optimizar. RNF-05 sigue `POR VERIFICAR` con un teléfono real.
- **Pruebas:** 217 en vitest y 42 en pytest. TypeScript y la compilación de producción, sin errores.
- **Recorrido en el navegador con el servicio local:** factura → comercio detectado → aporte de 7 precios (sin repetir al confirmar dos veces) → precio de la comunidad en los cambios («₡60 menos» con dos precios reales) → Mi lista → Progreso → Ajustes → modo oscuro.
- **Auditoría automática de diseño** en 8 pantallas, a 703 y 320 px de ancho: sin desborde horizontal, botones de ≥ 44 px y texto de ≥ 15 px.
- **Pendiente:** revisión visual con capturas. Con la pantalla bloqueada no se pudo hacer.

## Verificado en v0.2.1 (2026-11-14, mejoras del frontend)
- **Pruebas:** 208 en vitest, 40 de ellas nuevas en esta versión: explicación de sellos, caso de prueba y limpieza de datos, regresión con casos, lectura del escáner, íconos del manifiesto, letra y categorías fruta y verdura. TypeScript y `npm run build`, sin errores.
- **En el navegador del panel**, con capturas en claro y oscuro:
  - explicación de los sellos en la canasta;
  - «Guardar caso de prueba» con un tiquete SIMULADO, del que salió `ejemplo-SIMULADO.json`;
  - escáner en vivo con cámara y lector SIMULADO, en dos casos: lee y apaga la cámara, o se niega el permiso y vuelve a la foto;
  - íconos servidos con su tamaño real;
  - cambio de letra, paleta nueva e ilustración.
- **Animaciones:** se comprobaron con la API de animaciones del navegador. El anillo pasa de 0 a su valor, las barras crecen y, al terminar, no queda ninguna transformación. El navegador del panel tiene activado «reducir movimiento» y ahí no corren, como debe ser.
- **Auditoría automática** en 7 pantallas a 320 px de ancho (inicio con herramientas, revisar, canasta, cambios, Mi lista, Progreso y Ajustes): sin desborde horizontal, todos los botones de ≥ 48 px y todo el texto de ≥ 16 px. Para eso se subieron a 16 px los textos que venían de antes en 13 a 15 px: números de los pasos, tabla y detalle del gráfico, globo de la lista y texto leído.
- **Falta:** escáner e instalación en un Android real, y casos de prueba con tiquetes reales.

## Verificado en v0.2.3 (2026-11-14, mejoras del informe de diseño)
- **Informe:** `Canasta_sana/reports/Diseño de apps móviles actuales.md`. Se aplicaron todas sus recomendaciones, salvo una que choca con un pedido de Pablo y en la que manda Pablo: el informe sugería que el modo oscuro siguiera al teléfono, pero queda claro por defecto (D-25).
- **Copia de antes de los cambios:** `prototipo/respaldos/web-v0.2.2-antes-de-mejoras-2026-11-14/`.
- **Pruebas:** 223 en vitest. TypeScript y `npm run build`, sin errores.
- **En el navegador:**
  - claro por defecto aunque el teléfono esté en oscuro, incluso con el valor viejo guardado;
  - la portada nueva con sus íconos;
  - el interruptor «Quitar las animaciones», que se guarda y se aplica;
  - con las animaciones activas: 36 animaciones, ninguna infinita, la más larga de 5,0 s;
  - letra al 200 % sin desbordes;
  - 7 pantallas a 320 px con botones de 48 px o más y texto de 16 px o más.
- **Falta (`POR VERIFICAR`):**
  - si `prefers-reduced-motion` basta para cumplir WCAG 2.2.2 (de todos modos, ya nada dura más de 5 s y hay interruptor);
  - el soporte estable de `text-scale` en Chrome;
  - cuánto tarda la lectura del tiquete en un teléfono de gama baja;
  - una prueba con 5 a 8 personas mayores, que es la recomendación principal del informe.

## Fuera de esta versión
- Aportes a Open Food Facts u Open Prices (RF-10).
- Publicar el servicio en internet (ver `api/README.md`).
- Avisar a Open Food Facts de los 29 productos con datos dudosos. Lo puede hacer cualquier persona en su sitio.
