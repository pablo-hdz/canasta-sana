import json
import sys
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from canasta_api.config import Config  # noqa: E402
from canasta_api.main import crear_app  # noqa: E402

HOY = date(2026, 11, 14)

# Códigos de ejemplo con dígito de control válido (ejemplos públicos de GS1/Wikipedia y uno real de la base).
LIZANO = '7411000345023'
EAN13 = '4006381333931'
UPC_A = '036000291452'
EAN8 = '96385074'

BASE = {
    'meta': {'fuente': 'prueba', 'licencia': 'ODbL', 'descargado': '2026-11-14T00:00:00+00:00', 'productos': 4},
    'productos': [
        {'ean': LIZANO, 'nombre': 'Salsa Condimentada Lizano', 'marca': 'Lizano', 'cantidad': '700 ml',
         'cantidadNum': 700, 'unidad': 'ml', 'n': {'sodioMg': 250}},
        {'ean': EAN13, 'nombre': 'Leche semidescremada', 'marca': 'Dos Pinos', 'cantidad': '1 L',
         'cantidadNum': 1000, 'unidad': 'ml', 'n': {}},
        {'ean': '0' + UPC_A, 'nombre': 'Café molido', 'marca': '1820', 'cantidad': '250 g',
         'cantidadNum': 250, 'unidad': 'g', 'n': {}},
        {'ean': EAN8, 'nombre': 'Galleta María', 'marca': 'Pozuelo', 'cantidad': '200 g',
         'cantidadNum': 200, 'unidad': 'g', 'n': {}},
    ],
}


def con_control(cuerpo: str) -> str:
    """Agrega el dígito de control GS1 (solo para fabricar casos de prueba)."""
    s = sum(int(d) * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return cuerpo + str((10 - s % 10) % 10)


# Códigos válidos y distintos: un envío no puede repetir un código (H-02).
EANS = [con_control(f'741100009{i:03d}') for i in range(100)]


class Reloj:
    """Fecha del servicio que las pruebas pueden adelantar (la tabla solo publica semanas cerradas)."""
    def __init__(self, hoy: date):
        self.hoy = hoy

    def __call__(self) -> date:
        return self.hoy

    def avanzar(self, dias: int = 7) -> None:
        self.hoy += timedelta(days=dias)


@pytest.fixture
def reloj() -> Reloj:
    return Reloj(HOY)


@pytest.fixture
def config(tmp_path, reloj) -> Config:
    ruta = tmp_path / 'base.json'
    ruta.write_text(json.dumps(BASE, ensure_ascii=False), encoding='utf-8')
    return Config(base_productos=ruta, bd=str(tmp_path / 'precios.sqlite3'), hoy=reloj, limite_por_hora=500)


@pytest.fixture
def cliente(config) -> TestClient:
    app = crear_app(config)
    with TestClient(app) as c:
        yield c
    app.state.almacen.cerrar()


# Por defecto, una compra de la semana pasada (W45): la tabla solo publica semanas cerradas.
def aporte(ean=LIZANO, precio=1500, cadena='Palí', canton='Cartago', fecha='2026-11-05', **extra) -> dict:
    a = {'ean': ean, 'precio': precio, 'cadena': cadena, 'canton': canton, 'fecha': fecha}
    a.update(extra)
    return a
