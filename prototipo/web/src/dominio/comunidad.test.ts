import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { eanValido, normalizarEan, usoInterno } from './codigos';
import { CADENAS, CANTONES, PROVINCIAS, detectarCadena } from './comercio';
import { indexar, prepararAportes, precioComunidad, reportesDeDudosos, type TablaComunidad } from './comunidad';
import { esPrecioReal } from './tipos';

describe('Códigos de barras (mismas reglas que el servicio)', () => {
  it('dígito de control de EAN-13, UPC-A y EAN-8', () => {
    for (const v of ['7411000345023', '4006381333931', '036000291452', '96385074']) expect(eanValido(v)).toBe(true);
    expect(eanValido('4006381333932')).toBe(false);
    expect(eanValido('74410741808')).toBe(false);   // 11 dígitos
    expect(normalizarEan('036000291452')).toBe('0036000291452');
  });
  it('códigos de uso interno (pesados en tienda)', () => {
    expect(eanValido('2000000117522')).toBe(true);
    expect(usoInterno('2000000117522')).toBe(true);
    expect(usoInterno('7411000345023')).toBe(false);
  });
});

describe('Comercio de la compra', () => {
  it('detecta la cadena en el encabezado, Maxi Palí antes que Palí', () => {
    expect(detectarCadena('MAXI PALI CURRIDABAT\nTEL 2222-2222\nLECHE 1 050')).toBe('Maxi Palí');
    expect(detectarCadena('PALI (SIMULADO)\nLECHE 1 050')).toBe('Palí');
    // Con tilde (nombre comercial de una factura): el \b de JavaScript no ve la «í» como letra.
    expect(detectarCadena('Palí (SIMULADO PRUEBA)')).toBe('Palí');
    expect(detectarCadena('Maxi Palí Desamparados')).toBe('Maxi Palí');
    expect(detectarCadena('PALÍ')).toBe('Palí');
    expect(detectarCadena('PALILLOS DE DIENTES')).toBeUndefined();
    expect(detectarCadena('TOPALI')).toBeUndefined();
    expect(detectarCadena('Más x Menos Escazú')).toBe('Más x Menos');
    expect(detectarCadena(undefined, 'AUTOMERCADO S.A.')).toBe('Auto Mercado');
    expect(detectarCadena('SUPERMERCADO EJEMPLO S.A.')).toBeUndefined();
  });
  it('solo mira el encabezado: un producto «PALI» al final no cambia el comercio', () => {
    const texto = ['MINISUPER LA ESQUINA', ...Array.from({ length: 15 }, (_, i) => `PRODUCTO ${i} 1 000`), 'PALILLOS PALI 500'].join('\n');
    expect(detectarCadena(texto)).toBeUndefined();
  });
  it('cadenas y cantones idénticos a los del servicio (api/canasta_api/geografia.py)', () => {
    const py = readFileSync(new URL('../../../api/canasta_api/geografia.py', import.meta.url), 'utf8');
    const lista = (nombre: string) => {
      const bloque = py.match(new RegExp(`${nombre}[^=]*=\\s*[\\[{]([\\s\\S]*?)\\n[\\]}]`))![1];
      return [...bloque.matchAll(/'([^']+)'/g)].map(m => m[1]);
    };
    expect(lista('CADENAS')).toEqual([...CADENAS]);
    const provincias = lista('PROVINCIAS');   // nombres de provincia y cantones mezclados, en orden
    const esperado = Object.entries(PROVINCIAS).flatMap(([p, cs]) => [p, ...cs]);
    expect(provincias).toEqual(esperado);
    expect(CANTONES).toHaveLength(84);
    expect(new Set(CANTONES).size).toBe(84);
  });
});

describe('Precios de la comunidad', () => {
  const tabla: TablaComunidad = {
    desde: '2026-W34', semanas: 12, min_reportes: 3, precios: [
      { ean: '7411000345023', cadena: null, canton: null, mediana: 1550, p25: 1500, p75: 1600, n: 9, desde: '2026-W40', hasta: '2026-W46' },
      { ean: '7411000345023', cadena: 'Palí', canton: null, mediana: 1490, p25: 1480, p75: 1500, n: 4, desde: '2026-W44', hasta: '2026-W46' },
      { ean: '7411000345023', cadena: 'Palí', canton: 'Cartago', mediana: 1480, p25: 1470, p75: 1490, n: 3, desde: '2026-W45', hasta: '2026-W46' },
      { ean: '0036000291452', cadena: null, canton: null, mediana: 2950, p25: 2900, p75: 3000, n: 3, desde: '2026-W46', hasta: '2026-W46' },
    ],
  };
  const ind = indexar(tabla);

  it('elige lo más cercano: cadena y cantón → cadena → país', () => {
    expect(precioComunidad(ind, '7411000345023', 'Palí', 'Cartago')).toMatchObject({ colones: 1480, comercio: 'Palí, Cartago', n: 3 });
    expect(precioComunidad(ind, '7411000345023', 'Palí', 'Escazú')).toMatchObject({ colones: 1490, comercio: 'Palí' });
    expect(precioComunidad(ind, '7411000345023', 'Walmart')).toMatchObject({ colones: 1550, comercio: 'Costa Rica' });
    expect(precioComunidad(ind, '7411000345023')).toMatchObject({ colones: 1550, fuente: 'comunidad' });
  });
  it('acepta el UPC-A de 12 dígitos y no inventa precios', () => {
    expect(precioComunidad(ind, '036000291452')?.colones).toBe(2950);
    expect(precioComunidad(ind, '4006381333931')).toBeUndefined();
  });
  it('un precio de la comunidad cuenta como real (viene de tiquetes reales)', () => {
    expect(esPrecioReal(precioComunidad(ind, '7411000345023'))).toBe(true);
  });

  it('aportes: solo identificados con seguridad, código válido y comparable, precio unitario, sin repetir', () => {
    const r = prepararAportes([
      { ean: '7411000345023', total: 3000, cantidad: 2, seguro: true },   // 2 unidades → ₡1500 c/u
      { ean: '7411000345023', total: 1500, cantidad: 1, seguro: true },   // repetido
      { ean: '036000291452', total: 2950, cantidad: 1, seguro: true },    // UPC-A → EAN-13
      { ean: '4006381333931', total: 990, cantidad: 1, seguro: false },   // identificado solo por texto
      { ean: '4006381333932', total: 990, cantidad: 1, seguro: true },    // dígito de control malo
      { ean: '2000000117522', total: 4200, cantidad: 1, seguro: true },   // pesado en tienda
      { ean: '96385074', total: 30, cantidad: 1, seguro: true },          // menos de ₡50
    ], 'Palí', 'Cartago', '2026-11-13');
    expect(r).toEqual([
      { ean: '7411000345023', precio: 1500, cadena: 'Palí', canton: 'Cartago', fecha: '2026-11-13' },
      { ean: '0036000291452', precio: 2950, cadena: 'Palí', canton: 'Cartago', fecha: '2026-11-13' },
    ]);
  });
  it('aportes: sin cantón ni fecha no se mandan esos campos', () => {
    expect(prepararAportes([{ ean: '96385074', total: 800, cantidad: 1, seguro: true }], 'Otro'))
      .toEqual([{ ean: '96385074', precio: 800, cadena: 'Otro' }]);
  });
});

