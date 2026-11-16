# Auditoría del backend de Canasta sana (2026-11-14 y 15)

**Alcance:** servicio `api/` (v0.2.0 → v0.2.1), integración con la app (`web/src/servicio.ts`, `src/dominio/comunidad.ts` y `src/seguridad.ts`), datos (`datos/descargar_off.py` y `web/public/datos/productos_cr.json`) y dependencias.

**Copia previa:** `prototipo/respaldos/api-v0.2.0-antes-de-mejoras-2026-11-14/` (sin cambios hasta el 15) y `api-antes-de-sprint-1-B-05-2026-11-15/`.

**Método:** lectura del código, un script de evidencia contra el código sin corregir (TestClient), medición de rendimiento con 200 000 aportes, OSV.dev para las dependencias de Python, `npm audit` para la app y un análisis de la base. Todo se hizo sin instalar nada.

**Resultado:** se corrigieron 7 hallazgos, cada uno con su prueba. pytest pasó de 42 a 50 pruebas, todas en verde (70 con las de la base del sprint 1). Quedan 15 pendientes para el backlog, priorizados abajo. Ya se arreglaron P-01 (2026-11-15, con permiso de Pablo) y P-13 (en el frontend).

Gravedad: **Alta** = rompe una garantía de privacidad o de integridad, o hay una vulnerabilidad aplicable. **Media** = abuso o pérdida de datos posible, o falta algo para producción. **Baja** = robustez o calidad. **Info** = límite conocido.

## Corregidos (con prueba)

| ID | Gravedad | Hallazgo y evidencia | Arreglo (archivo:línea) | Prueba |
|---|---|---|---|---|
| H-01 | Alta | **Las «semanas cerradas» de D-17 se saltaban con una fecha pasada.** Un aporte con fecha de una semana ya cerrada (hasta 90 días atrás) se publicaba al instante: la tabla pasó de 0 a 3 filas en el mismo día. Comparar la tabla antes y después de un envío revelaba los productos, la cadena y el cantón de ese tiquete. La prueba vieja `test_tabla_k_anonimato` hacía justo eso. | Se guarda la **semana de llegada**, no la de la compra; la fecha solo se valida (`main.py:271`). La tabla cambia solo cuando cierra cada semana. Costo: un precio de una compra vieja se cuenta en la semana en que llegó (máx. 90 días; con inflación baja, el efecto es despreciable). Ver D-28. | `test_aporte_de_semana_cerrada_no_se_publica_al_instante`, `test_tabla_etag_y_cache` |
| H-02 | Alta | **Un solo envío cumplía k ≥ 3.** `[mismo código] × 3` en un POST se publicaba con n = 3 y fijaba la mediana (`999`). | Un envío con un código repetido da 422, incluso si son un UPC-A y su EAN-13 (`main.py:119`). La app ya quita repetidos (`comunidad.ts`, `prepararAportes`). | `test_lote_con_codigo_repetido` |
| H-03 | Alta | **POST «simple» desde cualquier sitio.** Sin `Content-Type`, FastAPI lee el cuerpo como JSON: un POST desde `Origin: https://sitio-ajeno.example` respondió **201**. Un sitio ajeno podía enviar precios falsos desde el navegador de cada visitante (muchas IP, sin límite de uso). CORS no lo impide, porque esa petición no pide permiso previo. | Todo POST exige `Content-Type: application/json`; si no, responde 415 (`main.py:184-187`). Ese tipo obliga al navegador a pedir permiso CORS, y el servicio solo se lo da a la app. | `test_post_solo_json` (3 casos) |
| H-04 | Media | **`/reportes/resumen` contaba en vivo:** un aviso recién enviado aparecía de inmediato y revelaba un producto de la compra de quien avisó. | Solo cuenta semanas cerradas (`main.py:290`, `precios.py`, `resumen_reportes`). | `test_reportes` |
| H-05 | Baja | **Dígitos de otras escrituras.** `\d` de Python aceptaba «٧٤١١٠٠٠٣٤٥٠٢٣» como código válido, y se guardaba así (201). | `[0-9]` en `productos.py:12` y `:58`. | `test_digitos_de_otras_escrituras` |
| H-06 | Media | **El registro de acceso con IP dependía de un parámetro.** Sin `--no-access-log`, uvicorn registra la IP de cada petición. | El servicio apaga `uvicorn.access` al crearse (`main.py:176`). | `test_registro_de_acceso_apagado` |
| H-07 | Media | **Se podía apagar el k-anonimato:** `CANASTA_MIN_REPORTES=1` se aceptaba sin aviso. | Un valor menor que 3 detiene el arranque, según D-17 (`config.py:26`). | `test_k_minimo_3` |

