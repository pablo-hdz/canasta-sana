import json
import sqlite3
from datetime import date

import pytest
from fastapi.testclient import TestClient

from canasta_api.config import Config
from canasta_api.geografia import CANTONES, PROVINCIAS, cadena_canonica, canton_canonico
from canasta_api.main import Limitador, crear_app
from canasta_api.precios import resumir, semana_iso
from canasta_api.productos import ean_valido, normalizar_ean, uso_interno

from conftest import EAN8, EAN13, EANS, LIZANO, UPC_A, aporte, con_control

# ---------------------------------------------------------------- piezas sueltas


def test_digito_de_control():
    for valido in (LIZANO, EAN13, UPC_A, EAN8):
        assert ean_valido(valido)
    assert not ean_valido('4006381333932')       # último dígito cambiado
    assert not ean_valido('74410741808')         # 11 dígitos: no es un formato GS1
    assert not ean_valido('40063813339a1')
    assert normalizar_ean(UPC_A) == '0' + UPC_A


def test_codigos_de_uso_interno():
    assert uso_interno(con_control('200000011752'))    # EAN-13 prefijo 2: pesado en tienda
    assert uso_interno(con_control('20123456789'))     # UPC-A sistema 2 → 02…
    assert uso_interno(con_control('2123456'))         # EAN-8 prefijo 2
    assert uso_interno(con_control('41234567890'))     # UPC-A sistema 4 → 04…: uso interno de la tienda
    assert uso_interno(con_control('050000000001'))    # 05…: cupones
    assert not uso_interno(LIZANO) and not uso_interno(EAN8)


def test_catalogos_84_cantones_sin_ambiguedad():
    assert len(PROVINCIAS) == 7
    assert len(CANTONES) == 84
    assert canton_canonico('san jose') == 'San José'
    assert canton_canonico('PEREZ ZELEDON') == 'Pérez Zeledón'
    assert cadena_canonica('MAS X MENOS') == 'Más x Menos'
    assert cadena_canonica('automercado') == 'Auto Mercado'
    assert canton_canonico('Gotham') is None


def test_semana_iso_en_cambio_de_anio():
    assert semana_iso(date(2026, 11, 14)) == '2026-W46'
    assert semana_iso(date(2027, 1, 1)) == '2026-W53'   # 1 de enero de 2027 cae en la semana 53 de 2026
    assert semana_iso(date(2024, 12, 30)) == '2025-W01'


def test_resumen_robusto_descarta_atipicos():
    r = resumir([1000, 1050, 1100, 9000])   # 9000: error de lectura (sobra un 0)
    assert r == {'mediana': 1050, 'p25': 1025, 'p75': 1075, 'n': 3, 'descartados': 1}
    assert resumir([1001, 1002])['mediana'] == 1002   # 1001,5 → mitad hacia arriba
    assert resumir([]) is None


def test_limitador_ventana_deslizante():
    lim = Limitador(por_hora=5)
    assert lim.permitir('1.2.3.4', 3, ahora=0)[0]
    ok, espera = lim.permitir('1.2.3.4', 3, ahora=10)
    assert not ok and 3580 <= espera <= 3591
    assert lim.permitir('5.6.7.8', 5, ahora=10)[0]       # otro cliente no comparte el cupo
    assert lim.permitir('1.2.3.4', 3, ahora=3600)[0]     # pasó la hora
    assert '1.2.3.4' not in repr(lim._uso)               # en memoria solo hay huellas, no la IP


def test_limitador_espera_hasta_que_quepa():
    # 1 fila a los 0 s y 119 a los 10 s; a los 20 s se piden 60: hay que esperar a que venza la de los 10 s,
    # no solo la de los 0 s (la versión anterior respondía 3581 s y el reintento volvía a fallar).
    lim = Limitador(por_hora=120)
    assert lim.permitir('c', 1, ahora=0)[0] and lim.permitir('c', 119, ahora=10)[0]
    ok, espera = lim.permitir('c', 60, ahora=20)
    assert not ok and espera == 3591
    assert lim.permitir('c', 60, ahora=20 + espera)[0]
    assert lim.permitir('d', 121, ahora=0) == (False, 3600)   # nunca cabe: debe enviar menos


