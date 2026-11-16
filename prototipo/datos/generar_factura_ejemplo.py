"""Genera una factura electrónica SIMULADO (estructura Hacienda v4.4) con productos reales de la base,
para probar la carga de facturas sin datos personales. Uso: python generar_factura_ejemplo.py"""
import json
import pathlib
import random

RAIZ = pathlib.Path(__file__).parent.parent
BASE = RAIZ / "web" / "public" / "datos" / "productos_cr.json"
SALIDA = RAIZ / "web" / "public" / "ejemplos" / "factura_simulada_v44.xml"
BUSCAR = ["en:biscuits", "en:sodas", "en:sausages", "en:breakfast-cereals", "en:yogurts", "en:sauces", "en:chips-and-fries", "en:juices-and-nectars"]
TARIFA = {"en:biscuits": 430, "en:sodas": 80, "en:sausages": 350, "en:breakfast-cereals": 400, "en:yogurts": 130,
          "en:sauces": 250, "en:chips-and-fries": 500, "en:juices-and-nectars": 120}


def esc(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def main() -> None:
    productos = json.loads(BASE.read_text(encoding="utf-8"))["productos"]
    rnd = random.Random(14)
    lineas = []
    for cat in BUSCAR:
        opciones = [p for p in productos if cat in p["categorias"] and len(p["ean"]) == 13 and p.get("cantidadNum") and "kcal" in p["n"]]
        if not opciones:
            continue
        p = rnd.choice(opciones)
        precio = max(300, round(p["cantidadNum"] / 100 * TARIFA[cat] * rnd.uniform(0.9, 1.1) / 10) * 10)
        lineas.append((p["ean"], p["nombre"].upper()[:40], 1 if rnd.random() > 0.25 else 2, precio))
    lineas.append(("", "BOLSA REUTILIZABLE", 1, 350))  # sin código y fuera de la base: queda en «¿Cuál es?»
    detalle, total = [], 0
    for i, (ean, desc, cant, unit) in enumerate(lineas, 1):
        monto = cant * unit
        total += monto
        cod = f"<CodigoComercial><Tipo>03</Tipo><Codigo>{ean}</Codigo></CodigoComercial>" if ean else ""
        detalle.append(
            f"    <LineaDetalle><NumeroLinea>{i}</NumeroLinea><CodigoCABYS>2399999000000</CodigoCABYS>{cod}"
            f"<Cantidad>{cant}.000</Cantidad><UnidadMedida>Unid</UnidadMedida><Detalle>{esc(desc)}</Detalle>"
            f"<PrecioUnitario>{unit:.5f}</PrecioUnitario><MontoTotalLinea>{monto:.5f}</MontoTotalLinea></LineaDetalle>")
    xml = "\n".join([
        '<?xml version="1.0" encoding="utf-8"?>',
        '<!-- Factura SIMULADO para pruebas: no es un comprobante real ni tiene validez tributaria. -->',
        '<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">',
        "  <Clave>00000000000000000000000000000000000000000000000000</Clave>",
        "  <FechaEmision>2026-11-14T09:15:00-06:00</FechaEmision>",
        "  <Emisor><Nombre>SUPERMERCADO EJEMPLO S.A.</Nombre><NombreComercial>Súper Ejemplo (SIMULADO)</NombreComercial></Emisor>",
        "  <Receptor><Nombre>PERSONA DE PRUEBA</Nombre></Receptor>",
        "  <DetalleServicio>", *detalle, "  </DetalleServicio>",
        f"  <ResumenFactura><TotalComprobante>{total:.5f}</TotalComprobante></ResumenFactura>",
        "</FacturaElectronica>",
    ])
    SALIDA.parent.mkdir(parents=True, exist_ok=True)
    SALIDA.write_text(xml, encoding="utf-8")
    print(f"{len(lineas)} líneas, total ₡{total:,}".replace(",", " "), "→", SALIDA)
    for l in lineas:
        print("  ", l)


if __name__ == "__main__":
    main()