Contrato con la app: los tres cambios endurecen lo que el servicio acepta, y el cliente actual ya cumple todo. `servicio.ts` envía `application/json`, `prepararAportes` no repite códigos y la app no lee `/reportes/resumen`. Por eso no hizo falta tocar `web/`. Sí cambia lo que publica `/precios/tabla`: un precio aparece la semana siguiente a su **envío**, no a su compra.

## Pendientes (para el backlog, de mayor a menor)

| ID | Gravedad | Hallazgo y evidencia | Archivo:línea | Arreglo propuesto |
|---|---|---|---|---|
| P-01 | Alta → **arreglado** (2026-11-15) | **starlette 0.49.3** tenía 5 avisos de OSV: GHSA-86qp-5c8j-p5mr (BadHost), GHSA-jp82-jpqv-5vv3, GHSA-82w8-qh3p-5jfq, GHSA-wqp7-x3pw-xc5r y GHSA-x746-7m8f-x49c. Ninguno se podía explotar aquí (el servicio no usa `StaticFiles`, `HTTPEndpoint`, formularios ni `request.url`). | `requirements.txt:2-3` | **Hecho con el permiso de Pablo:** FastAPI 0.121.1 → **0.141.1** y starlette 0.49.3 → **1.10.0**. Se eligió la 0.141.1 porque es la última FastAPI sin la dependencia `opentelemetry-api` (desde la 0.142); así no se suma una biblioteca de telemetría a un servicio que promete privacidad. La starlette 1.10.0 tiene 22 días de publicada. Verificado: pytest da 70/70, `pip check` no reporta problemas y OSV no da avisos en fastapi ni en starlette. También se probó con uvicorn de verdad: `/salud`, base con gzip, tabla, 415 sin JSON y 201 con JSON, y no se registra ninguna IP aunque falte `--no-access-log`. Copia previa: `respaldos/api-antes-de-actualizar-fastapi-2026-11-15/`. **No se reconstruyó la imagen de Docker** (ver P-07). |
| P-02 | Alta (desarrollo) | **vite 6.0.7 y vitest 2.1.8:** `npm audit` da 2 críticos, 1 alto y 3 moderados. Importa porque el README recomienda `npm run dev -- --host` en la Wi-Fi: los avisos de vite incluyen sitios que leen el servidor de desarrollo y un salto de `server.fs.deny`. No afecta a la versión de producción. | `web/package.json` | Zona del frontend: actualizar vite y vitest. Mientras tanto, usar `--host` solo en redes de confianza. |
| P-03 | Media | **Rendimiento:** cada POST invalida la caché de la tabla. Con 200 000 aportes, recalcularla tarda **1,4 s**, sin protección contra cálculos paralelos (`MEDIDO`). Con H-01, un envío ya no cambia lo publicado, así que esa invalidación sobra. | `precios.py:100`, `:119` | Llave de caché por semana, sin `_version`, y un solo cálculo a la vez. |
| P-04 | Media | **gzip en cada petición:** la base de 527 KB tarda 10,1 ms por petición comprimida y 1,0 ms sin comprimir (`MEDIDO`). Es fácil de usar para gastar CPU. | `main.py:178`, `:216-221` | Comprimir la base y la tabla una sola vez y servir esos bytes. |
| P-05 | Media | **IPv6 sin agrupar:** cada dirección de una misma /64 tiene su propio cupo, así que el límite de uso se salta (5 de 5 permitidas en la evidencia). | `main.py:47`, `:204` | Agrupar IPv6 por /64. |
| P-06 | Media | **SQLite sin migraciones ni respaldo:** `CREATE TABLE IF NOT EXISTS` sin `user_version` (vale 0). Agregar una columna rompería las BD existentes. Copiar el archivo con el servicio activo (WAL) puede dar una copia inconsistente. | `precios.py:23-40`, `:79` | `PRAGMA user_version` con migraciones y un comando de respaldo con `sqlite3.Connection.backup()` e `integrity_check`. |
| P-07 | Media | **Dockerfile no listo para producción:** imagen base sin versión exacta (`python:3.13-slim`, cuando las pruebas corren en 3.14.2); `requirements.txt` fija 5 de las 13 dependencias; no hay `.dockerignore` (el contexto incluye `node_modules`, `.venv` y la BD de desarrollo); uvicorn envía `server: uvicorn` y no tiene `--limit-concurrency`; `/docs` carga scripts de `cdn.jsdelivr.net` en producción. **No se reconstruyó la imagen en este sprint** (habría que descargar). | `Dockerfile:4`, `:11`, `:21`; `main.py:169` | Versión y digest fijos, lista completa de versiones, `Dockerfile.dockerignore`, `--no-server-header --limit-concurrency 64` y `/docs` apagado con una variable. Ejemplo de proxy HTTPS (Caddy) sin registro de IP. |
| P-08 | Baja | **`If-None-Match` exacto:** con `W/"…"` o con una lista responde 200, no 304. Un proxy que debilite el ETag haría que la app descargue todo cada vez. | `main.py:218` | Comparación débil y en lista (RFC 9110). |
| P-09 | Baja | **Zona horaria:** `date.today()` del contenedor está en UTC. La semana cierra el domingo a las 18:00 de Costa Rica, y el límite de 90 días puede correrse un día. | `config.py:24` | Fecha de Costa Rica (UTC−6 fijo, sin horario de verano). |
| P-10 | Baja | **Confianza en el proxy:** con `CANASTA_CONFIAR_PROXY=1` se acepta `X-Forwarded-For` de cualquier origen. Si el puerto 8000 queda expuesto, el cliente elige su «IP». | `main.py:204-208` | Lista de IP o CIDR del proxy, y no publicar el puerto 8000. |
| P-11 | Baja | **Avisos de códigos que no están en la base:** se aceptaron (201) y ensucian el resumen. | `main.py:282` | Responder 422 si el código no está en `base.por_ean`. |
| P-12 | Baja | **Errores y configuración:** un 500 sale en texto plano y sin cabeceras de seguridad (evidencia). `CANASTA_ORIGENES` con «/» al final rompe CORS sin avisar (preflight sin `Access-Control-Allow-Origin`). | `main.py:182-197`; `config.py:33` | Manejador de 500 en JSON y normalización de orígenes. |
| P-13 | Baja | **Integración:** la app no valida la tabla que recibe. `descargarTabla` la guarda tal como llega, y `cacheValida` solo comprueba que `precios` sea un arreglo. Una fila dañada llega a `precioComunidad`. | `web/src/servicio.ts:27`, `web/src/almacen.ts:92` | **Arreglado en el frontend (2026-11-15):** `filaValida()` en `comunidad.ts`, e `indexar()` descarta las filas inválidas. Tiene prueba con NaN, ₡10, un código con letras, n = 0 y null. En la misma ronda, «energía (dato dudoso)» ya se puede avisar (`kcal`, `inconsistente`). Comprobado: `comunidad.test.ts` da 17/17. |
| P-14 | Baja | **Descarga de Open Food Facts:** las escrituras no son atómicas, y un corte deja un JSON truncado en la caché que impide reanudar. Al fallar sale una traza de Python y no una instrucción, y el último intento dice «espero 0 s». `pedir_busqueda` no reintenta. Se quitan repetidos por el código crudo, así que quedan 4 duplicados al pasar UPC-A a EAN-13 (Saint Hubert). `numero()` acepta `inf`. **La causa del 401 en la página 11 no se puede determinar sin red:** alterna con 503, así que parece el limitador de Open Food Facts. Ellos piden un User-Agent con contacto y recomiendan sus volcados para descargas grandes. | `datos/descargar_off.py` (versión del 14): `:54`, `:85`, `:206`, `:88-95`, `:52`, `:194`, `:98` | La base ya se escribe de forma atómica (`escribir_atomico`, B-04, 2026-11-15). Falta lo mismo para las páginas de la caché, una salida limpia con código 75 y el comando para reanudar, reintentos en la búsqueda, normalizar el código antes de quitar repetidos y `math.isfinite`. Agregar `--contacto` solo si Pablo quiere. |
| P-15 | Baja (desarrollo) | **pip 25.3** (5 avisos, corregidos en 26.2) y **pytest 8.4.2** (CVE-2025-71176, `tmpdir`): solo en la `.venv` de desarrollo. | `.venv`, `requirements-dev.txt:2` | Actualizar junto con P-01. |

