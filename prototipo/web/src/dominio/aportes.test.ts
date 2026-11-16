import { describe, expect, it } from 'vitest';
import { aportes, equivalencia, tamanoDelTiquete, textoTamano } from './aportes';
import { prod } from './fabrica';

const gaseosa = prod({ ean: 'G', nombre: 'Gaseosa 3 L', cantidadNum: 3000, unidad: 'ml', ingredientes: 'agua, azúcar',
  categorias: ['en:sodas'], n: { kcal: 42, azucares: 10.6, sodioMg: 10, grasas: 0, saturadas: 0 } });
const galleta = prod({ ean: 'K', nombre: 'Galletas 432 g', cantidadNum: 432, unidad: 'g',
  ingredientes: 'harina, azúcar, aceite, leche', n: { kcal: 480, azucares: 35, sodioMg: 300, grasas: 20, saturadas: 9 } });
const sinTam = prod({ ean: 'S', nombre: 'Sin tamaño', n: { azucares: 5 }, ingredientes: 'azúcar' });

describe('De dónde viene cada nutriente en la compra', () => {
  it('azúcares: gaseosa 10,6 × 30 = 318 g; galletas 35 × 0,75 × 4,32 × 2 = 226,8 g; ordena de mayor a menor', () => {
    const r = aportes([{ producto: galleta, unidades: 2 }, { producto: gaseosa, unidades: 1 }, { producto: sinTam, unidades: 1 }], 'azucares');
    expect(r.aportes.map(a => [a.producto.ean, Number(a.valor.toFixed(1))])).toEqual([['G', 318], ['K', 226.8]]);
    expect(r.total).toBeCloseTo(544.8, 6);
    expect(r.sinTamano.map(p => p.ean)).toEqual(['S']);
    expect(equivalencia('azucares', r.total)).toBe('≈ 136 cucharaditas de azúcar');
  });
  it('sodio en mg y su equivalente en sal: (300 × 4,32 + 10 × 30) mg = 1596 mg ≈ 4 g de sal', () => {
    const r = aportes([{ producto: galleta, unidades: 1 }, { producto: gaseosa, unidades: 1 }], 'sodio');
    expect(r.total).toBeCloseTo(1596, 6);
    expect(equivalencia('sodio', r.total)).toBe('≈ 4 g de sal');
  });
  it('un producto sin el dato del nutriente se reporta aparte, no como cero', () => {
    const r = aportes([{ producto: prod({ ean: 'X', cantidadNum: 100, n: {} }), unidades: 1 }], 'saturadas');
    expect(r.aportes).toEqual([]);
    expect(r.sinDato.map(p => p.ean)).toEqual(['X']);
  });
});

