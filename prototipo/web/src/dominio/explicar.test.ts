// Explicación de cada sello con números (dato del producto, umbral de la OPS y valor de este producto).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Producto } from './tipos';
import { evaluar } from './ops';
import { explicarSellos, numero } from './explicar';
import { prod } from './fabrica';

// Los espacios que no se parten (miles, «100 g», «10 %») se comparan como espacios normales.
const plano = (s?: string) => (s ?? '').replace(/[  ]/g, ' ');
const textos = (p: Producto) => explicarSellos(p).items.map(x => `${x.nutriente}: ${plano(x.texto)}${x.nota ? ` ${plano(x.nota)}` : ''}`);

describe('Explicación de los sellos', () => {
  it('sodio: dato por 100 g, umbral de 1 mg por caloría y cuánto tiene (850 / 265 = 3,2)', () => {
    const p = prod({ n: { kcal: 265, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 850 } });
    expect(evaluar(p).sellos).toEqual(['sodio']);
    const [x] = explicarSellos(p).items;
    expect(x.nutriente).toBe('Sodio');
    expect(plano(x.texto)).toBe('850 mg por 100 g. La OPS marca exceso desde 1 mg por cada caloría; este tiene 3,2 (850 mg en 265 calorías).');
    expect(x.valor).toBeCloseTo(850 / 265, 12);
    expect(x.umbral).toBe(1);
  });

  it('galleta rellena: azúcares libres estimados (75 % de 35 g), grasas y saturadas en % de las calorías', () => {
    const p = prod({ categorias: ['en:snacks', 'en:biscuits'], ingredientes: 'harina de trigo, azúcar, aceite de palma, cacao, sal, leche en polvo',
      n: { kcal: 480, azucares: 35, grasas: 20, saturadas: 9, trans: 0.2, sodioMg: 300 } });
    expect(textos(p)).toEqual([
      // 26,25 g × 4 = 105 kcal de 480 → 21,9 % ; 9 × 9 = 81 → 16,9 % ; 20 × 9 = 180 → 37,5 %
      'Azúcares libres: 26,3 g por 100 g. La OPS marca exceso desde el 10 % de las calorías; en este son el 22 % (26,3 g × 4 = 105 de 480 calorías). '
        + 'Estimados con el método de la OPS a partir de 35 g de azúcares totales: tiene leche o fruta en los ingredientes, se cuenta el 75 %.',
      'Grasas saturadas: 9 g por 100 g. La OPS marca exceso desde el 10 % de las calorías; en este son el 17 % (9 g × 9 = 81 de 480 calorías).',
      'Grasas totales: 20 g por 100 g. La OPS marca exceso desde el 30 % de las calorías; en este son el 38 % (20 g × 9 = 180 de 480 calorías).',
    ]);
  });

  it('bebida con 0 calorías: el sodio se explica sin dividir entre 0; los edulcorantes se nombran con su código', () => {
    const p = prod({ categorias: ['en:beverages'], unidad: 'ml', ingredientes: 'agua carbonatada, ácido cítrico', aditivos: ['en:e951', 'en:e950'],
      n: { kcal: 0, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 15 } });
    const t = textos(p);
    expect(t[0]).toBe('Sodio: 15 mg por 100 ml. La OPS marca exceso desde 1 mg por cada caloría; la etiqueta declara 0 calorías, así que cualquier cantidad cuenta como exceso.');
    expect(t[1]).toBe('Edulcorantes: Lleva aspartame (E951), acesulfame K (E950). La OPS pone este sello con cualquier cantidad de edulcorante.');
    expect(t.join(' ')).not.toMatch(/NaN|Infinity|undefined/);
  });

  it('edulcorante en el texto de ingredientes: palabra completa y sin repetir el que ya trae su código', () => {
    expect(textos(prod({ ingredientes: 'agua, sucralosa', n: { kcal: 2, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 1 } }))
      .find(t => t.startsWith('Edulcorantes'))).toContain('Lleva sucralosa.');
    expect(textos(prod({ ingredientes: 'agua, Sucralosa, glucósidos de esteviol', aditivos: ['en:e955'], n: { kcal: 2, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 1 } }))
      .find(t => t.startsWith('Edulcorantes'))).toContain('Lleva sucralosa (E955), esteviol.');
  });

  it('azúcares añadidos declarados y energía calculada con los macronutrientes: lo dice', () => {
    const p = prod({ n: { carbohidratos: 10, proteinas: 0, grasas: 0, saturadas: 0, trans: 0, azucares: 6, azucaresAnadidos: 5, sodioMg: 0 } });
    const r = explicarSellos(p);
    expect(r.items.map(x => x.sello)).toEqual(['azucares']);   // 5 × 4 = 20 de 40 kcal = 50 %
    expect(plano(r.items[0].texto)).toContain('en este son el 50 % (5 g × 4 = 20 de 40 calorías)');
    expect(r.items[0].nota).toBe('Son los azúcares añadidos que declara la etiqueta.');
    expect(r.nota).toMatch(/^Las calorías se calcularon/);
  });

  it('grasas trans pequeñas: dos decimales y el umbral de 1 %', () => {
    const p = prod({ n: { kcal: 500, azucares: 0, grasas: 10, saturadas: 1, trans: 0.6, sodioMg: 0 } });   // 0,6 × 9 = 5,4 de 500 = 1,08 %
    expect(textos(p).find(t => t.startsWith('Grasas trans'))).toBe('Grasas trans: 0,6 g por 100 g. La OPS marca exceso desde el 1 % de las calorías; en este son el 1 % (0,6 g × 9 = 5,4 de 500 calorías).');
  });

  it('B-01: con el factor de la OPS un nutriente puede dar algo más que la etiqueta: se dice el 100 %', () => {
    // Gaseosa de la base: 10,6 g × 4 = 42,4 calorías frente a 42 declaradas (101 %); antes decía «el 101 %».
    const p = prod({ categorias: ['en:beverages'], unidad: 'ml', ingredientes: 'agua carbonatada, azúcar',
      n: { kcal: 42, azucares: 10.6, carbohidratos: 10.6, proteinas: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 10 } });
    const r = explicarSellos(p).items.find(x => x.sello === 'azucares')!;
    expect(r.valor).toBe(1);
    expect(plano(r.texto)).toBe('10,6 g por 100 ml. La OPS marca exceso desde el 10 % de las calorías; en este son el 100 %: 10,6 g × 4 = 42,4 calorías, algo más que las 42 que declara la etiqueta (usa otros factores de cálculo).');
  });
  it('formato de Costa Rica: coma decimal y espacio de miles', () => {
    expect(plano(numero(1234.56))).toBe('1 234,6');
    expect(numero(3.2075)).toBe('3,2');
  });
});

