// Ilustraciones de Canasta sana (v0.2.5, D-22 y D-27): frutas, verduras, objetos y escenas en SVG propio.
// Un solo estilo para todo («el mismo hilo»):
//   - la luz viene de arriba a la derecha (donde está el sol de la portada);
//   - cada pieza lleva degradado de volumen, sombra propia (oclusión) abajo a la izquierda, luz rebotada en el borde
//     de sombra, brillo especular arriba a la derecha, contorno fino del mismo tono y sombra de contacto en el suelo;
//   - textura propia: poros de la naranja, vetas de la manzana, semillas de la fresa, venas de las hojas, botones del
//     brócoli, gajos y vesículas de la media naranja, cáscara rugosa del aguacate.
// Los degradados viven una sola vez en el documento (<DefinicionesIlustraciones />, en main.tsx): cada dibujo los
// usa con url(#il-…), sin repetirlos. Todo es decorativo (aria-hidden): el texto de la pantalla dice lo importante.
// Las animaciones viven en estilos.css, duran ≤ 5 s y se apagan con «reducir movimiento» o «Quitar las animaciones».
import type { ReactNode } from 'react';
import type { CategoriaVisual } from './dominio/visual';

const u = (id: string) => `url(#il-${id})`;
type Parada = [number, string, number?];
const paradas = (ps: Parada[]) => ps.map(([o, c, a], i) => <stop key={i} offset={o} stopColor={c} stopOpacity={a ?? 1} />);
const radial = (id: string, ps: Parada[], cx = '68%', cy = '28%', r = '80%') =>
  <radialGradient key={id} id={`il-${id}`} cx={cx} cy={cy} r={r}>{paradas(ps)}</radialGradient>;
const lineal = (id: string, ps: Parada[], x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  <linearGradient key={id} id={`il-${id}`} x1={x1} y1={y1} x2={x2} y2={y2}>{paradas(ps)}</linearGradient>;

/** Degradados de todas las ilustraciones. Se dibuja una vez (main.tsx); no ocupa lugar ni se anuncia. */
export function DefinicionesIlustraciones() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }} aria-hidden="true" focusable="false">
      <defs>
        {radial('naranja', [[0, '#FFE3A8'], [0.3, '#FFB547'], [0.68, '#F7901C'], [1, '#CF6408']])}
        {radial('pulpa-naranja', [[0, '#FFD27A'], [0.6, '#FFA53A'], [1, '#F2871C']], '50%', '45%', '60%')}
        {radial('manzana', [[0, '#FFB8AC'], [0.32, '#F7655A'], [0.7, '#D93A30'], [1, '#A11E16']])}
        {radial('fresa', [[0, '#FFA3A3'], [0.38, '#F4515E'], [0.75, '#C9243C'], [1, '#911528']])}
        {radial('uva', [[0, '#E9D2FF'], [0.35, '#B48AF0'], [0.75, '#7B52C2'], [1, '#4E2E8C']], '66%', '30%', '75%')}
        {radial('brocoli', [[0, '#C6EEA8'], [0.45, '#7CC765'], [1, '#3D8A39']])}
        {radial('aguacate', [[0, '#86AE57'], [0.55, '#4C7A2C'], [1, '#2A4718']])}
        {radial('pulpa', [[0, '#FCFBD2'], [0.55, '#E6EE9C'], [1, '#A9C964']], '50%', '55%', '62%')}
        {radial('hueso', [[0, '#E6B582'], [0.5, '#A9663A'], [1, '#6A3818']])}
        {radial('sol', [[0, '#FFF8D6'], [0.55, '#FFE680'], [1, '#FFC83D']], '40%', '35%', '70%')}
        {radial('halo-sol', [[0, '#FFF1B8', 0.95], [0.55, '#FFEFB0', 0.35], [1, '#FFEFB0', 0]], '50%', '50%', '50%')}
        {radial('resplandor', [[0, '#FFFFFF', 0.85], [0.6, '#FFFFFF', 0.3], [1, '#FFFFFF', 0]], '50%', '50%', '50%')}
        {radial('brillo', [[0, '#FFFFFF', 0.95], [0.5, '#FFFFFF', 0.45], [1, '#FFFFFF', 0]], '50%', '50%', '50%')}
        {radial('oclusion', [[0, '#3A1500', 0], [0.55, '#3A1500', 0], [1, '#3A1500', 0.38]], '70%', '25%', '95%')}
        {radial('oclusion-verde', [[0, '#0E3010', 0], [0.5, '#0E3010', 0], [1, '#0E3010', 0.42]], '70%', '25%', '95%')}
        {radial('suelo', [[0, '#1F2240', 0.26], [0.6, '#1F2240', 0.1], [1, '#1F2240', 0]], '50%', '50%', '50%')}
        {radial('vidrio', [[0, '#FFFFFF', 0.95], [0.6, '#EEF0FF', 0.55], [1, '#C9CFFA', 0.7]], '35%', '30%', '75%')}
        {radial('sello', [[0, '#FFF3B5'], [0.6, '#FFD54A'], [1, '#E2A514']], '38%', '32%', '75%')}
        {radial('sello-azul', [[0, '#C3C9FF'], [0.55, '#7C88EC'], [1, '#4652C4']], '38%', '30%', '75%')}
        {radial('galleta', [[0, '#F8D9A0'], [0.6, '#E2AC5E'], [1, '#B8792F']])}
        {radial('carne', [[0, '#F6C08A'], [0.55, '#D98A4E'], [1, '#A9572A']])}
        {radial('pan', [[0, '#F9D49A'], [0.55, '#D9954B'], [1, '#A8622A']])}
        {radial('frijol', [[0, '#D9877A'], [1, '#6E2C22']], '62%', '30%', '75%')}
        {lineal('banano', [[0, '#FFF4B0'], [0.5, '#F9D54A'], [1, '#E2A91A']])}
        {lineal('zanahoria', [[0, '#D45E14'], [0.55, '#FF9A3C'], [1, '#FFBE70']], 0, 0, 1, 0)}
        {lineal('hoja', [[0, '#BDEFA6'], [1, '#3E8C3C']], 1, 0, 0, 1)}
        {lineal('hoja-oscura', [[0, '#8AD47F'], [1, '#2C6B2C']], 1, 0, 0, 1)}
        {lineal('tallo', [[0, '#9CC97F'], [0.6, '#D8F0C4'], [1, '#B5DB9B']], 0, 0, 1, 0)}
        {lineal('madera', [[0, '#5A3A20'], [1, '#9A6A40']], 0, 0, 1, 0)}
        {lineal('tazon-cuerpo', [[0, '#FFFFFF'], [0.45, '#F1F3FF'], [1, '#BDC4F3']], 1, 0, 0, 1)}
        {lineal('tazon-interior', [[0, '#AEB6EE'], [1, '#E9ECFF']])}
        {lineal('tazon-labio', [[0, '#D6DBFA'], [0.65, '#FFFFFF'], [1, '#F4F5FF']], 0, 0, 1, 0)}
        {lineal('papel', [[0, '#FFFFFF'], [1, '#E7EAF7']], 1, 0, 0, 1)}
        {lineal('escaner', [[0, '#8F9BFF', 0], [0.5, '#6F7CF0'], [1, '#8F9BFF', 0]], 0, 0, 1, 0)}
        {lineal('metal', [[0, '#F7F8FC'], [0.5, '#C4C9DD'], [1, '#9CA2BC']], 1, 0, 0, 1)}
        {lineal('periwinkle', [[0, '#B4BDFF'], [1, '#5462D4']], 1, 0, 0, 1)}
        {lineal('kraft', [[0, '#F3D9A8'], [1, '#C4935A']], 1, 0, 0, 1)}
        {lineal('vidrio-botella', [[0, '#BFD9F5', 0.95], [0.6, '#F4FAFF', 0.95], [1, '#D3E6FA', 0.95]], 0, 0, 1, 0)}
        {lineal('jugo', [[0, '#FFB347'], [1, '#EE7410']])}
        {lineal('salsa', [[0, '#A9231A'], [0.6, '#E8473A'], [1, '#F06A5C']], 0, 0, 1, 0)}
        {lineal('carton', [[0, '#FFFFFF'], [1, '#E1E5FA']], 1, 0, 0, 1)}
        {lineal('carton-lado', [[0, '#C9CFF0'], [1, '#AEB6E6']])}
        {lineal('saco', [[0, '#F0DAB0'], [1, '#BF9861']], 1, 0, 0, 1)}
        {lineal('barra', [[0, '#C7CDFF'], [1, '#8F9BFF']])}
        {lineal('barra-fuerte', [[0, '#9AA5FF'], [1, '#5462D4']])}
      </defs>
    </svg>
  );
}