## Estado de los pendientes (sprint 2, 2026-11-15)

| ID | Estado | Cómo, y su prueba |
|---|---|---|
| P-01 | **Arreglado** | FastAPI 0.141.1 y starlette 1.10.0, con el permiso de Pablo. OSV: 0 avisos. |
| P-02 | Del frontend (B-19) | — |
| P-03 | **Arreglado** (B-17) | La tabla se calcula una vez por semana cerrada y no en cada envío, con un solo cálculo a la vez. `MEDIDO` con 200 000 aportes: tras un envío, de 2497 ms a 6 ms. `test_tabla_se_calcula_una_vez_por_semana`. |
| P-04 | **Arreglado** (B-17) | La base y la tabla se comprimen una sola vez y se sirven ya comprimidas. Base: de 19,7 ms a 5,6 ms; tabla en caché: de 122 ms a 6,9 ms (`MEDIDO`). `test_base_y_tabla_comprimidas_una_sola_vez`. |
| P-05 | **Arreglado** | IPv6 se cuenta por /64 (`clave_cliente`). `test_ipv6_se_agrupa_por_64`. |
| P-06 | **Arreglado** (base) | `PRAGMA user_version = 1`; una base de un esquema más nuevo no se abre. Respaldo con `python -m canasta_api.respaldo` (API de respaldo de SQLite e `integrity_check`) y `Almacen.respaldar()`. Las migraciones de verdad se escriben cuando cambie el esquema. `test_respaldo_y_version_de_esquema`. |
| P-07 | **En parte** | Hecho: `Dockerfile.dockerignore`, `--no-server-header`, `--limit-concurrency 64`, `CANASTA_DOCS=0` (`/docs` responde 404) y `--start-period` en el chequeo de salud. Las opciones se probaron con uvicorn local (sin cabecera `server` y `/docs` en 404) y en `test_docs_se_apagan_en_produccion`. **Pendiente, por este motivo:** fijar la imagen base por digest, fijar todas las dependencias indirectas y pasar a Python 3.14 (las pruebas corren en 3.14.2 y la imagen usa 3.13). Las tres cosas requieren consultar el registro de Docker o descargar la imagen base, y la imagen no se reconstruyó. |
| P-08 | **Arreglado** (B-17) | `If-None-Match` con comparación débil, en lista y con `*`. `test_if_none_match_debil_y_en_lista`. |
| P-09 | **Arreglado** | Fecha de Costa Rica (UTC−6) en `config.hoy_costa_rica`. `test_fecha_de_costa_rica`. |
| P-10 | **Arreglado** | `CANASTA_PROXIES`: solo se cree el `X-Forwarded-For` de esas redes. `test_x_forwarded_for_solo_del_proxy`. |
| P-11 | **Arreglado** | Un aviso de un código que no está en la base da 422. `test_aviso_de_codigo_fuera_de_la_base`. |
| P-12 | **Arreglado** | Los errores 500 salen en JSON y con cabeceras de seguridad, y el registro guarda solo la plantilla de la ruta. La «/» final de los orígenes se quita sola. `test_error_interno_en_json_y_sin_datos_en_el_registro`, `test_origen_con_barra_final`. |
| P-13 | **Arreglado** por el frontend | `filaValida()` en `comunidad.ts`. |
| P-14 | **Arreglado** (base) | Escritura atómica también en la caché, sin «espero 0 s», código de salida 75 con el comando para reanudar en lugar de una traza, repetidos por código normalizado e `inf` rechazado. `test_numero_rechaza_infinito`, `test_repetidos_por_codigo_normalizado`, `test_reintentos_sin_espera_cero_y_cache_atomica`. Reintentos acotados también en `pedir_busqueda`: 6 intentos con espera creciente y un mensaje para reanudar (B-26, sprint 3; `test_busqueda_reintenta_con_espera_creciente_sin_red`). **Pendiente:** `--contacto`, que decide Pablo (B-28). |
| P-15 | **Arreglado** (B-16) | pip 26.2.2 y pytest 9.2.0 en la `.venv`. OSV: 0 avisos en los 23 paquetes. |

