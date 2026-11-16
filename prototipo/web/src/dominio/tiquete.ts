// Lector de líneas de tiquete (texto que sale del OCR o texto pegado). Ignora encabezados, pie y datos personales.

export interface LineaTiquete {
  texto: string;
  descripcion: string;
  cantidad: number;
  precio: number;        // total de la línea en colones
  codigo?: string;       // código de barras impreso en la línea (8, 12 o 13 dígitos), si lo hay
}

export interface TiqueteLeido {
  texto: string;         // texto completo que salió del OCR (para revisar qué se leyó)
  lineas: LineaTiquete[];
  total?: number;
  subtotal?: number;     // antes de impuestos, si el tiquete lo imprime
  impuesto?: number;     // IVA total, si el tiquete lo imprime
  sumaLineas: number;
  cuadra?: boolean;      // ¿la suma de líneas da el total, el subtotal o total − IVA? (RF-01/RF-02)
  ignoradas: number;
}

/** La suma de líneas puede ser con IVA (= total) o sin IVA (= subtotal, o total − impuesto), según el comercio. */
export function cuadre(suma: number, total?: number, subtotal?: number, impuesto?: number): boolean | undefined {
  if (total === undefined && subtotal === undefined) return undefined;
  const cerca = (x?: number) => x !== undefined && Math.abs(x - suma) <= TOLERANCIA_TOTAL;
  return cerca(total) || cerca(subtotal) || (total !== undefined && impuesto !== undefined && cerca(total - impuesto));
}

export const TOLERANCIA_TOTAL = 5;   // colones (SUPUESTO, redondeos)
export const PRECIO_MINIMO = 50;     // colones: por debajo es ruido del OCR (SUPUESTO)
export const LETRAS_MINIMAS = 3;     // una descripción real tiene al menos 3 letras
// Teléfonos (2222-2222), cédulas (1-1111-1111, 3-101-123456) y similares: nunca son productos.
// Con guion; un teléfono con espacio («2222 2222») lo descarta la palabra «TEL» (con espacio choca con «1200 1200»).
const RX_TELEFONO_CEDULA = /\b\d{4}-\d{4}\b|\b\d{1,2}-\d{3,4}-\d{3,6}\b/;
const RX_CODIGO = /\b(\d{13}|\d{12}|\d{8})\b/;
// Encabezado de caja: «TDA#3113 OP#00000047 TE# 003 TR# 53258» (tienda, operador, terminal, transacción).
// Una palabra corta pegada a «#» y un número no es un producto («PAÑAL #3» lleva espacio antes del #).
const RX_TERMINAL = /(?:^|\s)[A-Za-z]{2,4}#\s?\d/;

