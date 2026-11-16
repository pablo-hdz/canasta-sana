// Productos que conviene sustituir (D-23): los empacados con sellos, de más sellos a menos. La app ya NO sugiere
// un producto específico: con datos incompletos, un cambio automático puede salir absurdo (caso real del
// 2026-11-14: «en vez de frijoles molidos, pruebe Nescafé»). La persona elige, con la etiqueta en la mano.
import type { Evaluacion, Producto, Sello } from './tipos';
import { ORDEN_SELLOS } from './tipos';

export interface ParaSustituir { producto: Producto; sellos: Sello[]; gasto: number; unidades: number }

/** Une el mismo producto (varias líneas) y ordena: más sellos primero; a igual número, más gasto primero. */
export function ordenarParaSustituir(lista: { producto: Producto; e: Evaluacion; precio: number; cantidad: number }[]): ParaSustituir[] {
  const porEan = new Map<string, ParaSustituir>();
  for (const x of lista) {
    if (!x.e.aplica || x.e.sellos.length === 0) continue;
    const previo = porEan.get(x.producto.ean);
    if (previo) { previo.gasto += x.precio; previo.unidades += x.cantidad; continue; }
    const sellos = [...x.e.sellos].sort((a, b) => ORDEN_SELLOS.indexOf(a) - ORDEN_SELLOS.indexOf(b));
    porEan.set(x.producto.ean, { producto: x.producto, sellos, gasto: x.precio, unidades: x.cantidad });
  }
  return [...porEan.values()].sort((a, b) =>
    b.sellos.length - a.sellos.length || b.gasto - a.gasto || a.producto.nombre.localeCompare(b.producto.nombre, 'es'));
}

const QUE_BUSCAR: Record<Sello, string> = {
  azucares: 'menos azúcar', sodio: 'menos sodio (sal)', saturadas: 'menos grasas saturadas', grasas: 'menos grasas',
  trans: 'sin grasas trans', edulcorantes: 'sin edulcorantes',
};

/** «Busque una opción con menos azúcar y menos sodio (sal).» según los sellos del producto. */
export function queBuscar(sellos: Sello[]): string {
  const partes = sellos.map(s => QUE_BUSCAR[s]);
  const lista = partes.length <= 1 ? partes.join('') : `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`;
  return `Busque una opción con ${lista}.`;
}