def test_limitador_olvida_clientes_viejos():
    lim = Limitador(por_hora=5)
    for i in range(10_001):
        lim.permitir(f'cliente-{i}', 1, ahora=0)
    lim.permitir('nuevo', 1, ahora=7200)
    assert len(lim._uso) <= 2   # las huellas de hace 2 h se borraron

# ---------------------------------------------------------------- servicio


def test_salud(cliente):
    r = cliente.get('/salud')
    assert r.status_code == 200
    assert r.json() | {'base_sha256': 'x'} == {'estado': 'ok', 'version': '0.2.2', 'productos': 4, 'base_sha256': 'x'}
    # Sin conteo de aportes en vivo: compararlo antes y después de un envío revelaría el tamaño de un tiquete.
    assert 'aportes' not in r.json()


def test_cabeceras_de_seguridad(cliente):
    r = cliente.get('/salud')
    assert r.headers['x-content-type-options'] == 'nosniff'
    assert r.headers['referrer-policy'] == 'no-referrer'
    assert r.headers['cache-control'] == 'no-store'


def test_cors_solo_para_la_app(cliente):
    pre = {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}
    ok = cliente.options('/precios', headers={'Origin': 'http://localhost:5173', **pre})
    assert ok.headers.get('access-control-allow-origin') == 'http://localhost:5173'
    otro = cliente.options('/precios', headers={'Origin': 'https://sitio-ajeno.example', **pre})
    assert 'access-control-allow-origin' not in otro.headers


def test_catalogos(cliente):
    r = cliente.get('/catalogos').json()
    assert 'Palí' in r['cadenas'] and sum(len(v) for v in r['provincias'].values()) == 84

# ---------------------------------------------------------------- base de productos


def test_version_y_descarga_condicional(cliente):
    v = cliente.get('/productos/version').json()
    assert v['productos'] == 4 and len(v['sha256']) == 64
    r = cliente.get('/productos/base')
    assert r.status_code == 200 and r.json()['meta']['productos'] == 4
    assert cliente.get('/productos/base', headers={'If-None-Match': r.headers['etag']}).status_code == 304


def test_buscar_sin_tildes_y_por_prefijo(cliente):
    nombres = lambda q: [p['nombre'] for p in cliente.get('/productos/buscar', params={'q': q}).json()['resultados']]
    assert nombres('salsa lizáno') == ['Salsa Condimentada Lizano']
    assert nombres('LECH SEMID') == ['Leche semidescremada']
    assert nombres('cafe') == ['Café molido']
    assert nombres('dos pinos') == ['Leche semidescremada']   # también busca en la marca
    assert nombres('zzz') == []
    assert nombres(UPC_A) == ['Café molido']                  # código UPC-A encuentra el EAN-13


def test_buscar_valida_parametros(cliente):
    assert cliente.get('/productos/buscar', params={'q': 'a'}).status_code == 422
    assert cliente.get('/productos/buscar', params={'q': 'leche', 'limite': 500}).status_code == 422


def test_producto_por_codigo(cliente):
    assert cliente.get(f'/productos/{LIZANO}').json()['n']['sodioMg'] == 250
    assert cliente.get(f'/productos/{UPC_A}').json()['nombre'] == 'Café molido'
    assert cliente.get('/productos/4006381333948').status_code == 404

# ---------------------------------------------------------------- aportes de precios


