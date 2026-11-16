import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { COLORANTES, FUENTES, colorantesDe, hayDatosDeIngredientes } from './colorantes';

const p = (ingredientes = '', aditivos: string[] = []) => ({ ingredientes, aditivos });
const codigos = (ingredientes: string, aditivos: string[] = []) => colorantesDe(p(ingredientes, aditivos)).map(c => c.codigo);

describe('Colorantes con advertencia o prohibidos en otros países', () => {
  it('la lista: los 6 con advertencia en la UE, el dióxido de titanio y el rojo 3', () => {
    expect(COLORANTES.map(c => c.codigo)).toEqual(['E102', 'E104', 'E110', 'E122', 'E124', 'E129', 'E171', 'E127']);
    expect(COLORANTES.filter(c => c.regla === 'advertencia-ue')).toHaveLength(6);
    for (const f of Object.values(FUENTES)) expect(f.url).toMatch(/^https:\/\/(www\.legislation\.gov\.uk|eur-lex\.europa\.eu|www\.fda\.gov)\//);
  });
  it('por código de aditivo de Open Food Facts', () => {
    expect(codigos('', ['en:e102', 'en:e330'])).toEqual(['E102']);
    expect(codigos('', ['en:e150d'])).toEqual([]);   // caramelo IV: sin advertencia en la UE, no se marca
  });
  it('por nombre en los ingredientes, con y sin tilde, en español e inglés', () => {
    expect(codigos('azúcar, colorantes: tartrazina, amarillo ocaso')).toEqual(['E102', 'E110']);
    expect(codigos('Sugar, Red 40, Yellow 5, Yellow #6')).toEqual(['E102', 'E110', 'E129']);
    expect(codigos('colorante artificial rojo No. 40 (INS 129)')).toEqual(['E129']);
    expect(codigos('DIÓXIDO DE TITANIO')).toEqual(['E171']);
    expect(codigos('color: E-124, E 122')).toEqual(['E122', 'E124']);
    expect(codigos('eritrosina')).toEqual(['E127']);
  });
  it('sin falsos positivos con números parecidos u otras palabras', () => {
    expect(codigos('rojo 30, amarillo 55, E1020, harina de trigo, vitamina B5')).toEqual([]);
    expect(codigos('carmín (E120), curcumina (E100), caramelo (E150a)')).toEqual([]);   // colorantes sin advertencia
  });
  it('texto leído por la persona con la cámara también cuenta', () => {
    expect(colorantesDe(p(''), 'INGREDIENTES: AZUCAR, TARTRAZINA').map(c => c.codigo)).toEqual(['E102']);
  });
  it('sin ingredientes ni aditivos no se puede saber (no es «no tiene»)', () => {
    expect(hayDatosDeIngredientes(p(''))).toBe(false);
    expect(hayDatosDeIngredientes(p('a'))).toBe(false);   // «Agua natural» en la base: ingredientes = «a»
    // Tablas nutricionales leídas por OCR en el campo de ingredientes (casos reales de la base): no cuentan.
    expect(hayDatosDeIngredientes(p('es une fee sigicatie& Calorias de la Grs Grn Ias, Rera dita Tamaño por porción'))).toBe(false);
    expect(hayDatosDeIngredientes(p('Datos de nutrición Nutrition Facts grasa total / total fat'))).toBe(false);
    expect(hayDatosDeIngredientes(p('Lentejas 100%'))).toBe(true);   // corto pero legítimo
    expect(hayDatosDeIngredientes(p('', ['en:e330']))).toBe(true);
    expect(hayDatosDeIngredientes(p(''), 'azúcar, agua, sal, tartrazina')).toBe(true);
  });
  it('base real: coincide con el análisis (13 productos con alguno de los 6 de la UE)', () => {
    const base = JSON.parse(readFileSync(new URL('../../public/datos/productos_cr.json', import.meta.url), 'utf8')).productos;
    const conUe = base.filter((x: { aditivos: string[]; ingredientes: string }) => colorantesDe(x).some(c => c.regla === 'advertencia-ue'));
    expect(conUe.length).toBeGreaterThanOrEqual(12);
    expect(conUe.length).toBeLessThanOrEqual(15);
  });
});
