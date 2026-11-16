// Colorantes con advertencia o prohibidos en otros países, en la compra (D-19). Informativo y con fuente:
// la app dice qué exige cada norma, no «peligroso». Si un producto no trae ingredientes en la base,
// la persona puede leerlos con la cámara (OCR en el teléfono; el texto se guarda solo ahí).
import type { Producto } from '../dominio/tipos';
import { FUENTES, colorantesDe, hayDatosDeIngredientes, type Regla } from '../dominio/colorantes';
import { Etiqueta, IconoCategoria, Tarjeta, TituloSeccion } from '../componentes';

/** Botón para (re)leer la lista de ingredientes con la cámara. */
function BotonFoto({ p, onFoto }: { p: Producto; onFoto: (p: Producto, f?: File) => void }) {
  return (
    <label className="boton secundario" style={{ width: 'auto', minHeight: 48, padding: '8px 14px', fontSize: '1.125rem', flex: 'none' }}>
      Foto
      <input type="file" accept="image/*" capture="environment" className="oculto-accesible" aria-label={`Foto de los ingredientes de ${p.nombre}`}
        onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; onFoto(p, f); }} />
    </label>
  );
}

interface Props {
  productos: Producto[];
  extra: Record<string, string>;      // ingredientes leídos con la cámara, por código
  estado: string;                     // mensaje de la última lectura
  onFoto: (p: Producto, f?: File) => void;
}

export function SeccionColorantes({ productos, extra, estado, onFoto }: Props) {
  const unicos = [...new Map(productos.map(p => [p.ean, p])).values()];
  const con = unicos.map(p => ({ p, cs: colorantesDe(p, extra[p.ean]) })).filter(x => x.cs.length > 0);
  const sinDatos = unicos.filter(p => !hayDatosDeIngredientes(p, extra[p.ean]));
  const sinDeclarar = unicos.filter(p => hayDatosDeIngredientes(p, extra[p.ean]) && colorantesDe(p, extra[p.ean]).length === 0);
  const conDatos = unicos.length - sinDatos.length;
  const reglas = [...new Set(con.flatMap(x => x.cs.map(c => c.regla)))] as Regla[];

  return (
    <Tarjeta>
      <TituloSeccion icono="gota" color="snack">Colorantes</TituloSeccion>
      {con.length > 0
        ? <p><strong>{con.length} {con.length === 1 ? 'producto lleva' : 'productos llevan'}</strong> colorantes con advertencia o prohibidos en otros países.</p>
        : conDatos > 0
          ? <p>Según su etiqueta, ninguno de los {conDatos} productos con ingredientes conocidos declara los colorantes de la lista.</p>
          : <p>Todavía no sabemos los ingredientes de sus productos.</p>}

      {con.map(({ p, cs }) => (
        <div key={p.ean} className="encabezado-producto" style={{ alignItems: 'flex-start' }}>
          <IconoCategoria producto={p} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong>{p.nombre}{p.marca ? ` · ${p.marca}` : ''}</strong>
            <div className="sellos">
              {cs.map(c => <Etiqueta key={c.codigo} tipo={c.regla === 'advertencia-ue' ? 'duda' : 'alerta'}>{c.nombre} ({c.codigo})</Etiqueta>)}
            </div>
          </div>
        </div>
      ))}

      {reglas.map(r => (
        <details key={r}>
          <summary>{FUENTES[r].titulo}: ¿qué significa?</summary>
          <p>{FUENTES[r].explicacion}</p>
          <p className="nota">Fuente: <a href={FUENTES[r].url} target="_blank" rel="noopener noreferrer">{FUENTES[r].norma}</a>.</p>
        </details>
      ))}

      {sinDeclarar.length > 0 && (
        <details>
          <summary>Ver {sinDeclarar.length === 1 ? 'el producto' : `los ${sinDeclarar.length} productos`} sin colorantes declarados</summary>
          <p className="nota">«No declara» no siempre es «no tiene»: la etiqueta puede estar incompleta o el texto mal leído. Este es el texto en que se basa la app; si se ve mal, tome una foto de la lista.</p>
          {sinDeclarar.map(p => (
            <div key={p.ean} className="encabezado-producto" style={{ alignItems: 'flex-start' }}>
              <IconoCategoria producto={p} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{p.nombre}</strong>
                <span className="nota" style={{ display: 'block' }}>{(extra[p.ean] || p.ingredientes || 'Solo la lista de aditivos de Open Food Facts.').slice(0, 160)}{(extra[p.ean] || p.ingredientes || '').length > 160 ? '…' : ''}</span>
              </span>
              <BotonFoto p={p} onFoto={onFoto} />
            </div>
          ))}
        </details>
      )}

      {sinDatos.length > 0 && (
        <details>
          <summary>{sinDatos.length} {sinDatos.length === 1 ? 'producto sin' : 'productos sin'} ingredientes en la base</summary>
          <p className="nota">Sin la lista de ingredientes no se puede saber si llevan estos colorantes. Tome una foto de la lista en el empaque: se lee en su teléfono y no se envía a ningún lado.</p>
          {sinDatos.map(p => (
            <div key={p.ean} className="encabezado-producto">
              <IconoCategoria producto={p} />
              <span style={{ flex: 1, minWidth: 0 }}>{p.nombre}</span>
              <BotonFoto p={p} onFoto={onFoto} />
            </div>
          ))}
        </details>
      )}
      {estado && <p className="nota" role="status">{estado}</p>}
      <p className="nota">Solo informativo: estos colorantes están en la lista porque otros países exigen advertirlos o los prohibieron. La app no dice que un producto sea peligroso.</p>
    </Tarjeta>
  );
}
