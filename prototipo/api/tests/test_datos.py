"""Base de productos (datos/descargar_off.py): tamaño del envase (B-04) y nombres en otro idioma (B-08), sin red."""
import importlib.util
import json
from pathlib import Path

import pytest

PROTOTIPO = Path(__file__).resolve().parents[2]
_spec = importlib.util.spec_from_file_location('descargar_off', PROTOTIPO / 'datos' / 'descargar_off.py')
d = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(d)


@pytest.mark.parametrize('texto, esperado', [
    ('281ML', (281.0, 'ml')),
    ('28,5G', (28.5, 'g')),
    ('1 l', (1000.0, 'ml')),
    ('Lactocrema taza 210g DP', (210.0, 'g')),               # nombres reales de la base
    ('Mayonesa 14 Oz', (396.9, 'g')),                        # 14 × 28,3495
    ('Yogurt yoplait banano fresa 1L', (1000.0, 'ml')),
    ('Yogurt líquido griego plus fresa  banano 200 ml', (200.0, 'ml')),
    ('6 x 355 ml', (2130.0, 'ml')),
    ('1,5 kg', (1500.0, 'g')),
    ('1,000 g', (1000.0, 'g')),                              # separador de miles
    ('0,355 l', (355.0, 'ml')),
    ('12 fl oz', (354.9, 'ml')),
    ('Leche 2%', None),
    ('100 galletas', None),                                  # «g» seguida de letras no es gramos
    ('1 lata', None),
    ('Saco 60 kg', None),                                    # más de 50 kg: error
])
def test_tamano_desde_texto(texto, esperado):
    assert d.tamano(texto) == esperado


def test_tamano_del_campo_quantity_debe_abrir_el_texto():
    # Formas reales de la caché: «# g / # oz», «# g (# oz)», «# galletas (#g)».
    assert d.tamano('500 g / 17.6 oz', al_inicio=True) == (500.0, 'g')
    assert d.tamano('12 galletas (30g)', al_inicio=True) is None   # 30 g es cada galleta, no el envase
    assert d.tamano_de({'product_quantity': 1, 'product_quantity_unit': 'L'}) == (1000.0, 'ml')
    assert d.tamano_de({'product_quantity': 18, 'product_quantity_unit': None, 'quantity': '18'}) is None
    assert d.tamano_de({'quantity': '355ml'}) == (355.0, 'ml')


def test_otro_idioma():
    for nombre in ('Cheddar Cheese', 'Swiss Sliced Cheese', 'Beurre', 'Chocolat Noir 77% Ghana', 'Peanut Butter'):
        assert d.parece_otro_idioma(nombre), nombre
    for nombre in ('Avena integral', 'Pollo agridulce a la naranja', 'Pringles Queso Cheddar', 'Spaghetti', 'Leche Dos Pinos'):
        assert not d.parece_otro_idioma(nombre), nombre


def test_completar_sin_red(tmp_path):
    cache = tmp_path / 'cache'
    cache.mkdir()
    (cache / 'pagina_001_100.json').write_text(json.dumps({'products': [
        {'code': '1', 'quantity': '500 g / 17.6 oz'},
        {'code': '3', 'product_name_es': 'Avena interal'},                 # peor que el nombre en español actual
        {'code': '4', 'product_name_es': 'Pringles Queso Cheddar'},
    ]}), encoding='utf-8')
    (cache / 'busqueda_001.json').write_text(json.dumps({'hits': [{'code': '2', 'product_quantity': 1, 'product_quantity_unit': 'kg'}]}),
                                             encoding='utf-8')
    vacio = {'marca': '', 'cantidad': '', 'cantidadNum': None, 'unidad': None, 'n': {}}
    base = {'meta': {'productos': 5}, 'productos': [
        {**vacio, 'ean': '1', 'nombre': 'Galletas'},
        {**vacio, 'ean': '2', 'nombre': 'Arroz'},
        {**vacio, 'ean': '3', 'nombre': 'Avena integral'},
        {**vacio, 'ean': '4', 'nombre': 'Cheddar Cheese'},
        {**vacio, 'ean': '5', 'nombre': 'Yogurt deligurt fresa DP 125G', 'cantidad': '', 'cantidadNum': None},
        {**vacio, 'ean': '6', 'nombre': 'Leche', 'cantidad': '1 L', 'cantidadNum': 1000, 'unidad': 'ml'},
    ]}
    ruta = tmp_path / 'productos_cr.json'
    ruta.write_text(json.dumps(base), encoding='utf-8')
    claves = {p['ean']: set(p) for p in base['productos']}

    c = d.completar(ruta, cache)
    nueva = json.loads(ruta.read_text(encoding='utf-8'))
    por = {p['ean']: p for p in nueva['productos']}
    assert (por['1']['cantidadNum'], por['1']['unidad'], por['1']['cantidad']) == (500.0, 'g', '500 g')   # de quantity
    assert (por['2']['cantidadNum'], por['2']['unidad']) == (1000.0, 'g')                                 # de product_quantity
    assert (por['5']['cantidadNum'], por['5']['unidad']) == (125.0, 'g')                                  # del nombre
    assert (por['6']['cantidadNum'], por['6']['cantidad']) == (1000, '1 L')                               # no se toca
    assert por['3']['nombre'] == 'Avena integral'          # ya estaba en español: no se cambia
    assert por['4']['nombre'] == 'Pringles Queso Cheddar'  # estaba en inglés y hay nombre en español
    assert {p['ean']: set(p) for p in nueva['productos']} == claves   # mismo formato que lee la app
    assert c == {'productos': 6, 'con_tamano_antes': 1, 'desde_cache': 2, 'desde_nombre': 1, 'con_tamano_despues': 4,
                 'nombre_es': 1}
    assert 'B-04' in nueva['meta']['completado']
    assert not list(tmp_path.glob('*.tmp'))   # escritura atómica: no queda el archivo temporal


