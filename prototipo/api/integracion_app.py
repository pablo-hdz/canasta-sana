"""B-30: integración real de la app (Vite en desarrollo, con VITE_API_URL) con el servicio (uvicorn, starlette 1.10).

Uso, desde prototipo/api:
    .venv\\Scripts\\python integracion_app.py             pruebas automáticas; al final borra los datos y apaga todo
    .venv\\Scripts\\python integracion_app.py --mantener  además deja los dos servidores encendidos para probar en el
                                                         navegador; termina al crear el archivo «terminar» que indica,
                                                         y entonces borra los datos y apaga todo

Usa puertos libres y una base de datos TEMPORAL: no toca api/datos/precios.sqlite3 ni un servicio que ya esté en marcha.
Comprueba:
  1. preflight CORS desde el origen de la app (y que otro origen no recibe permiso);
  2. la app servida por Vite apunta al servicio (VITE_API_URL); la tabla llega con gzip y ETag débil, y el segundo
     pedido con If-None-Match da 304;
  3. un aporte como el que arma la app (código, precio, cadena, cantón y fecha) se guarda y la base solo tiene esas
     columnas más la semana; un campo de más se rechaza sin guardar nada. Que una compra SIMULADO no se envíe depende
     de la pantalla (App.tsx, ofrecerAporte): se comprueba en el navegador con --mantener;
  4. borra la base temporal y apaga los servidores.
Código de salida 0 si todo pasó.
"""
import gzip
import json
import os
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
WEB_DIR = API_DIR.parent / 'web'
HOST = '127.0.0.1'
CAMPOS_APORTE = {'ean', 'precio', 'cadena', 'canton', 'fecha'}


def puerto_libre() -> int:
    with socket.socket() as s:
        s.bind((HOST, 0))
        return s.getsockname()[1]


def pedir(url: str, metodo: str = 'GET', cuerpo: bytes | None = None, cabeceras: dict | None = None):
    req = urllib.request.Request(url, data=cuerpo, method=metodo, headers=cabeceras or {})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.headers, r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


def esperar(url: str, segundos: float = 90) -> None:
    fin = time.monotonic() + segundos
    while time.monotonic() < fin:
        try:
            urllib.request.urlopen(url, timeout=2)
            return
        except Exception:
            time.sleep(0.5)
    raise RuntimeError(f'{url} no respondió en {segundos:.0f} s')


def apagar(proc: subprocess.Popen) -> None:
    if proc.poll() is None:
        if os.name == 'nt':   # npm deja procesos hijos (node): se apaga el árbol completo
            subprocess.run(['taskkill', '/T', '/F', '/PID', str(proc.pid)], capture_output=True)
        else:
            proc.terminate()
        proc.wait(timeout=20)


