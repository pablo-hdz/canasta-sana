"""Descarga los productos de Costa Rica con tabla nutricional completa desde Open Food Facts
y genera la base semilla compacta que usa la app.

Datos: Open Food Facts (https://world.openfoodfacts.org), base bajo licencia ODbL y
contenidos bajo DbCL. Hay que dar crédito y compartir igual la base derivada.

Uso:  python descargar_off.py [--salida ../web/public/datos/productos_cr.json] [--pausa 7]
      python descargar_off.py --completar   (sin red: tamaño y nombre en español desde la caché, B-04 y B-08)
Respeta el límite de la API de búsqueda: una petición cada --pausa segundos.
"""
import argparse
import datetime as dt
import json
import math
import os
import pathlib
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

API = "https://world.openfoodfacts.org/api/v2/search"
AGENTE = "ProyectoEstudiantilCR-CanastaSana/0.1"
CAMPOS = ",".join([
    "code", "product_name", "product_name_es", "brands", "quantity", "product_quantity",
    "product_quantity_unit", "categories_tags", "nutriments", "ingredients_text_es",
    "ingredients_text", "allergens_tags", "traces_tags", "nova_group", "additives_tags",
    "stores_tags", "last_modified_t",
])
NUTRIENTES = {  # clave OFF por 100 g o ml -> clave propia
    "energy-kcal_100g": "kcal", "sugars_100g": "azucares", "added-sugars_100g": "azucaresAnadidos",
    "fat_100g": "grasas", "saturated-fat_100g": "saturadas", "trans-fat_100g": "trans",
    "carbohydrates_100g": "carbohidratos", "proteins_100g": "proteinas",
}


CACHE = pathlib.Path(__file__).parent / "cache_off"
ESPERAS = [60, 120, 240, 480, 600]  # s; el servidor responde 503/401 cuando hay muchas búsquedas
# Fuente alterna: índice de búsqueda de Open Food Facts (search-a-licious). Es un subconjunto
# de la base (al 2026-11-14: 1176 productos de CR con tabla nutricional frente a 2263 en la API clásica).
API_BUSQUEDA = "https://search.openfoodfacts.org/search"


def pedir_busqueda(pagina: int) -> dict:
    CACHE.mkdir(exist_ok=True)
    archivo = CACHE / f"busqueda_{pagina:03d}.json"
    if archivo.exists():
        return json.loads(archivo.read_text(encoding="utf-8"))
    q = urllib.parse.urlencode({
        "q": 'countries_tags:"en:costa-rica" AND states_tags:"en:nutrition-facts-completed"',
        "page": pagina, "page_size": 100, "fields": CAMPOS,
    })
    req = urllib.request.Request(f"{API_BUSQUEDA}?{q}", headers={"User-Agent": AGENTE})
    return descargar(req, archivo, f"página {pagina} de la búsqueda")


def desde_busqueda(pausa: float) -> list:
    primera = pedir_busqueda(1)
    paginas = int(primera.get("page_count") or 1)
    crudos = list(primera["hits"])
    print(f"Búsqueda (search-a-licious): {primera.get('count')} productos, {paginas} páginas", flush=True)
    for pag in range(2, paginas + 1):
        if not (CACHE / f"busqueda_{pag:03d}.json").exists():
            time.sleep(pausa)
        crudos += pedir_busqueda(pag)["hits"]
    return crudos


def pedir(pagina: int, tam: int) -> dict:
    """Descarga una página; reanudable: si ya está en la caché, no vuelve a pedirla."""
    CACHE.mkdir(exist_ok=True)
    archivo = CACHE / f"pagina_{pagina:03d}_{tam}.json"
    if archivo.exists():
        return json.loads(archivo.read_text(encoding="utf-8"))
    q = urllib.parse.urlencode({
        "countries_tags": "en:costa-rica", "states_tags": "en:nutrition-facts-completed",
        "page": pagina, "page_size": tam, "fields": CAMPOS, "sort_by": "code",
    })
    req = urllib.request.Request(f"{API}?{q}", headers={"User-Agent": AGENTE})
    return descargar(req, archivo, f"página {pagina}")


