// Ejecuta code.js del plugin con una API de Figma simulada que valida los errores típicos.
// Uso: node probar_plugin_figma.js <ruta a code.js>
'use strict';
const fs = require('fs');
const vm = require('vm');

const ruta = process.argv[2];
const codigo = fs.readFileSync(ruta, 'utf8');
const fuentesCargadas = new Set();
const errores = [];
const todos = [];
let mensajeFinal = null;

const ENUM = {
  layoutMode: ['NONE', 'HORIZONTAL', 'VERTICAL'],
  primaryAxisSizingMode: ['FIXED', 'AUTO'],
  counterAxisSizingMode: ['FIXED', 'AUTO'],
  counterAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'BASELINE'],
  primaryAxisAlignItems: ['MIN', 'MAX', 'CENTER', 'SPACE_BETWEEN'],
  textAutoResize: ['NONE', 'WIDTH_AND_HEIGHT', 'HEIGHT', 'TRUNCATE'],
  textAlignHorizontal: ['LEFT', 'CENTER', 'RIGHT', 'JUSTIFIED'],
  textAlignVertical: ['TOP', 'CENTER', 'BOTTOM'],
  layoutSizingHorizontal: ['FIXED', 'HUG', 'FILL'],
};
const esAuto = (n) => n && (n.layoutMode === 'HORIZONTAL' || n.layoutMode === 'VERTICAL');

function nodo(tipo) {
  const datos = { type: tipo, children: [], parent: null, layoutMode: 'NONE', width: 100, height: 100 };
  const n = new Proxy(datos, {
    set(obj, prop, valor) {
      if (ENUM[prop] && !ENUM[prop].includes(valor)) throw new Error(`${tipo}.${prop}: valor inválido ${valor}`);
      if (tipo === 'TEXT' && ['characters', 'fontSize', 'textAutoResize', 'textAlignHorizontal'].includes(prop)) {
        const f = obj.fontName;
        if (!f || !fuentesCargadas.has(f.family + '|' + f.style)) throw new Error(`TEXT.${prop}: fuente no cargada`);
      }
      if (prop === 'fontName' && !fuentesCargadas.has(valor.family + '|' + valor.style)) throw new Error('fontName: fuente no cargada ' + JSON.stringify(valor));
      if (prop === 'layoutSizingHorizontal' && valor === 'FILL' && !esAuto(obj.parent)) throw new Error(`${tipo}.layoutSizingHorizontal=FILL sin padre con auto layout`);
      if (['primaryAxisSizingMode', 'counterAxisSizingMode', 'itemSpacing', 'minHeight'].includes(prop) && !esAuto(obj)) throw new Error(`${tipo}.${prop} requiere auto layout`);
      if ((prop === 'fills' || prop === 'strokes') && Array.isArray(valor)) {
        for (const p of valor) {
          if (p.type !== 'SOLID') throw new Error('pintura no SOLID');
          for (const k of ['r', 'g', 'b']) if (!(p.color[k] >= 0 && p.color[k] <= 1)) throw new Error('color fuera de rango');
        }
      }
      if (prop === 'vectorPaths') {
        for (const v of valor) if (!/^(M|L|Z|\s|-?\d+(\.\d+)?)+$/.test(v.data)) throw new Error('vectorPaths: datos inválidos');
      }
      obj[prop] = valor;
      return true;
    },
  });
  datos.appendChild = (h) => { if (h.parent) h.parent.children.splice(h.parent.children.indexOf(h), 1); h.parent = n; datos.children.push(h); };
  datos.resize = (w, hh) => { if (!(w > 0 && hh > 0)) throw new Error('resize inválido'); datos.width = w; datos.height = hh; };
  todos.push(n);
  return n;
}

const pagina = nodo('PAGE');
const figma = {
  currentPage: pagina,
  createFrame: () => nodo('FRAME'),
  createText: () => nodo('TEXT'),
  createVector: () => nodo('VECTOR'),
  loadFontAsync: async (f) => { fuentesCargadas.add(f.family + '|' + f.style); },
  viewport: { scrollAndZoomIntoView: (ns) => { if (!Array.isArray(ns) || ns.length === 0) throw new Error('viewport vacío'); } },
  notify: () => {},
  closePlugin: (m) => { mensajeFinal = m === undefined ? '' : m; },
};

vm.runInNewContext(codigo, { figma, console, parseInt, String });

setTimeout(() => {
  const textos = todos.filter((n) => n.type === 'TEXT');
  const pantallas = pagina.children.filter((n) => n.type === 'FRAME');
  const dentroDeSello = (t) => { let p = t.parent; while (p) { if (p.name && p.name.startsWith('Sello')) return true; p = p.parent; } return false; };
  const pequenos = textos.filter((t) => !dentroDeSello(t) && t.fontSize < 16).map((t) => `${t.fontSize}px "${t.characters.slice(0, 30)}"`);
  const botones = todos.filter((n) => n.name && n.name.startsWith('Botón'));
  // Alto mínimo del botón = padding arriba + abajo + alto de línea aprox. 1,2 x tamaño
  const bajos = botones.filter((b) => b.paddingTop + b.paddingBottom + 1.2 * b.children[0].fontSize < 48).map((b) => b.name);
  const sinSimulado = pantallas.filter((p) => !JSON.stringify(p.children.map((c) => c.children.map((x) => x.characters || (x.children[0] && x.children[0].characters)))).includes('SIMULADO')).map((p) => p.name);
  console.log('Mensaje del plugin:', mensajeFinal);
  console.log('Pantallas en la página:', pantallas.map((p) => `${p.name} (${p.width} px)`).join(' | '));
  console.log('Textos:', textos.length, '| Textos < 16 px fuera de sellos:', pequenos.length ? pequenos : 'ninguno');
  console.log('Botones:', botones.length, '| Botones < 48 px de alto:', bajos.length ? bajos : 'ninguno');
  console.log('Pantallas sin la marca SIMULADO:', sinSimulado.length ? sinSimulado : 'ninguna');
  const ok = mensajeFinal && mensajeFinal.startsWith('Listo') && !pequenos.length && !bajos.length && !sinSimulado.length && pantallas.length === 4;
  console.log(ok ? 'RESULTADO: OK' : 'RESULTADO: FALLA');
  process.exit(ok ? 0 : 1);
}, 50);
