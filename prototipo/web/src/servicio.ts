// Cliente del servicio opcional (api/, D-17). Si VITE_API_URL no está definida, la app no hace ninguna
// petición fuera de su propio origen y estas funciones no se usan.
import type { AporteApi, ReporteApi, TablaComunidad } from './dominio/comunidad';

export const API = String(import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const hayServicio = API !== '';
const ESPERA_MS = 8000;

async function pedir(ruta: string, init: RequestInit = {}): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    // Sin cookies ni referente: el servicio no necesita saber nada de quién pregunta.
    return await fetch(`${API}${ruta}`, { ...init, signal: control.signal, credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store' });
  } catch {
    throw new Error(control.signal.aborted ? 'el servicio no respondió a tiempo' : 'sin conexión con el servicio');
  } finally {
    clearTimeout(reloj);
  }
}

/** Descarga la tabla completa (nunca pregunta por productos sueltos). Con ETag, 304 = sin cambios. */
export async function descargarTabla(etag?: string): Promise<{ tabla?: TablaComunidad; etag?: string }> {
  const r = await pedir('/precios/tabla', { headers: etag ? { 'If-None-Match': etag } : {} });
  if (r.status === 304) return { etag };
  if (!r.ok) throw new Error(`el servicio respondió ${r.status}`);
  return { tabla: (await r.json()) as TablaComunidad, etag: r.headers.get('ETag') ?? undefined };
}

export async function enviarAportes(aportes: AporteApi[]): Promise<number> {
  const r = await pedir('/precios', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aportes }) });
  if (r.status === 429) throw new Error('ya se enviaron muchos precios en la última hora');
  if (!r.ok) throw new Error(`el servicio respondió ${r.status}`);
  return ((await r.json()) as { recibidos: number }).recibidos;
}

/** Aviso de un dato dudoso de la base pública (solo código y opciones cerradas). */
export async function enviarReporte(r: ReporteApi): Promise<void> {
  const resp = await pedir('/reportes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r) });
  if (resp.status === 429) throw new Error('ya se enviaron muchos avisos en la última hora');
  if (!resp.ok) throw new Error(`el servicio respondió ${resp.status}`);
}
