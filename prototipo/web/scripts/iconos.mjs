// Genera los íconos PNG de la app (Android pide 192 y 512 px para instalarla) a partir de public/icono.svg.
// Sin dependencias ni programas externos: lee el SVG, lo dibuja con suavizado (4 × 4 muestras por píxel)
// y escribe el PNG con zlib de Node. Uso: npm run iconos
// Solo entiende lo que usa icono.svg: un <rect> con esquinas redondeadas y <path> con trazo de uniones y
// extremos redondeados (comandos M L H V Z). Si el SVG cambia y usa otra cosa, se detiene con un error claro.
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const svg = readFileSync(join(raiz, 'public', 'icono.svg'), 'utf8');
const MUESTRAS = 4;                 // por lado: 16 muestras por píxel
const ZONA_SEGURA = 0.4;            // ícono «maskable»: lo importante dentro de un círculo de radio 40 % (W3C)

const atributos = (etiqueta) => Object.fromEntries([...etiqueta.matchAll(/([\w-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const falla = (m) => { console.error(`iconos: ${m}`); process.exit(1); };
const color = (hex) => {
  const h = hex.toLowerCase() === '#fff' ? '#ffffff' : hex;
  if (!/^#[0-9a-f]{6}$/i.test(h)) falla(`color no admitido: ${hex}`);
  return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
};

const vista = (atributos(svg.match(/<svg\b[^>]*>/)[0]).viewBox ?? '').split(/\s+/).map(Number);
if (vista.length !== 4 || vista[0] !== 0 || vista[1] !== 0 || vista[2] !== vista[3]) falla('el viewBox debe ser cuadrado y empezar en 0 0');
const LADO = vista[2];

/** Recorre el atributo d: devuelve subtrayectos [{ puntos, cerrado }]. */
function trayectos(d) {
  const fichas = d.match(/[MLHVZmlhvz]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const out = [];
  let x = 0, y = 0, cmd = '', actual = null, i = 0;
  const num = () => { const v = Number(fichas[i++]); if (!Number.isFinite(v)) falla(`número esperado en «${d}»`); return v; };
  while (i < fichas.length) {
    if (/[A-Za-z]/.test(fichas[i])) cmd = fichas[i++];
    else if (!cmd) falla(`trayecto sin comando: «${d}»`);
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case 'M': { const a = num(), b = num(); x = rel ? x + a : a; y = rel ? y + b : b; actual = { puntos: [[x, y]], cerrado: false }; out.push(actual); cmd = rel ? 'l' : 'L'; break; }
      case 'L': { const a = num(), b = num(); x = rel ? x + a : a; y = rel ? y + b : b; actual.puntos.push([x, y]); break; }
      case 'H': { const a = num(); x = rel ? x + a : a; actual.puntos.push([x, y]); break; }
      case 'V': { const b = num(); y = rel ? y + b : b; actual.puntos.push([x, y]); break; }
      case 'Z': { actual.cerrado = true; [x, y] = actual.puntos[0]; cmd = ''; break; }
      default: falla(`comando «${cmd}» no admitido`);
    }
  }
  return out;
}

// Figuras en orden de pintado.
const figuras = [];
for (const [etiqueta] of svg.matchAll(/<(rect|path)\b[^>]*>/g)) {
  const a = atributos(etiqueta);
  if (etiqueta.startsWith('<rect')) {
    const [x, y, w, h, rx] = [a.x ?? 0, a.y ?? 0, a.width, a.height, a.rx ?? 0].map(Number);
    figuras.push({ tipo: 'rect', x, y, w, h, rx, color: color(a.fill ?? '#000000') });
    continue;
  }
  const subs = trayectos(a.d);
  const ancho = Number(a['stroke-width'] ?? 1);
  const union = a['stroke-linejoin'] ?? 'miter';
  const extremo = a['stroke-linecap'] ?? 'butt';
  for (const s of subs) {
    if (s.puntos.length >= 3 && !s.cerrado && (a.fill ?? '#000') !== 'none') falla('relleno de trayectos no admitido');
    if (s.cerrado && (a.fill ?? '#000') !== 'none') falla('relleno de trayectos no admitido');
    if (s.puntos.length + (s.cerrado ? 1 : 0) > 2 && union !== 'round') falla(`unión «${union}» no admitida (use stroke-linejoin="round")`);
  }
  if (!a.stroke) falla('trayecto sin trazo');
  const segmentos = [];
  for (const s of subs) {
    const p = s.cerrado ? [...s.puntos, s.puntos[0]] : s.puntos;
    for (let k = 0; k + 1 < p.length; k++) {
      // Extremos rectos («butt») solo en los dos extremos de un trayecto abierto; las uniones son redondas.
      const inicioRecto = !s.cerrado && k === 0 && extremo !== 'round';
      const finRecto = !s.cerrado && k === p.length - 2 && extremo !== 'round';
      segmentos.push({ a: p[k], b: p[k + 1], inicioRecto, finRecto });
    }
  }
  figuras.push({ tipo: 'trazo', segmentos, r: ancho / 2, color: color(a.stroke) });
}

function cubre(f, x, y) {
  if (f.tipo === 'rect') {
    const cx = Math.min(Math.max(x, f.x + f.rx), f.x + f.w - f.rx), cy = Math.min(Math.max(y, f.y + f.rx), f.y + f.h - f.rx);
    return x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h && (x - cx) ** 2 + (y - cy) ** 2 <= f.rx ** 2;
  }
  for (const s of f.segmentos) {
    const [ax, ay] = s.a, [bx, by] = s.b;
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    let t = l2 ? ((x - ax) * dx + (y - ay) * dy) / l2 : 0;
    if ((t < 0 && s.inicioRecto) || (t > 1 && s.finRecto)) continue;
    t = Math.max(0, Math.min(1, t));
    if ((x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2 <= f.r * f.r) return true;
  }
  return false;
}

/** Dibuja a `tam` px. `lleno`: fondo a sangre (sin esquinas transparentes), para el ícono «maskable». */
function dibujar(tam, lleno) {
  const px = Buffer.alloc(tam * tam * 4);
  const esc = LADO / tam;
  const lista = lleno ? figuras.map(f => (f.tipo === 'rect' ? { ...f, x: 0, y: 0, w: LADO, h: LADO, rx: 0 } : f)) : figuras;
  for (let j = 0; j < tam; j++) for (let i = 0; i < tam; i++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let sj = 0; sj < MUESTRAS; sj++) for (let si = 0; si < MUESTRAS; si++) {
      const x = (i + (si + 0.5) / MUESTRAS) * esc, y = (j + (sj + 0.5) / MUESTRAS) * esc;
      for (let k = lista.length - 1; k >= 0; k--) {
        if (cubre(lista[k], x, y)) { const c = lista[k].color; r += c[0]; g += c[1]; b += c[2]; a++; break; }
      }
    }
    const o = (j * tam + i) * 4;
    if (a) { px[o] = Math.round(r / a); px[o + 1] = Math.round(g / a); px[o + 2] = Math.round(b / a); }
    px[o + 3] = Math.round((a / (MUESTRAS * MUESTRAS)) * 255);
  }
  return px;
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc32 = (buf) => { let c = 0xffffffff; for (const x of buf) c = TABLA_CRC[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function bloque(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}
function png(tam, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tam, 0); ihdr.writeUInt32BE(tam, 4); ihdr[8] = 8; ihdr[9] = 6;   // 8 bits, RGBA
  const filas = Buffer.alloc(tam * (tam * 4 + 1));
  for (let j = 0; j < tam; j++) px.copy(filas, j * (tam * 4 + 1) + 1, j * tam * 4, (j + 1) * tam * 4);   // filtro 0
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), bloque('IHDR', ihdr), bloque('IDAT', deflateSync(filas, { level: 9 })), bloque('IEND', Buffer.alloc(0))]);
}

// Zona segura del ícono «maskable»: el trazo más lejano del centro debe quedar dentro del 40 %.
const centro = LADO / 2;
const lejos = Math.max(...figuras.filter(f => f.tipo === 'trazo').flatMap(f => f.segmentos.flatMap(s => [s.a, s.b]).map(([x, y]) => Math.hypot(x - centro, y - centro) + f.r)));
if (lejos > ZONA_SEGURA * LADO) falla(`el dibujo sale de la zona segura del ícono maskable (${lejos.toFixed(1)} > ${ZONA_SEGURA * LADO})`);

const salidas = [['icono-192.png', 192, false], ['icono-512.png', 512, false], ['icono-maskable-192.png', 192, true], ['icono-maskable-512.png', 512, true]];
for (const [nombre, tam, lleno] of salidas) {
  const px = dibujar(tam, lleno);
  const ruta = join(raiz, 'public', nombre);
  writeFileSync(ruta, png(tam, px));
  const muestra = (x, y) => { const o = (y * tam + x) * 4; return `#${[px[o], px[o + 1], px[o + 2]].map(v => v.toString(16).padStart(2, '0')).join('')}/${px[o + 3]}`; };
  console.log(`${nombre}: ${tam}×${tam} px, ${statSync(ruta).size} bytes · esquina ${muestra(0, 0)} · fondo ${muestra(Math.round(tam * 0.1), Math.round(tam / 2))} · trazo ${muestra(Math.round(tam * 30 / 64), Math.round(tam * 26 / 64))}`);
}
console.log(`Zona segura (maskable): el dibujo llega a ${(lejos / LADO * 100).toFixed(1)} % del lado desde el centro (máximo ${ZONA_SEGURA * 100} %).`);
