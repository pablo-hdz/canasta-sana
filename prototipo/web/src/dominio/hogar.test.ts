// B-07: avisos del hogar en el paso 4. Solo hechos del producto; nunca «no contiene».
import { describe, expect, it } from 'vitest';
import { avisosHogar } from './hogar';
import { prod } from './fabrica';

const sinNinos = { ninos: false, alergenos: [] };
const conNinos = { ninos: true, alergenos: [] };
const refresco = prod({ ingredientes: 'agua carbonatada, sucralosa, tartrazina', aditivos: ['en:e955'] });
const galleta = prod({ ingredientes: 'harina de trigo, azúcar, leche en polvo', alergenos: ['en:milk', 'en:gluten'] });
const sinDato = prod({ ingredientes: '', alergenos: [] });

describe('Avisos del hogar (B-07)', () => {
  it('edulcorantes y colorantes de la lista, con su nombre, con niños', () => {
    expect(avisosHogar(refresco, conNinos)).toEqual([
      'Lleva edulcorantes: sucralosa (E955).',
      'Lleva colorantes de la lista: tartrazina (E102).',
    ]);
  });
  it('D-29: también sin niños (siempre se avisa)', () => {
    expect(avisosHogar(refresco, sinNinos)).toEqual(avisosHogar(refresco, conNinos));
    expect(avisosHogar(refresco, sinNinos)).toHaveLength(2);
  });
  it('el colorante leído con la cámara también cuenta', () => {
    expect(avisosHogar(sinDato, conNinos, 'agua, azúcar, rojo 40')).toEqual(['Lleva colorantes de la lista: rojo allura (rojo 40) (E129).']);
  });
  it('alergia marcada: solo lo que el dato de alérgenos incluye', () => {
    expect(avisosHogar(galleta, { ninos: false, alergenos: ['en:milk', 'en:peanuts'] })).toEqual(['La etiqueta declara: leche.']);
    expect(avisosHogar(galleta, { ninos: false, alergenos: ['en:peanuts'] })).toEqual([]);
  });
  it('sin dato no se dice nada, y nunca aparece «no contiene» ni una norma sobre niños', () => {
    const todos = [refresco, galleta, sinDato].flatMap(p => avisosHogar(p, { ninos: true, alergenos: ['en:milk', 'en:peanuts', 'en:gluten'] }));
    expect(avisosHogar(sinDato, { ninos: true, alergenos: ['en:milk'] })).toEqual([]);
    expect(todos.join(' ')).not.toMatch(/no contiene|libre de|sin (leche|maní|gluten)|no recomend|niños/i);
  });
});