def descargar(req: urllib.request.Request, archivo: pathlib.Path, nombre: str) -> dict:
    """Pide una página con reintentos acotados: 6 intentos, con esperas de 60, 120, 240, 480 y 600 s (o lo que diga
    Retry-After). Si responde, la guarda en la caché de forma atómica; si no, falla con un mensaje para reanudar."""
    for intento in range(len(ESPERAS) + 1):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                datos = json.load(r)
            escribir_atomico(archivo, json.dumps(datos, ensure_ascii=False))
            return datos
        except urllib.error.HTTPError as e:
            espera = int(e.headers.get("Retry-After") or 0) or (ESPERAS[intento] if intento < len(ESPERAS) else 0)
            motivo = f"HTTP {e.code}"
        except Exception as e:  # red o JSON inválido
            espera = ESPERAS[intento] if intento < len(ESPERAS) else 0
            motivo = str(e)
        ultimo = intento == len(ESPERAS)
        print(f"  {nombre}, intento {intento + 1} de {len(ESPERAS) + 1}: {motivo}" + ("" if ultimo else f"; espero {espera} s"),
              file=sys.stderr, flush=True)
        if not ultimo:
            time.sleep(espera)
    raise RuntimeError(f"No se pudo descargar la {nombre} después de {len(ESPERAS) + 1} intentos; "
                       f"vuelva a ejecutar el script para reanudar (lo ya descargado queda en la caché)")


def numero(v):
    try:
        x = float(v)
        return x if math.isfinite(x) and x >= 0 else None
    except (TypeError, ValueError):
        return None


def texto(v) -> str:
    """La API clásica da texto; la de búsqueda a veces da listas o diccionarios por idioma."""
    if v is None:
        return ""
    if isinstance(v, list):
        return ", ".join(texto(x) for x in v if x)
    if isinstance(v, dict):
        return texto(v.get("es") or v.get("main") or next(iter(v.values()), ""))
    return str(v)


def lista(v) -> list:
    return v if isinstance(v, list) else ([] if v is None else [v])


# ---------------------------------------------------------------- tamaño del envase (B-04)
# Unidad → (unidad de la base, factor). Onza: 28,3495 g; onza líquida: 29,5735 ml; libra: 453,592 g.
UNIDADES = {
    "g": ("g", 1), "gr": ("g", 1), "grs": ("g", 1), "gramo": ("g", 1), "gramos": ("g", 1),
    "kg": ("g", 1000), "kilo": ("g", 1000), "kilos": ("g", 1000), "kilogramos": ("g", 1000),
    "lb": ("g", 453.592), "oz": ("g", 28.3495), "floz": ("ml", 29.5735),
    "ml": ("ml", 1), "cc": ("ml", 1), "cl": ("ml", 10),
    "l": ("ml", 1000), "lt": ("ml", 1000), "lts": ("ml", 1000), "litro": ("ml", 1000), "litros": ("ml", 1000),
}
_NUM = r"([0-9]+(?:[.,][0-9]+)?)"
_UNIDAD = r"(fl\.?\s*oz|kilogramos|kilos?|gramos?|litros?|grs|gr|kg|lb|oz|ml|cc|cl|lts|lt|g|l)"
# «6 x 355 ml» = 2130 ml. La unidad no puede seguir con letras: «100 galletas» y «1 lata» no son tamaños.
RX_TAMANO = re.compile(rf"(?:{_NUM}\s*[x×]\s*)?{_NUM}\s*{_UNIDAD}(?![a-záéíóúñ])", re.I)
TAMANO_MAXIMO = 50_000   # g o ml por envase; más es un error


