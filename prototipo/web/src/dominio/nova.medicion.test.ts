// Mide las reglas NOVA contra los productos de la base que SÍ traen NOVA (se oculta el dato y se estima).
// Métrica clave para el modelo OPS: acierto binario «procesado (3-4) / no procesado (1-2)», porque es lo que decide si aplica.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Producto } from './tipos';
import { estimarNova, type FuenteNova } from './clasificar';

const ruta = fileURLToPath(new URL('../../public/datos/productos_cr.json', import.meta.url));
const base: Producto[] = existsSync(ruta) ? JSON.parse(readFileSync(ruta, 'utf8')).productos : [];
const conocidos = base.filter(p => p.nova);

describe.skipIf(!conocidos.length)(`Reglas NOVA contra ${conocidos.length} productos con NOVA conocido`, () => {
  it('reporta cobertura y exactitud por nivel, y exige ≥ 90 % de acierto binario en lo que estima', () => {
    const filas: Record<FuenteNova, { n: number; exacto: number; binario: number }> = {
      ingredientes: { n: 0, exacto: 0, binario: 0 }, categoria: { n: 0, exacto: 0, binario: 0 }, nombre: { n: 0, exacto: 0, binario: 0 } };
    // También el nivel «solo nombre», que es lo único que tienen la mayoría de productos sin NOVA.
    const soloNombre = { n: 0, exacto: 0, binario: 0 };
    const fallos: string[] = [];
    const fallosNombre: string[] = [];
    for (const p of conocidos) {
      const e = estimarNova(p);
      if (e) {
        const f = filas[e.fuente];
        f.n++; if (e.nova === p.nova) f.exacto++;
        if ((e.nova >= 3) === (p.nova! >= 3)) f.binario++; else if (fallos.length < 10) fallos.push(`${p.nombre} (real ${p.nova}, estimado ${e.nova} por ${e.fuente}: ${e.motivo})`);
      }
      const n = estimarNova({ ...p, ingredientes: '', aditivos: [], categorias: [] });
      if (n) {
        soloNombre.n++; if (n.nova === p.nova) soloNombre.exacto++;
        if ((n.nova >= 3) === (p.nova! >= 3)) soloNombre.binario++;
        else if (fallosNombre.length < 12) fallosNombre.push(`${p.nombre} (real ${p.nova}, estimado ${n.nova}: ${n.motivo})`);
      }
    }
    const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)} %` : '—');
    const sinNova = base.filter(p => !p.nova);
    const estimados = sinNova.map(estimarNova).filter(Boolean);
    console.log(`Productos SIN NOVA en la base: ${sinNova.length}; estimados por reglas: ${estimados.length} (${pct(estimados.length, sinNova.length)}); `
      + `por nivel: ${['ingredientes', 'categoria', 'nombre'].map(f => `${f} ${estimados.filter(e => e!.fuente === f).length}`).join(', ')}`);
    const total = Object.values(filas).reduce((s, f) => ({ n: s.n + f.n, exacto: s.exacto + f.exacto, binario: s.binario + f.binario }), { n: 0, exacto: 0, binario: 0 });
    console.log([
      ...Object.entries(filas).map(([k, f]) => `${k.padEnd(12)} n=${String(f.n).padStart(3)}  exacto ${pct(f.exacto, f.n).padStart(7)}  binario ${pct(f.binario, f.n)}`),
      `cascada     n=${total.n} de ${conocidos.length} (cobertura ${pct(total.n, conocidos.length)})  exacto ${pct(total.exacto, total.n)}  binario ${pct(total.binario, total.n)}`,
      `solo nombre n=${soloNombre.n} (cobertura ${pct(soloNombre.n, conocidos.length)})  exacto ${pct(soloNombre.exacto, soloNombre.n)}  binario ${pct(soloNombre.binario, soloNombre.n)}`,
      ...fallos.map(f => `  fallo: ${f}`),
      ...fallosNombre.map(f => `  fallo (solo nombre): ${f}`),
    ].join('\n'));
    expect(total.binario / total.n).toBeGreaterThanOrEqual(0.9);
  });
});
