// B-03: un producto aprendido mal se corrige (el nuevo reemplaza al viejo) o se olvida, y se puede revisar.
import { describe, expect, it } from 'vitest';
import { aprender, aprendidos, olvidar } from './alias';
import { identificar } from './identificar';
import { prod } from './fabrica';

const jamon = prod({ ean: '7441000409067', nombre: 'Jamón de Pechuga de Pavo', marca: 'Cinta Azul' });
const guayaba = prod({ ean: '7443011623630', nombre: 'Guava Jam', marca: 'Sweet Well' });
const base = [jamon, guayaba];

describe('Productos aprendidos (alias)', () => {
  it('el alias malo «GUAVA JAM SW → jamón» se corrige: elegir otro producto lo reemplaza', () => {
    const malo = aprender({}, 'GUAVA JAM SW', jamon.ean);
    expect(identificar('GUAVA JAM SW', base, malo)).toMatchObject({ metodo: 'alias', producto: jamon });
    const corregido = aprender(malo, 'Guava  jam sw', guayaba.ean);   // misma descripción normalizada
    expect(Object.keys(corregido)).toHaveLength(1);
    expect(identificar('GUAVA JAM SW', base, corregido)).toMatchObject({ metodo: 'alias', producto: guayaba });
  });
  it('olvidar uno no toca los demás; la próxima vez la app vuelve a identificar por el texto', () => {
    const dos = aprender(aprender({}, 'GUAVA JAM SW', jamon.ean), 'JAMON PAVO CA', jamon.ean);
    const uno = olvidar(dos, 'GUAVA JAM SW');
    expect(uno).toEqual({ 'JAMON PAVO CA': jamon.ean });
    expect(identificar('GUAVA JAM SW', base, uno).metodo).not.toBe('alias');
  });
  it('la lista para Ajustes dice qué descripción apunta a qué producto, aunque ya no esté en la base', () => {
    expect(aprendidos({ 'GUAVA JAM SW': jamon.ean, 'ARROZ X': '000' }, base)).toEqual([
      { clave: 'ARROZ X', ean: '000', nombre: 'Código 000 (ya no está en la base)' },
      { clave: 'GUAVA JAM SW', ean: jamon.ean, nombre: 'Jamón de Pechuga de Pavo · Cinta Azul' },
    ]);
  });
});
