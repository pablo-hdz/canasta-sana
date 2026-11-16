// Reglas del informe «Diseño de apps móviles actuales» (2026-11-14) que se pueden comprobar en el CSS:
// - WCAG 2.2.2 (nivel A): nada que se mueva solo más de 5 s → ninguna animación infinita ni más larga que 5 s.
// - Entradas cortas (NN/g): las animaciones de una sola vez duran ≤ 500 ms.
// - Respetar el tamaño de letra del teléfono: tamaños en rem (salvo el texto dentro de SVG, que escala con el dibujo).
// - Se apagan con «reducir movimiento» del teléfono y con Ajustes → «Quitar las animaciones».
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const animaciones = [...css.matchAll(/([^{}]+)\{[^{}]*?animation:\s*([^;}]+)/g)].map(m => ({ selector: m[1].trim(), valor: m[2].trim() }));
const segundos = (v: string) => { const m = v.match(/(\d*\.?\d+)(ms|s)\b/); return m ? Number(m[1]) / (m[2] === 'ms' ? 1000 : 1) : 0; };
const veces = (v: string) => { const m = v.match(/\s(\d+)(?:\s|$)/); return m ? Number(m[1]) : 1; };

describe('Movimiento y letra (accesibilidad)', () => {
  it('hay animaciones que revisar (la prueba no está vacía)', () => {
    expect(animaciones.length).toBeGreaterThan(10);
  });
  it('ninguna animación es infinita ni dura más de 5 s en total (WCAG 2.2.2)', () => {
    const largas = animaciones.filter(a => !/\bnone\b/.test(a.valor))
      .filter(a => /infinite/.test(a.valor) || segundos(a.valor) * veces(a.valor) > 5)
      .map(a => `${a.selector}: ${a.valor}`);
    expect(largas).toEqual([]);
  });
  it('las entradas de una sola vez (pantallas, anillo, barras, sellos) duran ≤ 500 ms', () => {
    const entradas = animaciones.filter(a => /^(aparecer|arco|crecer|crecerY|fundido|aparecerFruta|dibuja)\b/.test(a.valor));
    expect(entradas.length).toBeGreaterThan(5);
    expect(entradas.filter(a => segundos(a.valor) > 0.5).map(a => `${a.selector}: ${a.valor}`)).toEqual([]);
  });
  it('se apagan con «reducir movimiento» y con «Quitar las animaciones»', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{\s*\*\s*\{[^}]*animation: none !important/);
    expect(css).toMatch(/:root\[data-animaciones="no"\] \*[^{]*\{[^}]*animation: none !important/);
    expect(css).toMatch(/:root\[data-animaciones="no"\] \.ani-dibuja \{[^}]*stroke-dashoffset: 0/);   // la marca queda visible
  });
  it('el «brinco» al pasar el cursor solo existe con mouse, sin «reducir movimiento», y dura ≤ 0,5 s', () => {
    const bloque = css.match(/@media \(hover: hover\) and \(prefers-reduced-motion: no-preference\) \{([\s\S]*?)\n\}/);
    expect(bloque).not.toBeNull();
    expect(bloque![1]).toMatch(/\.boton\.primario:not\(:disabled\):hover[^{]*\{[^}]*animation: brinco/);
    const brincos = animaciones.filter(a => /^(brinco|ladeo)\b/.test(a.valor));
    expect(brincos.length).toBeGreaterThanOrEqual(3);
    expect(brincos.filter(a => segundos(a.valor) > 0.5)).toEqual([]);
  });
  it('los tamaños de letra están en rem, salvo el texto dentro del anillo (SVG)', () => {
    const enPx = [...css.matchAll(/([^{}]+)\{[^{}]*?font-size:\s*(\d+(?:\.\d+)?)px/g)].map(m => m[1].trim());
    expect(enPx.every(s => s.startsWith('.anillo'))).toBe(true);
    const rems = [...css.matchAll(/font-size:\s*(\d*\.?\d+)rem/g)].map(m => Number(m[1]));
    expect(Math.min(...rems)).toBeGreaterThanOrEqual(1);   // ≥ 16 px con la letra normal del teléfono (RNF-04)
  });
});
