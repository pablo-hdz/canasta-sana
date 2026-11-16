// Explica cada sello con el dato del producto y el umbral del modelo OPS (RNF-06: cada sello se puede
// rastrear hasta su regla). Los umbrales y factores salen de ops.ts: aquí no se copia ningún número.
import type { Producto, Sello } from './tipos';
import { KCAL_POR_G, UMBRALES, azucaresLibres, edulcorantesEncontrados, energia, evaluar, valorNutriente } from './ops';

export interface ExplicacionSello {
  sello: Sello;
  nutriente: string;   // «Sodio»
  texto: string;       // dato del producto, umbral de la OPS y cuánto tiene este producto
  nota?: string;       // de dónde sale el dato (azúcares libres estimados)
  valor?: number;      // lo que se compara con el umbral: mg de sodio por kcal, o fracción de la energía
  umbral?: number;
}

export interface Explicaciones {
  items: ExplicacionSello[];
  nota?: string;       // aviso de todo el producto (energía calculada)
}

export const NOMBRE_NUTRIENTE: Record<Sello, string> = {
  azucares: 'Azúcares libres', sodio: 'Sodio', saturadas: 'Grasas saturadas', grasas: 'Grasas totales',
  trans: 'Grasas trans', edulcorantes: 'Edulcorantes',
};

/** Número en formato de Costa Rica: coma decimal y espacio de miles que no se parte en dos líneas. */
export function numero(x: number, decimales = 1): string {
  return x.toLocaleString('es-CR', { maximumFractionDigits: decimales }).replace(/[\s  ]/g, ' ');
}
/** Cifras según el tamaño: 2 decimales bajo 1, 1 decimal bajo 100 y enteros desde 100. */
const cifra = (x: number) => numero(x, Math.abs(x) >= 100 ? 0 : Math.abs(x) < 1 ? 2 : 1);
const porciento = (fraccion: number) => `${numero(fraccion * 100, 0)} %`;
const primeraMinuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Explicación de los sellos del producto (por defecto, los que da evaluar()). */
export function explicarSellos(p: Producto, sellos: Sello[] = evaluar(p).sellos): Explicaciones {
  const e = energia(p.n);
  const kcal = e.kcal;
  const por = p.unidad === 'ml' ? '100 ml' : '100 g';
  const sinCalorias = 'la etiqueta declara 0 calorías, así que cualquier cantidad cuenta como exceso';
  const items: ExplicacionSello[] = [];

  for (const sello of sellos) {
    const nutriente = NOMBRE_NUTRIENTE[sello];
    if (sello === 'edulcorantes') {
      const cuales = edulcorantesEncontrados(p);
      items.push({ sello, nutriente, texto: `${cuales.length ? `Lleva ${cuales.join(', ')}` : 'Lleva edulcorantes'}. La OPS pone este sello con cualquier cantidad de edulcorante.` });
      continue;
    }
    const g = valorNutriente(p, sello);
    if (g === undefined || kcal === undefined) continue;   // sin dato no hay sello: no debería pasar

    if (sello === 'sodio') {
      const umbral = UMBRALES.sodioMgPorKcal;
      const dato = `${cifra(g)} mg por ${por}. La OPS marca exceso desde ${numero(umbral)} mg por cada caloría`;
      if (kcal <= 0) { items.push({ sello, nutriente, texto: `${dato}; ${sinCalorias}.`, valor: Infinity, umbral }); continue; }
      const valor = g / kcal;
      items.push({ sello, nutriente, valor, umbral, texto: `${dato}; este tiene ${numero(valor)} (${cifra(g)} mg en ${cifra(kcal)} calorías).` });
      continue;
    }

    const umbral = sello === 'azucares' ? UMBRALES.azucaresLibresPct : sello === 'grasas' ? UMBRALES.grasasPct
      : sello === 'saturadas' ? UMBRALES.saturadasPct : UMBRALES.transPct;
    const factor = sello === 'azucares' ? KCAL_POR_G.azucares : KCAL_POR_G.grasas;
    const dato = `${cifra(g)} g por ${por}. La OPS marca exceso desde el ${porciento(umbral)} de las calorías`;
    const nota = sello === 'azucares' ? notaAzucares(p) : undefined;
    if (kcal <= 0) { items.push({ sello, nutriente, texto: `${dato}; ${sinCalorias}.`, nota, valor: Infinity, umbral }); continue; }
    const bruto = (g * factor) / kcal;
    // B-01: un nutriente no puede pasar del total. Con el factor de la OPS (9 o 4 kcal/g) a veces da algo más que las
    // calorías de la etiqueta, que usa sus propios factores (aceite: 100 g × 9 = 900 frente a 884): se dice el 100 %.
    // Las diferencias grandes ya no llegan aquí: energiaDudosa() las marca como dato dudoso y no dan sello.
    const valor = Math.min(bruto, 1);
    items.push({
      sello, nutriente, nota, valor, umbral,
      texto: bruto > 1
        ? `${dato}; en este son el 100 %: ${cifra(g)} g × ${factor} = ${cifra(g * factor)} calorías, algo más que las ${cifra(kcal)} que declara la etiqueta (usa otros factores de cálculo).`
        : `${dato}; en este son el ${porciento(valor)} (${cifra(g)} g × ${factor} = ${cifra(g * factor)} de ${cifra(kcal)} calorías).`,
    });
  }
  return { items, nota: e.calculada && items.some(x => x.valor !== undefined) ? 'Las calorías se calcularon con los carbohidratos, las proteínas y las grasas, porque la base no trae ese dato.' : undefined };
}

/** De dónde salen los azúcares libres (panel D de la OPS). */
function notaAzucares(p: Producto): string {
  const a = azucaresLibres(p);
  if (p.n.azucaresAnadidos !== undefined && a.g === p.n.azucaresAnadidos) return 'Son los azúcares añadidos que declara la etiqueta.';
  const total = p.n.azucares;
  // «Tiene leche o fruta en los ingredientes: 75 %» → «tiene leche o fruta en los ingredientes, se cuenta el 75 %»
  const metodo = primeraMinuscula(a.metodo).replace(/: (?=\d)/, ', se cuenta el ').replace(': ', ', ');
  return `Estimados con el método de la OPS a partir de ${total !== undefined ? `${cifra(total)} g de azúcares totales` : 'los azúcares totales'}: ${metodo}.`;
}
