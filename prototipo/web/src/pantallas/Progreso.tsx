// «Su progreso»: % del gasto en productos empacados que fue en productos con sellos, mes a mes.
// Una sola serie (sin leyenda: el título la nombra), barras horizontales con valor directo y vista en tabla.
import { useState } from 'react';
import { GRAMOS_POR_CUCHARADITA, SAL_POR_SODIO } from '../dominio/aportes';
import { TEXTO_NIVEL, idCompra, nivelSellos, nombreMes, porMes, tendencia, type ResumenCompra } from '../dominio/progreso';
import { Anillo, Boton, Etiqueta, Icono, Tarjeta, Vacio, colones } from '../componentes';

const MESES_VISIBLES = 6;
const pct = (x: number) => `${Math.round(x)} %`;

// Ejemplo SIMULADO para ver cómo se ve la pantalla antes de tener compras reales. No se guarda.
const EJEMPLO: ResumenCompra[] = [
  ['2026-08-03', 'Palí', 24000, 13200, 900, 21000], ['2026-08-24', 'Palí', 18000, 9500, 700, 16000],
  ['2026-09-10', 'Maxi Palí', 30000, 13800, 820, 19500], ['2026-10-02', 'Palí', 26000, 9100, 600, 15000],
  ['2026-10-25', 'Más x Menos', 12000, 4300, 300, 7000], ['2026-11-08', 'Palí', 25000, 6800, 420, 12500],
].map(([fecha, comercio, ge, gs, az, so]) => ({
  id: idCompra(fecha as string, ge as number, 9), fecha: fecha as string, comercio: comercio as string, empacados: 9, conSellos: 4,
  gastoEmpacados: ge as number, gastoConSellos: gs as number, azucarG: az as number, sodioMg: so as number,
}));

export function Progreso({ compras }: { compras: ResumenCompra[] }) {
  const [ejemplo, setEjemplo] = useState(false);
  const datos = ejemplo ? EJEMPLO : compras;
  const meses = porMes(datos);
  const t = tendencia(meses);
  const visibles = meses.slice(-MESES_VISIBLES);

  if (datos.length === 0) {
    return <>
      <h1>Su progreso</h1>
      <Vacio titulo="Aún no hay compras guardadas" icono="progreso">
        <p>Cada tiquete o factura real que revise se suma aquí, mes a mes. Así verá si su canasta va mejorando.</p>
        <p className="nota">Se guarda un resumen en su teléfono, no la lista de productos.</p>
      </Vacio>
      <Boton tipo="secundario" onClick={() => setEjemplo(true)}>Ver un ejemplo SIMULADO</Boton>
    </>;
  }

  return <>
    <h1>Su progreso {ejemplo && <Etiqueta tipo="simulado">SIMULADO</Etiqueta>}</h1>
    {t.estado !== 'sin-datos' && (
      <Tarjeta>
        <Anillo porcentaje={t.actual} texto={pct(t.actual)} nivel={nivelSellos(t.actual)}
          descripcion={`Este mes, el ${pct(t.actual)} de su gasto en productos empacados fue en productos con sellos (${TEXTO_NIVEL[nivelSellos(t.actual)].toLowerCase()})`}>
          <div><Etiqueta tipo={nivelSellos(t.actual)}>{TEXTO_NIVEL[nivelSellos(t.actual)]}</Etiqueta></div>
          {t.estado === 'primer-mes'
            ? <><strong style={{ fontSize: '1.25rem' }}>Este mes</strong><p>de su gasto en empacados fue en productos con sellos. El próximo mes podrá comparar.</p></>
            : <>
              <div><Etiqueta tipo={t.estado === 'mejora' ? 'beneficio' : t.estado === 'empeora' ? 'duda' : 'listo'}>
                {t.estado === 'mejora' ? '¡Va mejorando!' : t.estado === 'empeora' ? 'Este mes subió' : 'Se mantiene igual'}
              </Etiqueta></div>
              <p>de su gasto en empacados fue en productos con sellos; el mes anterior, el {pct(t.anterior)}.</p>
            </>}
        </Anillo>
      </Tarjeta>
    )}

    <section className="tarjeta borde grafico" aria-labelledby="titulo-progreso">
      <strong id="titulo-progreso">Gasto en productos con sellos, por mes</strong>
      <p className="nota">Porcentaje de lo gastado en productos empacados. Menos es mejor. Nivel bajo: hasta 20 %; medio: hasta 50 %; alto: más de 50 %.</p>
      <ul className="barras" role="list">
        {visibles.map(m => (
          <li key={m.mes} className="barra-fila" aria-label={`${nombreMes(m.mes)}: ${m.pctConSellos === undefined ? 'sin productos empacados' : pct(m.pctConSellos)}`}>
            <span className="barra-nombre">{nombreMes(m.mes)} · {m.compras} {m.compras === 1 ? 'compra' : 'compras'}</span>
            <span className="barra-pista">
              {m.pctConSellos !== undefined && <span className={`barra-dato ${nivelSellos(m.pctConSellos)}`} style={{ width: `${Math.max(1.5, m.pctConSellos * 0.68)}%` }} />}
              <span className="barra-valor">{m.pctConSellos === undefined ? 'sin empacados' : pct(m.pctConSellos)}</span>
            </span>
          </li>
        ))}
      </ul>
      <details>
        <summary>Ver como tabla</summary>
        <table className="tabla">
          <thead><tr><th>Mes</th><th>Gasto empacados</th><th>Con sellos</th><th>Azúcar</th><th>Sal</th></tr></thead>
          <tbody>
            {meses.map(m => (
              <tr key={m.mes}>
                <td>{nombreMes(m.mes)}</td>
                <td>{colones(m.gastoEmpacados)}</td>
                <td>{m.pctConSellos === undefined ? '—' : pct(m.pctConSellos)}</td>
                <td>{Math.round(m.azucarG / GRAMOS_POR_CUCHARADITA)} cdtas.</td>
                <td>{Math.round((m.sodioMg / 1000) * SAL_POR_SODIO)} g</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="nota">Azúcar en cucharaditas (4 g) y sal en gramos (sodio × 2,5): lo que compró el hogar, no lo que come una persona.</p>
      </details>
    </section>

    <h2>Últimas compras</h2>
    {[...datos].reverse().slice(0, 5).map(c => (
      <div key={c.id} className="fila">
        <span className="cat otro" aria-hidden="true"><Icono nombre="tiquete" /></span>
        <div className="datos">
          <span className="nombre">{c.fecha.split('-').reverse().join('/')}{c.comercio ? ` · ${c.comercio}` : ''}</span>
          <span className="detalle">{c.conSellos} de {c.empacados} empacados con sellos · {colones(c.gastoConSellos)} de {colones(c.gastoEmpacados)}</span>
        </div>
      </div>
    ))}
    <p className="nota">Solo cuentan compras reales revisadas en este teléfono. Se guarda un resumen, no la lista de productos.</p>
    {ejemplo && <Boton tipo="secundario" onClick={() => setEjemplo(false)}>Salir del ejemplo</Boton>}
  </>;
}
