import { describe, expect, it } from 'vitest';
import { fechaDe, leerPrecio, leerTiquete, noEsComida, unirTiquetes } from './tiquete';
import { identificar, tamano } from './identificar';
import { prod } from './fabrica';

const TIQUETE = `SUPERMERCADO EJEMPLO S.A. (SIMULADO)
FECHA 13/11/2026
LECH SEMID DP 1L          1 050
GALL RELL CHOC 432G       2 000
REFR COLA 600ML 2 x 650   1 300
ARROZ 99% 1,8KG           1 430
SUBTOTAL                  5 780
TOTAL                     5 780
TARJETA ****1234
CEDULA 1-1111-1111`;

describe('Lector de tiquetes', () => {
  it('lee líneas, cantidades y total; ignora tarjeta y cédula', () => {
    const t = leerTiquete(TIQUETE);
    expect(t.lineas.map(l => [l.descripcion, l.cantidad, l.precio])).toEqual([
      ['LECH SEMID DP 1L', 1, 1050], ['GALL RELL CHOC 432G', 1, 2000], ['REFR COLA 600ML', 2, 1300], ['ARROZ 99% 1,8KG', 1, 1430],
    ]);
    expect(t.total).toBe(5780);
    expect(t.cuadra).toBe(true);
    expect(t.lineas.some(l => /1111|1234/.test(l.texto))).toBe(false);
  });
  it('marca cuando la suma no cuadra con el total', () => {
    expect(leerTiquete(TIQUETE.replace('SUBTOTAL                  5 780', 'SUBTOTAL 9 999').replace('TOTAL                     5 780', 'TOTAL 9 999')).cuadra).toBe(false);
  });
  it('ignora teléfonos, cédulas, ruido con precio absurdo y descripciones sin letras', () => {
    const t = leerTiquete(['TEL 2148-3529', '4 a 95-2148-3529', 'e MU 5', '%% 12 1 300', 'ARROZ 1,8KG 1 430', 'TOTAL 1 430'].join('\n'));
    expect(t.lineas.map(l => l.descripcion)).toEqual(['ARROZ 1,8KG']);
    expect(t.cuadra).toBe(true);
  });
  it('separa el código de barras impreso en la línea', () => {
    const t = leerTiquete('PONES BG 7441078228952 1 390\nTOTAL 1 390');
    expect(t.lineas[0]).toMatchObject({ descripcion: 'PONES BG', codigo: '7441078228952', precio: 1390 });
  });
  it('tiquete largo en dos fotos: une las partes sin contar dos veces el traslape', () => {
    const parte1 = leerTiquete('LECH SEMID DP 1L 1 050\nGALL RELL CHOC 432G 2 000\nREFR COLA 600ML 2 x 650 1 300');
    // La segunda foto repite las dos últimas líneas, con ruido de OCR en la descripción.
    const parte2 = leerTiquete('GALL RELI CHOC 432G 2 000\nREFR C0LA 600ML 2 x 650 1 300\nARROZ 99% 1,8KG 1 430\nTOTAL 5 780');
    const t = unirTiquetes(parte1, parte2);
    expect(t.traslape).toBe(2);
    expect(t.lineas.map(l => l.precio)).toEqual([1050, 2000, 1300, 1430]);
    expect(t.cuadra).toBe(true);
  });
  it('sin traslape: suma todas las líneas', () => {
    const t = unirTiquetes(leerTiquete('LECH SEMID DP 1L 1 050'), leerTiquete('ARROZ 99% 1,8KG 1 430\nTOTAL 2 480'));
    expect(t.traslape).toBe(0);
    expect(t.cuadra).toBe(true);
  });
  it('formato en columnas CANT DESC P.UNIT TOTAL IVA% (tiquete v4.4 pagado por SINPE): cuadra con el subtotal', () => {
    // Estructura de un tiquete real publicado en redes (montos recalculados; datos SIMULADO).
    // Subtotal 1200+1590+3500+350+3100+8590 = 18 330; IVA 156+15,9+35+0+31+85,9 = 323,8 ≈ 324; total 18 654.
    const t = leerTiquete([
      '1 2UND HONGOS MORE&MAS 1200 1200 13',
      '2 FRIJOLES NEGROS SABR 795 1590 1',
      '2 2pack CAFE AVESTRUZ 1750 3500 1',
      '1 PASTA LITALIANA 350 350 0',
      '2 MASA MASA ERICA 905g 1550 3100 1',
      '2 ARROZ HALCON 81% 1kg 4295 8590 1',
      'CANTIDAD: 10',
      'SUBTOTAL: 18330',
      'IMPUESTO (I.V.A.): 324',
      'TOTAL: 18654',
      'FORMA DE PAGO:',
      'SINPE: 18654',
      'CONDICION VENTA: CONTADO',
      'MH-DGT-RES-0027-2024 del 19/11/2024 - Version 4.4',
    ].join('\n'));
    expect(t.lineas.map(l => [l.descripcion, l.cantidad, l.precio])).toEqual([
      ['2UND HONGOS MORE&MAS', 1, 1200], ['FRIJOLES NEGROS SABR', 2, 1590], ['2pack CAFE AVESTRUZ', 2, 3500],
      ['PASTA LITALIANA', 1, 350], ['MASA MASA ERICA 905g', 2, 3100], ['ARROZ HALCON 81% 1kg', 2, 8590],
    ]);
    expect(t).toMatchObject({ subtotal: 18330, impuesto: 324, total: 18654, cuadra: true });
  });
  it('formato Palí / Maxi Palí: código de barras, letra de impuesto al final y «TOTAL IVA» que no es el total', () => {
    const t = leerTiquete([
      'PALI (SIMULADO)',
      'LECHE SEMID 1L    7441001234567    1,050 G',
      'ARROZ 99% 1.8KG   7441006022390    1,430 E',
      'SAL SOL 500G      7441003600102      470 G',
      'PRECIOS INCLUYEN IMP. VALOR AGREGADO',
      'TOTAL                     2,950',
      'TOTAL IVA                   121',
      'EFECTIVO                  5,000',
      'CAMBIO                    2,050',
      '# ARTS. VENDIDOS 3',
    ].join('\n'));
    expect(t.lineas.map(l => [l.descripcion, l.codigo, l.precio])).toEqual([
      ['LECHE SEMID 1L', '7441001234567', 1050], ['ARROZ 99% 1.8KG', '7441006022390', 1430], ['SAL SOL 500G', '7441003600102', 470],
    ]);
    expect(t).toMatchObject({ total: 2950, impuesto: 121, cuadra: true });
  });
  it('la suma con IVA incluido sigue cuadrando contra el total', () => {
    expect(leerTiquete('PAN 1 000\nLECHE 1 500\nSUBTOTAL 2 300\nIVA 200\nTOTAL 2 500').cuadra).toBe(true);
  });
  it('formatos de precio', () => {
    expect(leerPrecio('1 050,00')).toBe(1050);
    expect(leerPrecio('1,050.00')).toBe(1050);
    expect(leerPrecio('1.050')).toBe(1050);
    expect(leerPrecio('950')).toBe(950);
  });
});

