import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoriaVisual, saludo } from './visual';

const p = (categorias: string[], nombre = 'Producto') => ({ categorias, nombre });

describe('Categoría visual (solo para el ícono)', () => {
  it('lo más específico gana: la leche es lácteo aunque también sea bebida', () => {
    expect(categoriaVisual(p(['en:beverages', 'en:dairies', 'en:milks']))).toBe('lacteo');
    expect(categoriaVisual(p(['en:beverages', 'en:sodas']))).toBe('bebida');
    expect(categoriaVisual(p(['en:snacks', 'en:biscuits']))).toBe('snack');
    expect(categoriaVisual(p(['en:plant-based-foods', 'en:cereals-and-potatoes', 'en:rices']))).toBe('grano');
    expect(categoriaVisual(p(['en:breakfast-cereals']))).toBe('cereal');
    expect(categoriaVisual(p(['en:condiments', 'en:sauces']))).toBe('salsa');
  });
  it('sin categoría, por el nombre; si no, «otro»', () => {
    expect(categoriaVisual(p([], 'Atún en agua'))).toBe('carne');
    expect(categoriaVisual(p([], 'Frijoles negros'))).toBe('grano');
    expect(categoriaVisual(p([], 'Bolsa reutilizable'))).toBe('otro');
  });
  it('con la base real, la mayoría de productos tiene un ícono propio', () => {
    const base = JSON.parse(readFileSync(new URL('../../public/datos/productos_cr.json', import.meta.url), 'utf8')).productos;
    const otros = base.filter((x: { categorias: string[]; nombre: string }) => categoriaVisual(x) === 'otro').length;
    expect(otros / base.length).toBeLessThan(0.35);
  });
  it('saludo según la hora', () => {
    expect(saludo(7)).toBe('Buenos días');
    expect(saludo(13)).toBe('Buenas tardes');
    expect(saludo(21)).toBe('Buenas noches');
    expect(saludo(2)).toBe('Buenas noches');
  });
});

describe('Por nombre, con y sin tilde (la base trae muchos productos sin categoría)', () => {
  it.each([
    ['Quesitos Tosty', 'snack'], ['Potato Chips', 'snack'], ['Campechanas', 'snack'], ['Coca-Cola', 'bebida'],
    ['Néctar de pera', 'bebida'], ['Café molido', 'bebida'], ['Lactocrema taza 210g DP', 'lacteo'], ['Crema para cocinar', 'lacteo'],
    ['Quick Oats', 'cereal'], ['Corn flakes hojuelas de maíz', 'cereal'], ['Maiz Cascado', 'grano'], ['Azucar Blanca Doña María', 'salsa'],
    ['Peanut Butter', 'salsa'], ['Aceite extra virgen de oliva', 'salsa'], ['Salchichas de pollo', 'carne'], ['Multicereal con pasas', 'cereal'],
    // Fruta y verdura (v0.2.1): después de bebidas y despensa, para que un jugo o una salsa no cambien de ícono.
    ['Naranjas', 'fruta'], ['Piña en almíbar', 'fruta'], ['Jugo de naranja', 'bebida'], ['Mermelada de fresa', 'salsa'],
    ['Zanahoria rallada', 'verdura'], ['Mouline de légume vert', 'verdura'], ['Salsa de tomate', 'salsa'], ['Maíz dulce', 'grano'],
    ['Galleta Sponch Fresa', 'snack'], ['Alaska Sabor Fresa', 'otro'], ['Coco rallado deshidratado', 'fruta'], ['Vegis Bocadillos De Papa Y Vegetales', 'otro'],
  ])('%s → %s', (nombre, cat) => {
    expect(categoriaVisual({ categorias: [], nombre })).toBe(cat);
  });
});
