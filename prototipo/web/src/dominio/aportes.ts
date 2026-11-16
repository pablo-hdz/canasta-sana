// ¿De dónde viene el azúcar, el sodio o la grasa de la compra? Cantidad comprada por producto:
// nutriente por 100 g/ml × (tamaño del empaque / 100) × unidades. Es la compra del hogar, no lo que come una persona.
import type { Producto } from './tipos';
import { azucaresLibres, nutrienteDudoso } from './ops';
import { tamano } from './identificar';

export type NutrienteGrafico = 'azucares' | 'sodio' | 'saturadas' | 'grasas';

export const NUTRIENTES_GRAFICO: { clave: NutrienteGrafico; nombre: string; unidad: 'g' | 'mg' }[] = [
  { clave: 'azucares', nombre: 'Azúcares', unidad: 'g' },
  { clave: 'sodio', nombre: 'Sodio', unidad: 'mg' },
  { clave: 'saturadas', nombre: 'Grasas saturadas', unidad: 'g' },
  { clave: 'grasas', nombre: 'Grasas totales', unidad: 'g' },
];

export const GRAMOS_POR_CUCHARADITA = 4;   // SUPUESTO: 1 cucharadita de azúcar ≈ 4 g (equivalencia usual de la OMS)
export const SAL_POR_SODIO = 2.5;          // sal (g) = sodio (g) × 2,5

/** B-23: tamaño impreso en la línea del tiquete («CAPPU VAINI CO 281ML», «TOSH 28,5G»). */
export interface TamanoTiquete { valor: number; unidad: 'g' | 'ml' }
export interface LineaCompra { producto: Producto; unidades: number; tamanoTiquete?: TamanoTiquete }
/** `tamano` y `unidadTamano`: el tamaño del empaque que se usó. `delTiquete`: true si la base no lo tenía y se leyó del tiquete. */
export interface Aporte { producto: Producto; unidades: number; porCien: number; valor: number; tamano: number; unidadTamano?: 'g' | 'ml'; delTiquete: boolean }
export interface Aportes { aportes: Aporte[]; total: number; sinTamano: Producto[]; sinDato: Producto[] }

const TAMANO_MAXIMO = 25_000;   // SUPUESTO: más de 25 kg o 25 l en una línea no es un empaque de súper; se descarta

/** Tamaño claro de la línea del tiquete, o undefined si no lo hay o es dudoso:
 *  - solo con unidad g, kg, ml o l («25 PAQ» o «80» sin unidad no son tamaño);
 *  - no en paquetes múltiples («6X200ML»): el total depende de cuántas unidades trae y no se adivina;
 *  - no si hay dos tamaños distintos en la misma línea;
 *  - no si el número parece de miles en g o ml («1.000ML» puede ser 1 ml o 1000 ml). */
export function tamanoDelTiquete(descripcion: string): TamanoTiquete | undefined {
  const d = descripcion.toUpperCase();
  if (/\d\s*X\s*\d/.test(d)) return undefined;
  const tamanos = d.match(/\d+(?:[.,]\d+)?\s*(?:KG|GR|G|LT|L|ML)\b/g) ?? [];
  if (tamanos.length !== 1) return undefined;
  if (/\d[.,]\d{3}\s*(?:GR|G|ML)\b/.test(d)) return undefined;
  const t = tamano(d);
  if (!t || !(t.valor > 0) || t.valor > TAMANO_MAXIMO) return undefined;
  return t;
}

function porCien(p: Producto, n: NutrienteGrafico): number | undefined {
  if (nutrienteDudoso(p, n)) return undefined;   // un dato con error de unidad no se grafica
  switch (n) {
    case 'azucares': return azucaresLibres(p).g;   // azúcares libres (panel D de la OPS)
    case 'sodio': return p.n.sodioMg;
    case 'saturadas': return p.n.saturadas;
    case 'grasas': return p.n.grasas;
  }
}

/** Si la base tiene el tamaño del empaque, manda la base; si no, se usa el tamaño leído del tiquete (B-23). */
export function aportes(compra: LineaCompra[], n: NutrienteGrafico): Aportes {
  const lista: Aporte[] = [];
  const sinTamano: Producto[] = [];
  const sinDato: Producto[] = [];
  for (const { producto, unidades, tamanoTiquete } of compra) {
    const pc = porCien(producto, n);
    if (pc === undefined) { sinDato.push(producto); continue; }
    const deBase = producto.cantidadNum && producto.cantidadNum > 0 ? producto.cantidadNum : undefined;
    const tam = deBase ?? (tamanoTiquete && tamanoTiquete.valor > 0 ? tamanoTiquete.valor : undefined);
    if (!tam) { sinTamano.push(producto); continue; }
    const valor = pc * (tam / 100) * unidades;
    if (valor > 0) lista.push({ producto, unidades, porCien: pc, valor, tamano: tam,
      unidadTamano: deBase ? producto.unidad ?? undefined : tamanoTiquete!.unidad, delTiquete: !deBase });
  }
  lista.sort((a, b) => b.valor - a.valor);
  return { aportes: lista, total: lista.reduce((s, a) => s + a.valor, 0), sinTamano, sinDato };
}

const numero = (x: number) => x.toLocaleString('es-CR', { maximumFractionDigits: 1 });
/** Tamaño del empaque: el texto de la base, o el leído del tiquete dicho con todas las letras (B-23). */
export function textoTamano(a: Aporte): string {
  const t = a.tamano >= 1000 && a.unidadTamano ? `${numero(a.tamano / 1000)} ${a.unidadTamano === 'g' ? 'kg' : 'l'}` : `${numero(a.tamano)} ${a.unidadTamano ?? ''}`.trim();
  return a.delTiquete ? `${t} (tamaño leído del tiquete)` : a.producto.cantidad || t;
}

/** Equivalencia fácil de entender: cucharaditas de azúcar o gramos de sal. */
/** B-33: nunca «≈ 0»: por debajo de 1 cucharadita o de 1 g de sal dice «menos de 1…»; sin cantidad, nada. */
export function equivalencia(n: NutrienteGrafico, total: number): string | undefined {
  if (!(total > 0)) return undefined;
  if (n === 'azucares') {
    const c = total / GRAMOS_POR_CUCHARADITA;
    if (c < 1) return 'menos de 1 cucharadita de azúcar';
    const r = Math.round(c);
    return `≈ ${r} ${r === 1 ? 'cucharadita' : 'cucharaditas'} de azúcar`;
  }
  if (n === 'sodio') {
    const sal = total / 1000 * SAL_POR_SODIO;
    if (sal < 1) return 'menos de 1 g de sal';
    return `≈ ${sal.toLocaleString('es-CR', { maximumFractionDigits: 1 })} g de sal`;
  }
  return undefined;
}
