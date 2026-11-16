// Consentimiento por compra (RNF-02, RF-10, RF-16): antes de enviar, la persona ve exactamente qué se enviaría
// y decide con un toque. Nada se envía sin «Aportar».
import { NOTA_FECHA_APORTE, ROTULOS_APORTE as R, type AporteApi } from '../dominio/comunidad';
import { Boton, Tarjeta, colones } from '../componentes';

export type EstadoAporte = 'oferta' | 'enviando' | 'hecho' | 'rechazado' | { error: string };

interface Props {
  envio: AporteApi[];
  nombres: Record<string, string>;   // código → nombre, solo para mostrar (el nombre no se envía)
  estado: EstadoAporte;
  onAportar: () => void;
  onRechazar: () => void;
}

export function OfertaAporte({ envio, nombres, estado, onAportar, onRechazar }: Props) {
  if (estado === 'rechazado' || envio.length === 0) return null;
  if (estado === 'hecho') return <p className="nota" role="status">Gracias: aportó {envio.length} {envio.length === 1 ? 'precio' : 'precios'} a la comunidad, sin su nombre.</p>;
  const { cadena, canton, fecha } = envio[0];
  return (
    <Tarjeta variante="borde">
      <strong style={{ fontSize: '1.25rem' }}>¿Aportar los precios de esta compra?</strong>
      <p>Ayuda a que otras personas vean precios reales. Se enviarían estos {envio.length} {envio.length === 1 ? 'precio' : 'precios'}, sin su nombre:</p>
      <table className="tabla" aria-label="Lo que se enviaría">
        <thead><tr><th>Producto (se envía solo el {R.ean})</th><th>{R.precio[0].toUpperCase() + R.precio.slice(1)}</th></tr></thead>
        <tbody>
          {envio.map(a => (
            <tr key={a.ean}><td>{nombres[a.ean] ?? 'Producto'}<span className="nota" style={{ display: 'block' }}>{a.ean}</span></td><td>{colones(a.precio)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="nota">
        {/* B-31: dice exactamente lo que sale. La fecha va exacta; el servicio la reduce a la semana al guardarla. */}
        Además: {R.cadena} {cadena}{canton ? `, ${R.canton} ${canton}` : ''}{fecha ? ` y la ${R.fecha}, ${fecha.split('-').reverse().join('/')} (${NOTA_FECHA_APORTE})` : ''}.
        Nunca su nombre, su tiquete completo, su hogar ni los demás productos.
      </p>
      {typeof estado === 'object' && <p className="nota" role="status">No se pudieron aportar: {estado.error}. Puede intentarlo de nuevo.</p>}
      <Boton onClick={onAportar} disabled={estado === 'enviando'}>{estado === 'enviando' ? 'Enviando…' : `Aportar ${envio.length} ${envio.length === 1 ? 'precio' : 'precios'}`}</Boton>
      <Boton tipo="secundario" onClick={onRechazar} disabled={estado === 'enviando'}>No, gracias</Boton>
    </Tarjeta>
  );
}
