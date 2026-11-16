# Requisitos — Canasta sana (borrador para aprobación, 2026-11-13)

Las cifras de los criterios son propuestas (`SUPUESTO`) hasta que Pablo las apruebe.

## Usuarios
- Hogares de clase media y baja de Costa Rica. Incluye adultos mayores con poca experiencia digital.
- Más adelante, nutricionistas de EBAIS, con permiso de la persona.

## Requisitos funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RF-01 | Leer el tiquete desde una foto (cámara o galería) **dentro del teléfono**, con soporte para varias fotos por tiquete. | Con 20 tiquetes de prueba, ≥ 85 % de las líneas con descripción y precio legibles. La foto no se envía a ningún servidor (verificado en las peticiones de red). |
| RF-02 | Identificar el producto de cada línea con la base de productos. Si la confianza es baja, pedir que se escanee el código de barras. | En 200 líneas etiquetadas a mano, ≥ 95 % de precisión en las líneas marcadas como «identificadas». Las demás piden confirmación. |
| RF-03 | Escanear el código de barras con la cámara para identificar o confirmar un producto. Lo confirmado se guarda como alias para la próxima vez. | Lee EAN-13 en ≥ 95 % de 50 empaques de prueba con buena luz. El segundo tiquete con el mismo producto ya no pide escaneo. |
| RF-04 | Calcular los «sellos» de cada producto procesado o ultraprocesado según el modelo de perfil de nutrientes de la OPS: exceso de azúcares libres, sodio, grasas totales, grasas saturadas y grasas trans, y presencia de edulcorantes. | Pruebas unitarias con ≥ 30 productos calculados a mano: el resultado coincide al 100 %. Productos frescos sin procesar: sin sellos. |
| RF-05 | Mostrar un resumen de la canasta: cuántos productos y qué parte del gasto tienen al menos un sello, sin calorías ni juicios. | El resumen cuadra con la suma de los productos (prueba unitaria). Ningún texto usa «malo», «prohibido» ni similares (revisión de textos). |
| RF-06 | Proponer como máximo 3 cambios por canasta: misma categoría, tamaño parecido, menos sellos y precio igual o menor cuando se conozca. | En 20 canastas de prueba, cada cambio cumple todas las reglas de RF-07. Si no hay cambio que cumpla, no se propone ninguno. **Reemplazado en la interfaz por D-23** (lista de productos para sustituir, de más a menos sellos); el motor sigue en el código con sus pruebas. |
| RF-07 | Reglas de seguridad de los cambios: nunca sustitutos de sal (cloruro de potasio), nunca un alérgeno marcado por la persona, nunca edulcorantes si el hogar marcó niños, nunca «compre menos». | Pruebas automáticas con casos trampa para cada regla: el 100 % se rechaza. |
| RF-08 | Perfil del hogar opcional, guardado solo en el teléfono: alergias, niños en casa y súper habitual. | Sin perfil, la app funciona igual. El perfil puede borrarse en un toque. |
| RF-09 | Historial mensual de la canasta, solo en el teléfono, con su tendencia. | Muestra la tendencia con 2 o más meses. Borrar el historial lo elimina por completo. **Hecho en v0.2** («Su progreso»: % del gasto en empacados con sellos, por mes). |
| RF-10 | Aportar a Open Food Facts u Open Prices un producto o precio que falte (fotos de la etiqueta, la tabla o el precio), con consentimiento y sin datos personales. | Antes de enviar, la persona ve exactamente qué se envía. No se envía ninguna foto de tiquete sin recortar. |
| RF-11 | Cada dato muestra su fuente y su fecha. Lo simulado se marca `SIMULADO`. | El 100 % de los productos y precios en pantalla tienen fuente. Ningún dato simulado aparece sin su marca. |
| RF-12 | Subir la factura electrónica (XML de Hacienda v4.3/v4.4, o PDF) como alternativa a la foto. Del XML se leen solo las líneas, el total, el comercio y la fecha. | Prueba con XML v4.4: líneas, cantidades, montos y códigos exactos; los datos del receptor nunca aparecen; rechaza la respuesta de Hacienda. |
| RF-13 | Historial local de precios reales de las compras de la persona; precios estimados marcados con «≈». | Solo se guardan precios de compras cuyo total cuadra. Ningún ahorro se presenta como real si uno de los precios es estimado (prueba unitaria). |
| RF-14 | «Mi lista»: guardar en el teléfono los cambios elegidos, marcarlos como comprados y compartirlos (hoja del teléfono, WhatsApp o copiar). (v0.2) | El texto compartido contiene solo los productos de la lista, sin datos del hogar ni del tiquete (prueba unitaria). |
| RF-15 | Precios de la comunidad, opcionales (D-17): la app descarga la tabla completa de medianas y busca en el teléfono. (v0.2) | Ninguna petición al servicio contiene códigos de la canasta (no existe ruta por producto). Apagado por defecto (prueba de interfaz). |
| RF-16 | Aporte anónimo de precios de una compra, con consentimiento en cada compra (RNF-02, RF-10): la persona ve la lista exacta de lo que se enviaría y decide. (v0.2) | Nada se envía sin el toque de «Aportar» en esa compra. Se envían solo código, precio unitario, cadena, cantón y fecha. Una compra no se envía dos veces. Lo SIMULADO nunca se envía. |
| RF-17 | Avisar de un dato dudoso de la base pública con un toque (solo código y opciones cerradas). (v0.2) | Sin texto libre (el servicio rechaza campos de más). |
| RF-18 | Avisar de los colorantes con advertencia o prohibidos en otros países, con su norma y fuente (D-19). Si el producto no trae ingredientes, permitir leerlos con la cámara. (v0.2) | Detecta por código y por nombre, con y sin tilde, sin falsos positivos con números parecidos (pruebas). Cada aviso enlaza a su norma oficial. La palabra «peligroso» no se usa como afirmación. |

