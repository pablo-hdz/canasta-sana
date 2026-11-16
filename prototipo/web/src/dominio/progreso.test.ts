import { describe, expect, it } from 'vitest';
import { MAX_COMPRAS, idCompra, nombreMes, porMes, registrar, tendencia, type ResumenCompra } from './progreso';
import { agregarOQuitar, enlaceWhatsApp, marcar, textoLista, type ItemLista } from './lista';

const compra = (fecha: string, gastoEmpacados: number, gastoConSellos: number, extra: Partial<ResumenCompra> = {}): ResumenCompra => ({
  id: idCompra(fecha, gastoEmpacados, 5), fecha, empacados: 5, conSellos: 2, gastoEmpacados, gastoConSellos, ...extra,
});

describe('Progreso mes a mes', () => {
  it('la misma compra subida dos veces cuenta una vez', () => {
    let h = registrar([], compra('2026-11-02', 10000, 5000));
    h = registrar(h, compra('2026-11-02', 10000, 5000));
    expect(h).toHaveLength(1);
    expect(idCompra('2026-11-02', 10000, 5)).not.toBe(idCompra('2026-11-02', 10000, 6));
  });
  it('conserva las más recientes en orden de fecha', () => {
    let h: ResumenCompra[] = [];
    for (let i = 0; i < MAX_COMPRAS + 5; i++) h = registrar(h, compra(`2026-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`, 1000 + i, 0));
    expect(h).toHaveLength(MAX_COMPRAS);
    expect(h.map(c => c.fecha)).toEqual([...h.map(c => c.fecha)].sort());
  });
  it('agrupa por mes y calcula el % del gasto en productos con sellos', () => {
    const meses = porMes([
      compra('2026-10-05', 10000, 6000, { azucarG: 300, sodioMg: 5000 }), compra('2026-10-20', 10000, 4000, { azucarG: 100 }),
      compra('2026-11-03', 8000, 2000),
    ]);
    expect(meses.map(m => [m.mes, m.compras, m.pctConSellos, m.azucarG, m.sodioMg])).toEqual([
      ['2026-10', 2, 50, 400, 5000], ['2026-11', 1, 25, 0, 0],
    ]);
  });
  it('tendencia: baja de 50 % a 25 % es mejora; diferencias menores de 5 puntos son «igual»', () => {
    expect(tendencia([])).toEqual({ estado: 'sin-datos' });
    const m = porMes([compra('2026-10-05', 10000, 5000), compra('2026-11-03', 8000, 2000)]);
    expect(tendencia(m)).toMatchObject({ estado: 'mejora', actual: 25, anterior: 50, diferencia: -25 });
    expect(tendencia(porMes([compra('2026-10-05', 10000, 5000), compra('2026-11-03', 10000, 5300)])).estado).toBe('igual');
    expect(tendencia(porMes([compra('2026-10-05', 10000, 2000), compra('2026-11-03', 10000, 5000)])).estado).toBe('empeora');
    expect(tendencia(porMes([compra('2026-11-03', 10000, 5000)]))).toEqual({ estado: 'primer-mes', actual: 50 });
  });
  it('un mes sin empacados no cuenta para la tendencia', () => {
    const m = porMes([compra('2026-09-05', 10000, 5000), compra('2026-10-05', 0, 0), compra('2026-11-03', 10000, 2000)]);
    expect(m[1].pctConSellos).toBeUndefined();
    expect(tendencia(m)).toMatchObject({ estado: 'mejora', anterior: 50, actual: 20 });
  });
  it('nombre del mes', () => {
    expect(nombreMes('2026-11')).toBe('nov. 2026');
    expect(nombreMes('2027-01')).toBe('ene. 2027');
  });
});

describe('Mi lista', () => {
  const leche: ItemLista = { ean: '1', nombre: 'Leche semidescremada', marca: 'Dos Pinos', cantidad: '1 L', enVezDe: 'Choco Leche', hecho: false };
  const avena: ItemLista = { ean: '2', nombre: 'Avena en hojuelas', hecho: false };

  it('agregar y quitar con el mismo botón; marcar como comprado', () => {
    let l = agregarOQuitar([], leche);
    l = agregarOQuitar(l, avena);
    expect(l.map(x => x.ean)).toEqual(['1', '2']);
    expect(agregarOQuitar(l, leche).map(x => x.ean)).toEqual(['2']);
    expect(marcar(l, '2').find(x => x.ean === '2')!.hecho).toBe(true);
  });
  it('texto para compartir: solo lo pendiente, sin datos del hogar', () => {
    const t = textoLista([leche, { ...avena, hecho: true }]);
    expect(t).toBe('Mi lista de compras (Canasta sana):\n• Leche semidescremada · Dos Pinos · 1 L (en vez de Choco Leche)');
    expect(textoLista([{ ...leche, hecho: true }])).toBe('');
  });
  it('recordatorio de sustituir: el texto dice qué buscar (D-22)', () => {
    expect(textoLista([{ ean: '9', nombre: 'Frijoles molidos', marca: 'Santa Cruz', hecho: false, accion: 'sustituir' }]))
      .toBe('Mi lista de compras (Canasta sana):\n• Cambiar Frijoles molidos · Santa Cruz por una opción con menos sellos');
  });
  it('enlace de WhatsApp codificado', () => {
    expect(enlaceWhatsApp('Mi lista:\n• Café & pan')).toBe('https://wa.me/?text=Mi%20lista%3A%0A%E2%80%A2%20Caf%C3%A9%20%26%20pan');
  });
});

describe('Demostraciones', () => {
  it('lo marcado SIMULADO nunca se toma como compra real', async () => {
    const { esDemostracion } = await import('./simulados');
    expect(esDemostracion('Súper Ejemplo (SIMULADO)')).toBe(true);
    expect(esDemostracion(undefined, 'SUPERMERCADO EJEMPLO S.A. (SIMULADO)\nLECHE 1 050')).toBe(true);
    expect(esDemostracion('Palí', 'PALI CURRIDABAT\nLECHE 1 050')).toBe(false);
    // Un producto que dice «simulado» al final de un tiquete largo no convierte la compra en demostración.
    expect(esDemostracion(undefined, ['PALI', ...Array.from({ length: 14 }, (_, i) => `PROD ${i} 1 000`), 'CUERO SIMULADO 2 000'].join('\n'))).toBe(false);
  });
});

describe('Nivel del gasto con sellos (más es peor)', () => {
  it('bajo hasta 20 %, medio hasta 50 %, alto por encima', async () => {
    const { nivelSellos } = await import('./progreso');
    expect([0, 20, 20.5, 50, 50.1, 100].map(nivelSellos)).toEqual(['bajo', 'bajo', 'medio', 'medio', 'alto', 'alto']);
  });
});