const RX_IGNORAR = /\b(SUB ?TOTAL|IVA|IMPUESTO|EFECTIVO|CAMBIO|VUELTO|TARJETA|VISA|MASTER|C[EÉ]DULA|CLAVE|CONSECUTIVO|CAJER[OA]|FECHA|HORA|TEL[EÉ]FONO|TEL|TIQUETE|FACTURA|GRACIAS|SUCURSAL|CLIENTE|AUTORIZACI[OÓ]N|REF|SINPE|ART[IÍ]CULOS|ARTS|CANT|CANTIDAD|DESCRIPCI[OÓ]N|PRECIOS?|SIMULADO|SUPERMERCADO|S\.A\.|FORMA DE PAGO|CONDICI[OÓ]N)\b/i;
const NUM = String.raw`(?:\d{1,3}(?:[ .,\u00a0]\d{3})+|\d{1,7})(?:[.,]\d{1,2})?`;
// «TOTAL IVA», «TOTAL DESCUENTO» o «TOTAL ARTÍCULOS» no son el total a pagar.
const RX_TOTAL = new RegExp(String.raw`^\s*TOTAL\b(?!\s*(?:IVA|I\.V\.A|IMPUESTO|DESC|ART|AHORRO|DE ART|VENTA|NET|GRAVAD|EXENT|SERV|MERC))\D*(?<n>${NUM})\s*$`, 'i');
// Subtotal: «SUBTOTAL 18 330» o, en la representación gráfica de la factura electrónica, «Total Venta Neta: 101,230.00».
const RX_SUBTOTAL = new RegExp(String.raw`^\s*(?:SUB ?TOTAL|TOTAL VENTA NETA|TOTAL NETO|VENTA NETA)\b\D*(?<n>${NUM})\s*$`, 'i');
// Cualquier otra línea «Total …» o «Subtotal …» (impuestos, gravado, exento, artículos) no es un producto.
const RX_OTRO_TOTAL = /^(?:SUB ?)?TOTAL/i;
const RX_IMPUESTO = new RegExp(String.raw`^\s*(?:TOTAL\s+)?(?:IMPUESTO|I\.?\s?V\.?\s?A\.?)\b.*?(?<n>${NUM})\s*$`, 'i');
// Precio con separador de miles («1 050», «1,050») o sin él («1590»), con o sin 2 decimales.
const PRECIO = String.raw`(?:\d{1,3}(?:[ .,\u00a0]\d{3})+|\d{1,7})(?:[.,]\d{2})?`;
// Letra de impuesto que algunos comercios imprimen después del precio (Palí, Maxi Palí: «1,050 G»).
const MARCA_IMPUESTO = String.raw`(?:\s+[GEXTABN*])?`;
// Producto partido en dos líneas (Palí y Maxi Palí): «LECH LIQ SEM 744100160106» y abajo «2 X ¢1,070 2,140 G»,
// o el precio solo en la línea siguiente cuando el OCR corta la línea.
const RX_DESC_CODIGO = /^(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+(\d{13}|\d{12}|\d{8})\s*$/;
const RX_SOLO_CANTIDAD = new RegExp(String.raw`^(\d{1,3}(?:[.,]\d{1,3})?)\s*[xX@*]\s*[¢₡]?\s*(${PRECIO})\s+[¢₡]?\s*(${PRECIO})${MARCA_IMPUESTO}\s*$`);
const RX_SOLO_PRECIO = new RegExp(String.raw`^[¢₡]?\s*(${PRECIO})${MARCA_IMPUESTO}\s*$`);
const RX_LINEA = new RegExp(String.raw`^(.*?[A-Za-zÁÉÍÓÚÑáéíóúñ].*?)\s+(?:(\d{1,3})\s*[xX@*]\s*(${PRECIO})\s+)?(${PRECIO})${MARCA_IMPUESTO}\s*$`);

/** Separa en el texto unido las partes de un tiquete largo (cada foto). */
export const SEPARADOR_PARTES = '\n--- otra parte ---\n';

/** Une dos partes de un tiquete largo fotografiado por partes. Si el final de la primera parte
 *  se repite al inicio de la segunda (las fotos se traslapan), esas líneas se cuentan una sola vez.
 *  Dos líneas son la misma si tienen el mismo precio y empiezan con las mismas 5 letras (tolera ruido del OCR). */
export function unirTiquetes(a: TiqueteLeido, b: TiqueteLeido): TiqueteLeido & { traslape: number } {
  const clave = (l: LineaTiquete) => `${l.precio}|${l.descripcion.normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 5)}`;
  let traslape = 0;
  for (let k = Math.min(a.lineas.length, b.lineas.length); k > 0; k--) {
    const fin = a.lineas.slice(-k).map(clave), inicio = b.lineas.slice(0, k).map(clave);
    if (fin.every((x, i) => x === inicio[i])) { traslape = k; break; }
  }
  const lineas = [...a.lineas, ...b.lineas.slice(traslape)];
  const total = b.total ?? a.total;
  const subtotal = b.subtotal ?? a.subtotal;
  const impuesto = b.impuesto ?? a.impuesto;
  const sumaLineas = lineas.reduce((s, x) => s + x.precio, 0);
  return {
    texto: `${a.texto}${SEPARADOR_PARTES}${b.texto}`, lineas, total, subtotal, impuesto, sumaLineas, traslape,
    ignoradas: a.ignoradas + b.ignoradas,
    cuadra: cuadre(sumaLineas, total, subtotal, impuesto),
  };
}

/** Línea limpia: tabuladores como espacios, sin símbolo de colones (₡ o ¢) ni viñetas al inicio («• Total …»). */
function limpiarLinea(cruda: string): string {
  return cruda.replace(/\t/g, ' ').replace(/[₡¢]\s?/g, '').replace(/^\s*[•·▪►]\s*/, '').trim();
}

/** Código de barras de la descripción. Si el texto trae la columna CAByS (la clasificación de Hacienda para
 *  impuestos, también de 13 dígitos), esos números no son códigos de barras. Un código con un dígito mal leído
 *  se conserva: no se encuentra en la base y la app pregunta, que es lo seguro. */
function codigoDeBarras(descripcion: string, hayCabys: boolean): string | undefined {
  const c = descripcion.match(RX_CODIGO)?.[1];
  if (!c || (c.length === 13 && hayCabys)) return undefined;
  return c;
}

// Productos que no son comida (no se revisan con el modelo de la OPS). Palabras y marcas, sin tildes.
const RX_NO_COMIDA = new RegExp(String.raw`(?<![a-z])(detergente|cloro|lejia|jabon|lavaplatos|shampoo|champu|acondicionador|pasta dental|crema dental|enjuague bucal|cepillo dental|desodorante|papel higienico|higienico|toallas? de papel|toa scott|servilleta|panal|toallas? sanitaria|toallas? femenina|protector diario|suavizante|desinfectante|limpiador|insecticida|aromatizante|ambientador|bolsas? de basura|bolsa reutilizable|pilas?(?![a-z])|bateria|alimento para (perro|gato)|dog chow|cat chow|veladora|fosforos|encendedor|papel aluminio|afeitar|rasuradora|curitas|kleenex|colgate|rexona|axion|head ?& ?shoulders|clorox|magia blanca|suavitel|downy|gillette|huggies|pampers)`);
export function noEsComida(descripcion: string): boolean {
  return RX_NO_COMIDA.test(descripcion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase());
}

// Alimentos frescos sin empaque: no están en la base de productos empacados y el modelo de la OPS no los marca
// (panel B: sin procesar). No hace falta preguntar cuál es. A granel o por kilo, o si la PRIMERA palabra es una
// fruta, verdura, huevo o carne cruda («SALSA DE TOMATE» empieza con SALSA: no es fresco).
const RX_A_GRANEL = /(?<![a-z])granel|\(kg\)|por kilo|x kg(?![a-z])/;
const RX_PRIMERA_FRESCA = /^(huevos?|papa|cebollas?|tomates?|bananos?|platanos?|pinas?|papayas?|sandias?|melon|mangos?|aguacates?|limon(es)?|naranjas?|mandarinas?|manzanas?|zanahorias?|chayotes?|ayote|repollo|lechuga|culantro|pepinos?|brocoli|coliflor|yuca|camote|elotes?|fresas?|pechuga|muslos?|carne|bistec|costillas?|chuletas?|pescado)(?![a-z])/;
export function esFresco(descripcion: string): boolean {
  const d = descripcion.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  if (/(?<![a-z])(salsa|jugo|nectar|pure|pasta|enlatad|en lata|frit|chips|deshidratad|congelad|empanizad|nugget|polvo)/.test(d)) return false;
  return RX_A_GRANEL.test(d) || RX_PRIMERA_FRESCA.test(d);
}

/** Fecha de la compra impresa en el texto (la primera dd/mm/aaaa o dd/mm/aa válida), en formato AAAA-MM-DD. */
export function fechaDe(texto: string): string | undefined {
  for (const m of texto.matchAll(/(?<!\d)(\d{2})\/(\d{2})\/(\d{4}|\d{2})(?!\d)/g)) {
    const [d, mes] = [Number(m[1]), Number(m[2])];
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const f = new Date(Date.UTC(anio, mes - 1, d));
    if (f.getUTCFullYear() === anio && f.getUTCMonth() === mes - 1 && f.getUTCDate() === d && anio >= 2015 && anio <= 2100) {
      return `${anio}-${String(mes).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  return undefined;
}

export function leerPrecio(s: string): number {
  const t = s.replace(/[\s ]/g, '');
  if (/,\d{2}$/.test(t)) return Number(t.replace(/\./g, '').replace(',', '.'));
  if (/\.\d{2}$/.test(t)) return Number(t.replace(/,/g, ''));
  return Number(t.replace(/\D/g, ''));
}

/** Precio unitario × cantidad ≈ total de la línea (±₡2 o ±1 %): confirma que se leyó el formato en columnas. */
function columnasCoherentes(cant: number, unit: number, total: number): boolean {
  return cant > 0 && Math.abs(cant * unit - total) <= Math.max(2, 0.01 * total);
}

const TOKEN_PRECIO = /^(?:\d{1,3}(?:[.,]\d{3})+|\d{1,7})(?:[.,]\d{2})?$/;

/** Formato en columnas CANT  DESCRIPCIÓN  P.UNIT  TOTAL  [IVA %]  [letra], leído por palabras: un espacio
 *  separa columnas (no miles). Se prueba con y sin columna de IVA y gana la lectura coherente (cant × unit ≈ total). */
export function leerColumnas(l: string): { cantidad: number; descripcion: string; unitario: number; total: number } | undefined {
  const t = l.trim().split(/\s+/);
  if (t.length < 4 || !/^\d{1,3}(?:[.,]\d{1,3})?$/.test(t[0])) return undefined;
  const cantidad = Number(t[0].replace(',', '.'));
  let fin = t.length;
  if (/^[GEXTABN*]$/.test(t[fin - 1])) fin--;
  // [índice del precio unitario, índice del total]: con IVA al final, con IVA % antes del total, o sin IVA.
  const cortes: [number, number][] = [];
  if (/^(0|1|2|4|8|13)%?$/.test(t[fin - 1]) && fin >= 5) cortes.push([fin - 3, fin - 2]);
  if (/^(0|1|2|4|8|13)%$/.test(t[fin - 2] ?? '') && fin >= 5) cortes.push([fin - 3, fin - 1]);
  cortes.push([fin - 2, fin - 1]);
  for (const [iu, it] of cortes) {
    const [unit, tot] = [t[iu], t[it]];
    if (!TOKEN_PRECIO.test(unit ?? '') || !TOKEN_PRECIO.test(tot ?? '')) continue;
    const descripcion = t.slice(1, iu).join(' ');
    if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(descripcion)) continue;
    const unitario = leerPrecio(unit), total = leerPrecio(tot);
    if (columnasCoherentes(cantidad, unitario, total)) return { cantidad, descripcion, unitario, total };
  }
  return undefined;
}

export function leerTiquete(texto: string): TiqueteLeido {
  const lineas: LineaTiquete[] = [];
  let total: number | undefined;
  let subtotal: number | undefined;
  let impuesto: number | undefined;
  let ignoradas = 0;
  let pendiente: { descripcion: string; codigo?: string; texto: string } | undefined;
  const hayCabys = /CABYS/i.test(texto);
  for (const cruda of texto.split(/\r?\n/)) {
    const l = limpiarLinea(cruda);
    if (!l || /^[-=_*.\s]+$/.test(l)) continue;
    const ms = l.match(RX_SUBTOTAL);
    if (ms) { subtotal = leerPrecio(ms.groups!.n); continue; }
    const mi = l.match(RX_IMPUESTO);
    if (mi) { impuesto = (impuesto ?? 0) + leerPrecio(mi.groups!.n); continue; }
    const mt = l.match(RX_TOTAL);
    if (mt) { total = leerPrecio(mt.groups!.n); continue; }
    if (RX_OTRO_TOTAL.test(l)) { ignoradas++; pendiente = undefined; continue; }
    if (RX_IGNORAR.test(l) || RX_TELEFONO_CEDULA.test(l) || RX_TERMINAL.test(l)) { ignoradas++; pendiente = undefined; continue; }
    // ¿Esta línea completa el producto de la línea anterior (cantidad o precio en la línea siguiente)?
    if (pendiente) {
      const anterior = pendiente;
      pendiente = undefined;
      const mq = l.match(RX_SOLO_CANTIDAD);
      if (mq) {
        const cantidad = Number(mq[1].replace(',', '.')), unitario = leerPrecio(mq[2]), precio = leerPrecio(mq[3]);
        if (columnasCoherentes(cantidad, unitario, precio) && precio >= PRECIO_MINIMO) {
          lineas.push({ texto: `${anterior.texto} / ${l}`, descripcion: anterior.descripcion, cantidad, precio, codigo: anterior.codigo });
          continue;
        }
      }
      const mp = l.match(RX_SOLO_PRECIO);
      if (mp && leerPrecio(mp[1]) >= PRECIO_MINIMO) {
        lineas.push({ texto: `${anterior.texto} / ${l}`, descripcion: anterior.descripcion, cantidad: 1, precio: leerPrecio(mp[1]), codigo: anterior.codigo });
        continue;
      }
      ignoradas++;   // la línea anterior quedó sin precio
    }
    const md = l.match(RX_DESC_CODIGO);
    if (md) { pendiente = { descripcion: md[1].replace(/\s+/g, ' ').trim(), codigo: codigoDeBarras(md[2], hayCabys), texto: l }; continue; }
    const col = leerColumnas(l);
    if (col && col.total >= PRECIO_MINIMO) {
      const codigo = codigoDeBarras(col.descripcion, hayCabys);
      const descripcion = col.descripcion.replace(RX_CODIGO, ' ').replace(/\s+/g, ' ').trim();
      lineas.push({ texto: l, descripcion, cantidad: col.cantidad, precio: col.total, codigo });
      continue;
    }
    const m = l.match(RX_LINEA);
    if (!m) { ignoradas++; continue; }
    const cantidad = m[2] && Number(m[2]) > 0 ? Number(m[2]) : 1;   // «0 x 650» es un error de lectura: 1 unidad
    const precio = leerPrecio(m[4]);
    const codigo = codigoDeBarras(m[1], hayCabys);
    const descripcion = m[1].replace(RX_CODIGO, ' ').replace(/\s+/g, ' ').trim();
    const letras = (descripcion.match(/[A-Za-zÁÉÍÓÚÑáéíóúñ]/g) ?? []).length;
    if (precio < PRECIO_MINIMO || (letras < LETRAS_MINIMAS && !codigo)) { ignoradas++; continue; }
    lineas.push({ texto: l, descripcion, cantidad, precio, codigo });
  }
  if (pendiente) ignoradas++;
  // Ninguna línea puede costar más que el tiquete entero: es ruido (p. ej. un número de transacción).
  const tope = total ?? subtotal;
  const validas = tope === undefined ? lineas : lineas.filter(x => x.precio <= tope + TOLERANCIA_TOTAL);
  ignoradas += lineas.length - validas.length;
  const sumaLineas = validas.reduce((a, x) => a + x.precio, 0);
  return { texto, lineas: validas, total, subtotal, impuesto, sumaLineas, ignoradas, cuadra: cuadre(sumaLineas, total, subtotal, impuesto) };
}
