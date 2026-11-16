// Estimación del grado de procesamiento (NOVA) con reglas, gratis y dentro del teléfono (D-16).
// Se usa solo cuando Open Food Facts no trae el NOVA. Cascada, de la señal más fuerte a la más débil:
//   1) ingredientes y aditivos: marcadores de ultraprocesado (definición NOVA usada por la OPS, glosario);
//   2) categorías de Open Food Facts;
//   3) palabras del nombre del producto (español e inglés).
// La exactitud de cada nivel se mide contra los productos que sí traen NOVA (nova.medicion.test.ts).
import type { Producto } from './tipos';

export type FuenteNova = 'ingredientes' | 'categoria' | 'nombre';
export interface EstimacionNova { nova: 1 | 2 | 3 | 4; confianza: number; fuente: FuenteNova; motivo: string }

const sinAcentos = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

// 1) Marcadores de ultraprocesado: sustancias que no se usan en una cocina casera.
const MARCADORES_TEXTO: [RegExp, string][] = [
  [/SABORIZANTE|AROMATIZANTE|SABOR (ARTIFICIAL|IDENTICO|NATURAL Y ARTIFICIAL)|\bFLAVOU?R/, 'saborizantes'],
  [/COLORANTE|\bCOLOR(ING)?\b|AMARILLO \d|ROJO \d|TARTRAZINA|CARAMELO (IV|III|CLASE)/, 'colorantes'],
  [/EMULSIFICANTE|EMULSIONANTE|MONO ?Y ?DIGLICERIDOS|LECITINA|POLISORBATO|\bEMULSIFIER/, 'emulsificantes'],
  [/EDULCORANTE|SUCRALOSA|ASPARTAM|ACESULFAM|SACARINA|CICLAMATO|SORBITOL|MALTITOL|XILITOL|ERITRITOL|ESTEVI|STEVI/, 'edulcorantes'],
  [/JARABE DE (MAIZ|GLUCOSA|ALTA FRUCTOSA)|ALTA FRUCTOSA|MALTODEXTRINA|DEXTROSA|AZUCAR INVERTID|GLUCOSA[ -]FRUCTOSA|CORN SYRUP/, 'azúcares industriales'],
  [/PROTEINA (AISLADA|HIDROLIZADA|TEXTURIZADA)|AISLADO DE PROTEINA|CONCENTRADO DE PROTEINA|CASEINATO|SUERO DE LECHE EN POLVO|PROTEIN ISOLATE/, 'proteínas industriales'],
  [/ALMIDON MODIFICADO|MODIFIED STARCH|HIDROGENAD|INTERESTERIFICAD|GRASA VEGETAL (HIDROGENADA|FRACCIONADA)/, 'almidones o grasas modificados'],
  [/RESALTADOR DE SABOR|POTENCIADOR DEL SABOR|GLUTAMATO MONOSODICO|INOSINATO|GUANILATO/, 'resaltadores de sabor'],
  [/ESPESANTE|ESTABILIZANTE|GOMA XANTAN|CARRAGEN|CARBOXIMETILCELULOSA|GOMA GUAR|GELLAN/, 'espesantes o estabilizantes'],
];
// Aditivos (E) que delatan un ultraprocesado: colorantes, emulsificantes/espesantes, resaltadores,
// edulcorantes y otros de uso solo industrial. Conservantes y antioxidantes solos no bastan.
function aditivoMarcador(tag: string): boolean {
  const m = tag.match(/^en:e(\d{3,4})/);
  if (!m) return false;
  const n = Number(m[1]);
  return (n >= 100 && n < 200) || (n >= 400 && n < 500 && n !== 440) || (n >= 620 && n < 650) || (n >= 900 && n < 1000) || n >= 1400;
}