// Puntos repartidos en espiral (ángulo áureo): poros, semillas y texturas siempre iguales, sin azar.
function espiral(n: number, radio: number, desde = 0.12): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const r = radio * Math.sqrt(desde + (1 - desde) * ((i + 0.5) / n));
    const a = i * 2.399963;
    return [Number((r * Math.cos(a)).toFixed(2)), Number((r * Math.sin(a)).toFixed(2))];
  });
}
const POROS = espiral(46, 14).filter(([x, y]) => Math.hypot(x - 6.5, y + 7.5) > 4.2);
const MOTAS_AGUACATE = espiral(26, 15, 0.55);
// Semillas de la fresa: filas escalonadas dentro de la silueta (ancho que se angosta hacia la punta).
const SEMILLAS: [number, number][] = [];
for (let fila = 0, y = -6; y <= 10.5; y += 3.3, fila++) {
  const ancho = 10.5 * (1 - ((y + 6) / 21) ** 1.5);
  for (let x = -ancho + (fila % 2 ? 2.2 : 0.6); x <= ancho - 0.6; x += 4.2) SEMILLAS.push([Number(x.toFixed(2)), Number(y.toFixed(2))]);
}

type Pieza = { x: number; y: number; s?: number; r?: number; ani?: string; sombra?: boolean; children?: ReactNode };

/** Coloca una pieza: el grupo de fuera la ubica (atributo transform) y el de dentro la anima (CSS).
 *  La sombra de contacto queda en el suelo y no se mueve con la pieza. */
function Lugar({ x, y, s = 1, r = 0, ani, sombra, children, ancho = 13 }: Pieza & { ancho?: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      {sombra && <ellipse cx="0" cy="17.5" rx={ancho} ry="3.4" fill={u('suelo')} />}
      <g className={ani}>{children}</g>
    </g>
  );
}

/** Hoja con degradado, nervio central, venas y borde de luz. */
const Hoja = ({ d, vena, ani = 'ani-mece', origen = '0% 100%', oscura }: { d: string; vena?: string; ani?: string; origen?: string; oscura?: boolean }) => (
  <g className={ani} style={{ transformOrigin: origen }}>
    <path d={d} fill={u(oscura ? 'hoja-oscura' : 'hoja')} stroke="#2F6E2E" strokeOpacity=".4" strokeWidth=".8" strokeLinejoin="round" />
    {vena && <path d={vena} fill="none" stroke="#2F6E2E" strokeOpacity=".45" strokeWidth=".9" strokeLinecap="round" />}
    {vena && <path d={vena} fill="none" stroke="#E9FFDF" strokeOpacity=".35" strokeWidth=".4" strokeLinecap="round" transform="translate(.4 -.4)" />}
  </g>
);

const Brillo = ({ x, y, s = 1, clase = '', color = '#FFD44D' }: { x: number; y: number; s?: number; clase?: string; color?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path className={`ani-brillo ${clase}`} d="M0 -7c.6 3.6 2.4 5.4 7 7-4.6 1.6-6.4 3.4-7 7-.6-3.6-2.4-5.4-7-7 4.6-1.6 6.4-3.4 7-7z" fill={color} />
  </g>
);

export const Naranja = (o: Pieza) => (
  <Lugar {...o}>
    <circle r="16" fill={u('naranja')} />
    <circle r="16" fill={u('oclusion')} />
    {POROS.map(([x, y]) => {
      const luz = x - y > 6;
      return <circle key={`${x},${y}`} cx={x} cy={y} r={luz ? 0.72 : 0.62} fill={luz ? '#FFE9BF' : '#B4500A'} opacity={luz ? 0.65 : 0.32} />;
    })}
    <path d="M-14.2 6.6A16 16 0 0 0 3 15.7" fill="none" stroke="#FFC981" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
    <circle r="16" fill="none" stroke="#B9560A" strokeOpacity=".35" />
    <ellipse cx="6.5" cy="-7.5" rx="5.8" ry="3.4" fill={u('brillo')} transform="rotate(38 6.5 -7.5)" />
    <circle cx="11" cy="-2.6" r="1" fill="#fff" opacity=".75" />
    <g transform="translate(.6 -15.1)">
      <circle r="2" fill="#7D8F2E" />
      <path d="M0 0l-2.6-.6M0 0l2.4-1M0 0l-.6 2.2M0 0l1.8 1.6" stroke="#5E6E1E" strokeWidth=".9" strokeLinecap="round" />
    </g>
    <Hoja d="M1.6 -15.6c3-8.6 11.6-10.6 17.2-7.1-3.2 7.5-10.7 9.7-17.2 7.1z" vena="M1.6 -15.6c5-3.2 10-5.3 17.2-7.1M6 -17.7l1.9-3M10.6 -19.5l1.4-2.6M8.2 -16.8l2.6 1M12.8 -18.6l2.2.8" />
  </Lugar>
);

export const MediaNaranja = (o: Pieza & { gota?: boolean }) => {
  const gajos = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    return `M0 0L${(13.2 * Math.cos(a)).toFixed(2)} ${(6.8 * Math.sin(a)).toFixed(2)}`;
  }).join('');
  const vesiculas = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 + Math.PI / 10;
    return [(8 * Math.cos(a)).toFixed(2), (4.1 * Math.sin(a)).toFixed(2)];
  });
  return (
    <Lugar {...o} ancho={15}>
      <ellipse cx="0" cy="4" rx="16.6" ry="10.6" fill={u('naranja')} />
      <ellipse cx="0" cy="4" rx="16.6" ry="10.6" fill={u('oclusion')} />
      <ellipse cx="0" cy="0" rx="16.6" ry="8.9" fill="#F58A1F" stroke="#C25A00" strokeOpacity=".35" />
      <ellipse cx="0" cy="0" rx="15" ry="7.9" fill="#FFF0CF" />
      <ellipse cx="0" cy="0" rx="13.4" ry="6.95" fill={u('pulpa-naranja')} />
      {vesiculas.map(([x, y]) => <ellipse key={`${x},${y}`} cx={x} cy={y} rx="2.4" ry=".9" fill="#FFD27F" opacity=".75" transform={`rotate(${(Math.atan2(Number(y) * 1.9, Number(x)) * 180) / Math.PI} ${x} ${y})`} />)}
      <path d={gajos} stroke="#FFF0CF" strokeWidth=".95" strokeLinecap="round" />
      <ellipse cx="0" cy="0" rx="2" ry="1.1" fill="#FFF0CF" />
      <ellipse cx="5.5" cy="-2.8" rx="4" ry="1.4" fill={u('brillo')} />
      {o.gota && <path className="ani-gota" d="M10 2.8s2.6 3.2 2.6 5a2.6 2.6 0 0 1-5.2 0c0-1.8 2.6-5 2.6-5z" fill="#FFC56B" stroke="#E8891C" strokeOpacity=".55" strokeWidth=".6" />}
    </Lugar>
  );
};

