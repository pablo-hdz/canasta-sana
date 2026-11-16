// Prueba de punta a punta con la base real de Open Food Facts y 50 tiquetes SIMULADO.
// Mide lo que se puede medir sin tiquetes reales: lectura de líneas, cuadre del total,
// precisión de la identificación (RF-02, meta ≥ 95 %) y si los cambios cumplen las reglas.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Producto } from './tipos';
import { evaluar } from './ops';
import { leerTiquete } from './tiquete';
import { identificar, normalizar } from './identificar';
import { PERFIL_VACIO, proponerCambios, revisarCandidato } from './cambios';
import { precioSimulado, tiqueteSimulado } from './simulados';

const ruta = fileURLToPath(new URL('../../public/datos/productos_cr.json', import.meta.url));
const hayBase = existsSync(ruta);
const base: Producto[] = hayBase ? JSON.parse(readFileSync(ruta, 'utf8')).productos : [];
const TIQUETES = 50;

// Mismo producto con otro código (Open Food Facts tiene duplicados): mismo nombre, marca y tamaño.
const clave = (p: Producto) => `${normalizar(p.nombre)}|${normalizar(p.marca)}|${p.cantidadNum ?? ''}${p.unidad ?? ''}`;

describe.skipIf(!hayBase)(`Flujo completo con la base real (${base.length} productos)`, () => {
  it('lee, cuadra, identifica y propone cambios seguros en 50 tiquetes SIMULADO', () => {
    let lineas = 0, leidas = 0, cuadran = 0, identificadas = 0, correctas = 0, conCambios = 0, cambiosTot = 0;
    const errores: string[] = [];
    const ejemplos: string[] = [];
    for (let s = 1; s <= TIQUETES; s++) {
      const t = tiqueteSimulado(base, s, 12);
      const leido = leerTiquete(t.texto);
      lineas += t.verdad.length;
      leidas += leido.lineas.length;
      if (leido.cuadra) cuadran++;
      const canasta: Producto[] = [];
      leido.lineas.forEach((l, i) => {
        const id = identificar(l.descripcion, base);
        if (id.dudoso || !id.producto) return;
        identificadas++;
        const real = base.find(p => p.ean === t.verdad[i]?.ean)!;
        if (id.producto.ean === real.ean || clave(id.producto) === clave(real)) correctas++;
        else if (errores.length < 8) errores.push(`«${l.descripcion}» → ${id.producto.nombre} (era ${real.nombre})`);
        canasta.push(id.producto);
      });
      const cambios = proponerCambios(canasta, base, PERFIL_VACIO, precioSimulado);
      if (cambios.length) conCambios++;
      cambiosTot += cambios.length;
      for (const c of cambios) {
        if (ejemplos.length < 12) ejemplos.push(`  cambio: ${c.original.nombre} [${c.sellosOriginal.join(', ')}] → ${c.sugerido.nombre} [${c.sellosSugerido.join(', ') || 'sin sellos'}]`);
        const r = revisarCandidato(c.original, evaluar(c.original), c.sugerido, PERFIL_VACIO, precioSimulado,
          c.original.categorias.find(x => c.sugerido.categorias.includes(x)));
        expect(r.ok, `cambio inválido: ${c.original.nombre} → ${c.sugerido.nombre}`).toBe(true);
      }
    }
    const pct = (a: number, b: number) => `${((100 * a) / b).toFixed(1)} %`;
    const aplica = base.filter(p => evaluar(p).aplica);
    const conSellos = aplica.filter(p => evaluar(p).sellos.length > 0);
    const dudosos = base.filter(p => evaluar(p).faltantes.some(f => f.includes('dudoso')));
    console.log(`Datos dudosos (error de unidad u otro): ${dudosos.length} productos (${pct(dudosos.length, base.length)}).`);
    console.log([
      `Base: ${base.length} productos; el modelo OPS aplica a ${aplica.length} (${pct(aplica.length, base.length)}); con sellos ${conSellos.length} (${pct(conSellos.length, aplica.length)} de esos).`,
      `Líneas leídas: ${leidas}/${lineas} (${pct(leidas, lineas)}); tiquetes que cuadran: ${cuadran}/${TIQUETES}.`,
      `Identificación: cobertura ${identificadas}/${lineas} (${pct(identificadas, lineas)}); precisión ${correctas}/${identificadas} (${pct(correctas, identificadas)}).`,
      `Cambios: ${cambiosTot} en total; ${conCambios}/${TIQUETES} tiquetes con al menos uno.`,
      ...errores.map(e => `  error: ${e}`),
      ...ejemplos,
    ].join('\n'));
    expect(leidas).toBe(lineas);
    expect(cuadran).toBe(TIQUETES);
    expect(correctas / identificadas).toBeGreaterThanOrEqual(0.95);
  });
});

// B-20 (sprint 2): el ejemplo SIMULADO usa solo productos con nombre en español.
import { nombreEnEspanol } from './simulados';
describe('Ejemplo SIMULADO en español (B-20)', () => {
  it('la heurística reconoce nombres en otro idioma', () => {
    for (const n of ['Mouline de légume vert', 'Rôti tessinois', 'Thé Digextivan', 'Chocolate chip cookies', 'Peanut butter with honey', 'Premium carved Cooked ham', 'Fat Bomba Snack Mix', 'Happy Orange Ginger Tea', 'Tartines spécial campagne', 'Red Grapefruit juice'])
      expect(nombreEnEspanol(n), n).toBe(false);
    for (const n of ['Galleta de avena', 'Jugo de naranja', 'Salsa Lizano', 'Arroz 99 % grano entero', 'Yogurt Bio Defensa', 'Piña en almíbar', 'Golden Berry y Bananas Cereal', 'Sprite sabor lima-limón'])
      expect(nombreEnEspanol(n), n).toBe(true);
  });
  it.skipIf(!hayBase)('50 tiquetes SIMULADO: ningún producto con nombre en otro idioma', () => {
    const porEan = new Map(base.map(p => [p.ean, p]));
    const otros = Array.from({ length: 50 }, (_, s) => tiqueteSimulado(base, s + 1, 12).verdad)
      .flat().map(v => porEan.get(v.ean)!.nombre).filter(n => !nombreEnEspanol(n));
    expect(otros).toEqual([]);
  });
});
