"""Enriquece la base PÚBLICA de productos con Jev (TypeSafe AI): grado de procesamiento NOVA y
categoría limpia. Nunca envía tiquetes, facturas ni datos de personas: solo nombre, marca, categorías,
ingredientes y tamaño de productos de Open Food Facts.

API (docs.typesafe.ai, leída el 2026-11-14): POST https://api.typesafe.ai/v1/systemone
  cuerpo {model, state, questions{id:{type, instructions, criteria}}} → {model, answers{id:{choice, confidence,
  probabilities}}, usage{input_tokens, output_tokens}}. Precio: USD 0,042 por millón de tokens de entrada; la salida es gratis.

Modos:
  python -I enriquecer_jev.py                 # simulación (sin red): ejemplo de petición, tokens y costo estimados
  python -I enriquecer_jev.py --validar 200   # con clave: compara NOVA de Jev con NOVA conocido de OFF (exactitud)
  python -I enriquecer_jev.py --ejecutar      # con clave: estima NOVA y categoría de toda la base → ia_jev.json
La clave va en la variable de entorno TYPESAFE_API_KEY (la crea Pablo en console.typesafe.ai; nunca en el código).
Reanudable: guarda cada respuesta en cache_jev/<ean>.json.
"""
import argparse
import concurrent.futures as cf
import datetime as dt
import json
import os
import pathlib
import random
import sys
import time
import urllib.error
import urllib.request

RAIZ = pathlib.Path(__file__).parent
BASE = RAIZ.parent / "web" / "public" / "datos" / "productos_cr.json"
SALIDA = RAIZ.parent / "web" / "public" / "datos" / "ia_jev.json"
CACHE = RAIZ / "cache_jev"
API = "https://api.typesafe.ai/v1/systemone"
MODELO = "jev-1.14.0"            # versión fija (no «latest») para que los resultados sean repetibles
PRECIO_ENTRADA = 0.042 / 1e6      # USD por token de entrada (docs.typesafe.ai, 2026-11-14)
FILAS_POR_SEGUNDO = 1200          # SUPUESTO: 100 000 filas en 82,2 s (MotherDuck) ≈ 1 217/s

# Instrucciones en inglés: la documentación no confirma soporte de español (los datos sí van en español).
PREGUNTAS = {
    "nova": {
        "type": "choice",
        "instructions": "Classify this packaged food sold in Costa Rica by its degree of industrial processing (NOVA classification, as used by the PAHO nutrient profile model). Product data is in Spanish.",
        "criteria": {
            "nova1": "Unprocessed or minimally processed food: fresh, dried, ground, pasteurized, frozen or fermented without added sugar, salt or oil (e.g. plain rice, dry beans, plain milk, plain yogurt, eggs, fresh fruit, plain coffee).",
            "nova2": "Processed culinary ingredient used to cook: table salt, sugar, honey, vegetable oils, butter, lard.",
            "nova3": "Processed food: a simple food with added salt, sugar or oil, few ingredients (e.g. canned vegetables or fish, cheese, bread made only of flour, water, salt and yeast, fruit in syrup).",
            "nova4": "Ultra-processed food: industrial formulation with ingredients not used in home cooking (flavourings, colourings, emulsifiers, sweeteners, hydrogenated oils, modified starch, protein isolates), e.g. soft drinks, packaged snacks, sweet biscuits, breakfast cereals, instant noodles, sausages.",
        },
    },
    "categoria": {
        "type": "choice",
        "instructions": "Which product group does this packaged food belong to? Two products in the same group must be reasonable substitutes for each other in a household shopping basket.",
        "criteria": {
            "galletas": "Biscuits, cookies, crackers, wafers.",
            "cereales": "Breakfast cereals, granola, oat flakes.",
            "snacks_salados": "Chips, puffs, salted snacks, popcorn, nuts snacks.",
            "dulces_chocolates": "Chocolate, candy, confectionery, sweet spreads.",
            "gaseosas": "Soft drinks and sodas.",
            "jugos_bebidas": "Juices, nectars, flavoured drinks, iced tea, sports and energy drinks.",
            "leche": "Plain or flavoured milk and milk drinks.",
            "yogur": "Yogurt, kefir, fermented milk.",
            "quesos": "Cheese.",
            "embutidos": "Sausages, ham, cold cuts, processed meat.",
            "pan": "Bread, tortillas, buns.",
            "pastas_arroz": "Pasta, noodles, rice.",
            "frijoles_legumbres": "Beans, lentils and other legumes, including refried and canned beans.",
            "salsas_condimentos": "Sauces, condiments, dressings, ketchup, mayonnaise, seasoning, bouillon.",
            "enlatados": "Canned fish, canned vegetables, canned meals.",
            "aceites_grasas": "Oils, butter, margarine.",
            "azucar_miel": "Sugar, honey, syrups.",
            "cafe_te": "Coffee, tea, cocoa powder.",
            "postres": "Desserts, ice cream, puddings, jelly.",
            "comidas_preparadas": "Ready meals, instant soups, frozen meals.",
            "otros": "None of the above.",
        },
    },
}
UMBRAL_CONFIANZA = 0.80  # SUPUESTO: por debajo, la app no usa la respuesta de Jev


def estado(p: dict) -> dict:
    return {
        "nombre": p["nombre"], "marca": p.get("marca") or "", "tamano": p.get("cantidad") or "",
        "categorias_open_food_facts": [c.split(":", 1)[-1] for c in p.get("categorias", [])][:12],
        "ingredientes": (p.get("ingredientes") or "")[:600],
    }


def cuerpo(p: dict) -> dict:
    return {"model": MODELO, "state": estado(p), "questions": PREGUNTAS}


