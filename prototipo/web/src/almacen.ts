// Todo se guarda solo en este teléfono (localStorage). Nada se envía a un servidor (RNF-02), salvo los aportes
// anónimos de precios si la persona los activa en Ajustes (D-17).
// Cada lectura se valida: un dato dañado o de otra versión se ignora en vez de romper la app. En las colecciones
// se descarta solo el registro malo, no la colección entera (un registro dañado no debe borrar todo el historial).
import type { Perfil } from './dominio/cambios';
import type { Precio } from './dominio/tipos';
import type { ItemLista } from './dominio/lista';
import type { ResumenCompra } from './dominio/progreso';
import type { TablaComunidad } from './dominio/comunidad';
import { PERFIL_VACIO } from './dominio/cambios';

const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function leer<T>(clave: string, defecto: T, valido: (v: unknown) => boolean): T {
  try {
    const v = localStorage.getItem(clave);
    if (!v) return defecto;
    const dato: unknown = JSON.parse(v);
    return valido(dato) ? (dato as T) : defecto;
  } catch { return defecto; }
}
/** Colección (arreglo u objeto): conserva los registros válidos y descarta solo los dañados. */
function leerArreglo<T>(clave: string, valido: (x: unknown) => boolean): T[] {
  const v = leer<unknown>(clave, [], Array.isArray);
  return (v as unknown[]).filter(valido) as T[];
}
function leerMapa<T>(clave: string, valido: (x: unknown) => boolean): Record<string, T> {
  const v = leer<Record<string, unknown>>(clave, {}, esObjeto);
  return Object.fromEntries(Object.entries(v).filter(([, x]) => valido(x))) as Record<string, T>;
}
function guardar(clave: string, valor: unknown) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* modo privado o almacenamiento lleno */ }
}

const perfilValido = (v: unknown) => esObjeto(v) && typeof v.ninos === 'boolean' && Array.isArray(v.alergenos) && v.alergenos.every(a => typeof a === 'string');
export const leerPerfil = () => leer<Perfil>('canasta.perfil', PERFIL_VACIO, perfilValido);
export const guardarPerfil = (p: Perfil) => guardar('canasta.perfil', p);
export const leerAlias = () => leerMapa<string>('canasta.alias', x => typeof x === 'string');
export const guardarAlias = (a: Record<string, string>) => guardar('canasta.alias', a);
// Historial de precios reales de la persona (de sus facturas y tiquetes), por código de barras.
export type Historial = Record<string, Precio>;
const precioValido = (p: unknown) => esObjeto(p) && typeof p.colones === 'number' && Number.isFinite(p.colones) && p.colones > 0 && typeof p.fuente === 'string';
export const leerHistorial = (): Historial => leerMapa<Precio>('canasta.precios', precioValido);
export function sumarAlHistorial(nuevos: Historial): Historial {
  const h = { ...leerHistorial() };
  for (const [ean, p] of Object.entries(nuevos)) if (!h[ean] || (p.fecha ?? '') >= (h[ean].fecha ?? '')) h[ean] = p;
  guardar('canasta.precios', h);
  return h;
}

const itemListaValido = (x: unknown) => esObjeto(x) && typeof x.ean === 'string' && typeof x.nombre === 'string' && typeof x.hecho === 'boolean';
export const leerLista = () => leerArreglo<ItemLista>('canasta.lista', itemListaValido);
export const guardarLista = (l: ItemLista[]) => guardar('canasta.lista', l);
const compraValida = (c: unknown) => esObjeto(c) && typeof c.id === 'string' && typeof c.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha)
  && typeof c.gastoEmpacados === 'number' && typeof c.gastoConSellos === 'number';
// Ingredientes leídos por la persona con la cámara (por código). Solo en este teléfono.
export const leerIngredientesFoto = () => leerMapa<string>('canasta.ingredientes', x => typeof x === 'string');
export const guardarIngredientesFoto = (m: Record<string, string>) => guardar('canasta.ingredientes', m);
export const leerCompras = () => leerArreglo<ResumenCompra>('canasta.compras', compraValida);
// Huellas de compras ya aportadas o rechazadas (no se vuelven a ofrecer). Se guardan las últimas 200.
export const leerAportadas = () => leerArreglo<string>('canasta.aportadas', x => typeof x === 'string');
export const guardarAportadas = (ids: string[]) => guardar('canasta.aportadas', ids.slice(-200));
export const guardarCompras = (c: ResumenCompra[]) => guardar('canasta.compras', c);

// Claro por defecto (pedido de Pablo, D-25: «no parece algo médico» en oscuro). «telefono» sigue al sistema.
export type Tema = 'claro' | 'oscuro' | 'telefono';
export interface Preferencias {
  tema: Tema;
  letra?: 'legible';
  animaciones?: false;      // «Quitar las animaciones» (WCAG 2.2.2): sin valor, las animaciones cortas siguen        // Atkinson Hyperlegible (baja visión); sin valor, la letra del teléfono (D-20)
  canton?: string;          // opcional; solo para precios de la comunidad
  usarComunidad: boolean;   // descargar la tabla pública de precios (no envía nada de la persona)
  aportar: boolean;         // enviar precios anónimos de sus compras
}
export const PREFERENCIAS_INICIALES: Preferencias = { tema: 'claro', usarComunidad: false, aportar: false };
/** Se toma campo por campo: un valor de tipo equivocado vuelve a su valor inicial (nunca activa un envío por error). */
export function leerPreferencias(): Preferencias {
  const g = leer<Record<string, unknown>>('canasta.preferencias', {}, esObjeto);
  return {
    // El valor viejo «sistema» (el predeterminado hasta v0.2.2) pasa a claro: nadie lo eligió a propósito.
    tema: g.tema === 'oscuro' || g.tema === 'telefono' ? g.tema : 'claro',
    usarComunidad: g.usarComunidad === true,
    aportar: g.aportar === true,
    ...(typeof g.canton === 'string' && g.canton ? { canton: g.canton } : {}),
    ...(g.letra === 'legible' ? { letra: 'legible' as const } : {}),
    ...(g.animaciones === false ? { animaciones: false as const } : {}),
  };
}
export const guardarPreferencias = (p: Preferencias) => guardar('canasta.preferencias', p);