def _decimal(s: str) -> float:
    """«28,5» y «1.5» son decimales; «1,000» y «1.000» (3 cifras y parte entera distinta de 0) son miles."""
    m = re.fullmatch(r"([0-9]+)[.,]([0-9]+)", s)
    if m and len(m.group(2)) == 3 and m.group(1) != "0":
        return float(m.group(1) + m.group(2))
    return float(s.replace(",", "."))


def tamano(texto_: str, al_inicio: bool = False) -> tuple[float, str] | None:
    """«281ML» → (281, 'ml'); «28,5G» → (28.5, 'g'); «1 l» → (1000, 'ml'); «14 Oz» → (396.9, 'g').
    Con al_inicio, el tamaño debe abrir el texto (campo quantity): «12 galletas (30g)» no es un envase de 30 g."""
    if not texto_:
        return None
    m = RX_TAMANO.match(texto_.strip()) if al_inicio else RX_TAMANO.search(texto_)
    if not m:
        return None
    veces, valor, u = m.groups()
    unidad, factor = UNIDADES[re.sub(r"[.\s]", "", u.lower())]
    total = _decimal(valor) * factor * (_decimal(veces) if veces else 1)
    return (round(total, 1), unidad) if 0 < total <= TAMANO_MAXIMO else None


def tamano_de(p: dict) -> tuple[float, str] | None:
    """Tamaño de un registro de Open Food Facts: product_quantity con su unidad y, si no, el texto quantity."""
    cantidad, unidad = numero(p.get("product_quantity")), texto(p.get("product_quantity_unit")).strip()
    return (tamano(f"{cantidad:g} {unidad}", al_inicio=True) if cantidad and unidad else None) \
        or tamano(texto(p.get("quantity")), al_inicio=True)


def formato_tamano(t: tuple[float, str]) -> str:
    return f"{t[0]:g}".replace(".", ",") + f" {t[1]}"


# Nombre en otro idioma (B-08), heurístico: palabras o letras de francés o inglés y ninguna palabra común en español.
RX_ESPANOL = re.compile(r"\b(a|el|la|de|del|con|sin|y|en|para|tipo|sabor|leche|bebida|galletas?|jugo|salsa|queso|frijol(es)?|"
                        r"arroz|crema|natural|integral|mantequilla|pollo|pan|yogu?rt?|avena|az[uú]car|cereal|mezcla|aceite|"
                        r"harina|pasta|man[ií]|maíz|fresa|chocolate)\b", re.I)
RX_OTRO_IDIOMA = re.compile(r"[âêîôûçèœë]|\b(the|with|and|drink|powder|milk|spread|juice|cheese|butter|peanut|sugar|free|"
                            r"cream|sauce|cookies?|chips|sweet|sliced|shredded|mix|bar|le|les|du|des|au|aux|et|avec|sans|thé|"
                            r"lait|fromage|beurre|chocolat|légumes?)\b", re.I)


def parece_otro_idioma(nombre: str) -> bool:
    return bool(RX_OTRO_IDIOMA.search(nombre)) and not RX_ESPANOL.search(nombre)


def escribir_atomico(ruta: pathlib.Path, contenido: str) -> None:
    """Un corte a mitad de la escritura no deja un JSON truncado: se escribe aparte y se reemplaza de una vez."""
    tmp = ruta.with_name(ruta.name + ".tmp")
    tmp.write_text(contenido, encoding="utf-8")
    os.replace(tmp, ruta)


