// Casos calculados a mano con los criterios OPS 2016 (panel C) y el método de azúcares libres (panel D).
import { describe, expect, it } from 'vitest';
import { ENERGIA_MAX, ENERGIA_MIN, azucaresLibres, datosDudosos, energia, energiaDudosa, evaluar } from './ops';
import { prod } from './fabrica';

describe('Modelo OPS: casos calculados a mano', () => {
  it('gaseosa: 10,6 g × 4 = 42,4 kcal ≥ 10 % de 42 kcal → exceso de azúcares; sodio 10/42 < 1', () => {
    const p = prod({ categorias: ['en:beverages', 'en:sodas'], ingredientes: 'agua carbonatada, azúcar, colorante caramelo, ácido fosfórico',
      n: { kcal: 42, azucares: 10.6, sodioMg: 10, grasas: 0, saturadas: 0, trans: 0 } });
    expect(evaluar(p).sellos).toEqual(['azucares']);
  });

  it('galleta rellena con leche: azúcares al 75 %, grasas 180 ≥ 144, saturadas 81 ≥ 48; trans 1,8 < 4,8; sodio 0,63', () => {
    const p = prod({ categorias: ['en:snacks', 'en:biscuits'], ingredientes: 'harina de trigo, azúcar, aceite de palma, cacao, sal, leche en polvo',
      n: { kcal: 480, azucares: 35, grasas: 20, saturadas: 9, trans: 0.2, sodioMg: 300 } });
    const e = evaluar(p);
    expect(e.azucaresLibres).toBeCloseTo(26.25, 6);
    expect(e.sellos).toEqual(['azucares', 'saturadas', 'grasas']);
  });

  it('salchicha: sodio 900/250 = 3,6 ≥ 1; grasas 180 ≥ 75; saturadas 63 ≥ 25; azúcares 8 < 25', () => {
    const p = prod({ categorias: ['en:meats', 'en:sausages'], ingredientes: 'carne de pollo, agua, almidón, sal, azúcar, especias',
      n: { kcal: 250, azucares: 2, grasas: 20, saturadas: 7, trans: 0, sodioMg: 900 } });
    expect(evaluar(p).sellos).toEqual(['sodio', 'saturadas', 'grasas']);
  });

  it('yogur de fresa: azúcares al 50 % (6 g → 24 ≥ 9); saturadas 14,4 ≥ 9; grasas 22,5 < 27', () => {
    const p = prod({ categorias: ['en:dairies', 'en:yogurts'], ingredientes: 'leche, azúcar, fresa, almidón',
      n: { kcal: 90, azucares: 12, grasas: 2.5, saturadas: 1.6, trans: 0, sodioMg: 50 } });
    const e = evaluar(p);
    expect(e.azucaresLibres).toBe(6);
    expect(e.sellos).toEqual(['azucares', 'saturadas']);
  });

  it('bebida dietética: edulcorantes por aditivo; 0 kcal con sodio > 0 → exceso de sodio (lectura literal)', () => {
    const p = prod({ categorias: ['en:beverages'], ingredientes: 'agua carbonatada, ácido cítrico', aditivos: ['en:e951', 'en:e950'],
      n: { kcal: 0, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 15 } });
    expect(evaluar(p).sellos).toEqual(['sodio', 'edulcorantes']);
  });

  it('edulcorante detectado en el texto de ingredientes (sucralosa)', () => {
    const p = prod({ ingredientes: 'agua, sucralosa', n: { kcal: 2, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 1 } });
    expect(evaluar(p).sellos).toContain('edulcorantes');
  });

  it('límites exactos: 10 % de azúcares y 1 mg/kcal de sodio cuentan como exceso (≥)', () => {
    const azucar = prod({ n: { kcal: 40, azucares: 1, azucaresAnadidos: 1, grasas: 0, saturadas: 0, trans: 0, sodioMg: 0 } });
    expect(evaluar(azucar).sellos).toEqual(['azucares']);
    const sodio = prod({ n: { kcal: 200, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 200 } });
    expect(evaluar(sodio).sellos).toEqual(['sodio']);
    const casi = prod({ n: { kcal: 200, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 199 } });
    expect(evaluar(casi).sellos).toEqual([]);
  });

  it('azúcares intrínsecos: sin azúcar en los ingredientes → 0 g libres', () => {
    const p = prod({ categorias: ['en:yogurts'], ingredientes: 'leche, cultivos lácticos', nova: 3,
      n: { kcal: 60, azucares: 5, grasas: 0, saturadas: 0, trans: 0, sodioMg: 40 } });
    expect(azucaresLibres(p)).toEqual({ g: 0, metodo: 'Sin azúcares en los ingredientes: azúcares intrínsecos' });
    expect(evaluar(p).sellos).toEqual([]);
  });

  it('alcance: NOVA 1 y 2 no se clasifican; sin NOVA, la categoría miel tampoco', () => {
    expect(evaluar(prod({ nova: 1, categorias: ['en:rices'] })).aplica).toBe(false);
    expect(evaluar(prod({ nova: 2, categorias: ['en:vegetable-oils'] })).aplica).toBe(false);
    const miel = evaluar(prod({ nova: null, categorias: ['en:honeys'] }));
    expect(miel.aplica).toBe(false);
    expect(miel.alcanceEstimado).toBe(true);
  });

  it('energía calculada 4·60 + 4·10 + 9·10 = 370 kcal y control de energía', () => {
    expect(energia({ carbohidratos: 60, proteinas: 10, grasas: 10 })).toEqual({ kcal: 370, calculada: true });
    expect(datosDudosos({ kcal: 100, carbohidratos: 60, proteinas: 10, grasas: 10 })).toBe(true);
    expect(datosDudosos({ kcal: 370, carbohidratos: 60, proteinas: 10, grasas: 10 })).toBe(false);
  });

  it('B-01: energía incoherente → dato dudoso; la mayonesa Sabemas (5 kcal, 5,6 g de grasa) ya no da 4 sellos', () => {
    // Datos de la base (7441078227655): 4·0,6 + 4·0 + 9·5,6 = 52,8 kcal; 5 < 0,7 × 52,8 = 36,96 → energía dudosa.
    const mayonesa = prod({ categorias: ['en:sauces'], ingredientes: 'aceite, agua, jugo de limón',
      n: { kcal: 5, azucares: 0.2, grasas: 5.6, saturadas: 0.6, carbohidratos: 0.6, proteinas: 0, sodioMg: 4000 } });
    const e = evaluar(mayonesa);
    expect(e.sellos).toEqual([]);   // antes: azúcares, sodio, saturadas y grasas
    expect(e.faltantes).toContain('energía (dato dudoso)');
    expect(e.datosDudosos).toBe(true);
    // Con edulcorantes, ese sello sí queda: no depende de la energía.
    expect(evaluar({ ...mayonesa, aditivos: ['en:e955'] }).sellos).toEqual(['edulcorantes']);
  });

  it('B-01: límites del control de energía (70 % y 130 % de 4·C + 4·P + 9·G = 370 kcal)', () => {
    const m = { carbohidratos: 60, proteinas: 10, grasas: 10 };
    expect(ENERGIA_MIN * 370).toBeCloseTo(259);
    expect(ENERGIA_MAX * 370).toBeCloseTo(481);
    expect(energiaDudosa({ kcal: 370, ...m })).toBe(false);
    expect(energiaDudosa({ kcal: 259, ...m })).toBe(false);
    expect(energiaDudosa({ kcal: 258, ...m })).toBe(true);
    expect(energiaDudosa({ kcal: 481, ...m })).toBe(false);
    expect(energiaDudosa({ kcal: 482, ...m })).toBe(true);
    expect(energiaDudosa({ kcal: 0, grasas: 5 })).toBe(true);                       // 0 kcal con 45 kcal de grasa
    expect(energiaDudosa({ kcal: 0, azucares: 0, grasas: 0, sodioMg: 15 })).toBe(false);   // bebida de 0 kcal
    expect(energiaDudosa({ kcal: 5, grasas: 1 })).toBe(false);                      // valores ínfimos (< 20 kcal)
    expect(energiaDudosa({ kcal: 5000, grasas: 1 })).toBe(true);                    // > 900 kcal/100 g es imposible
    expect(energiaDudosa({ kcal: 2000, grasas: 100 })).toBe(true);
    expect(energiaDudosa({ kcal: 884, grasas: 100, carbohidratos: 0, proteinas: 0 })).toBe(false);   // aceite
    expect(energiaDudosa({ kcal: 500, grasas: 10 })).toBe(false);   // sin todos los macronutrientes no hay tope de 130 %
    expect(energiaDudosa({ grasas: 10 })).toBe(false);              // sin kcal declaradas se calculan (energia())
  });

  it('error de unidad (sodio en mg anotado como g): no da sello falso, lo marca como dato dudoso', () => {
    const yogur = prod({ categorias: ['en:dairies', 'en:yogurts'], ingredientes: 'leche, cultivos', nova: 3,
      n: { kcal: 98, azucares: 0, grasas: 2, saturadas: 1, trans: 0, sodioMg: 27733.3 } });
    const e = evaluar(yogur);
    expect(e.sellos).not.toContain('sodio');
    expect(e.faltantes).toContain('sodio (dato dudoso)');
    expect(e.datosDudosos).toBe(true);
  });
  it('salsa de soya con 7060 mg/100 ml es verosímil: sí lleva el sello de sodio', () => {
    const soya = prod({ categorias: ['en:condiments', 'en:sauces', 'en:soy-sauces'], ingredientes: 'agua, soya, sal',
      n: { kcal: 60, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 7060 } });
    expect(evaluar(soya).sellos).toEqual(['sodio']);
    expect(evaluar(prod({ categorias: ['en:salts'], nova: 3, n: { kcal: 0, sodioMg: 41600 } })).faltantes).toContain('sodio (dato dudoso)');
  });
  it('sin NOVA en la base: usa el NOVA estimado por Jev solo con confianza ≥ 0,8 y lo dice', () => {
    const ia = (nova: number, novaConfianza: number) => ({ nova, novaConfianza, categoria: 'galletas', categoriaConfianza: 0.9, modelo: 'jev-1.14.0' });
    const huevo = prod({ nova: null, categorias: ['en:farming-products'], ia: ia(1, 0.95) });
    expect(evaluar(huevo).aplica).toBe(false);
    expect(evaluar(huevo).motivo).toContain('estimado por IA, 95 %');
    const dudosa = prod({ nova: null, nombre: 'Producto X', ingredientes: '', categorias: ['en:farming-products'], ia: ia(1, 0.55) });
    expect(evaluar(dudosa).motivo).toBe('Se asume procesado (sin dato NOVA)');
    const conDatoOFF = prod({ nova: 4, ia: ia(1, 0.99) }); // el dato de Open Food Facts manda sobre la IA
    expect(evaluar(conDatoOFF).aplica).toBe(true);
  });
  it('dato faltante de trans: no inventa el sello y lo reporta', () => {
    const e = evaluar(prod({ n: { kcal: 100, azucares: 0, grasas: 1, saturadas: 0, sodioMg: 10 } }));
    expect(e.sellos).toEqual([]);
    expect(e.faltantes).toEqual(['grasas trans']);
  });
});
