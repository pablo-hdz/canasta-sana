// Motor de cambios con filtros de seguridad (RF-06, RF-07). Nunca propone «comprar menos»:
// cada cambio es siempre un producto por otro.
import type { Evaluacion, Precio, Producto, Sello } from './tipos';
import { colorantesDe } from './colorantes';
import { esPrecioReal, UMBRAL_IA } from './tipos';
import { evaluar, valorNutriente } from './ops';

export interface Perfil {
  alergenos: string[];   // etiquetas de Open Food Facts, p. ej. 'en:peanuts', 'en:milk', 'en:gluten'
  ninos: boolean;        // hay niños en el hogar
}
export const PERFIL_VACIO: Perfil = { alergenos: [], ninos: false };

export const MEJORA_MINIMA = 0.25;      // SUPUESTO: ≥ 25 % menos del nutriente crítico
export const TOLERANCIA_TAMANO = 0.20;  // SUPUESTO: tamaño ± 20 %
export const MAX_CAMBIOS = 3;

const RX_SUSTITUTO_SAL = /cloruro de potasio|potassium chloride|sal light|sal baja en sodio|sustituto de sal|salt substitute/i;
const ADITIVOS_POTASIO = new Set(['en:e508']);

export type MotivoRechazo =
  | 'mismo-producto' | 'categoria' | 'tamano' | 'sustituto-sal' | 'alergeno' | 'edulcorante-ninos'
  | 'datos-dudosos' | 'sello-nuevo' | 'sin-mejora' | 'mas-caro' | 'colorante-nuevo' | 'colorante-ninos';

export type Precios = (p: Producto) => Precio | undefined;

export interface Cambio {
  original: Producto;
  sugerido: Producto;
  sellosOriginal: Sello[];
  sellosSugerido: Sello[];
  precioOriginal?: Precio;
  precioSugerido?: Precio;
  precioConfirmado: boolean;   // ambos precios conocidos
  descripcion: string;         // «1 sello menos · ₡150 menos»
}

export function categoriaPrincipal(p: Producto): string | undefined {
  return p.categorias.length ? p.categorias[p.categorias.length - 1] : undefined;
}

export const MAX_FRECUENCIA_CATEGORIA = 0.15; // SUPUESTO: una categoría en más del 15 % de la base es genérica

export function frecuencias(base: Producto[]): Map<string, number> {
  const f = new Map<string, number>();
  for (const p of base) for (const c of p.categorias) f.set(c, (f.get(c) ?? 0) + 1);
  return f;
}

/** Categoría más específica del producto: la menos frecuente en la base que tenga al menos otro producto
 *  y no sea genérica. El orden de categories_tags de Open Food Facts no es fiable para esto. */
export function categoriaEspecifica(p: Producto, frec: Map<string, number>, totalBase: number): string | undefined {
  // Con menos de 50 productos la frecuencia no distingue lo genérico de lo específico.
  const tope = totalBase < 50 ? Infinity : MAX_FRECUENCIA_CATEGORIA * totalBase;
  return p.categorias
    .map((c, i) => ({ c, i, n: frec.get(c) ?? 0 }))
    .filter(x => x.n >= 2 && x.n <= tope)
    .sort((a, b) => a.n - b.n || b.i - a.i)[0]?.c; // empate: la que va más al final (más específica en OFF)
}

export function tamanoCompatible(a: Producto, b: Producto): boolean {
  if (!a.cantidadNum || !b.cantidadNum || !a.unidad || !b.unidad) return true; // sin dato: no bloquea
  if (a.unidad !== b.unidad) return false;
  return Math.abs(a.cantidadNum - b.cantidadNum) / Math.max(a.cantidadNum, b.cantidadNum) <= TOLERANCIA_TAMANO;
}

export function esSustitutoDeSal(p: Producto): boolean {
  return p.aditivos.some(a => ADITIVOS_POTASIO.has(a)) || RX_SUSTITUTO_SAL.test(p.ingredientes || '');
}

