"""Base pública de productos (Open Food Facts, ODbL): versión, búsqueda y consulta por código."""
import gzip
import hashlib
import json
import re
import unicodedata
from pathlib import Path


def ean_valido(ean: str) -> bool:
    """Dígito de control GS1 (módulo 10, pesos 3 y 1 desde la derecha) para EAN-8, UPC-A y EAN-13."""
    # [0-9] y no \d: en Python \d acepta dígitos de otras escrituras («٧٤١١…»), que ensuciarían la tabla (H-05).
    if not re.fullmatch(r'[0-9]{8}|[0-9]{12}|[0-9]{13}', ean):
        return False
    *cuerpo, control = (int(c) for c in ean)
    suma = sum(d * (3 if i % 2 == 0 else 1) for i, d in enumerate(reversed(cuerpo)))
    return (10 - suma % 10) % 10 == control


def normalizar_ean(ean: str) -> str:
    """UPC-A (12 dígitos) es el mismo código que su EAN-13 con un 0 delante."""
    return '0' + ean if len(ean) == 12 else ean


def uso_interno(ean: str) -> bool:
    """Códigos de circulación restringida o que no son productos: el precio no se puede comparar entre comercios.
    EAN-13: 20-29 (uso interno, p. ej. carne pesada en la tienda); UPC-A sistema 2 → 02 (peso variable),
    sistema 4 → 04 (uso interno de la tienda) y sistema 5 → 05 (cupones). EAN-8: 0 y 2.
    Basado en las GS1 General Specifications. POR VERIFICAR contra la edición vigente."""
    e = normalizar_ean(ean)
    if len(e) == 8:
        return e[0] in '02'
    return e[0] == '2' or e[:2] in ('02', '04', '05')


def tokens(texto: str) -> list[str]:
    sin_tildes = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode().lower()
    return [t for t in re.split(r'[^a-z0-9]+', sin_tildes) if t]


class Base:
    def __init__(self, ruta: Path):
        crudo = ruta.read_bytes()
        self.sha256 = hashlib.sha256(crudo).hexdigest()
        self.etag = f'W/"{self.sha256[:32]}"'   # débil: se sirve con y sin gzip (B-17)
        self.crudo = crudo
        self.gz = gzip.compress(crudo, compresslevel=9, mtime=0)   # una sola vez, no en cada petición (B-17)
        datos = json.loads(crudo)
        self.meta: dict = datos.get('meta', {})
        self.productos: list[dict] = datos['productos']
        self.por_ean = {normalizar_ean(p['ean']): p for p in self.productos}
        self._indice = [(p, tokens(p.get('nombre', '')), tokens(f"{p.get('nombre', '')} {p.get('marca', '')}"))
                        for p in self.productos]

    def resumen(self, p: dict) -> dict:
        return {k: p.get(k) for k in ('ean', 'nombre', 'marca', 'cantidad', 'cantidadNum', 'unidad')}

    def buscar(self, consulta: str, limite: int) -> list[dict]:
        consulta = consulta.strip()
        if re.fullmatch(r'[0-9]{8,13}', consulta):
            p = self.por_ean.get(normalizar_ean(consulta))
            return [self.resumen(p)] if p else []
        q = [t for t in tokens(consulta) if len(t) >= 2]
        if not q:
            return []
        hallados = []
        for p, nombre, toks in self._indice:
            # Cada palabra buscada debe ser el inicio de alguna palabra del nombre o la marca («lech» → «leche»).
            if all(any(t.startswith(x) for t in toks) for x in q):
                # Orden: más palabras exactas, más palabras en el nombre (no solo en la marca),
                # nombre que empieza por la primera palabra buscada, nombre más corto.
                exactas = sum(x in toks for x in q)
                en_nombre = sum(any(t.startswith(x) for t in nombre) for x in q)
                empieza = bool(nombre) and nombre[0].startswith(q[0])
                hallados.append(((-exactas, -en_nombre, not empieza, len(p.get('nombre', '')), p['ean']), p))
        hallados.sort(key=lambda h: h[0])
        return [self.resumen(p) for _, p in hallados[:limite]]
