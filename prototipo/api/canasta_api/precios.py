"""Precios comunitarios anónimos: almacenamiento y agregación.

Privacidad por diseño (D-17):
- Cada fila guarda solo: código, precio unitario, cadena, cantón opcional y semana ISO. Sin IP, hora ni dispositivo.
- El identificador es aleatorio: el orden de las filas no revela el orden de llegada.
- Solo se publican semanas ISO ya cerradas: la tabla cambia una vez por semana, así que mirarla antes y después
  de un envío no revela qué productos llegaron juntos ni cuándo.
- Solo se publican grupos con al menos `min_reportes` aportes (k-anonimato) y la mediana resiste valores absurdos.
"""
import gzip
import hashlib
import json
import math
import secrets
import sqlite3
import statistics
import threading
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from typing import NamedTuple

FACTOR_ATIPICO = 3.0   # fuera de [mediana/3, mediana×3] es error de lectura o de producto (SUPUESTO)

ESQUEMA = """
CREATE TABLE IF NOT EXISTS aportes (
    id INTEGER PRIMARY KEY,   -- aleatorio: no revela orden ni enlaza aportes del mismo tiquete
    ean TEXT NOT NULL,
    precio INTEGER NOT NULL,  -- colones por unidad
    cadena TEXT NOT NULL,
    canton TEXT,
    semana TEXT NOT NULL      -- AAAA-Wss (ISO 8601)
);
CREATE INDEX IF NOT EXISTS aportes_semana ON aportes(semana);
CREATE TABLE IF NOT EXISTS reportes (
    id INTEGER PRIMARY KEY,
    ean TEXT NOT NULL,
    campo TEXT NOT NULL,
    motivo TEXT NOT NULL,
    semana TEXT NOT NULL
);
"""

ESQUEMA_VERSION = 1   # PRAGMA user_version; la v0.2.0 creaba este mismo esquema sin versión (0)

COLUMNAS_APORTES = ('id', 'ean', 'precio', 'cadena', 'canton', 'semana')


class Publicacion(NamedTuple):
    """Tabla pública lista para servir: JSON y gzip calculados una sola vez (B-17)."""
    datos: dict
    json: bytes
    gz: bytes
    etag: str


def semana_iso(d: date) -> str:
    anio, semana, _ = d.isocalendar()
    return f'{anio}-W{semana:02d}'


def redondear(x: float) -> int:
    """Mitad hacia arriba (round() de Python redondea 1050,5 a 1050)."""
    return math.floor(x + 0.5)


def resumir(precios: list[int]) -> dict | None:
    if not precios:
        return None
    med = statistics.median(precios)
    validos = sorted(p for p in precios if med / FACTOR_ATIPICO <= p <= med * FACTOR_ATIPICO)
    if not validos:
        return None
    if len(validos) >= 2:
        q1, _, q3 = statistics.quantiles(validos, n=4, method='inclusive')
    else:
        q1 = q3 = validos[0]
    return {
        'mediana': redondear(statistics.median(validos)), 'p25': redondear(q1), 'p75': redondear(q3),
        'n': len(validos), 'descartados': len(precios) - len(validos),
    }


