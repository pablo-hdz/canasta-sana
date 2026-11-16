// Pruebas de componentes: se dibujan a HTML con react-dom/server (sin navegador ni dependencias extra)
// y se revisa el texto, los estados vacíos y los atributos de accesibilidad.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ExplicacionSellos, Navegacion, Pasos, Sello, Vacio } from './componentes';
import { MiLista } from './pantallas/MiLista';
import { Progreso } from './pantallas/Progreso';
import { Ajustes, resumenTabla } from './pantallas/Ajustes';
import { Proteccion } from './Proteccion';
import { PERFIL_VACIO } from './dominio/cambios';
import { PREFERENCIAS_INICIALES } from './almacen';
import { idCompra, type ResumenCompra } from './dominio/progreso';

const nada = () => undefined;
const html = (el: JSX.Element) => renderToStaticMarkup(el);

describe('Navegación y pasos', () => {
  it('la sección actual se anuncia y la lista muestra cuántos productos faltan', () => {
    const h = html(<Navegacion actual="lista" enLista={3} onIr={nada} />);
    expect(h).toContain('aria-label="Secciones"');
    expect(h).toMatch(/aria-current="page"[^>]*>.*Mi lista/);
    expect(h).toContain('aria-label="3 en su lista"');
    expect(html(<Navegacion actual="inicio" enLista={0} onIr={nada} />)).not.toContain('globo');
  });
  it('pasos: el actual se marca, los anteriores con ✓ y los no alcanzables quedan desactivados', () => {
    const h = html(<Pasos actual={3} alcanzable={p => p <= 3} onIr={nada} />);
    expect(h).toContain('aria-label="Paso 3 de 4"');
    expect(h).toMatch(/aria-current="step"[^>]*>.*Canasta/);
    expect((h.match(/✓/g) ?? []).length).toBe(2);
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>.*?4<\/span>Cambios/);
  });
  it('sello OPS con texto accesible', () => {
    expect(html(<Sello sello="sodio" />)).toContain('aria-label="exceso sodio"');
  });
  it('explicación de los sellos: un punto por sello con su dato y el umbral, en texto (no solo color)', async () => {
    const { prod } = await import('./dominio/fabrica');
    const p = prod({ n: { kcal: 265, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 850 } });
    const h = html(<ExplicacionSellos producto={p} sellos={['sodio']} />).replace(/[  ]/g, ' ');
    expect(h).toContain('Por qué lleva este sello:');
    expect(h).toContain('<span><strong>Sodio:</strong> 850 mg por 100 g. La OPS marca exceso desde 1 mg por cada caloría; este tiene 3,2');
    expect(h).toMatch(/<span class="cat chico bebida" aria-hidden="true">/);   // ícono del salero: decorativo
    expect(html(<ExplicacionSellos producto={p} sellos={[]} />)).toBe('');
  });
  it('estado vacío con título y explicación', () => {
    const h = html(<Vacio titulo="Nada aquí"><p>Haga esto.</p></Vacio>);
    expect(h).toContain('Nada aquí');
    expect(h).toContain('aria-live="polite"');
  });
});

describe('Mi lista', () => {
  it('vacía: explica cómo llenarla', () => {
    const h = html(<MiLista lista={[]} onCambiar={nada} onIrInicio={nada} />);
    expect(h).toContain('Su lista está vacía');
    expect(h).not.toContain('wa.me');
  });
  it('con productos: casillas, enlace de WhatsApp con el texto y aviso de privacidad', () => {
    const h = html(<MiLista onCambiar={nada} onIrInicio={nada} lista={[
      { ean: '1', nombre: 'Leche semidescremada', marca: 'Dos Pinos', enVezDe: 'Choco Leche', hecho: false },
      { ean: '2', nombre: 'Avena', hecho: true },
    ]} />);
    expect(h).toContain('1 por comprar · 1 ya comprado');
    expect(h).toContain('href="https://wa.me/?text=Mi%20lista%20de%20compras');
    expect(h).toContain('rel="noopener noreferrer"');
    expect(h).toContain('Quitar los ya comprados');
    expect(h).toContain('Nada de su tiquete ni de su hogar');
  });
});