describe('Identificación de productos', () => {
  const yogur1L = prod({ ean: 'Y1', nombre: 'Yogurt de fresa', marca: 'Dos Pinos', cantidadNum: 1000, unidad: 'ml' });
  const yogur250 = prod({ ean: 'Y2', nombre: 'Yogurt de fresa', marca: 'Dos Pinos', cantidadNum: 250, unidad: 'ml' });
  const leche = prod({ ean: 'L1', nombre: 'Leche semidescremada', marca: 'Dos Pinos', cantidadNum: 1000, unidad: 'ml' });
  const base = [yogur250, leche, yogur1L];

  it('tamaños', () => {
    expect(tamano('ARROZ 1,8KG')).toEqual({ valor: 1800, unidad: 'g' });
    expect(tamano('REFR 600ML')).toEqual({ valor: 600, unidad: 'ml' });
    expect(tamano('YOG 1L')).toEqual({ valor: 1000, unidad: 'ml' });
  });
  it('abreviaturas + tamaño: «YOG FRESA DP 1L» es el yogur de 1 L, no el de 250 ml', () => {
    const r = identificar('YOG FRESA DP 1L', base);
    expect(r.producto?.ean).toBe('Y1');
    expect(r.dudoso).toBe(false);
  });
  it('código de barras impreso: identificación exacta, también UPC-A de 12 dígitos', () => {
    const conCodigo = prod({ ean: '0749107822895', nombre: 'Producto con código' });
    expect(identificar('XX', [...base, conCodigo], {}, '749107822895')).toMatchObject({ metodo: 'codigo', dudoso: false });
    expect(identificar('XX', [...base, conCodigo], {}, '749107822895').producto?.ean).toBe('0749107822895');
  });
  it('alias aprendido tiene prioridad', () => {
    expect(identificar('YOG FRESA DP 1L', base, { 'YOG FRESA DP 1L': 'Y2' }).producto?.ean).toBe('Y2');
  });
  it('texto sin coincidencias: dudoso y sin producto', () => {
    const r = identificar('ZZZ QQQ', base);
    expect(r.producto).toBeUndefined();
    expect(r.dudoso).toBe(true);
  });
});

