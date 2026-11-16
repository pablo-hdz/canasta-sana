// Tiquetes y precios SIMULADO para probar el flujo sin datos personales ni permisos.
// Nada de esto debe mostrarse como dato real: la interfaz lo marca como SIMULADO.
import type { Precio, Producto } from './tipos';
import { evaluar } from './ops';
import { normalizar } from './identificar';
import { precioEstimado } from './precios';

export function aleatorio(semilla: number): () => number {   // mulberry32
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Precio SIMULADO para tiquetes de demostración: el estimado por tamaño y categoría, marcado como simulado. */
export function precioSimulado(p: Producto): Precio {
  return { colones: precioEstimado(p).colones, fuente: 'simulado' };
}

const VACIAS = new Set(['DE', 'CON', 'EN', 'LA', 'EL', 'Y', 'SABOR', 'AL', 'DEL', 'PARA']);

/** Descripción abreviada al estilo de un tiquete térmico, a partir del nombre real. */
export function abreviar(p: Producto): string {
  const palabras = normalizar(p.nombre).split(/\s+/).filter(w => w && !VACIAS.has(w));
  const corto = palabras.slice(0, 4).map(w => (/\d/.test(w) ? w : w.slice(0, 5)));
  const marca = normalizar(p.marca).split(/\s+/).filter(Boolean);
  const siglas = marca.length >= 2 ? marca.map(w => w[0]).join('') : marca.length === 1 ? marca[0].slice(0, 4) : '';
  if (siglas && !corto.includes(siglas) && !palabras.includes(marca[0])) corto.push(siglas);
  if (p.cantidadNum && p.unidad) {
    const v = p.cantidadNum;
    corto.push(p.unidad === 'ml' ? (v >= 1000 ? `${v / 1000}L` : `${v}ML`) : (v >= 1000 ? `${v / 1000}KG` : `${v}G`));
  }
  return corto.join(' ').replace(/\./g, ',').slice(0, 26);
}

const fmt = (x: number) => Math.round(x).toLocaleString('es-CR').replace(/[.,  ]/g, ' ');

export interface TiqueteSimulado {
  texto: string;
  verdad: { ean: string; descripcion: string; cantidad: number; precio: number }[];
  total: number;
}

/** Arma un tiquete SIMULADO con n productos de la base (semilla fija = resultado repetible). */
/** B-20: ¿el nombre parece español? Heurística simple, solo para elegir productos del ejemplo SIMULADO (no toca la base):
 *  - fuera si tiene letras que el español no usa (à, è, ô, ç, œ…) o palabras propias del francés o del alemán;
 *  - y, para quedarse, necesita al menos una palabra común en español («de», «con», «sabor», «leche», «arroz»…).
 *  Así «Happy Orange Ginger Tea» o «Tartines spécial campagne» quedan fuera y «Pringles Crema y Cebolla» se queda.
 *  Sin palabras que también son inglés (chocolate, natural, cereal, pasta). Es más estricta que la del backend (parece_otro_idioma en datos/descargar_off.py) porque solo arma una demostración. */
const sinTildes = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const FRANCES_ALEMAN = new Set(['du', 'des', 'aux', 'au', 'et', 'le', 'les', 'avec', 'sans', 'mit', 'und', 'der', 'die', 'das', 'lait',
  'fromage', 'chocolat', 'legume', 'legumes', 'special', 'tartines']);
const ESPANOL = new Set(['de', 'del', 'con', 'sin', 'y', 'en', 'para', 'tipo', 'sabor', 'leche', 'bebida', 'galleta', 'galletas', 'jugo', 'salsa',
  'salsita', 'queso', 'frijol', 'frijoles', 'arroz', 'crema', 'integral', 'mantequilla', 'pollo', 'pan', 'yogur', 'yogurt', 'avena',
  'azucar', 'mezcla', 'aceite', 'harina', 'mani', 'maiz', 'fresa', 'cafe', 'te', 'frio', 'verde', 'manzana',
  'naranja', 'pina', 'tomate', 'atun', 'tortilla', 'tortillas', 'fajitas', 'multigrano', 'vainilla', 'cacao', 'refresco', 'agua', 'sopa',
  'carne', 'jamon', 'salchicha', 'salchichas', 'huevo', 'huevos', 'papas', 'tostadas', 'mermelada', 'miel', 'limon', 'lima', 'banano',
  'fruta', 'frutas', 'vegetales', 'frutos', 'nuez', 'almendra', 'almendras', 'cebolla', 'ajo', 'chile', 'picante', 'dulce', 'sal', 'semid',
  'descremada', 'semidescremada', 'trigo', 'barra', 'canasta', 'helado', 'gelatina', 'mostaza', 'mayonesa', 'aderezo', 'consome', 'caldo']);
export function nombreEnEspanol(nombre: string): boolean {
  if (/[àâäçèêëîïôöùûœæß]/i.test(nombre)) return false;
  const palabras = sinTildes(nombre.toLowerCase()).split(/[^a-z0-9ñ]+/).filter(Boolean);
  if (palabras.some(w => FRANCES_ALEMAN.has(w))) return false;
  return palabras.some(w => ESPANOL.has(w));
}

export function tiqueteSimulado(base: Producto[], semilla = 2026, n = 12): TiqueteSimulado {
  const r = aleatorio(semilla);
  const elegibles = base.filter(p => evaluar(p).kcal !== undefined && p.nombre.length > 3 && nombreEnEspanol(p.nombre));
  const elegidos: Producto[] = [];
  while (elegidos.length < Math.min(n, elegibles.length)) {
    const p = elegibles[Math.floor(r() * elegibles.length)];
    if (!elegidos.includes(p)) elegidos.push(p);
  }
  const verdad = elegidos.map(p => {
    const cantidad = r() < 0.2 ? 2 : 1;
    return { ean: p.ean, descripcion: abreviar(p), cantidad, precio: precioSimulado(p).colones * cantidad };
  });
  const total = verdad.reduce((a, x) => a + x.precio, 0);
  const ancho = 36;
  const linea = (izq: string, der: string) => izq + ' '.repeat(Math.max(1, ancho - izq.length - der.length)) + der;
  const filas = [
    'SUPERMERCADO EJEMPLO S.A. (SIMULADO)',
    'TIQUETE ELECTRONICO',
    'FECHA 13/11/2026  HORA 10:32',
    '-'.repeat(ancho),
    ...verdad.map(v => v.cantidad > 1
      ? linea(`${v.descripcion} ${v.cantidad} x ${fmt(v.precio / v.cantidad)}`, fmt(v.precio))
      : linea(v.descripcion, fmt(v.precio))),
    '-'.repeat(ancho),
    linea('SUBTOTAL', fmt(total)),
    linea('TOTAL', fmt(total)),
    'TARJETA ****0000 (SIMULADO)',
    'GRACIAS POR SU COMPRA',
  ];
  return { texto: filas.join('\n'), verdad, total };
}

/** ¿Es una demostración? Todo tiquete o factura que se identifica como SIMULADO (en el comercio o en el
 *  encabezado) se trata como tal, aunque se suba por el botón normal: sus precios nunca entran al historial,
 *  al progreso ni a los aportes de la comunidad. */
export function esDemostracion(comercio?: string, texto?: string): boolean {
  const cabecera = (texto ?? '').split(/\r?\n/).slice(0, 12).join('\n');
  return /SIMULAD[OA]/i.test(comercio ?? '') || /SIMULAD[OA]/i.test(cabecera);
}
