# API opcional de Canasta sana (v0.2.2, 2026-11-15)

Servicio pequeño para **datos públicos**. La app funciona completa sin él y sin conexión (D-17).

| Ruta | Para qué |
|---|---|
| `GET /salud` | Estado, versión y número de productos (sin conteo de aportes en vivo) |
| `GET /catalogos` | Cadenas y los 84 cantones (listas cerradas) |
| `GET /productos/version` | Huella SHA-256 de la base: la app sabe si hay una base nueva |
| `GET /productos/base` | Base completa con `ETag` (responde 304 si no cambió) |
| `GET /productos/buscar?q=` | Búsqueda sin tildes y por inicio de palabra («lech semid»); también por código |
| `GET /productos/{código}` | Un producto; acepta UPC-A de 12 dígitos |
| `POST /precios` | Aporte anónimo de 1 a 60 precios de un tiquete propio (sin códigos repetidos) |
| `GET /precios/tabla` | Tabla pública: mediana, p25, p75 y n por código, a tres niveles (país, cadena, cadena + cantón) |
| `POST /reportes` | Aviso de dato dudoso (p. ej. sodio ×1000 o azúcares mayores que los carbohidratos), solo con opciones cerradas |
| `GET /reportes/resumen` | Conteo de avisos por producto (solo semanas cerradas) |

Documentación interactiva en `http://localhost:8000/docs`.

## Privacidad por diseño
- **La canasta nunca sale del teléfono.** La app descarga la tabla completa de precios y busca ahí. No hay ruta «precio de este producto», porque revelaría qué compró la persona.
- **Un aporte guarda solo** código, precio unitario, cadena, cantón opcional y la semana ISO **en que llegó** (D-28; la fecha de la compra solo se valida). No guarda IP, hora, dispositivo ni cuenta. Hay una prueba que verifica las columnas de la tabla.
- **Campos de más = rechazo** (`extra='forbid'`): si llega `correo`, `cedula` o `nombre`, la petición falla con 422 y no se guarda nada.
- **Solo semanas cerradas:** la tabla publica las semanas ISO que ya terminaron y `/salud` no cuenta aportes. Si alguien mirara la tabla o el conteo antes y después de un envío, vería qué productos llegaron juntos, a qué hora, de qué cadena y de qué cantón; así no puede (lo señaló la revisión independiente). Costo: un precio aparece en la tabla la semana siguiente a su envío. Antes de v0.2.1, una compra con fecha de una semana ya cerrada se publicaba al instante (auditoría H-01).
- **Sin orden de llegada:** el identificador es aleatorio.
- **k-anonimato:** un grupo solo se publica con 3 aportes o más (`CANASTA_MIN_REPORTES`, nunca menos de 3). Un envío no puede repetir un código, así que una sola compra no llena el grupo.
- **Solo JSON:** todo POST exige `Content-Type: application/json` (415 si no). Así un sitio ajeno no puede enviar aportes desde el navegador de sus visitantes sin el permiso CORS.
- **Límite de uso:** 120 filas por hora por cliente. La IP se convierte en una huella con sal aleatoria que solo vive en memoria y cambia al reiniciar. `Retry-After` dice cuánto esperar hasta que de verdad quepa el envío. Detrás de un proxy propio se usa la IP que agrega el proxy (la última de `X-Forwarded-For`), no la que escribe el cliente. Las huellas viejas se borran.
- **Sin registro de acceso:** se ejecuta con `--no-access-log`, porque el registro de uvicorn guardaría la IP. Desde v0.2.1 el servicio también lo apaga por su cuenta.

## Tamaño
Respuestas comprimidas con gzip: la base pasa de 527 KB a 96 KB (`MEDIDO`). Ayuda en teléfonos prepago.
La base se comprime una vez al arrancar, y la tabla de precios se calcula y comprime una vez por semana. Así un envío ya no obliga a recalcularla (B-17). `MEDIDO` con 200 000 aportes: la tabla después de un envío bajó de 2497 ms a 6 ms, y la base con gzip de 19,7 ms a 5,6 ms. Los ETag son débiles (`W/"…"`) y se comparan como dice RFC 9110.

## Calidad de los datos
- **Código de barras con dígito de control GS1.** Se rechazan los códigos de uso interno (productos pesados en tienda, prefijos 2x). En la base de Open Food Facts, 1215 de 1235 códigos son válidos.
- **Precio** entre ₡50 y ₡500 000 por unidad (`SUPUESTO`).
- **Fecha de la compra:** de hasta 90 días atrás y nunca futura. La tabla usa las últimas 12 semanas.
- **Mediana robusta:** descarta valores fuera de [mediana ÷ 3, mediana × 3], por ejemplo un cero de más leído por el OCR.