describe('Revisión independiente', () => {
  it('«0 x precio» es un error de lectura: cuenta como 1 unidad (nunca divide entre 0)', () => {
    const t = leerTiquete('REFR COLA 600ML 0 x 650   650\nTOTAL 650');
    expect(t.lineas[0]).toMatchObject({ cantidad: 1, precio: 650 });
  });
});

// Tiquete real de Palí, ANONIMIZADO: sucursal, fecha, hora, teléfono y números de comprobante cambiados.
// Productos, códigos de barras, cantidades y montos son los reales: son los que prueban el lector.
// Formato del grupo Walmart: código de 12 dígitos (EAN-13 sin dígito de control), letra de impuesto,
// cantidad en la línea siguiente y un encabezado con «TDA# OP# TE# TR#».
export const TIQUETE_PALI_REAL = `PALI SUCURSAL
CORPORACION SUPERMERCADOS UNIDOS S.R.L.
20000000
CED JUR. 3102007223
TDA#0001 OP#00000001 TE# 001 TR# 54321
MANT DOS P 1 744100161251 1,100 G
PAN INTEG 744102950032 1,430 G
TOA SCOTT 3U 744100817573 1,000 G
LECH LIQ SEM 744100160106
2 X ¢1,070 2,140 G
JOHNNYS CHOC 770200701687 1,060 G
LECHE POLV 744101350569 2,270 G
Subtotal ¢ 9,000
Total ¢ 9,000
EFECTIVO ¢ 10,000
CAMBIO ¢ 1,000
PRECIOS INCLUYEN IMP. VALOR AGREGADO
IVA% PRECIO IVA TOTAL
G 1% 6,832 68 6,900
G13% 1,858 242 2,100
TOTAL IVA A PAGAR ¢ 310
# ARTS. VENDIDOS 7
Tiquete Electronico 00000000000000000000
TC# 0000000000000000 0000
Servicio al cliente gratis 8008000722
Clave Numerica: 50000000000000000000000000000000000000000000000000
01/11/25 08:00:00 0001 01 0001 0001
COBRA AQUI TU REMESA Y PAGA TU SUPER.`;

