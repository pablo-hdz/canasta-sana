// Componentes de la interfaz: equivalen a los componentes locales del archivo de Figma.
import type { ReactNode } from 'react';
import type { Producto } from './dominio/tipos';
import { categoriaVisual, type CategoriaVisual } from './dominio/visual';
import type { Sello as TipoSello } from './dominio/tipos';
import { TEXTO_SELLO } from './dominio/tipos';
import { explicarSellos } from './dominio/explicar';
import { EscenaVacia, IconoIlustrado } from './ilustraciones';

export const colones = (x: number) => '₡' + Math.round(x).toLocaleString('es-CR').replace(/[., \s]/g, ' ');

export function Barra({ simulado }: { simulado: boolean }) {
  return (
    <header className="barra">
      <span className="marca"><Logo />Canasta sana</span>
      {simulado && <Etiqueta tipo="simulado">SIMULADO</Etiqueta>}
    </header>
  );
}

export function Boton(props: { tipo?: 'primario' | 'secundario'; onClick?: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className={`boton ${props.tipo ?? 'primario'}`} onClick={props.onClick} disabled={props.disabled}>
      {props.children}
    </button>
  );
}

export function Etiqueta({ tipo, children }: { tipo: 'listo' | 'duda' | 'simulado' | 'beneficio' | 'alerta' | 'bajo' | 'medio' | 'alto'; children: ReactNode }) {
  return <span className={`etiqueta ${tipo}`}>{children}</span>;
}

/** Ícono y color (pares de contraste ya validados) de cada nutriente. Decorativo: el nombre va en texto. */
const ICONO_SELLO: Record<TipoSello, [NombreIcono, CategoriaVisual]> = {
  azucares: ['azucar', 'snack'], sodio: ['sal', 'bebida'], saturadas: ['gota', 'salsa'], grasas: ['gota', 'cereal'],
  trans: ['gota', 'carne'], edulcorantes: ['ejemplo', 'lacteo'],
};

/** Por qué el producto lleva cada sello: su dato, el umbral de la OPS y cuánto tiene este producto. */
export function ExplicacionSellos({ producto, sellos }: { producto: Producto; sellos: TipoSello[] }) {
  const { items, nota } = explicarSellos(producto, sellos);
  if (!items.length) return null;
  return (
    <div className="explicacion">
      <p className="rotulo">Por qué lleva {items.length === 1 ? 'este sello' : 'estos sellos'}:</p>
      <ul>
        {items.map(x => (
          <li key={x.sello}>
            <span className={`cat chico ${ICONO_SELLO[x.sello][1]}`} aria-hidden="true"><Icono nombre={ICONO_SELLO[x.sello][0]} /></span>
            <span><strong>{x.nutriente}:</strong> {x.texto}{x.nota && <span className="nota"> {x.nota}</span>}</span>
          </li>
        ))}
      </ul>
      {nota && <p className="nota">{nota}</p>}
    </div>
  );
}

/** Sello octagonal negro con texto blanco (modelo OPS). El texto también va como etiqueta accesible. */
export function Sello({ sello }: { sello: TipoSello }) {
  const lineas = TEXTO_SELLO[sello].split('\n');
  const y0 = 40 - (lineas.length - 1) * 6.5;
  return (
    <svg width="80" height="80" viewBox="0 0 80 80" role="img" aria-label={lineas.join(' ').toLowerCase()}>
      <path d="M24 1 L56 1 L79 24 L79 56 L56 79 L24 79 L1 56 L1 24 Z" fill="#000" stroke="#fff" strokeWidth="2" />
      {lineas.map((l, i) => (
        <text key={i} x="40" y={y0 + i * 13} textAnchor="middle" dominantBaseline="middle" fill="#fff"
          fontFamily="var(--fuente)" fontWeight="700" fontSize={l.length > 9 ? 9.5 : 11}>{l}</text>
      ))}
    </svg>
  );
}

export function Tarjeta({ variante, children }: { variante?: 'aviso' | 'borde' | 'exito'; children: ReactNode }) {
  return <section className={`tarjeta ${variante ?? ''}`}>{children}</section>;
}

// ---------------------------------------------------------------- navegación (v0.2)

/** Íconos de línea (24 × 24), decorativos: el texto del botón ya dice qué es. */
type NombreIcono = 'inicio' | 'lista' | 'progreso' | 'ajustes' | 'tiquete' | 'galeria' | 'factura' | 'ejemplo' | 'camara'
  | 'tema' | 'comunidad' | 'candado' | 'info' | 'gota' | 'azucar' | 'sal' | 'codigo' | 'descargar' | 'check' | CategoriaVisual;
