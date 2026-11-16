// Pruebas de regresión con tiquetes guardados desde la app (Inicio → Herramientas de prueba → «Guardar caso de prueba»).
// Para agregar un tiquete real: copie el .json descargado a esta carpeta (src/casos/) y corra `npm test`.
// Antes, ábralo y confirme que no tiene datos personales (la app los quita, pero un nombre suelto sin rótulo
// no se puede detectar). Cada archivo se prueba solo:
//   1. El lector de tiquetes sigue obteniendo las líneas que la persona aceptó, con el mismo total.
//   2. El ruido (líneas que la persona quitó porque no eran productos) no aumenta.
//   3. La identificación, sin los alias de la persona, nunca elige con seguridad un producto distinto del
//      que quedó en la revisión (precisión de RF-02). Si duda y pregunta, no es un error.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Producto } from '../dominio/tipos';
import { leerCaso } from '../dominio/casoPrueba';
import { leerTiquete, unirTiquetes } from '../dominio/tiquete';
import { identificar } from '../dominio/identificar';

const carpeta = fileURLToPath(new URL('.', import.meta.url));
const archivos = readdirSync(carpeta).filter(f => f.endsWith('.json')).sort();
const rutaBase = fileURLToPath(new URL('../../public/datos/productos_cr.json', import.meta.url));
const base: Producto[] = existsSync(rutaBase) ? JSON.parse(readFileSync(rutaBase, 'utf8')).productos : [];
const clave = (l: { descripcion: string; cantidad: number; precio: number }) => `${l.descripcion} | ${l.cantidad} | ${l.precio}`;

describe('Casos de prueba guardados', () => {
  it('hay al menos un caso (el ejemplo SIMULADO)', () => expect(archivos.length).toBeGreaterThan(0));
});

for (const archivo of archivos) {
  const caso = leerCaso(JSON.parse(readFileSync(`${carpeta}/${archivo}`, 'utf8')));
  const aceptadas = caso.lineas.filter(l => !l.quitada);

  describe(`Caso ${archivo}${caso.simulado ? ' (SIMULADO)' : ''}`, () => {
    // La factura XML no se guarda (trae los datos del receptor): sus casos prueban solo la identificación.
    it.skipIf(caso.origen === 'factura-xml')('el lector obtiene las mismas líneas y el mismo total', () => {
      const leido = caso.partes.map(leerTiquete).reduce((a, b) => unirTiquetes(a, b));
      const obtenidas = leido.lineas.map(clave);
      expect(obtenidas).toEqual(expect.arrayContaining(aceptadas.map(clave)));
      expect(obtenidas.length - aceptadas.length).toBeLessThanOrEqual(caso.lineas.filter(l => l.quitada).length);
      expect(leido.total ?? null).toBe(caso.total);
      expect(leido.cuadra ?? null).toBe(caso.cuadra);
    });

    it.skipIf(!base.length)('la identificación no contradice la revisión', () => {
      const conCodigo = aceptadas.filter(l => l.codigo);
      const errores: string[] = [];
      let seguras = 0;
      for (const l of conCodigo) {
        if (!base.some(p => p.ean === l.codigo)) { errores.push(`${l.descripcion}: el código ${l.codigo} ya no está en la base`); continue; }
        const id = identificar(l.descripcion, base, {}, l.codigoLeido ?? undefined);
        if (id.dudoso || !id.producto) continue;
        seguras++;
        if (id.producto.ean !== l.codigo) errores.push(`${l.descripcion}: eligió ${id.producto.ean} (${id.producto.nombre}), la revisión dice ${l.codigo}`);
      }
      expect(errores).toEqual([]);
      console.log(`${archivo}: ${seguras} de ${conCodigo.length} líneas identificadas con seguridad, todas correctas; ${conCodigo.length - seguras} piden ayuda.`);
    });
  });
}
