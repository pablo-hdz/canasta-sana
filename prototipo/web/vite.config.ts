import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { politicaSeguridad } from './src/seguridad';

// B-09: una sola versión. Sale de package.json y se usa en «Acerca de» (__VERSION_APP__) y en dist/sw.js.
const VERSION = (JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string }).version;

/** Al compilar, escribe precarga.json con todos los archivos generados (JS, CSS, tipografías),
 *  para que el service worker guarde la app al instalarse y abra sin conexión (RNF-03).
 *  El service worker deja fuera lo pesado (OCR y PDF): eso se guarda al primer uso.
 *  Además pone en dist/sw.js una versión con la huella de esos archivos (sus nombres ya llevan huella de su
 *  contenido): cada compilación con cambios produce un sw.js distinto, y así el navegador detecta la versión
 *  nueva y la app muestra «Hay una versión nueva». Sin esto, sw.js no cambiaba y el aviso no salía. */
function listaDePrecarga(): Plugin {
  let salida = 'dist';
  let huella = '';
  return {
    name: 'lista-precarga',
    apply: 'build',
    configResolved(c) { salida = resolve(c.root, c.build.outDir); },
    generateBundle(_, bundle) {
      const archivos = Object.keys(bundle).filter(f => !f.endsWith('.map')).sort();
      huella = createHash('sha256').update(archivos.join('\n')).digest('hex').slice(0, 10);
      this.emitFile({ type: 'asset', fileName: 'precarga.json', source: JSON.stringify(archivos) });
    },
    closeBundle() {
      const sw = resolve(salida, 'sw.js');
      const texto = readFileSync(sw, 'utf8');
      const dev = `'canasta-sana-v${VERSION}-dev'`;
      if (!texto.includes(dev)) throw new Error(`sw.js: no se encontró la versión ${dev} (debe coincidir con package.json)`);
      writeFileSync(sw, texto.replace(dev, `'canasta-sana-v${VERSION}-${huella}'`));
    },
  };
}

/** Solo en producción: política de seguridad (CSP) y sin referente en los enlaces externos.
 *  En desarrollo no se pone, porque la recarga en caliente de Vite usa scripts en línea. */
function seguridad(api?: string): Plugin {
  return {
    name: 'seguridad',
    apply: 'build',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: politicaSeguridad(api) }, injectTo: 'head-prepend' },
      { tag: 'meta', attrs: { name: 'referrer', content: 'no-referrer' }, injectTo: 'head-prepend' },
    ],
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    plugins: [react(), listaDePrecarga(), seguridad(env.VITE_API_URL || undefined)],
    define: { __VERSION_APP__: JSON.stringify(VERSION) },
    server: { port: 5173, strictPort: true },
    test: { environment: 'node', include: ['src/**/*.test.{ts,tsx}'] },
  };
});
