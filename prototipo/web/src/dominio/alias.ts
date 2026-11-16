// Productos aprendidos (alias): la descripción del tiquete, normalizada, apunta al código del producto que la persona
// eligió en una compra anterior (RF-03). B-03: se ven, se corrigen y se borran uno por uno.
import type { Producto } from './tipos';
import { normalizar } from './identificar';

export type Alias = Record<string, string>;

/** Aprende qué producto es una descripción. Si ya había otro (un alias equivocado), lo reemplaza. */
export const aprender = (alias: Alias, descripcion: string, ean: string): Alias => ({ ...alias, [normalizar(descripcion)]: ean });

/** Olvida un producto aprendido: la próxima vez la app vuelve a preguntar. */
export function olvidar(alias: Alias, clave: string): Alias {
  const nuevo = { ...alias };
  delete nuevo[clave];
  return nuevo;
}

export interface Aprendido { clave: string; ean: string; nombre: string }

/** Lista para revisar en Ajustes: descripción del tiquete → producto, en orden alfabético. */
export function aprendidos(alias: Alias, productos: Producto[]): Aprendido[] {
  const porEan = new Map(productos.map(p => [p.ean, p]));
  return Object.entries(alias)
    .map(([clave, ean]) => {
      const p = porEan.get(ean);
      return { clave, ean, nombre: p ? `${p.nombre}${p.marca ? ` · ${p.marca}` : ''}` : `Código ${ean} (ya no está en la base)` };
    })
    .sort((a, b) => a.clave.localeCompare(b.clave, 'es'));
}