def test_aporte_valido_guarda_solo_lo_necesario(cliente, config):
    r = cliente.post('/precios', json={'aportes': [aporte(), aporte(ean=UPC_A, precio=2950, canton=None)]})
    assert r.status_code == 201 and r.json() == {'recibidos': 2}
    con = sqlite3.connect(config.bd)
    columnas = [c[1] for c in con.execute('PRAGMA table_info(aportes)')]
    assert columnas == ['id', 'ean', 'precio', 'cadena', 'canton', 'semana']   # sin IP, hora ni dispositivo
    filas = sorted(con.execute('SELECT ean, precio, cadena, canton, semana FROM aportes').fetchall())
    # Semana de llegada (W46), no la de la compra (W45): ver test_aporte_de_semana_cerrada_no_se_publica_al_instante.
    assert filas == [('0' + UPC_A, 2950, 'Palí', None, '2026-W46'), (LIZANO, 1500, 'Palí', 'Cartago', '2026-W46')]
    con.close()


def test_aporte_normaliza_cadena_y_canton(cliente, config):
    assert cliente.post('/precios', json={'aportes': [aporte(cadena='MAXI PALI', canton='perez zeledon')]}).status_code == 201
    con = sqlite3.connect(config.bd)
    assert con.execute('SELECT cadena, canton FROM aportes').fetchone() == ('Maxi Palí', 'Pérez Zeledón')
    con.close()


@pytest.mark.parametrize('cambio', [
    {'correo': 'alguien@example.com'},   # campo de más: ningún dato personal entra
    {'cedula': '1-1111-1111'},
    {'precio': 10},                       # menos de ₡50: ruido de OCR
    {'precio': 1_000_000},
    {'ean': '4006381333932'},             # dígito de control malo
    {'ean': con_control('200000011752')},  # producto pesado en tienda
    {'cadena': 'Tienda inventada'},
    {'canton': 'Gotham'},
    {'fecha': '2026-11-20'},              # futuro
    {'fecha': '2026-07-01'},              # más de 90 días
])
def test_aporte_rechazado(cliente, config, cambio):
    r = cliente.post('/precios', json={'aportes': [aporte(**cambio)]})
    assert r.status_code == 422, r.text
    con = sqlite3.connect(config.bd)
    assert con.execute('SELECT COUNT(*) FROM aportes').fetchone()[0] == 0   # nada se guarda a medias
    con.close()


def contar(config) -> int:
    con = sqlite3.connect(config.bd)
    n = con.execute('SELECT COUNT(*) FROM aportes').fetchone()[0]
    con.close()
    return n


def test_lote_invalido_no_guarda_nada(cliente, config):
    r = cliente.post('/precios', json={'aportes': [aporte(), aporte(precio=5)]})
    assert r.status_code == 422
    assert contar(config) == 0


def test_lote_maximo(cliente):
    assert cliente.post('/precios', json={'aportes': [aporte()] * 61}).status_code == 422
    assert cliente.post('/precios', json={'aportes': []}).status_code == 422


def test_cuerpo_demasiado_grande(cliente):
    cuerpo = json.dumps({'aportes': [aporte()], 'relleno': 'x' * 70_000})
    r = cliente.post('/precios', content=cuerpo, headers={'Content-Type': 'application/json'})
    assert r.status_code == 413


def test_ids_aleatorios(cliente, config):
    # Ids aleatorios: el orden de las filas no revela el orden de llegada. (Lo que de verdad evita enlazar un
    # tiquete es no guardar hora ni lote y publicar solo semanas cerradas: ver test_tabla_semana_en_curso.)
    cliente.post('/precios', json={'aportes': [aporte(ean=EANS[i], precio=1000 + i) for i in range(20)]})
    con = sqlite3.connect(config.bd)
    ids = sorted(r[0] for r in con.execute('SELECT id FROM aportes'))
    con.close()
    assert len(ids) == 20 and max(ids) - min(ids) > 10 ** 6
    assert not any(b - a == 1 for a, b in zip(ids, ids[1:]))   # no son consecutivos


def test_limite_por_hora(tmp_path, config):
    from dataclasses import replace
    app = crear_app(replace(config, limite_por_hora=5))
    with TestClient(app) as c:
        tres = {'aportes': [aporte(ean=e) for e in EANS[:3]]}
        assert c.post('/precios', json=tres).status_code == 201
        r = c.post('/precios', json=tres)
        assert r.status_code == 429 and int(r.headers['retry-after']) > 0
        assert c.post('/precios', json={'aportes': [aporte(ean=e) for e in EANS[:2]]}).status_code == 201   # aún cabe
    app.state.almacen.cerrar()

