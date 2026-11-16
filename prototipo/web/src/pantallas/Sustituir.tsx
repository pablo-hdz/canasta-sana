// Paso 4: productos que conviene sustituir, de más sellos a menos (D-23). Sin sugerir un producto específico:
// la persona elige en la tienda una opción con menos sellos.
import { useEffect, useRef, useState } from 'react';
import type { ItemLista } from '../dominio/lista';
import { agregarOQuitar } from '../dominio/lista';
import { categoriaVisual } from '../dominio/visual';
import { queBuscar, type ParaSustituir } from '../dominio/sustituir';
import { avisosHogar } from '../dominio/hogar';
import { PERFIL_VACIO, type Perfil } from '../dominio/cambios';
import { Boton, Icono, IconoCategoria, Sello, Tarjeta, Vacio, colones } from '../componentes';

interface Props {
  items: ParaSustituir[];
  lista: ItemLista[];
  onCambiarLista: (l: ItemLista[]) => void;
  onIrLista: () => void;
  onInicio: () => void;
  perfil?: Perfil;                         // B-07: niños y alergias del hogar
  ingredientesFoto?: Record<string, string>;   // ingredientes leídos con la cámara (colorantes)
}

/** B-06: primero se ven 3 productos (los de más sellos); el resto, con «Ver los otros N». */
export const VISIBLES_PRIMERO = 3;

export function Sustituir({ items, lista, onCambiarLista, onIrLista, onInicio, perfil = PERFIL_VACIO, ingredientesFoto = {} }: Props) {
  const [todos, setTodos] = useState(false);
  const siguiente = useRef<HTMLElement>(null);
  // Al abrir el resto, el foco pasa al primer producto nuevo: no se pierde (lectores de pantalla y teclado).
  useEffect(() => { if (todos) siguiente.current?.focus(); }, [todos]);
  if (items.length === 0) {
    return <>
      <h1>Qué conviene cambiar</h1>
      <Vacio titulo="Ninguno de sus productos empacados tiene sellos" icono="lista">
        <p>Según el modelo de la OPS, no hay nada que cambiar en esta compra.</p>
      </Vacio>
      <Boton tipo="secundario" onClick={onInicio}>Revisar otro tiquete</Boton>
    </>;
  }
  const recordatorios = lista.filter(x => x.accion === 'sustituir').length;
  return <>
    <h1>{items.length} {items.length === 1 ? 'producto para cambiar' : 'productos para cambiar'}</h1>
    <p>De más sellos a menos. En su próxima compra, busque en el mismo pasillo una opción con menos sellos.</p>
    {(todos ? items : items.slice(0, VISIBLES_PRIMERO)).map(({ producto: p, sellos, gasto }, i) => {
      const enLista = lista.some(x => x.ean === p.ean && x.accion === 'sustituir');
      return (
        <Tarjeta key={p.ean}>
          <div className="encabezado-producto" style={{ alignItems: 'flex-start' }}>
            <IconoCategoria producto={p} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong ref={i === VISIBLES_PRIMERO ? siguiente : undefined} tabIndex={i === VISIBLES_PRIMERO ? -1 : undefined}>{i + 1}. {p.nombre}{p.marca ? ` · ${p.marca}` : ''}</strong>
              <span className="nota" style={{ display: 'block' }}>{sellos.length} {sellos.length === 1 ? 'sello' : 'sellos'} · {colones(gasto)} en esta compra</span>
            </div>
          </div>
          <div className="sellos">{sellos.map(s => <Sello key={s} sello={s} />)}</div>
          {(() => {
            const avisos = avisosHogar(p, perfil, ingredientesFoto[p.ean]);
            return avisos.length > 0 && <ul className="avisos-producto" aria-label="Avisos de este producto">{avisos.map(a => <li key={a}><Icono nombre="info" />{a}</li>)}</ul>;
          })()}
          <p>{queBuscar(sellos)}</p>
          <Boton tipo="secundario" onClick={() => onCambiarLista(agregarOQuitar(lista, {
            ean: p.ean, nombre: p.nombre, marca: p.marca || undefined, cantidad: p.cantidad || undefined,
            hecho: false, categoria: categoriaVisual(p), accion: 'sustituir',
          }))}>
            {enLista ? 'En su lista ✓ (tocar para quitar)' : 'Recordármelo en mi lista'}
          </Boton>
        </Tarjeta>
      );
    })}
    {!todos && items.length > VISIBLES_PRIMERO && (
      <Boton tipo="secundario" onClick={() => setTodos(true)}>Ver los otros {items.length - VISIBLES_PRIMERO}</Boton>
    )}
    {recordatorios > 0 && <Boton onClick={onIrLista}>Ver mi lista ({lista.length})</Boton>}
    <p className="nota">La app no sugiere un producto específico: los datos de la base pueden estar incompletos y un cambio automático puede equivocarse. Usted elige con la etiqueta en la mano.</p>
    <Boton tipo="secundario" onClick={onInicio}>Revisar otro tiquete</Boton>
  </>;
}