export const Manzana = (o: Pieza) => {
  const silueta = 'M0 -11c-4-4-12-3-15 3-5 9 1 21 8 23 3 1 5 0 7-1 2 1 4 2 7 1 7-2 13-14 8-23-3-6-11-7-15-3z';
  return (
    <Lugar {...o}>
      <path d={silueta} fill={u('manzana')} />
      <path d={silueta} fill={u('oclusion')} />
      <path d="M3 -9c4 4 6.5 10 5.5 18M6.5 -8.6c3 3.6 5.2 8 5 13M-3 -9c-3.4 4.6-5.4 10.4-4 17" fill="none" stroke="#FFD7C9" strokeOpacity=".32" strokeWidth=".8" strokeLinecap="round" />
      <path d="M-13.4 9c2 5 5.6 7.6 8.8 7.8" fill="none" stroke="#FF9A8C" strokeWidth="1.3" strokeLinecap="round" opacity=".5" />
      <ellipse cx="0" cy="-9.4" rx="4.2" ry="1.7" fill="#7E140E" opacity=".45" />
      <path d={silueta} fill="none" stroke="#9E1B14" strokeOpacity=".35" />
      <ellipse cx="7.2" cy="-2.6" rx="3" ry="5.6" fill={u('brillo')} transform="rotate(18 7.2 -2.6)" />
      <circle cx="9.6" cy="4.4" r=".9" fill="#fff" opacity=".7" />
      <path d="M0 -10.5c0-4 1-7.2 3.2-9.4" fill="none" stroke={u('madera')} strokeWidth="2.3" strokeLinecap="round" />
      <Hoja d="M2.8 -17.2c4.2-5.4 10.6-5.4 13.6-2-4.2 4.2-9.4 5.2-13.6 2z" vena="M2.8 -17.2c4-1.4 8.6-2.2 13.6-2M7 -18.2l1.2-1.8M10.6 -18.8l1-1.6" />
    </Lugar>
  );
};

export const Fresa = (o: Pieza) => {
  const silueta = 'M0 14c-8-4-13-12-12-18 1-5 6-7 12-5 6-2 11 0 12 5 1 6-4 14-12 18z';
  return (
    <Lugar {...o} ancho={9}>
      <path d={silueta} fill={u('fresa')} />
      <path d={silueta} fill={u('oclusion')} />
      {SEMILLAS.map(([x, y]) => (
        <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
          <ellipse rx=".95" ry="1.2" fill="#B31F33" opacity=".35" />
          <ellipse rx=".62" ry=".92" fill={x - y > 2 ? '#FFF0A6' : '#F2D366'} />
        </g>
      ))}
      <path d={silueta} fill="none" stroke="#8E1426" strokeOpacity=".35" />
      <ellipse cx="6" cy="-1.4" rx="2" ry="3.8" fill={u('brillo')} transform="rotate(22 6 -1.4)" />
      <path d="M-10 -7.6l4.6 1.4 1.4-4.6 3.4 3.2 3.4-3.2 1.6 4.6 4.6-1.4-2.6 4.2c-4 .8-9 .8-13.8 0z" fill={u('hoja-oscura')} stroke="#2C6B2C" strokeOpacity=".4" strokeWidth=".7" strokeLinejoin="round" />
      <path d="M-6 -5.2l3.4-1.2M2.6 -6.4l3.6 1.2" stroke="#D9F5C9" strokeOpacity=".45" strokeWidth=".5" strokeLinecap="round" />
      <path d="M0 -9.4c0-2 .6-3.6 1.6-4.6" fill="none" stroke="#4E8B3A" strokeWidth="1.7" strokeLinecap="round" />
    </Lugar>
  );
};

export const Banano = (o: Pieza) => (
  <Lugar {...o} ancho={18}>
    <path d="M-22 0c9 9 33 9 43-5 2 1 2 4 0 7-13 13-35 13-44 2-1-2 0-4 1-4z" fill={u('banano')} stroke="#C99A12" strokeOpacity=".55" />
    <path d="M-21 3.4c10 9 30 8 41-1.6-11 10.6-31 11.6-41 1.6z" fill="#D9A21E" opacity=".45" />
    <path d="M-18 4c10 6 26 5 36-4" fill="none" stroke="#D9A91E" strokeOpacity=".55" strokeWidth="1" strokeLinecap="round" />
    <path d="M-9 2.4c6 3 13 3 19 0" fill="none" stroke="#FFFBE0" strokeOpacity=".8" strokeWidth="1.6" strokeLinecap="round" />
    <g fill="#8A5A22" opacity=".45"><circle cx="-6" cy="6.6" r=".55" /><circle cx="4" cy="7" r=".5" /><circle cx="11" cy="4.6" r=".55" /><circle cx="-13" cy="5" r=".45" /></g>
    <path d="M-22 1l-2.4-1.6" stroke="#5A3A20" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M21 -5l3.2-2.2" stroke={u('madera')} strokeWidth="2.6" strokeLinecap="round" />
  </Lugar>
);

export const Zanahoria = (o: Pieza) => (
  <Lugar {...o} ancho={5}>
    <path d="M-6.2 -15c4.2-2.2 8.2-2.2 12.4 0L1.3 19.2c-.6 1.7-2 1.7-2.6 0z" fill={u('zanahoria')} stroke="#B9530C" strokeOpacity=".4" />
    <path d="M-4.4 -8.4q2.2 1 4.2 0M.8 -2.2q2.2 1 4 0M-3.4 4.6q1.8.9 3.4 0M.6 10.4q1.4.7 2.6 0M-4.8 -12.6q1.6.6 3 0" fill="none" stroke="#B9530C" strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" />
    <path d="M2.6 -12v14" stroke="#FFE1B8" strokeOpacity=".6" strokeWidth="1.3" strokeLinecap="round" />
    <Hoja d="M0 -15c-4.2-6.2-3.2-12.2 0-14.6 2.2 5.2 2.2 10.2 0 14.6z" vena="M0 -15v-13" origen="50% 100%" oscura />
    <Hoja d="M0 -15c1-7.2 6.2-11.2 10.4-10.2-1 5.2-5.2 9.2-10.4 10.2z" vena="M0 -15c3-3.4 6.4-6.8 10.4-10.2" ani="ani-mece lenta" />
    <Hoja d="M0 -15c-2-7.2-7.2-10.2-10.4-9.2 1 5.2 5.2 8.2 10.4 9.2z" vena="M0 -15c-3-3.2-6.4-6.2-10.4-9.2" ani="ani-mece inversa" origen="100% 100%" />
  </Lugar>
);