def test_x_forwarded_for_no_se_puede_inventar(config):
    # Detrás de un proxy propio cuenta la IP que agrega el proxy (la última), no la que escribe el cliente.
    from dataclasses import replace
    app = crear_app(replace(config, limite_por_hora=5, confiar_proxy=True))
    with TestClient(app) as c:
        tres = {'aportes': [aporte(ean=e) for e in EANS[:3]]}
        assert c.post('/precios', json=tres,
                      headers={'X-Forwarded-For': 'inventada-1, 203.0.113.7'}).status_code == 201
        assert c.post('/precios', json=tres,
                      headers={'X-Forwarded-For': 'inventada-2, 203.0.113.7'}).status_code == 429
    app.state.almacen.cerrar()

# ---------------------------------------------------------------- tabla pública de precios


def enviar(cliente, *aportes) -> None:
    """Un envío por aporte, como personas distintas (un mismo envío no puede repetir un código)."""
    for a in aportes:
        assert cliente.post('/precios', json={'aportes': [a]}).status_code == 201


def test_tabla_semana_en_curso(cliente, reloj):
    # La semana en curso (W46) no se publica: la tabla cambia una vez por semana y no delata envíos sueltos.
    enviar(cliente, *[aporte(precio=p, fecha='2026-11-10') for p in (1500, 1510, 1490)])
    t = cliente.get('/precios/tabla').json()
    assert t['precios'] == [] and t['hasta_antes_de'] == '2026-W46'
    reloj.avanzar()   # cierra W46
    assert len(cliente.get('/precios/tabla').json()['precios']) == 3


def test_aporte_de_semana_cerrada_no_se_publica_al_instante(cliente, reloj):
    # H-01: antes, una compra de la semana pasada (W45, ya cerrada) aparecía en la tabla en el mismo momento del
    # envío; comparar la tabla antes y después revelaba los productos, la cadena y el cantón de ese tiquete.
    enviar(cliente, *[aporte(precio=p, fecha='2026-11-05') for p in (1500, 1510, 1490)])
    assert cliente.get('/precios/tabla').json()['precios'] == []
    reloj.avanzar()
    assert {p['n'] for p in cliente.get('/precios/tabla').json()['precios']} == {3}


def test_tabla_k_anonimato(cliente, reloj):
    enviar(cliente, aporte(precio=1500), aporte(precio=1520))
    reloj.avanzar()
    assert cliente.get('/precios/tabla').json()['precios'] == []          # 2 aportes: no se publica
    enviar(cliente, aporte(precio=1480, fecha='2026-11-20'))
    reloj.avanzar()
    precios = cliente.get('/precios/tabla').json()['precios']
    niveles = {(p['cadena'], p['canton']): (p['mediana'], p['n']) for p in precios}
    assert niveles == {(None, None): (1500, 3), ('Palí', None): (1500, 3), ('Palí', 'Cartago'): (1500, 3)}


def test_tabla_por_cadena_y_canton(cliente, reloj):
    enviar(cliente,
           aporte(precio=1500, canton='Cartago'), aporte(precio=1510, canton='Cartago'), aporte(precio=1490, canton=None),
           aporte(precio=1700, cadena='Auto Mercado', canton='Escazú'),
           aporte(precio=1720, cadena='Auto Mercado', canton='Escazú'),
           aporte(precio=1690, cadena='Auto Mercado', canton='Escazú'))
    reloj.avanzar()
    precios = cliente.get('/precios/tabla').json()['precios']
    niveles = {(p['cadena'], p['canton']): p['mediana'] for p in precios}
    # Cartago tiene solo 2 aportes con cantón: se publica Palí nacional (3) pero no Palí-Cartago.
    assert niveles == {(None, None): 1600, ('Auto Mercado', None): 1700, ('Auto Mercado', 'Escazú'): 1700,
                       ('Palí', None): 1500}