## Requisitos no funcionales

| ID | Requisito | Criterio de aceptación |
|---|---|---|
| RNF-01 | Costo de operación ₡0 en el prototipo. | Sin servidor propio. Alojamiento en un plan gratuito. Con D-17 existe un servicio **opcional** para precios de la comunidad; la app funciona completa sin él (`POR VERIFICAR` con Pablo). |
| RNF-02 | Privacidad (Ley 8968, datos de salud). | No se envía ningún dato personal ni de compras a servidores. Consentimiento separado para cada aporte. |
| RNF-03 | Funciona sin conexión después de la primera carga. | Prueba en modo avión: el flujo completo funciona. |
| RNF-04 | Accesible para adultos mayores. | Texto principal ≥ 18 px y ningún texto menor de 16 px (salvo el texto dentro del gráfico de los sellos). Botones ≥ 48 px, contraste WCAG 2.2 AA y máximo 4 pantallas de la foto al resultado. |
| RNF-05 | Rápida en teléfonos de gama baja. | Resultado en ≤ 20 s para un tiquete de 40 líneas en un teléfono Android de gama baja (`POR VERIFICAR` cuál). |
| RNF-06 | App informativa: los sellos y cambios salen solo del modelo de la OPS y de las reglas de seguridad programadas (RF-07). No da consejos individuales. Por decisión de Pablo (D-08), no hay revisión de una nutricionista en esta etapa. | Cada sello y cada cambio se puede rastrear hasta su regla y su fuente. Las pruebas de RF-04 y RF-07 pasan al 100 %. |
| RNF-07 | Licencias respetadas. | Crédito a Open Food Facts visible. La base derivada se publica bajo ODbL. |
| RNF-08 | Robustez (v0.2). | Ningún error deja la pantalla en blanco (protección ante errores). Un dato guardado dañado o de otra versión no rompe la app ni activa envíos (pruebas de almacenamiento). |

## Fuera de alcance
- Planes de dieta individuales, conteo de calorías, metas de peso y recomendaciones para enfermedades concretas.
- Venta de datos o publicidad de marcas.
