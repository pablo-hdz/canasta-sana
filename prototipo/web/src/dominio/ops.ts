// Modelo de perfil de nutrientes de la OPS (2016).
// Fuente verificada: documento oficial, sección IV «Criterios», págs. 18-19 (panel C)
// y método de azúcares libres (panel D, pág. 19); alcance en panel B (pág. 16) y punto 7 (pág. 17).
// Copia leída: instituciones.sld.cu/cirah/files/2016/02/OPS-Perfil-de-nutrientes-Modelo-convertido.pdf
import type { Evaluacion, Nutrientes, Producto, Sello } from './tipos';
import { ORDEN_SELLOS, UMBRAL_IA } from './tipos';
import { estimarNova } from './clasificar';

export const UMBRAL_REGLAS = 0.6; // confianza mínima de la estimación NOVA por reglas

export const UMBRALES = {
  sodioMgPorKcal: 1,          // ≥ 1 mg de sodio por 1 kcal
  azucaresLibresPct: 0.10,    // ≥ 10 % de la energía (g × 4 kcal)
  grasasPct: 0.30,            // ≥ 30 % de la energía (g × 9 kcal)
  saturadasPct: 0.10,         // ≥ 10 % de la energía (g × 9 kcal)
  transPct: 0.01,             // ≥ 1 % de la energía (g × 9 kcal)
} as const;

/** Factores de Atwater que usa el modelo para pasar gramos a kcal (panel C). */
export const KCAL_POR_G = { carbohidratos: 4, proteinas: 4, azucares: 4, grasas: 9 } as const;

// Control de calidad propio (SUPUESTO, no es parte del modelo OPS):
export const TOLERANCIA_ENERGIA = 0.20;
export const KCAL_MINIMA_CONTROL = 20;

const RX_AZUCAR = /az[uú]car|jarabe|sirope|glucosa|fructosa|sacarosa|dextrosa|\bmiel\b|melaza|panela|tapa de dulce|\bsugar|syrup/i;
const RX_LECHE = /\bleche|l[aá]cte|suero de leche|\byogu?r|\bnata\b|\bmilk|\bwhey/i;
const RX_FRUTA = /\bfruta|\bfresa|manzana|pi[ñn]a|banan|\bmango|naranja|\buva|durazno|melocot[oó]n|\bmora\b|\bpera\b|guayaba|maracuy[aá]|lim[oó]n|\bcoco\b|frambuesa|ar[aá]ndano|\bfruit/i;
const RX_EDULCORANTE = /sucralos|aspartam|acesulfam|stevi|estevi|esteviol|sacarina|ciclamat|sorbitol|xilitol|xylitol|eritritol|erythritol|maltitol|manitol|isomalt|lactitol|neotam|advantam|taumatina|fruta del monje|monk fruit/i;
// E-números de edulcorantes no calóricos y polialcoholes, con su nombre común (para explicar el sello).
const NOMBRE_EDULCORANTE: Record<string, string> = {
  'en:e420': 'sorbitol', 'en:e421': 'manitol', 'en:e950': 'acesulfame K', 'en:e951': 'aspartame', 'en:e952': 'ciclamato',
  'en:e953': 'isomalt', 'en:e954': 'sacarina', 'en:e955': 'sucralosa', 'en:e957': 'taumatina', 'en:e959': 'neohesperidina DC',
  'en:e960': 'glucósidos de esteviol', 'en:e960a': 'glucósidos de esteviol', 'en:e961': 'neotame', 'en:e962': 'sal de aspartame-acesulfame',
  'en:e964': 'jarabe de poliglicitol', 'en:e965': 'maltitol', 'en:e966': 'lactitol', 'en:e967': 'xilitol', 'en:e968': 'eritritol', 'en:e969': 'advantame',
};
const ADITIVOS_EDULCORANTES = new Set(Object.keys(NOMBRE_EDULCORANTE));

// Panel B y punto 7: sin procesar, mínimamente procesados, ingredientes culinarios y fórmulas infantiles.
const CATEGORIAS_FUERA = [
  'en:sugars', 'en:salts', 'en:vegetable-oils', 'en:olive-oils', 'en:honeys', 'en:butters', 'en:lards',
  'en:fresh-vegetables', 'en:fresh-fruits', 'en:rices', 'en:dried-legumes', 'en:beans', 'en:eggs',
  'en:fresh-meats', 'en:fish', 'en:waters', 'en:coffees', 'en:teas', 'en:plain-yogurts', 'en:flours',
  'en:baby-milks', 'en:infant-formulas', 'en:baby-foods',
];

const tiene = (p: Producto, cats: string[]) => p.categorias.some(c => cats.includes(c));