export function revisarCandidato(
  original: Producto, evalOriginal: Evaluacion, cand: Producto, perfil: Perfil, precios: Precios,
  categoria?: string,
): { ok: true; evalCand: Evaluacion } | { ok: false; motivo: MotivoRechazo } {
  if (cand.ean === original.ean) return { ok: false, motivo: 'mismo-producto' };
  const cat = categoria ?? categoriaPrincipal(original);
  if (!cat || !cand.categorias.includes(cat)) return { ok: false, motivo: 'categoria' };
  // Si Jev clasificó ambos productos con confianza, deben ser del mismo grupo de sustitutos.
  const io = original.ia, ic = cand.ia;
  if (io && ic && io.categoriaConfianza >= UMBRAL_IA && ic.categoriaConfianza >= UMBRAL_IA && io.categoria !== ic.categoria) {
    return { ok: false, motivo: 'categoria' };
  }
  if (!tamanoCompatible(original, cand)) return { ok: false, motivo: 'tamano' };
  // Filtros de seguridad: van antes que cualquier criterio de mejora o precio.
  if (esSustitutoDeSal(cand)) return { ok: false, motivo: 'sustituto-sal' };
  if (perfil.alergenos.some(a => cand.alergenos.includes(a))) return { ok: false, motivo: 'alergeno' };
  // Colorantes con advertencia o prohibidos en otros países (D-19): nunca uno que el original no tenía;
  // con niños en el hogar, ninguno. Sin datos de ingredientes no se puede saber y no se descarta (límite).
  const colorOriginal = new Set(colorantesDe(original).map(c => c.codigo));
  const colorCand = colorantesDe(cand);
  if (perfil.ninos && colorCand.length > 0) return { ok: false, motivo: 'colorante-ninos' };
  if (colorCand.some(c => !colorOriginal.has(c.codigo))) return { ok: false, motivo: 'colorante-nuevo' };
  const evalCand = evaluar(cand);
  if (perfil.ninos && evalCand.sellos.includes('edulcorantes')) return { ok: false, motivo: 'edulcorante-ninos' };
  // Sin datos completos no se puede afirmar que el candidato es mejor. Las grasas trans casi nunca
  // vienen en la etiqueta de Costa Rica, así que su falta no descarta (SUPUESTO, ver decisiones).
  const faltanCriticos = evalCand.aplica && evalCand.faltantes.some(f => f !== 'grasas trans');
  if (evalCand.datosDudosos || faltanCriticos) return { ok: false, motivo: 'datos-dudosos' };
  // Nunca introducir un sello que el original no tenía.
  if (evalCand.sellos.some(s => !evalOriginal.sellos.includes(s))) return { ok: false, motivo: 'sello-nuevo' };
  const menos = evalOriginal.sellos.length - evalCand.sellos.length;
  if (menos <= 0) {
    const critico = evalOriginal.sellos.find(s => s !== 'edulcorantes');
    const vo = critico ? valorNutriente(original, critico) : undefined;
    const vc = critico ? valorNutriente(cand, critico) : undefined;
    if (vo === undefined || vc === undefined || vo <= 0 || (vo - vc) / vo < MEJORA_MINIMA) return { ok: false, motivo: 'sin-mejora' };
  }
  const po = precios(original), pc = precios(cand);
  if (po && pc && pc.colones > po.colones) return { ok: false, motivo: 'mas-caro' };
  return { ok: true, evalCand };
}

const colones = (x: number) => '₡' + Math.round(x).toLocaleString('es-CR').replace(/[., ]/g, ' ');

function describir(menos: number, po?: Precio, pc?: Precio): string {
  const partes: string[] = [];
  partes.push(menos > 0 ? `${menos} ${menos === 1 ? 'sello' : 'sellos'} menos` : 'Menos del nutriente en exceso');
  if (po && pc) {
    const d = po.colones - pc.colones;
    const real = esPrecioReal(po) && esPrecioReal(pc);
    // Solo se afirma un ahorro con dos precios reales; si uno es estimado, se dice.
    partes.push(real ? (d > 0 ? `${colones(d)} menos` : 'mismo precio') : (d > 0 ? `≈ ${colones(d)} menos (estimado)` : '≈ mismo precio (estimado)'));
  } else partes.push('precio sin confirmar');
  return partes.join(' · ');
}

/** Hasta MAX_CAMBIOS cambios para la canasta, ordenados por mayor mejora y luego mayor ahorro. */
export function proponerCambios(canasta: Producto[], base: Producto[], perfil: Perfil, precios: Precios): Cambio[] {
  const usados = new Set<string>();
  const cambios: (Cambio & { menos: number; ahorro: number })[] = [];
  const universo = [...new Map([...base, ...canasta].map(p => [p.ean, p])).values()];
  const frec = frecuencias(universo);
  for (const original of canasta) {
    const eo = evaluar(original);
    if (!eo.aplica || eo.sellos.length === 0) continue;
    const cat = categoriaEspecifica(original, frec, universo.length);
    if (!cat) continue; // solo categorías genéricas: mejor ningún cambio que uno sin sentido
    let mejor: (Cambio & { menos: number; ahorro: number }) | undefined;
    for (const cand of base) {
      if (usados.has(cand.ean)) continue;
      const r = revisarCandidato(original, eo, cand, perfil, precios, cat);
      if (!r.ok) continue;
      const po = precios(original), pc = precios(cand);
      const menos = eo.sellos.length - r.evalCand.sellos.length;
      const ahorro = po && pc ? po.colones - pc.colones : 0;
      const c = {
        original, sugerido: cand, sellosOriginal: eo.sellos, sellosSugerido: r.evalCand.sellos,
        precioOriginal: po, precioSugerido: pc, precioConfirmado: esPrecioReal(po) && esPrecioReal(pc),
        descripcion: describir(menos, po, pc), menos, ahorro,
      };
      if (!mejor || c.menos > mejor.menos || (c.menos === mejor.menos && c.ahorro > mejor.ahorro)) mejor = c;
    }
    if (mejor) { cambios.push(mejor); usados.add(mejor.sugerido.ean); }
  }
  cambios.sort((a, b) => b.menos - a.menos || b.ahorro - a.ahorro);
  return cambios.slice(0, MAX_CAMBIOS).map(({ menos: _m, ahorro: _a, ...c }) => c);
}