describe('Su progreso', () => {
  const c = (fecha: string, ge: number, gs: number): ResumenCompra => ({ id: idCompra(fecha, ge, 3), fecha, empacados: 3, conSellos: 1, gastoEmpacados: ge, gastoConSellos: gs });
  it('sin compras: estado vacío y ejemplo SIMULADO a un toque', () => {
    const h = html(<Progreso compras={[]} />);
    expect(h).toContain('Aún no hay compras guardadas');
    expect(h).toContain('Ver un ejemplo SIMULADO');
  });
  it('dos meses: anuncia la mejora y dibuja una barra por mes con tabla', () => {
    const h = html(<Progreso compras={[c('2026-10-02', 10000, 5000), c('2026-11-02', 10000, 2000)]} />);
    expect(h).toContain('¡Va mejorando!');
    // 20 % es «nivel bajo» (verde); el mes anterior, 50 %, es «medio» (ámbar): el color nunca va sin su etiqueta.
    expect(h).toContain('class="anillo bajo"');
    expect(h).toContain('Nivel bajo');
    expect(h).toContain('class="barra-dato medio"');
    expect(h).toContain('aria-label="oct. 2026: 50 %"');
    expect(h).toContain('aria-label="nov. 2026: 20 %"');
    expect(h).toContain('Ver como tabla');
  });
});

describe('Ajustes', () => {
  const props = {
    perfil: PERFIL_VACIO, onPerfil: nada, prefs: PREFERENCIAS_INICIALES, onPrefs: nada, comunidad: null, estadoComunidad: '',
    onActualizar: nada, datos: { precios: 0, alias: 0, compras: 0, lista: 0 }, onBorrar: nada, onRestaurado: nada, base: { productos: 1235 },
  };
  it('sin servicio: no ofrece aportar ni descargar nada', () => {
    const h = html(<Ajustes {...props} hayServicio={false} />);
    expect(h).toContain('Esta versión funciona sin servidor');
    expect(h).not.toContain('aportar mis precios');
  });
  it('con servicio: todo apagado por defecto y explica qué se envía', () => {
    const h = html(<Ajustes {...props} hayServicio />);
    expect(h).toContain('Ofrecerme aportar mis precios, sin mi nombre');
    expect(h).toContain('usted decide en cada compra');
    expect(h).toContain('Nunca su nombre, su tiquete completo ni su hogar');
    expect(h).not.toMatch(/type="checkbox" checked=""/);   // nada activado sin que la persona lo decida
    expect((h.match(/<option /g) ?? []).length).toBe(85);   // «Sin indicar» + 84 cantones
  });
  it('copia de seguridad: guardar y restaurar, explicando que no se envía a ningún lado', () => {
    const h = html(<Ajustes {...props} hayServicio={false} />);
    expect(h).toContain('Guardar copia');
    expect(h).toMatch(/Restaurar copia<input type="file" accept=".json,application\/json" class="oculto-accesible"/);
    expect(h).toContain('no se envía a ningún lado');
  });
  it('tema: la opción elegida se anuncia como presionada', () => {
    const h = html(<Ajustes {...props} hayServicio={false} prefs={{ ...PREFERENCIAS_INICIALES, tema: 'oscuro' }} />);
    expect(h).toMatch(/aria-pressed="true"[^>]*>Oscuro/);
  });
  it('letra: por defecto la del teléfono; «Más fácil de leer» (Atkinson) se puede elegir y se anuncia', () => {
    expect(html(<Ajustes {...props} hayServicio={false} />)).toMatch(/aria-pressed="true"[^>]*>Como las apps del teléfono/);
    const h = html(<Ajustes {...props} hayServicio={false} prefs={{ ...PREFERENCIAS_INICIALES, letra: 'legible' }} />);
    expect(h).toMatch(/class="muestra-legible" aria-pressed="true"[^>]*>Más fácil de leer/);
    expect(h).toContain('distingue mejor letras parecidas');
  });
  it('«Quitar las animaciones»: sin marcar por defecto y marcado si la persona lo eligió', () => {
    expect(html(<Ajustes {...props} hayServicio={false} />)).toMatch(/<input type="checkbox"\/><span>Quitar las animaciones/);
    expect(html(<Ajustes {...props} hayServicio={false} prefs={{ ...PREFERENCIAS_INICIALES, animaciones: false }} />)).toMatch(/checked=""\/><span>Quitar las animaciones/);
  });
});