def test_tabla_excluye_semanas_viejas(cliente, config, reloj):
    # 16 de agosto: justo 90 días (se acepta). Se publica al cerrar W46 y sale de la ventana de 12 semanas después.
    enviar(cliente, *[aporte(precio=p, fecha='2026-08-16') for p in (900, 910, 905)])
    assert contar(config) == 3
    reloj.avanzar()
    assert len(cliente.get('/precios/tabla').json()['precios']) == 3
    reloj.avanzar(7 * 12)
    assert cliente.get('/precios/tabla').json()['precios'] == []


def test_tabla_etag_y_cache(cliente, reloj):
    enviar(cliente, *[aporte(precio=p) for p in (1500, 1510, 1490)])
    reloj.avanzar()
    r = cliente.get('/precios/tabla')
    assert r.headers['cache-control'] == 'public, max-age=600'
    assert cliente.get('/precios/tabla', headers={'If-None-Match': r.headers['etag']}).status_code == 304
    enviar(cliente, aporte(precio=1700, fecha='2026-11-20'))
    # Un envío nuevo no cambia la tabla de esta semana (H-01): sigue 304 hasta que la semana cierre.
    assert cliente.get('/precios/tabla', headers={'If-None-Match': r.headers['etag']}).status_code == 304
    reloj.avanzar()
    assert cliente.get('/precios/tabla', headers={'If-None-Match': r.headers['etag']}).status_code == 200

# ---------------------------------------------------------------- reportes de datos dudosos


def test_reportes(cliente, reloj):
    assert cliente.post('/reportes', json={'ean': LIZANO, 'campo': 'sodio', 'motivo': 'unidad_erronea'}).status_code == 201
    assert cliente.post('/reportes', json={'ean': LIZANO, 'campo': 'sodio', 'motivo': 'unidad_erronea'}).status_code == 201
    assert cliente.post('/reportes', json={'ean': LIZANO, 'campo': 'sodio', 'motivo': 'me cae mal'}).status_code == 422
    assert cliente.post('/reportes', json={'ean': LIZANO, 'campo': 'sodio', 'motivo': 'otro',
                                           'comentario': 'texto libre'}).status_code == 422
    assert cliente.post('/reportes', json={'ean': EAN13, 'campo': 'trans', 'motivo': 'inconsistente'}).status_code == 201
    # H-04: la semana en curso no se cuenta (un aviso recién enviado no se ve en el resumen).
    assert cliente.get('/reportes/resumen').json() == {'reportes': []}
    reloj.avanzar()
    # Ordenado por cantidad de avisos: el más reportado primero.
    assert cliente.get('/reportes/resumen').json() == {'reportes': [
        {'ean': LIZANO, 'campo': 'sodio', 'motivo': 'unidad_erronea', 'n': 2},
        {'ean': EAN13, 'campo': 'trans', 'motivo': 'inconsistente', 'n': 1},
    ]}

# ---------------------------------------------------------------- auditoría 2026-11-15 (AUDITORIA.md)


def test_lote_con_codigo_repetido(cliente, config):
    # H-02: el mismo código 3 veces en un envío cumplía k >= 3 por sí solo y fijaba la mediana.
    r = cliente.post('/precios', json={'aportes': [aporte(precio=999)] * 3})
    assert r.status_code == 422 and 'repetido' in r.text
    # UPC-A y su EAN-13 son el mismo producto.
    assert cliente.post('/precios', json={'aportes': [aporte(ean=UPC_A), aporte(ean='0' + UPC_A)]}).status_code == 422
    assert contar(config) == 0