export const Brocoli = (o: Pieza) => {
  const ramos: [number, number, number][] = [[-9, -3, 7], [9, -3, 7], [0, -8.5, 8.5], [-5, 1.2, 6], [5, 1.2, 6]];
  return (
    <Lugar {...o} ancho={11}>
      <path d="M-4.2 3h8.4l-1.5 14c-.2 1.3-5.2 1.3-5.4 0z" fill={u('tallo')} stroke="#4E8B3A" strokeOpacity=".4" />
      <path d="M0 4.4l-5.4-5.4M0 4.4l5.4-5.4M0 5v-6" stroke="#A8D58E" strokeWidth="2.1" strokeLinecap="round" />
      <path d="M1.6 6v9" stroke="#F2FBEA" strokeOpacity=".55" strokeWidth=".9" strokeLinecap="round" />
      {ramos.map(([cx, cy, r]) => (
        <g key={`${cx},${cy}`}>
          <circle cx={cx} cy={cy} r={r} fill={u('brocoli')} stroke="#3A7E36" strokeOpacity=".35" />
          {espiral(9, r * 0.75, 0.2).map(([x, y]) => (
            <circle key={`${x},${y}`} cx={cx + x} cy={cy + y} r={r * 0.17} fill={x - y > 0 ? '#D8F5BF' : '#2F6E2E'} opacity={x - y > 0 ? 0.5 : 0.3} />
          ))}
        </g>
      ))}
      <circle cx="0" cy="-3" r="13.5" fill={u('oclusion-verde')} opacity=".6" />
      <ellipse cx="4.5" cy="-12.5" rx="3.6" ry="1.8" fill={u('brillo')} />
    </Lugar>
  );
};

export const Aguacate = (o: Pieza) => {
  const piel = 'M0 -18c7 0 10 8 11 16 1 9-4 16-11 16s-12-7-11-16c1-8 4-16 11-16z';
  return (
    <Lugar {...o} ancho={10}>
      <path d={piel} fill={u('aguacate')} stroke="#1E3812" strokeOpacity=".45" />
      {MOTAS_AGUACATE.map(([x, y]) => <circle key={`${x},${y}`} cx={x * 0.7} cy={y * 0.95 - 1} r=".45" fill="#1E3812" opacity=".45" />)}
      <path d="M0 -15.2c5 0 8 6 8.6 13 .8 7.6-3.2 13-8.6 13s-9.4-5.4-8.6-13c.6-7 3.6-13 8.6-13z" fill={u('pulpa')} />
      <path d="M0 -15.2c5 0 8 6 8.6 13 .8 7.6-3.2 13-8.6 13s-9.4-5.4-8.6-13c.6-7 3.6-13 8.6-13z" fill="none" stroke="#9CBF5A" strokeWidth="1.1" />
      <ellipse cx="-.6" cy="4.4" rx="6.2" ry="6" fill="#6B8E2E" opacity=".25" />
      <circle cx="0" cy="3" r="5.7" fill={u('hueso')} />
      <ellipse cx="2" cy="1" rx="1.9" ry="1.2" fill="#fff" opacity=".55" transform="rotate(30 2 1)" />
      <ellipse cx="4.6" cy="-8" rx="1.6" ry="3.2" fill={u('brillo')} />
    </Lugar>
  );
};

export const Uvas = (o: Pieza) => {
  const granos: [number, number][] = [[-5.5, -6], [0.5, -7.2], [6.4, -5.6], [-8.2, 0], [-2.2, -0.8], [3.8, -0.2], [9, 0.8], [-5, 5.8], [1, 5.6], [6.2, 6.6], [-1.6, 11.2], [3.8, 12]];
  return (
    <Lugar {...o} ancho={9}>
      <path d="M0.6 -11.5c0-3 .8-5 2.6-6.4" fill="none" stroke={u('madera')} strokeWidth="1.8" strokeLinecap="round" />
      <path d="M3.2 -17.6c2.4-.6 3.6.8 3 2.4" fill="none" stroke="#6E8F3A" strokeWidth=".9" strokeLinecap="round" />
      <Hoja d="M1.4 -12c-3.6-5.6-10-6.6-13.2-3.4 3.2 4.4 8.6 5.8 13.2 3.4z" vena="M1.4 -12c-3.8-1.8-8.6-3-13.2-3.4M-4.6 -14.4l-.6-2M-8.2 -15.2l-1-1.4" ani="ani-mece inversa" origen="100% 100%" />
      {granos.map(([x, y]) => (
        <g key={`${x},${y}`}>
          <circle cx={x} cy={y} r="4.3" fill={u('uva')} stroke="#4B2C80" strokeOpacity=".3" />
          <ellipse cx={x + 1.5} cy={y - 1.6} rx="1.4" ry=".9" fill="#fff" opacity=".7" transform={`rotate(-30 ${x + 1.5} ${y - 1.6})`} />
        </g>
      ))}
    </Lugar>
  );
};

const Sol = ({ x, y, r = 24 }: { x: number; y: number; r?: number }) => (
  <g transform={`translate(${x} ${y})`}>
    <circle r={r * 1.9} fill={u('halo-sol')} />
    <g className="ani-gira">
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="-1.7" y={-(r + 12)} width="3.4" height="7.5" rx="1.7" fill="#FFE27A" opacity={i % 2 ? 0.6 : 0.9} transform={`rotate(${i * 30})`} />
      ))}
    </g>
    <circle r={r} fill={u('sol')} />
    <circle r={r} fill="none" stroke="#F2B829" strokeOpacity=".35" />
    <ellipse cx={-r * 0.32} cy={-r * 0.36} rx={r * 0.34} ry={r * 0.2} fill="#fff" opacity=".45" transform={`rotate(-30 ${-r * 0.32} ${-r * 0.36})`} />
  </g>
);