// Segunda vía de comprobación: con la base real, cada sello tiene su explicación y el valor explicado
// supera el umbral (el redondeo de la pantalla nunca muestra un valor por debajo del umbral).
const ruta = fileURLToPath(new URL('../../public/datos/productos_cr.json', import.meta.url));
const base: Producto[] = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')).productos : [];
describe.skipIf(!base.length)(`Explicaciones contra la base real (${base.length} productos)`, () => {
  it('un texto por sello, valor ≥ umbral y sin NaN ni «undefined»', () => {
    let conSellos = 0, sellos = 0;
    const fallas: string[] = [];
    for (const p of base) {
      const e = evaluar(p);
      if (!e.sellos.length) continue;
      conSellos++; sellos += e.sellos.length;
      const r = explicarSellos(p, e.sellos);
      if (r.items.map(x => x.sello).join() !== e.sellos.join()) fallas.push(`${p.ean}: faltan explicaciones`);
      for (const x of r.items) {
        if (x.valor !== undefined && !(x.valor >= x.umbral!)) fallas.push(`${p.ean} ${x.sello}: ${x.valor} < ${x.umbral}`);
        // B-01: ningún nutriente pasa del 100 % de las calorías, ni en el valor ni en lo que se lee.
        const pct = plano(x.texto).match(/en este son el ([d ,]+) %/);
        if (x.sello !== 'sodio' && ((x.valor ?? 0) > 1 && x.valor !== Infinity)) fallas.push(`${p.ean} ${x.sello}: valor ${x.valor} > 1`);
        if (pct && Number(pct[1].replace(/ /g, '').replace(',', '.')) > 100) fallas.push(`${p.ean} ${x.sello}: ${pct[1]} % de las calorías`);
        if (/NaN|undefined|Infinity/.test(x.texto + (x.nota ?? ''))) fallas.push(`${p.ean} ${x.sello}: ${x.texto}`);
        // Lo que se lee en pantalla también queda en o sobre el umbral que se lee en pantalla.
        const m = plano(x.texto).match(/desde (?:el )?([\d,]+).*(?:este tiene|en este son el) ([\d ,]+)/);
        const leer = (s: string) => Number(s.replace(/ /g, '').replace(',', '.'));
        if (m && leer(m[2]) < leer(m[1])) fallas.push(`${p.ean} ${x.sello}: en pantalla ${m[2]} < ${m[1]}`);
      }
    }
    expect(fallas).toEqual([]);
    expect(conSellos).toBeGreaterThan(100);
    console.log(`Explicaciones: ${sellos} sellos en ${conSellos} productos, todos con su dato y su umbral.`);
  });
});
