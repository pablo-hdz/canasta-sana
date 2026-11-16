// Canasta sana — plugin de desarrollo de Figma que crea 4 pantallas de baja fidelidad.
// Todos los productos y precios son SIMULADO. No usa red (networkAccess: none).
// Parámetros al inicio; sintaxis ES2017 (sin ?. ni ??) por compatibilidad con el sandbox.

var ANCHO = 360;          // px, teléfono típico
var ALTO_MIN = 800;       // px
var SEPARACION = 80;      // px entre pantallas
var FUENTE = 'Inter';

function hex(h) {
  var n = parseInt(h.slice(1), 16);
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 };
}
var C = {
  verde: hex('#1B6E3A'), texto: hex('#1A1A1A'), gris: hex('#5F6368'), fondo: hex('#FFFFFF'),
  tarjeta: hex('#F3F5F2'), negro: hex('#000000'), blanco: hex('#FFFFFF'),
  ambar: hex('#8A5300'), ambarClaro: hex('#FFF8E1'), verdeClaro: hex('#E6F2EA')
};
function solido(c) { return [{ type: 'SOLID', color: c }]; }
function esAutoLayout(n) { return n.layoutMode === 'VERTICAL' || n.layoutMode === 'HORIZONTAL'; }

var creados = { pantallas: 0, textos: 0, botones: 0, sellos: 0 };

function texto(padre, chars, o) {
  o = o || {};
  var t = figma.createText();
  t.fontName = { family: FUENTE, style: o.negrita ? 'Bold' : 'Regular' };
  t.characters = chars;
  t.fontSize = o.tam || 18;
  t.fills = solido(o.color || C.texto);
  if (o.alinear) t.textAlignHorizontal = o.alinear;
  padre.appendChild(t);
  if (esAutoLayout(padre) && !o.ajustar) t.layoutSizingHorizontal = 'FILL';
  t.textAutoResize = (esAutoLayout(padre) && !o.ajustar) ? 'HEIGHT' : 'WIDTH_AND_HEIGHT';
  creados.textos++;
  return t;
}

function caja(padre, o) {
  o = o || {};
  var f = figma.createFrame();
  f.name = o.nombre || 'Caja';
  f.layoutMode = o.dir || 'VERTICAL';
  f.itemSpacing = (o.gap === undefined) ? 8 : o.gap;
  f.paddingLeft = f.paddingRight = (o.padX === undefined) ? 16 : o.padX;
  f.paddingTop = f.paddingBottom = (o.padY === undefined) ? 12 : o.padY;
  f.fills = o.relleno ? solido(o.relleno) : [];
  f.cornerRadius = o.radio || 0;
  if (o.borde) { f.strokes = solido(o.borde); f.strokeWeight = 1.5; }
  f.primaryAxisSizingMode = 'AUTO';
  f.counterAxisSizingMode = 'AUTO';
  if (o.centrar) { f.counterAxisAlignItems = 'CENTER'; f.primaryAxisAlignItems = 'CENTER'; }
  padre.appendChild(f);
  if (esAutoLayout(padre) && !o.ajustar) f.layoutSizingHorizontal = 'FILL';
  return f;
}

// Botón de al menos 48 px de alto (RNF-04)
function boton(padre, etiqueta, primario, o) {
  o = o || {};
  var b = caja(padre, {
    nombre: 'Botón: ' + etiqueta, dir: 'HORIZONTAL', padX: 16, padY: 16,
    relleno: primario ? C.verde : C.blanco, borde: primario ? null : C.verde, radio: 12,
    centrar: true, ajustar: o.ajustar
  });
  b.minHeight = 48;
  texto(b, etiqueta, { negrita: true, tam: o.compacto ? 16 : 18, color: primario ? C.blanco : C.verde, alinear: 'CENTER' });
  creados.botones++;
  return b;
}

function chip(padre, etiqueta, colorTexto, colorFondo) {
  var c = caja(padre, { nombre: 'Etiqueta: ' + etiqueta, dir: 'HORIZONTAL', padX: 10, padY: 4, relleno: colorFondo, radio: 8, ajustar: true });
  texto(c, etiqueta, { negrita: true, tam: 16, color: colorTexto, ajustar: true });
  return c;
}