/** Tazón de cerámica: interior (detrás de las frutas) y cuerpo con labio, franja, puntos, reflejo y pie (delante). */
// El borde del tazón es una elipse: la mitad de atrás (arriba) queda detrás de las frutas y la de adelante (abajo)
// las tapa. El cuerpo empieza en esa mitad de adelante, así las frutas se ven hasta el labio, como en un tazón real.
const TazonFondo = ({ x, y, w }: { x: number; y: number; w: number }) => {
  const r = w / 2, ry = w * 0.085;
  const atras = `M${x - r} ${y}A${r} ${ry} 0 0 1 ${x + r} ${y}`;
  return (
    <g>
      <ellipse cx={x} cy={y} rx={r} ry={ry} fill={u('tazon-interior')} />
      <ellipse cx={x - w * 0.06} cy={y + w * 0.02} rx={w * 0.38} ry={w * 0.05} fill="#8F9BEA" opacity=".25" />
      <path d={atras} fill="none" stroke={u('tazon-labio')} strokeWidth="3.4" />
      <path d={atras} fill="none" stroke="#8F9BEA" strokeWidth=".9" strokeOpacity=".8" />
    </g>
  );
};
const TazonFrente = ({ x, y, w }: { x: number; y: number; w: number }) => {
  const r = w / 2, ry = w * 0.085;
  const d = w * 0.32;   // hondura del tazón, desde el centro del borde
  const adelante = `M${x - r} ${y}A${r} ${ry} 0 0 0 ${x + r} ${y}`;
  const cuerpo = `${adelante}c0 ${d * 0.75}-${r * 0.55} ${d}-${r} ${d}S${x - r} ${y + d * 0.75} ${x - r} ${y}z`;
  const punto = (k: number) => y + d * 0.56 - Math.abs(k) * d * 0.14;
  return (
    <g>
      <ellipse cx={x} cy={y + d + 1} rx={r * 0.34} ry={w * 0.03} fill={u('tazon-cuerpo')} stroke="#9AA5EE" strokeWidth="1" />
      <path d={cuerpo} fill={u('tazon-cuerpo')} />
      <path d={cuerpo} fill={u('oclusion')} opacity=".35" />
      <path d={`M${x - r * 0.96} ${y + d * 0.3}c${r * 0.5} ${d * 0.3} ${r * 1.42} ${d * 0.3} ${r * 1.92} 0`} fill="none" stroke={u('periwinkle')} strokeWidth="6.5" strokeLinecap="round" />
      <path d={`M${x - r * 0.93} ${y + d * 0.2}c${r * 0.5} ${d * 0.3} ${r * 1.36} ${d * 0.3} ${r * 1.86} 0`} fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1" strokeLinecap="round" />
      <g>{[-0.6, -0.3, 0, 0.3, 0.6].map(k => (
        <g key={k}>
          <circle cx={x + r * k} cy={punto(k)} r="2.4" fill={u('sello')} />
          <circle cx={x + r * k + 0.7} cy={punto(k) - 0.7} r=".7" fill="#fff" opacity=".8" />
        </g>
      ))}</g>
      <path d={cuerpo} fill="none" stroke="#8F9BEA" strokeWidth="1.4" />
      <path d={`M${x + r * 0.8} ${y + d * 0.42}c${-r * 0.08} ${d * 0.22} ${-r * 0.26} ${d * 0.38} ${-r * 0.46} ${d * 0.46}`} fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" opacity=".9" />
      <path d={`M${x + r * 0.62} ${y + d * 0.7}c${-r * 0.06} ${d * 0.08} ${-r * 0.14} ${d * 0.13} ${-r * 0.22} ${d * 0.17}`} fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      <path d={adelante} fill="none" stroke={u('tazon-labio')} strokeWidth="3.4" />
      <path d={adelante} fill="none" stroke="#8F9BEA" strokeWidth=".9" strokeOpacity=".8" />
    </g>
  );
};

/** Tiquete de papel con sombra, encabezado, líneas de productos con su punto de color, total y borde dentado. */
const Tiquete = ({ x, y, w, h, filas }: { x: number; y: number; w: number; h: number; filas: number }) => {
  const dientes = Math.round(w / 5);
  const paso = w / dientes;
  const borde = `l-${(paso / 2).toFixed(2)} 4l-${(paso / 2).toFixed(2)} -4`.repeat(dientes);
  const silueta = `M${x} ${y + 6}a6 6 0 0 1 6-6h${w - 12}a6 6 0 0 1 6 6v${h}${borde}z`;
  const colores = ['#FA9E35', '#EC5146', '#7CC765', '#F2C93A', '#B48AF0', '#E8701A'];
  return (
    <g>
      <ellipse cx={x + w / 2 - 4} cy={y + h + 10} rx={w * 0.55} ry="5" fill={u('suelo')} />
      <path d={silueta} fill={u('papel')} stroke="#C9CEF2" strokeWidth="1.2" transform="translate(3 3)" opacity=".5" />
      <path d={silueta} fill={u('papel')} stroke="#C9CEF2" strokeWidth="1.2" />
      <circle cx={x + 12} cy={y + 13} r="4.5" fill={u('periwinkle')} />
      <rect x={x + 20} y={y + 10} width={w * 0.45} height="6" rx="3" fill="#C9CEF2" />
      {Array.from({ length: filas }, (_, i) => {
        const fy = y + 26 + i * ((h - 40) / filas);
        return (
          <g key={i}>
            <circle cx={x + 11} cy={fy + 3} r="2.8" fill={colores[i % colores.length]} />
            <rect x={x + 18} y={fy} width={w * (0.38 + ((i * 7) % 5) * 0.04)} height="6" rx="3" fill="#E1E4F5" />
            <rect x={x + w - 20} y={fy} width="12" height="6" rx="3" fill="#D3D7F2" />
          </g>
        );
      })}
      <rect x={x + 8} y={y + h - 10} width={w - 16} height="1.4" fill="#C9CEF2" />
      <rect x={x + 8} y={y + h - 5} width={w * 0.3} height="6" rx="3" fill="#AEB6FF" />
      <rect x={x + w - 26} y={y + h - 5} width="18" height="6" rx="3" fill="#8F9BFF" />
      <path d={`M${x + w - 2} ${y + 10}v${h - 14}`} stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".8" />
    </g>
  );
};

const Escena = ({ vista, clase, children }: { vista: string; clase: string; children: ReactNode }) => (
  <svg className={`escena ${clase}`} viewBox={vista} aria-hidden="true" focusable="false">{children}</svg>
);

/** Portada: sol con halo, resplandor, ramas de hojas, tazón con frutas y verduras, y frutas en la mesa. */
export function EscenaInicio() {
  return (
    <Escena vista="0 0 300 170" clase="escena-inicio">
      <ellipse cx="150" cy="104" rx="128" ry="72" fill={u('resplandor')} />
      <Sol x={248} y={42} />
      <g transform="translate(34 136)">
        <Hoja d="M0 0c-8-18-2-38 14-48 6 16 2 36-14 48z" vena="M0 0c3-15 7-31 14-48M2.8-14l6-3.6M4.6-25l6.6-2.8M7-35l5.2-1.8" ani="ani-mece lenta" />
        <Hoja d="M2 0c8-12 22-16 32-12-6 12-18 16-32 12z" vena="M2 0c10-4 20-8 32-12M12-4l1-4M20-7l.6-3.6" oscura />
      </g>
      <g transform="translate(274 140)">
        <Hoja d="M0 0c6-17 0-33-14-41-6 15 0 31 14 41z" vena="M0 0c-3-13-7-27-14-41M-2.6-12l-6-2.4M-5-23l-6.4-1.4" ani="ani-mece inversa" origen="100% 100%" />
      </g>
      <ellipse cx="150" cy="161" rx="84" ry="7.5" fill={u('suelo')} />
      <TazonFondo x={150} y={118} w={140} />
      <Banano x={148} y={80} s={1.25} r={-10} ani="ani-flota d4" />
      <Brocoli x={110} y={98} s={1.15} ani="ani-flota d3" />
      <Zanahoria x={194} y={90} s={1.15} r={24} ani="ani-flota d2" />
      <Naranja x={140} y={104} s={1.3} ani="ani-flota d1" />
      <Manzana x={175} y={107} s={1.18} ani="ani-flota d2" />
      <Uvas x={116} y={112} s={0.88} ani="ani-flota d4" />
      <TazonFrente x={150} y={118} w={140} />
      <MediaNaranja x={50} y={150} s={1.1} gota sombra ani="ani-flota d4" />
      <Fresa x={234} y={152} s={1.05} sombra ani="ani-flota d1" />
      <Fresa x={250} y={157} s={0.82} r={18} sombra ani="ani-flota d3" />
      <Aguacate x={274} y={145} s={0.88} r={14} sombra ani="ani-flota d3" />
      <Brillo x={64} y={42} s={1.1} />
      <Brillo x={205} y={20} s={0.75} clase="d2" />
      <Brillo x={96} y={26} s={0.6} clase="d4" color="#AEB6FF" />
    </Escena>
  );
}