const TRAZOS: Record<NombreIcono, ReactNode> = {
  inicio: <path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  lista: <><path d="M9 6h11M9 12h11M9 18h11" /><path d="M3.5 6l1.2 1.2L7 4.8M3.5 12l1.2 1.2L7 10.8M3.5 18l1.2 1.2L7 16.8" /></>,
  progreso: <path d="M3 21h18M6 17v-5M11 17V8M16 17v-8M21 17V5" />,
  ajustes: <><path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1" /><circle cx="15" cy="6" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="18" r="2" /></>,
  tiquete: <path d="M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4" />,
  galeria: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-8 9" /></>,
  factura: <><path d="M7 2h7l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" /><path d="M14 2v5h5M9 13h6M9 17h6" /></>,
  ejemplo: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" />,
  tema: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />,
  comunidad: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><circle cx="17" cy="9" r="2.5" /><path d="M15.5 14.2A5 5 0 0 1 21.5 19" /></>,
  candado: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  gota: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></>,
  camara: <><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" /><circle cx="12" cy="13.5" r="3.5" /></>,
  bebida: <><path d="M10 2h4v3l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V7.5L10 5z" /><path d="M8.5 12h7" /></>,
  lacteo: <><path d="M7 8l2-5h6l2 5v12a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z" /><path d="M7 8h10M10 13h4" /></>,
  snack: <><circle cx="12" cy="12" r="9" /><circle cx="9" cy="10" r=".8" /><circle cx="14.5" cy="8.8" r=".8" /><circle cx="13.5" cy="14.5" r=".8" /><circle cx="8.5" cy="15" r=".8" /></>,
  cereal: <><path d="M12 22V9" /><path d="M12 9c-2-1-3-3-3-6 2 1 3 3 3 6zM12 9c2-1 3-3 3-6-2 1-3 3-3 6zM12 14c-2-.8-3.5-2.3-3.5-4.5 2 .5 3.5 2.3 3.5 4.5zM12 14c2-.8 3.5-2.3 3.5-4.5-2 .5-3.5 2.3-3.5 4.5zM12 19c-2-.8-3.5-2.3-3.5-4.5 2 .5 3.5 2.3 3.5 4.5zM12 19c2-.8 3.5-2.3 3.5-4.5-2 .5-3.5 2.3-3.5 4.5z" /></>,
  salsa: <><path d="M8 3h8v3H8z" /><path d="M7 6h10l1 3v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9z" /><path d="M6 12h12" /></>,
  grano: <><path d="M8.5 4h7l-1.5 3c3 2 4.5 5 4.5 8.5 0 3.5-3 5.5-7 5.5s-7-2-7-5.5C4.5 12 6 9 10 7z" /><path d="M10 7h4" /></>,
  carne: <><path d="M3 12c3-5 9-6 13-3l5-3v12l-5-3c-4 3-10 2-13-3z" /><circle cx="8" cy="11" r=".8" /></>,
  otro: <><path d="M5 8h14l-1 13H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  // v0.2.1: naranja con hoja, zanahoria, cubo de azúcar, salero, código de barras y descarga.
  fruta: <><circle cx="12" cy="14" r="7" /><path d="M12 7V5" /><path d="M12 6.5c1.2-2.6 3.8-3.4 6-2.7-.9 2.4-3.4 3.5-6 2.7z" /><path d="M9.5 12.5h.01M14 15.5h.01M10.5 17h.01" /></>,
  verdura: <><path d="M15.5 8.5c-1.8-1.8-4.6-1.2-6 1L4 20l10.5-5.5c2.2-1.4 2.8-4.2 1-6z" /><path d="M15.5 8.5L19 5M15.5 8.5l.5-4.5M15.5 8.5l4.5-.5" /><path d="M8.5 13.5l1.5 1.5M6.8 16.6l1.2 1.2" /></>,
  azucar: <><path d="M4 8.5L12 4.5l8 4-8 4z" /><path d="M4 8.5v7l8 4 8-4v-7" /><path d="M12 12.5v7" /></>,
  sal: <><path d="M7.5 10h9l1 10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" /><path d="M7.5 10c0-3.5 2-6.5 4.5-6.5s4.5 3 4.5 6.5" /><path d="M10.5 7h.01M13.5 7h.01M12 5.5h.01" /></>,
  codigo: <><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" /><path d="M7 8v8M10 8v8M13 8v8M17 8v8" /></>,
  descargar: <><path d="M12 4v11M7 10l5 5 5-5" /><path d="M5 20h14" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
};
export function Icono({ nombre }: { nombre: keyof typeof TRAZOS }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {TRAZOS[nombre]}
    </svg>
  );
}

export type Seccion = 'inicio' | 'lista' | 'progreso' | 'ajustes';
const SECCIONES: { id: Seccion; texto: string }[] = [
  { id: 'inicio', texto: 'Inicio' }, { id: 'lista', texto: 'Mi lista' }, { id: 'progreso', texto: 'Progreso' }, { id: 'ajustes', texto: 'Ajustes' },
];