// Sello octagonal negro de tapa plana, 80 x 80 px
function sello(padre, linea1, linea2) {
  var s = figma.createFrame();
  s.name = 'Sello: ' + linea1 + ' ' + linea2;
  s.resize(80, 80);
  s.fills = [];
  var v = figma.createVector();
  v.vectorPaths = [{ windingRule: 'NONZERO', data: 'M 24 0 L 56 0 L 80 24 L 80 56 L 56 80 L 24 80 L 0 56 L 0 24 Z' }];
  v.fills = solido(C.negro);
  v.strokes = solido(C.blanco);
  v.strokeWeight = 2;
  s.appendChild(v);
  var t = figma.createText();
  t.fontName = { family: FUENTE, style: 'Bold' };
  t.characters = linea1 + '\n' + linea2;
  t.fontSize = 11;
  t.fills = solido(C.blanco);
  t.textAlignHorizontal = 'CENTER';
  t.textAlignVertical = 'CENTER';
  t.textAutoResize = 'NONE';
  t.resize(70, 50);
  t.x = 5; t.y = 15;
  s.appendChild(t);
  padre.appendChild(s);
  creados.sellos++;
  creados.textos++;
  return s;
}

function pantalla(nombre, i) {
  var f = figma.createFrame();
  f.name = nombre;
  f.resize(ANCHO, ALTO_MIN);
  f.x = i * (ANCHO + SEPARACION);
  f.y = 0;
  f.fills = solido(C.fondo);
  f.layoutMode = 'VERTICAL';
  f.counterAxisSizingMode = 'FIXED';
  f.primaryAxisSizingMode = 'AUTO';
  f.minHeight = ALTO_MIN;
  f.paddingLeft = f.paddingRight = 20;
  f.paddingTop = 24; f.paddingBottom = 32;
  f.itemSpacing = 16;
  figma.currentPage.appendChild(f);
  // Barra superior: nombre + marca de datos simulados
  var barra = caja(f, { nombre: 'Barra', dir: 'HORIZONTAL', padX: 0, padY: 0, gap: 8 });
  barra.counterAxisAlignItems = 'CENTER';
  texto(barra, 'Canasta sana', { negrita: true, tam: 16, color: C.verde });
  chip(barra, 'SIMULADO', C.ambar, C.ambarClaro);
  creados.pantallas++;
  return f;
}

function filaProducto(padre, nombre, detalle, listo) {
  var fila = caja(padre, { nombre: 'Producto: ' + nombre, dir: 'HORIZONTAL', relleno: listo ? C.tarjeta : C.ambarClaro, radio: 12, gap: 12 });
  fila.counterAxisAlignItems = 'CENTER';
  var col = caja(fila, { nombre: 'Datos', padX: 0, padY: 0, gap: 2 });
  texto(col, nombre, { negrita: true, tam: 18 });
  texto(col, detalle, { tam: 16, color: C.gris });
  chip(fila, listo ? 'Listo' : '¿Cuál es?', listo ? C.verde : C.ambar, listo ? C.verdeClaro : C.blanco);
  return fila;
}