/** «Leyendo su tiquete…»: el tiquete se escanea y aparecen las frutas que se van reconociendo. */
export function EscenaLeyendo() {
  return (
    <Escena vista="0 0 240 160" clase="escena-leyendo">
      <path className="il-fondo" d="M20 110c-4-44 30-84 84-88 46-3 96 18 112 58 12 30-2 64-30 72H44c-14-8-22-24-24-42z" />
      <Tiquete x={62} y={12} w={84} h={120} filas={6} />
      <g className="ani-escanea">
        <rect x="56" y="22" width="96" height="16" fill="#8F9BFF" opacity=".14" />
        <rect x="56" y="20" width="96" height="3.6" rx="1.8" fill={u('escaner')} />
      </g>
      <Naranja x={188} y={42} s={0.95} sombra ani="ani-asoma d0" />
      <Uvas x={206} y={88} s={0.85} sombra ani="ani-asoma d1" />
      <Zanahoria x={182} y={124} s={0.9} r={30} ani="ani-asoma d2" />
      <Brillo x={40} y={36} s={0.9} />
      <Brillo x={224} y={18} s={0.7} clase="d3" color="#AEB6FF" />
    </Escena>
  );
}

/** «¡Buena compra!»: tazón con frutas, una marca que se dibuja sola y hojitas que caen. */
export function EscenaExito() {
  return (
    <Escena vista="0 0 220 130" clase="escena-exito">
      <path className="il-fondo" d="M18 92c-4-34 22-64 62-68 36-4 52 10 80 6 30-4 50 18 50 44 0 22-12 40-30 46H40c-14-6-21-16-22-28z" />
      {[[40, 0], [70, 1], [150, 2], [182, 3], [110, 4]].map(([x, d]) => (
        <g key={x} transform={`translate(${x} 10)`}>
          <path className={`ani-cae d${d}`} d="M0 0c3-4 8-4 10-1-3 3-7 4-10 1z" fill={d % 2 ? '#FFD44D' : u('hoja')} />
        </g>
      ))}
      <ellipse cx="100" cy="122" rx="62" ry="5.5" fill={u('suelo')} />
      <TazonFondo x={100} y={86} w={104} />
      <Brocoli x={80} y={68} s={1} ani="ani-flota d2" />
      <Naranja x={102} y={72} s={1.05} ani="ani-flota d1" />
      <Manzana x={124} y={74} s={0.95} ani="ani-flota d3" />
      <Uvas x={88} y={80} s={0.7} ani="ani-flota d4" />
      <TazonFrente x={100} y={86} w={104} />
      <g transform="translate(172 50)">
        <circle r="23" fill={u('halo-sol')} opacity=".7" />
        <circle r="19" fill={u('sello-azul')} />
        <circle r="19" fill="none" stroke="#fff" strokeOpacity=".6" strokeWidth="2" />
        <ellipse cx="6" cy="-8" rx="6" ry="3" fill="#fff" opacity=".35" transform="rotate(30 6 -8)" />
        <path className="ani-dibuja" d="M-8.5 0l5.8 5.8 11.4-12.4" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" pathLength="1" />
      </g>
      <Brillo x={198} y={22} s={0.8} clase="d2" />
      <Brillo x={34} y={44} s={0.7} color="#AEB6FF" />
    </Escena>
  );
}

/** Estados vacíos: tiquete con lupa y fresa, lista con zanahoria, o barras de progreso con manzana. */
export function EscenaVacia({ tipo }: { tipo: 'tiquete' | 'lista' | 'progreso' }) {
  return (
    <Escena vista="0 0 180 110" clase="escena-vacia">
      <path className="il-fondo" d="M14 80c-4-30 20-58 56-62 30-3 46 8 70 4 22-3 36 14 36 36 0 20-10 34-26 40H34c-12-4-19-10-20-18z" />
      <ellipse cx="90" cy="102" rx="54" ry="4.5" fill={u('suelo')} />
      {tipo === 'tiquete' && <>
        <Tiquete x={52} y={14} w={60} h={74} filas={4} />
        <g className="ani-flota d2">
          <path d="M128 66l13 13" stroke={u('madera')} strokeWidth="7" strokeLinecap="round" />
          <path d="M128 66l13 13" stroke="#fff" strokeOpacity=".25" strokeWidth="2" strokeLinecap="round" transform="translate(1 -1)" />
          <circle cx="116" cy="54" r="15" fill={u('vidrio')} opacity=".55" />
          <circle cx="116" cy="54" r="15" fill="none" stroke={u('metal')} strokeWidth="4.5" />
          <path d="M108 46a11 11 0 0 1 9-4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".9" />
        </g>
        <Fresa x={146} y={86} s={0.9} sombra ani="ani-flota d1" />
      </>}
      {tipo === 'lista' && <>
        <g transform="translate(58 14)">
          <rect x="-4" y="-2" width="66" height="88" rx="9" fill={u('periwinkle')} />
          <rect x="-4" y="-2" width="66" height="88" rx="9" fill="none" stroke="#fff" strokeOpacity=".3" />
          <rect x="3" y="8" width="52" height="72" rx="5" fill={u('papel')} />
          <rect x="17" y="-6" width="24" height="12" rx="6" fill={u('metal')} stroke="#9CA2BC" strokeWidth=".8" />
          <circle cx="29" cy="0" r="2.2" fill="#8F95AE" />
          {[20, 36, 52].map((y, i) => (
            <g key={y}>
              <circle cx="14" cy={y + 3} r="5" fill={i === 0 ? u('sello-azul') : '#fff'} stroke="#AEB6FF" strokeWidth="1.5" />
              {i === 0 && <path d="M11.5 23l2 2 3.5-4" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />}
              <rect x="23" y={y} width={[26, 22, 18][i]} height="6" rx="3" fill="#E1E4F5" />
            </g>
          ))}
        </g>
        <Zanahoria x={138} y={70} s={1.1} r={18} ani="ani-flota d2" />
        <Fresa x={42} y={86} s={0.82} sombra ani="ani-flota d4" />
      </>}
      {tipo === 'progreso' && <>
        {[[56, 54, 'barra'], [78, 40, 'barra'], [100, 26, 'barra-fuerte']].map(([x, h, g], i) => (
          <g key={x as number} className={`ani-sube d${i}`}>
            <rect x={x as number} y={96 - (h as number)} width="17" height={h as number} rx="5" fill={u(g as string)} />
            <rect x={(x as number) + 3} y={99 - (h as number)} width="4" height={(h as number) - 8} rx="2" fill="#fff" opacity=".35" />
          </g>
        ))}
        <Manzana x={109} y={52} s={0.85} ani="ani-flota d1" />
        <Naranja x={142} y={84} s={0.8} sombra ani="ani-flota d3" />
      </>}
      <Brillo x={34} y={34} s={0.7} />
      <Brillo x={152} y={22} s={0.6} clase="d3" color="#AEB6FF" />
    </Escena>
  );
}

/** Íconos ilustrados de las formas de empezar (inicio), con la misma luz y textura que las frutas.
 *  galería = fotos impresas con un bodegón de naranja · factura = sobre con el tiquete y un sello ·
 *  ejemplo = naranja y fresa con brillos · pegar = portapapeles con nota. Decorativos. */