def tokens_aprox(obj) -> int:
    return len(json.dumps(obj, ensure_ascii=False)) // 4 + 1   # SUPUESTO: ~4 caracteres por token


def preguntar(p: dict, clave: str) -> dict:
    CACHE.mkdir(exist_ok=True)
    archivo = CACHE / f"{p['ean']}.json"
    if archivo.exists():
        return json.loads(archivo.read_text(encoding="utf-8"))
    datos = json.dumps(cuerpo(p), ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(API, data=datos, method="POST", headers={
        "Authorization": f"Bearer {clave}", "Content-Type": "application/json"})
    for intento, espera in enumerate([1, 2, 4, 8, 16, 32]):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                resp = json.load(r)
            archivo.write_text(json.dumps(resp, ensure_ascii=False), encoding="utf-8")
            return resp
        except urllib.error.HTTPError as e:
            if e.code in (429, 529):           # límite de tasa o sobrecarga: reintentar con espera creciente
                time.sleep(espera)
                continue
            raise RuntimeError(f"{p['ean']}: HTTP {e.code} {e.read()[:300]!r}") from e
    raise RuntimeError(f"{p['ean']}: sin respuesta tras reintentos")


def resultado(resp: dict) -> dict:
    a = resp["answers"]
    return {
        "nova": int(a["nova"]["choice"].replace("nova", "")), "novaConfianza": round(a["nova"]["confidence"], 3),
        "categoria": a["categoria"]["choice"], "categoriaConfianza": round(a["categoria"]["confidence"], 3),
        "modelo": resp.get("model", MODELO),
    }


def correr(productos: list, clave: str, hilos: int = 4) -> dict:
    salida, errores, tokens = {}, [], 0
    with cf.ThreadPoolExecutor(hilos) as ex:
        futuros = {ex.submit(preguntar, p, clave): p for p in productos}
        for f in cf.as_completed(futuros):
            p = futuros[f]
            try:
                resp = f.result()
                salida[p["ean"]] = resultado(resp)
                tokens += (resp.get("usage") or {}).get("input_tokens", 0)
            except Exception as e:  # se informa y se sigue; el script es reanudable
                errores.append(str(e))
    print(f"Respuestas: {len(salida)}; errores: {len(errores)}; tokens de entrada: {tokens:,} (≈ USD {tokens * PRECIO_ENTRADA:.4f})")
    for e in errores[:5]:
        print("  error:", e)
    return salida


def main() -> int:
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--validar", type=int, metavar="N", help="compara Jev con el NOVA conocido en N productos")
    g.add_argument("--ejecutar", action="store_true", help="enriquece toda la base")
    a = ap.parse_args()
    productos = json.loads(BASE.read_text(encoding="utf-8"))["productos"]
    clave = os.environ.get("TYPESAFE_API_KEY", "")

    if not a.validar and not a.ejecutar:
        ejemplo = cuerpo(next(p for p in productos if p.get("ingredientes")))
        por_producto = [tokens_aprox(cuerpo(p)) for p in productos]
        total = sum(por_producto)
        print("SIMULACIÓN (no se envía nada). Ejemplo de petición:")
        print(json.dumps(ejemplo, ensure_ascii=False, indent=1)[:1800], "…")
        print(f"\nProductos: {len(productos)}; sin NOVA en OFF: {sum(1 for p in productos if not p.get('nova'))}")
        print(f"Tokens de entrada estimados: {total:,} (media {total / len(productos):.0f} por producto)")
        print(f"Costo estimado de toda la base: USD {total * PRECIO_ENTRADA:.4f}")
        print(f"Tiempo estimado a {FILAS_POR_SEGUNDO} filas/s: {len(productos) / FILAS_POR_SEGUNDO:.1f} s")
        media = total / len(productos)
        for n in (100_000, 1_000_000):
            print(f"  {n:>9,} productos: USD {n * media * PRECIO_ENTRADA:,.2f} y {n / FILAS_POR_SEGUNDO / 60:,.1f} min")
        print("\nPara ejecutar de verdad: defina TYPESAFE_API_KEY y use --validar 200 primero.")
        return 0

    if not clave:
        print("Falta la variable de entorno TYPESAFE_API_KEY (créela en console.typesafe.ai).", file=sys.stderr)
        return 1

    if a.validar:
        conocidos = [p for p in productos if p.get("nova")]
        muestra = random.Random(7).sample(conocidos, min(a.validar, len(conocidos)))
        res = correr(muestra, clave)
        pares = [(p["nova"], res[p["ean"]]) for p in muestra if p["ean"] in res]
        aciertos = sum(1 for real, r in pares if r["nova"] == real)
        seguros = [(real, r) for real, r in pares if r["novaConfianza"] >= UMBRAL_CONFIANZA]
        aciertos_seg = sum(1 for real, r in seguros if r["nova"] == real)
        print(f"Exactitud NOVA: {aciertos}/{len(pares)} = {aciertos / max(1, len(pares)):.1%}")
        print(f"Con confianza ≥ {UMBRAL_CONFIANZA}: {aciertos_seg}/{len(seguros)} = {aciertos_seg / max(1, len(seguros)):.1%} "
              f"(cobertura {len(seguros) / max(1, len(pares)):.1%})")
        return 0

    res = correr(productos, clave)
    SALIDA.write_text(json.dumps({
        "meta": {"modelo": MODELO, "fecha": dt.date.today().isoformat(), "umbral": UMBRAL_CONFIANZA,
                 "nota": "Estimaciones de IA sobre datos públicos de Open Food Facts; no son datos oficiales."},
        "productos": res,
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("Escrito:", SALIDA)
    return 0


if __name__ == "__main__":
    sys.exit(main())
