// «Guardar caso de prueba»: el archivo no lleva datos de la persona y conserva lo que hace falta para probar.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Producto } from './tipos';
import { casoDePrueba, leerCaso, limpiarTexto, nombreCaso } from './casoPrueba';
import { leerTiquete, unirTiquetes } from './tiquete';
import { abreviar, tiqueteSimulado } from './simulados';

// Tiquete con datos de un receptor INVENTADOS (SIMULADO): nombre, cédula, correo, teléfono y tarjeta.
const CON_DATOS = [
  'MAS X MENOS CURRIDABAT (SIMULADO)',
  'CED JUR 3-101-000000  TEL 2222-0000',
  'FACTURA ELECTRONICA',
  'CLIENTE: JUANA PRUEBA MORA',
  'CEDULA: 1-0000-0000',
  'Correo: juana.prueba@ejemplo.cr',
  'RECEPTOR:',
  'MARIA SIMULADA',
  'Celular 8888-0000',
  'LECHE SEMID DP 1L            1 050',
  'GALL CLUB SOCIAL 6U          1 500',
  '7441001234567 ARROZ 1,8KG    2 350',
  'SUBTOTAL                     4 900',
  'TOTAL                        4 900',
  'TARJETA ************0000',
  'VISA                         4 900',
  'AUTORIZACION 000000',
  'Clave 50613112600310100000000100001010000000001100000000',
  'Factura enviada a otra.persona@ejemplo.cr',
].join('\n');

describe('Limpieza del texto leído', () => {
  const limpio = limpiarTexto(CON_DATOS);
  it('quita nombre, cédula, correo, teléfonos, tarjeta, autorización y clave', () => {
    for (const dato of ['JUANA', 'PRUEBA', 'MARIA', 'SIMULADA', '1-0000-0000', '2222-0000', '8888-0000', '@', '****', 'AUTORIZACION', '506131126'])
      expect(limpio).not.toContain(dato);
    expect(limpio).toContain('[línea quitada: datos personales]');
  });
  it('conserva los productos (con su código de barras), el subtotal y el total: el lector obtiene lo mismo', () => {
    const [antes, despues] = [leerTiquete(CON_DATOS), leerTiquete(limpio)];
    expect(despues.lineas.map(l => [l.descripcion, l.cantidad, l.precio, l.codigo])).toEqual([
      ['LECHE SEMID DP 1L', 1, 1050, undefined], ['GALL CLUB SOCIAL 6U', 1, 1500, undefined], ['ARROZ 1,8KG', 1, 2350, '7441001234567'],
    ]);
    expect(despues.lineas).toEqual(antes.lineas);
    expect([despues.total, despues.subtotal, despues.cuadra]).toEqual([4900, 4900, true]);
    expect(limpio.split('\n')).toHaveLength(CON_DATOS.split('\n').length);   // misma cantidad de líneas
  });
});

const ruta = fileURLToPath(new URL('../../public/datos/productos_cr.json', import.meta.url));
const base: Producto[] = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')).productos : [];
describe.skipIf(!base.length)('La limpieza no toca productos de la base', () => {
  it('ningún nombre (completo o abreviado como en el tiquete) se confunde con un dato personal', () => {
    const choques = base.flatMap(p => [abreviar(p), `${p.nombre} ${p.marca}`.trim()])
      .map(d => `${d}   1 500`).filter(l => limpiarTexto(l) !== l);
    expect(choques).toEqual([]);
  });
  it('50 tiquetes SIMULADO: las mismas líneas y el mismo total antes y después de limpiar', () => {
    for (let s = 1; s <= 50; s++) {
      const t = tiqueteSimulado(base, s, 12).texto;
      const [a, b] = [leerTiquete(t), leerTiquete(limpiarTexto(t))];
      expect(b.lineas).toEqual(a.lineas);
      expect([b.total, b.cuadra]).toEqual([a.total, a.cuadra]);
    }
  });
});

describe('Archivo del caso', () => {
  const parte1 = leerTiquete('PALI (SIMULADO)\nLECHE SEMID DP 1L   1 050\nBOLSA          60\nCLIENTE: JUANA PRUEBA');
  const parte2 = leerTiquete('BOLSA          60\nARROZ TIO PELON 1,8KG   2 350\nTOTAL   3 460');
  const unido = unirTiquetes(parte1, parte2);
  const caso = casoDePrueba({
    tiquete: unido, origen: 'foto', simulado: true, cadena: 'Palí', baseDescargada: '2026-11-13', hoy: '2026-11-14',
    items: [
      { descripcion: 'LECHE SEMID DP 1L', cantidad: 1, precio: 1050, codigo: '7441000000001', identificado: 'texto', quitada: false },
      { descripcion: 'BOLSA', cantidad: 1, precio: 60, codigo: '7441000000009', identificado: 'texto', quitada: true },
      { descripcion: 'ARROZ TIO PELON 1,8KG', cantidad: 1, precio: 2350, codigo: '7441000000002', identificado: 'persona', quitada: false },
      { descripcion: 'COSA RARA', cantidad: 1, precio: 99, quitada: false },
    ],
  });
  it('una parte por foto, sin datos personales, y las líneas como quedaron revisadas', () => {
    expect(caso.partes).toHaveLength(2);
    expect(caso.partes.join('\n')).not.toContain('JUANA');
    expect(caso.lineas[1]).toEqual({ descripcion: 'BOLSA', cantidad: 1, precio: 60, codigoLeido: null, codigo: null, identificado: null, quitada: true });
    expect(caso.lineas[2]).toMatchObject({ codigo: '7441000000002', identificado: 'persona' });
    expect(caso.lineas[3]).toMatchObject({ codigo: null, identificado: null });   // sin identificar
    expect([caso.total, caso.cuadra, caso.simulado, caso.cadena]).toEqual([3460, true, true, 'Palí']);
    expect(nombreCaso(caso)).toBe('canasta-caso-SIMULADO-foto-2026-11-14.json');
  });
  it('no guarda la fecha de la compra, el comercio exacto ni la foto', () => {
    expect(Object.keys(caso).sort()).toEqual(['baseDescargada', 'cadena', 'creado', 'cuadra', 'formato', 'lineas', 'origen', 'partes', 'simulado', 'total', 'version']);
  });
  it('leerCaso acepta el archivo (también después de JSON) y rechaza otros', () => {
    expect(leerCaso(JSON.parse(JSON.stringify(caso)))).toEqual(caso);
    expect(() => leerCaso({ formato: 'canasta-sana/copia' })).toThrow(/no es un archivo de «Guardar caso de prueba»/);
    expect(() => leerCaso({ ...caso, version: 99 })).toThrow(/más nueva/);
    expect(() => leerCaso({ ...caso, lineas: [{ descripcion: 'X', cantidad: 0, precio: 1, quitada: false }] })).toThrow(/línea dañada/);
  });
});
