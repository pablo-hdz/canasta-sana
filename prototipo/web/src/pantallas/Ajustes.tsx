// Ajustes: hogar, apariencia, precios de la comunidad (opcional) y privacidad.
import { useState } from 'react';
import type { Perfil } from '../dominio/cambios';
import { PROVINCIAS } from '../dominio/comercio';
import { NOTA_FECHA_APORTE, ROTULOS_APORTE as R } from '../dominio/comunidad';
import { exportarDatos, importarDatos, type CacheComunidad, type Preferencias, type Tema } from '../almacen';
import { Tarjeta, TituloSeccion } from '../componentes';
import { descargarJson } from '../descargar';
import { VERSION_APP } from '../version';
import type { Aprendido } from '../dominio/alias';

export const ALERGENOS: [string, string][] = [
  ['en:peanuts', 'Maní'], ['en:milk', 'Leche'], ['en:gluten', 'Gluten'], ['en:soybeans', 'Soya'], ['en:eggs', 'Huevo'], ['en:nuts', 'Frutos de cáscara'],
];
const TEMAS: [Tema, string][] = [['claro', 'Claro'], ['oscuro', 'Oscuro'], ['telefono', 'Como el teléfono']];

/** «Precios de 12 productos, actualizada el 14/11/26 a la 1:18 a. m.» (la tabla tiene varias filas por producto). */
export function resumenTabla(c: CacheComunidad): string {
  const productos = new Set(c.tabla.precios.map(f => f.ean)).size;
  const d = new Date(c.descargada);
  const dia = d.toLocaleDateString('es-CR', { dateStyle: 'short' });
  const hora = d.toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' });
  const texto = `${productos === 0 ? 'Todavía no hay precios publicados' : `Precios de ${productos} ${productos === 1 ? 'producto' : 'productos'}`}, actualizada el ${dia}, ${hora}`;
  return texto.endsWith('.') ? texto : `${texto}.`;
}

interface Props {
  perfil: Perfil; onPerfil: (p: Perfil) => void;
  prefs: Preferencias; onPrefs: (p: Preferencias) => void;
  hayServicio: boolean;
  comunidad: CacheComunidad | null; estadoComunidad: string; onActualizar: () => void;
  datos: { precios: number; alias: number; compras: number; lista: number };
  onBorrar: () => void;
  onRestaurado: () => void;
  base: { productos: number; descargado?: string };
  aprendidos?: Aprendido[];            // B-03: productos aprendidos para revisar y olvidar uno por uno
  onOlvidar?: (clave: string) => void;
}

/** Descarga la copia como archivo .json (no se envía a ningún lado: el navegador la guarda en el teléfono). */
function descargarCopia() {
  const copia = exportarDatos();
  descargarJson(`canasta-sana-copia-${copia.creada.slice(0, 10)}.json`, copia);
}