export function alcance(p: Producto): { aplica: boolean; estimado: boolean; motivo: string } {
  if (tiene(p, ['en:baby-milks', 'en:infant-formulas', 'en:baby-foods'])) {
    return { aplica: false, estimado: false, motivo: 'Alimento para usos especiales: fuera del modelo OPS' };
  }
  if (p.nova === 1) return { aplica: false, estimado: false, motivo: 'Sin procesar o mínimamente procesado (NOVA 1)' };
  if (p.nova === 2) return { aplica: false, estimado: false, motivo: 'Ingrediente culinario (NOVA 2)' };
  if (p.nova === 3 || p.nova === 4) return { aplica: true, estimado: false, motivo: `Producto ${p.nova === 3 ? 'procesado' : 'ultraprocesado'} (NOVA ${p.nova})` };
  // Sin NOVA en Open Food Facts: se usa la estimación de Jev si su confianza es suficiente.
  if (!p.nova && p.ia && p.ia.novaConfianza >= UMBRAL_IA) {
    const n = p.ia.nova;
    const pct = Math.round(p.ia.novaConfianza * 100);
    if (n === 1 || n === 2) return { aplica: false, estimado: true, motivo: `${n === 1 ? 'Sin procesar o mínimamente procesado' : 'Ingrediente culinario'} (NOVA ${n} estimado por IA, ${pct} % de confianza)` };
    if (n === 3 || n === 4) return { aplica: true, estimado: true, motivo: `Producto ${n === 3 ? 'procesado' : 'ultraprocesado'} (NOVA ${n} estimado por IA, ${pct} % de confianza)` };
  }
  // Sin NOVA: estimación con reglas, gratis y en el teléfono (D-16). Exactitud medida en nova.medicion.test.ts.
  if (!p.nova) {
    const est = estimarNova(p);
    if (est && est.confianza >= UMBRAL_REGLAS) {
      const tipo = { 1: 'Sin procesar o mínimamente procesado', 2: 'Ingrediente culinario', 3: 'Producto procesado', 4: 'Producto ultraprocesado' }[est.nova];
      return { aplica: est.nova >= 3, estimado: true, motivo: `${tipo} (NOVA ${est.nova} estimado: ${est.motivo})` };
    }
  }
  if (tiene(p, CATEGORIAS_FUERA)) return { aplica: false, estimado: true, motivo: 'Categoría fuera del modelo (sin dato NOVA)' };
  return { aplica: true, estimado: true, motivo: 'Se asume procesado (sin dato NOVA)' };
}

export function energia(n: Nutrientes): { kcal?: number; calculada: boolean } {
  if (n.kcal !== undefined) return { kcal: n.kcal, calculada: false };
  if (n.carbohidratos !== undefined && n.proteinas !== undefined && n.grasas !== undefined) {
    return { kcal: kcalDeMacros(n.carbohidratos, n.proteinas, n.grasas), calculada: true };
  }
  return { kcal: undefined, calculada: false };
}
const kcalDeMacros = (carbohidratos: number, proteinas: number, grasas: number) =>
  KCAL_POR_G.carbohidratos * carbohidratos + KCAL_POR_G.proteinas * proteinas + KCAL_POR_G.grasas * grasas;

/** Control propio: la energía declarada debe cuadrar con 4·carbohidratos + 4·proteínas + 9·grasas. */
export function datosDudosos(n: Nutrientes): boolean {
  if (n.kcal === undefined || n.carbohidratos === undefined || n.proteinas === undefined || n.grasas === undefined) return false;
  const calc = kcalDeMacros(n.carbohidratos, n.proteinas, n.grasas);
  if (Math.max(n.kcal, calc) < KCAL_MINIMA_CONTROL) return false;
  return Math.abs(n.kcal - calc) / Math.max(n.kcal, calc) > TOLERANCIA_ENERGIA;
}

// Control de energía (B-01, propio; rango SUPUESTO justificado): las kcal declaradas deben quedar entre el 70 % y el
// 130 % de 4·C + 4·P + 9·G. El margen cubre diferencias legítimas: fibra contada como carbohidrato a 4 kcal/g (aporta
// ≈ 2), polialcoholes (2,4 kcal/g), factores de Atwater específicos y redondeo de la etiqueta. Fuera de él, el dato es
// un error (porción en vez de 100 g, unidad, dígito de más): p. ej. una mayonesa con 5 kcal y 5,6 g de grasa.
// Más de 900 kcal por 100 g es imposible: la grasa, lo más energético, da 9 kcal/g.
// Se marca como dato dudoso y NO se recalcula con Atwater: no se sabe si lo malo son las kcal o un macronutriente,
// y recalcular podría dar un sello con el macronutriente equivocado. Mismo criterio que D-13.
export const ENERGIA_MIN = 0.7;
export const ENERGIA_MAX = 1.3;
export const KCAL_MAXIMA = 900;

