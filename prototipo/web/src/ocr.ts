// OCR dentro del navegador con Tesseract.js: la foto no se envía a ningún servidor.
// El motor y el idioma español se sirven desde la propia app (public/ocr, ver scripts/copiar-ocr.mjs):
// no se pide nada a un CDN y funciona sin internet (RNF-02, RNF-03).
const local = (ruta: string) => new URL(`${import.meta.env.BASE_URL}ocr/${ruta}`, location.href).href;

export type Progreso = (fraccion: number, estado: string) => void;

/** Escala a ~1600 px de ancho, pasa a gris y estira el contraste (ayuda con el papel térmico desteñido). */
export async function preprocesar(fuente: Blob | HTMLCanvasElement): Promise<HTMLCanvasElement> {
  const img = fuente instanceof HTMLCanvasElement ? fuente : await createImageBitmap(fuente);
  const escala = Math.min(2, 2000 / img.width);
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * escala);
  c.height = Math.round(img.height * escala);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  const d = ctx.getImageData(0, 0, c.width, c.height);
  let min = 255, max = 0;
  const gris = new Uint8ClampedArray(d.width * d.height);
  for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
    const g = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
    gris[j] = g; if (g < min) min = g; if (g > max) max = g;
  }
  const rango = Math.max(1, max - min);
  for (let i = 0, j = 0; i < d.data.length; i += 4, j++) {
    const v = ((gris[j] - min) / rango) * 255;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
  }
  ctx.putImageData(d, 0, 0);
  return c;
}

export async function leerTexto(fuente: Blob | HTMLCanvasElement, progreso: Progreso): Promise<string> {
  const { createWorker, PSM } = await import('tesseract.js');
  progreso(0, 'Preparando la foto');
  const lienzo = await preprocesar(fuente);
  // El lector se baja la primera vez que se usa (~5,9 MiB) y después funciona sin conexión (sw.js).
  let worker: Awaited<ReturnType<typeof createWorker>>;
  try {
    worker = await createWorker('spa', 1, {
      workerPath: local('worker.min.js'),
      corePath: local('').replace(/\/$/, ''),  // carpeta: Tesseract.js elige la variante (SIMD o no) del motor LSTM
      langPath: local('').replace(/\/$/, ''),  // busca <carpeta>/spa.traineddata.gz
      logger: (m: { status: string; progress: number }) => progreso(m.progress,
        m.status === 'recognizing text' ? 'Leyendo el tiquete' : 'Cargando el lector (la primera vez se descarga, unos 6 MB)'),
    });
  } catch (e) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new Error('el lector de fotos se descarga la primera vez que se usa (unos 6 MB) y ahora no hay conexión. Conéctese una vez; después funciona sin internet');
    }
    throw e;
  }
  // Tiquete = una columna de texto; conservar los espacios ayuda a separar descripción y precio.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN, preserve_interword_spaces: '1' });
  try {
    const { data } = await worker.recognize(lienzo);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

/** Dibuja un tiquete (texto) como imagen, para medir el OCR con tiquetes SIMULADO. */
export function dibujarTiquete(texto: string): HTMLCanvasElement {
  const lineas = texto.split('\n');
  const c = document.createElement('canvas');
  const tam = 26, alto = Math.round(tam * 1.5);
  c.width = 760; c.height = lineas.length * alto + 60;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#222'; ctx.font = `${tam}px "Courier New", monospace`;
  lineas.forEach((l, i) => ctx.fillText(l, 24, 40 + i * alto));
  return c;
}

/** Lector de código de barras del navegador (Chrome en Android). Si no existe, devuelve undefined. */
export async function leerCodigoDeBarras(foto: Blob): Promise<string | undefined> {
  const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (b: ImageBitmap) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
  if (!BD) return undefined;
  const r = await new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] }).detect(await createImageBitmap(foto));
  return r[0]?.rawValue;
}

export const hayLectorDeBarras = () => 'BarcodeDetector' in window;
