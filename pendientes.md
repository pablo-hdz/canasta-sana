# Pendientes (2026-11-13)

## Preguntas abiertas
1. ¿Es un trabajo de curso (evaluado) o un proyecto para lanzar?
2. ¿Aprueba D-02 a D-06?
3. ~~¿Conoce a alguna nutricionista?~~ Resuelto el 2026-11-13: no hace falta por ahora (D-08).

## Por verificar
### Reglas de salud
- Umbrales exactos del modelo de la OPS y su método para estimar azúcares libres, contra el documento oficial.
- Guías Alimentarias de Costa Rica vigentes y qué recomiendan.

### Datos
- Cobertura de Open Prices en Costa Rica.
- Licencia de la Tabla de Composición de Alimentos de Centroamérica (INCAP), o una alternativa abierta.
- Cifras oficiales de la encuesta de la CCSS de 2024.

### Legal y ética
- Si las recomendaciones generales caen en el ejercicio de la nutrición (Colegio de Profesionales en Nutrición).
- Si un piloto con personas requiere comité ético (Ley 9234).
- Regulación de software médico en Costa Rica.
- Reglas del curso sobre el uso de IA.

### Técnico
- Exactitud de Tesseract.js con tiquetes térmicos reales.
- Rendimiento en un teléfono de gama baja.
- Si existe ya una app parecida (búsqueda amplia de competencia).

## Prototipo v0.1 (2026-11-14)
- **Medir con tiquetes y facturas reales:** OCR, identificación y cambios. La primera foto real se leyó mal. Hace falta reunir 10 a 30 tiquetes y facturas XML reales, con permiso y sin datos personales visibles.
- **Base completa de Open Food Facts:** 2263 productos. La descarga clásica sigue con 503; hoy se usa una base parcial de 1235.
- ~~Funcionamiento sin conexión~~: resuelto en v0.1.1 (verificado con el servidor apagado).
- **PDF de factura real:** no se ha probado.
- **Validar con XML reales de varios comercios:** el lector de XML se probó con un ejemplo SIMULADO de la estructura v4.4.
- **Precios estimados:** solo 4 categorías están calibradas; el resto es `SUPUESTO`.

## Supuestos
- Tolerancia de ±20 % en el control de energía.
- Mejora mínima del 25 % del nutriente crítico para proponer un cambio.
- Metas de los criterios de aceptación de `requisitos.md`.

## Prototipo v0.2 (2026-11-14, trabajo de la noche)
- **Aprobar D-17** (servicio opcional de precios comunitarios). Revisar el diseño de privacidad: sin IP, sin hora, id aleatorio, k = 3, listas cerradas.
- **Revisión visual con capturas:** con la pantalla bloqueada no se pudieron tomar. Se hizo una auditoría automática en 8 pantallas, a 703 y 320 px: sin desborde horizontal, botones de ≥ 44 px y texto de ≥ 15 px. Falta mirarla, sobre todo en modo oscuro.
- **Lista de 84 cantones:** `POR VERIFICAR` contra la División Territorial Administrativa oficial.
- **Prefijos GS1 de uso interno** (02, 2x; EAN-8 0 y 2): `POR VERIFICAR` contra la edición vigente de las GS1 General Specifications.
- `SUPUESTO`s del servicio:
  - k = 3 aportes para publicar un precio;
  - factor ×3 para descartar atípicos;
  - precio de ₡50 a ₡500 000;
  - compras de hasta 90 días atrás;
  - tabla de 12 semanas;
  - 120 filas por hora.
- `SUPUESTO`: 5 puntos porcentuales de umbral para decir que el progreso «mejora» o «empeora».
- **Publicar el servicio en internet:** no se hizo. Hace falta HTTPS, dominio, quién lo administra y una defensa contra precios inventados desde muchas IP.
- **Detección del comercio:** solo reconoce los nombres de las cadenas en el encabezado. La razón social de la factura (p. ej. la de Walmart) no dice qué cadena es.
- **Colorantes (D-19):** la cobertura depende de los ingredientes; solo el 11 % de la base los trae. Medir cuánto mejora la foto de ingredientes con etiquetas reales. La norma de Costa Rica sobre estos colorantes queda `POR VERIFICAR`, y la app no dice nada sobre ella.
- **Umbrales del nivel de gasto con sellos** (verde ≤ 20 %, ámbar ≤ 50 %, rojo > 50 %): `SUPUESTO`. Ajustarlos cuando haya compras reales de varios hogares.
- **Tiquetes reales:** van 1 de 10 a 30 (Palí, 04/11/25: corregido y como prueba fija). Faltan otras cadenas (Walmart, Más x Menos, Auto Mercado, PriceSmart) y facturas XML reales.