describe('Protección ante errores', () => {
  it('sin error muestra la app; con error, un aviso claro y cómo seguir', () => {
    expect(html(<Proteccion><p>la app</p></Proteccion>)).toBe('<p>la app</p>');
    const p = new Proteccion({ children: null });
    p.state = Proteccion.getDerivedStateFromError(new Error('falló X'));
    const h = renderToStaticMarkup(p.render() as JSX.Element);
    expect(h).toContain('role="alert"');
    expect(h).toContain('Sus datos siguen guardados en este teléfono');
    expect(h).toContain('falló X');
    expect(h).toContain('Volver a abrir la app');
  });
});

describe('Estado de la tabla de la comunidad', () => {
  const tabla = (eans: string[]) => ({ desde: '2026-W34', semanas: 12, min_reportes: 3,
    precios: eans.map(ean => ({ ean, cadena: null, canton: null, mediana: 1, p25: 1, p75: 1, n: 3, desde: '', hasta: '' })) });
  it('cuenta productos, no filas, y no repite el punto final', () => {
    const t = resumenTabla({ tabla: tabla(['1', '1', '1', '2']), descargada: '2026-11-14T07:18:00Z' });
    expect(t).toMatch(/^Precios de 2 productos, actualizada el /);
    expect(t).not.toMatch(/\.\.$/);
    expect(resumenTabla({ tabla: tabla([]), descargada: '2026-11-14T07:18:00Z' })).toMatch(/^Todavía no hay precios publicados/);
  });
});

describe('Gráfico de aportes', () => {
  it('el selector de nutriente son botones de alternar, no pestañas a medias', async () => {
    const { GraficoAportes } = await import('./grafico');
    const { prod } = await import('./dominio/fabrica');
    const h = html(<GraficoAportes compra={[{ producto: prod({ ean: '1', nombre: 'Gaseosa', cantidadNum: 600, unidad: 'ml', categorias: ['en:sodas'], ingredientes: 'agua carbonatada, azúcar, colorante caramelo', n: { kcal: 42, azucares: 10.6, sodioMg: 10 } }), unidades: 2 }]} />);
    expect(h).not.toContain('role="tab');
    expect(h).toContain('role="group" aria-label="Nutriente"');
    expect(h).toMatch(/aria-pressed="true"[^>]*>(<span[^>]*><\/span>)?Azúcares/);   // con el punto de color del nutriente
    expect(h).toContain('var(--n-azucares)');
    expect(h).toContain('Gaseosa');
  });
});

describe('B-23: gráfico con el tamaño leído del tiquete', () => {
  it('lo dice en la nota y en la tabla, no solo con un color', async () => {
    const { GraficoAportes } = await import('./grafico');
    const { prod } = await import('./dominio/fabrica');
    const sinTam = prod({ ean: '2', nombre: 'Cappuccino Vainilla', categorias: ['en:sodas'], ingredientes: 'agua, azúcar, café', n: { kcal: 60, azucares: 9 } });
    const h = html(<GraficoAportes compra={[{ producto: sinTam, unidades: 1, tamanoTiquete: { valor: 281, unidad: 'ml' } }]} />);
    expect(h).toContain('1 producto usa el tamaño leído del tiquete porque la base no lo trae.');
    expect(h).toContain('<th>Tamaño</th>');
    expect(h).toContain('281 ml (tamaño leído del tiquete)');
    expect(h).not.toContain('sin tamaño o sin este dato');
  });
});