describe('B-23: tamaño impreso en el tiquete cuando la base no lo trae', () => {
  it.each([
    // Líneas del ejemplo SIMULADO (src/casos/ejemplo-SIMULADO.json)
    ['CAPPU VAINI CO 281ML', { valor: 281, unidad: 'ml' }],
    ['TOSH 28,5G', { valor: 28.5, unidad: 'g' }],
    ['YOGUR BIO DEFEN DP', undefined],
    ['GUAVA JAM SW', undefined],
    // Tamaños con kg y l
    ['LECHE SEMID DP 1L', { valor: 1000, unidad: 'ml' }],
    ['ARROZ 99% 1,8KG', { valor: 1800, unidad: 'g' }],
    // No son tamaño o no es claro
    ['BOLSA BASURA 25 PAQ', undefined],
    ['GALL MARIA 80', undefined],
    ['JUGO NARAN 6X200ML', undefined],        // paquete múltiple: el total no se adivina
    ['AGUA CRISTAL 1.000ML', undefined],      // ¿1 ml o 1000 ml?
    ['VITAMINA C 500MG', undefined],          // mg no es tamaño de empaque
    ['REFR 2L + VASO 300ML', undefined],      // dos tamaños distintos
  ])('«%s»', (linea, esperado) => {
    expect(tamanoDelTiquete(linea)).toEqual(esperado);
  });

  const yogurt = prod({ ean: 'Y', nombre: 'Yogurt Bio Defensa', ingredientes: 'leche, azúcar', n: { azucares: 12, sodioMg: 50 } });
  it('sin tamaño en la base, usa el del tiquete y lo dice: sodio 50 mg × 281 / 100 × 2 = 281 mg', () => {
    const r = aportes([{ producto: yogurt, unidades: 2, tamanoTiquete: tamanoDelTiquete('YOGUR BIO DEFEN DP 281ML') }], 'sodio');
    expect(r.sinTamano).toEqual([]);
    expect(r.aportes[0]).toMatchObject({ tamano: 281, unidadTamano: 'ml', delTiquete: true });
    expect(r.aportes[0].valor).toBeCloseTo(50 * 2.81 * 2, 9);
    expect(textoTamano(r.aportes[0])).toBe('281 ml (tamaño leído del tiquete)');
  });
  it('kg y l se muestran con su unidad: 1,8 kg (tamaño leído del tiquete)', () => {
    const r = aportes([{ producto: yogurt, unidades: 1, tamanoTiquete: tamanoDelTiquete('ARROZ 1,8KG') }], 'sodio');
    expect(textoTamano(r.aportes[0])).toBe('1,8 kg (tamaño leído del tiquete)');
  });
  it('si la base tiene tamaño, manda la base aunque el tiquete diga otro', () => {
    const r = aportes([{ producto: galleta, unidades: 1, tamanoTiquete: tamanoDelTiquete('GALL 500G') }], 'sodio');
    expect(r.aportes[0]).toMatchObject({ tamano: 432, unidadTamano: 'g', delTiquete: false });
    expect(r.total).toBeCloseTo(300 * 4.32, 9);
    expect(textoTamano(r.aportes[0])).not.toContain('tiquete');
  });
  it('sin tamaño en la base ni en el tiquete, sigue fuera del gráfico', () => {
    const r = aportes([{ producto: yogurt, unidades: 1, tamanoTiquete: tamanoDelTiquete('GALL MARIA 80') }], 'sodio');
    expect(r.aportes).toEqual([]);
    expect(r.sinTamano.map(p => p.ean)).toEqual(['Y']);
  });
});

describe('B-33: la equivalencia nunca dice «≈ 0»', () => {
  it.each([
    ['azucares', 1, 'menos de 1 cucharadita de azúcar'],     // 1 g = 0,25 cucharaditas (el caso visto en el ejemplo)
    ['azucares', 3.9, 'menos de 1 cucharadita de azúcar'],
    ['azucares', 4, '≈ 1 cucharadita de azúcar'],
    ['azucares', 9, '≈ 2 cucharaditas de azúcar'],
    ['sodio', 20, 'menos de 1 g de sal'],                     // 20 mg × 2,5 = 0,05 g
    ['sodio', 399, 'menos de 1 g de sal'],                    // 0,9975 g
    ['sodio', 400, '≈ 1 g de sal'],
    ['sodio', 520, '≈ 1,3 g de sal'],
  ] as const)('%s %s → «%s»', (n, total, texto) => {
    expect(equivalencia(n, total)).toBe(texto);
  });
  it('sin cantidad no hay equivalencia, y ningún valor chico da «≈ 0»', () => {
    expect(equivalencia('azucares', 0)).toBeUndefined();
    expect(equivalencia('sodio', 0)).toBeUndefined();
    for (const x of [0.01, 0.1, 0.5, 1, 1.9, 2, 3.99, 10, 100, 199]) {
      expect(equivalencia('azucares', x)).not.toMatch(/≈ 0\b/);
      expect(equivalencia('sodio', x)).not.toMatch(/≈ 0\b/);
    }
  });
});
