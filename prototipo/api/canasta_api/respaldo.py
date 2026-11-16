"""Respaldo de la base de precios, también con el servicio en marcha (auditoría P-06).

    python -m canasta_api.respaldo DESTINO.sqlite3 [--bd RUTA]
    docker exec <contenedor> python -m canasta_api.respaldo /datos/respaldo-AAAA-MM-DD.sqlite3

Usa la API de respaldo de SQLite: copiar el archivo en modo WAL puede dar una copia a medias. Después revisa la copia con
PRAGMA integrity_check. Código de salida 0 si la copia está bien.
"""
import argparse
import os
import sqlite3
from pathlib import Path

from .config import Config


def respaldar(origen: str, destino: str) -> tuple[str, int]:
    fuente = sqlite3.connect(Path(origen).resolve().as_uri() + '?mode=ro', uri=True)   # solo lectura
    copia = sqlite3.connect(destino)
    try:
        fuente.backup(copia)
        return copia.execute('PRAGMA integrity_check').fetchone()[0], copia.execute('SELECT COUNT(*) FROM aportes').fetchone()[0]
    finally:
        fuente.close()
        copia.close()


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description='Respaldo de la base de precios de Canasta sana')
    ap.add_argument('destino')
    ap.add_argument('--bd', default=os.environ.get('CANASTA_BD', Config.bd))
    a = ap.parse_args(argv)
    if Path(a.destino).exists():
        print(f'{a.destino} ya existe: elija otro nombre')
        return 2
    integridad, aportes = respaldar(a.bd, a.destino)
    print(f'Respaldo en {a.destino}: integridad «{integridad}», {aportes} aportes.')
    return 0 if integridad == 'ok' else 1


if __name__ == '__main__':
    raise SystemExit(main())
