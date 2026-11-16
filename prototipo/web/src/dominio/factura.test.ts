// XML de ejemplo con la estructura de Hacienda v4.4. Todos los datos son SIMULADO.
import { describe, expect, it } from 'vitest';
import { leerFacturaXml } from './factura';
import { precioEstimado } from './precios';
import { prod } from './fabrica';

const XML = `<?xml version="1.0" encoding="utf-8"?>
<FacturaElectronica xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/facturaElectronica">
  <Clave>50613112600310100000000100001010000000001100000001</Clave>
  <NumeroConsecutivo>00100001010000000001</NumeroConsecutivo>
  <FechaEmision>2026-11-13T10:32:00-06:00</FechaEmision>
  <Emisor><Nombre>SUPERMERCADO EJEMPLO S.A. (SIMULADO)</Nombre><NombreComercial>Súper Ejemplo</NombreComercial></Emisor>
  <Receptor><Nombre>PERSONA DE PRUEBA</Nombre><Identificacion><Tipo>01</Tipo><Numero>100000000</Numero></Identificacion></Receptor>
  <DetalleServicio>
    <LineaDetalle>
      <NumeroLinea>1</NumeroLinea><CodigoCABYS>2391100000000</CodigoCABYS>
      <CodigoComercial><Tipo>04</Tipo><Codigo>A-77</Codigo></CodigoComercial>
      <CodigoComercial><Tipo>03</Tipo><Codigo>7441003600102</Codigo></CodigoComercial>
      <Cantidad>2.000</Cantidad><UnidadMedida>Unid</UnidadMedida><Detalle>SAL SOL REFINADA 500 G</Detalle>
      <PrecioUnitario>450.00000</PrecioUnitario><MontoTotal>900.00000</MontoTotal><SubTotal>900.00000</SubTotal>
      <MontoTotalLinea>900.00000</MontoTotalLinea>
    </LineaDetalle>
    <LineaDetalle>
      <NumeroLinea>2</NumeroLinea><CodigoCABYS>2399999000000</CodigoCABYS>
      <Cantidad>1.000</Cantidad><UnidadMedida>Unid</UnidadMedida><Detalle>GALLETAS &amp; CREMA 432G</Detalle>
      <PrecioUnitario>1769.91150</PrecioUnitario><MontoTotalLinea>2000.00000</MontoTotalLinea>
    </LineaDetalle>
  </DetalleServicio>
  <ResumenFactura><TotalComprobante>2900.00000</TotalComprobante></ResumenFactura>
</FacturaElectronica>`;

describe('Factura electrónica (XML de Hacienda)', () => {
  it('lee líneas, cantidades, montos con impuesto, código de barras tipo 03, comercio, fecha y total', () => {
    const f = leerFacturaXml(XML);
    expect(f).toMatchObject({ tipo: 'FacturaElectronica', version: '4.4', comercio: 'Súper Ejemplo', fecha: '2026-11-13', total: 2900, cuadra: true });
    expect(f.lineas.map(l => [l.descripcion, l.cantidad, l.precio, l.codigo])).toEqual([
      ['SAL SOL REFINADA 500 G', 2, 900, '7441003600102'],
      ['GALLETAS & CREMA 432G', 1, 2000, undefined],
    ]);
  });
  it('nunca expone los datos del receptor', () => {
    expect(JSON.stringify(leerFacturaXml(XML))).not.toMatch(/PERSONA DE PRUEBA|100000000/);
  });
  it('rechaza la respuesta de Hacienda y otros documentos', () => {
    expect(() => leerFacturaXml('<MensajeHacienda xmlns="https://cdn.comprobanteselectronicos.go.cr/xml-schemas/v4.4/mensajeHacienda"/>')).toThrow(/respuesta de Hacienda/);
    expect(() => leerFacturaXml('<html><body>hola</body></html>')).toThrow(/no es una factura/);
  });
});

describe('Precio estimado', () => {
  it('escala con el tamaño y usa la tarifa calibrada: galletas 432 g ≈ ₡1 860 ± 15 %', () => {
    const g = prod({ ean: '7590011151110', categorias: ['en:snacks', 'en:biscuits'], cantidadNum: 432, unidad: 'g' });
    const p = precioEstimado(g);
    expect(p.fuente).toBe('estimado');
    expect(p.colones).toBeGreaterThanOrEqual(Math.floor(4.32 * 430 * 0.85 / 10) * 10);
    expect(p.colones).toBeLessThanOrEqual(Math.ceil(4.32 * 430 * 1.15 / 10) * 10);
  });
});