// 2) Categorías de Open Food Facts → NOVA. La primera coincidencia gana (las específicas van primero).
const POR_CATEGORIA: [string[], 1 | 2 | 3 | 4, number][] = [
  [['en:flavoured-milks', 'en:flavoured-yogurts', 'en:sweetened-yogurts', 'en:milkshakes', 'en:plant-based-milk-alternatives', 'en:soy-milks'], 4, 0.75],
  [['en:sodas', 'en:carbonated-drinks', 'en:sweetened-beverages', 'en:energy-drinks', 'en:sports-drinks', 'en:iced-teas', 'en:nectars', 'en:artificially-sweetened-beverages'], 4, 0.8],
  [['en:biscuits', 'en:cookies', 'en:biscuits-and-cakes', 'en:cakes', 'en:wafers', 'en:sweet-snacks', 'en:salty-snacks', 'en:chips-and-fries', 'en:crisps', 'en:appetizers', 'en:popcorn'], 4, 0.8],
  [['en:breakfast-cereals', 'en:candies', 'en:confectioneries', 'en:chocolates', 'en:ice-creams', 'en:desserts', 'en:instant-noodles', 'en:sausages', 'en:hams', 'en:cold-cuts', 'en:margarines', 'en:ketchup', 'en:mayonnaises', 'en:sweet-spreads', 'en:dressings'], 4, 0.75],
  [['en:cheeses', 'en:canned-vegetables', 'en:canned-fishes', 'en:canned-tunas', 'en:jams', 'en:pickles', 'en:refried-beans', 'en:canned-legumes'], 3, 0.7],
  // Ingredientes culinarios antes que «condimentos»: el vinagre está en ambas categorías.
  [['en:sugars', 'en:salts', 'en:vegetable-oils', 'en:olive-oils', 'en:honeys', 'en:butters', 'en:vinegars', 'en:lards'], 2, 0.85],
  [['en:breads', 'en:tortillas', 'en:sauces', 'en:condiments'], 4, 0.6],
  [['en:plain-yogurts', 'en:milks', 'en:rices', 'en:dried-legumes', 'en:pastas', 'en:flours', 'en:rolled-oats', 'en:oat-flakes', 'en:coffees', 'en:teas', 'en:eggs', 'en:waters', 'en:fresh-vegetables', 'en:fresh-fruits', 'en:fruit-juices'], 1, 0.7],
];

// Palabras del nombre que convierten cualquier producto en ultraprocesado: se revisan ANTES que la categoría
// (un «cappuccino» está en la categoría café, pero es una mezcla industrial).
const NOMBRE_ULTRA = /SABOR A|SABORIZAD|\bCERO\b|\bZERO\b|\bLIGHT\b|\bDIET\b|\+ ?PROTEINA|PROTEIN|CAPPUCC?INO|MOC?CA\b|MOKA|LATTE|3 EN 1|SPRAY/;

// 3) Nombre del producto.
const POR_NOMBRE: [RegExp, 1 | 2 | 3 | 4, number, string][] = [
  [/GASEOSA|REFRESCO|COCA|PEPSI|FANTA|SPRITE|\b7 ?UP|GINGER ALE|\bCOLA\b|TE FRIO|ICE ?TEA|ENERGIZANTE|POWER ?ADE|GATORADE|NECTAR|BEBIDA|\bHI-?C\b|TROPICAL\b/, 4, 0.75, 'bebida azucarada o saborizada'],
  [/GALLET|COOKIE|CRACKER|WAFER|BARQUILLO|SNACK|CHIPS|PAPAS (TOSTADAS|FRITAS)|TORTIRICAS|PLATANITOS|PALOMITAS|POPCORN|DORITOS|CHEETOS|PUFF/, 4, 0.75, 'galleta o bocadillo empacado'],
  [/CEREAL|FLAKES|CRUNCH|GRANOLA|CHOCOLATE|CHOCO|CONFITE|CARAMELO|GOMITA|CHICLE|BOMBON|HELADO|POSTRE|PUDIN|GELATINA|MALTEADA/, 4, 0.7, 'cereal de desayuno, dulce o postre'],
  [/SALCHICH|MORTADELA|JAMON|NUGGET|CHORIZO|SALAMI|BOLOGNA|INSTANTANE|MARUCHAN|RAMEN|SOPA INSTANT|KETCHUP|MAYONESA|MARGARINA|ADEREZO/, 4, 0.7, 'embutido, sopa instantánea o aderezo'],
  [/SALSA|CONSOME|CUBITO/, 4, 0.6, 'salsa o caldo industrial'],
  [/QUESO|\bPAN\b|TORTILLA|ATUN|SARDINA|MERMELADA|ENCURTID|FRIJOLES (MOLIDOS|REFRITOS)|NATILLA/, 3, 0.6, 'alimento procesado simple'],
  [/^(AZUCAR|SAL|ACEITE|MIEL|MANTEQUILLA|VINAGRE|MANTECA)\b|^OLIVE OIL|^VEGETABLE OIL/, 2, 0.75, 'ingrediente culinario'],
  // Sin procesar: solo lo que el panel B de la OPS nombra de forma explícita, y sin palabras que indiquen mezcla.
  [/^LECHE( (ENTERA|SEMI ?DESCREMADA|DESCREMADA|DESLACTOSADA|EN POLVO|AGRIA|DOS PINOS|PASTEURIZADA|UHT))+$/, 1, 0.7, 'leche simple (panel B de la OPS)'],
  [/^ARROZ( (BLANCO|INTEGRAL|PRECOCIDO|PARBOLIZADO|\d+ ?%|GRANO LARGO|ENTERO))*( [A-Z]+)?$/, 1, 0.7, 'arroz (panel B de la OPS)'],
  [/^FRIJOL(ES)? (ROJOS?|NEGROS?|BLANCOS?|TERCIOPELO|CUBA)$/, 1, 0.65, 'frijol seco (panel B de la OPS)'],
  [/^(AVENA (EN )?HOJUELAS?|AVENA (INTEGRAL|TRADICIONAL)|QUICK OATS|ROLLED OATS|OLD FASHIONED OATS)/, 1, 0.65, 'avena en hojuelas (panel B de la OPS)'],
  [/^(HUEVOS?|LENTEJAS?|GARBANZOS?|HARINA DE (TRIGO|MAIZ)|CAFE (MOLIDO|EN GRANO|TOSTADO)|AGUA (PURA|MINERAL|POTABLE|NATURAL))\b/, 1, 0.65, 'alimento sin procesar o mínimamente procesado (panel B de la OPS)'],
];
const NO_ES_SIMPLE = /EVAPORAD|CONDENSAD|COCO|ALMENDRA|SOYA|SABOR|CHOCOLATE|FRESA|VAINILLA|PROTEIN|FORTI|CAFE CON|CON |INSTANT|PREPARAD|MOLIDOS|REFRITOS|ENTEROS/;