describe('Consentimiento para aportar precios (RF-16)', () => {
  const envio = [
    { ean: '7411000345023', precio: 1500, cadena: 'Palí', canton: 'Cartago', fecha: '2026-11-13' },
    { ean: '0036000291452', precio: 2950, cadena: 'Palí', canton: 'Cartago', fecha: '2026-11-13' },
  ];
  const nombres = { '7411000345023': 'Salsa Lizano', '0036000291452': 'Café molido' };
  it('muestra exactamente qué se enviaría y pide decidir', async () => {
    const { OfertaAporte } = await import('./pantallas/OfertaAporte');
    // colones() usa espacios que no se parten (₡1 500 no se corta en dos líneas): se normalizan para comparar.
    const h = html(<OfertaAporte envio={envio} nombres={nombres} estado="oferta" onAportar={nada} onRechazar={nada} />).replace(/[\u00a0\u202f]/g, ' ');
    expect(h).toContain('¿Aportar los precios de esta compra?');
    for (const t of ['Salsa Lizano', '7411000345023', '₡1 500', 'Café molido', '₡2 950', 'comercio Palí, cantón Cartago', '13/11/2026']) expect(h).toContain(t);
    expect(h).toContain('Aportar 2 precios');
    expect(h).toContain('No, gracias');
  });
  it('rechazado: desaparece; hecho: agradece; error: permite reintentar', async () => {
    const { OfertaAporte } = await import('./pantallas/OfertaAporte');
    expect(html(<OfertaAporte envio={envio} nombres={nombres} estado="rechazado" onAportar={nada} onRechazar={nada} />)).toBe('');
    expect(html(<OfertaAporte envio={envio} nombres={nombres} estado="hecho" onAportar={nada} onRechazar={nada} />)).toContain('aportó 2 precios');
    const h = html(<OfertaAporte envio={envio} nombres={nombres} estado={{ error: 'sin conexión con el servicio' }} onAportar={nada} onRechazar={nada} />);
    expect(h).toContain('No se pudieron aportar: sin conexión con el servicio');
    expect(h).toContain('Aportar 2 precios');
  });
  it('B-31: cada campo del cuerpo del POST está dicho en la oferta y en Ajustes, y no se dice nada que no salga', async () => {
    const { enviarAportes } = await import('./servicio');
    const { ROTULOS_APORTE, NOTA_FECHA_APORTE } = await import('./dominio/comunidad');
    const { OfertaAporte } = await import('./pantallas/OfertaAporte');
    let cuerpo = '';
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      cuerpo = String(init?.body);
      return new Response(JSON.stringify({ recibidos: 2 }), { status: 200 });
    }) as typeof fetch;
    try { await enviarAportes(envio); } finally { globalThis.fetch = original; }
    const enviado = JSON.parse(cuerpo) as { aportes: Record<string, unknown>[] };
    expect(Object.keys(enviado)).toEqual(['aportes']);
    const campos = [...new Set(enviado.aportes.flatMap(a => Object.keys(a)))].sort();
    // Ni campos que salen sin rótulo, ni rótulos de campos que no salen.
    expect(campos).toEqual(Object.keys(ROTULOS_APORTE).sort());
    const oferta = html(<OfertaAporte envio={envio} nombres={nombres} estado="oferta" onAportar={nada} onRechazar={nada} />).replace(/[  ]/g, ' ');
    // Cómo se ve cada campo en la oferta, con su rótulo y el valor que sale. Un campo nuevo en el cuerpo sin entrada aquí falla.
    const visto: Record<string, string> = {
      ean: `se envía solo el ${ROTULOS_APORTE.ean}`, precio: 'Precio', cadena: `${ROTULOS_APORTE.cadena} Palí`,
      canton: `${ROTULOS_APORTE.canton} Cartago`, fecha: `${ROTULOS_APORTE.fecha}, 13/11/2026 (${NOTA_FECHA_APORTE})`,
    };
    expect(Object.keys(visto).sort()).toEqual(campos);
    for (const c of campos) expect(oferta).toContain(visto[c]);
    for (const a of envio) { expect(oferta).toContain(a.ean); expect(oferta).toContain(`₡${a.precio.toLocaleString('es-CR').replace(/[\s.,  ]/g, ' ')}`); }
    expect(oferta).toContain('la fecha de la compra, 13/11/2026 (el servicio guarda solo la semana)');
    const ajustes = html(<Ajustes perfil={PERFIL_VACIO} onPerfil={nada} prefs={PREFERENCIAS_INICIALES} onPrefs={nada} comunidad={null} estadoComunidad=""
      onActualizar={nada} datos={{ precios: 0, alias: 0, compras: 0, lista: 0 }} onBorrar={nada} onRestaurado={nada} base={{ productos: 1235 }} hayServicio />);
    expect(ajustes).toContain('(código de cada producto, precio, comercio, su cantón si lo elige y la fecha de la compra; el servicio guarda solo la semana)');
    for (const c of campos) expect(ajustes).toContain(ROTULOS_APORTE[c as keyof typeof ROTULOS_APORTE]);
    expect(oferta + ajustes).not.toContain('semana de la compra');
  });
});

