// Gráfico de barras horizontales: qué productos de la compra aportan más de un nutriente.
// Una serie, un color validado (#1B6E3A vs. fondo: pasa las 6 pruebas), barras ≤ 24 px con el extremo
// redondeado, valor directo al final de cada barra, detalle al pasar o enfocar, y vista en tabla.
import { useState } from 'react';
import { NUTRIENTES_GRAFICO, aportes, equivalencia, textoTamano, type Aporte, type LineaCompra, type NutrienteGrafico } from './dominio/aportes';

const MAX_BARRAS = 6;
const TITULO: Record<NutrienteGrafico, string> = { azucares: 'el azúcar', sodio: 'el sodio', saturadas: 'la grasa saturada', grasas: 'la grasa' };
const fmt = (x: number, unidad: string) => `${x >= 100 ? Math.round(x).toLocaleString('es-CR').replace(/[., \s]/g, ' ') : x.toLocaleString('es-CR', { maximumFractionDigits: 1 })} ${unidad}`;

export function GraficoAportes({ compra }: { compra: LineaCompra[] }) {
  const [n, setN] = useState<NutrienteGrafico>('azucares');
  const [activo, setActivo] = useState<number | null>(null);
  const def = NUTRIENTES_GRAFICO.find(x => x.clave === n)!;
  const r = aportes(compra, n);
  const detalle = (a: Aporte) => `${fmt(a.porCien, def.unidad)} por 100 g · ${textoTamano(a)} · ${a.unidades} ${a.unidades === 1 ? 'unidad' : 'unidades'}`;
  const visibles = r.aportes.slice(0, MAX_BARRAS);
  const resto = r.aportes.slice(MAX_BARRAS);
  const filas = resto.length
    ? [...visibles.map(a => ({ nombre: a.producto.nombre, valor: a.valor, detalle: detalle(a) })),
      { nombre: resto.length === 1 ? resto[0].producto.nombre : `Otros ${resto.length} productos`, valor: resto.reduce((s, a) => s + a.valor, 0), detalle: resto.map(a => a.producto.nombre).join(', ') }]
    : visibles.map(a => ({ nombre: a.producto.nombre, valor: a.valor, detalle: detalle(a) }));
  const max = Math.max(1, ...filas.map(f => f.valor));
  const delTiquete = r.aportes.filter(a => a.delTiquete).length;
  const eq = equivalencia(n, r.total);

  return (
    <section className="tarjeta borde grafico" aria-labelledby="titulo-grafico">
      <strong id="titulo-grafico">¿De dónde viene {TITULO[n]} de su compra?</strong>
      {/* Botones de alternar (no pestañas): elegir un nutriente cambia el gráfico de abajo. */}
      <div className="selector" role="group" aria-label="Nutriente">
        {NUTRIENTES_GRAFICO.map(x => (
          <button key={x.clave} type="button" aria-pressed={x.clave === n}
            onClick={() => { setN(x.clave); setActivo(null); }}><span className="punto" style={{ background: `var(--n-${x.clave})` }} aria-hidden="true" />{x.nombre}</button>
        ))}
      </div>
      {filas.length === 0
        ? <p className="nota">Ningún producto de esta compra trae {def.nombre.toLowerCase()} con datos suficientes.</p>
        : <>
          <p style={{ fontSize: '1.25rem', fontWeight: 700 }}>En total: {fmt(r.total, def.unidad)}{eq && <span className="nota" style={{ display: 'block', fontWeight: 400 }}>{eq}</span>}</p>
          <ul className="barras" role="list">
            {filas.map((f, i) => (
              <li key={f.nombre + i} className="barra-fila" tabIndex={0} aria-label={`${f.nombre}: ${fmt(f.valor, def.unidad)}, ${Math.round((f.valor / r.total) * 100)} % del total`}
                aria-describedby={activo === i ? 'detalle-barra' : undefined}
                onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)} onFocus={() => setActivo(i)} onBlur={() => setActivo(null)}>
                <span className="barra-nombre">{f.nombre}</span>
                <span className="barra-pista">
                  {/* La barra más larga ocupa el 68 % para que el valor siempre quepa a su derecha. */}
                  <span className="barra-dato" style={{ width: `${Math.max(1.5, (f.valor / max) * 68)}%`, background: `var(--n-${n})` }} />
                  <span className="barra-valor">{fmt(f.valor, def.unidad)} · {f.valor / r.total < 0.005 ? '<1' : Math.round((f.valor / r.total) * 100)}&nbsp;%</span>
                </span>
                {activo === i && <span id="detalle-barra" className="barra-detalle" role="tooltip">{f.detalle}</span>}
              </li>
            ))}
          </ul>
        </>}
      {n === 'azucares' && <p className="nota">Azúcares libres estimados con el método de la OPS.</p>}
      {(r.sinTamano.length > 0 || r.sinDato.length > 0) && (
        <p className="nota">No incluye {r.sinTamano.length + r.sinDato.length} {r.sinTamano.length + r.sinDato.length === 1 ? 'producto' : 'productos'} sin tamaño o sin este dato en la base.</p>
      )}
      {delTiquete > 0 && (
        <p className="nota">{delTiquete === 1 ? '1 producto usa' : `${delTiquete} productos usan`} el tamaño leído del tiquete porque la base no lo trae.</p>
      )}
      <p className="nota">Es lo que compró el hogar, no lo que come una persona.</p>
      {r.aportes.length > 0 && (
        <details>
          <summary>Ver como tabla</summary>
          <table className="tabla">
            <thead><tr><th>Producto</th><th>Por 100 g</th><th>Tamaño</th><th>Unid.</th><th>En la compra</th></tr></thead>
            <tbody>
              {r.aportes.map(a => (
                <tr key={a.producto.ean}><td>{a.producto.nombre}</td><td>{fmt(a.porCien, def.unidad)}</td><td>{textoTamano(a)}</td><td>{a.unidades}</td><td>{fmt(a.valor, def.unidad)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
