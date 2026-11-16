# Investigación — Canasta sana (2026-11-13)

Etiquetas: `VERIFICADO` (leído en la fuente citada ese día), `MEDIDO` (consulta propia), `CALCULADO`, `POR VERIFICAR`. Las cifras de prensa son de fuente secundaria.

## 1. El problema en Costa Rica
- **Sobrepeso y obesidad:** según la encuesta de la CCSS de 2024 (citada por La Nación), 32,3 % de los adultos tiene obesidad y 42,3 % sobrepeso. En 2010, la obesidad era del 26 %. [La Nación](https://www.nacion.com/el-pais/obesidad-la-puerta-de-entrada-a-otras-enfermedades/ECLICE6TANFYPBPID36NHSGJNU/story/)
- **Diabetes:** pasó de cerca del 11 % en 2010 al 16 % en 2024, según un epidemiólogo de la CCSS. En adultos mayores llega al 36,2 %. [La Nación](https://www.nacion.com/el-pais/de-que-se-esta-enfermando-costa-rica-asi-aumento/JM4PAES5DJEVFAWNYQRYTEUCUY/story/) · [La Nación](https://www.nacion.com/el-pais/costa-rica-es-un-paciente-cronico-este-es-su/VFERTQWMYFBKZI7TEUMBTC5WQI/story/)
- **Sin encuesta nacional de nutrición** desde 2009, según la prensa. `POR VERIFICAR`
- **Cifras en conflicto:** hay fuentes con datos distintos. Antes de citarlas en un documento formal, hay que tomarlas del informe oficial de la CCSS. `POR VERIFICAR`

## 2. Etiquetado frontal (octágonos)
- **No está aprobado.** El proyecto de ley 24.840 seguía en la Comisión de Derechos Humanos en septiembre de 2025, y en abril de 2026 se seguía pidiendo. [Delfino 2025](https://delfino.cr/2025/09/nutricionistas-urgen-a-diputados-a-avanzar-con-proyecto-de-etiquetado-frontal-de-advertencia) · [Delfino 2026](https://www.delfino.cr/2026/04/costa-rica-clama-etiquetado-frontal-para-frenar-la-masacre-68-personas-mueren-por-dia-por-enfermedades-no-transmisibles)
- **Funciona:** un estudio de la OPS con INCIENSA concluyó que los octágonos son el sistema que mejor ayuda a los consumidores de Costa Rica a identificar los productos menos sanos. [OPS](https://www.paho.org/es/noticias/17-6-2022-octagonos-advertencia-son-sistema-etiquetado-frontal-alimentos-mas-efectivo)
- **Base técnica:** el proyecto usa el Modelo de Perfil de Nutrientes de la OPS (2016).
- **Oposición:** existe un choque con acuerdos de etiquetado que el país ha suscrito, y hay oposición de la industria. [Delfino 2023](https://delfino.cr/2023/08/tras-ordenar-ocultarlas-ministerio-de-salud-pide-reforma-legal-sobre-etiquetas-de-advertencia-nutricional)
- **Guías Alimentarias:** el Ministerio de Salud oficializó el plan de implementación de las Guías Alimentarias 2024–2030. [Delfino](https://delfino.cr/2025/09/ministerio-de-salud-oficializa-el-plan-de-implementacion-de-guias-alimentarias-2024-2030)

## 3. Evidencia científica
- **Tiquetes como medida de la dieta:**
  - En Suiza, el índice FSA-NPS DI fue el mejor indicador para estimar la calidad de la dieta a partir de tiquetes. [Nutrients 2021](https://pmc.ncbi.nlm.nih.gov/articles/PMC8747076)
  - En Chicago, las compras del hogar estimaron la calidad general de la dieta sin sesgo, pero sirvieron menos para nutrientes específicos. [BMC Public Health 2017](https://link.springer.com/article/10.1186/s12966-017-0502-2)
  - **Límite:** los tiquetes reflejan al hogar, no a cada persona.
- **Apps de cambios de productos:**
  - SaltSwitch logró que pacientes cardíacos compraran productos con menos sal en 6 semanas. [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC6787994)
  - El ensayo SALTS (app más sustituto de sal, en hipertensos) no redujo el sodio consumido. [JMIR mHealth 2023](https://mhealth.jmir.org/2023/1/e43675)
  - **Conclusión: efecto modesto.** Hay que medir el impacto antes de afirmarlo.
- **Antecedentes:** FoodSwitch (George Institute), Yuka y Open Food Facts analizan productos sueltos por código de barras. **No encontré ninguno que analice la canasta completa desde el tiquete combinando salud y precio en Costa Rica.** `POR VERIFICAR` con una búsqueda más amplia.

## 4. Datos abiertos
- **Open Food Facts:**
  - Base colaborativa con más de 3 millones de productos de 180 países. [Prensa OFF](https://us.openfoodfacts.org/press)
  - Licencia ODbL: uso libre, incluso comercial, con crédito y obligación de compartir igual la base derivada. [Licencia](https://openfoodfacts.github.io/openfoodfacts-server/api/tutorials/license-be-on-the-legal-side)
  - La creó Stéphane Gigandet en Francia en 2012; hoy es una asociación sin fines de lucro. [Quiénes somos](https://world-hi.openfoodfacts.org/who-we-are)
- **Productos de Costa Rica en Open Food Facts** (`MEDIDO` el 2026-11-13 con la API pública v2):
  - 2 941 productos con país Costa Rica.
  - 2 263 con la tabla nutricional completa: 76,9 % (`CALCULADO`).
- **Open Prices:** base abierta de precios aportados con fotos de tiquetes y etiquetas de góndola. [Datos](https://openfoodfacts.github.io/open-prices/guides/data/) · [API](https://openfoodfacts.github.io/open-prices/guides/API/). Su cobertura en Costa Rica está `POR VERIFICAR`.
- **Tabla de Composición de Alimentos de Centroamérica (INCAP/OPS):** la edición oficial se vende; su licencia de reutilización está `POR VERIFICAR`. [Catálogo INCAP](https://bvssan.incap.int/wordpress/wp-content/uploads/2022/02/Publicaciones-INCAP-venta-3jun2021.pdf)

## 5. OCR y factura (de `../Comparador_diario`)
- **Factura electrónica:** el consumidor común recibe un tiquete impreso, sin XML. El grupo Walmart solo da factura electrónica a quienes están inscritos en Tributación desde el 2025-08-23.
- **OCR gratuito:** Tesseract.js en el teléfono, PaddleOCR en un servidor propio o Azure DI F0 (500 páginas al mes). Ninguno conoce las abreviaturas de Costa Rica.
