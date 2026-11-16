// Precio estimado por tamaño y categoría (₡ por 100 g o 100 ml). NO es un precio real:
// la interfaz lo muestra como «≈ estimado». Los precios reales vienen de las facturas y tiquetes de la persona.
// Calibrados con precios en línea verificados el 2026-11-13 (grupo Walmart, ver Comparador_diario/investigacion):
//   arroz 1,8 kg ₡1 430 → 79; arroz 4 kg ₡2 550–3 200 → 64–80; frijol 800 g ₡1 350–1 490 → 169–186;
//   galletas Oreo 432 g ₡1 750–2 000 → 405–463; sal 500 g ₡450–470 → 90–94.
// El resto es SUPUESTO y debe reemplazarse con precios reales.
import type { Precio, Producto } from './tipos';

export const TARIFAS: { categoria: string; porCien: number; calibrado: boolean }[] = [
  { categoria: 'en:rices', porCien: 75, calibrado: true },
  { categoria: 'en:beans', porCien: 175, calibrado: true },
  { categoria: 'en:legumes', porCien: 175, calibrado: true },
  { categoria: 'en:biscuits', porCien: 430, calibrado: true },
  { categoria: 'en:cookies', porCien: 430, calibrado: true },
  { categoria: 'en:salts', porCien: 90, calibrado: true },
  { categoria: 'en:chocolates', porCien: 700, calibrado: false },
  { categoria: 'en:confectioneries', porCien: 650, calibrado: false },
  { categoria: 'en:chips-and-fries', porCien: 500, calibrado: false },
  { categoria: 'en:salty-snacks', porCien: 500, calibrado: false },
  { categoria: 'en:breakfast-cereals', porCien: 400, calibrado: false },
  { categoria: 'en:cheeses', porCien: 600, calibrado: false },
  { categoria: 'en:sausages', porCien: 350, calibrado: false },
  { categoria: 'en:breads', porCien: 250, calibrado: false },
  { categoria: 'en:sauces', porCien: 250, calibrado: false },
  { categoria: 'en:condiments', porCien: 250, calibrado: false },
  { categoria: 'en:yogurts', porCien: 130, calibrado: false },
  { categoria: 'en:milks', porCien: 90, calibrado: false },
  { categoria: 'en:juices-and-nectars', porCien: 120, calibrado: false },
  { categoria: 'en:sodas', porCien: 80, calibrado: false },
  { categoria: 'en:beverages', porCien: 100, calibrado: false },
  { categoria: 'en:dairies', porCien: 150, calibrado: false },
  { categoria: 'en:snacks', porCien: 450, calibrado: false },
];
export const TARIFA_GENERAL = 300;     // SUPUESTO
export const TAMANO_TIPICO = 400;      // g o ml si el producto no declara tamaño (SUPUESTO)
export const VARIACION = 0.15;         // ± 15 % entre productos parecidos (SUPUESTO)

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export function tarifa(p: Producto): number {
  return TARIFAS.find(t => p.categorias.includes(t.categoria))?.porCien ?? TARIFA_GENERAL;
}

/** ≈ precio por tamaño y categoría, redondeado a ₡10 y nunca menor de ₡200. Fuente: «estimado». */
export function precioEstimado(p: Producto): Precio {
  const tam = p.cantidadNum && p.cantidadNum > 0 ? Math.min(p.cantidadNum, 5000) : TAMANO_TIPICO;
  const variacion = 1 - VARIACION + ((hash(p.ean) % 1000) / 1000) * 2 * VARIACION;
  const colones = Math.max(200, Math.round((tam / 100) * tarifa(p) * variacion / 10) * 10);
  return { colones, fuente: 'estimado' };
}
