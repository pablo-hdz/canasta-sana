// Códigos de barras GS1: las mismas reglas que el servicio (api/canasta_api/productos.py).

/** Dígito de control GS1 que corresponde a un cuerpo de código (módulo 10, pesos 3 y 1 desde la derecha). */
export function digitoControl(cuerpo: string): string {
  const suma = [...cuerpo].map(Number).reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return String((10 - (suma % 10)) % 10);
}

/** Dígito de control GS1 (módulo 10, pesos 3 y 1 desde la derecha) para EAN-8, UPC-A y EAN-13. */
export function eanValido(ean: string): boolean {
  if (!/^(\d{8}|\d{12}|\d{13})$/.test(ean)) return false;
  const d = [...ean].map(Number);
  const control = d.pop()!;
  const suma = d.reverse().reduce((s, x, i) => s + x * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10 === control;
}

/** UPC-E (8 dígitos, sistema 0 o 1) → UPC-A de 12 dígitos (regla de expansión de GS1 según el último dígito). */
export function expandirUpcE(upce: string): string | undefined {
  if (!/^[01]\d{7}$/.test(upce)) return undefined;
  const [n, d1, d2, d3, d4, d5, d6, control] = [...upce];
  const cuerpo = d6 <= '2' ? `${d1}${d2}${d6}0000${d3}${d4}${d5}`
    : d6 === '3' ? `${d1}${d2}${d3}00000${d4}${d5}`
    : d6 === '4' ? `${d1}${d2}${d3}${d4}00000${d5}`
    : `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${n}${cuerpo}${control}`;
}

/** Código que sirve de una lectura de la cámara: solo dígitos y con dígito de control válido.
 *  Un UPC-E se pasa a UPC-A, que es como está en la base. Si no sirve, undefined. */
export function codigoDeLectura(crudo: string, formato?: string): string | undefined {
  const c = crudo.trim();
  if (!/^\d+$/.test(c)) return undefined;
  if (formato !== 'upc_e' && eanValido(c)) return c;
  const upca = c.length === 8 ? expandirUpcE(c) : undefined;
  return upca && eanValido(upca) ? upca : undefined;
}

/** Confirma una lectura en vivo: el mismo código válido en 2 cuadros seguidos (evita lecturas falsas).
 *  Un cuadro sin código no reinicia la cuenta; otro código, sí. */
export function confirmadorDeLecturas(veces = 2): (codigos: (string | undefined)[]) => string | undefined {
  let ultimo = '';
  let cuenta = 0;
  return codigos => {
    const c = codigos.find((x): x is string => !!x);
    if (!c) return undefined;
    cuenta = c === ultimo ? cuenta + 1 : 1;
    ultimo = c;
    return cuenta >= veces ? c : undefined;
  };
}

/** UPC-A (12 dígitos) es el mismo código que su EAN-13 con un 0 delante. */
export const normalizarEan = (ean: string) => (ean.length === 12 ? '0' + ean : ean);

/** Códigos de circulación restringida o que no son productos: su precio no es comparable entre comercios.
 *  EAN-13: 2x (uso interno); UPC-A sistema 2 → 02 (peso variable), 4 → 04 (uso interno), 5 → 05 (cupones).
 *  EAN-8: 0 y 2. Basado en las GS1 General Specifications (POR VERIFICAR). Mismas reglas que el servicio. */
export function usoInterno(ean: string): boolean {
  const e = normalizarEan(ean);
  if (e.length === 8) return e[0] === '0' || e[0] === '2';
  return e[0] === '2' || ['02', '04', '05'].includes(e.slice(0, 2));
}
