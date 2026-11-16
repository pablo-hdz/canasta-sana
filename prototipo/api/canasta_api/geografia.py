"""Catálogos cerrados: cadenas y cantones de Costa Rica.

Los aportes solo aceptan valores de estas listas (nada de texto libre: así no se cuelan datos personales).
Cantones: 84, división territorial vigente desde 2022 (Río Cuarto, Monteverde y Puerto Jiménez).
POR VERIFICAR contra la División Territorial Administrativa oficial publicada por el Gobierno de Costa Rica.
"""
import re
import unicodedata

PROVINCIAS: dict[str, list[str]] = {
    'San José': ['San José', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú', 'Aserrí', 'Mora', 'Goicoechea',
                 'Santa Ana', 'Alajuelita', 'Vázquez de Coronado', 'Acosta', 'Tibás', 'Moravia', 'Montes de Oca',
                 'Turrubares', 'Dota', 'Curridabat', 'Pérez Zeledón', 'León Cortés Castro'],
    'Alajuela': ['Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas', 'Naranjo', 'Palmares', 'Poás', 'Orotina',
                 'San Carlos', 'Zarcero', 'Sarchí', 'Upala', 'Los Chiles', 'Guatuso', 'Río Cuarto'],
    'Cartago': ['Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba', 'Alvarado', 'Oreamuno', 'El Guarco'],
    'Heredia': ['Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael', 'San Isidro', 'Belén', 'Flores',
                'San Pablo', 'Sarapiquí'],
    'Guanacaste': ['Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces', 'Carrillo', 'Cañas', 'Abangares', 'Tilarán',
                   'Nandayure', 'La Cruz', 'Hojancha'],
    'Puntarenas': ['Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro', 'Osa', 'Quepos', 'Golfito', 'Coto Brus',
                   'Parrita', 'Corredores', 'Garabito', 'Monteverde', 'Puerto Jiménez'],
    'Limón': ['Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina', 'Guácimo'],
}

# Comercios donde la gente compra comida. Los precios los aporta cada persona desde su propio tiquete
# (no se extraen de ningún sitio web: D-17).
CADENAS: list[str] = [
    'Auto Mercado', 'Fresh Market', 'Maxi Palí', 'Más x Menos', 'Mega Super', 'Palí', 'Pequeño Mundo',
    'Perimercados', 'PriceSmart', 'Super Compro', 'Walmart', 'Pulpería o minisúper', 'Feria del agricultor', 'Otro',
]


def clave(texto: str) -> str:
    """«Más x Menos», «MAS X MENOS» y «masxmenos» dan la misma clave."""
    sin_tildes = unicodedata.normalize('NFD', texto).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]', '', sin_tildes.lower())


CANTONES: list[str] = [c for lista in PROVINCIAS.values() for c in lista]
_CANTON_POR_CLAVE = {clave(c): c for c in CANTONES}
_CADENA_POR_CLAVE = {clave(c): c for c in CADENAS}
# «San José», «Alajuela», «Cartago», «Heredia», «Puntarenas» y «Limón» son a la vez provincia y cantón: sin ambigüedad.
assert len(_CANTON_POR_CLAVE) == len(CANTONES), 'claves de cantón repetidas'


def canton_canonico(texto: str) -> str | None:
    return _CANTON_POR_CLAVE.get(clave(texto))


def cadena_canonica(texto: str) -> str | None:
    return _CADENA_POR_CLAVE.get(clave(texto))