## Cómo ejecutarlo
```
cd Canasta_sana/prototipo/api
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements-dev.txt
.venv\Scripts\python -m pytest -q                      # 85 pruebas (servicio y base de productos)
.venv\Scripts\python -m uvicorn --factory canasta_api.main:crear_app --port 8000 --no-access-log
```


Con Docker, desde `Canasta_sana/prototipo`:
```
docker build -f api/Dockerfile -t canasta-api:0.2.2 .
docker run --rm -p 8000:8000 -v canasta_datos:/datos canasta-api:0.2.2
```
**Verificado el 2026-11-14:**
- la imagen se construye;
- `/salud` responde con 1235 productos;
- un aporte devuelve 201;
- el proceso corre como usuario sin privilegios (uid 10001);
- el registro no muestra ninguna IP.

Variables de entorno:
- `CANASTA_BASE` y `CANASTA_BD`.
- `CANASTA_ORIGENES`: orígenes permitidos por CORS, separados por coma. Una «/» al final se quita sola.
- `CANASTA_MIN_REPORTES`: 3 o más.
- `CANASTA_LIMITE_HORA`: filas por cliente por hora. IPv6 se cuenta por /64.
- `CANASTA_CONFIAR_PROXY=1`: solo detrás de un proxy propio. Conviene sumar `CANASTA_PROXIES` con la IP o CIDR del proxy, así un `X-Forwarded-For` que no llegue desde ahí se ignora.
- `CANASTA_DOCS=0`: sin `/docs`, que carga scripts de cdn.jsdelivr.net. La imagen de Docker lo trae así.

La fecha del servicio es la de Costa Rica (UTC−6), así que la semana cierra el domingo a medianoche de aquí.

**Respaldo** (también con el servicio en marcha): `python -m canasta_api.respaldo destino.sqlite3`. Revisa la copia con `integrity_check`. En Docker: `docker exec <contenedor> python -m canasta_api.respaldo /datos/respaldo.sqlite3`. La base lleva su versión de esquema (`PRAGMA user_version`): una base de un esquema más nuevo no se abre.

**Imagen de Docker** (2026-11-15): se agregaron `Dockerfile.dockerignore`, `--no-server-header`, `--limit-concurrency 64` y `CANASTA_DOCS=0`; se probaron con uvicorn local. **No se reconstruyó la imagen**: habría que descargar la imagen base. Ver P-07 en `AUDITORIA.md`.

## Integración con la app (B-30, 2026-11-15)
`.venv\Scripts\python integracion_app.py` levanta el servicio y la app en desarrollo (Vite con `VITE_API_URL`) en puertos libres y con una base de datos temporal. Comprueba el preflight CORS, la tabla con gzip y 304 con ETag débil, y un aporte con solo código, precio, cadena, cantón y fecha. Al final borra la base temporal y apaga los servidores. Con `--mantener` deja los servidores encendidos para probar la pantalla en el navegador.

**Verificado en el navegador** (starlette 1.10.0, API v0.2.2):
- la tabla se pidió con 200 y luego con `If-None-Match`: 304, sin errores en la app;
- la compra SIMULADO no ofreció aportar y no hizo ningún POST;
- la compra de prueba pegada como texto ofreció 3 precios y el POST respondió 201, con preflight 200. Su cuerpo llevaba solo `ean`, `precio`, `cadena`, `canton` y `fecha`, con `credentials: omit` y `no-referrer`.

## Pendiente
Ver `AUDITORIA.md` (2026-11-15): 7 hallazgos corregidos con prueba y 15 pendientes. starlette ya está al día (P-01: FastAPI 0.141.1 y starlette 1.10.0). Lo más urgente ahora es el Dockerfile (P-07); la imagen no se reconstruyó con las versiones nuevas.

- **Publicarlo en internet** (no se ha hecho): requiere HTTPS, un dominio y decidir quién lo administra. Además hay que medir el abuso real: alguien podría inventar precios desde muchas IP. La mediana y el k-anonimato lo atenúan, pero no lo impiden.
- **Lista de cantones:** `POR VERIFICAR` contra la División Territorial Administrativa oficial.
- **Prefijos GS1 de uso interno:** `POR VERIFICAR` contra la edición vigente de las GS1 General Specifications.