describe('Tiquete real de Palí (primer caso real)', () => {
  it('lee los 6 productos, la cantidad de la línea siguiente y cuadra con el total', () => {
    const t = leerTiquete(TIQUETE_PALI_REAL);
    expect(t.lineas.map(l => [l.descripcion, l.codigo, l.cantidad, l.precio])).toEqual([
      ['MANT DOS P 1', '744100161251', 1, 1100], ['PAN INTEG', '744102950032', 1, 1430],
      ['TOA SCOTT 3U', '744100817573', 1, 1000], ['LECH LIQ SEM', '744100160106', 2, 2140],
      ['JOHNNYS CHOC', '770200701687', 1, 1060], ['LECHE POLV', '744101350569', 1, 2270],
    ]);
    expect(t).toMatchObject({ total: 9000, subtotal: 9000, impuesto: 310, sumaLineas: 9000, cuadra: true });
    expect(t.lineas.reduce((s, l) => s + l.cantidad, 0)).toBe(7);   // «# ARTS. VENDIDOS 7»
  });
  it('el encabezado «TDA# OP# TE# TR#» nunca es un producto', () => {
    expect(leerTiquete('TDA#3113 OP#00000047 TE# 003 TR# 53258\nPAN 1 430\nTOTAL 1 430').lineas.map(l => l.descripcion)).toEqual(['PAN']);
  });
  it('una línea con precio mayor que el total del tiquete es ruido', () => {
    const t = leerTiquete('PAN 1 430\nCOSA RARA 53 258\nTOTAL 1 430');
    expect(t.lineas.map(l => l.descripcion)).toEqual(['PAN']);
    expect(t.cuadra).toBe(true);
  });
  it('el precio partido en la línea siguiente también se une (corte del OCR)', () => {
    const t = leerTiquete('PAN INTEG 744102950032\n1,430 G\nTOTAL 1,430');
    expect(t.lineas).toEqual([expect.objectContaining({ descripcion: 'PAN INTEG', codigo: '744102950032', cantidad: 1, precio: 1430 })]);
  });
  it('la cantidad de la línea siguiente debe ser coherente (2 × 1070 = 2140)', () => {
    expect(leerTiquete('LECH LIQ SEM 744100160106\n2 X ¢1,070 9,999 G').lineas).toEqual([]);
  });
  it('Palí imprime el EAN-13 sin su dígito de control: se identifica igual', () => {
    const mantequilla = prod({ ean: '7441001612510', nombre: 'Beurre', marca: 'Dos Pinos' });
    const leche = prod({ ean: '7441001601064', nombre: 'Leche Dos Pinos Semidescremada' });
    const r = identificar('MANT DOS P 1', [leche, mantequilla], {}, '744100161251');
    expect(r).toMatchObject({ metodo: 'codigo', dudoso: false });
    expect(r.producto?.ean).toBe('7441001612510');
    expect(identificar('LECH LIQ SEM', [leche, mantequilla], {}, '744100160106').producto?.ean).toBe('7441001601064');
  });
  it('código impreso que no está en la base: el parecido por texto se pregunta (puede ser otra marca)', () => {
    const polvoDosPinos = prod({ ean: '7441001350566', nombre: 'Leche en polvo', marca: 'Dos Pinos' });
    const r = identificar('LECHE POLV', [polvoDosPinos], {}, '744101350569');
    expect(r.dudoso).toBe(true);
    expect(r.candidatos.map(c => c.ean)).toContain('7441001350566');   // se ofrece como opción, no se afirma
    expect(identificar('LECHE POLV', [polvoDosPinos]).dudoso).toBe(false);   // sin código impreso, el texto basta
  });
});

