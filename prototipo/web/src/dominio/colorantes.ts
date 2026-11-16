// Colorantes con advertencia o prohibidos en otros países (D-19). Informativo: la app no dice «peligroso»,
// dice exactamente qué exige cada norma y con qué evidencia. En Costa Rica no se afirma nada (no verificado).
// Normas verificadas el 2026-11-14 con sus fuentes oficiales (enlaces en FUENTES).
import type { Producto } from './tipos';
import { ingredientesUtiles } from './clasificar';

export type Regla = 'advertencia-ue' | 'prohibido-ue' | 'retirado-eeuu';

export interface Colorante {
  codigo: string;   // número E (INS)
  nombre: string;   // nombre común en español
  regla: Regla;
  tag: string;      // etiqueta de aditivo en Open Food Facts
  texto: RegExp;    // cómo aparece en la lista de ingredientes (sin tildes, en minúscula)
}

// «5», «no. 5», «n° 5», «#5»; (?!\d) evita que «rojo 3» coincida con «rojo 30».
const N = (n: string) => `(?:n[o°º]?\\.?\\s*|#\\s*)?${n}(?!\\d)`;
const COD = (n: string) => `(?:e|ins)[\\s-]?${n}(?!\\d)`;

export const COLORANTES: Colorante[] = [
  { codigo: 'E102', nombre: 'tartrazina', regla: 'advertencia-ue', tag: 'en:e102',
    texto: new RegExp(`tartrazin|amarillo\\s*${N('5')}|yellow\\s*${N('5')}|${COD('102')}`) },
  { codigo: 'E104', nombre: 'amarillo de quinoleína', regla: 'advertencia-ue', tag: 'en:e104',
    texto: new RegExp(`quinolein|quinoline|${COD('104')}`) },
  { codigo: 'E110', nombre: 'amarillo ocaso', regla: 'advertencia-ue', tag: 'en:e110',
    texto: new RegExp(`amarillo\\s*ocaso|sunset\\s*yellow|amarillo\\s*${N('6')}|yellow\\s*${N('6')}|${COD('110')}`) },
  { codigo: 'E122', nombre: 'azorrubina (carmoisina)', regla: 'advertencia-ue', tag: 'en:e122',
    texto: new RegExp(`azorrubin|azorubin|carmoisin|${COD('122')}`) },
  { codigo: 'E124', nombre: 'rojo ponceau 4R', regla: 'advertencia-ue', tag: 'en:e124',
    texto: new RegExp(`ponceau|${COD('124')}`) },
  { codigo: 'E129', nombre: 'rojo allura (rojo 40)', regla: 'advertencia-ue', tag: 'en:e129',
    texto: new RegExp(`allura|rojo\\s*${N('40')}|red\\s*${N('40')}|${COD('129')}`) },
  { codigo: 'E171', nombre: 'dióxido de titanio', regla: 'prohibido-ue', tag: 'en:e171',
    texto: new RegExp(`dioxido\\s*de\\s*titanio|titanium\\s*dioxide|${COD('171')}`) },
  { codigo: 'E127', nombre: 'eritrosina (rojo 3)', regla: 'retirado-eeuu', tag: 'en:e127',
    texto: new RegExp(`eritrosin|erythrosin|rojo\\s*${N('3')}|red\\s*${N('3')}|${COD('127')}`) },
];

export const FUENTES: Record<Regla, { titulo: string; explicacion: string; norma: string; url: string }> = {
  'advertencia-ue': {
    titulo: 'Con advertencia en la Unión Europea',
    explicacion: 'En la Unión Europea, los alimentos con este colorante deben advertir en la etiqueta que «puede tener efectos negativos sobre la actividad y la atención de los niños» (desde 2010). La autoridad europea (EFSA) consideró que la evidencia es limitada: un efecto pequeño en algunos niños. No está prohibido.',
    norma: 'Reglamento (CE) 1333/2008, anexo V',
    url: 'https://www.legislation.gov.uk/eur/2008/1333/annex/V',
  },
  'prohibido-ue': {
    titulo: 'Prohibido en la Unión Europea',
    explicacion: 'La Unión Europea dejó de autorizarlo como aditivo de alimentos en 2022, porque la EFSA concluyó en 2021 que ya no se puede considerar seguro (no se pudo descartar que dañe el material genético).',
    norma: 'Reglamento (UE) 2022/63',
    url: 'https://eur-lex.europa.eu/eli/reg/2022/63/oj',
  },
  'retirado-eeuu': {
    titulo: 'Retirado en Estados Unidos',
    explicacion: 'La FDA de Estados Unidos revocó su autorización en alimentos el 15 de enero de 2025, con efecto desde el 15 de enero de 2027 (la ley prohíbe aditivos que causen cáncer en animales; se observó en ratas macho).',
    norma: 'FDA, revocación del FD&C Red No. 3',
    url: 'https://www.fda.gov/industry/color-additives/fdc-red-no-3',
  },
};

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Colorantes de la lista presentes en el producto: por su código de aditivo o por su nombre en los ingredientes.
 *  `ingredientesExtra` es texto leído por la persona con la cámara (se guarda solo en su teléfono). */
export function colorantesDe(p: Pick<Producto, 'aditivos' | 'ingredientes'>, ingredientesExtra = ''): Colorante[] {
  const aditivos = new Set((p.aditivos ?? []).map(a => a.toLowerCase()));
  const texto = sinTildes(`${p.ingredientes ?? ''}\n${ingredientesExtra}`);
  return COLORANTES.filter(c => aditivos.has(c.tag) || c.texto.test(texto));
}

/** ¿Parece de verdad una lista de ingredientes? No una tabla nutricional leída por OCR ni un texto de 1 letra.
 *  (Medido el 2026-11-14: un vocabulario de ingredientes no separa bien lo legible de lo ilegible; por eso la app
 *  además muestra el texto en que se basa y permite releerlo con una foto.) */
export const listaDeIngredientes = (texto: string) => texto.trim().length >= 8 && ingredientesUtiles(texto);

/** ¿Hay datos para decir «la etiqueta no declara»? Sin ellos, «no se encontró» no significa «no tiene». */
export function hayDatosDeIngredientes(p: Pick<Producto, 'aditivos' | 'ingredientes'>, ingredientesExtra = ''): boolean {
  return (p.aditivos?.length ?? 0) > 0 || listaDeIngredientes(p.ingredientes ?? '') || listaDeIngredientes(ingredientesExtra);
}

export const conAdvertencia = (cs: Colorante[]) => cs.length > 0;