describe('Escáner de código de barras en vivo', () => {
  it('antes de abrir la cámara: avisa, se puede cancelar y explica que la imagen no sale del teléfono', async () => {
    const { EscanerCodigo, hayEscanerVivo } = await import('./pantallas/Escaner');
    const h = html(<EscanerCodigo nombre="TAPIT" onCodigo={nada} onCerrar={nada} />);
    expect(h).toContain('aria-label="Escáner del código de barras de TAPIT"');
    expect(h).toContain('role="status">Abriendo la cámara…');
    expect(h).toMatch(/<video[^>]*aria-hidden="true"/);
    expect(h).toContain('class="boton secundario">Cancelar</button>');
    expect(h).toContain('no se guarda ni se envía');
    expect(hayEscanerVivo()).toBe(false);   // sin navegador (ni BarcodeDetector) no se ofrece: queda la foto o escribirlo
  });
  it('si la cámara falla, dice por qué y qué hacer', async () => {
    const { mensajeCamara } = await import('./pantallas/Escaner');
    expect(mensajeCamara({ name: 'NotAllowedError' })).toMatch(/^No se dio permiso para usar la cámara\. Puede tomar una foto/);
    expect(mensajeCamara({ name: 'NotFoundError' })).toMatch(/^No se encontró una cámara/);
    expect(mensajeCamara({ name: 'NotReadableError' })).toMatch(/ocupada por otra app/);
    expect(mensajeCamara({ name: 'SinFormatos' })).toMatch(/no lee códigos de barras/);
    expect(mensajeCamara(new Error('x'))).toBe('No se pudo abrir la cámara (x). Puede escribir el código abajo.');
  });
});

describe('Pegar el texto de una factura', () => {
  it('cuadro con etiqueta accesible y botón desactivado mientras esté vacío', async () => {
    const { PegarTexto } = await import('./pantallas/PegarTexto');
    const h = html(<PegarTexto onRevisar={nada} />);
    expect(h).toContain('Pegar el texto de una factura o tiquete');
    expect(h).toContain('<label for="texto-factura"');
    expect(h).toContain('id="texto-factura"');
    expect(h).toMatch(/<button[^>]*disabled=""[^>]*>Revisar<\/button>/);
    expect(h).toContain('no se envía a ningún lado');
  });
});

