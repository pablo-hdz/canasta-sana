// B-09 (sprint 1): una sola versión. Sale de package.json y se ve igual en «Acerca de», en sw.js y en los README.
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VERSION_APP } from './version';
import { Ajustes } from './pantallas/Ajustes';
import { PERFIL_VACIO } from './dominio/cambios';
import { PREFERENCIAS_INICIALES } from './almacen';

const leer = (ruta: string) => readFileSync(new URL(ruta, import.meta.url), 'utf8');
const { version } = JSON.parse(leer('../package.json')) as { version: string };
const nada = () => undefined;

describe('Una sola versión (B-09)', () => {
  it('la app usa la de package.json', () => {
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(VERSION_APP).toBe(version);
  });
  it('«Acerca de» la muestra', () => {
    const h = renderToStaticMarkup(<Ajustes perfil={PERFIL_VACIO} onPerfil={nada} prefs={PREFERENCIAS_INICIALES} onPrefs={nada} hayServicio={false}
      comunidad={null} estadoComunidad="" onActualizar={nada} datos={{ precios: 0, alias: 0, compras: 0, lista: 0 }} onBorrar={nada} onRestaurado={nada} base={{ productos: 1 }} />);
    expect(h).toContain(`Canasta sana v${version} (prototipo)`);
  });
  it('sw.js lleva la misma (la compilación le agrega la huella)', () => {
    expect(leer('../public/sw.js')).toContain(`const VERSION = 'canasta-sana-v${version}-dev'`);
  });
  it('los README la dicen', () => {
    expect(leer('../../README.md').split('\n')[0]).toContain(`v${version}`);
    expect(leer('../../../README.md')).toContain(`prototipo v${version}`);
  });
});
