// Aviso de versión nueva: el service worker espera (no se activa solo) y la persona decide cuándo actualizar.
import { useEffect, useState } from 'react';

export const EVENTO_VERSION = 'canasta:version-nueva';

export function AvisoVersion() {
  const [registro, setRegistro] = useState<ServiceWorkerRegistration | null>(null);
  useEffect(() => {
    const avisar = (e: Event) => setRegistro((e as CustomEvent<ServiceWorkerRegistration>).detail);
    window.addEventListener(EVENTO_VERSION, avisar);
    return () => window.removeEventListener(EVENTO_VERSION, avisar);
  }, []);
  if (!registro?.waiting) return null;

  function actualizar() {
    let recargada = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!recargada) { recargada = true; window.location.reload(); }
    });
    registro?.waiting?.postMessage({ tipo: 'activar' });
  }

  return (
    <div className="aviso-version" role="status">
      <span>Hay una versión nueva de Canasta sana.</span>
      <div className="acciones">
        <button type="button" className="boton primario" onClick={actualizar}>Actualizar</button>
        <button type="button" className="enlace" onClick={() => setRegistro(null)}>Después</button>
      </div>
    </div>
  );
}

/** Registra el service worker y avisa (evento) cuando hay una versión nueva esperando. Revisa cada hora. */
export function registrarServiceWorker(url: string) {
  navigator.serviceWorker.register(url).then(reg => {
    const avisar = () => window.dispatchEvent(new CustomEvent(EVENTO_VERSION, { detail: reg }));
    if (reg.waiting && navigator.serviceWorker.controller) avisar();
    reg.addEventListener('updatefound', () => {
      const nuevo = reg.installing;
      nuevo?.addEventListener('statechange', () => {
        // «installed» con un controlador activo = hay una versión anterior en uso: es una actualización.
        if (nuevo.state === 'installed' && navigator.serviceWorker.controller) avisar();
      });
    });
    setInterval(() => { void reg.update(); }, 60 * 60 * 1000);
  }).catch(e => console.warn('Sin modo sin conexión:', e));
}
