import { describe, expect, it } from 'vitest';
import { politicaSeguridad } from './seguridad';

const directiva = (csp: string, nombre: string) => csp.split('; ').find(d => d.startsWith(nombre + ' ')) ?? '';

describe('Política de seguridad (CSP) de producción', () => {
  it('sin servicio: solo la propia app; ningún tercero, sin eval', () => {
    const csp = politicaSeguridad();
    expect(directiva(csp, 'default-src')).toBe("default-src 'self'");
    expect(directiva(csp, 'connect-src')).toBe("connect-src 'self' blob: data:");
    expect(csp).not.toMatch(/https?:\/\//);          // ningún dominio externo (ni el CDN por defecto de Tesseract)
    expect(csp).not.toContain("'unsafe-eval'");      // solo 'wasm-unsafe-eval' para el OCR
    expect(directiva(csp, 'object-src')).toBe("object-src 'none'");
  });
  it('con el servicio opcional: se agrega solo su origen, sin ruta', () => {
    expect(directiva(politicaSeguridad('http://localhost:8000/'), 'connect-src')).toBe("connect-src 'self' blob: data: http://localhost:8000");
    expect(directiva(politicaSeguridad('https://precios.ejemplo.cr/api'), 'connect-src')).toBe("connect-src 'self' blob: data: https://precios.ejemplo.cr");
  });
});