export interface CacheComunidad { tabla: TablaComunidad; etag?: string; descargada: string }
const cacheValida = (v: unknown) => esObjeto(v) && typeof v.descargada === 'string' && esObjeto(v.tabla) && Array.isArray(v.tabla.precios);
export const leerComunidad = () => leer<CacheComunidad | null>('canasta.comunidad', null, cacheValida);
export const guardarComunidad = (c: CacheComunidad) => guardar('canasta.comunidad', c);

export const CLAVES = ['canasta.perfil', 'canasta.alias', 'canasta.precios', 'canasta.lista', 'canasta.compras',
  'canasta.preferencias', 'canasta.comunidad', 'canasta.aportadas', 'canasta.ingredientes'];

export function borrarTodo() {
  try { CLAVES.forEach(k => localStorage.removeItem(k)); } catch { /* sin acceso */ }
}

/** Aplica el tema elegido a la página (el CSS sigue al teléfono si es «telefono»). */
export function aplicarTema(tema: Tema) {
  if (typeof document === 'undefined') return;
  if (tema === 'telefono') delete document.documentElement.dataset.tema;
  else document.documentElement.dataset.tema = tema;
}

/** «Quitar las animaciones»: las apaga todas, como el ajuste «reducir movimiento» del teléfono. */
export function aplicarAnimaciones(valor?: Preferencias['animaciones']) {
  if (typeof document === 'undefined') return;
  if (valor === false) document.documentElement.dataset.animaciones = 'no';
  else delete document.documentElement.dataset.animaciones;
}

/** Letra: la del teléfono (como las apps más usadas) o Atkinson Hyperlegible, más fácil de leer (D-07, D-20). */
export function aplicarLetra(letra?: Preferencias['letra']) {
  if (typeof document === 'undefined') return;
  if (letra === 'legible') document.documentElement.dataset.letra = letra;
  else delete document.documentElement.dataset.letra;
}

// ---------------------------------------------------------------- copia de seguridad (v0.2)
// Los datos viven solo en este teléfono: si la persona cambia de teléfono o borra el navegador, los pierde.
// La copia es un archivo que ella guarda donde quiera; restaurarla pasa por los mismos controles de lectura.

export const VERSION_COPIA = 1;
export interface Copia { app: 'canasta-sana'; version: number; creada: string; datos: Record<string, unknown> }

/** Todo lo personal, ya validado. No incluye la tabla de la comunidad (es pública y se vuelve a descargar). */
export function exportarDatos(ahora = new Date()): Copia {
  return {
    app: 'canasta-sana', version: VERSION_COPIA, creada: ahora.toISOString(),
    datos: {
      'canasta.perfil': leerPerfil(), 'canasta.alias': leerAlias(), 'canasta.precios': leerHistorial(),
      'canasta.lista': leerLista(), 'canasta.compras': leerCompras(), 'canasta.preferencias': leerPreferencias(),
      'canasta.aportadas': leerAportadas(), 'canasta.ingredientes': leerIngredientesFoto(),
    },
  };
}

const LECTORES: Record<string, () => unknown> = {
  'canasta.perfil': () => leerPerfil(), 'canasta.alias': () => leerAlias(), 'canasta.precios': () => leerHistorial(),
  'canasta.lista': () => leerLista(), 'canasta.compras': () => leerCompras(), 'canasta.preferencias': () => leerPreferencias(),
  'canasta.aportadas': () => leerAportadas(), 'canasta.ingredientes': () => leerIngredientesFoto(),
};

/** Restaura una copia: reemplaza los datos actuales. Cada valor se escribe y se vuelve a leer con sus controles,
 *  así un registro dañado o ajeno se descarta. Devuelve un resumen o el motivo del rechazo. */
export function importarDatos(texto: string): { ok: true; compras: number; precios: number; lista: number } | { ok: false; error: string } {
  let copia: unknown;
  try { copia = JSON.parse(texto); } catch { return { ok: false, error: 'el archivo no es una copia de Canasta sana' }; }
  if (!esObjeto(copia) || copia.app !== 'canasta-sana' || !esObjeto(copia.datos)) return { ok: false, error: 'el archivo no es una copia de Canasta sana' };
  if (typeof copia.version !== 'number' || copia.version > VERSION_COPIA) return { ok: false, error: 'la copia es de una versión más nueva de la app' };
  borrarTodo();
  for (const [clave, leerValidado] of Object.entries(LECTORES)) {
    const valor = (copia.datos as Record<string, unknown>)[clave];
    if (valor === undefined) continue;
    guardar(clave, valor);
    guardar(clave, leerValidado());   // se guarda solo lo que pasa los controles
  }
  return { ok: true, compras: leerCompras().length, precios: Object.keys(leerHistorial()).length, lista: leerLista().length };
}
