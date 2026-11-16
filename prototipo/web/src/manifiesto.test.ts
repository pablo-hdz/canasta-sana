// Instalación en Android: el manifiesto declara íconos PNG de 192 y 512 px (y versiones «maskable»),
// los archivos existen con ese tamaño real y el service worker los guarda para usarlos sin conexión.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const publico = (f: string) => new URL(`../public/${f}`, import.meta.url);
const manifiesto = JSON.parse(readFileSync(publico('manifest.webmanifest'), 'utf8')) as { icons: { src: string; sizes: string; type: string; purpose?: string }[] };
const sw = readFileSync(publico('sw.js'), 'utf8');

/** Ancho y alto desde la cabecera IHDR del PNG. */
function tamanoPng(ruta: URL): [number, number] {
  const b = readFileSync(ruta);
  expect(b.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(b.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('Íconos para instalar la app', () => {
  const pngs = manifiesto.icons.filter(i => i.type === 'image/png');
  it('hay PNG de 192 y 512 px para «any» y para «maskable»', () => {
    for (const proposito of ['any', 'maskable']) {
      expect(pngs.filter(i => (i.purpose ?? 'any') === proposito).map(i => i.sizes).sort()).toEqual(['192x192', '512x512']);
    }
  });
  it('cada PNG existe y mide lo que dice el manifiesto', () => {
    for (const i of pngs) {
      const [w, h] = tamanoPng(publico(i.src.replace(/^\//, '')));
      expect(`${w}x${h}`).toBe(i.sizes);
    }
  });
  it('el service worker guarda los íconos', () => {
    for (const i of pngs) expect(sw).toContain(`'${i.src.replace(/^\//, '')}'`);
  });
});
