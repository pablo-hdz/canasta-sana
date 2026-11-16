// Pruebas trampa de los filtros de seguridad (RF-07). Son la barrera principal (decisión D-08).
import { describe, expect, it } from 'vitest';
import { evaluar } from './ops';
import { PERFIL_VACIO, proponerCambios, revisarCandidato, type Precios } from './cambios';
import { prod } from './fabrica';
import type { Producto } from './tipos';

const galleta = prod({ ean: 'G0', nombre: 'Galletas rellenas', categorias: ['en:snacks', 'en:biscuits'], cantidadNum: 432, unidad: 'g',
  ingredientes: 'harina de trigo, azúcar, aceite de palma, cacao, sal, leche en polvo',
  n: { kcal: 480, azucares: 35, grasas: 20, saturadas: 9, trans: 0.2, sodioMg: 300 } });
// Avena: 4·70 + 4·7 + 9·14 = 434 kcal frente a 450 declaradas (diferencia 3,6 %): datos coherentes. Sellos: solo azúcares.
const base = { categorias: ['en:snacks', 'en:biscuits'], cantidadNum: 400, unidad: 'g' as const,
  ingredientes: 'avena, harina, azúcar, aceite', n: { kcal: 450, azucares: 15, grasas: 14, saturadas: 3, trans: 0, sodioMg: 250, carbohidratos: 70, proteinas: 7 } };
const cand = (ean: string, o: Partial<Producto> = {}) => prod({ ean, nombre: 'Galletas de avena', ...base, ...o });

const precios: Record<string, number> = { G0: 2000, OK: 1850, CARO: 2300 };
const p: Precios = x => (precios[x.ean] !== undefined ? { colones: precios[x.ean], fuente: 'tiquete' } : undefined);
const revisar = (c: Producto, perfil = PERFIL_VACIO, orig = galleta) => revisarCandidato(orig, evaluar(orig), c, perfil, p);
const motivo = (r: ReturnType<typeof revisar>) => (r.ok ? 'ok' : r.motivo);

describe('Filtros de seguridad (casos trampa)', () => {
  it('acepta un cambio válido: menos sellos, misma categoría, tamaño ±20 %, más barato', () => {
    expect(evaluar(cand('OK')).sellos).toEqual(['azucares']);
    expect(motivo(revisar(cand('OK')))).toBe('ok');
  });
  it('rechaza sustitutos de sal por ingrediente (cloruro de potasio)', () => {
    expect(motivo(revisar(cand('S1', { ingredientes: 'avena, harina, azúcar, aceite, cloruro de potasio' })))).toBe('sustituto-sal');
  });
  it('rechaza sustitutos de sal por aditivo E508', () => {
    expect(motivo(revisar(cand('S2', { aditivos: ['en:e508'] })))).toBe('sustituto-sal');
  });
  it('rechaza un colorante con advertencia que el original no tenía (D-19)', () => {
    expect(motivo(revisar(cand('K1', { ingredientes: 'avena, harina, azúcar, aceite, tartrazina' })))).toBe('colorante-nuevo');
    expect(motivo(revisar(cand('K2', { aditivos: ['en:e129'] })))).toBe('colorante-nuevo');
    // Si el original ya lo tenía, el cambio no empeora en eso y se permite (sin niños en el hogar).
    const galletaAmarilla = { ...galleta, ingredientes: `${galleta.ingredientes}, tartrazina` };
    expect(motivo(revisar(cand('K1', { ingredientes: 'avena, harina, azúcar, aceite, tartrazina' }), PERFIL_VACIO, galletaAmarilla))).toBe('ok');
  });
  it('con niños en el hogar, ningún candidato con esos colorantes', () => {
    const galletaAmarilla = { ...galleta, ingredientes: `${galleta.ingredientes}, tartrazina` };
    const c = cand('K1', { ingredientes: 'avena, harina, azúcar, aceite, tartrazina' });
    expect(motivo(revisar(c, { alergenos: [], ninos: true }, galletaAmarilla))).toBe('colorante-ninos');
    expect(motivo(revisar(cand('OK'), { alergenos: [], ninos: true }, galletaAmarilla))).toBe('ok');   // sin colorante: sí
  });
  it('rechaza un alérgeno marcado en el perfil del hogar', () => {
    const c = cand('A1', { alergenos: ['en:peanuts'] });
    expect(motivo(revisar(c, { alergenos: ['en:peanuts'], ninos: false }))).toBe('alergeno');
    expect(motivo(revisar(c))).toBe('ok');
  });
  it('rechaza edulcorantes si hay niños en el hogar', () => {
    const cereal = prod({ ean: 'C0', categorias: ['en:breakfast-cereals'], ingredientes: 'maíz, azúcar, sucralosa',
      n: { kcal: 380, azucares: 30, grasas: 5, saturadas: 5, trans: 0, sodioMg: 200 } });
    expect(evaluar(cereal).sellos).toEqual(['azucares', 'saturadas', 'edulcorantes']);
    const c = prod({ ean: 'C1', categorias: ['en:breakfast-cereals'], ingredientes: 'maíz integral, sucralosa',
      n: { kcal: 370, azucares: 5, grasas: 3, saturadas: 0.5, trans: 0, sodioMg: 150 } });
    expect(motivo(revisar(c, { alergenos: [], ninos: true }, cereal))).toBe('edulcorante-ninos');
    expect(motivo(revisar(c, PERFIL_VACIO, cereal))).toBe('ok');
  });
  it('rechaza datos dudosos (energía declarada no cuadra con los macronutrientes)', () => {
    expect(motivo(revisar(cand('D1', { n: { ...base.n, kcal: 100 } })))).toBe('datos-dudosos');
  });
  it('rechaza un candidato al que le falta el sodio', () => {
    const { sodioMg: _s, ...sinSodio } = base.n;
    expect(motivo(revisar(cand('D2', { n: sinSodio })))).toBe('datos-dudosos');
  });
  it('rechaza un candidato que trae un sello que el original no tenía', () => {
    expect(motivo(revisar(cand('N1', { n: { ...base.n, sodioMg: 600 } })))).toBe('sello-nuevo');
  });
  it('rechaza si es más caro', () => {
    expect(motivo(revisar(cand('CARO')))).toBe('mas-caro');
  });
  it('rechaza otro tamaño (más de ±20 %) y otra categoría', () => {
    expect(motivo(revisar(cand('T1', { cantidadNum: 1000 })))).toBe('tamano');
    expect(motivo(revisar(cand('K1', { categorias: ['en:snacks', 'en:chips'] })))).toBe('categoria');
  });
  it('si Jev clasificó ambos con confianza en grupos distintos, no es un cambio válido', () => {
    const ia = (categoria: string, c = 0.9) => ({ nova: 4, novaConfianza: 0.9, categoria, categoriaConfianza: c, modelo: 'jev-1.14.0' });
    const orig = prod({ ...galleta, ia: ia('galletas') });
    expect(motivo(revisar(cand('J1', { ia: ia('cereales') }), PERFIL_VACIO, orig))).toBe('categoria');
    expect(motivo(revisar(cand('J2', { ia: ia('galletas') }), PERFIL_VACIO, orig))).toBe('ok');
    expect(motivo(revisar(cand('J3', { ia: ia('cereales', 0.5) }), PERFIL_VACIO, orig))).toBe('ok'); // poca confianza: no se usa
  });
  it('rechaza si no hay mejora suficiente (mismos sellos y menos del 25 % de reducción)', () => {
    const casiIgual = cand('M1', { ingredientes: galleta.ingredientes, n: { kcal: 480, azucares: 33, grasas: 20, saturadas: 9, trans: 0.2, sodioMg: 300 } });
    expect(motivo(revisar(casiIgual))).toBe('sin-mejora');
  });
});