API v0.2.2: pytest 85/85 (con B-26).

## Revisado sin hallazgos nuevos

- **Contrato API ↔ cliente:** campos, rutas, límites (₡50 a ₡500 000, 60 por envío, 90 días, futuro de +1 día), cadenas y cantones coinciden. La prueba `comunidad.test.ts` compara las listas con `geografia.py`. La app solo usa `/precios/tabla`, `POST /precios` y `POST /reportes`, nunca rutas por producto.
- **CSP** (`seguridad.ts:12`): `connect-src` solo admite la app y el origen del servicio. Límite: una `<meta>` no puede fijar `frame-ancestors`, así que la protección contra marcos debe venir del servidor que aloje la app.
- **Inyección SQL:** todas las consultas usan parámetros. Los nombres de tabla son constantes internas.
- **Columnas guardadas:** no se guarda IP, hora ni dispositivo, los ids son aleatorios y la huella del límite de uso vive solo en memoria con sal.
- **Rendimiento de envío:** un POST de 60 precios tarda 10,9 ms con 200 000 filas. La tabla resultante tiene 15 264 filas: 2,7 MB, o 0,25 MB con gzip (`MEDIDO`).

## Límites conocidos (Info)

- El k-anonimato cuenta **aportes**, no personas. Alguien puede hacer 3 envíos separados de un mismo código (el límite es de 120 por hora). La mediana y el descarte ×3 lo atenúan, pero no lo impiden.
- Publicar en tres niveles (país, cadena y cadena con cantón) permite restar un nivel de otro y deducir algo de un grupo con menos de 3 aportes. El riesgo es bajo, porque un precio no identifica a nadie.
- Con poco tráfico, si una sola persona envió en toda una semana, lo que aparece al cerrar esa semana es su compra. Se resuelve con volumen, no con código.

## Base de productos (`productos_cr.json`, 1235 productos, `MEDIDO`)

| Revisión | Resultado |
|---|---|
| Dígito de control inválido o formato no GS1 | 20 (largos de 7, 10, 11 y 14 dígitos) |
| Uso interno (2x, 02, 04, 05) | 6 |
| Duplicados tras pasar UPC-A a EAN-13 | 4 (ver P-14) |
| Valores no finitos o negativos | 0 |
| Más de 100 g por 100 g | 14. La app ya los trata como dato dudoso (D-13). |
| Más de 900 kcal por 100 g | 9 |
| kcal lejos de 9·G + 4·C + 4·P | 79 con el criterio «>25 % y >40 kcal» → **B-01** |
| Sin tamaño (`cantidadNum`) | 1092 (88,4 %) → **B-04** |
| Con NOVA | 328 (26,6 %) |
| Con ingredientes / aditivos | 137 / 77 |

Scripts de evidencia (no incluidos en el repositorio): `evidencia.py`, `rendimiento.py`, `calidad_base.py` y `osv.py`.