class Almacen:
    def __init__(self, ruta: Path | str):
        ruta = str(ruta)
        if ruta != ':memory:':
            Path(ruta).parent.mkdir(parents=True, exist_ok=True)
        self.con = sqlite3.connect(ruta, check_same_thread=False)
        if ruta != ':memory:':
            self.con.execute('PRAGMA journal_mode=WAL')
        self.con.executescript(ESQUEMA)
        # P-06: base marcada con su versión de esquema, para poder migrarla después. Una más nueva no se abre.
        version = self.con.execute('PRAGMA user_version').fetchone()[0]
        if version > ESQUEMA_VERSION:
            raise RuntimeError(f'la base de datos es de un esquema más nuevo ({version}) que este servicio ({ESQUEMA_VERSION})')
        if version < ESQUEMA_VERSION:
            self.con.execute(f'PRAGMA user_version = {ESQUEMA_VERSION}')
        self.lock = threading.Lock()
        self._lock_tabla = threading.Lock()   # un solo cálculo a la vez; los demás esperan y usan el resultado
        self._cache: tuple[tuple, Publicacion] | None = None
        self.calculos = 0                     # cuántas veces se calculó la tabla (lo miden las pruebas)

    def cerrar(self) -> None:
        self.con.close()

    def respaldar(self, destino: Path | str) -> None:
        """Copia consistente con el servicio en marcha. Copiar el archivo en modo WAL puede dejarla a medias (P-06)."""
        copia = sqlite3.connect(str(destino))
        try:
            with self.lock:
                self.con.backup(copia)
        finally:
            copia.close()

    def _insertar(self, tabla: str, filas: list[tuple]) -> None:
        marcas = ','.join('?' * (len(filas[0]) + 1))
        with self.lock, self.con:
            for f in filas:
                for intento in range(5):
                    try:
                        self.con.execute(f'INSERT INTO {tabla} VALUES ({marcas})', (secrets.randbits(62), *f))
                        break
                    except sqlite3.IntegrityError as e:
                        # Solo se reintenta un choque de id aleatorio (casi imposible); otro error sube.
                        if 'UNIQUE' not in str(e) or intento == 4:
                            raise

    def guardar_aportes(self, filas: list[tuple[str, int, str, str | None, str]]) -> None:
        self._insertar('aportes', filas)

    def guardar_reporte(self, ean: str, campo: str, motivo: str, semana: str) -> None:
        self._insertar('reportes', [(ean, campo, motivo, semana)])

    def contar(self, tabla: str) -> int:
        with self.lock:
            return self.con.execute(f'SELECT COUNT(*) FROM {tabla}').fetchone()[0]

    def columnas(self, tabla: str) -> list[str]:
        with self.lock:
            return [r[1] for r in self.con.execute(f'PRAGMA table_info({tabla})')]

    def tabla(self, hoy: date, semanas: int, min_reportes: int) -> Publicacion:
        """Tabla pública de precios: por código a tres niveles (país, cadena, cadena + cantón).

        Se calcula una vez por semana (B-17): el servicio guarda cada aporte en la semana en curso (D-28), que no se
        publica, así que un envío nuevo no cambia la tabla hasta que la semana cierra. Antes, cada envío borraba la
        caché y la tabla se recalculaba (2,5 s con 200 000 aportes)."""
        hasta = semana_iso(hoy)   # la semana en curso NO se publica (aún está abierta)
        llave = (hasta, semanas, min_reportes)
        cache = self._cache   # una sola lectura: otro hilo puede reemplazarla mientras tanto
        if cache and cache[0] == llave:
            return cache[1]
        with self._lock_tabla:
            cache = self._cache
            if cache and cache[0] == llave:   # otro hilo la calculó mientras se esperaba
                return cache[1]
            pub = self._calcular(hoy, semanas, min_reportes)
            self._cache = (llave, pub)
            return pub

    def _calcular(self, hoy: date, semanas: int, min_reportes: int) -> Publicacion:
        self.calculos += 1
        desde = semana_iso(hoy - timedelta(weeks=semanas))
        hasta = semana_iso(hoy)
        with self.lock:
            filas = self.con.execute(
                'SELECT ean, cadena, canton, precio, semana FROM aportes WHERE semana >= ? AND semana < ?',
                (desde, hasta)).fetchall()
        grupos: dict[tuple, list[tuple[int, str]]] = defaultdict(list)
        for ean, cadena, canton, precio, semana in filas:
            grupos[(ean, None, None)].append((precio, semana))
            grupos[(ean, cadena, None)].append((precio, semana))
            if canton:
                grupos[(ean, cadena, canton)].append((precio, semana))
        precios = []
        for (ean, cadena, canton), lista in grupos.items():
            r = resumir([p for p, _ in lista])
            if r and r['n'] >= min_reportes:
                semanas_vistas = [s for _, s in lista]
                precios.append({'ean': ean, 'cadena': cadena, 'canton': canton, **r,
                                'desde': min(semanas_vistas), 'hasta': max(semanas_vistas)})
        precios.sort(key=lambda x: (x['ean'], x['cadena'] or '', x['canton'] or ''))
        datos = {'desde': desde, 'hasta_antes_de': hasta, 'semanas': semanas, 'min_reportes': min_reportes,
                 'precios': precios}
        # Mismo formato que JSONResponse de Starlette. ETag débil: el mismo contenido se sirve con y sin gzip.
        crudo = json.dumps(datos, ensure_ascii=False, allow_nan=False, separators=(',', ':')).encode()
        etag = 'W/"' + hashlib.sha256(crudo).hexdigest()[:32] + '"'
        return Publicacion(datos, crudo, gzip.compress(crudo, compresslevel=9, mtime=0), etag)

    def resumen_reportes(self, hasta: str) -> list[dict]:
        """Avisos de semanas ya cerradas (anteriores a `hasta`, la semana en curso)."""
        with self.lock:
            filas = self.con.execute(
                'SELECT ean, campo, motivo, COUNT(*) FROM reportes WHERE semana < ? GROUP BY ean, campo, motivo '
                'ORDER BY COUNT(*) DESC, ean', (hasta,)).fetchall()
        return [{'ean': e, 'campo': c, 'motivo': m, 'n': n} for e, c, m, n in filas]