// Factura electrónica en TEXTO (representación gráfica) pegada por Pablo el 2026-11-14. Es SIMULADO: la generó una
// herramienta de IA (lo dice su encabezado) y sus códigos CAByS son inventados. Sirve para probar el formato, no como dato real.
export const FACTURA_TEXTO_SIMULADA = `REPRESENTACIÓN GRÁFICA DE COMPROBANTE ELECTRÓNICO
(Documento simulado únicamente con fines ilustrativos o de prueba)
EMISOR: CORPORACIÓN DE SUPERMERCADOS UNIDOS S.R.L.
Nombre Comercial: WALMART SAN SEBASTIÁN
Cédula Jurídica: 3-102-045293 (Simulada)
Teléfono: 800-800-0722 | Correo: facturacion.cr@walmart.com
• Fecha de Emisión: 14/11/2026 11:17:05
RECEPTOR (CLIENTE)
• Nombre: CLIENTE CONTADO / PRUEBA FRONTEND
• Identificación: 01-1234-5678 (Cédula Física)
Cant.	Código CAByS	Descripción del Producto	Precio Unit.	IVA	Subtotal Neto
1.00	2316102010100	ARROZ TIO PELON 99% GRANO ENTERO 4KG	₡3,150.00	1%	₡3,150.00
1.00	0170100010100	FRIJOL ROJO INDIANA PREMIUM 1.8KG	₡2,980.00	1%	₡2,980.00
1.00	2352000010100	AZUCAR DOÑA MARIA 2KG	₡1,450.00	1%	₡1,450.00
1.00	2781000010100	SAL SOL REFINADA 500G	₡470.00	1%	₡470.00
1.00	2211001010100	LECHE DOS PINOS SEMIDESCREMADA 6 PACK 1L	₡5,990.00	1%	₡5,990.00
1.00	0231000010100	HUEVOS BLANCOS GRANDE CARTON 30 UND	₡4,490.00	1%	₡4,490.00
1.00	2154900010100	ACEITE CLOVER VEGETAL 1.8L	₡3,590.00	1%	₡3,590.00
1.00	2391100010100	CAFE 1820 MOLIDO CLASICO 1KG	₡6,450.00	1%	₡6,450.00
2.10	2112101010100	PECHUGA DE POLLO DESHUESADA (KG)	₡4,200.00	1%	₡8,820.00
1.50	2111101010100	CARNE MOLIDA DE RES PREMIUM 5% GRASA (KG)	₡5,400.00	1%	₡8,100.00
4.00	2124200010100	ATUN SARDIMAR TROZOS EN ACEITE 140G	₡990.00	1%	₡3,960.00
3.00	2371000010100	SPAGHETTI ROMA 500G	₡720.00	1%	₡2,160.00
4.00	2139900010100	SALSA DE TOMATE NATURAS RANCHERA 226G	₡550.00	1%	₡2,200.00
2.00	2341000010100	PAN CUADRADO BIMBO BLANCO GRANDE 680G	₡1,650.00	1%	₡3,300.00
1.00	2225101010100	QUESO TURRIALBA DOS PINOS 400G	₡2,650.00	1%	₡2,650.00
1.00	2224100010100	MANTEQUILLA DOS PINOS CON SAL 227G	₡1,890.00	1%	₡1,890.00
2.50	0151000010100	PAPA BLANCA GRANEL (KG)	₡1,250.00	1%	₡3,125.00
1.20	0125301010100	CEBOLLA AMARILLA GRANEL (KG)	₡1,100.00	1%	₡1,320.00
1.50	0123400010100	TOMATE PRIMERA GRANEL (KG)	₡1,350.00	1%	₡2,025.00
2.00	0131200010100	BANANO CRIOLLO GRANEL (KG)	₡650.00	1%	₡1,300.00
1.00	3219301010100	PAPEL HIGIENICO SCOTT 12 ROLLOS	₡5,450.00	13%	₡5,450.00
1.00	3532201010100	DETERGENTE LIQUIDO MAS COLOR 3L	₡6,890.00	13%	₡6,890.00
1.00	3532202010100	CLORO MAGIA BLANCA 3.8L	₡2,250.00	13%	₡2,250.00
1.00	3532203010100	JABON LIQUIDO LAVAPLATOS AXION LIMON 1.4L	₡2,890.00	13%	₡2,890.00
1.00	3532301010100	PASTA DENTAL COLGATE TRIPLE ACCION 2 PACK	₡2,450.00	13%	₡2,450.00
2.00	3532304010100	DESODORANTE REXONA MEN AEROSOL 150ML	₡2,390.00	13%	₡4,780.00
1.00	3532302010100	SHAMPOO HEAD & SHOULDERS LIMPIEZA 700ML	₡4,950.00	13%	₡4,950.00
1.00	2342001010100	GALLETAS POZUELO CHIKY 12 PACK	₡2,150.00	13%	₡2,150.00
RESUMEN DE TOTALES
• Subtotal Gravado (Canasta Básica 1%): ₡69,420.00
• Subtotal Gravado (Tarifa General 13%): ₡31,810.00
• Total Venta Neta: ₡101,230.00
• Total IVA 1%: ₡694.20
• Total IVA 13%: ₡4,135.30
• Total Impuestos: ₡4,829.50
• TOTAL COMPROBANTE: ₡106,059.50`;

