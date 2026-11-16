// Copia a public/ocr el motor de Tesseract.js y el idioma español, para que el OCR funcione
// sin internet y sin pedir nada a un CDN (RNF-02, RNF-03). Se ejecuta antes de dev y build.
import { copyFileSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const destino = join(raiz, 'public', 'ocr');
mkdirSync(destino, { recursive: true });
const archivos = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'tesseract-core-lstm.wasm.js'],
  ['node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz', 'spa.traineddata.gz'],
];
let total = 0;
for (const [origen, nombre] of archivos) {
  copyFileSync(join(raiz, origen), join(destino, nombre));
  total += statSync(join(destino, nombre)).size;
}
console.log(`OCR local: ${archivos.length} archivos en public/ocr (${(total / 1048576).toFixed(1)} MiB)`);