def test_base_real_completada():
    base = json.loads((PROTOTIPO / 'web/public/datos/productos_cr.json').read_text(encoding='utf-8'))
    productos = base['productos']
    con_tamano = sum(bool(p.get('cantidadNum') and p.get('unidad')) for p in productos)
    assert con_tamano / len(productos) > 0.35, con_tamano          # antes del 2026-11-15: 140 (11,3 %)
    assert all(p['unidad'] in ('g', 'ml') and 0 < p['cantidadNum'] <= d.TAMANO_MAXIMO
               for p in productos if p.get('unidad'))
    assert len(productos) == base['meta']['productos']


# ---------------------------------------------------------------- sprint 2: P-14 (descarga de Open Food Facts)


def test_numero_rechaza_infinito():
    assert d.numero('inf') is None and d.numero(float('nan')) is None and d.numero('-1') is None
    assert d.numero('2.5') == 2.5


def test_repetidos_por_codigo_normalizado(tmp_path, monkeypatch):
    # El UPC-A de 12 dígitos y su EAN-13 con un 0 delante son el mismo producto (4 casos en la base, Saint Hubert).
    monkeypatch.setattr(d, 'CACHE', tmp_path)
    registro = {'product_name': 'Margarine', 'nutriments': {'energy-kcal_100g': 468}}
    (tmp_path / 'pagina_001_100.json').write_text(json.dumps({'count': 2, 'products': [
        {**registro, 'code': '744674467446'}, {**registro, 'code': '0744674467446'}]}), encoding='utf-8')
    salida = tmp_path / 'base.json'
    monkeypatch.setattr('sys.argv', ['descargar_off.py', '--solo-cache', '--salida', str(salida)])
    assert d.main() == 0
    assert len(json.loads(salida.read_text(encoding='utf-8'))['productos']) == 1


def test_reintentos_sin_espera_cero_y_cache_atomica(tmp_path, monkeypatch, capsys):
    import io
    import urllib.error
    monkeypatch.setattr(d, 'CACHE', tmp_path)
    monkeypatch.setattr(d.time, 'sleep', lambda s: None)
    respuestas = iter([urllib.error.HTTPError('u', 401, 'x', {}, None)] * 6)

    def falla(*_, **__):
        raise next(respuestas)
    monkeypatch.setattr(d.urllib.request, 'urlopen', falla)
    with pytest.raises(RuntimeError, match='reanudar'):
        d.pedir(11, 100)
    err = capsys.readouterr().err
    assert err.count('HTTP 401') == 6 and 'espero 0 s' not in err
    assert not list(tmp_path.glob('*.json')) and not list(tmp_path.glob('*.tmp'))   # nada a medias en la caché

    class Respuesta(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False
    monkeypatch.setattr(d.urllib.request, 'urlopen', lambda *a, **k: Respuesta(b'{"count": 1, "products": []}'))
    assert d.pedir(11, 100) == {'count': 1, 'products': []}
    assert json.loads((tmp_path / 'pagina_011_100.json').read_text(encoding='utf-8'))['count'] == 1
    assert not list(tmp_path.glob('*.tmp'))


# ---------------------------------------------------------------- sprint 3: B-26 (reintentos en la búsqueda)


def test_busqueda_reintenta_con_espera_creciente_sin_red(tmp_path, monkeypatch, capsys):
    # B-26: pedir_busqueda (fuente alterna) fallaba al primer 503 sin reintentar. Red simulada: nada sale a internet.
    import io
    import urllib.error

    class Respuesta(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(d, 'CACHE', tmp_path)
    esperas = []
    monkeypatch.setattr(d.time, 'sleep', esperas.append)
    respuestas = iter([urllib.error.HTTPError('u', 503, 'x', {}, None), urllib.error.URLError('sin conexión'),
                       Respuesta(b'{"hits": [], "page_count": 1}')])

    def red_simulada(*_, **__):
        r = next(respuestas)
        if isinstance(r, Exception):
            raise r
        return r
    monkeypatch.setattr(d.urllib.request, 'urlopen', red_simulada)
    assert d.pedir_busqueda(3) == {'hits': [], 'page_count': 1}
    assert esperas == [60, 120]                                       # espera creciente
    assert json.loads((tmp_path / 'busqueda_003.json').read_text(encoding='utf-8'))['page_count'] == 1
    err = capsys.readouterr().err
    assert 'página 3 de la búsqueda, intento 1 de 6: HTTP 503; espero 60 s' in err
    assert 'intento 2 de 6' in err and 'espero 120 s' in err

    # Siempre falla: 6 intentos (acotado), 5 esperas y un mensaje claro para reanudar.
    esperas.clear()
    monkeypatch.setattr(d.urllib.request, 'urlopen', lambda *a, **k: (_ for _ in ()).throw(urllib.error.URLError('sin red')))
    with pytest.raises(RuntimeError, match=r'página 4 de la búsqueda después de 6 intentos; vuelva a ejecutar'):
        d.pedir_busqueda(4)
    assert esperas == d.ESPERAS == [60, 120, 240, 480, 600]
    assert not (tmp_path / 'busqueda_004.json').exists()
