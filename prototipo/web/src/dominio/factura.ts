// Lector del XML de la factura o tiquete electrónico de Hacienda (versiones 4.3 y 4.4).
// Solo se extraen las líneas de detalle, el total, el comercio y la fecha. Los datos del
// receptor (nombre, cédula, correo) nunca se leen ni se guardan (Ley 8968).
// Sin DOM: expresiones regulares, para que funcione igual en el navegador y en las pruebas.
import type { LineaTiquete, TiqueteLeido } from './tiquete';
import { TOLERANCIA_TOTAL } from './tiquete';

export interface FacturaLeida extends TiqueteLeido {
  tipo: string;            // FacturaElectronica, TiqueteElectronico, ...
  version?: string;        // 4.3, 4.4
  comercio?: string;
  fecha?: string;          // AAAA-MM-DD
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificar = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e]);

/** Contenido de la primera etiqueta <tag> (con o sin prefijo de espacio de nombres). */
function etiqueta(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`));
  return m ? decodificar(m[1].trim()) : undefined;
}
function bloques(xml: string, tag: string): string[] {
  return [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, 'g'))].map(m => m[1]);
}
const num = (s?: string) => (s === undefined ? NaN : Number(s.replace(',', '.')));

export const TIPOS_VALIDOS = ['FacturaElectronica', 'TiqueteElectronico', 'FacturaElectronicaCompra'];

export function leerFacturaXml(xml: string): FacturaLeida {
  const raiz = xml.match(/<(?:[\w-]+:)?(\w+)\b[^>]*xmlns(?::\w+)?="[^"]*comprobanteselectronicos[^"]*"/)?.[1]
    ?? xml.replace(/<\?xml[^>]*>/, '').match(/<(?:[\w-]+:)?(\w+)/)?.[1] ?? 'desconocido';
  if (raiz === 'MensajeHacienda') throw new Error('Este archivo es la respuesta de Hacienda, no la factura. Suba el XML de la factura.');
  if (!TIPOS_VALIDOS.includes(raiz)) throw new Error(`El archivo no es una factura ni un tiquete electrónico (es «${raiz}»).`);
  const version = xml.match(/xml-schemas\/v(\d\.\d)\//)?.[1];
  const emisor = etiqueta(xml, 'Emisor');
  const lineas: LineaTiquete[] = [];
  for (const b of bloques(xml, 'LineaDetalle')) {
    const descripcion = etiqueta(b, 'Detalle') ?? '';
    const cantidad = num(etiqueta(b, 'Cantidad'));
    const total = num(etiqueta(b, 'MontoTotalLinea'));
    // Código de barras: CodigoComercial con un código de 8, 12 o 13 dígitos (de preferencia tipo 03).
    const comerciales = bloques(b, 'CodigoComercial').map(c => ({ tipo: etiqueta(c, 'Tipo'), codigo: etiqueta(c, 'Codigo') ?? '' }));
    const ean = [...comerciales].sort((a, c) => (a.tipo === '03' ? -1 : 0) - (c.tipo === '03' ? -1 : 0))
      .find(c => /^(\d{8}|\d{12}|\d{13})$/.test(c.codigo))?.codigo;
    if (!descripcion || !Number.isFinite(total)) continue;
    lineas.push({ texto: descripcion, descripcion, cantidad: Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1, precio: total, codigo: ean });
  }
  const resumen = etiqueta(xml, 'ResumenFactura') ?? xml;
  const totalComprobante = num(etiqueta(resumen, 'TotalComprobante'));
  const sumaLineas = lineas.reduce((a, l) => a + l.precio, 0);
  const total = Number.isFinite(totalComprobante) ? totalComprobante : undefined;
  return {
    tipo: raiz, version,
    comercio: emisor ? (etiqueta(emisor, 'NombreComercial') ?? etiqueta(emisor, 'Nombre')) : undefined,
    fecha: etiqueta(xml, 'FechaEmision')?.slice(0, 10),
    texto: lineas.map(l => `${l.descripcion}  x${l.cantidad}  ${l.precio}`).join('\n'),
    lineas, total, sumaLineas, ignoradas: 0,
    cuadra: total === undefined ? undefined : Math.abs(total - sumaLineas) <= TOLERANCIA_TOTAL,
  };
}