@pytest.mark.parametrize('cabeceras', [{}, {'Content-Type': 'text/plain'}, {'Content-Type': 'application/x-www-form-urlencoded'}])
def test_post_solo_json(cliente, config, cabeceras):
    # H-03: sin Content-Type, FastAPI leía el cuerpo como JSON. Un sitio ajeno podía mandar ese POST «simple» (sin
    # permiso CORS) desde el navegador de cada visitante: precios falsos desde muchas IP, sin límite de uso.
    cuerpo = json.dumps({'aportes': [aporte()]}).encode()
    r = cliente.post('/precios', content=cuerpo, headers={'Origin': 'https://sitio-ajeno.example', **cabeceras})
    assert r.status_code == 415
    r = cliente.post('/reportes', content=json.dumps({'ean': LIZANO, 'campo': 'sodio', 'motivo': 'otro'}).encode(),
                     headers=cabeceras)
    assert r.status_code == 415
    assert contar(config) == 0
    con_charset = cliente.post('/precios', content=cuerpo, headers={'Content-Type': 'application/json; charset=utf-8'})
    assert con_charset.status_code == 201


def test_digitos_de_otras_escrituras(cliente, config):
    # H-05: el \d de Python aceptaba dígitos arábigo-índicos como un código válido.
    arabe = LIZANO.translate(str.maketrans('0123456789', '٠١٢٣٤٥٦٧٨٩'))
    assert not ean_valido(arabe)
    assert cliente.post('/precios', json={'aportes': [aporte(ean=arabe)]}).status_code == 422
    assert contar(config) == 0


def test_registro_de_acceso_apagado(config):
    # H-06: aunque se inicie uvicorn sin --no-access-log, el registro de acceso (con la IP) queda apagado.
    import logging
    logging.getLogger('uvicorn.access').disabled = False
    app = crear_app(config)
    assert logging.getLogger('uvicorn.access').disabled
    app.state.almacen.cerrar()


def test_k_minimo_3(config):
    # H-07: CANASTA_MIN_REPORTES=1 publicaba el precio de una sola compra.
    from dataclasses import replace
    with pytest.raises(ValueError, match='3 o más'):
        replace(config, min_reportes=2)

# ---------------------------------------------------------------- base real


def test_base_real_carga():
    cfg = Config(bd=':memory:')
    app = crear_app(cfg)
    base = app.state.base
    assert len(base.productos) == base.meta['productos']
    assert sum(ean_valido(e) for e in base.por_ean) / len(base.por_ean) > 0.95
    assert base.buscar('leche', 5)
    assert base.buscar('leche dos pinos', 1)[0]['nombre'] == 'Leche Dos Pinos'   # no «Choco Leche»
    assert base.buscar('salsa lizano', 1)[0]['nombre'].lower().startswith('salsa')
    app.state.almacen.cerrar()


def test_compresion_gzip_de_la_base_real():
    cfg = Config(bd=':memory:')
    app = crear_app(cfg)
    with TestClient(app) as c:
        r = c.get('/productos/base', headers={'Accept-Encoding': 'gzip'})
        assert r.status_code == 200 and r.headers['content-encoding'] == 'gzip'
        crudo = len(app.state.base.crudo)
        comprimido = int(r.headers['content-length'])
        assert comprimido < crudo / 3, (comprimido, crudo)       # JSON comprime bien: < 1/3
        assert r.json()['meta']['productos'] == len(app.state.base.productos)
        assert c.get('/productos/base', headers={'If-None-Match': r.headers['etag']}).status_code == 304
    app.state.almacen.cerrar()


# ---------------------------------------------------------------- sprint 2: B-17 (P-03, P-04) y P-08


def test_tabla_se_calcula_una_vez_por_semana(cliente, reloj):
    # P-03: antes cada envío borraba la caché y la tabla se recalculaba (2,5 s con 200 000 aportes).
    enviar(cliente, *[aporte(precio=p) for p in (1500, 1510, 1490)])
    reloj.avanzar()
    almacen = cliente.app.state.almacen
    cliente.get('/precios/tabla')
    calculos = almacen.calculos
    for i in range(3):
        enviar(cliente, aporte(ean=EANS[i], fecha='2026-11-20'))
        cliente.get('/precios/tabla')
    assert almacen.calculos == calculos           # los envíos de la semana en curso no la recalculan
    reloj.avanzar()
    cliente.get('/precios/tabla')
    assert almacen.calculos == calculos + 1       # al cerrar la semana, una vez


