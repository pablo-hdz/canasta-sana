// Ilustraciones (v0.2.5): cada degradado que usa un dibujo existe en <DefinicionesIlustraciones />, todo es
// decorativo (aria-hidden) y no hay recursos externos (la CSP de producción los bloquearía).
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DefinicionesIlustraciones, EscenaExito, EscenaInicio, EscenaLeyendo, EscenaVacia, IconoIlustrado, IconoOpcion } from './ilustraciones';
import type { CategoriaVisual } from './dominio/visual';

const CATEGORIAS: CategoriaVisual[] = ['fruta', 'verdura', 'bebida', 'lacteo', 'snack', 'cereal', 'salsa', 'grano', 'carne', 'otro'];
const dibujos = [
  <EscenaInicio key="inicio" />, <EscenaLeyendo key="leyendo" />, <EscenaExito key="exito" />,
  ...(['tiquete', 'lista', 'progreso'] as const).map(t => <EscenaVacia key={t} tipo={t} />),
  ...(['galeria', 'factura', 'ejemplo', 'pegar'] as const).map(t => <IconoOpcion key={t} tipo={t} />),
  ...CATEGORIAS.map(c => <IconoIlustrado key={c} cat={c} />),
];

describe('Ilustraciones', () => {
  const defs = renderToStaticMarkup(<DefinicionesIlustraciones />);
  const definidos = new Set([...defs.matchAll(/id="(il-[\w-]+)"/g)].map(m => m[1]));

  it('cada degradado usado está definido (ningún dibujo queda sin color)', () => {
    const usados = new Set(dibujos.flatMap(d => [...renderToStaticMarkup(d).matchAll(/url\(#(il-[\w-]+)\)/g)].map(m => m[1])));
    expect(usados.size).toBeGreaterThan(20);
    expect([...usados].filter(id => !definidos.has(id))).toEqual([]);
  });
  it('los degradados no se repiten y no se dibujan (solo definiciones)', () => {
    const ids = [...defs.matchAll(/id="(il-[\w-]+)"/g)].map(m => m[1]);
    expect(ids.length).toBe(definidos.size);
    expect(defs).toContain('aria-hidden="true"');
    expect(defs).toMatch(/^<svg width="0" height="0"/);
  });
  it('todos los dibujos son decorativos y sin recursos externos', () => {
    for (const d of dibujos) {
      const h = renderToStaticMarkup(d);
      expect(h).toMatch(/^<svg[^>]*aria-hidden="true"/);
      expect(h).not.toMatch(/https?:|<image|<text/);
    }
  });
});
