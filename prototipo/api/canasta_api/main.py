"""API opcional de Canasta sana (D-17).

La app funciona completa sin este servicio. Solo sirve datos públicos y recibe aportes anónimos:
- nunca recibe tiquetes, canastas, perfiles ni datos de personas;
- la app descarga la tabla completa de precios y busca en el teléfono, así el servidor no sabe qué compró nadie.

Ejecutar: uvicorn --factory canasta_api.main:crear_app --no-access-log   (sin registro de IP)
"""
import hashlib
import hmac
import ipaddress
import logging
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import date, timedelta
from enum import Enum
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .config import Config
from .geografia import CADENAS, PROVINCIAS, cadena_canonica, canton_canonico
from .precios import Almacen, semana_iso
from .productos import Base, ean_valido, normalizar_ean, uso_interno

VERSION = '0.2.2'
PRECIO_MINIMO = 50          # colones; por debajo es ruido de OCR (igual que la app)
PRECIO_MAXIMO = 500_000     # colones por unidad (SUPUESTO: ningún alimento de supermercado cuesta más)


registro = logging.getLogger('canasta_api')


def clave_cliente(ip: str) -> str:
    """Cupo por cliente. IPv6 se agrupa por /64: un hogar o un teléfono recibe una /64 entera y podía cambiar de
    dirección para saltarse el límite (auditoría P-05). Una IPv4 escrita como IPv6 (::ffff:1.2.3.4) cuenta como IPv4."""
    try:
        d = ipaddress.ip_address(ip)
    except ValueError:
        return ip
    if d.version == 6 and d.ipv4_mapped:
        return str(d.ipv4_mapped)
    return str(ipaddress.ip_network(f'{d}/64', strict=False)) if d.version == 6 else str(d)


class Limitador:
    """Ventana deslizante de 1 h por cliente. La IP se convierte en una huella con sal aleatoria que cambia
    al reiniciar el servicio y solo vive en memoria: nunca se escribe en disco."""

    def __init__(self, por_hora: int):
        self.por_hora = por_hora
        self._sal = secrets.token_bytes(16)
        self._uso: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()

    def permitir(self, cliente: str, cantidad: int, ahora: float | None = None) -> tuple[bool, int]:
        huella = hmac.new(self._sal, cliente.encode(), hashlib.sha256).hexdigest()[:16]
        ahora = time.monotonic() if ahora is None else ahora
        with self._lock:
            cola = self._uso[huella]
            while cola and ahora - cola[0][0] >= 3600:
                cola.popleft()
            usado = sum(c for _, c in cola)
            if usado + cantidad > self.por_hora:
                return False, self._espera(cola, usado + cantidad - self.por_hora, cantidad, ahora)
            cola.append((ahora, cantidad))
            if len(self._uso) > 10_000:   # limpieza: huellas cuyo último uso ya salió de la ventana
                for k in [k for k, v in self._uso.items() if not v or ahora - v[-1][0] >= 3600]:
                    del self._uso[k]
            return True, 0

    def _espera(self, cola: deque, falta: int, cantidad: int, ahora: float) -> int:
        """Segundos hasta que se libere cupo suficiente para `cantidad`: se recorren los usos del más viejo
        al más nuevo hasta sumar lo que falta (no basta con esperar a que venza el más viejo)."""
        if cantidad > self.por_hora:
            return 3600   # nunca cabe en una hora: el cliente debe enviar menos
        liberado = 0
        for t, c in cola:
            liberado += c
            if liberado >= falta:
                return int(3600 - (ahora - t)) + 1
        return 3600


def coincide_etag(si_no: str | None, etag: str) -> bool:
    """If-None-Match con comparación débil (RFC 9110): acepta W/, listas y «*». Un proxy que debilite el ETag
    ya no obliga a descargar todo otra vez (auditoría P-08)."""
    if not si_no:
        return False
    propio = etag.removeprefix('W/')
    return any(x.strip() == '*' or x.strip().removeprefix('W/') == propio for x in si_no.split(','))


