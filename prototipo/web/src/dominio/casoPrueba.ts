// «Guardar caso de prueba»: convierte una compra revisada en un archivo .json para pruebas de regresión
// (se copian a src/casos/ y los prueba src/casos/casos.test.ts).
// Guarda el texto que leyó la app y las líneas como quedaron después de que la persona las revisó.
// Nunca guarda la foto ni datos del receptor: las líneas con nombre, cédula, correo, teléfono, tarjeta
// o autorización se quitan del texto, y los números que parecen cédulas, teléfonos o tarjetas se tapan.
import type { TiqueteLeido } from './tiquete';
import { SEPARADOR_PARTES } from './tiquete';

export const FORMATO_CASO = 'canasta-sana/caso-de-prueba';
export const VERSION_CASO = 1;
export type OrigenCaso = 'foto' | 'factura-xml' | 'factura-pdf' | 'texto' | 'simulado';   // 'texto': factura pegada
export type Identificado = 'codigo-impreso' | 'alias' | 'texto' | 'persona';

export interface LineaCaso {
  descripcion: string;
  cantidad: number;
  precio: number;                       // total de la línea en colones
  codigoLeido: string | null;           // código de barras impreso en la línea o en el XML, si lo había
  codigo: string | null;                // código del producto elegido (null: sin identificar o quitada)
  identificado: Identificado | null;    // cómo se llegó a ese producto
  quitada: boolean;                     // la persona la quitó (no era un producto)
}

export interface CasoPrueba {
  formato: typeof FORMATO_CASO;
  version: number;
  creado: string;                       // AAAA-MM-DD en que se guardó el caso (no la fecha de la compra)
  origen: OrigenCaso;
  simulado: boolean;                    // demostración: nunca es un dato real
  cadena: string | null;
  baseDescargada: string | null;        // versión de la base de productos con que se identificó
  partes: string[];                     // texto leído, una entrada por foto, sin datos personales
  total: number | null;
  cuadra: boolean | null;
  lineas: LineaCaso[];
}

