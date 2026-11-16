// Precios de la comunidad (servicio opcional, D-17). Todo lo de este archivo es cálculo local:
// la app descarga la tabla completa y busca aquí, así el servidor nunca sabe qué productos compró la persona.
import type { Precio } from './tipos';
import { eanValido, normalizarEan, usoInterno } from './codigos';
import { CANTONES } from './comercio';

export interface FilaPrecio {
  ean: string; cadena: string | null; canton: string | null;
  mediana: number; p25: number; p75: number; n: number; desde: string; hasta: string;
}
export interface TablaComunidad { desde: string; hasta_antes_de?: string; semanas: number; min_reportes: number; precios: FilaPrecio[] }
export type IndiceComunidad = Map<string, FilaPrecio>;

export const PRECIO_MINIMO_APORTE = 50;
export const PRECIO_MAXIMO_APORTE = 500_000;
export const MAX_APORTES = 60;
export const DIAS_ATRAS_APORTE = 90;   // igual que el servicio: compras de hasta 90 días y nunca futuras

const dias = (a: string, b: string) => Math.round((Date.parse(a) - Date.parse(b)) / 86_400_000);

const llave = (ean: string, cadena?: string | null, canton?: string | null) => `${ean}|${cadena ?? ''}|${canton ?? ''}`;

/** P-13 (auditoría): una fila que no tiene la forma esperada no llega a precioComunidad. */
export function filaValida(f: unknown): f is FilaPrecio {
  if (typeof f !== 'object' || f === null) return false;
  const x = f as Record<string, unknown>;
  const textoONulo = (v: unknown) => v === null || (typeof v === 'string' && v.length > 0 && v.length <= 60);
  return typeof x.ean === 'string' && /^\d{8,14}$/.test(x.ean) && textoONulo(x.cadena) && textoONulo(x.canton)
    && typeof x.mediana === 'number' && Number.isFinite(x.mediana) && x.mediana >= PRECIO_MINIMO_APORTE && x.mediana <= PRECIO_MAXIMO_APORTE
    && typeof x.n === 'number' && Number.isInteger(x.n) && x.n >= 1;
}

export function indexar(t: TablaComunidad): IndiceComunidad {
  const filas: FilaPrecio[] = Array.isArray(t?.precios) ? t.precios.filter(filaValida) : [];
  return new Map(filas.map(f => [llave(f.ean, f.cadena, f.canton), f]));
}

/** Mediana de la comunidad, de lo más cercano a lo más general: misma cadena y cantón → misma cadena → país. */
export function precioComunidad(ind: IndiceComunidad, ean: string, cadena?: string, canton?: string): Precio | undefined {
  const e = normalizarEan(ean);
  const f = (cadena && canton ? ind.get(llave(e, cadena, canton)) : undefined)
    ?? (cadena ? ind.get(llave(e, cadena)) : undefined)
    ?? ind.get(llave(e));
  if (!f) return undefined;
  const lugar = f.cadena ? (f.canton ? `${f.cadena}, ${f.canton}` : f.cadena) : 'Costa Rica';
  return { colones: f.mediana, fuente: 'comunidad', comercio: lugar, n: f.n };
}

export interface AporteApi { ean: string; precio: number; cadena: string; canton?: string; fecha?: string }
/** B-31 (RF-16, RNF-02): cómo se nombra ante la persona cada campo que sale en POST /precios. La oferta y Ajustes
 *  arman su texto con estos rótulos, y una prueba compara las llaves del cuerpo enviado con ellos: un campo nuevo
 *  sin rótulo, o un rótulo que ya no corresponde, hace fallar la prueba. La fecha sale exacta (el servicio guarda
 *  solo la semana, D-28), así que se dice «la fecha de la compra», no «la semana». */
export const ROTULOS_APORTE: Record<keyof AporteApi, string> = {
  ean: 'código', precio: 'precio', cadena: 'comercio', canton: 'cantón', fecha: 'fecha de la compra',
};
export const NOTA_FECHA_APORTE = 'el servicio guarda solo la semana';
export interface LineaParaAporte { ean: string; total: number; cantidad: number; seguro: boolean }

/** Prepara el envío anónimo: solo código, precio unitario, cadena, cantón y fecha. Nada más.
 *  Solo productos identificados con seguridad (código de barras, alias aprendido o elegido por la persona),
 *  con código GS1 válido y comparable; un producto repetido se envía una vez. */
export function prepararAportes(lineas: LineaParaAporte[], cadena: string, canton?: string, fecha?: string, hoy?: string): AporteApi[] {
  // El servicio rechaza el lote entero si un campo es inválido: se revisa aquí antes de ofrecer nada.
  if (fecha && hoy && (dias(hoy, fecha) > DIAS_ATRAS_APORTE || dias(fecha, hoy) > 1)) return [];
  if (canton && !CANTONES.includes(canton)) canton = undefined;
  const vistos = new Set<string>();
  const salida: AporteApi[] = [];
  for (const l of lineas) {
    if (!l.seguro || !eanValido(l.ean) || usoInterno(l.ean) || !(l.cantidad > 0)) continue;
    const ean = normalizarEan(l.ean);
    const precio = Math.round(l.total / l.cantidad);
    if (precio < PRECIO_MINIMO_APORTE || precio > PRECIO_MAXIMO_APORTE || vistos.has(ean)) continue;
    vistos.add(ean);
    salida.push({ ean, precio, cadena, ...(canton ? { canton } : {}), ...(fecha ? { fecha } : {}) });
  }
  return salida.slice(0, MAX_APORTES);
}

// ---------------------------------------------------------------- avisos de datos dudosos (POST /reportes)

export interface ReporteApi { ean: string; campo: string; motivo: string }

// Nombre del nutriente en Evaluacion.faltantes («sodio (dato dudoso)») → campo y motivo del servicio.
// Sodio fuera de rango = casi siempre unidad equivocada (mg anotados como g); los demás = datos que se contradicen.
const AVISO_POR_NUTRIENTE: Record<string, [string, string]> = {
  'sodio': ['sodio', 'unidad_erronea'],
  'azúcares': ['azucares', 'inconsistente'],
  'grasas totales': ['grasas', 'inconsistente'],
  'grasas saturadas': ['saturadas', 'inconsistente'],
  'grasas trans': ['trans', 'inconsistente'],
  'energía': ['kcal', 'inconsistente'],   // auditoría: la energía incoherente (B-01) también se puede avisar
};
const MARCA_DUDOSO = ' (dato dudoso)';

/** Avisos para el servicio a partir de los datos dudosos de un producto. Solo opciones cerradas, sin texto libre. */
export function reportesDeDudosos(ean: string, faltantes: string[]): ReporteApi[] {
  if (!eanValido(ean)) return [];   // el servicio rechaza códigos con dígito de control inválido
  return faltantes
    .filter(f => f.endsWith(MARCA_DUDOSO))
    .map(f => AVISO_POR_NUTRIENTE[f.slice(0, -MARCA_DUDOSO.length)])
    .filter((x): x is [string, string] => !!x)
    .map(([campo, motivo]) => ({ ean: normalizarEan(ean), campo, motivo }));
}
