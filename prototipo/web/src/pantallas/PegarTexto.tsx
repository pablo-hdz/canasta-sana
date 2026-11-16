// «Pegar el texto de una factura o tiquete»: para la factura que llega al correo como texto o representación
// gráfica, sin XML ni PDF a mano. Se lee con el mismo lector del tiquete, en el teléfono; no se envía a ningún lado.
import { useState } from 'react';
import { Boton } from '../componentes';
import { IconoOpcion } from '../ilustraciones';

export const MINIMO_TEXTO = 20;   // caracteres: menos que eso no es una factura (SUPUESTO)

export function PegarTexto({ onRevisar }: { onRevisar: (texto: string) => void }) {
  const [texto, setTexto] = useState('');
  const listo = texto.trim().length >= MINIMO_TEXTO;
  return (
    <details className="tarjeta pegar">
      <summary>
        <span className="cat tono-amarillo" aria-hidden="true"><IconoOpcion tipo="pegar" /></span>
        Pegar el texto de una factura o tiquete
      </summary>
      <p className="nota">Por ejemplo, la factura electrónica que le llegó al correo. Copie todo el texto y péguelo aquí: se revisa en su teléfono y no se envía a ningún lado.</p>
      <label htmlFor="texto-factura" className="nota">Texto de la factura o tiquete</label>
      <textarea id="texto-factura" rows={8} value={texto} onChange={e => setTexto(e.target.value)}
        placeholder="Pegue aquí el texto, con los productos y el total…" spellCheck={false} />
      <Boton onClick={() => onRevisar(texto)} disabled={!listo}>Revisar</Boton>
    </details>
  );
}