def acepta_gzip(accept_encoding: str) -> bool:
    for parte in accept_encoding.lower().split(','):
        nombre, _, params = parte.partition(';')
        if nombre.strip() in ('gzip', '*'):
            q = params.strip()
            try:
                return not q.startswith('q=') or float(q[2:]) > 0
            except ValueError:
                return False
    return False


class Aporte(BaseModel):
    """Un precio visto en un tiquete propio. `extra='forbid'`: cualquier campo de más (nombre, correo, cédula…)
    hace fallar la petición, así ningún dato personal llega a guardarse por error."""
    model_config = ConfigDict(extra='forbid')
    ean: str = Field(description='Código de barras: EAN-8, UPC-A o EAN-13')
    precio: int = Field(ge=PRECIO_MINIMO, le=PRECIO_MAXIMO, description='Colones por unidad, IVA incluido')
    cadena: str
    canton: str | None = None
    fecha: date | None = Field(default=None, description='Día de la compra; solo se guarda la semana')

    @field_validator('ean')
    @classmethod
    def _ean(cls, v: str) -> str:
        v = v.strip()
        if not ean_valido(v):
            raise ValueError('código de barras inválido (dígito de control)')
        if uso_interno(v):
            raise ValueError('código de uso interno de la tienda (producto pesado): no es comparable')
        return normalizar_ean(v)

    @field_validator('cadena')
    @classmethod
    def _cadena(cls, v: str) -> str:
        c = cadena_canonica(v)
        if not c:
            raise ValueError('cadena desconocida; vea /catalogos')
        return c

    @field_validator('canton')
    @classmethod
    def _canton(cls, v: str | None) -> str | None:
        if v is None or not v.strip():
            return None
        c = canton_canonico(v)
        if not c:
            raise ValueError('cantón desconocido; vea /catalogos')
        return c


class Lote(BaseModel):
    model_config = ConfigDict(extra='forbid')
    aportes: list[Aporte] = Field(min_length=1)

    @model_validator(mode='after')
    def _sin_repetidos(self) -> 'Lote':
        # Un mismo código dos veces en un envío inflaría n: una sola persona cumpliría k >= 3 (auditoría H-02).
        eans = [a.ean for a in self.aportes]
        if len(set(eans)) != len(eans):
            raise ValueError('código repetido en el envío: cada producto va una sola vez')
        return self


class Campo(str, Enum):
    kcal = 'kcal'
    azucares = 'azucares'
    grasas = 'grasas'
    saturadas = 'saturadas'
    trans = 'trans'
    sodio = 'sodio'
    nombre = 'nombre'
    tamano = 'tamano'
    ingredientes = 'ingredientes'
    otro = 'otro'


class Motivo(str, Enum):
    unidad_erronea = 'unidad_erronea'           # p. ej. sodio en mg guardado como g (×1000)
    no_coincide_etiqueta = 'no_coincide_etiqueta'
    producto_equivocado = 'producto_equivocado'
    inconsistente = 'inconsistente'           # p. ej. azúcares mayores que los carbohidratos
    otro = 'otro'


class Reporte(BaseModel):
    """Aviso de un dato dudoso de la base. Sin texto libre: solo opciones cerradas."""
    model_config = ConfigDict(extra='forbid')
    ean: str
    campo: Campo
    motivo: Motivo

    @field_validator('ean')
    @classmethod
    def _ean(cls, v: str) -> str:
        if not ean_valido(v.strip()):
            raise ValueError('código de barras inválido (dígito de control)')
        return normalizar_ean(v.strip())