export function energiaDudosa(n: Nutrientes): boolean {
  if (n.kcal === undefined) return false;
  if (n.kcal > KCAL_MAXIMA) return true;
  // Sin carbohidratos se usan los azúcares (son parte de ellos): la cuenta queda como mínimo.
  const carbohidratos = n.carbohidratos ?? n.azucares;
  const minimo = kcalDeMacros(carbohidratos ?? 0, n.proteinas ?? 0, n.grasas ?? 0);
  if (Math.max(n.kcal, minimo) < KCAL_MINIMA_CONTROL) return false;   // bebidas de 0 kcal y valores ínfimos
  if (n.kcal < ENERGIA_MIN * minimo) return true;                       // incluye kcal = 0 con macronutrientes
  const completo = n.carbohidratos !== undefined && n.proteinas !== undefined && n.grasas !== undefined;
  return completo && n.kcal > ENERGIA_MAX * minimo;
}

// Control de verosimilitud por nutriente (propio, no es parte del modelo OPS). Open Food Facts tiene
// errores de unidad: p. ej. sodio en mg anotado como g (×1000). Un dato dudoso no genera sello ni se grafica.
export const SODIO_IMPOSIBLE = 40000;   // mg/100 g: la sal pura tiene ≈ 39 300 mg de sodio
export const SODIO_REVISAR = 5000;      // mg/100 g: solo verosímil en sal, salsas, condimentos y caldos
const CATEGORIAS_SALADAS = ['en:salts', 'en:condiments', 'en:seasonings', 'en:sauces', 'en:soy-sauces', 'en:fish-sauces',
  'en:bouillon-cubes', 'en:broths', 'en:stocks', 'en:dehydrated-broths', 'en:soups-and-broths', 'en:spices'];

export type ClaveNutriente = 'sodio' | 'azucares' | 'grasas' | 'saturadas' | 'trans';

export function nutrienteDudoso(p: Producto, clave: ClaveNutriente): boolean {
  const n = p.n;
  switch (clave) {
    case 'sodio':
      if (n.sodioMg === undefined) return false;
      return n.sodioMg > SODIO_IMPOSIBLE || (n.sodioMg > SODIO_REVISAR && !p.categorias.some(c => CATEGORIAS_SALADAS.includes(c)));
    case 'azucares':
      return n.azucares !== undefined && (n.azucares > 100 || (n.carbohidratos !== undefined && n.azucares > n.carbohidratos + 0.5));
    case 'grasas':
      return n.grasas !== undefined && n.grasas > 100;
    case 'saturadas':
      return n.saturadas !== undefined && (n.saturadas > 100 || (n.grasas !== undefined && n.saturadas > n.grasas + 0.5));
    case 'trans':
      return n.trans !== undefined && (n.trans > 100 || (n.grasas !== undefined && n.trans > n.grasas + 0.5));
  }
}

/** Panel D: azúcares libres a partir de los azúcares totales declarados. */
export function azucaresLibres(p: Producto): { g?: number; metodo: string } {
  const total = p.n.azucares;
  if (total === undefined) return { g: undefined, metodo: 'Sin dato de azúcares' };
  if (total === 0) return { g: 0, metodo: '0 g de azúcares totales' };
  if (p.n.azucaresAnadidos !== undefined) return { g: p.n.azucaresAnadidos, metodo: 'Azúcares añadidos declarados' };
  const ing = p.ingredientes || '';
  if (!ing.trim()) return { g: total, metodo: 'Sin lista de ingredientes: 100 % del total (estimación conservadora)' };
  const conAzucar = RX_AZUCAR.test(ing);
  // Extensión propia (SUPUESTO): si la lista de ingredientes no tiene ningún azúcar, los azúcares son intrínsecos.
  if (!conAzucar) return { g: 0, metodo: 'Sin azúcares en los ingredientes: azúcares intrínsecos' };
  const esLacteo = p.categorias.some(c => /yogurt|milk|dairy|fermented|lacte/.test(c));
  const esFruta = p.categorias.some(c => /fruit|compote|jam|syrup/.test(c));
  if (esLacteo) return { g: total * 0.5, metodo: 'Leche o yogur con azúcar en los ingredientes: 50 %' };
  if (esFruta) return { g: total * 0.5, metodo: 'Fruta procesada con azúcar en los ingredientes: 50 %' };
  if (RX_LECHE.test(ing) || RX_FRUTA.test(ing)) return { g: total * 0.75, metodo: 'Tiene leche o fruta en los ingredientes: 75 %' };
  return { g: total, metodo: 'Grupo sin azúcares naturales: 100 %' };
}

export function tieneEdulcorantes(p: Producto): boolean {
  return p.aditivos.some(a => ADITIVOS_EDULCORANTES.has(a)) || RX_EDULCORANTE.test(p.ingredientes || '');
}

