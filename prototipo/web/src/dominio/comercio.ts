// Comercio y lugar de la compra. Las listas son las mismas del servicio (api/canasta_api/geografia.py);
// una prueba compara ambos archivos para que no se desalineen.

export const CADENAS = [
  'Auto Mercado', 'Fresh Market', 'Maxi Palí', 'Más x Menos', 'Mega Super', 'Palí', 'Pequeño Mundo',
  'Perimercados', 'PriceSmart', 'Super Compro', 'Walmart', 'Pulpería o minisúper', 'Feria del agricultor', 'Otro',
] as const;

// 84 cantones, división vigente desde 2022. POR VERIFICAR contra la División Territorial Administrativa oficial.
export const PROVINCIAS: Record<string, string[]> = {
  'San José': ['San José', 'Escazú', 'Desamparados', 'Puriscal', 'Tarrazú', 'Aserrí', 'Mora', 'Goicoechea',
    'Santa Ana', 'Alajuelita', 'Vázquez de Coronado', 'Acosta', 'Tibás', 'Moravia', 'Montes de Oca',
    'Turrubares', 'Dota', 'Curridabat', 'Pérez Zeledón', 'León Cortés Castro'],
  'Alajuela': ['Alajuela', 'San Ramón', 'Grecia', 'San Mateo', 'Atenas', 'Naranjo', 'Palmares', 'Poás', 'Orotina',
    'San Carlos', 'Zarcero', 'Sarchí', 'Upala', 'Los Chiles', 'Guatuso', 'Río Cuarto'],
  'Cartago': ['Cartago', 'Paraíso', 'La Unión', 'Jiménez', 'Turrialba', 'Alvarado', 'Oreamuno', 'El Guarco'],
  'Heredia': ['Heredia', 'Barva', 'Santo Domingo', 'Santa Bárbara', 'San Rafael', 'San Isidro', 'Belén', 'Flores',
    'San Pablo', 'Sarapiquí'],
  'Guanacaste': ['Liberia', 'Nicoya', 'Santa Cruz', 'Bagaces', 'Carrillo', 'Cañas', 'Abangares', 'Tilarán',
    'Nandayure', 'La Cruz', 'Hojancha'],
  'Puntarenas': ['Puntarenas', 'Esparza', 'Buenos Aires', 'Montes de Oro', 'Osa', 'Quepos', 'Golfito', 'Coto Brus',
    'Parrita', 'Corredores', 'Garabito', 'Monteverde', 'Puerto Jiménez'],
  'Limón': ['Limón', 'Pococí', 'Siquirres', 'Talamanca', 'Matina', 'Guácimo'],
};

export const CANTONES = Object.values(PROVINCIAS).flat();

// Nombre del comercio en el encabezado del tiquete o de la factura. Maxi Palí va antes que Palí.
// Sin \b al lado de «í»: en JavaScript \b no la ve como letra y «Palí» no coincidiría. Se usan búsquedas de letra.
const PATRONES: [RegExp, string][] = [
  [/MAXI\s*-?\s*PAL[IÍ1](?![A-Za-zÁÉÍÓÚÑáéíóúñ])/i, 'Maxi Palí'],
  [/(?<![A-Za-zÁÉÍÓÚÑáéíóúñ])PAL[IÍ](?![A-Za-zÁÉÍÓÚÑáéíóúñ])/i, 'Palí'],
  [/M[AÁ]S\s*(?:X|POR)\s*MENOS/i, 'Más x Menos'],
  [/WAL\s*-?\s*MART/i, 'Walmart'],
  [/AUTO\s*-?\s*MERCADO/i, 'Auto Mercado'],
  [/MEGA\s*-?\s*S[UÚ]PER/i, 'Mega Super'],
  [/PRICE\s*-?\s*SMART/i, 'PriceSmart'],
  [/FRESH\s*MARKET/i, 'Fresh Market'],
  [/PERI\s*-?\s*MERCADOS?/i, 'Perimercados'],
  [/S[UÚ]PER\s*COMPRO/i, 'Super Compro'],
  [/PEQUE[ÑN]O\s*MUNDO/i, 'Pequeño Mundo'],
];
export const LINEAS_ENCABEZADO = 12;

/** Detecta la cadena en el nombre comercial de la factura o en el encabezado del tiquete (primeras líneas),
 *  para no pedirle a la persona que lo escriba. Si no la reconoce, devuelve undefined. */
export function detectarCadena(...textos: (string | undefined)[]): string | undefined {
  for (const t of textos) {
    if (!t) continue;
    const cabecera = t.split(/\r?\n/).slice(0, LINEAS_ENCABEZADO).join('\n');
    for (const [rx, cadena] of PATRONES) if (rx.test(cabecera)) return cadena;
  }
  return undefined;
}
