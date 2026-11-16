// Categoría visual de un producto (solo para el ícono de color; no afecta sellos ni cambios).
// Se usan íconos dibujados en la app, no fotos: las fotos de Open Food Facts obligarían a pedirlas a un tercero
// (revelaría la canasta y no funcionaría sin conexión) y las de bancos de imágenes tienen derechos.
import type { Producto } from './tipos';

/** «salsa» agrupa salsas y despensa (aceite, azúcar, condimentos). */
export type CategoriaVisual = 'lacteo' | 'bebida' | 'snack' | 'grano' | 'cereal' | 'salsa' | 'carne' | 'fruta' | 'verdura' | 'otro';

// Por categoría de Open Food Facts, de lo más específico a lo más general (la leche es bebida y lácteo: gana lácteo).
const POR_CATEGORIA: [CategoriaVisual, string[]][] = [
  ['lacteo', ['en:dairies', 'en:milks', 'en:yogurts', 'en:cheeses', 'en:fermented-milk-products', 'en:creams', 'en:ice-creams']],
  ['carne', ['en:meats', 'en:sausages', 'en:prepared-meats', 'en:fishes', 'en:seafood', 'en:canned-fishes']],
  ['snack', ['en:snacks', 'en:biscuits', 'en:cookies', 'en:confectioneries', 'en:chocolates', 'en:chips-and-fries', 'en:salty-snacks',
    'en:sweet-snacks', 'en:cakes', 'en:desserts', 'en:frozen-desserts', 'en:nuts']],
  ['cereal', ['en:breakfast-cereals', 'en:breads', 'en:flours']],
  ['grano', ['en:rices', 'en:beans', 'en:legumes', 'en:pastas', 'en:pulses']],
  ['salsa', ['en:sauces', 'en:condiments', 'en:spreads', 'en:dressings', 'en:salts', 'en:sweeteners', 'en:syrups', 'en:sugars',
    'en:honeys', 'en:fats', 'en:vegetable-oils', 'en:cooking-helpers', 'en:toppings']],
  ['bebida', ['en:beverages', 'en:sodas', 'en:juices-and-nectars', 'en:waters', 'en:plant-based-beverages', 'en:coffees', 'en:teas']],
  // Al final: un jugo o una mermelada de fruta ya quedaron como bebida o despensa.
  ['fruta', ['en:fruits', 'en:fresh-fruits', 'en:dried-fruits', 'en:frozen-fruits', 'en:canned-fruits', 'en:compotes']],
  ['verdura', ['en:vegetables', 'en:fresh-vegetables', 'en:canned-vegetables', 'en:frozen-vegetables', 'en:soups']],
];

// Por nombre (el 43 % de la base no trae categoría). Sin \b al lado de letras con tilde: en JavaScript \b no las
// ve como letras. Se usa «no hay letra antes» y, en palabras cortas, «no hay letra después».
const L = 'a-záéíóúñü';
const palabra = (s: string) => new RegExp(`(?<![${L}])(?:${s})`, 'i');
const FIN = `(?![${L}])`;
const inicio = (s: string) => new RegExp(`^\\s*(?:${s})`, 'i');
const POR_NOMBRE: [CategoriaVisual, RegExp][] = [
  ['salsa', palabra('peanut butter|mantequilla de man|crema de man|margarina|beurre')],
  ['snack', palabra(`chips|papas|tortiric|tosty|lays${FIN}|galleta|cookie|cracker|wafer|chocolate|confite|gomita|caramelo|campechana|palito|snack|queque|gelatin|protein bar|barra${FIN}|man[ií]${FIN}|almendra`)],
  ['carne', palabra('at[uú]n|sardina|salchich|jam[oó]n|mortadela|pollo|carne|tuna|chicken|chik|nugget|beef|chorizo|tocino|bacon|pescado')],
  ['lacteo', palabra('leche|lact|yogu?rt|yaourt|griego|queso|natilla|crema|mozzarella|cheese|milk|mantequilla|butter|helado|ice cream')],
  ['bebida', palabra(`refresco|jugo|bebida|agua${FIN}|eau${FIN}|gaseosa|caf[eé]|t[eé]${FIN}|n[eé]ctar|coca|cola${FIN}|soda|juice|drink|tropical|fruttal|ponche|suero|ginger ale|tea${FIN}|coffee|energ|hidrat|powerade|gatorade`)],
  ['cereal', palabra(`multicereal|cereal|avena|oats|pan${FIN}|harina|tortilla|rapiditas|flakes|hojuela|granola|pancake|waffle`)],
  ['grano', palabra(`arroz|frijol|lenteja|garbanzo|chickpea|semilla|ch[ií]a${FIN}|quinoa|linaza|pasta${FIN}|espagueti|spaghetti|macarr|fideo|noodle|ma[ií]z|rice${FIN}|beans`)],
  ['salsa', palabra(`salsa|sauce|heinz|mayonesa|ketchup|mostaza|mustard|aderezo|dressing|vinagre|vinaigrette|aceite|oil${FIN}|az[uú]car|sugar|sacarina|dulce molido|miel${FIN}|honey|syrup|jarabe|spread|mermelada|jalea|sal${FIN}|consom|caldo|condiment|especia`)],
  // Al final y solo si el nombre EMPIEZA con la fruta o la verdura: «Galleta sabor fresa» o «Tosh coco» no son fruta,
  // y «Jugo de naranja» o «Salsa de tomate» ya quedaron como bebida y despensa.
  ['fruta', inicio(`frutas?${FIN}|fruits?${FIN}|c[oó]ctel de frutas|banano|banana|manzana|naranja|mandarina|pi[ñn]a${FIN}|fresas?${FIN}|mango|uvas?${FIN}|pasas${FIN}|durazno|melocot|ciruela|ar[aá]ndano|coco${FIN}|guayaba|papaya|mel[oó]n|musk melon|sand[ií]a`)],
  ['verdura', inicio(`verduras?${FIN}|vegetales${FIN}|vegetables${FIN}|mouline de l[eé]gume|zanahoria|tomates?${FIN}|br[oó]coli|lechuga|espinaca|pepino|chile dulce|cebolla|elote|arveja|petit pois|guisante|vainica|ayote|chayote|palmito|sopa${FIN}|soup`)],
];

export function categoriaVisual(p: Pick<Producto, 'categorias' | 'nombre'>): CategoriaVisual {
  for (const [cat, tags] of POR_CATEGORIA) if (p.categorias.some(c => tags.includes(c))) return cat;
  for (const [cat, rx] of POR_NOMBRE) if (rx.test(p.nombre)) return cat;
  return 'otro';
}

/** «Buenos días», «Buenas tardes» o «Buenas noches» según la hora del teléfono. */
export function saludo(hora: number): string {
  return hora >= 5 && hora < 12 ? 'Buenos días' : hora >= 12 && hora < 19 ? 'Buenas tardes' : 'Buenas noches';
}