describe('Avisos de datos dudosos', () => {
  it('convierte los datos dudosos en avisos con opciones cerradas', () => {
    expect(reportesDeDudosos('036000291452', ['grasas trans', 'sodio (dato dudoso)', 'azúcares (dato dudoso)', 'energía'])).toEqual([
      { ean: '0036000291452', campo: 'sodio', motivo: 'unidad_erronea' },
      { ean: '0036000291452', campo: 'azucares', motivo: 'inconsistente' },
    ]);
  });
  it('sin datos dudosos o con un código inválido, no hay nada que avisar', () => {
    expect(reportesDeDudosos('7411000345023', ['grasas trans'])).toEqual([]);
    expect(reportesDeDudosos('74410741808', ['sodio (dato dudoso)'])).toEqual([]);
  });
});

describe('Revisión independiente', () => {
  const linea = { ean: '7411000345023', total: 1500, cantidad: 1, seguro: true };
  it('códigos 04 (uso interno de la tienda) y 05 (cupones) no se aportan', () => {
    expect(usoInterno('041234567890')).toBe(usoInterno('0041234567890'));
    expect(usoInterno('0412345678906')).toBe(true);
    expect(usoInterno('0512345678905')).toBe(true);
    expect(usoInterno('0036000291452')).toBe(false);   // UPC sistema 0: producto normal
  });
  it('compra de hace más de 90 días o en el futuro: no se ofrece aportar (el servicio rechazaría todo el lote)', () => {
    expect(prepararAportes([linea], 'Palí', undefined, '2026-07-01', '2026-11-14')).toEqual([]);
    expect(prepararAportes([linea], 'Palí', undefined, '2026-11-20', '2026-11-14')).toEqual([]);
    expect(prepararAportes([linea], 'Palí', undefined, '2026-08-16', '2026-11-14')).toHaveLength(1);   // justo 90 días
    expect(prepararAportes([linea], 'Palí', undefined, '2026-11-15', '2026-11-14')).toHaveLength(1);   // +1 día (zona horaria)
  });
  it('un cantón guardado que no existe se omite en vez de hacer fallar el envío', () => {
    expect(prepararAportes([linea], 'Palí', 'Gotham', '2026-11-13', '2026-11-14')).toEqual([
      { ean: '7411000345023', precio: 1500, cadena: 'Palí', fecha: '2026-11-13' },
    ]);
  });
});

describe('Auditoría del frontend (P-13 y energía dudosa)', () => {
  it('indexar descarta filas dañadas: no llegan a precioComunidad', async () => {
    const { indexar, precioComunidad } = await import('./comunidad');
    const buena = { ean: '7441000000017', cadena: 'Palí', canton: null, mediana: 1500, p25: 1400, p75: 1600, n: 3, desde: '', hasta: '' };
    const tabla = { desde: '2026-W34', semanas: 12, min_reportes: 3, precios: [
      buena,
      { ...buena, ean: '7441000000024', mediana: Number.NaN },
      { ...buena, ean: '7441000000031', mediana: 10 },
      { ...buena, ean: 'abc', mediana: 900 },
      { ...buena, ean: '7441000000048', n: 0 },
      null,
    ] } as never;
    const ind = indexar(tabla);
    expect(ind.size).toBe(1);
    expect(precioComunidad(ind, '7441000000017', 'Palí')?.colones).toBe(1500);
    expect(precioComunidad(ind, '7441000000024', 'Palí')).toBeUndefined();
    expect(indexar({} as never).size).toBe(0);
  });
  it('la energía con dato dudoso también se puede avisar (campo kcal)', async () => {
    const { reportesDeDudosos } = await import('./comunidad');
    expect(reportesDeDudosos('7441001639258', ['energía (dato dudoso)'])).toEqual([{ ean: '7441001639258', campo: 'kcal', motivo: 'inconsistente' }]);
  });
});
