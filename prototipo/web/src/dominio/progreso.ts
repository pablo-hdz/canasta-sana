// Progreso mes a mes, solo en el teléfono. De cada compra real se guarda un resumen (sin la lista de productos):
// cuánto se gastó en empacados y cuánto de eso en productos con sellos.

export interface ResumenCompra {
  id: string;              // huella de fecha + total + líneas: la misma compra subida dos veces cuenta una vez
  fecha: string;           // AAAA-MM-DD
  comercio?: string;
  empacados: number;
  conSellos: number;
  gastoEmpacados: number;
  gastoConSellos: number;
  azucarG?: number;        // azúcares libres comprados (g)
  sodioMg?: number;
}

export interface Mes {
  mes: string;             // AAAA-MM
  compras: number;
  gastoEmpacados: number;
  gastoConSellos: number;
  pctConSellos?: number;   // % del gasto en empacados que fue en productos con sellos
  azucarG: number;
  sodioMg: number;
}

export const MAX_COMPRAS = 120;
export const UMBRAL_TENDENCIA = 5;   // puntos porcentuales: por debajo, «igual» (SUPUESTO)

export function idCompra(fecha: string, total: number, lineas: number): string {
  const s = `${fecha}|${Math.round(total)}|${lineas}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(36);
}

/** Agrega o reemplaza (misma huella) y conserva las MAX_COMPRAS más recientes, en orden de fecha. */
export function registrar(compras: ResumenCompra[], nueva: ResumenCompra): ResumenCompra[] {
  return [...compras.filter(c => c.id !== nueva.id), nueva]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .slice(-MAX_COMPRAS);
}

export function porMes(compras: ResumenCompra[]): Mes[] {
  const meses = new Map<string, Mes>();
  for (const c of compras) {
    const mes = c.fecha.slice(0, 7);
    const m = meses.get(mes) ?? { mes, compras: 0, gastoEmpacados: 0, gastoConSellos: 0, azucarG: 0, sodioMg: 0 };
    m.compras++;
    m.gastoEmpacados += c.gastoEmpacados;
    m.gastoConSellos += c.gastoConSellos;
    m.azucarG += c.azucarG ?? 0;
    m.sodioMg += c.sodioMg ?? 0;
    meses.set(mes, m);
  }
  return [...meses.values()]
    .map(m => ({ ...m, pctConSellos: m.gastoEmpacados > 0 ? (m.gastoConSellos / m.gastoEmpacados) * 100 : undefined }))
    .sort((a, b) => a.mes.localeCompare(b.mes));
}

export type Tendencia =
  | { estado: 'sin-datos' }
  | { estado: 'primer-mes'; actual: number }
  | { estado: 'mejora' | 'empeora' | 'igual'; actual: number; anterior: number; diferencia: number };

/** Compara los dos últimos meses con gasto en empacados. Menos % con sellos = mejora. */
export function tendencia(meses: Mes[]): Tendencia {
  const con = meses.filter(m => m.pctConSellos !== undefined);
  if (con.length === 0) return { estado: 'sin-datos' };
  const actual = con[con.length - 1].pctConSellos!;
  if (con.length === 1) return { estado: 'primer-mes', actual };
  const anterior = con[con.length - 2].pctConSellos!;
  const diferencia = actual - anterior;
  const estado = Math.abs(diferencia) < UMBRAL_TENDENCIA ? 'igual' : diferencia < 0 ? 'mejora' : 'empeora';
  return { estado, actual, anterior, diferencia };
}

const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sept.', 'oct.', 'nov.', 'dic.'];
export const nombreMes = (mes: string) => `${MESES[Number(mes.slice(5, 7)) - 1]} ${mes.slice(0, 4)}`;

// Nivel del % del gasto en empacados con sellos: más es peor, así que «alto» va en rojo (pedido de Pablo:
// en verde, un 100 % se sentía como un logro). Umbrales SUPUESTO, ajustables con datos reales.
export type Nivel = 'bajo' | 'medio' | 'alto';
export const UMBRAL_NIVEL_BAJO = 20;   // % (SUPUESTO)
export const UMBRAL_NIVEL_ALTO = 50;   // % (SUPUESTO)
export const nivelSellos = (pct: number): Nivel => (pct <= UMBRAL_NIVEL_BAJO ? 'bajo' : pct <= UMBRAL_NIVEL_ALTO ? 'medio' : 'alto');
export const TEXTO_NIVEL: Record<Nivel, string> = { bajo: 'Nivel bajo', medio: 'Nivel medio', alto: 'Nivel alto' };