def crear_app(config: Config | None = None) -> FastAPI:
    config = config or Config.desde_entorno()
    base = Base(config.base_productos)
    almacen = Almacen(config.bd)
    limitador = Limitador(config.limite_por_hora)

    app = FastAPI(
        title='Canasta sana — API opcional', version=VERSION,
        description='Base pública de productos y precios comunitarios anónimos. Nunca recibe tiquetes ni datos personales.',
        # /docs carga scripts de cdn.jsdelivr.net: en producción se apaga con CANASTA_DOCS=0 (auditoría P-07).
        docs_url='/docs' if config.docs else None, redoc_url='/redoc' if config.docs else None,
        openapi_url='/openapi.json' if config.docs else None,
    )
    app.state.config, app.state.base, app.state.almacen = config, base, almacen
    # El registro de acceso de uvicorn guarda la IP de cada petición: se apaga aquí también, por si alguien
    # inicia el servicio sin --no-access-log (auditoría H-06).
    logging.getLogger('uvicorn.access').disabled = True
    # La base (≈ 0,5 MB) y la tabla de precios viajan comprimidas: menos datos móviles en teléfonos prepago.
    app.add_middleware(GZipMiddleware, minimum_size=1024)

    @app.middleware('http')
    async def seguridad(request: Request, call_next):
        if request.method == 'POST':
            # Solo JSON: un sitio ajeno puede mandar un POST «simple» (sin Content-Type o text/plain) sin permiso
            # CORS, desde el navegador de quien lo visite. application/json exige el permiso previo (H-03).
            tipo = request.headers.get('content-type', '').split(';')[0].strip().lower()
            if tipo != 'application/json':
                return JSONResponse({'detail': 'se requiere Content-Type: application/json'}, status_code=415)
            largo = request.headers.get('content-length')
            if largo is None or not largo.isdigit():
                return JSONResponse({'detail': 'falta Content-Length'}, status_code=411)
            if int(largo) > config.max_cuerpo:
                return JSONResponse({'detail': 'petición demasiado grande'}, status_code=413)
        try:
            r = await call_next(request)
        except Exception:
            # P-12: antes salía «Internal Server Error» en texto y sin estas cabeceras. Se registra la plantilla de la
            # ruta («/productos/{ean}»), nunca el código pedido ni la IP.
            registro.exception('error interno en %s %s', request.method, getattr(request.scope.get('route'), 'path', '?'))
            r = JSONResponse({'detail': 'error interno'}, status_code=500)
        r.headers['X-Content-Type-Options'] = 'nosniff'
        r.headers['Referrer-Policy'] = 'no-referrer'
        r.headers.setdefault('Cache-Control', 'no-store')
        return r

    # CORS va por fuera (se agrega al final) para que también los errores 411/413/429 lleven sus cabeceras.
    app.add_middleware(CORSMiddleware, allow_origins=list(config.origenes), allow_methods=['GET', 'POST'],
                       allow_headers=['Content-Type', 'If-None-Match'], expose_headers=['ETag', 'Retry-After'],
                       max_age=3600)

    redes_proxy = [ipaddress.ip_network(p, strict=False) for p in config.proxies]

    def del_proxy(ip: str) -> bool:
        """Sin CANASTA_PROXIES se confía en cualquier conexión (solo si el puerto no está expuesto). Con la lista, solo
        en el proxy: si alguien llega directo al puerto, su X-Forwarded-For se ignora (auditoría P-10)."""
        if not redes_proxy:
            return True
        try:
            return any(ipaddress.ip_address(ip) in red for red in redes_proxy)
        except ValueError:
            return False

    def cliente(request: Request) -> str:
        # Detrás de un proxy propio, la IP real es la que AGREGA el proxy: la última de X-Forwarded-For.
        # La primera la escribe el cliente y se puede inventar (saltaría el límite de uso).
        par = request.client.host if request.client else 'desconocido'
        if config.confiar_proxy and (xff := request.headers.get('x-forwarded-for')) and del_proxy(par):
            return clave_cliente(xff.split(',')[-1].strip())
        return clave_cliente(par)

    def limitar(request: Request, cantidad: int) -> None:
        ok, espera = limitador.permitir(cliente(request), cantidad)
        if not ok:
            raise HTTPException(429, 'demasiados aportes en la última hora', headers={'Retry-After': str(espera)})

    def condicional(request: Request, etag: str, crudo: bytes, gz: bytes, max_age: int) -> Response:
        """Base y tabla ya comprimidas (B-17): el GZipMiddleware no las toca porque llevan Content-Encoding."""
        cabeceras = {'ETag': etag, 'Cache-Control': f'public, max-age={max_age}', 'Vary': 'Accept-Encoding'}
        if coincide_etag(request.headers.get('if-none-match'), etag):
            return Response(status_code=304, headers=cabeceras)
        if acepta_gzip(request.headers.get('accept-encoding', '')):
            return Response(gz, media_type='application/json', headers={**cabeceras, 'Content-Encoding': 'gzip'})
        return Response(crudo, media_type='application/json', headers=cabeceras)

    @app.get('/salud')
    def salud():
        # Sin conteo de aportes en vivo: comparar el conteo antes y después revelaría cuántos productos
        # trae un tiquete y cuándo se envió.
        return {'estado': 'ok', 'version': VERSION, 'productos': len(base.productos), 'base_sha256': base.sha256}

    @app.get('/catalogos')
    def catalogos(response: Response):
        response.headers['Cache-Control'] = 'public, max-age=86400'
        return {'cadenas': CADENAS, 'provincias': PROVINCIAS}

    @app.get('/productos/version')
    def version_base():
        return {'sha256': base.sha256, 'productos': len(base.productos), 'descargado': base.meta.get('descargado'),
                'fuente': base.meta.get('fuente'), 'licencia': base.meta.get('licencia')}

    @app.get('/productos/base')
    def base_completa(request: Request):
        return condicional(request, base.etag, base.crudo, base.gz, 3600)

    @app.get('/productos/buscar')
    def buscar(q: Annotated[str, Query(min_length=2, max_length=80)],
               limite: Annotated[int, Query(ge=1, le=50)] = 20):
        return {'resultados': base.buscar(q, limite)}

    @app.get('/productos/{ean}')
    def producto(ean: str):
        p = base.por_ean.get(normalizar_ean(ean.strip()))
        if not p:
            raise HTTPException(404, 'producto no está en la base')
        return p

    @app.post('/precios', status_code=201)
    def aportar(lote: Lote, request: Request):
        if len(lote.aportes) > config.max_lote:
            raise HTTPException(422, f'máximo {config.max_lote} precios por envío')
        hoy = config.hoy()
        filas = []
        for a in lote.aportes:
            dia = a.fecha or hoy
            if dia > hoy + timedelta(days=1):
                raise HTTPException(422, 'fecha de compra en el futuro')
            if dia < hoy - timedelta(days=config.dias_atras):
                raise HTTPException(422, f'compra de hace más de {config.dias_atras} días')
            # Se guarda la semana de LLEGADA, no la de la compra: una compra de una semana ya cerrada (y publicada)
            # aparecería en la tabla al instante y delataría el envío. Así la tabla cambia solo al cerrar cada
            # semana (D-17, D-27; auditoría H-01). La fecha solo se valida.
            filas.append((a.ean, a.precio, a.cadena, a.canton, semana_iso(hoy)))
        limitar(request, len(filas))
        almacen.guardar_aportes(filas)
        return {'recibidos': len(filas)}

    @app.get('/precios/tabla')
    def tabla_precios(request: Request):
        pub = almacen.tabla(config.hoy(), config.semanas, config.min_reportes)
        return condicional(request, pub.etag, pub.json, pub.gz, 600)

    @app.post('/reportes', status_code=201)
    def reportar(reporte: Reporte, request: Request):
        if reporte.ean not in base.por_ean:   # P-11: los avisos son sobre la base; un código ajeno ensuciaba el resumen
            raise HTTPException(422, 'el producto no está en la base')
        limitar(request, 1)
        almacen.guardar_reporte(reporte.ean, reporte.campo.value, reporte.motivo.value, semana_iso(config.hoy()))
        return {'recibido': True}

    @app.get('/reportes/resumen')
    def resumen_reportes():
        # Como los precios: solo semanas cerradas, para que el resumen no delate un aviso recién enviado (H-04).
        return {'reportes': almacen.resumen_reportes(semana_iso(config.hoy()))}

    return app
