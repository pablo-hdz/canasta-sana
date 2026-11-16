// Almacenamiento local con un localStorage de prueba: datos dañados o de otra versión no rompen la app.
import { beforeEach, describe, expect, it } from 'vitest';
import {
  CLAVES, PREFERENCIAS_INICIALES, borrarTodo, guardarCompras, guardarLista, leerAlias, leerCompras, leerComunidad,
  leerHistorial, leerLista, leerPerfil, leerPreferencias, sumarAlHistorial,
} from './almacen';
import { PERFIL_VACIO } from './dominio/cambios';

class AlmacenDePrueba {
  datos = new Map<string, string>();
  getItem(k: string) { return this.datos.get(k) ?? null; }
  setItem(k: string, v: string) { this.datos.set(k, String(v)); }
  removeItem(k: string) { this.datos.delete(k); }
  clear() { this.datos.clear(); }
  key(i: number) { return [...this.datos.keys()][i] ?? null; }
  get length() { return this.datos.size; }
}
const ls = new AlmacenDePrueba();
Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });

describe('Almacenamiento en el teléfono', () => {
  beforeEach(() => ls.clear());

  it('sin datos: valores iniciales, todo lo de la comunidad apagado', () => {
    expect(leerPreferencias()).toEqual(PREFERENCIAS_INICIALES);
    expect(leerPerfil()).toEqual(PERFIL_VACIO);
    expect(leerLista()).toEqual([]);
    expect(leerCompras()).toEqual([]);
    expect(leerComunidad()).toBeNull();
  });

  it('JSON dañado o de otra forma: se ignora sin romper', () => {
    ls.setItem('canasta.compras', '{no es json');
    ls.setItem('canasta.lista', JSON.stringify(['7411000345023']));            // formato viejo: lista de códigos
    ls.setItem('canasta.perfil', JSON.stringify({ ninos: 'sí' }));
    ls.setItem('canasta.alias', JSON.stringify({ 'LECH 1L': 123 }));
    ls.setItem('canasta.precios', JSON.stringify({ '1': { colones: 'mil' } }));
    ls.setItem('canasta.comunidad', JSON.stringify({ tabla: {} }));
    expect(leerCompras()).toEqual([]);
    expect(leerLista()).toEqual([]);
    expect(leerPerfil()).toEqual(PERFIL_VACIO);
    expect(leerAlias()).toEqual({});
    expect(leerHistorial()).toEqual({});
    expect(leerComunidad()).toBeNull();
  });

  it('preferencias campo por campo: un valor raro nunca activa un envío', () => {
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'morado', aportar: 'true', usarComunidad: 1, canton: 'Cartago' }));
    expect(leerPreferencias()).toEqual({ tema: 'claro', aportar: false, usarComunidad: false, canton: 'Cartago' });
    // D-25: claro por defecto; el «sistema» guardado por versiones anteriores pasa a claro; «telefono» se respeta.
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'sistema' }));
    expect(leerPreferencias().tema).toBe('claro');
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'telefono' }));
    expect(leerPreferencias().tema).toBe('telefono');
    // «Quitar las animaciones»: solo false se guarda; cualquier otro valor deja las animaciones cortas.
    ls.setItem('canasta.preferencias', JSON.stringify({ animaciones: false }));
    expect(leerPreferencias().animaciones).toBe(false);
    ls.setItem('canasta.preferencias', JSON.stringify({ animaciones: 'no' }));
    expect(leerPreferencias()).not.toHaveProperty('animaciones');
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'oscuro', aportar: true, usarComunidad: true }));
    expect(leerPreferencias()).toEqual({ tema: 'oscuro', aportar: true, usarComunidad: true });
    // Letra (D-20): solo «legible» se guarda; cualquier otro valor vuelve a la letra del teléfono.
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'claro', letra: 'legible' }));
    expect(leerPreferencias().letra).toBe('legible');
    ls.setItem('canasta.preferencias', JSON.stringify({ tema: 'claro', letra: 'comic-sans' }));
    expect(leerPreferencias()).not.toHaveProperty('letra');
  });

  it('guarda y lee lista y compras válidas', () => {
    guardarLista([{ ean: '1', nombre: 'Avena', hecho: false }]);
    guardarCompras([{ id: 'a', fecha: '2026-11-14', empacados: 1, conSellos: 0, gastoEmpacados: 900, gastoConSellos: 0 }]);
    expect(leerLista()).toHaveLength(1);
    expect(leerCompras()[0].gastoEmpacados).toBe(900);
  });

  it('el historial conserva el precio más reciente', () => {
    sumarAlHistorial({ A: { colones: 1000, fuente: 'historial', fecha: '2026-11-10' } });
    sumarAlHistorial({ A: { colones: 900, fuente: 'historial', fecha: '2026-11-01' } });   // más viejo: no reemplaza
    expect(leerHistorial().A.colones).toBe(1000);
    sumarAlHistorial({ A: { colones: 1100, fuente: 'historial', fecha: '2026-11-13' } });
    expect(leerHistorial().A.colones).toBe(1100);
  });

  it('«Borrar mis datos» quita todo lo de la app y nada más', () => {
    for (const k of CLAVES) ls.setItem(k, '{}');
    ls.setItem('otra-app', 'x');
    borrarTodo();
    expect([...ls.datos.keys()]).toEqual(['otra-app']);
  });
});