def test_base_y_tabla_comprimidas_una_sola_vez(cliente, reloj):
    # P-04: el gzip se hace al cargar (base) o al calcular (tabla), no en cada petición.
    base = cliente.app.state.base
    r = cliente.get('/productos/base', headers={'Accept-Encoding': 'gzip'})
    assert r.headers['content-encoding'] == 'gzip' and int(r.headers['content-length']) == len(base.gz)
    assert 'Accept-Encoding' in r.headers['vary'] and r.content == base.crudo   # CORS agrega Origin
    sin = cliente.get('/productos/base', headers={'Accept-Encoding': 'identity'})
    assert 'content-encoding' not in sin.headers and sin.content == base.crudo
    assert cliente.get('/productos/base', headers={'Accept-Encoding': 'gzip;q=0'}).headers.get('content-encoding') is None
    enviar(cliente, *[aporte(precio=p) for p in (1500, 1510, 1490)])
    reloj.avanzar()
    pub = cliente.app.state.almacen.tabla(reloj(), 12, 3)
    r = cliente.get('/precios/tabla', headers={'Accept-Encoding': 'gzip, br'})
    assert int(r.headers['content-length']) == len(pub.gz) and r.json() == pub.datos


def test_if_none_match_debil_y_en_lista(cliente):
    # P-08: con W/ o en una lista respondía 200 y la app descargaba todo otra vez.
    etag = cliente.get('/productos/base').headers['etag']
    assert etag.startswith('W/"')
    fuerte = etag.removeprefix('W/')                      # como lo guardaba la app con la versión anterior
    for valor in (etag, fuerte, f'"otro", {etag}', '*'):
        assert cliente.get('/productos/base', headers={'If-None-Match': valor}).status_code == 304, valor
    assert cliente.get('/productos/base', headers={'If-None-Match': '"otro"'}).status_code == 200


# ---------------------------------------------------------------- sprint 2: B-22 (hallazgos chicos de AUDITORIA.md)


def test_ipv6_se_agrupa_por_64():
    # P-05: cada dirección de una misma /64 tenía su propio cupo (5 de 5 permitidas).
    from canasta_api.main import clave_cliente
    assert clave_cliente('2001:db8:1:2::1') == clave_cliente('2001:db8:1:2:ffff::9') == '2001:db8:1:2::/64'
    assert clave_cliente('2001:db8:1:3::1') != clave_cliente('2001:db8:1:2::1')
    assert clave_cliente('::ffff:203.0.113.7') == '203.0.113.7' and clave_cliente('203.0.113.7') == '203.0.113.7'
    lim = Limitador(por_hora=5)
    ok = [lim.permitir(clave_cliente(f'2001:db8:1:2::{i:x}'), 5, ahora=0)[0] for i in range(1, 6)]
    assert ok == [True, False, False, False, False]


def test_respaldo_y_version_de_esquema(cliente, config, tmp_path):
    # P-06: copia consistente con el servicio en marcha, y la base lleva su versión de esquema.
    from canasta_api import respaldo
    from canasta_api.precios import ESQUEMA_VERSION, Almacen
    enviar(cliente, aporte(), aporte(ean=EAN13))
    destino = tmp_path / 'copia.sqlite3'
    assert respaldo.main([str(destino), '--bd', config.bd]) == 0
    assert respaldo.main([str(destino), '--bd', config.bd]) == 2          # no sobrescribe
    con = sqlite3.connect(destino)
    assert con.execute('SELECT COUNT(*) FROM aportes').fetchone()[0] == 2
    assert con.execute('PRAGMA user_version').fetchone()[0] == ESQUEMA_VERSION
    con.execute('PRAGMA user_version = 99'); con.commit(); con.close()
    with pytest.raises(RuntimeError, match='más nuevo'):
        Almacen(destino)
    otra = tmp_path / 'otra.sqlite3'
    cliente.app.state.almacen.respaldar(otra)
    assert sqlite3.connect(otra).execute('SELECT COUNT(*) FROM aportes').fetchone()[0] == 2