## Prototipo v0.2.1 (2026-11-14, mejoras del frontend)
- **Escáner en vivo en un Android real:** se probó con cámara y lector SIMULADO, porque Chrome en Windows no trae `BarcodeDetector`. Hay que medir RF-03 (≥ 95 % de EAN-13 en 50 empaques) con un teléfono. Con la red local (http) no hay cámara en vivo: hace falta HTTPS o `localhost`.
- **Instalar la app en Android:** los íconos están verificados, pero no se instaló en un teléfono real.
- **Casos de prueba con tiquetes reales:** usar «Guardar caso de prueba» con 10 a 30 tiquetes reales, revisar cada archivo (un nombre suelto sin rótulo no se detecta) y copiarlos a `web/src/casos/`.
- **D-20:** que Pablo confirme si Atkinson queda como opción o como letra por defecto.
- `SUPUESTO`: 2 lecturas iguales seguidas para aceptar un código del escáner, y unas 5 lecturas por segundo.
- **Categorías fruta y verdura por nombre:** solo si el nombre empieza con la fruta o la verdura. Hoy son 7 frutas y 4 verduras en la base. «NATURAS» (salsa de tomate) queda como verdura, porque así la clasifica Open Food Facts.

## Prototipo v0.2.3 (2026-11-14, informe de diseño)
- **Prueba con personas (prioridad 1 del informe):** 5 a 8 personas mayores, en un teléfono de clase Galaxy A16 y con la letra del sistema al máximo.
- **`POR VERIFICAR`:**
  - si `prefers-reduced-motion` basta para WCAG 2.2.2;
  - el soporte estable de `<meta name="text-scale">` en Chrome para Android;
  - el tiempo de lectura del tiquete en gama baja (si pasa de 10 s, mostrar solo la barra con porcentaje);
  - si 1 px CSS equivale a 1 dp en Android;
  - los documentos de la OPS de 2026 sobre el diseño de los sellos en pantalla, que no se pudieron leer (error 403).
- **D-26:** Pablo tiene que confirmar que le sirve el anillo de un solo tono, que revierte en parte D-18. Para volver atrás está la copia en `prototipo/respaldos/`.

## Sprint 1, frontend (2026-11-15)
- **B-07, `POR VERIFICAR`:** las leyendas sobre niños que no vienen del documento OPS 2016 (p. ej., «no recomendable en niños» de otras normas, o la advertencia de la UE sobre la atención de los niños). La app no las muestra como norma: en el paso 4 solo dice qué lleva el producto («Lleva edulcorantes: …», «Lleva colorantes de la lista: …», «La etiqueta declara: leche»). Nunca dice «no contiene».
- **B-03:** en una compra SIMULADO, «Cambiar» corrige la línea pero no guarda el alias (regla: en una demostración no se aprenden alias). Un alias malo se corrige con una compra real o se olvida en Ajustes.
- **B-10 (solo medido; decide Scrum):** texto principal a 320 px por debajo de 18 px: la explicación de los sellos (16 px), los botones «Foto» de Colorantes (16 px), los avisos del hogar (16 px) y el cuadro para pegar texto (16 px).
- **P-02 (auditoría), resuelto el 2026-11-15:** vite 6.0.7 → 6.4.6 y vitest 2.1.8 → 5.1.0, con permiso de Pablo. `npm audit` da 0 vulnerabilidades (antes 2 críticas, 1 alta y 3 moderadas). Pasan TypeScript, las 249 pruebas, la compilación y el servidor de desarrollo. Copia previa en `prototipo/respaldos/web-antes-de-actualizar-vite-2026-11-15/`.
- **B-14 (antes B-10), resuelto el 2026-11-15:** la explicación de los sellos, los avisos del paso 4, el cuadro para pegar texto y los botones «Foto» pasan a 18 px (1,125 rem). La auditoría en el navegador da 0 textos principales por debajo de 18 px y ningún desborde, a 320 px y con la letra al 200 %. La prueba es `tamanos.test.ts`.