describe('Factura electrónica pegada como texto (formato de representación gráfica)', () => {
  it('lee las 28 líneas: ₡ con decimales, tabuladores, IVA antes del total y kilos', () => {
    const t = leerTiquete(FACTURA_TEXTO_SIMULADA);
    expect(t.lineas).toHaveLength(28);
    expect(t.lineas[0]).toMatchObject({ descripcion: 'ARROZ TIO PELON 99% GRANO ENTERO 4KG', cantidad: 1, precio: 3150 });
    expect(t.lineas.find(l => l.descripcion.startsWith('PECHUGA'))).toMatchObject({ cantidad: 2.1, precio: 8820 });
    expect(t.lineas.find(l => l.descripcion.startsWith('DESODORANTE'))).toMatchObject({ cantidad: 2, precio: 4780 });
  });
  it('la columna CAByS (clasificación de Hacienda) nunca se usa como código de barras', () => {
    expect(leerTiquete(FACTURA_TEXTO_SIMULADA).lineas.every(l => l.codigo === undefined)).toBe(true);
  });
  it('totales con viñeta: neto + IVA = total del comprobante, y cuadra', () => {
    const t = leerTiquete(FACTURA_TEXTO_SIMULADA);
    expect(t.sumaLineas).toBe(101230);
    expect(t.total).toBe(106059.5);
    expect(t.subtotal).toBe(101230);
    expect(t.impuesto).toBeCloseTo(4829.5, 2);
    expect(t.cuadra).toBe(true);
  });
  it('se reconoce como demostración y como Walmart', async () => {
    const { esDemostracion } = await import('./simulados');
    const { detectarCadena } = await import('./comercio');
    expect(esDemostracion(undefined, FACTURA_TEXTO_SIMULADA)).toBe(true);
    expect(detectarCadena(FACTURA_TEXTO_SIMULADA)).toBe('Walmart');
  });
  it('lo que no es comida se reconoce (y las galletas no)', () => {
    const nombres = leerTiquete(FACTURA_TEXTO_SIMULADA).lineas.filter(l => noEsComida(l.descripcion)).map(l => l.descripcion.split(' ')[0]);
    expect(nombres).toEqual(['PAPEL', 'DETERGENTE', 'CLORO', 'JABON', 'PASTA', 'DESODORANTE', 'SHAMPOO']);
    expect(noEsComida('TOA SCOTT 3U')).toBe(true);
    expect(noEsComida('GALLETAS POZUELO CHIKY 12 PACK')).toBe(false);
    expect(noEsComida('PASTA ROMA SPAGHETTI 500G')).toBe(false);   // «pasta» sola es comida; «pasta dental» no
  });
  it('fecha de la compra desde el texto (dd/mm/aaaa o dd/mm/aa)', () => {
    expect(fechaDe(FACTURA_TEXTO_SIMULADA)).toBe('2026-11-14');
    expect(fechaDe(TIQUETE_PALI_REAL)).toBe('2025-11-01');
    expect(fechaDe('sin fecha')).toBeUndefined();
    expect(fechaDe('31/02/2026')).toBeUndefined();   // fecha imposible
  });
});

describe('Alimentos frescos sin empaque (no llevan sellos: no hace falta identificarlos)', () => {
  it('a granel, por kilo o con nombre de fruta, verdura o huevo al inicio', async () => {
    const { esFresco } = await import('./tiquete');
    const frescos = leerTiquete(FACTURA_TEXTO_SIMULADA).lineas.filter(l => esFresco(l.descripcion)).map(l => l.descripcion.split(' ')[0]);
    expect(frescos).toEqual(['HUEVOS', 'PECHUGA', 'CARNE', 'PAPA', 'CEBOLLA', 'TOMATE', 'BANANO']);
  });
  it('lo procesado o empacado no es fresco aunque nombre una fruta o verdura', async () => {
    const { esFresco } = await import('./tiquete');
    for (const d of ['SALSA DE TOMATE NATURAS RANCHERA 226G', 'PAPAS FRITAS LAYS 150G', 'ARROZ TIO PELON 99% 4KG', 'JUGO DE MANZANA 1L', 'GALLETAS POZUELO CHIKY']) {
      expect(esFresco(d), d).toBe(false);
    }
  });
});
