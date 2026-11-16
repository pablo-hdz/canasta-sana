import { describe, expect, it } from 'vitest';
import { ordenarParaSustituir, queBuscar } from './sustituir';
import { prod } from './fabrica';
import type { Evaluacion, Sello } from './tipos';

const ev = (sellos: Sello[], aplica = true) => ({ aplica, sellos } as unknown as Evaluacion);
const fila = (ean: string, nombre: string, sellos: Sello[], precio: number, aplica = true) =>
  ({ producto: prod({ ean, nombre }), e: ev(sellos, aplica), precio, cantidad: 1 });

describe('Productos para sustituir (D-22)', () => {
  it('de más sellos a menos; a igual número, el de más gasto primero; sin sellos o fuera del modelo no aparecen', () => {
    const r = ordenarParaSustituir([
      fila('A', 'Galletas', ['azucares', 'saturadas'], 1000),
      fila('B', 'Frijoles molidos', ['sodio', 'grasas', 'saturadas'], 500),
      fila('C', 'Refresco', ['azucares', 'edulcorantes'], 3000),
      fila('D', 'Avena', [], 900),
      fila('E', 'Banano', ['azucares'], 400, false),
    ]);
    expect(r.map(x => x.producto.nombre)).toEqual(['Frijoles molidos', 'Refresco', 'Galletas']);
    expect(r[0].sellos).toEqual(['sodio', 'saturadas', 'grasas']);   // en el orden de los sellos de la OPS
  });
  it('el mismo producto en varias líneas se une y suma su gasto', () => {
    const r = ordenarParaSustituir([fila('A', 'Galletas', ['azucares'], 1000), fila('A', 'Galletas', ['azucares'], 1000)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ gasto: 2000, unidades: 2 });
  });
  it('qué buscar, en palabras', () => {
    expect(queBuscar(['azucares'])).toBe('Busque una opción con menos azúcar.');
    expect(queBuscar(['sodio', 'saturadas', 'edulcorantes'])).toBe('Busque una opción con menos sodio (sal), menos grasas saturadas y sin edulcorantes.');
  });
});