describe('Sección de colorantes (D-19)', () => {
  it('marca el colorante, explica la norma con su fuente y no dice «peligroso»', async () => {
    const { SeccionColorantes } = await import('./pantallas/Colorantes');
    const { prod } = await import('./dominio/fabrica');
    const h = html(<SeccionColorantes extra={{}} estado="" onFoto={nada} productos={[
      prod({ ean: '1', nombre: 'Meneitos', ingredientes: 'harina de maíz, aceite, sal, tartrazina, rojo allura', aditivos: [] }),
      prod({ ean: '2', nombre: 'Galleta simple', ingredientes: 'harina de trigo, azúcar, mantequilla, sal', aditivos: [] }),
      prod({ ean: '3', nombre: 'Producto sin datos', ingredientes: '', aditivos: [] }),
    ]} />);
    expect(h).toContain('1 producto lleva');
    expect(h).toContain('tartrazina (E102)');
    expect(h).toContain('rojo allura (rojo 40) (E129)');
    expect(h).toContain('href="https://www.legislation.gov.uk/eur/2008/1333/annex/V"');
    expect(h).toContain('1 producto sin ingredientes en la base');
    expect(h).toContain('aria-label="Foto de los ingredientes de Producto sin datos"');
    expect(h.match(/peligros/g)).toHaveLength(1);   // una sola vez: en la frase que dice que la app NO lo afirma
    expect(h).toContain('La app no dice que un producto sea peligroso');
  });
  it('sin colorantes y con datos: lo dice; el texto leído con la cámara también cuenta', async () => {
    const { SeccionColorantes } = await import('./pantallas/Colorantes');
    const { prod } = await import('./dominio/fabrica');
    const sinDatos = prod({ ean: '9', nombre: 'Refresco', ingredientes: '', aditivos: [] });
    expect(html(<SeccionColorantes extra={{}} estado="" onFoto={nada} productos={[prod({ ean: '2', ingredientes: 'harina de trigo, azúcar, sal', aditivos: [] })]} />))
      .toContain('Según su etiqueta, ninguno de los 1 productos con ingredientes conocidos declara');
    expect(html(<SeccionColorantes extra={{ 9: 'agua, azúcar, rojo 40' }} estado="" onFoto={nada} productos={[sinDatos]} />))
      .toContain('rojo allura (rojo 40) (E129)');
  });
});

// B-03 (sprint 1): los productos aprendidos se revisan y se olvidan uno por uno en Ajustes.
describe('Productos aprendidos en Ajustes (B-03)', () => {
  const props = { perfil: PERFIL_VACIO, onPerfil: nada, prefs: PREFERENCIAS_INICIALES, onPrefs: nada, comunidad: null, estadoComunidad: '', hayServicio: false,
    onActualizar: nada, datos: { precios: 0, alias: 1, compras: 0, lista: 0 }, onBorrar: nada, onRestaurado: nada, base: { productos: 1235 } };
  it('cada uno dice a qué producto apunta y tiene su botón «Olvidar»; sin aprendidos no aparece la lista', () => {
    const h = html(<Ajustes {...props} aprendidos={[{ clave: 'GUAVA JAM SW', ean: '7441000409067', nombre: 'Jamón de Pechuga de Pavo · Cinta Azul' }]} />);
    expect(h).toContain('Revisar los productos aprendidos (1)');
    expect(h).toContain('«GUAVA JAM SW» → Jamón de Pechuga de Pavo · Cinta Azul');
    expect(h).toContain('aria-label="Olvidar «GUAVA JAM SW»"');
    expect(html(<Ajustes {...props} />)).not.toContain('Revisar los productos aprendidos');
  });
});