def test_docs_se_apagan_en_produccion(config):
    # P-07: /docs carga scripts de cdn.jsdelivr.net; con CANASTA_DOCS=0 no existe.
    from dataclasses import replace
    app = crear_app(replace(config, docs=False))
    with TestClient(app) as c:
        assert c.get('/docs').status_code == 404 and c.get('/openapi.json').status_code == 404
        assert c.get('/salud').status_code == 200
    app.state.almacen.cerrar()


def test_fecha_de_costa_rica():
    # P-09: con la fecha UTC del contenedor, el domingo a las 19:00 de Costa Rica ya era lunes (otra semana).
    from datetime import datetime, timezone
    from canasta_api.config import hoy_costa_rica
    domingo_19h_cr = datetime(2026, 11, 16, 1, 0, tzinfo=timezone.utc)   # 2026-11-15 19:00 en Costa Rica
    assert hoy_costa_rica(domingo_19h_cr) == date(2026, 11, 15)
    assert semana_iso(hoy_costa_rica(domingo_19h_cr)) == '2026-W46'
    assert Config().hoy is hoy_costa_rica


def test_x_forwarded_for_solo_del_proxy(config):
    # P-10: con CANASTA_PROXIES, alguien que llega directo al puerto no puede elegir su «IP» con X-Forwarded-For.
    from dataclasses import replace
    app = crear_app(replace(config, limite_por_hora=5, confiar_proxy=True, proxies=('10.0.0.0/8',)))
    tres = {'aportes': [aporte(ean=e) for e in EANS[:3]]}
    with TestClient(app, client=('203.0.113.50', 4000)) as directo:
        assert directo.post('/precios', json=tres, headers={'X-Forwarded-For': '198.51.100.1'}).status_code == 201
        assert directo.post('/precios', json=tres, headers={'X-Forwarded-For': '198.51.100.2'}).status_code == 429
    with TestClient(app, client=('10.0.0.2', 4000)) as proxy:
        assert proxy.post('/precios', json=tres, headers={'X-Forwarded-For': '198.51.100.1'}).status_code == 201
        assert proxy.post('/precios', json=tres, headers={'X-Forwarded-For': '198.51.100.2'}).status_code == 201
    app.state.almacen.cerrar()
    with pytest.raises(ValueError):
        replace(config, proxies=('no-es-una-red',))


def test_aviso_de_codigo_fuera_de_la_base(cliente):
    # P-11: se aceptaba (201) y ensuciaba el resumen.
    fuera = con_control('750100000001')
    r = cliente.post('/reportes', json={'ean': fuera, 'campo': 'sodio', 'motivo': 'otro'})
    assert r.status_code == 422 and 'no está en la base' in r.text


def test_error_interno_en_json_y_sin_datos_en_el_registro(cliente, caplog):
    # P-12: un 500 salía en texto plano y sin cabeceras de seguridad. El registro no lleva el código pedido ni la IP.
    def falla(*_):
        raise sqlite3.OperationalError('disco lleno')
    cliente.app.state.almacen.guardar_reporte = falla
    with caplog.at_level('ERROR', logger='canasta_api'):
        r = cliente.post('/reportes', json={'ean': LIZANO, 'campo': 'sodio', 'motivo': 'otro'})
    assert r.status_code == 500 and r.json() == {'detail': 'error interno'}
    assert r.headers['x-content-type-options'] == 'nosniff'
    assert 'POST /reportes' in caplog.text and LIZANO not in caplog.text and 'testclient' not in caplog.text


def test_origen_con_barra_final(config):
    # P-12: «http://localhost:5173/» en CANASTA_ORIGENES dejaba a la app sin permiso CORS, sin ningún aviso.
    from dataclasses import replace
    app = crear_app(replace(config, origenes=('http://localhost:5173/',)))
    pre = {'Origin': 'http://localhost:5173', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}
    with TestClient(app) as c:
        assert c.options('/precios', headers=pre).headers.get('access-control-allow-origin') == 'http://localhost:5173'
    app.state.almacen.cerrar()