async function main() {
  await figma.loadFontAsync({ family: FUENTE, style: 'Regular' });
  await figma.loadFontAsync({ family: FUENTE, style: 'Bold' });

  var titulo = figma.createText();
  titulo.fontName = { family: FUENTE, style: 'Bold' };
  titulo.characters = 'Canasta sana — pantallas v0.1 (baja fidelidad, datos SIMULADO) — 2026-11-13';
  titulo.fontSize = 24;
  titulo.fills = solido(C.texto);
  titulo.x = 0; titulo.y = -64;
  figma.currentPage.appendChild(titulo);

  // 1 · Inicio
  var p1 = pantalla('1 · Inicio', 0);
  texto(p1, 'Coma mejor sin gastar más', { negrita: true, tam: 30, color: C.verde });
  texto(p1, 'Tome una foto de su tiquete del súper. Le mostramos cambios fáciles, en su súper y al mismo precio o menos.', { tam: 20 });
  boton(p1, 'Tomar foto del tiquete', true);
  boton(p1, 'Elegir foto de la galería', false);
  var priv = caja(p1, { nombre: 'Privacidad', relleno: C.tarjeta, radio: 12, gap: 6 });
  texto(priv, 'Su privacidad', { negrita: true, tam: 18 });
  texto(priv, 'Su foto y sus compras no salen de su teléfono.', { tam: 16 });
  texto(priv, 'Esta app nunca le pedirá su clave ni su tarjeta.', { tam: 16 });
  texto(p1, 'Datos de productos: Open Food Facts (ODbL). Información general: no sustituye la atención en su EBAIS.', { tam: 16, color: C.gris });

  // 2 · Revise sus productos
  var p2 = pantalla('2 · Revise sus productos', 1);
  texto(p2, 'Revise sus productos', { negrita: true, tam: 26 });
  texto(p2, 'Encontramos 5 productos. Toque uno para corregirlo.', { tam: 18 });
  filaProducto(p2, 'Leche semidescremada 1 L', '1 unidad · ₡1 050', true);
  filaProducto(p2, 'Galletas rellenas 432 g', '1 unidad · ₡2 000', true);
  var dudoso = filaProducto(p2, 'YOG FRESA 1L', 'No estamos seguros de cuál es · ₡1 450', false);
  boton(p2, 'Escanear el código de barras del yogur', false, { compacto: true });
  filaProducto(p2, 'Arroz 99 % 1,8 kg', '1 unidad · ₡1 430', true);
  filaProducto(p2, 'Salchichas de pollo 500 g', '1 unidad · ₡1 850', true);
  boton(p2, 'Todo está bien: ver mi canasta', true);

  // 3 · Su canasta
  var p3 = pantalla('3 · Su canasta', 2);
  texto(p3, 'Su canasta', { negrita: true, tam: 26 });
  var res = caja(p3, { nombre: 'Resumen', relleno: C.tarjeta, radio: 12, gap: 6 });
  texto(res, 'De 12 productos empacados, 3 tienen al menos un sello.', { negrita: true, tam: 20 });
  texto(res, 'Frutas, verduras, arroz y frijoles no llevan sellos.', { tam: 16, color: C.gris });
  var items = [
    ['Galletas rellenas 432 g', [['EXCESO', 'AZÚCARES'], ['EXCESO', 'GRASAS SAT.']]],
    ['Salchichas de pollo 500 g', [['EXCESO', 'SODIO'], ['EXCESO', 'GRASAS SAT.']]],
    ['Yogur de fresa 1 L', [['EXCESO', 'AZÚCARES']]]
  ];
  for (var i = 0; i < items.length; i++) {
    var tarjeta = caja(p3, { nombre: 'Producto con sellos: ' + items[i][0], relleno: C.blanco, borde: C.tarjeta, radio: 12, gap: 8 });
    texto(tarjeta, items[i][0], { negrita: true, tam: 18 });
    var filaSellos = caja(tarjeta, { nombre: 'Sellos', dir: 'HORIZONTAL', padX: 0, padY: 0, gap: 8 });
    for (var j = 0; j < items[i][1].length; j++) sello(filaSellos, items[i][1][j][0], items[i][1][j][1]);
  }
  boton(p3, 'Ver 3 cambios fáciles', true);
  texto(p3, 'Sellos calculados con el modelo de perfil de nutrientes de la OPS (2016).', { tam: 16, color: C.gris });

  // 4 · Cambios fáciles
  var p4 = pantalla('4 · Cambios fáciles', 3);
  texto(p4, '3 cambios fáciles', { negrita: true, tam: 26 });
  texto(p4, 'Más sanos y sin gastar más, en su súper.', { tam: 18 });
  var cambios = [
    ['Galletas rellenas 432 g · ₡2 000', 'Galletas de avena sin relleno 400 g · ₡1 850', '1 sello menos · ₡150 menos'],
    ['Yogur de fresa 1 L · ₡1 450', 'Yogur natural 1 L · ₡1 400', 'Sin sellos · ₡50 menos'],
    ['Salchichas de pollo 500 g · ₡1 850', 'Huevos, 10 unidades · ₡1 800', 'Sin sellos · ₡50 menos']
  ];
  for (var k = 0; k < cambios.length; k++) {
    var c = caja(p4, { nombre: 'Cambio ' + (k + 1), relleno: C.tarjeta, radio: 12, gap: 6 });
    texto(c, 'En vez de', { tam: 16, color: C.gris });
    texto(c, cambios[k][0], { tam: 17 });
    texto(c, 'Pruebe', { tam: 16, color: C.gris });
    texto(c, cambios[k][1], { negrita: true, tam: 18, color: C.verde });
    var filaChip = caja(c, { nombre: 'Beneficio', dir: 'HORIZONTAL', padX: 0, padY: 0 });
    chip(filaChip, cambios[k][2], C.verde, C.verdeClaro);
    boton(c, 'Agregar a mi lista', false, { compacto: true });
  }
  texto(p4, 'Si tiene una condición de salud o alergias, consulte en su EBAIS.', { tam: 16, color: C.gris });

  var pantallas = [p1, p2, p3, p4];
  figma.viewport.scrollAndZoomIntoView(pantallas);
  var resumen = 'Listo: ' + creados.pantallas + ' pantallas, ' + creados.textos + ' textos, ' +
    creados.botones + ' botones y ' + creados.sellos + ' sellos.';
  figma.closePlugin(resumen);
}

main().catch(function (e) {
  figma.closePlugin('Error: ' + (e && e.message ? e.message : String(e)));
});