describe('Revisión independiente: un registro dañado no borra la colección', () => {
  beforeEach(() => ls.clear());
  it('historial: se descarta solo el precio malo (p. ej. ₡/0 = Infinity guardado como null)', async () => {
    ls.setItem('canasta.precios', JSON.stringify({ A: { colones: 1000, fuente: 'historial' }, B: { colones: null, fuente: 'historial' } }));
    expect(Object.keys(leerHistorial())).toEqual(['A']);
  });
  it('lista y compras: se conservan los registros válidos', () => {
    ls.setItem('canasta.lista', JSON.stringify([{ ean: '1', nombre: 'Avena', hecho: false }, '7411000345023', null]));
    ls.setItem('canasta.compras', JSON.stringify([{ id: 'a', fecha: '2026-11-14', gastoEmpacados: 900, gastoConSellos: 0 }, { id: 'b', fecha: 'ayer' }]));
    expect(leerLista().map(x => x.ean)).toEqual(['1']);
    expect(leerCompras().map(x => x.id)).toEqual(['a']);
  });
  it('las compras ya aportadas se recuerdan y «Borrar mis datos» también las borra', async () => {
    const { guardarAportadas, leerAportadas } = await import('./almacen');
    guardarAportadas(Array.from({ length: 250 }, (_, i) => `c${i}`));
    expect(leerAportadas()).toHaveLength(200);
    expect(leerAportadas()[0]).toBe('c50');
    borrarTodo();
    expect(leerAportadas()).toEqual([]);
  });
});

describe('Copia de seguridad', () => {
  beforeEach(() => ls.clear());
  it('exportar y restaurar devuelve los mismos datos', async () => {
    const { exportarDatos, importarDatos, guardarPerfil, guardarPreferencias } = await import('./almacen');
    guardarPerfil({ ninos: true, alergenos: ['en:peanuts'] });
    guardarPreferencias({ tema: 'oscuro', usarComunidad: false, aportar: false, canton: 'Cartago' });
    guardarLista([{ ean: '1', nombre: 'Avena', hecho: false }]);
    guardarCompras([{ id: 'a', fecha: '2026-11-14', empacados: 1, conSellos: 0, gastoEmpacados: 900, gastoConSellos: 0 }]);
    sumarAlHistorial({ A: { colones: 1000, fuente: 'historial', fecha: '2026-11-10' } });
    const copia = JSON.stringify(exportarDatos(new Date('2026-11-14T08:00:00Z')));
    expect(copia).not.toContain('canasta.comunidad');   // lo público no va en la copia
    ls.clear();
    expect(importarDatos(copia)).toEqual({ ok: true, compras: 1, precios: 1, lista: 1 });
    expect(leerPerfil()).toEqual({ ninos: true, alergenos: ['en:peanuts'] });
    expect(leerPreferencias()).toEqual({ tema: 'oscuro', usarComunidad: false, aportar: false, canton: 'Cartago' });
  });
  it('rechaza archivos ajenos o de una versión más nueva, sin tocar los datos actuales', async () => {
    const { importarDatos } = await import('./almacen');
    guardarLista([{ ean: '1', nombre: 'Avena', hecho: false }]);
    expect(importarDatos('hola')).toMatchObject({ ok: false });
    expect(importarDatos(JSON.stringify({ app: 'otra', version: 1, datos: {} }))).toMatchObject({ ok: false });
    expect(importarDatos(JSON.stringify({ app: 'canasta-sana', version: 99, datos: {} }))).toEqual({ ok: false, error: 'la copia es de una versión más nueva de la app' });
    expect(leerLista()).toHaveLength(1);
  });
  it('una copia con registros dañados restaura solo lo válido', async () => {
    const { importarDatos } = await import('./almacen');
    const r = importarDatos(JSON.stringify({ app: 'canasta-sana', version: 1, datos: {
      'canasta.lista': [{ ean: '1', nombre: 'Avena', hecho: false }, { ean: 2 }],
      'canasta.precios': { A: { colones: 500, fuente: 'historial' }, B: { colones: 'gratis' } },
      'canasta.preferencias': { aportar: 'sí', tema: 'neón' },
      'otra.clave': 'se ignora',
    } }));
    expect(r).toEqual({ ok: true, compras: 0, precios: 1, lista: 1 });
    expect(leerPreferencias()).toEqual(PREFERENCIAS_INICIALES);
    expect(ls.getItem('otra.clave')).toBeNull();
  });
});
