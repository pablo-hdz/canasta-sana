import { describe, expect, it } from 'vitest';
import { estimarNova } from './clasificar';
import { evaluar } from './ops';
import { prod } from './fabrica';

const sinDatos = (nombre: string) => prod({ nombre, nova: null, ingredientes: '', aditivos: [], categorias: [] });

describe('Estimación NOVA con reglas', () => {
  it('ingredientes con marcadores de ultraprocesado → NOVA 4 con confianza alta', () => {
    const e = estimarNova(prod({ nova: null, ingredientes: 'harina, azúcar, aceite vegetal hidrogenado, emulsificante (lecitina de soya), saborizante artificial' }));
    expect(e).toMatchObject({ nova: 4, fuente: 'ingredientes', confianza: 0.9 });
  });
  it('aditivo colorante (E129) delata un ultraprocesado', () => {
    expect(estimarNova(prod({ nova: null, ingredientes: 'agua, azúcar', aditivos: ['en:e129'] }))?.nova).toBe(4);
  });
  it('un solo ingrediente culinario → NOVA 2; pocos ingredientes con sal → NOVA 3', () => {
    expect(estimarNova(prod({ nova: null, ingredientes: 'aceite de oliva extra virgen' }))?.nova).toBe(2);
    expect(estimarNova(prod({ nova: null, ingredientes: 'atún, agua, sal' }))?.nova).toBe(3);
  });
  it('ignora «ingredientes» que en realidad son OCR de la tabla nutricional y usa la categoría', () => {
    const basura = 'Amount per Serving/ Cantidades por Porción Nutrition Facts Información Nutricional Calories 120 Sodium 215mg';
    const e = estimarNova(prod({ nova: null, ingredientes: basura, categorias: ['en:snacks', 'en:biscuits'] }));
    expect(e).toMatchObject({ nova: 4, fuente: 'categoria' });
  });
  it('vinagre: ingrediente culinario aunque también esté en «condimentos»', () => {
    expect(estimarNova(prod({ nova: null, ingredientes: '', categorias: ['en:condiments', 'en:vinegars'] }))?.nova).toBe(2);
  });
  it('solo con el nombre: gaseosa, chips y «sabor a» son ultraprocesados; un cappuccino también', () => {
    expect(estimarNova(sinDatos('Coca-Cola'))?.nova).toBe(4);
    expect(estimarNova(sinDatos('Potato Chips'))?.nova).toBe(4);
    expect(estimarNova(sinDatos('Leche sabor a fresa'))?.nova).toBe(4);
    expect(estimarNova(prod({ nombre: 'Cappuccino Mocca', nova: null, ingredientes: '', categorias: ['en:coffees'] }))?.nova).toBe(4);
  });
  it('leche simple según el panel B de la OPS; la evaporada o de coco no se da por simple', () => {
    expect(estimarNova(sinDatos('Leche semidescremada'))?.nova).toBe(1);
    expect(estimarNova(sinDatos('Leche evaporada'))).toBeUndefined();
    expect(estimarNova(sinDatos('Leche coco'))).toBeUndefined();
  });
  it('en la evaluación: sin NOVA, una leche simple queda fuera del modelo y una gaseosa dentro', () => {
    expect(evaluar(sinDatos('Leche semidescremada')).aplica).toBe(false);
    const g = evaluar(prod({ ...sinDatos('Gaseosa de cola'), n: { kcal: 42, azucares: 10.6, sodioMg: 10, grasas: 0, saturadas: 0, trans: 0 } }));
    expect(g.aplica).toBe(true);
    expect(g.motivo).toContain('NOVA 4 estimado');
  });
});