export function Ajustes(p: Props) {
  const { perfil, prefs } = p;
  const [avisoCopia, setAvisoCopia] = useState('');

  async function restaurar(f?: File) {
    if (!f) return;
    if (!window.confirm('Restaurar la copia reemplaza los datos que hay ahora en este teléfono. ¿Continuar?')) return;
    const r = importarDatos(await f.text());
    if (!r.ok) { setAvisoCopia(`No se restauró: ${r.error}.`); return; }
    setAvisoCopia(`Copia restaurada: ${r.compras} compras, ${r.precios} precios y ${r.lista} productos en su lista.`);
    p.onRestaurado();
  }
  return <>
    <h1>Ajustes</h1>

    <Tarjeta>
      <TituloSeccion icono="inicio" color="grano">Su hogar</TituloSeccion>
      <p className="nota">Se guarda solo en este teléfono. En «Qué conviene cambiar» le avisamos siempre si un producto lleva edulcorantes o colorantes de la lista y, si marca una alergia, cuándo la etiqueta declara ese alérgeno. Si la base no tiene el dato, no decimos nada.</p>
      {/* B-15 (propuesta D-31): la casilla «Hay niños en la casa» se oculta porque no tiene efecto desde D-29.
          El dato guardado (perfil.ninos) se conserva: onPerfil siempre copia el perfil completo. */}
      <span className="nota" id="alergias">Alergias en la casa:</span>
      <div role="group" aria-labelledby="alergias">
        {ALERGENOS.map(([tag, nombre]) => (
          <label key={tag} className="casilla">
            <input type="checkbox" checked={perfil.alergenos.includes(tag)}
              onChange={e => p.onPerfil({ ...perfil, alergenos: e.target.checked ? [...perfil.alergenos, tag] : perfil.alergenos.filter(a => a !== tag) })} />
            {nombre}
          </label>
        ))}
      </div>
    </Tarjeta>

    <Tarjeta>
      <TituloSeccion icono="tema" color="cereal" id="tema">Apariencia</TituloSeccion>
      <div className="selector" role="group" aria-labelledby="tema">
        {TEMAS.map(([t, nombre]) => (
          <button key={t} type="button" aria-pressed={prefs.tema === t} onClick={() => p.onPrefs({ ...prefs, tema: t })}>{nombre}</button>
        ))}
      </div>
      <p className="rotulo" id="letra">Letra</p>
      <div className="selector" role="group" aria-labelledby="letra">
        <button type="button" className="muestra-sistema" aria-pressed={!prefs.letra} onClick={() => p.onPrefs({ ...prefs, letra: undefined })}>Como las apps del teléfono</button>
        <button type="button" className="muestra-legible" aria-pressed={prefs.letra === 'legible'} onClick={() => p.onPrefs({ ...prefs, letra: 'legible' })}>Más fácil de leer</button>
      </div>
      <p className="nota">«Más fácil de leer» usa Atkinson Hyperlegible, hecha para personas con baja visión: distingue mejor letras parecidas como I, l y 1, o 0 y O.</p>
      <label className="interruptor">
        <input type="checkbox" checked={prefs.animaciones === false} onChange={e => p.onPrefs({ ...prefs, animaciones: e.target.checked ? false : undefined })} />
        <span>Quitar las animaciones</span>
        <span className="nota">Las ilustraciones se mueven unos segundos y se detienen solas. Márquelo si el movimiento le marea o le distrae.</span>
      </label>
    </Tarjeta>

    <Tarjeta>
      <TituloSeccion icono="comunidad" color="bebida">Precios de la comunidad</TituloSeccion>
      {!p.hayServicio
        ? <p className="nota">Esta versión funciona sin servidor: usa los precios de sus propias compras y estimados «≈».</p>
        : <>
          <label className="interruptor">
            <input type="checkbox" checked={prefs.usarComunidad} onChange={e => p.onPrefs({ ...prefs, usarComunidad: e.target.checked })} />
            <span>Usar precios de la comunidad</span>
            <span className="nota">Descarga la tabla completa de precios que otras personas aportaron. Su compra no se envía. La tabla se renueva una vez por semana.</span>
          </label>
          {prefs.usarComunidad && (
            <p className="nota" role="status">
              {p.comunidad ? resumenTabla(p.comunidad) : 'Aún sin descargar.'}
              {p.estadoComunidad && ` ${p.estadoComunidad}`}
              {' '}<button type="button" className="enlace" onClick={p.onActualizar}>Actualizar ahora</button>
            </p>
          )}
          <label className="interruptor">
            <input type="checkbox" checked={prefs.aportar} onChange={e => p.onPrefs({ ...prefs, aportar: e.target.checked })} />
            <span>Ofrecerme aportar mis precios, sin mi nombre</span>
            <span className="nota">Después de revisar un tiquete o factura cuyo total cuadra, le mostramos exactamente qué se enviaría ({R.ean} de cada producto, {R.precio}, {R.cadena}, su {R.canton} si lo elige y la {R.fecha}; {NOTA_FECHA_APORTE}) y usted decide en cada compra. Nunca su nombre, su tiquete completo ni su hogar.</span>
          </label>
          <label className="nota" htmlFor="canton">Su cantón (opcional, mejora los precios cercanos)</label>
          <select id="canton" value={prefs.canton ?? ''} onChange={e => p.onPrefs({ ...prefs, canton: e.target.value || undefined })}>
            <option value="">Sin indicar</option>
            {Object.entries(PROVINCIAS).map(([prov, cantones]) => (
              <optgroup key={prov} label={prov}>{cantones.map(c => <option key={c} value={c}>{c}</option>)}</optgroup>
            ))}
          </select>
        </>}
    </Tarjeta>

    <Tarjeta>
      <TituloSeccion icono="candado" color="snack">Su privacidad</TituloSeccion>
      <p>Su foto y sus compras no salen de su teléfono.</p>
      <p>Esta app nunca le pedirá su clave ni su tarjeta.</p>
      <p className="nota">
        Guardado en este teléfono: {p.datos.precios} precios de sus compras, {p.datos.alias} productos aprendidos,
        {' '}{p.datos.compras} compras en su progreso y {p.datos.lista} productos en su lista.
      </p>
      {(p.aprendidos?.length ?? 0) > 0 && (
        <details>
          <summary>Revisar los productos aprendidos ({p.aprendidos!.length})</summary>
          <p className="nota">Lo que la app reconoce por sus compras anteriores. Si uno está mal, olvídelo: la próxima vez le preguntará.</p>
          <ul className="aprendidos">
            {p.aprendidos!.map(a => (
              <li key={a.clave}>
                <span>«{a.clave}» → {a.nombre}</span>
                <button type="button" className="boton secundario" aria-label={`Olvidar «${a.clave}»`} onClick={() => p.onOlvidar?.(a.clave)}>Olvidar</button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <button type="button" className="enlace" onClick={() => {
        if (window.confirm('¿Borrar todos sus datos de este teléfono? No se puede deshacer.')) p.onBorrar();
      }}>Borrar mis datos de este teléfono</button>
      <h2 style={{ fontSize: '1.125rem', marginTop: 8 }}>Copia de seguridad</h2>
      <p className="nota">Sus datos viven solo en este teléfono. Una copia le permite pasarlos a otro teléfono o recuperarlos. Es un archivo que usted guarda donde quiera: no se envía a ningún lado. Contiene su hogar, su lista, su progreso y sus precios.</p>
      <div className="compartir">
        <button type="button" className="boton secundario" onClick={() => { descargarCopia(); setAvisoCopia('Copia guardada en sus descargas.'); }}>Guardar copia</button>
        <label className="boton secundario">
          Restaurar copia
          <input type="file" accept=".json,application/json" className="oculto-accesible"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; void restaurar(f); }} />
        </label>
      </div>
      {avisoCopia && <p className="nota" role="status">{avisoCopia}</p>}
    </Tarjeta>

    <Tarjeta>
      <TituloSeccion icono="info" color="otro">Acerca de</TituloSeccion>
      <p className="nota">Canasta sana v{VERSION_APP} (prototipo). Sellos según el modelo de perfil de nutrientes de la OPS (2016). Información general: no sustituye la atención en su EBAIS.</p>
      <p className="nota">Datos de productos: Open Food Facts (ODbL), {p.base.productos} productos de Costa Rica, descargados el {p.base.descargado?.slice(0, 10) ?? '—'}. Tipografía Atkinson Hyperlegible Next (OFL).</p>
    </Tarjeta>
  </>;
}