// B-02 (sprint 1): desde D-23 la app no sugiere un producto ni un precio. Ningún texto que se dibuja lo promete.
describe('Textos honestos (B-02, D-23)', () => {
  const PROMESAS = /mismo precio|sin gastar más|no cuesten más|no más caros|precio igual o menor|cambios? más sanos|cambios fáciles|producto de reemplazo|Agregar a mi lista|(?<!no )\b(sugiere|sugieren|sugerimos)\b/i;
  const sinComentarios = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  it('ni la portada, ni las pantallas, ni los metadatos prometen productos o precios', async () => {
    const { readFileSync } = await import('node:fs');
    const { Sustituir } = await import('./pantallas/Sustituir');
    const { SeccionColorantes } = await import('./pantallas/Colorantes');
    const { ordenarParaSustituir } = await import('./dominio/sustituir');
    const { evaluar } = await import('./dominio/ops');
    const { prod } = await import('./dominio/fabrica');
    const g = prod({ ean: '1', nombre: 'Galleta rellena', categorias: ['en:biscuits'], ingredientes: 'harina, azúcar, aceite de palma, leche',
      n: { kcal: 480, azucares: 35, grasas: 20, saturadas: 9, trans: 0, sodioMg: 300 } });
    const props = { perfil: PERFIL_VACIO, onPerfil: nada, prefs: PREFERENCIAS_INICIALES, onPrefs: nada, comunidad: null, estadoComunidad: '', hayServicio: true,
      onActualizar: nada, datos: { precios: 0, alias: 0, compras: 0, lista: 0 }, onBorrar: nada, onRestaurado: nada, base: { productos: 1235 } };
    const dibujado = [
      html(<Ajustes {...props} />),
      html(<MiLista lista={[]} onCambiar={nada} onIrInicio={nada} />),
      html(<Progreso compras={[]} />),
      html(<Sustituir items={ordenarParaSustituir([{ producto: g, e: evaluar(g), precio: 1500, cantidad: 1 }])} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} />),
      html(<Sustituir items={[]} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} />),
      html(<SeccionColorantes extra={{}} estado="" onFoto={nada} productos={[g]} />),
    ].join('\n');
    // La portada y los demás textos de App.tsx no se pueden dibujar sin navegador: se revisa su código sin comentarios.
    const fuente = ['./App.tsx', '../index.html', '../public/manifest.webmanifest']
      .map(f => sinComentarios(readFileSync(new URL(f, import.meta.url), 'utf8'))).join('\n');
    expect(dibujado.match(PROMESAS)?.[0] ?? null).toBeNull();
    expect(fuente.match(PROMESAS)?.[0] ?? null).toBeNull();
    expect(dibujado).toContain('Busque una opción con');   // sí dice qué buscar (D-23)
    expect(fuente).toContain('cuáles conviene cambiar y qué buscar');
  });
});