def completar(ruta_base: pathlib.Path, cache: pathlib.Path = CACHE) -> dict:
    """B-04 y B-08, sin red: completa la base existente con la caché. Usa el nombre en español (product_name_es)
    cuando algún registro lo trae, y el tamaño de la caché o, si falta, del nombre. No cambia el formato ni los demás
    campos. Devuelve los conteos."""
    datos = json.loads(ruta_base.read_text(encoding="utf-8"))
    registros: dict[str, list] = {}
    for f in sorted(cache.glob("*.json")):
        pagina = json.loads(f.read_text(encoding="utf-8"))
        for r in pagina.get("products") or pagina.get("hits") or []:
            registros.setdefault(str(r.get("code")), []).append(r)
    c = {"productos": len(datos["productos"]), "con_tamano_antes": 0, "desde_cache": 0, "desde_nombre": 0,
         "con_tamano_despues": 0, "nombre_es": 0}
    for p in datos["productos"]:
        rs = registros.get(p["ean"], [])
        es = next((n for n in (texto(r.get("product_name_es")).strip() for r in rs) if n), "")
        # Solo si el nombre actual parece de otro idioma: product_name_es a veces es peor que un nombre que ya está en
        # español («Avena integral» → «Avena interal», «Spaghetti» → «Pasta Linguine»).
        if es and es != p["nombre"] and parece_otro_idioma(p["nombre"]) and not parece_otro_idioma(es):
            p["nombre"] = es
            c["nombre_es"] += 1
        if p.get("cantidadNum") and p.get("unidad"):
            c["con_tamano_antes"] += 1
        else:
            t = next((x for x in map(tamano_de, rs) if x), None)
            fuente = "desde_cache" if t else "desde_nombre"
            t = t or tamano(p["nombre"])
            if t:
                p["cantidadNum"], p["unidad"] = t
                p["cantidad"] = p.get("cantidad") or formato_tamano(t)
                c[fuente] += 1
        c["con_tamano_despues"] += bool(p.get("cantidadNum") and p.get("unidad"))
    datos["meta"]["completado"] = (f"{dt.date.today().isoformat()}: tamaño y nombre en español desde la caché, sin red "
                                   f"(B-04 y B-08: {c['desde_cache']} tamaños de la caché, {c['desde_nombre']} del nombre, "
                                   f"{c['nombre_es']} nombres en español)")
    escribir_atomico(ruta_base, json.dumps(datos, ensure_ascii=False, separators=(",", ":")))
    return c