/** Qué edulcorantes se encontraron (palabra completa de los ingredientes y nombre del aditivo), sin repetir. */
export function edulcorantesEncontrados(p: Producto): string[] {
  const rx = new RegExp(String.raw`[\p{L}]*(?:${RX_EDULCORANTE.source})[\p{L}]*`, 'giu');
  const porTexto = [...(p.ingredientes || '').matchAll(rx)].map(m => m[0].toLowerCase());
  const porAditivo = p.aditivos.filter(a => ADITIVOS_EDULCORANTES.has(a)).map(a => `${NOMBRE_EDULCORANTE[a]} (${a.slice(3).toUpperCase()})`);
  const sinTilde = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const vistos = new Set<string>();
  const out: string[] = [];
  // Primero el aditivo (trae el código E); una palabra del texto que ya está en un aditivo no se repite.
  for (const x of [...porAditivo, ...porTexto]) {
    const raiz = sinTilde(x).replace(/ \(e\d+a?\)$/i, '').slice(0, 6);
    if (vistos.has(raiz)) continue;
    vistos.add(raiz); out.push(x);
  }
  return out;
}

/** ¿El nutriente cumple el criterio? Con energía 0 y nutriente > 0 la proporción es infinita: cumple (lectura literal del modelo). */
function supera(kcalNutriente: number, kcalTotal: number, pct: number): boolean {
  if (kcalNutriente <= 0) return false;
  if (kcalTotal <= 0) return true;
  return kcalNutriente >= pct * kcalTotal;
}

export function evaluar(p: Producto): Evaluacion {
  const a = alcance(p);
  const e = energia(p.n);
  const al = azucaresLibres(p);
  const base: Evaluacion = {
    aplica: a.aplica, motivo: a.motivo, alcanceEstimado: a.estimado, sellos: [], kcal: e.kcal,
    kcalCalculada: e.calculada, azucaresLibres: al.g, metodoAzucares: al.metodo, faltantes: [],
    datosDudosos: datosDudosos(p.n),
  };
  if (!a.aplica) return base;
  if (e.kcal === undefined) { base.faltantes.push('energía'); return base; }
  const kcal = e.kcal;
  const s = new Set<Sello>();
  const n = p.n;
  // Energía incoherente (B-01): todos los sellos de nutrientes dependen de ella; solo queda el de edulcorantes.
  if (!e.calculada && energiaDudosa(n)) {
    base.faltantes.push('energía (dato dudoso)');
    base.datosDudosos = true;
    if (tieneEdulcorantes(p)) base.sellos = ['edulcorantes'];
    return base;
  }
  const dudoso = (clave: ClaveNutriente, nombre: string) => {
    if (!nutrienteDudoso(p, clave)) return false;
    base.faltantes.push(`${nombre} (dato dudoso)`);
    base.datosDudosos = true;
    return true;
  };

  if (n.sodioMg === undefined) base.faltantes.push('sodio');
  else if (!dudoso('sodio', 'sodio') && n.sodioMg > 0 && (kcal <= 0 || n.sodioMg / kcal >= UMBRALES.sodioMgPorKcal)) s.add('sodio');

  if (al.g === undefined) base.faltantes.push('azúcares');
  else if (!dudoso('azucares', 'azúcares') && supera(al.g * KCAL_POR_G.azucares, kcal, UMBRALES.azucaresLibresPct)) s.add('azucares');

  if (n.grasas === undefined) base.faltantes.push('grasas totales');
  else if (!dudoso('grasas', 'grasas totales') && supera(n.grasas * KCAL_POR_G.grasas, kcal, UMBRALES.grasasPct)) s.add('grasas');

  if (n.saturadas === undefined) base.faltantes.push('grasas saturadas');
  else if (!dudoso('saturadas', 'grasas saturadas') && supera(n.saturadas * KCAL_POR_G.grasas, kcal, UMBRALES.saturadasPct)) s.add('saturadas');

  if (n.trans === undefined) base.faltantes.push('grasas trans');
  else if (!dudoso('trans', 'grasas trans') && supera(n.trans * KCAL_POR_G.grasas, kcal, UMBRALES.transPct)) s.add('trans');

  if (tieneEdulcorantes(p)) s.add('edulcorantes');

  base.sellos = ORDEN_SELLOS.filter(x => s.has(x));
  return base;
}

/** Valor del nutriente asociado a un sello, por 100 g/ml (para comparar cambios). */
export function valorNutriente(p: Producto, sello: Sello): number | undefined {
  switch (sello) {
    case 'azucares': return azucaresLibres(p).g;
    case 'sodio': return p.n.sodioMg;
    case 'saturadas': return p.n.saturadas;
    case 'grasas': return p.n.grasas;
    case 'trans': return p.n.trans;
    case 'edulcorantes': return undefined;
  }
}