export function Navegacion({ actual, enLista, onIr }: { actual: Seccion; enLista: number; onIr: (s: Seccion) => void }) {
  return (
    <nav className="nav" aria-label="Secciones">
      {SECCIONES.map(s => (
        <button key={s.id} type="button" aria-current={s.id === actual ? 'page' : undefined} onClick={() => onIr(s.id)}>
          <Icono nombre={s.id} />
          {s.texto}
          {s.id === 'lista' && enLista > 0 && <span className="globo" aria-label={`${enLista} en su lista`}>{enLista}</span>}
        </button>
      ))}
    </nav>
  );
}

export const PASOS = ['Leer', 'Revisar', 'Canasta', 'Cambios'] as const;

/** Paso actual del recorrido (1 a 4). Los pasos alcanzables se pueden tocar para volver o avanzar. */
export function Pasos({ actual, alcanzable, onIr }: { actual: number; alcanzable: (paso: number) => boolean; onIr: (paso: number) => void }) {
  return (
    <ol className="pasos" aria-label={`Paso ${actual} de ${PASOS.length}`}>
      {PASOS.map((nombre, i) => {
        const paso = i + 1;
        const estado = paso === actual ? 'actual' : paso < actual ? 'hecho' : 'pendiente';
        return (
          <li key={nombre}>
            <button type="button" className={estado === 'hecho' ? 'hecho' : ''} aria-current={estado === 'actual' ? 'step' : undefined}
              disabled={estado === 'actual' || !alcanzable(paso)} onClick={() => onIr(paso)}>
              <span className="circulo" aria-hidden="true">{estado === 'hecho' ? '✓' : paso}</span>
              {nombre}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

/** Estado vacío o de error: qué pasó y qué puede hacer la persona. */
export function Vacio({ titulo, children, icono = 'tiquete' }: { titulo: string; children?: ReactNode; icono?: keyof typeof TRAZOS }) {
  return (
    <section className="tarjeta vacio" aria-live="polite">
      {icono === 'tiquete' || icono === 'lista' || icono === 'progreso' ? <EscenaVacia tipo={icono} /> : <Icono nombre={icono} />}
      <strong style={{ fontSize: '1.25rem' }}>{titulo}</strong>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- estilo de tarjetas (v0.2)

/** Logo: canasta blanca en un cuadro verde, como el ícono de la app. Decorativo (el nombre va al lado en texto). */
export function Logo() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="9" fill="var(--acento)" />
      <path d="M7 12h14l-1.6 9H8.6z" fill="none" stroke="var(--sobre-acento)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M10 12l4-6 4 6" fill="none" stroke="var(--sobre-acento)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Ícono de color según la categoría del producto (solo decorativo: el nombre siempre va en texto). */
export function IconoCategoria({ producto, grande, categoria }: { producto?: Pick<Producto, 'categorias' | 'nombre'>; grande?: boolean; categoria?: CategoriaVisual }) {
  const cat = categoria ?? (producto ? categoriaVisual(producto) : 'otro');
  return <span className={`cat ${cat}${grande ? ' grande' : ''}`} aria-hidden="true"><IconoIlustrado cat={cat} /></span>;
}

/** Anillo con una sola proporción y el número grande al centro (p. ej. % del gasto con sellos).
 *  La descripción completa va como texto accesible; el anillo es solo apoyo visual. */
export function Anillo({ porcentaje, texto, descripcion, nivel, children }: { porcentaje: number; texto: string; descripcion: string; nivel?: 'bajo' | 'medio' | 'alto'; children?: ReactNode }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, porcentaje));
  return (
    <div className={`anillo ${nivel ?? ''}`}>
      <svg viewBox="0 0 128 128" role="img" aria-label={descripcion}>
        <circle className="pista" cx="64" cy="64" r={r} fill="none" strokeWidth="14" />
        {p > 0 && <circle className="arco" cx="64" cy="64" r={r} fill="none" strokeWidth="14" strokeLinecap="round"
          strokeDasharray={`${(p / 100) * c} ${c}`} transform="rotate(-90 64 64)" style={{ ['--largo' as string]: (p / 100) * c }} />}
        <text className={`valor${texto.length > 4 ? ' largo' : ''}`} x="64" y="64" textAnchor="middle" dominantBaseline="central">{texto}</text>
      </svg>
      {children && <div>{children}</div>}
    </div>
  );
}

/** Título de sección con ícono de color (como las tarjetas de las referencias). El ícono es decorativo. */
export function TituloSeccion({ icono, color, id, children }: { icono: NombreIcono; color: CategoriaVisual; id?: string; children: ReactNode }) {
  return (
    <div className="encabezado-producto">
      <span className={`cat ${color}`} aria-hidden="true"><Icono nombre={icono} /></span>
      <h2 id={id}>{children}</h2>
    </div>
  );
}