def compactar(p: dict) -> dict | None:
    n = p.get("nutriments") or {}
    nut = {}
    for k_off, k in NUTRIENTES.items():
        x = numero(n.get(k_off))
        if x is not None:
            nut[k] = round(x, 3)
    sodio = numero(n.get("sodium_100g"))  # OFF guarda gramos por 100 g
    if sodio is None and numero(n.get("salt_100g")) is not None:
        sodio = numero(n.get("salt_100g")) / 2.5  # sal = sodio x 2,5
    if sodio is not None:
        nut["sodioMg"] = round(sodio * 1000, 1)
    nombre = (texto(p.get("product_name_es")) or texto(p.get("product_name"))).strip()
    if not nombre or not p.get("code"):
        return None
    tam = tamano_de(p) or tamano(nombre)   # B-04
    nova = numero(p.get("nova_group"))
    return {
        "ean": str(p["code"]),
        "nombre": nombre,
        "marca": texto(p.get("brands")).split(",")[0].strip(),
        "cantidad": texto(p.get("quantity")).strip(),
        "cantidadNum": tam[0] if tam else None,
        "unidad": tam[1] if tam else None,
        "categorias": lista(p.get("categories_tags")),
        "nova": int(nova) if nova else None,
        "n": nut,
        "ingredientes": (texto(p.get("ingredients_text_es")) or texto(p.get("ingredients_text")))[:800],
        "aditivos": lista(p.get("additives_tags")),
        "alergenos": sorted(set(lista(p.get("allergens_tags")) + lista(p.get("traces_tags")))),
        "tiendas": lista(p.get("stores_tags")),
        "modificado": p.get("last_modified_t"),
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--salida", default=str(pathlib.Path(__file__).parent.parent / "web" / "public" / "datos" / "productos_cr.json"))
    ap.add_argument("--pausa", type=float, default=12.0)
    ap.add_argument("--tam", type=int, default=100)
    ap.add_argument("--solo-cache", action="store_true", help="arma la base solo con las páginas ya descargadas (base parcial)")
    ap.add_argument("--con-busqueda", action="store_true", help="suma el índice de búsqueda (fuente alterna) a la caché clásica")
    ap.add_argument("--completar", action="store_true", help="sin red: completa la base con la caché (tamaño y nombre en español)")
    a = ap.parse_args()

    if a.completar:
        c = completar(pathlib.Path(a.salida))
        n = c["productos"]
        print(json.dumps(c, ensure_ascii=False))
        print(f"Con tamaño: {c['con_tamano_antes']} ({c['con_tamano_antes'] / n:.1%}) → {c['con_tamano_despues']} "
              f"({c['con_tamano_despues'] / n:.1%}); sin tamaño: {1 - c['con_tamano_despues'] / n:.1%}")
        return 0

    if a.solo_cache or a.con_busqueda:
        archivos = sorted(CACHE.glob(f"pagina_*_{a.tam}.json"))
        paginas_cache = [json.loads(f.read_text(encoding="utf-8")) for f in archivos]
        total = paginas_cache[0]["count"] if paginas_cache else None
        crudos = [p for pg in paginas_cache for p in pg["products"]]
        print(f"Caché clásica: {len(archivos)} páginas, {len(crudos)} productos (total en la API: {total})")
        if a.con_busqueda:
            crudos += desde_busqueda(a.pausa / 2)
        if not crudos:
            print("No hay datos.", file=sys.stderr)
            return 1
        print(f"Base PARCIAL: {len(crudos)} registros antes de quitar duplicados")
    else:
        primera = pedir(1, a.tam)
        total = primera["count"]
        paginas = -(-total // a.tam)
        print(f"Open Food Facts: {total} productos de Costa Rica con tabla nutricional, {paginas} páginas")
        crudos = list(primera["products"])
        for pag in range(2, paginas + 1):
            ya = (CACHE / f"pagina_{pag:03d}_{a.tam}.json").exists()
            if not ya:
                time.sleep(a.pausa)
            crudos += pedir(pag, a.tam)["products"]
            print(f"  página {pag}/{paginas}: {len(crudos)} acumulados", flush=True)

    vistos, productos = set(), []
    for p in crudos:
        c = compactar(p)
        clave = "0" + c["ean"] if c and len(c["ean"]) == 12 else (c or {}).get("ean")
        if c and clave not in vistos:
            vistos.add(clave)
            productos.append(c)
    salida = pathlib.Path(a.salida)
    salida.parent.mkdir(parents=True, exist_ok=True)
    meta = {
        "fuente": "Open Food Facts — https://world.openfoodfacts.org",
        "licencia": "ODbL (base) y DbCL (contenidos). Base derivada publicada bajo ODbL.",
        "filtro": "countries_tags=en:costa-rica, states_tags=en:nutrition-facts-completed",
        "descargado": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "total_api": total,
        "productos": len(productos),
    }
    escribir_atomico(salida, json.dumps({"meta": meta, "productos": productos}, ensure_ascii=False, separators=(",", ":")))
    con = lambda k: sum(1 for p in productos if k in p["n"])
    print(json.dumps(meta, ensure_ascii=False, indent=1))
    print("Con dato: kcal", con("kcal"), "| azúcares", con("azucares"), "| sodio", con("sodioMg"),
          "| saturadas", con("saturadas"), "| trans", con("trans"),
          "| NOVA", sum(1 for p in productos if p["nova"]), "| ingredientes", sum(1 for p in productos if p["ingredientes"]))
    print("Archivo:", salida, f"({salida.stat().st_size / 1024:.0f} KiB)")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"\n{e}.\nLas páginas descargadas quedan en {CACHE}. Para armar ya una base parcial con ellas: "
              f"python -I descargar_off.py --solo-cache", file=sys.stderr)
        sys.exit(75)