// B-06 (sprint 1): el paso 4 muestra primero 3 productos, en el orden de D-23, y «Ver los otros N».
describe('Paso 4 más corto (B-06)', () => {
  const productos = async (n: number) => {
    const { ordenarParaSustituir } = await import('./dominio/sustituir');
    const { evaluar } = await import('./dominio/ops');
    const { prod } = await import('./dominio/fabrica');
    // Sodio de 400 a 400 + 100·(n−1): todos con un sello; a igual número de sellos manda el gasto (D-23).
    return ordenarParaSustituir(Array.from({ length: n }, (_, i) => {
      const p = prod({ ean: String(i + 1), nombre: `Producto ${i + 1}`, n: { kcal: 100, azucares: 0, grasas: 0, saturadas: 0, trans: 0, sodioMg: 400 } });
      return { producto: p, e: evaluar(p), precio: 1000 + i * 100, cantidad: 1 };
    }));
  };
  it('con más de 3: los 3 primeros (los de más gasto) y «Ver los otros N»', async () => {
    const { Sustituir } = await import('./pantallas/Sustituir');
    const h = html(<Sustituir items={await productos(5)} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} />);
    expect((h.match(/class="tarjeta /g) ?? []).length).toBe(3);
    expect(h).toContain('1. Producto 5');
    expect(h).toContain('3. Producto 3');
    expect(h).not.toContain('Producto 2');
    expect(h).toContain('Ver los otros 2');
    expect(h).toContain('5 productos para cambiar');   // el título sigue diciendo el total
  });
  it('con 3 o menos: todos y sin botón', async () => {
    const { Sustituir } = await import('./pantallas/Sustituir');
    const h = html(<Sustituir items={await productos(3)} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} />);
    expect((h.match(/class="tarjeta /g) ?? []).length).toBe(3);
    expect(h).not.toContain('Ver los otros');
  });
});

// B-07 (sprint 1): en el paso 4, el hogar se toma en cuenta solo con hechos del producto.
describe('Avisos del hogar en el paso 4 (B-07)', () => {
  it('con niños y alergia a la leche, lo dice; sin hogar, no; nunca «no contiene»', async () => {
    const { Sustituir } = await import('./pantallas/Sustituir');
    const { ordenarParaSustituir } = await import('./dominio/sustituir');
    const { evaluar } = await import('./dominio/ops');
    const { prod } = await import('./dominio/fabrica');
    const p = prod({ ean: '1', nombre: 'Bebida de fresa', ingredientes: 'leche, azúcar, sucralosa, rojo 40', aditivos: ['en:e955'], alergenos: ['en:milk'],
      n: { kcal: 60, azucares: 9, grasas: 1, saturadas: 0.6, trans: 0, sodioMg: 40 } });
    const items = ordenarParaSustituir([{ producto: p, e: evaluar(p), precio: 900, cantidad: 1 }]);
    const con = html(<Sustituir items={items} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} perfil={{ ninos: true, alergenos: ['en:milk', 'en:peanuts'] }} />);
    expect(con).toContain('aria-label="Avisos de este producto"');
    expect(con).toContain('Lleva edulcorantes: sucralosa (E955).');
    expect(con).toContain('Lleva colorantes de la lista: rojo allura (rojo 40) (E129).');
    expect(con).toContain('La etiqueta declara: leche.');
    expect(con).not.toMatch(/no contiene|maní/i);
    // D-29: sin hogar marcado, edulcorantes y colorantes se avisan igual; la alergia no (nadie la marcó).
    const sinHogar = html(<Sustituir items={items} lista={[]} onCambiarLista={nada} onIrLista={nada} onInicio={nada} />);
    expect(sinHogar).toContain('Lleva edulcorantes: sucralosa (E955).');
    expect(sinHogar).not.toContain('La etiqueta declara');
  });
});

// B-15 (sprint 2): la casilla «Hay niños en la casa» se oculta (sin efecto desde D-29); el dato guardado se conserva.
describe('Casilla de niños oculta (B-15)', () => {
  it('Ajustes no la muestra ni menciona a los niños; las alergias siguen', () => {
    const h = html(<Ajustes perfil={{ ninos: true, alergenos: ['en:milk'] }} onPerfil={nada} prefs={PREFERENCIAS_INICIALES} onPrefs={nada} hayServicio={false}
      comunidad={null} estadoComunidad="" onActualizar={nada} datos={{ precios: 0, alias: 0, compras: 0, lista: 0 }} onBorrar={nada} onRestaurado={nada} base={{ productos: 1 }} />);
    expect(h).not.toMatch(/niños/i);
    expect(h).toContain('Alergias en la casa');
    expect(h).toMatch(/checked=""\/>Leche/);
  });
  it('el dato guardado se conserva (para poder volver atrás)', async () => {
    const almacen = { datos: new Map<string, string>(), getItem(k: string) { return this.datos.get(k) ?? null; }, setItem(k: string, v: string) { this.datos.set(k, v); }, removeItem(k: string) { this.datos.delete(k); } };
    (globalThis as { localStorage?: unknown }).localStorage = almacen;
    const { guardarPerfil, leerPerfil } = await import('./almacen');
    guardarPerfil({ ninos: true, alergenos: ['en:milk'] });
    expect(leerPerfil()).toEqual({ ninos: true, alergenos: ['en:milk'] });
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
});
