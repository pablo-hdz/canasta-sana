// Política de seguridad de contenido (CSP) de la versión de producción (vite.config.ts la pone en index.html).
// Garantiza en el navegador lo que promete la app: ninguna petición sale a terceros. Solo se permite la propia app
// y, si existe, el servicio opcional de precios (D-17). Si algún código intentara pedir algo a otro sitio
// (por ejemplo, la dirección de CDN que Tesseract.js trae por defecto), el navegador lo bloquea.
export function politicaSeguridad(api?: string): string {
  const servicio = api ? ` ${new URL(api).origin}` : '';
  return [
    "default-src 'self'",
    // 'wasm-unsafe-eval': el OCR es WebAssembly; blob: el trabajador de Tesseract.js se crea desde un blob.
    "script-src 'self' 'wasm-unsafe-eval' blob:",
    "worker-src 'self' blob:",
    `connect-src 'self' blob: data:${servicio}`,
    "img-src 'self' data: blob:",
    // React escribe estilos en atributos (style={…}).
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "media-src 'self' blob: mediastream:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'none'",
  ].join('; ');
}
