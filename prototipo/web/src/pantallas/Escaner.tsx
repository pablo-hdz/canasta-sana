// Escáner de código de barras en vivo (RF-03): la cámara con getUserMedia y el lector BarcodeDetector
// del navegador (Chrome en Android). Cada cuadro se analiza en el teléfono: la imagen no se guarda ni se envía.
// Si el navegador no tiene alguno de los dos, la app sigue con la foto del código o con escribirlo.
import { useEffect, useRef, useState } from 'react';
import { codigoDeLectura, confirmadorDeLecturas } from '../dominio/codigos';

type Lector = { detect: (fuente: HTMLVideoElement) => Promise<{ rawValue: string; format?: string }[]> };
type ClaseLector = (new (o: { formats: string[] }) => Lector) & { getSupportedFormats?: () => Promise<string[]> };
const FORMATOS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];
const PAUSA_MS = 200;   // entre cuadros: ≈ 5 lecturas por segundo, sin gastar mucha batería

const claseLector = () => (typeof window === 'undefined' ? undefined : (window as unknown as { BarcodeDetector?: ClaseLector }).BarcodeDetector);

/** ¿Se puede escanear en vivo? Hace falta BarcodeDetector y la cámara (getUserMedia: solo con HTTPS o localhost). */
export const hayEscanerVivo = () => !!claseLector() && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

/** Mensaje para la persona cuando la cámara no se puede usar (nombres de error del estándar). */
export function mensajeCamara(e: unknown): string {
  const nombre = (e as { name?: string })?.name ?? '';
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'No se dio permiso para usar la cámara. Puede tomar una foto del código o escribirlo abajo.';
  if (nombre === 'NotFoundError' || nombre === 'OverconstrainedError') return 'No se encontró una cámara. Puede escribir el código abajo.';
  if (nombre === 'NotReadableError' || nombre === 'AbortError') return 'La cámara está ocupada por otra app. Ciérrela e intente de nuevo, o escriba el código abajo.';
  if (nombre === 'SinFormatos') return 'Este navegador no lee códigos de barras de productos. Puede escribir el código abajo.';
  return `No se pudo abrir la cámara (${(e as Error)?.message ?? 'error desconocido'}). Puede escribir el código abajo.`;
}

// Un solo escáner abierto a la vez: al abrir otro, el anterior se cierra y apaga su cámara.
let cerrarAnterior: (() => void) | undefined;

export function EscanerCodigo({ nombre, onCodigo, onCerrar }: { nombre: string; onCodigo: (codigo: string) => void; onCerrar: (aviso?: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const caja = useRef<HTMLDivElement>(null);
  const [buscando, setBuscando] = useState(false);
  // Las funciones más recientes (la app puede volver a dibujarse mientras la cámara está abierta).
  const avisar = useRef({ onCodigo, onCerrar });
  avisar.current = { onCodigo, onCerrar };

  useEffect(() => {
    let vivo = true;
    let espera = 0;
    let flujo: MediaStream | undefined;
    const apagar = () => flujo?.getTracks().forEach(t => t.stop());
    const cerrarme = () => avisar.current.onCerrar();
    cerrarAnterior?.();
    cerrarAnterior = cerrarme;
    cancelar.current?.focus({ preventScroll: true });
    caja.current?.scrollIntoView?.({ block: 'nearest' });
    const confirmar = confirmadorDeLecturas(2);

    (async () => {
      try {
        const Lector = claseLector();
        if (!Lector) throw Object.assign(new Error('sin lector'), { name: 'SinFormatos' });
        const soportados = Lector.getSupportedFormats ? await Lector.getSupportedFormats() : FORMATOS;
        const formatos = FORMATOS.filter(f => soportados.includes(f));
        if (!formatos.length) throw Object.assign(new Error('sin formatos'), { name: 'SinFormatos' });
        flujo = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!vivo) { apagar(); return; }
        const v = video.current!;
        v.srcObject = flujo;
        await v.play();
        const lector = new Lector({ formats: formatos });
        setBuscando(true);
        const cuadro = async () => {
          if (!vivo) return;
          try {
            if (v.readyState >= 2) {
              const leidos = await lector.detect(v);
              const c = confirmar(leidos.map(x => codigoDeLectura(x.rawValue, x.format)));
              if (c && vivo) {
                vivo = false;
                apagar();
                avisar.current.onCodigo(c);
                return;
              }
            }
          } catch { /* un cuadro que falla no detiene el escáner */ }
          espera = window.setTimeout(cuadro, PAUSA_MS);
        };
        void cuadro();
      } catch (e) {
        apagar();
        if (vivo) avisar.current.onCerrar(mensajeCamara(e));
      }
    })();

    return () => {
      vivo = false;
      clearTimeout(espera);
      apagar();
      if (cerrarAnterior === cerrarme) cerrarAnterior = undefined;
    };
  }, []);

  return (
    <div className="escaner" ref={caja} role="group" aria-label={`Escáner del código de barras de ${nombre}`}>
      <div className="visor">
        <video ref={video} muted playsInline aria-hidden="true" />
        <span className="guia" aria-hidden="true" />
      </div>
      <p className="nota" role="status">{buscando ? 'Apunte la cámara al código de barras del empaque. Se lee solo.' : 'Abriendo la cámara…'}</p>
      <button type="button" ref={cancelar} className="boton secundario" onClick={() => avisar.current.onCerrar()}>Cancelar</button>
      <p className="nota">La imagen se analiza en su teléfono: no se guarda ni se envía.</p>
    </div>
  );
}
