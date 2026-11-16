// Identifica la línea del tiquete con un producto de la base (RF-02).
// Cascada: alias aprendido → coincidencia de palabras con abreviaturas y tamaño → si duda, código de barras.
import type { Producto } from './tipos';
import { digitoControl, eanValido } from './codigos';

export const UMBRAL_CONFIANZA = 0.75;   // SUPUESTO: por debajo se pide confirmar
export const MARGEN_MINIMO = 0.10;      // diferencia mínima con el segundo candidato

export const ABREVIATURAS: Record<string, string> = {
  DP: 'DOS PINOS', YOG: 'YOGURT', YOGUR: 'YOGURT', LECH: 'LECHE', SEMID: 'SEMIDESCREMADA', DESC: 'DESCREMADA',
  GALL: 'GALLETA', GALLET: 'GALLETA', RELL: 'RELLENA', CHOC: 'CHOCOLATE', SALCH: 'SALCHICHA', REFR: 'REFRESCO',
  BEB: 'BEBIDA', ARR: 'ARROZ', FRIJ: 'FRIJOL', MANT: 'MANTEQUILLA', MARG: 'MARGARINA', CER: 'CEREAL',
  JUG: 'JUGO', NAT: 'NATURAL', POLL: 'POLLO', INTEG: 'INTEGRAL', AZUC: 'AZUCAR', CAF: 'CAFE',
};
const VACIAS = new Set(['DE', 'CON', 'EN', 'LA', 'EL', 'Y', 'SABOR', 'A', 'AL', 'DEL', 'LOS', 'LAS', 'PARA']);

export function normalizar(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9.,]+/g, ' ').trim();
}

/** Tamaño en g o ml (p. ej. «1L» → 1000 ml, «1,8 KG» → 1800 g). */
export function tamano(s: string): { valor: number; unidad: 'g' | 'ml' } | undefined {
  const m = normalizar(s).match(/(\d+(?:[.,]\d+)?)\s*(KG|GR|G|LT|L|ML)\b/);
  if (!m) return undefined;
  const v = Number(m[1].replace(',', '.'));
  switch (m[2]) {
    case 'KG': return { valor: v * 1000, unidad: 'g' };
    case 'G': case 'GR': return { valor: v, unidad: 'g' };
    case 'L': case 'LT': return { valor: v * 1000, unidad: 'ml' };
    default: return { valor: v, unidad: 'ml' };
  }
}

function palabras(s: string): string[] {
  const t = normalizar(s).replace(/\d+(?:[.,]\d+)?\s*(KG|GR|G|LT|L|ML)\b/g, ' ');
  const out: string[] = [];
  for (const w of t.split(/\s+/)) {
    if (!w || VACIAS.has(w) || /^[\d.,]+$/.test(w)) continue;
    const exp = ABREVIATURAS[w];
    if (exp) out.push(...exp.split(' ')); else if (w.length >= 2) out.push(w);
  }
  return out;
}

const cache = new WeakMap<Producto, string[]>();
function palabrasProducto(p: Producto): string[] {
  let w = cache.get(p);
  if (!w) { w = palabras(`${p.nombre} ${p.marca}`); cache.set(p, w); }
  return w;
}

export function puntaje(linea: string, p: Producto): number {
  const wl = palabras(linea);
  if (!wl.length) return 0;
  const wp = palabrasProducto(p);
  const aciertos = wl.filter(w => wp.some(x => x === w || (w.length >= 3 && x.startsWith(w)))).length;
  let s = aciertos / wl.length;
  const tl = tamano(linea);
  if (tl && p.cantidadNum && p.unidad) {
    const igual = tl.unidad === p.unidad && Math.abs(tl.valor - p.cantidadNum) / Math.max(tl.valor, p.cantidadNum) <= 0.05;
    s += igual ? 0.2 : -0.3;
  }
  return Math.max(0, Math.min(1, s));
}

export interface Identificacion {
  producto?: Producto;
  confianza: number;
  metodo: 'codigo' | 'alias' | 'texto' | 'ninguno';
  candidatos: Producto[];
  dudoso: boolean;
}

/** Variantes del código, de la más probable a la menos:
 *  - 12 dígitos con dígito de control válido: UPC-A, que equivale a EAN-13 con un 0 delante;
 *  - 12 dígitos sin control válido: EAN-13 impreso SIN su dígito de control (así lo imprime Palí; tiquete real
 *    del 04/11/25), se le calcula.
 *  - 13 dígitos que empiezan con 0: también puede estar guardado como UPC-A. */
function variantes(codigo: string): string[] {
  if (codigo.length === 12) {
    const upc = ['0' + codigo, codigo], ean13 = codigo + digitoControl(codigo);
    return eanValido(codigo) ? [...upc, ean13] : [ean13, ...upc];
  }
  if (codigo.length === 13 && codigo.startsWith('0')) return [codigo, codigo.slice(1)];
  return [codigo];
}

export function identificar(linea: string, base: Producto[], alias: Record<string, string> = {}, codigo?: string): Identificacion {
  if (codigo) {
    let p: Producto | undefined;
    for (const v of variantes(codigo)) if ((p = base.find(x => x.ean === v))) break;
    if (p) return { producto: p, confianza: 1, metodo: 'codigo', candidatos: [p], dudoso: false };
  }
  const clave = normalizar(linea);
  const ean = alias[clave];
  if (ean) {
    const p = base.find(x => x.ean === ean);
    if (p) return { producto: p, confianza: 1, metodo: 'alias', candidatos: [p], dudoso: false };
  }
  const ranking = base.map(p => ({ p, s: puntaje(linea, p) })).filter(x => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
  if (!ranking.length) return { confianza: 0, metodo: 'ninguno', candidatos: [], dudoso: true };
  const [a, b] = ranking;
  // Si la línea trae un código y ese código no está en la base, el producto NO es ninguno de la base con ese código:
  // un parecido por texto puede ser otra marca (tiquete real de Palí: «LECHE POLV» con código de otra empresa
  // se tomaba como leche en polvo Dos Pinos). Se pregunta a la persona.
  const dudoso = !!codigo || a.s < UMBRAL_CONFIANZA || (b !== undefined && a.s - b.s < MARGEN_MINIMO);
  return { producto: a.p, confianza: a.s, metodo: 'texto', candidatos: ranking.map(x => x.p), dudoso };
}
