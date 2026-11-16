// B-14 (sprint 1, RNF-04): el texto principal mide ≥ 18 px (1,125 rem con la letra normal del teléfono).
// Son los que la auditoría B-10 midió en 16 px: explicación de los sellos, avisos del paso 4, cuadro para pegar
// texto y botones «Foto» de Colorantes. La auditoría en el navegador (320 px y letra al 200 %) está en el README.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./estilos.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const tamano = (selector: string) => {
  const regla = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find(m => m[1].trim() === selector);
  const fs = regla?.[2].match(/font-size:\s*([\d.]+)rem/);
  return fs ? Number(fs[1]) : undefined;
};

describe('Texto principal ≥ 18 px (B-14)', () => {
  it.each(['.explicacion li', '.avisos-producto li', 'textarea'])('%s mide ≥ 1,125 rem', sel => {
    expect(tamano(sel)).toBeGreaterThanOrEqual(1.125);
  });
  it('los botones «Foto» de Colorantes miden ≥ 1,125 rem', () => {
    const fuente = readFileSync(new URL('./pantallas/Colorantes.tsx', import.meta.url), 'utf8');
    const tamanos = [...fuente.matchAll(/fontSize: '([\d.]+)rem'/g)].map(m => Number(m[1]));
    expect(tamanos.length).toBeGreaterThan(0);
    expect(Math.min(...tamanos)).toBeGreaterThanOrEqual(1.125);
  });
});