def main() -> int:
    mantener = '--mantener' in sys.argv
    tmp = Path(tempfile.mkdtemp(prefix='canasta-b30-'))
    bd = tmp / 'precios.sqlite3'
    pa, pw = puerto_libre(), puerto_libre()
    api, app = f'http://{HOST}:{pa}', f'http://{HOST}:{pw}'
    fallas: list[str] = []

    def comprobar(ok: bool, texto: str) -> None:
        print(('  ✓ ' if ok else '  ✗ ') + texto)
        if not ok:
            fallas.append(texto)

    entorno_api = {**os.environ, 'CANASTA_BD': str(bd), 'CANASTA_ORIGENES': app}
    servicio = subprocess.Popen([sys.executable, '-m', 'uvicorn', '--factory', 'canasta_api.main:crear_app', '--host', HOST,
                                 '--port', str(pa), '--no-access-log'], cwd=API_DIR, env=entorno_api,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    npm = shutil.which('npm') or 'npm'
    vite = subprocess.Popen([npm, 'run', 'dev', '--', '--host', HOST, '--port', str(pw), '--strictPort'], cwd=WEB_DIR,
                            env={**os.environ, 'VITE_API_URL': api}, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        esperar(f'{api}/salud')
        esperar(f'{app}/')
        version = json.loads(pedir(f'{api}/salud')[2])['version']
        import starlette
        print(f'Servicio {api} (v{version}, starlette {starlette.__version__}) · app {app} · BD temporal {bd}')

        print('1. Preflight CORS')
        pre = {'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type'}
        st, h, _ = pedir(f'{api}/precios', 'OPTIONS', cabeceras={'Origin': app, **pre})
        comprobar(st == 200 and h.get('access-control-allow-origin') == app, f'desde la app: {st}, permiso para {h.get("access-control-allow-origin")}')
        st, h, _ = pedir(f'{api}/precios', 'OPTIONS', cabeceras={'Origin': 'https://sitio-ajeno.example', **pre})
        comprobar(h.get('access-control-allow-origin') is None, f'desde un sitio ajeno: {st}, sin permiso')
        st, h, _ = pedir(f'{api}/precios/tabla', cabeceras={'Origin': app})
        comprobar(h.get('access-control-expose-headers', '').lower().find('etag') >= 0, 'la app puede leer el ETag (Access-Control-Expose-Headers)')

        print('2. App apuntando al servicio; tabla con gzip y 304')
        _, _, codigo = pedir(f'{app}/src/servicio.ts')
        comprobar(api.encode() in codigo, f'Vite sirve servicio.ts con VITE_API_URL={api}')
        st, h, cuerpo = pedir(f'{api}/precios/tabla', cabeceras={'Origin': app, 'Accept-Encoding': 'gzip'})
        tabla = json.loads(gzip.decompress(cuerpo)) if h.get('content-encoding') == 'gzip' else None
        etag = h.get('etag', '')
        comprobar(st == 200 and tabla is not None and 'precios' in tabla, f'tabla: {st}, Content-Encoding {h.get("content-encoding")}')
        comprobar(etag.startswith('W/"'), f'ETag débil: {etag}')
        st, h, cuerpo = pedir(f'{api}/precios/tabla', cabeceras={'Origin': app, 'Accept-Encoding': 'gzip', 'If-None-Match': etag})
        comprobar(st == 304 and not cuerpo, f'segundo pedido con If-None-Match: {st}, {len(cuerpo)} bytes')

        print('3. Aporte como el que arma la app')
        aporte = {'ean': '7411000345023', 'precio': 1500, 'cadena': 'Palí', 'canton': 'Cartago', 'fecha': time.strftime('%Y-%m-%d')}
        cab = {'Origin': app, 'Content-Type': 'application/json'}
        st, _, cuerpo = pedir(f'{api}/precios', 'POST', json.dumps({'aportes': [{**aporte, 'correo': 'x@example.com'}]}).encode(), cab)
        comprobar(st == 422, f'con un campo de más (correo): {st}')
        st, _, cuerpo = pedir(f'{api}/precios', 'POST', json.dumps({'aportes': [aporte]}).encode(), cab)
        comprobar(st == 201 and json.loads(cuerpo) == {'recibidos': 1}, f'aporte de prueba: {st} {cuerpo.decode()}')
        con = sqlite3.connect(bd)
        columnas = [c[1] for c in con.execute('PRAGMA table_info(aportes)')]
        filas = con.execute('SELECT ean, precio, cadena, canton, semana FROM aportes').fetchall()
        con.close()
        comprobar(columnas == ['id', 'ean', 'precio', 'cadena', 'canton', 'semana'], f'columnas guardadas: {columnas}')
        comprobar(len(filas) == 1, f'filas guardadas: {filas}')
        print('  · SIMULADO: depende de la pantalla; se comprueba en el navegador con --mantener.')

        if mantener:
            alto = tmp / 'terminar'
            print(f'\nServidores encendidos. Abra {app}/ (Ajustes: precios de la comunidad y aportar).\n'
                  f'Para terminar, cree el archivo {alto} (o espere 30 min).', flush=True)
            fin = time.monotonic() + 1800
            while not alto.exists() and time.monotonic() < fin:
                time.sleep(1)
            con = sqlite3.connect(bd)
            print('Aportes guardados durante la prueba manual:', con.execute('SELECT ean, precio, cadena, canton, semana FROM aportes').fetchall())
            con.close()
    except Exception as e:
        comprobar(False, f'error: {e}')
    finally:
        print('4. Limpieza')
        apagar(vite)
        apagar(servicio)
        shutil.rmtree(tmp, ignore_errors=True)
        libres = all(socket.socket().connect_ex((HOST, p)) != 0 for p in (pa, pw))
        comprobar(not tmp.exists(), 'base de datos temporal borrada')
        comprobar(libres, f'servidores apagados (puertos {pa} y {pw} libres)')
    print('\nTODO BIEN' if not fallas else f'\nFALLAS: {len(fallas)}')
    return 0 if not fallas else 1


if __name__ == '__main__':
    raise SystemExit(main())