/** Open Food Facts a veces guarda en «ingredientes» el OCR de la tabla nutricional: eso no sirve. */
export function ingredientesUtiles(texto: string): boolean {
  const t = sinAcentos(texto);
  if (!t.trim()) return false;
  if (/NUTRI(TION|CIONAL)|CALORI|KCAL|SERVING|PORCION|VALOR DIARIO|DAILY VALUE|TAMANO POR/.test(t)) return false;
  return t.includes(',') || t.length <= 60;
}

export function estimarNova(p: Producto): EstimacionNova | undefined {
  // 1) Ingredientes y aditivos (solo si el texto parece de verdad una lista de ingredientes)
  const ing = ingredientesUtiles(p.ingredientes || '') ? sinAcentos(p.ingredientes) : '';
  const marcadores = MARCADORES_TEXTO.filter(([rx]) => rx.test(ing)).map(([, n]) => n);
  if (p.aditivos.some(aditivoMarcador)) marcadores.push('aditivos de uso industrial');
  if (marcadores.length) return { nova: 4, confianza: marcadores.length >= 2 ? 0.9 : 0.8, fuente: 'ingredientes', motivo: `tiene ${[...new Set(marcadores)].join(', ')}` };
  if (ing.trim()) {
    const partes = ing.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    const anadidos = /AZUCAR|\bSAL\b|ACEITE|VINAGRE|MANTEQUILLA|MIEL/.test(ing);
    if (partes.length <= 1 && anadidos) return { nova: 2, confianza: 0.7, fuente: 'ingredientes', motivo: 'es un ingrediente culinario' };
    if (partes.length <= 1) return { nova: 1, confianza: 0.7, fuente: 'ingredientes', motivo: 'un solo ingrediente, sin añadidos' };
    if (anadidos && partes.length <= 6) return { nova: 3, confianza: 0.65, fuente: 'ingredientes', motivo: 'pocos ingredientes con azúcar, sal o aceite añadidos' };
  }
  const nombre = sinAcentos(p.nombre);
  if (NOMBRE_ULTRA.test(nombre)) return { nova: 4, confianza: 0.7, fuente: 'nombre', motivo: 'saborizado, «cero», «light», con proteína añadida o mezcla instantánea' };
  // 2) Categorías
  for (const [cats, nova, conf] of POR_CATEGORIA) {
    const c = p.categorias.find(x => cats.includes(x));
    if (c) return { nova, confianza: conf, fuente: 'categoria', motivo: `categoría «${c.replace('en:', '')}»` };
  }
  // 3) Nombre
  for (const [rx, nova, conf, motivo] of POR_NOMBRE) {
    if (!rx.test(nombre)) continue;
    if (nova === 1 && NO_ES_SIMPLE.test(nombre)) return undefined; // dudoso: mejor suponer procesado
    return { nova, confianza: conf, fuente: 'nombre', motivo };
  }
  return undefined;
}
