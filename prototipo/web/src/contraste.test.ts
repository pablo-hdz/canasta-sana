// Contraste WCAG 2.x de los colores de la app, en modo claro y oscuro (D-07: texto ≥ 4,5:1).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8');

function fichas(bloque: string): Record<string, string> {
  return Object.fromEntries([...bloque.matchAll(/--([a-z-]+):\s*(#[0-9A-Fa-f]{6})/g)].map(m => [m[1], m[2].toUpperCase()]));
}
const claro = fichas(css.match(/:root\s*\{([\s\S]*?)\}/)![1]);
const oscuroManual = fichas(css.match(/:root\[data-tema="oscuro"\]\s*\{([\s\S]*?)\}/)![1]);
const oscuroSistema = fichas(css.match(/:root:not\(\[data-tema="claro"\]\)\s*\{([\s\S]*?)\}/)![1]);

function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

// [texto, fondo, mínimo]: cada combinación que usa estilos.css (texto ≥ 4,5:1; gráficos y bordes ≥ 3:1).
const CATEGORIAS = ['bebida', 'lacteo', 'snack', 'cereal', 'salsa', 'grano', 'carne', 'fruta', 'verdura', 'otro'];
const PARES: [string, string, number][] = [
  ['texto', 'superficie', 4.5], ['texto', 'tarjeta', 4.5], ['texto', 'ambar-claro', 4.5], ['texto', 'acento-claro', 4.5],
  ['gris', 'superficie', 4.5], ['gris', 'tarjeta', 4.5], ['gris', 'ambar-claro', 4.5], ['gris', 'acento-claro', 4.5],
  ['marca', 'superficie', 4.5], ['marca', 'tarjeta', 4.5], ['marca', 'acento-claro', 4.5],
  ['texto', 'hero', 4.5], ['gris', 'hero', 4.5], ['texto', 'amarillo-claro', 4.5], ['gris', 'amarillo-claro', 4.5],   // tarjeta principal y etiquetas de beneficio
  ['sobre-acento', 'acento', 4.5],                    // botón principal, paso actual y globo de la lista
  ['ambar', 'tarjeta', 4.5], ['ambar', 'ambar-claro', 4.5],
  ['tarjeta', 'texto', 4.5],                          // chip activo y detalle del gráfico (invertidos)
  ['foco', 'superficie', 3], ['foco', 'tarjeta', 3],
  ['marca', 'superficie', 3],                         // borde del botón secundario
  ['acento-grafico', 'tarjeta', 3],                   // anillo y barras
  ['estado-bajo', 'tarjeta', 3], ['estado-medio', 'tarjeta', 3], ['estado-alto', 'tarjeta', 3],   // anillo por nivel
  ['estado-medio', 'superficie', 3], ['estado-alto', 'superficie', 3],
  ['rojo', 'rojo-claro', 4.5], ['marca', 'acento-claro', 4.5],                                    // etiquetas de nivel
  ['n-azucares', 'tarjeta', 3], ['n-sodio', 'tarjeta', 3], ['n-saturadas', 'tarjeta', 3], ['n-grasas', 'tarjeta', 3],
  ...CATEGORIAS.map(c => [`i-${c}`, `t-${c}`, 3] as [string, string, number]),   // íconos de categoría
];

describe('Contraste de colores (WCAG)', () => {
  it('el modo oscuro manual y el del sistema usan los mismos colores', () => {
    expect(oscuroManual).toEqual(oscuroSistema);
    expect(Object.keys(oscuroManual).sort()).toEqual(Object.keys(claro).sort());
  });
  it('la fórmula da los valores de referencia (negro/blanco 21:1)', () => {
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contraste('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
  for (const [tema, f] of [['claro', claro], ['oscuro', oscuroManual]] as const) {
    it(`modo ${tema}: todos los pares cumplen`, () => {
      const fallas = PARES.map(([t, fo, min]) => ({ par: `${t} sobre ${fo}`, c: contraste(f[t], f[fo]), min }))
        .filter(x => x.c < x.min).map(x => `${x.par}: ${x.c.toFixed(2)} < ${x.min}`);
      expect(fallas).toEqual([]);
    });
  }
});