describe('Propuesta de cambios', () => {
  it('elige el mejor candidato y describe el beneficio con el precio', () => {
    const cambios = proponerCambios([galleta], [galleta, cand('OK'), cand('CARO'), cand('S1', { aditivos: ['en:e508'] })], PERFIL_VACIO, p);
    expect(cambios).toHaveLength(1);
    expect(cambios[0].sugerido.ean).toBe('OK');
    expect(cambios[0].descripcion).toBe('2 sellos menos · ₡150 menos');
  });
  it('con un precio estimado no afirma el ahorro: lo marca como ≈ estimado', () => {
    const mixto: Precios = x => (x.ean === 'G0' ? { colones: 2000, fuente: 'factura' } : { colones: 1850, fuente: 'estimado' });
    const cambios = proponerCambios([galleta], [cand('OK')], PERFIL_VACIO, mixto);
    expect(cambios[0].precioConfirmado).toBe(false);
    expect(cambios[0].descripcion).toBe('2 sellos menos · ≈ ₡150 menos (estimado)');
  });
  it('sin precio conocido: lo dice («precio sin confirmar»)', () => {
    const cambios = proponerCambios([galleta], [cand('SINPRECIO')], PERFIL_VACIO, p);
    expect(cambios[0].precioConfirmado).toBe(false);
    expect(cambios[0].descripcion).toContain('precio sin confirmar');
  });
  it('como máximo 3 cambios aunque haya más posibles', () => {
    const canasta = [0, 1, 2, 3].map(i => prod({ ...galleta, ean: `G${i}` }));
    const candidatos = [0, 1, 2, 3].map(i => cand(`OK${i}`));
    expect(proponerCambios(canasta, candidatos, PERFIL_VACIO, () => undefined)).toHaveLength(3);
  });
  it('no cambia una bebida deportiva por un café: exige la categoría específica, no «bebidas»', () => {
    const bebida = (ean: string, especifica: string, azucares: number) => prod({ ean, categorias: ['en:beverages', especifica],
      ingredientes: 'agua, azúcar', n: { kcal: 30, azucares, grasas: 0, saturadas: 0, trans: 0, sodioMg: 20 } });
    const relleno = Array.from({ length: 60 }, (_, i) => bebida(`R${i}`, 'en:waters', 0));
    const deportiva = bebida('D0', 'en:sports-drinks', 7);       // 28 kcal de azúcar ≥ 3: exceso
    const cafe = bebida('K0', 'en:coffee-drinks', 0);            // sin sellos y «más barato», pero otra categoría
    const deportivaLight = bebida('D1', 'en:sports-drinks', 0.5); // 2 kcal < 3: sin sellos
    const conAlternativa = proponerCambios([deportiva], [...relleno, cafe, deportiva, deportivaLight], PERFIL_VACIO, () => undefined);
    expect(conAlternativa.map(c => c.sugerido.ean)).toEqual(['D1']);
    const sinAlternativa = proponerCambios([deportiva], [...relleno, cafe, deportiva], PERFIL_VACIO, () => undefined);
    expect(sinAlternativa).toEqual([]);
  });
  it('un producto sin sellos no genera cambios', () => {
    expect(proponerCambios([cand('OK')], [cand('OK2', { n: { ...base.n, azucares: 0 } })], PERFIL_VACIO, p).length).toBe(1);
    const sinSellos = prod({ n: { kcal: 100, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 10 } });
    expect(proponerCambios([sinSellos], [cand('OK')], PERFIL_VACIO, p)).toEqual([]);
  });
});