export function IconoOpcion({ tipo }: { tipo: 'galeria' | 'factura' | 'ejemplo' | 'pegar' }) {
  return (
    <svg className="icono-opcion" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="36.5" rx="14" ry="2.4" fill={u('suelo')} />
      {tipo === 'galeria' && <>
        <g transform="rotate(-9 20 20)">
          <rect x="7" y="8" width="25" height="24" rx="3.5" fill={u('periwinkle')} opacity=".85" />
        </g>
        <g transform="rotate(6 20 21)">
          <rect x="7" y="8.5" width="26" height="25" rx="3.5" fill={u('papel')} stroke="#AEB6FF" strokeWidth="1" />
          <rect x="9.6" y="11" width="20.8" height="16" rx="2" fill="#DDE2FF" />
          <circle cx="25" cy="15" r="2.6" fill={u('sol')} />
          <rect x="9.6" y="23.5" width="20.8" height="3.5" fill="#C3CAF5" />
          <g transform="translate(17 21.4) scale(.36)">
            <circle r="16" fill={u('naranja')} />
            <circle r="16" fill={u('oclusion')} />
            <ellipse cx="6.5" cy="-7.5" rx="5.8" ry="3.4" fill={u('brillo')} transform="rotate(38 6.5 -7.5)" />
            <path d="M1.6 -15.6c3-8.6 11.6-10.6 17.2-7.1-3.2 7.5-10.7 9.7-17.2 7.1z" fill={u('hoja')} />
          </g>
          <path d="M31 12v18" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
        </g>
      </>}
      {tipo === 'factura' && <>
        <path d="M11.5 4.5h12.5l5 5v18h-17.5z" fill={u('papel')} stroke="#AEB6FF" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M24 4.5v5h5" fill="#DDE2FF" stroke="#AEB6FF" strokeWidth="1.2" strokeLinejoin="round" />
        <circle cx="15.5" cy="12" r="1.6" fill="#FA9E35" /><rect x="18.5" y="11" width="6.5" height="2.2" rx="1.1" fill="#D3D7F2" />
        <circle cx="15.5" cy="16.4" r="1.6" fill="#7CC765" /><rect x="18.5" y="15.3" width="8" height="2.2" rx="1.1" fill="#D3D7F2" />
        <circle cx="15.5" cy="20.8" r="1.6" fill="#EC5146" /><rect x="18.5" y="19.7" width="5.5" height="2.2" rx="1.1" fill="#D3D7F2" />
        <path d="M5 20l15 9.6L35 20v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3z" fill={u('periwinkle')} />
        <path d="M5 20l15 9.6L35 20" fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="1.1" strokeLinejoin="round" />
        <path d="M5.8 33.8L16.6 26.4M34.2 33.8L23.4 26.4" stroke="#3E49B0" strokeOpacity=".45" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M31.5 22.4v10.6" stroke="#fff" strokeOpacity=".45" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M28.4 13.6l-1.6 5 2.4-1 1.6 2.2.6-5.4zM33.6 13.6l1.6 5-2.4-1-1.6 2.2-.6-5.4z" fill="#E2A514" />
        <circle cx="31" cy="10" r="5.6" fill={u('sello')} stroke="#C99212" strokeOpacity=".5" />
        <path d="M28.6 10.1l1.7 1.7 3.2-3.4" fill="none" stroke="#7A5600" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="32.6" cy="7.8" r=".9" fill="#fff" opacity=".8" />
      </>}
      {tipo === 'ejemplo' && <>
        <Naranja x={17} y={21} s={0.74} ani="ani-flota d1" />
        <Fresa x={29.5} y={27.5} s={0.5} r={14} ani="ani-flota d3" />
        <Brillo x={33} y={8} s={0.6} />
        <Brillo x={6} y={10} s={0.42} clase="d2" color="#8F9BFF" />
      </>}
      {tipo === 'pegar' && <>
        <rect x="7.5" y="6.5" width="25" height="29.5" rx="4" fill={u('periwinkle')} />
        <rect x="7.5" y="6.5" width="25" height="29.5" rx="4" fill="none" stroke="#fff" strokeOpacity=".35" />
        <rect x="10.5" y="10.5" width="19" height="23" rx="2" fill={u('papel')} />
        <path d="M13 16h14M13 20h10.5M13 24h12.5" stroke="#C9CEF2" strokeWidth="1.9" strokeLinecap="round" />
        <rect x="14" y="3.5" width="12" height="7" rx="3.5" fill={u('metal')} stroke="#9CA2BC" strokeWidth=".8" />
        <circle cx="20" cy="6.2" r="1.3" fill="#8F95AE" />
        <path d="M22 25.5h10v6l-4 4h-6z" fill="#FFE27A" stroke="#E3B526" strokeOpacity=".7" strokeWidth=".8" strokeLinejoin="round" />
        <path d="M32 31.5h-4v4z" fill="#F2C842" />
        <path d="M24.5 29h5" stroke="#9A7210" strokeOpacity=".55" strokeWidth="1.2" strokeLinecap="round" />
      </>}
    </svg>
  );
}

