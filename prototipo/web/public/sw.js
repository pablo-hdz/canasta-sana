// Service worker de Canasta sana: guarda la app y la base de productos para usarlas sin internet.
// Solo atiende peticiones al mismo origen; nunca guarda fotos, facturas ni datos de la persona.
//
// v0.3: lo pesado se baja al primer uso (datos prepago). Al instalar solo se guardan la app y la base (~1 MiB).
// El lector de fotos (OCR, ~5,9 MiB por teléfono: un solo motor) y el de PDF (~1,6 MiB) se guardan la primera vez
// que se usan y desde ahí funcionan sin conexión. Antes, al instalar se bajaban 12,2 MiB (medido el 2026-11-14).
// La compilación (vite.config.ts) reemplaza «dev» por una huella de los archivos generados: si cambia cualquier
// archivo de la app, cambia este archivo y el navegador detecta la versión nueva (y la app avisa).
const VERSION = 'canasta-sana-v0.3.0-dev';   // la versión debe ser la de package.json (lo comprueba version.test.ts)
// Caché de lo que se baja al primer uso. No cambia con cada versión de la app (son archivos grandes y fijos):
// cambiar su nombre solo si cambian las versiones de Tesseract.js o de pdf.js.
const BAJO_DEMANDA = 'canasta-sana-bajo-demanda-v1';
const BASE = self.registration.scope;
const PRECARGA = [
  '', 'manifest.webmanifest', 'icono.svg', 'icono-192.png', 'icono-512.png', 'icono-maskable-192.png', 'icono-maskable-512.png',
  'datos/productos_cr.json',
].map(p => new URL(p, BASE).href);

/** ¿Se baja solo al primer uso? El OCR (carpeta ocr/) y los archivos del lector de PDF. */
const esBajoDemanda = url => url.pathname.includes('/ocr/') || /\/assets\/pdf[.-]/.test(url.pathname);

// precarga.json lo genera la compilación (vite.config.ts) con todos los archivos con huella.
async function listaCompleta() {
  try {
    const r = await fetch(new URL('precarga.json', BASE).href, { cache: 'no-store' });
    const generados = r.ok ? await r.json() : [];
    const urls = generados.filter(f => f !== 'index.html').map(f => new URL(f, BASE));
    return [...new Set([...PRECARGA, ...urls.filter(u => !esBajoDemanda(u)).map(u => u.href)])];
  } catch { return PRECARGA; }
}

// Sin skipWaiting automático: si hay una versión nueva, la app avisa y la persona decide cuándo actualizar.
self.addEventListener('install', e => {
  e.waitUntil(listaCompleta().then(lista => caches.open(VERSION).then(c => c.addAll(lista))));
});

self.addEventListener('message', e => {
  if (e.data && e.data.tipo === 'activar') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== BAJO_DEMANDA).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function guardar(peticion, respuesta, cache = VERSION) {
  if (respuesta && respuesta.ok) {
    const copia = respuesta.clone();
    caches.open(cache).then(c => c.put(peticion, copia));
  }
  return respuesta;
}

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  // Página: red primero (versión nueva), y si no hay conexión, la guardada.
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => guardar(new URL('', BASE).href, r)).catch(() => caches.match(new URL('', BASE).href)));
    return;
  }
  // Base de productos: la guardada al instante y se actualiza en segundo plano.
  if (url.pathname.includes('/datos/')) {
    e.respondWith(caches.match(e.request).then(hit => {
      const red = fetch(e.request).then(r => guardar(e.request, r)).catch(() => hit);
      return hit || red;
    }));
    return;
  }
  // OCR y PDF: caché primero; la primera vez se bajan y se guardan para usarlos sin conexión.
  if (esBajoDemanda(url)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => guardar(e.request, r, BAJO_DEMANDA))));
    return;
  }
  // Resto (archivos con huella, tipografía): caché primero.
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => guardar(e.request, r))));
});
