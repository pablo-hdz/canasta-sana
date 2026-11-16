// «Mi lista»: cambios elegidos para la próxima compra. Se comparte solo si la persona lo decide.
import { useState } from 'react';
import { enlaceWhatsApp, marcar, textoLista, type ItemLista } from '../dominio/lista';
import { Anillo, Boton, IconoCategoria, Tarjeta, Vacio } from '../componentes';

export function MiLista({ lista, onCambiar, onIrInicio }: { lista: ItemLista[]; onCambiar: (l: ItemLista[]) => void; onIrInicio: () => void }) {
  const [aviso, setAviso] = useState('');
  const texto = textoLista(lista);
  const hechos = lista.filter(x => x.hecho).length;
  const puedeCompartir = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  async function compartir() {
    try { await navigator.share({ title: 'Mi lista de compras', text: texto }); }
    catch { /* la persona canceló */ }
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(texto); setAviso('Lista copiada. Péguela donde quiera.'); }
    catch { setAviso('No se pudo copiar. Mantenga presionado el texto para copiarlo.'); }
  }

  if (lista.length === 0) {
    return <>
      <h1>Mi lista</h1>
      <Vacio titulo="Su lista está vacía" icono="lista">
        <p>En «Qué conviene cambiar», toque «Recordármelo en mi lista» y el producto aparecerá aquí para su próxima compra.</p>
      </Vacio>
      <Boton onClick={onIrInicio}>Revisar un tiquete</Boton>
    </>;
  }

  return <>
    <h1>Mi lista</h1>
    <Tarjeta>
      <Anillo porcentaje={(hechos / lista.length) * 100} texto={`${hechos}/${lista.length}`}
        descripcion={`Ya compró ${hechos} de ${lista.length} productos de su lista`}>
        <strong style={{ fontSize: '1.25rem' }}>Su próxima compra</strong>
        <p>{lista.length - hechos} por comprar{hechos > 0 ? ` · ${hechos} ya ${hechos === 1 ? 'comprado' : 'comprados'}` : ''}.</p>
      </Anillo>
    </Tarjeta>
    {lista.map(x => (
      <div key={x.ean} className={`fila ${x.hecho ? 'hecho' : ''}`}>
        <label className="casilla" style={{ flex: 1, minWidth: 0 }}>
          <input type="checkbox" checked={x.hecho} onChange={() => onCambiar(marcar(lista, x.ean))} />
          <IconoCategoria categoria={x.categoria ?? 'otro'} />
          <span className="datos">
            <span className="nombre">{x.nombre}</span>
            <span className="detalle">{x.accion === 'sustituir'
              ? 'Buscar una opción con menos sellos'
              : `${[x.marca, x.cantidad, x.precio].filter(Boolean).join(' · ')}${x.enVezDe ? ` · en vez de ${x.enVezDe}` : ''}`}</span>
          </span>
        </label>
        <button type="button" className="enlace" onClick={() => onCambiar(lista.filter(y => y.ean !== x.ean))} aria-label={`Quitar ${x.nombre}`}>Quitar</button>
      </div>
    ))}
    {texto && <>
      <h2>Compartir</h2>
      <div className="compartir">
        {puedeCompartir
          ? <Boton tipo="secundario" onClick={compartir}>Compartir</Boton>
          : <Boton tipo="secundario" onClick={copiar}>Copiar</Boton>}
        <a className="boton secundario" href={enlaceWhatsApp(texto)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
      </div>
      {aviso && <p className="nota" role="status">{aviso}</p>}
      <p className="nota">Solo se comparte el texto de la lista, por la aplicación que usted elija. Nada de su tiquete ni de su hogar.</p>
    </>}
    {hechos > 0 && <button type="button" className="enlace" onClick={() => onCambiar(lista.filter(x => !x.hecho))}>Quitar los ya comprados</button>}
  </>;
}