/** Ícono ilustrado de cada categoría de producto (en las listas): mismo estilo y misma luz. Decorativo. */
export function IconoIlustrado({ cat }: { cat: CategoriaVisual }) {
  return (
    <svg className="icono-ilustrado" viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      <ellipse cx="20" cy="36.6" rx="12" ry="2.2" fill={u('suelo')} />
      {cat === 'fruta' && <Naranja x={19} y={21.5} s={0.78} />}
      {cat === 'verdura' && <Zanahoria x={20} y={19.5} s={0.82} r={28} />}
      {cat === 'bebida' && <>
        <path d="M16 3.5h8v4l3 4v21.5a3 3 0 0 1-3 3h-8a3 3 0 0 1-3-3V11.5l3-4z" fill={u('vidrio-botella')} stroke="#7FA8D8" strokeWidth="1" />
        <path d="M13.6 16h12.8v17a2.4 2.4 0 0 1-2.4 2.4h-8a2.4 2.4 0 0 1-2.4-2.4z" fill={u('jugo')} />
        <rect x="15" y="1.5" width="10" height="4" rx="1.5" fill={u('periwinkle')} />
        <rect x="13.6" y="21" width="12.8" height="8" fill="#fff" opacity=".88" />
        <g transform="translate(20 25) scale(.2)"><circle r="16" fill={u('naranja')} /><path d="M1.6 -15.6c3-8.6 11.6-10.6 17.2-7.1-3.2 7.5-10.7 9.7-17.2 7.1z" fill={u('hoja')} /></g>
        <path d="M23.8 10v24" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" opacity=".75" />
      </>}
      {cat === 'lacteo' && <>
        <path d="M24 11l6-4v26l-6 3z" fill={u('carton-lado')} />
        <path d="M10 11h14v25H10z" fill={u('carton')} stroke="#AEB6E6" strokeWidth=".9" />
        <path d="M10 11l3-6h14l3 2-6 4z" fill="#E9ECFF" stroke="#AEB6E6" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M13 5l-1-2.6h11.4L27 5z" fill="#F6F7FF" stroke="#AEB6E6" strokeWidth=".8" />
        <rect x="10" y="18" width="14" height="10" fill={u('periwinkle')} />
        <path d="M17 20s2.6 3 2.6 4.6a2.6 2.6 0 0 1-5.2 0c0-1.6 2.6-4.6 2.6-4.6z" fill="#fff" transform="translate(0 -.4)" />
        <path d="M22 13v21" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".8" />
      </>}
      {cat === 'snack' && <>
        <path d="M20 5.5a14 14 0 1 0 13.4 10c-1.6 1.2-4.2.8-5.2-1.2-2.2.4-4.4-1.6-3.8-4-2.4-.6-3.6-3-2.6-4.8A14 14 0 0 0 20 5.5z" fill={u('galleta')} stroke="#9A6225" strokeOpacity=".45" />
        <path d="M20 5.5a14 14 0 1 0 13.4 10c-1.6 1.2-4.2.8-5.2-1.2-2.2.4-4.4-1.6-3.8-4-2.4-.6-3.6-3-2.6-4.8A14 14 0 0 0 20 5.5z" fill={u('oclusion')} />
        {[[13, 14], [19, 23], [12, 25], [24, 28], [26, 20], [17, 31]].map(([x, y]) => (
          <g key={`${x},${y}`}><ellipse cx={x} cy={y} rx="2" ry="1.6" fill="#5A3418" /><circle cx={x + 0.6} cy={y - 0.6} r=".5" fill="#fff" opacity=".5" /></g>
        ))}
        <g fill="#C98A3E" opacity=".6"><circle cx="15" cy="19" r=".5" /><circle cx="22" cy="16" r=".5" /><circle cx="21" cy="30" r=".45" /></g>
        <ellipse cx="25" cy="11" rx="2.6" ry="1.4" fill={u('brillo')} transform="rotate(40 25 11)" />
      </>}
      {cat === 'cereal' && <>
        <path d="M6 30c0-9 5-16 14-16s14 7 14 16v2.5a2.5 2.5 0 0 1-2.5 2.5h-23A2.5 2.5 0 0 1 6 32.5z" fill={u('pan')} stroke="#8E4E1E" strokeOpacity=".45" />
        <path d="M6 30c0-9 5-16 14-16s14 7 14 16v2.5a2.5 2.5 0 0 1-2.5 2.5h-23A2.5 2.5 0 0 1 6 32.5z" fill={u('oclusion')} />
        <path d="M12 22l3.2 2.6M18 18.6l3.4 2.6M24.6 18.8l3 2.8" stroke="#F9E2BC" strokeWidth="1.6" strokeLinecap="round" />
        <ellipse cx="26" cy="19.6" rx="4" ry="1.6" fill={u('brillo')} transform="rotate(25 26 19.6)" />
        <g transform="translate(29 13) rotate(20)">
          <path d="M0 6v-14" stroke="#C99A3A" strokeWidth="1" strokeLinecap="round" />
          {[-6, -3, 0].map(y => <g key={y}><ellipse cx="-1.4" cy={y} rx="1.1" ry="1.9" fill="#E9C35A" transform={`rotate(-25 -1.4 ${y})`} /><ellipse cx="1.4" cy={y} rx="1.1" ry="1.9" fill="#F3D677" transform={`rotate(25 1.4 ${y})`} /></g>)}
        </g>
      </>}
      {cat === 'salsa' && <>
        <path d="M15.5 9h9v4.5c3 1.4 4.5 3.6 4.5 7V33a3 3 0 0 1-3 3H14a3 3 0 0 1-3-3V20.5c0-3.4 1.5-5.6 4.5-7z" fill={u('salsa')} stroke="#8E1A12" strokeOpacity=".45" />
        <rect x="15" y="3" width="10" height="6.5" rx="1.6" fill={u('periwinkle')} />
        <rect x="11" y="21" width="18" height="9" fill="#FFF6D5" />
        <g transform="translate(20 25.5) scale(.22)"><path d="M-10 4c0-8 8-14 10-14s10 6 10 14-4 10-10 10-10-2-10-10z" fill="#EC5146" /><path d="M0 -10c-1-4 2-6 4-6" stroke="#4E8B3A" strokeWidth="3" fill="none" /></g>
        <path d="M25.6 14.6c1.6 1.2 2.2 2.8 2.2 5V32" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
      </>}
      {cat === 'grano' && <>
        <path d="M11 13c-3 5-4 12-3 18a4 4 0 0 0 4 3.5h16a4 4 0 0 0 4-3.5c1-6 0-13-3-18z" fill={u('saco')} stroke="#9A7744" strokeOpacity=".55" />
        <path d="M11 13c-3 5-4 12-3 18a4 4 0 0 0 4 3.5h16a4 4 0 0 0 4-3.5c1-6 0-13-3-18z" fill={u('oclusion')} />
        <path d="M11 13l2.6-5 2.8 3 3.6-4.4 3.4 4.4 2.8-3 2.8 5z" fill="#E6CB98" stroke="#9A7744" strokeOpacity=".5" strokeLinejoin="round" />
        <path d="M11.6 13.4h16.8" stroke="#8E6A3A" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14 18c-1 4-1 9 0 13M20 17v15M26 18c1 4 1 9 0 13" stroke="#B48E58" strokeOpacity=".45" strokeWidth=".8" />
        {[[9, 33.5, -20], [13.5, 35, 15], [29, 34.5, 30]].map(([x, y, a]) => (
          <g key={x}><ellipse cx={x} cy={y} rx="2.4" ry="1.5" fill={u('frijol')} transform={`rotate(${a} ${x} ${y})`} /><ellipse cx={x + 0.6} cy={y - 0.5} rx=".7" ry=".35" fill="#fff" opacity=".5" /></g>
        ))}
        <path d="M27.5 16c1.4 3.4 2 8.6 1.6 13" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" opacity=".45" fill="none" />
      </>}
      {cat === 'carne' && <>
        <g transform="rotate(-35 20 20)">
          <rect x="18" y="20" width="4" height="12" rx="2" fill="#F8F4EC" stroke="#CFC6B6" strokeWidth=".8" />
          <circle cx="17.4" cy="33" r="2.6" fill="#F8F4EC" stroke="#CFC6B6" strokeWidth=".8" />
          <circle cx="22.6" cy="33" r="2.6" fill="#F8F4EC" stroke="#CFC6B6" strokeWidth=".8" />
          <path d="M20 4c7 0 11 5 11 11 0 5-4 7-7 8l-2 1h-4l-2-1c-3-1-7-3-7-8 0-6 4-11 11-11z" fill={u('carne')} stroke="#8E4A22" strokeOpacity=".45" />
          <path d="M20 4c7 0 11 5 11 11 0 5-4 7-7 8l-2 1h-4l-2-1c-3-1-7-3-7-8 0-6 4-11 11-11z" fill={u('oclusion')} />
          <path d="M14 11c1.6-2 4-3 6.4-3" stroke="#FFE2C2" strokeWidth="1.6" strokeLinecap="round" fill="none" opacity=".7" />
          <ellipse cx="25" cy="9" rx="3" ry="1.6" fill={u('brillo')} transform="rotate(35 25 9)" />
        </g>
      </>}
      {cat === 'otro' && <>
        <path d="M14 13V10a6 6 0 0 1 12 0v3" fill="none" stroke="#9A6A3A" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8.5 13h23l-1.6 21.5a2 2 0 0 1-2 1.5H12.1a2 2 0 0 1-2-1.5z" fill={u('kraft')} stroke="#9A6A3A" strokeOpacity=".5" />
        <path d="M8.5 13h23l-1.6 21.5a2 2 0 0 1-2 1.5H12.1a2 2 0 0 1-2-1.5z" fill={u('oclusion')} opacity=".7" />
        <path d="M8.5 13h23v3.4h-23z" fill="#E0BF86" />
        <g transform="translate(24 8) rotate(30)"><path d="M0 0c2-5 7-6 10-4-2 4-6 6-10 4z" fill={u('hoja')} /></g>
        <circle cx="20" cy="24" r="4" fill={u('periwinkle')} />
        <path d="M18.2 24l1.3 1.3 2.6-2.8" fill="none" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M28.8 16.6l-1.2 16" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".5" />
      </>}
    </svg>
  );
}