const QUITADA = '[línea quitada: datos personales]';
const TAPADO = '[dato quitado]';
// Rótulos de datos de la persona o de su pago. «TEL», «CÉDULA» y «TARJETA» también los ignora el lector de tiquetes.
// Sin «CLUB»: es parte de nombres de productos (galletas Club Social). Una prueba revisa que ningún nombre de la base choque.
const RX_PERSONAL = /\b(RECEPTOR|CLIENTE|NOMBRE|CORREO|E-?MAIL|C[EÉ]DULA|IDENTIFICACI[OÓ]N|DIMEX|PASAPORTE|TEL[EÉ]FONO|TEL|CELULAR|M[OÓ]VIL|DIRECCI[OÓ]N|DOMICILIO|TARJETA|VISA|MASTERCARD|AMEX|AUTORIZACI[OÓ]N|APROBACI[OÓ]N|SINPE|CUENTA|IBAN|SOCIO|AFILIADO|LEALTAD|PUNTOS)\b/i;
const RX_ES_TOTAL = /^\s*(?:SUB ?)?TOTAL\b/i;
const RX_CORREO = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// Teléfonos (8888-8888), cédulas con guiones (1-1234-5678, 3-101-123456), tarjetas enmascaradas (****1234)
// y números largos sin guiones: cédula (9), jurídica (10), DIMEX (11) o clave y tarjeta (≥ 14).
// No se tocan los de 8, 12 y 13 dígitos: son códigos de barras de productos.
const RX_NUMEROS = /\b\d{4}-\d{4}\b|\b\d{1,2}-\d{3,4}-\d{3,6}\b|[*xX#]{4,}[\s-]?\d{2,4}\b|\b(?:\d{9,11}|\d{14,})\b/g;

/** Quita del texto leído los datos de la persona (ver arriba). Una línea con solo el rótulo («CLIENTE:»)
 *  también se lleva la línea siguiente, donde suele ir el dato. Las líneas de TOTAL se conservan, tapadas. */
export function limpiarTexto(texto: string): string {
  const salida: string[] = [];
  let quitarSiguiente = false;
  for (const linea of texto.split(/\r?\n/)) {
    const tapada = linea.replace(RX_CORREO, TAPADO).replace(RX_NUMEROS, TAPADO);
    if (quitarSiguiente && linea.trim()) {
      quitarSiguiente = false;
      salida.push(QUITADA);
      continue;
    }
    const m = linea.match(RX_PERSONAL);
    if (m && !RX_ES_TOTAL.test(linea)) {
      // Rótulo sin dato después («CLIENTE:», «Correo electrónico:»): el dato viene en la línea siguiente.
      const resto = linea.slice(m.index! + m[0].length).replace(/\b(ELECTR[OÓ]NICO|DEL|DE|LA|EL)\b/gi, '');
      quitarSiguiente = !/[\p{L}\d]/u.test(resto);
      salida.push(QUITADA);
      continue;
    }
    salida.push(tapada);
  }
  return salida.join('\n');
}

export interface ItemRevisado {
  descripcion: string;
  cantidad: number;
  precio: number;
  codigoLeido?: string;
  codigo?: string;               // producto que quedó elegido
  identificado?: Identificado;
  quitada: boolean;
}

/** Arma el caso de prueba de una compra revisada. No incluye la foto, la fecha de la compra, el comercio
 *  exacto ni datos del receptor: solo la cadena, el texto limpio y las líneas. */
export function casoDePrueba(o: {
  tiquete: TiqueteLeido; origen: OrigenCaso; simulado: boolean; cadena?: string; baseDescargada?: string;
  items: ItemRevisado[]; hoy: string;
}): CasoPrueba {
  return {
    formato: FORMATO_CASO, version: VERSION_CASO, creado: o.hoy, origen: o.origen, simulado: o.simulado,
    cadena: o.cadena ?? null, baseDescargada: o.baseDescargada ?? null,
    partes: o.tiquete.texto.split(SEPARADOR_PARTES).map(limpiarTexto),
    total: o.tiquete.total ?? null, cuadra: o.tiquete.cuadra ?? null,
    lineas: o.items.map(it => ({
      descripcion: it.quitada ? limpiarTexto(it.descripcion) : it.descripcion,
      cantidad: it.cantidad, precio: it.precio,
      codigoLeido: it.codigoLeido ?? null,
      codigo: it.quitada ? null : it.codigo ?? null,
      identificado: it.quitada || !it.codigo ? null : it.identificado ?? null,
      quitada: it.quitada,
    })),
  };
}

export const nombreCaso = (c: CasoPrueba) =>
  `canasta-caso-${c.simulado ? 'SIMULADO-' : ''}${c.origen === 'simulado' ? '' : `${c.origen}-`}${c.creado}.json`;

/** Lee y valida un archivo de caso (para las pruebas). Lanza un error claro si no es un caso válido. */
export function leerCaso(datos: unknown): CasoPrueba {
  const c = datos as CasoPrueba;
  const err = (m: string) => { throw new Error(`Caso de prueba no válido: ${m}`); };
  if (!c || c.formato !== FORMATO_CASO) err('no es un archivo de «Guardar caso de prueba»');
  if (c.version > VERSION_CASO) err(`versión ${c.version}, más nueva que esta app (${VERSION_CASO})`);
  if (!Array.isArray(c.partes) || !c.partes.every(p => typeof p === 'string')) err('faltan las partes del texto');
  if (!Array.isArray(c.lineas)) err('faltan las líneas');
  for (const l of c.lineas) {
    if (typeof l.descripcion !== 'string' || !(l.cantidad > 0) || !Number.isFinite(l.precio) || typeof l.quitada !== 'boolean') err(`línea dañada: ${JSON.stringify(l)}`);
  }
  return c;
}
