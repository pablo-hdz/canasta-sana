import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Precio, Producto } from './dominio/tipos';
import { evaluar } from './dominio/ops';
import { esFresco, fechaDe, leerTiquete, noEsComida, unirTiquetes, type TiqueteLeido } from './dominio/tiquete';
import { PegarTexto } from './pantallas/PegarTexto';
import { leerFacturaXml } from './dominio/factura';
import { identificar, type Identificacion } from './dominio/identificar';
import type { Perfil } from './dominio/cambios';
import { ordenarParaSustituir } from './dominio/sustituir';
import { Sustituir } from './pantallas/Sustituir';
import { esDemostracion, tiqueteSimulado } from './dominio/simulados';
import { precioEstimado } from './dominio/precios';
import { aportes as aportesNutriente, tamanoDelTiquete } from './dominio/aportes';
import { CADENAS, detectarCadena } from './dominio/comercio';
import { normalizarEan } from './dominio/codigos';
import { indexar, precioComunidad, prepararAportes, reportesDeDudosos, type AporteApi } from './dominio/comunidad';
import { TEXTO_NIVEL, idCompra, nivelSellos, porMes, registrar, type ResumenCompra } from './dominio/progreso';
import type { ItemLista } from './dominio/lista';
import { dibujarTiquete, hayLectorDeBarras, leerCodigoDeBarras, leerTexto } from './ocr';
import { textoDePdf } from './pdf';
import { descargarTabla, enviarAportes, enviarReporte, hayServicio } from './servicio';
import {
  aplicarAnimaciones, aplicarLetra, aplicarTema, borrarTodo, guardarAlias, guardarCompras, guardarComunidad, guardarLista, guardarPerfil, guardarPreferencias,
  leerAlias, leerAportadas, leerIngredientesFoto, guardarIngredientesFoto, leerCompras, leerComunidad, leerHistorial, leerLista, leerPerfil, leerPreferencias, sumarAlHistorial,
  guardarAportadas,
  type CacheComunidad, type Historial, type Preferencias,
} from './almacen';
import { Anillo, Barra, Boton, Etiqueta, ExplicacionSellos, Icono, IconoCategoria, Navegacion, Pasos, Sello, Tarjeta, Vacio, colones, type Seccion } from './componentes';
import { saludo } from './dominio/visual';
import { GraficoAportes } from './grafico';
import { ALERGENOS, Ajustes } from './pantallas/Ajustes';
import { MiLista } from './pantallas/MiLista';
import { Progreso } from './pantallas/Progreso';
import { SeccionColorantes } from './pantallas/Colorantes';
import { colorantesDe, listaDeIngredientes } from './dominio/colorantes';
import { OfertaAporte, type EstadoAporte } from './pantallas/OfertaAporte';
import { aprender, aprendidos, olvidar } from './dominio/alias';
import { casoDePrueba, nombreCaso } from './dominio/casoPrueba';
import { EscanerCodigo, hayEscanerVivo } from './pantallas/Escaner';
import { EscenaExito, EscenaInicio, EscenaLeyendo, IconoOpcion } from './ilustraciones';
import { descargarJson } from './descargar';

type Pantalla = 'inicio' | 'leyendo' | 'revisar' | 'canasta' | 'cambios' | Exclude<Seccion, 'inicio'>;
type Origen = 'simulado' | 'foto' | 'factura-xml' | 'factura-pdf' | 'texto';
interface Procedencia { origen: Origen; comercio?: string; fecha?: string; demo?: boolean; cadena?: string }
// seguro: identificado por código de barras, por un alias aprendido o elegido por la persona (no solo por texto).
// codigo: el código de barras impreso en la línea (o en el XML), si lo había.
// noComida: detergente, champú, papel higiénico…: se quita solo de la revisión (la persona lo puede devolver).
// fresco: fruta, verdura, huevo o carne sin empaque: no lleva sellos y no hace falta identificarlo.
interface Item { id: number; descripcion: string; cantidad: number; precio: number; codigo?: string; ident: Identificacion; producto?: Producto; quitado: boolean; seguro: boolean; noComida?: boolean; fresco?: boolean }
interface Base { productos: Producto[]; meta: { descargado?: string; productos?: number; conIA?: number } }
const ACTUALIZAR_COMUNIDAD_MS = 6 * 3600 * 1000;
/** Fecha local (AAAA-MM-DD). toISOString() da la fecha UTC: en Costa Rica, después de las 6 p. m. ya es «mañana». */
const hoyLocal = () => new Date().toLocaleDateString('sv-SE');
const PASO: Partial<Record<Pantalla, number>> = { revisar: 2, canasta: 3, cambios: 4 };
/** Toma el archivo elegido y limpia el selector, para que elegir el mismo archivo otra vez también funcione. */
function archivo(e: { target: HTMLInputElement }): File | undefined {
  const f = e.target.files?.[0];
  e.target.value = '';
  return f;
}

function nuevoItem(id: number, l: { descripcion: string; cantidad: number; precio: number; codigo?: string }, productos: Producto[], alias: Record<string, string>): Item {
  const ident = identificar(l.descripcion, productos, alias, l.codigo);
  const noComida = noEsComida(l.descripcion);
  const fresco = !noComida && esFresco(l.descripcion);
  return {
    id, descripcion: l.descripcion, cantidad: l.cantidad, precio: l.precio, codigo: l.codigo, ident, quitado: noComida || fresco, noComida, fresco,
    producto: ident.dudoso ? undefined : ident.producto, seguro: ident.metodo === 'codigo' || ident.metodo === 'alias',
  };
}

export default function App() {
  const [base, setBase] = useState<Base | null>(null);
  const [error, setError] = useState('');
  const [pantalla, setPantalla] = useState<Pantalla>('inicio');
  const [tiquete, setTiquete] = useState<TiqueteLeido | null>(null);
  const [procedencia, setProcedencia] = useState<Procedencia>({ origen: 'simulado' });
  // Demostraciones (tiquete o factura SIMULADO): sus precios nunca entran al historial ni al progreso.
  const simulado = procedencia.origen === 'simulado' || !!procedencia.demo;
  const [historial, setHistorial] = useState<Historial>(leerHistorial);
  const [avisoParte, setAvisoParte] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [perfil, setPerfil] = useState<Perfil>(leerPerfil);
  const [alias, setAlias] = useState<Record<string, string>>(leerAlias);
  const [prefs, setPrefs] = useState<Preferencias>(leerPreferencias);
  const [lista, setLista] = useState<ItemLista[]>(leerLista);
  const [compras, setCompras] = useState<ResumenCompra[]>(leerCompras);
  const [comunidad, setComunidad] = useState<CacheComunidad | null>(leerComunidad);
  const [estadoComunidad, setEstadoComunidad] = useState('');
  const [ingredientesFoto, setIngredientesFoto] = useState<Record<string, string>>(leerIngredientesFoto);
  const [estadoIngredientes, setEstadoIngredientes] = useState('');
  // Consentimiento por compra (RNF-02, RF-10, RF-16): la oferta muestra qué se enviaría; nada sale sin «Aportar».
  const [oferta, setOferta] = useState<{ id: string; envio: AporteApi[]; nombres: Record<string, string>; estado: EstadoAporte } | null>(null);
  const [avisoAporte, setAvisoAporte] = useState('');
  const [progreso, setProgreso] = useState({ f: 0, estado: '' });
  const [medicion, setMedicion] = useState('');
  const [avisoCaso, setAvisoCaso] = useState('');
  const semilla = useRef(2026);
  // Compras ya aportadas o rechazadas: no se vuelven a ofrecer, ni después de recargar (evita que una persona
  // sola complete los 3 aportes de un grupo subiendo la misma factura varias veces).
  const decididoPara = useRef(new Set<string>(leerAportadas()));
  const primeraVez = useRef(true);

  const cargarBase = useCallback(() => {
    setError('');
    const ruta = (f: string) => `${import.meta.env.BASE_URL}datos/${f}`;
    // ia_jev.json es opcional: estimaciones de Jev sobre la base pública (datos/enriquecer_jev.py, D-15 descartada).
    const ia = fetch(ruta('ia_jev.json')).then(r => (r.ok ? r.json() : null)).catch(() => null);
    fetch(ruta('productos_cr.json'))
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(async (b: Base) => {
        const estim = (await ia) as { productos: Record<string, Producto['ia']> } | null;
        if (estim?.productos) for (const p of b.productos) { const e = estim.productos[p.ean]; if (e) p.ia = e; }
        setBase({ ...b, meta: { ...b.meta, conIA: estim ? Object.keys(estim.productos).length : 0 } });
      })
      .catch(e => setError(`No se pudo cargar la base de productos (${e.message}).`));
  }, []);
  useEffect(cargarBase, [cargarBase]);

  // Al cambiar de pantalla: arriba y foco en el título (lectores de pantalla).
  useEffect(() => {
    window.scrollTo(0, 0);
    if (primeraVez.current) { primeraVez.current = false; return; }
    const h1 = document.querySelector<HTMLElement>('main h1');
    if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
  }, [pantalla]);
  useEffect(() => { aplicarTema(prefs.tema); }, [prefs.tema]);
  useEffect(() => { aplicarLetra(prefs.letra); }, [prefs.letra]);
  useEffect(() => { aplicarAnimaciones(prefs.animaciones); }, [prefs.animaciones]);

  // Precios de la comunidad: solo si la persona lo activó. Se descarga la tabla completa (máx. cada 6 h).
  const actualizarComunidad = useCallback(async (forzar: boolean) => {
    if (!hayServicio || !prefs.usarComunidad) return;
    const previa = leerComunidad();
    if (!forzar && previa && Date.now() - Date.parse(previa.descargada) < ACTUALIZAR_COMUNIDAD_MS) return;
    setEstadoComunidad('Actualizando…');
    try {
      const r = await descargarTabla(previa?.etag);
      const tabla = r.tabla ?? previa?.tabla;
      if (!tabla) throw new Error('respuesta vacía');
      const nueva: CacheComunidad = { tabla, etag: r.etag, descargada: new Date().toISOString() };
      guardarComunidad(nueva); setComunidad(nueva); setEstadoComunidad('');
    } catch (e) {
      setEstadoComunidad(`No se pudo actualizar: ${(e as Error).message}.`);
    }
  }, [prefs.usarComunidad]);
  useEffect(() => { void actualizarComunidad(false); }, [actualizarComunidad]);
  const indice = useMemo(() => (prefs.usarComunidad && comunidad ? indexar(comunidad.tabla) : null), [prefs.usarComunidad, comunidad]);

  const productos = base?.productos ?? [];

  function cargarLeido(t: TiqueteLeido, p: Procedencia) {
    setTiquete(t);
    // Fecha impresa en el texto si no vino aparte (nunca una fecha futura: sería un error de lectura).
    const fechaTexto = p.fecha ?? fechaDe(t.texto);
    const fecha = fechaTexto && fechaTexto <= hoyLocal() ? fechaTexto : undefined;
    setProcedencia({ ...p, fecha, cadena: p.cadena ?? detectarCadena(p.comercio, t.texto), demo: p.demo || esDemostracion(p.comercio, t.texto) });
    setAvisoParte('');
    setAvisoCaso('');
    setOferta(null);
    setAvisoAporte('');
    setItems(t.lineas.map((l, i) => nuevoItem(i, l, productos, alias)));
    setPantalla('revisar');
  }

  async function desdeFoto(f: File | undefined) {
    if (!f) return;
    setPantalla('leyendo');
    try {
      const texto = await leerTexto(f, (x, estado) => setProgreso({ f: x, estado }));
      cargarLeido(leerTiquete(texto), { origen: 'foto' });
    } catch (e) {
      setError(`No se pudo leer la foto: ${(e as Error).message}`);
      setPantalla('inicio');
    }
  }

  /** Tiquete largo: lee otra foto y la une a la actual sin repetir las líneas que se traslapan. */
  async function agregarParte(f: File | undefined) {
    if (!f || !tiquete) return;
    setPantalla('leyendo');
    try {
      const parte = leerTiquete(await leerTexto(f, (x, estado) => setProgreso({ f: x, estado })));
      const unido = unirTiquetes(tiquete, parte);
      const nuevas = unido.lineas.slice(tiquete.lineas.length);
      const desde = items.reduce((m, x) => Math.max(m, x.id), -1) + 1;
      setTiquete(unido);
      setItems(xs => [...xs, ...nuevas.map((l, i) => nuevoItem(desde + i, l, productos, alias))]);
      setAvisoParte(`Se agregó la otra parte: ${nuevas.length} ${nuevas.length === 1 ? 'producto nuevo' : 'productos nuevos'}${unido.traslape ? ` y ${unido.traslape} repetidos que no se contaron dos veces` : ''}.`);
    } catch (e) {
      setAvisoParte(`No se pudo leer la otra parte: ${(e as Error).message}`);
    }
    setPantalla('revisar');
  }

  async function desdeFactura(f: File | undefined) {
    if (!f) return;
    setError('');
    try {
      if (/\.xml$/i.test(f.name) || f.type.includes('xml')) {
        const fac = leerFacturaXml(await f.text());
        cargarLeido(fac, { origen: 'factura-xml', comercio: fac.comercio, fecha: fac.fecha });
      } else {
        setPantalla('leyendo');
        setProgreso({ f: 0.5, estado: 'Leyendo el PDF' });
        cargarLeido(leerTiquete(await textoDePdf(f)), { origen: 'factura-pdf' });
      }
    } catch (e) {
      setError(`No se pudo leer la factura: ${(e as Error).message}`);
      setPantalla('inicio');
    }
  }

  /** Guarda en el historial los precios reales de esta compra, solo si el total cuadra (lectura confiable). */
  function guardarPrecios() {
    if (simulado || !tiquete?.cuadra) return;
    const nuevos: Historial = {};
    for (const it of items) if (it.producto && !it.quitado) {
      if (!(it.cantidad > 0)) continue;
      nuevos[it.producto.ean] = { colones: it.precio / it.cantidad, fuente: 'historial', fecha: procedencia.fecha ?? hoyLocal(), comercio: procedencia.cadena ?? procedencia.comercio };
    }
    setHistorial(sumarAlHistorial(nuevos));
  }

  function simular() {
    const t = tiqueteSimulado(productos, semilla.current++, 12);
    cargarLeido(leerTiquete(t.texto), { origen: 'simulado' });
  }

  async function medirOcr() {
    const t = tiqueteSimulado(productos, semilla.current++, 12);
    setMedicion('Midiendo… (la primera vez descarga el lector de español)');
    const texto = await leerTexto(dibujarTiquete(t.texto), (x, estado) => setMedicion(`${estado}: ${Math.round(x * 100)} %`));
    const leido = leerTiquete(texto);
    const precios = new Set(t.verdad.map(v => v.precio));
    const ok = leido.lineas.filter(l => precios.has(l.precio)).length;
    setMedicion(`OCR sobre un tiquete SIMULADO dibujado: ${leido.lineas.length} de ${t.verdad.length} líneas leídas, ${ok} con el precio correcto; la suma ${leido.cuadra ? 'cuadra' : 'no cuadra'} con el total.`);
  }

  /** «Guardar caso de prueba»: texto leído (sin datos personales) y la lista como quedó revisada. Se descarga al teléfono. */
  function guardarCaso() {
    if (!tiquete) return;
    const caso = casoDePrueba({
      tiquete, origen: procedencia.origen, simulado, cadena: procedencia.cadena, baseDescargada: base?.meta.descargado, hoy: hoyLocal(),
      items: items.map(it => ({
        descripcion: it.descripcion, cantidad: it.cantidad, precio: it.precio, codigoLeido: it.codigo, codigo: it.producto?.ean, quitada: it.quitado,
        identificado: it.ident.dudoso || it.ident.producto?.ean !== it.producto?.ean ? 'persona'
          : it.ident.metodo === 'codigo' ? 'codigo-impreso' : it.ident.metodo === 'alias' ? 'alias' : 'texto',
      })),
    });
    descargarJson(nombreCaso(caso), caso);
    const n = caso.lineas.filter(l => !l.quitada).length;
    setAvisoCaso(`Se guardó «${nombreCaso(caso)}» en sus descargas: ${n} ${n === 1 ? 'línea' : 'líneas'}${simulado ? ', marcado como SIMULADO' : ''}. No incluye la foto ni datos del cliente.`);
  }

  function confirmar(item: Item, p: Producto) {
    const nuevo = aprender(alias, item.descripcion, p.ean);   // si había un alias equivocado, lo reemplaza (B-03)
    if (!simulado) { setAlias(nuevo); guardarAlias(nuevo); }
    setItems(xs => xs.map(x => (x.id === item.id ? { ...x, producto: p, seguro: true } : x)));
  }

  /** Lee con la cámara la lista de ingredientes de un producto que no la trae en la base (OCR en el teléfono). */
  async function leerIngredientes(p: Producto, f?: File) {
    if (!f) return;
    setEstadoIngredientes(`Leyendo los ingredientes de ${p.nombre}…`);
    try {
      const texto = await leerTexto(f, (x, estado) => setEstadoIngredientes(`${estado}: ${Math.round(x * 100)} %`));
      // Una foto ilegible (o de la tabla nutricional) no se guarda: no sirve para decir nada del producto.
      if (!listaDeIngredientes(texto)) {
        setEstadoIngredientes(`No se pudo leer bien la lista de ingredientes de ${p.nombre} (salió borrosa o es la tabla nutricional). Tome otra foto de la lista, más cerca y con buena luz.`);
        return;
      }
      const nuevo = { ...ingredientesFoto, [p.ean]: texto.slice(0, 3000) };
      setIngredientesFoto(nuevo); guardarIngredientesFoto(nuevo);
      const cs = colorantesDe(p, texto);
      setEstadoIngredientes(cs.length
        ? `${p.nombre}: su etiqueta declara ${cs.map(c => `${c.nombre} (${c.codigo})`).join(', ')}.`
        : `${p.nombre}: su etiqueta no declara colorantes de la lista. Revise que la foto muestre toda la lista de ingredientes.`);
    } catch (e) {
      setEstadoIngredientes(`No se pudo leer la foto: ${(e as Error).message}`);
    }
  }

  function cambiarPerfil(p: Perfil) { setPerfil(p); guardarPerfil(p); }
  function cambiarPrefs(p: Preferencias) { setPrefs(p); guardarPreferencias(p); }
  function cambiarLista(l: ItemLista[]) { setLista(l); guardarLista(l); }

  // Precios, del más confiable al menos: esta compra → historial de sus compras → comunidad → estimado (≈).
  const precios = useMemo(() => {
    const fuente: Precio['fuente'] = simulado ? 'simulado' : procedencia.origen === 'foto' ? 'tiquete' : 'factura';
    const deEstaCompra = new Map<string, Precio>();
    for (const it of items) if (it.producto && !it.quitado) {
      if (it.cantidad > 0) deEstaCompra.set(it.producto.ean, { colones: it.precio / it.cantidad, fuente, fecha: procedencia.fecha, comercio: procedencia.cadena ?? procedencia.comercio });
    }
    return (p: Producto): Precio | undefined => deEstaCompra.get(p.ean) ?? historial[p.ean]
      ?? (indice ? precioComunidad(indice, p.ean, procedencia.cadena, prefs.canton) : undefined) ?? precioEstimado(p);
  }, [items, simulado, procedencia, historial, indice, prefs.canton]);

  const canasta = items.filter(i => i.producto && !i.quitado);
  // B-23: si la base no trae el tamaño del empaque, el gráfico usa el impreso en la línea del tiquete.
  const lineasCompra = canasta.map(i => ({ producto: i.producto!, unidades: i.cantidad, tamanoTiquete: tamanoDelTiquete(i.descripcion) }));
  const evaluados = canasta.map(i => ({ item: i, e: evaluar(i.producto!) }));
  const empacados = evaluados.filter(x => x.e.aplica);
  const conSellos = empacados.filter(x => x.e.sellos.length > 0);
  const gastoEmpacados = empacados.reduce((a, x) => a + x.item.precio, 0);
  const gastoConSellos = conSellos.reduce((a, x) => a + x.item.precio, 0);
  // Paso 4 (D-22): productos con sellos para sustituir, de más a menos sellos. Ya no se sugiere un producto
  // específico (proponerCambios queda en el dominio, con sus pruebas, por si se retoma con datos mejores).
  const paraSustituir = useMemo(
    () => (pantalla === 'cambios' ? ordenarParaSustituir(empacados.map(x => ({ producto: x.item.producto!, e: x.e, precio: x.item.precio, cantidad: x.item.cantidad }))) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pantalla, items, perfil, precios],
  );
  const pendientes = items.filter(i => !i.quitado && !i.producto).length;
  const pctConSellos = gastoEmpacados > 0 ? Math.round((gastoConSellos / gastoEmpacados) * 100) : 0;
  const mesActual = porMes(compras).find(m => m.mes === hoyLocal().slice(0, 7));

  /** Resumen sin la lista de productos, para «Su progreso». */
  function resumenCompra(t: TiqueteLeido): ResumenCompra {
    const compra = lineasCompra;
    const fecha = procedencia.fecha ?? hoyLocal();
    return {
      id: idCompra(fecha, t.total ?? t.sumaLineas, t.lineas.length), fecha, comercio: procedencia.cadena ?? procedencia.comercio,
      empacados: empacados.length, conSellos: conSellos.length, gastoEmpacados, gastoConSellos,
      azucarG: aportesNutriente(compra, 'azucares').total, sodioMg: aportesNutriente(compra, 'sodio').total,
    };
  }

  /** Arma la oferta de aporte de esta compra (no envía nada). Solo compras reales, que cuadran y con comercio conocido. */
  function ofrecerAporte(id: string) {
    setOferta(null); setAvisoAporte('');
    if (!hayServicio || !prefs.aportar || simulado || !tiquete?.cuadra || decididoPara.current.has(id)) return;
    if (!procedencia.cadena || procedencia.cadena === 'Otro') { setAvisoAporte('Para ofrecerle aportar precios hace falta saber en qué comercio compró.'); return; }
    const envio = prepararAportes(canasta.map(i => ({ ean: i.producto!.ean, total: i.precio, cantidad: i.cantidad, seguro: i.seguro })),
      procedencia.cadena, prefs.canton, procedencia.fecha ?? hoyLocal(), hoyLocal());
    if (envio.length === 0) { setAvisoAporte('No hay productos identificados con seguridad (código de barras o elegidos por usted) para aportar.'); return; }
    const nombres = Object.fromEntries(canasta.map(i => [normalizarEan(i.producto!.ean), i.producto!.nombre]));
    setOferta({ id, envio, nombres, estado: 'oferta' });
  }

  async function aportar() {
    if (!oferta || oferta.estado === 'enviando' || oferta.estado === 'hecho') return;
    setOferta({ ...oferta, estado: 'enviando' });
    try {
      await enviarAportes(oferta.envio);
      decididoPara.current.add(oferta.id); guardarAportadas([...decididoPara.current]);
      setOferta(o => (o ? { ...o, estado: 'hecho' } : o));
    } catch (e) {
      setOferta(o => (o ? { ...o, estado: { error: (e as Error).message } } : o));
    }
  }

  function rechazarAporte() {
    if (!oferta) return;
    decididoPara.current.add(oferta.id); guardarAportadas([...decididoPara.current]);
    setOferta({ ...oferta, estado: 'rechazado' });
  }

  /** «Todo está bien»: guarda precios y progreso (solo compras reales) y, si la persona lo activó, OFRECE aportar precios. */
  function confirmarCompra() {
    guardarPrecios();
    if (!simulado && tiquete && tiquete.cuadra !== false && canasta.length > 0) {
      const r = resumenCompra(tiquete);
      const nuevas = registrar(compras, r);
      setCompras(nuevas); guardarCompras(nuevas);
      ofrecerAporte(r.id);
    }
    setPantalla('canasta');
  }

  function irPaso(paso: number) {
    if (paso === 1) setPantalla('inicio');
    else if (paso === 2) setPantalla('revisar');
    else if (paso === 3) { if (pantalla === 'revisar') confirmarCompra(); else setPantalla('canasta'); }
    else setPantalla('cambios');
  }
  const alcanzable = (paso: number) => paso === 1 || (paso === 2 && !!tiquete) || (paso === 3 && canasta.length > 0) || (paso === 4 && conSellos.length > 0);

  function borrarDatos() {
    borrarTodo();
    decididoPara.current = new Set();
    setPerfil(leerPerfil()); setAlias({}); setIngredientesFoto({}); setHistorial({}); setLista([]); setCompras([]); setComunidad(null);
    setPrefs(leerPreferencias());
  }

  // Avisar de un dato dudoso envía el código de un producto de la compra: solo con el permiso de compartir.
  const puedeAvisar = hayServicio && prefs.aportar;
  const seccion: Seccion = pantalla === 'lista' || pantalla === 'progreso' || pantalla === 'ajustes' ? pantalla : 'inicio';
  // B-15: la tarjeta «Su hogar» ya no habla de niños (sin efecto desde D-29); solo de alergias.
  const hogar = [
    perfil.alergenos.length ? `alergia a ${perfil.alergenos.map(a => ALERGENOS.find(x => x[0] === a)?.[1].toLowerCase() ?? a).join(', ')}` : 'sin alergias registradas'].join(', ');

  if (!base) {
    return (
      <main className="app"><Barra simulado={false} />
        <div className="contenido">
          {error
            ? <Vacio titulo="No se pudo abrir la app">
                <p>{error}</p>
                <Boton onClick={cargarBase}>Intentar de nuevo</Boton>
              </Vacio>
            : <p role="status">Cargando la base de productos…</p>}
        </div>
      </main>
    );
  }

  return (
    <main className="app">
      <Barra simulado={simulado && !!PASO[pantalla]} />
      <div className="contenido">
        {PASO[pantalla] && <Pasos actual={PASO[pantalla]!} alcanzable={alcanzable} onIr={irPaso} />}

        {pantalla === 'inicio' && <>
          <p className="saludo">{saludo(new Date().getHours())}</p>
          <section className="hero" aria-labelledby="titulo-inicio">
            <EscenaInicio />
            <h1 id="titulo-inicio">Sepa qué lleva su compra</h1>
            <p>Con la foto de su tiquete le mostramos qué productos tienen sellos de exceso de la OPS, cuáles conviene cambiar y qué buscar en su lugar.</p>
            <label className="boton primario">
              <Icono nombre="camara" />Tomar foto del tiquete
              <input type="file" accept="image/*" capture="environment" className="oculto-accesible" onChange={e => desdeFoto(archivo(e))} />
            </label>
          </section>
          {error && <Tarjeta variante="aviso"><p role="alert">{error}</p></Tarjeta>}
          {tiquete && items.length > 0 && (
            <Tarjeta>
              <strong>Tiene una compra sin terminar</strong>
              <p className="nota">{items.filter(i => !i.quitado).length} productos{procedencia.cadena ? ` de ${procedencia.cadena}` : ''}{simulado ? ' (SIMULADO)' : ''}.</p>
              <Boton tipo="secundario" onClick={() => setPantalla('revisar')}>Continuar</Boton>
            </Tarjeta>
          )}
          <h2 className="subtitulo">Otras formas de empezar</h2>
          <div className="opciones-inicio">
            <label className="opcion">
              <span className="cat tono-periwinkle" aria-hidden="true"><IconoOpcion tipo="galeria" /></span>
              <span className="texto"><strong>Foto de la galería</strong><span className="nota">Use una foto del tiquete que ya tiene.</span></span>
              <input type="file" accept="image/*" className="oculto-accesible" onChange={e => desdeFoto(archivo(e))} />
            </label>
            <label className="opcion">
              <span className="cat tono-amarillo" aria-hidden="true"><IconoOpcion tipo="factura" /></span>
              <span className="texto"><strong>Factura electrónica</strong><span className="nota">El XML o PDF que le llega al correo: la opción más exacta, sin errores de lectura.</span></span>
              <input type="file" accept=".xml,.pdf,text/xml,application/xml,application/pdf" className="oculto-accesible" onChange={e => desdeFactura(archivo(e))} />
            </label>
            <button type="button" className="opcion" onClick={simular}>
              <span className="cat tono-periwinkle" aria-hidden="true"><IconoOpcion tipo="ejemplo" /></span>
              <span className="texto"><strong>Ver un ejemplo SIMULADO</strong><span className="nota">Un tiquete de prueba para ver cómo funciona, sin usar sus datos.</span></span>
            </button>
          </div>
          <PegarTexto onRevisar={texto => cargarLeido(leerTiquete(texto), { origen: 'texto' })} />
          {mesActual?.pctConSellos !== undefined && (
            <Tarjeta>
              <Anillo porcentaje={mesActual.pctConSellos} texto={`${Math.round(mesActual.pctConSellos)} %`} nivel={nivelSellos(mesActual.pctConSellos)}
                descripcion={`Este mes, el ${Math.round(mesActual.pctConSellos)} % de su gasto en productos empacados fue en productos con sellos (${TEXTO_NIVEL[nivelSellos(mesActual.pctConSellos)].toLowerCase()})`}>
                <strong style={{ fontSize: '1.25rem' }}>Este mes</strong>
                <div><Etiqueta tipo={nivelSellos(mesActual.pctConSellos)}>{TEXTO_NIVEL[nivelSellos(mesActual.pctConSellos)]}</Etiqueta></div>
                <p>de su gasto en empacados fue en productos con sellos.</p>
                <button type="button" className="enlace" onClick={() => setPantalla('progreso')}>Ver su progreso</button>
              </Anillo>
            </Tarjeta>
          )}
          <Tarjeta>
            <strong>Su hogar</strong>
            <p className="nota" style={{ color: 'var(--texto)' }}>{hogar[0].toUpperCase() + hogar.slice(1)}. Se lo tomamos en cuenta en «Qué conviene cambiar».</p>
            <button type="button" className="enlace" onClick={() => setPantalla('ajustes')}>Cambiar en Ajustes</button>
          </Tarjeta>
          <p className="nota">Su foto y sus compras no salen de su teléfono. Esta app nunca le pedirá su clave ni su tarjeta.</p>
          <details>
            <summary>Herramientas de prueba</summary>
            <div className="opciones">
              <Boton tipo="secundario" onClick={async () => {
                try {
                  const r = await fetch(`${import.meta.env.BASE_URL}ejemplos/factura_simulada_v44.xml`);
                  const fac = leerFacturaXml(await r.text());
                  cargarLeido(fac, { origen: 'factura-xml', comercio: fac.comercio, fecha: fac.fecha, demo: true });
                } catch (e) { setError(`No se pudo cargar la factura de ejemplo: ${(e as Error).message}`); }
              }}>Probar con una factura electrónica SIMULADO</Boton>
              <Boton tipo="secundario" onClick={medirOcr}>Medir el OCR con un tiquete SIMULADO</Boton>
              {medicion && <p className="nota" role="status">{medicion}</p>}
              {tiquete && items.length > 0 ? <>
                <Boton tipo="secundario" onClick={guardarCaso}><Icono nombre="descargar" />Guardar caso de prueba</Boton>
                <p className="nota">Descarga un archivo .json con el texto que leyó la app y su lista revisada (descripción, cantidad, precio y código elegido), para convertir este tiquete en una prueba. No guarda la foto ni los datos del cliente. Revíselo antes de compartirlo.</p>
              </> : <p className="nota">«Guardar caso de prueba» aparece después de leer y revisar un tiquete.</p>}
              {avisoCaso && <p className="nota" role="status">{avisoCaso}</p>}
            </div>
          </details>
        </>}

        {pantalla === 'leyendo' && <>
          <h1>Leyendo su tiquete…</h1>
          <EscenaLeyendo />
          <p role="status">{progreso.estado} · {Math.round(progreso.f * 100)} %</p>
          <div className="progreso" role="progressbar" aria-label="Lectura del tiquete" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progreso.f * 100)}><div style={{ width: `${progreso.f * 100}%` }} /></div>
          <p className="nota">La foto se procesa en su teléfono.</p>
        </>}

        {pantalla === 'revisar' && tiquete && <>
          <h1>Revise sus productos</h1>
          <p className="nota">
            {procedencia.origen === 'factura-xml' ? `Factura electrónica${procedencia.comercio ? ` de ${procedencia.comercio}` : ''}${procedencia.fecha ? ` · ${procedencia.fecha.split('-').reverse().join('/')}` : ''}`
              : procedencia.origen === 'factura-pdf' ? 'Factura electrónica (PDF)' : procedencia.origen === 'foto' ? 'Foto del tiquete'
              : procedencia.origen === 'texto' ? `Texto pegado${procedencia.fecha ? ` · ${procedencia.fecha.split('-').reverse().join('/')}` : ''}` : 'Tiquete SIMULADO'}
            {procedencia.cadena && !(procedencia.comercio ?? '').includes(procedencia.cadena) ? ` · ${procedencia.cadena}` : ''}
          </p>
          {items.length === 0 ? (
            <Vacio titulo="No encontramos productos en la foto">
              <p>Pruebe con el tiquete plano y completo, con buena luz y sin sombras, la cámara de frente y a un palmo.</p>
              <label className="boton primario">
                Tomar otra foto
                <input type="file" accept="image/*" capture="environment" className="oculto-accesible" onChange={e => desdeFoto(archivo(e))} />
              </label>
              <label className="boton secundario">
                Usar la factura electrónica
                <input type="file" accept=".xml,.pdf,text/xml,application/xml,application/pdf" className="oculto-accesible" onChange={e => desdeFactura(archivo(e))} />
              </label>
            </Vacio>
          ) : <>
            <p>Encontramos {items.filter(i => !i.quitado).length} productos.{pendientes > 0 && ` ${pendientes} ${pendientes === 1 ? 'necesita' : 'necesitan'} su ayuda.`}</p>
            {tiquete.cuadra === false && (
              <Tarjeta variante="aviso"><p>La suma de los productos ({colones(tiquete.sumaLineas)}) no coincide con el total del tiquete ({colones(tiquete.total ?? tiquete.subtotal ?? 0)}). Revise la lista o tome otra foto.</p></Tarjeta>
            )}
            {tiquete.total === undefined && tiquete.subtotal === undefined && (
              <Tarjeta variante="aviso"><p>No encontramos el TOTAL en la foto, así que no podemos comprobar que la lista esté completa.</p></Tarjeta>
            )}
            {!simulado && pendientes / Math.max(1, items.length) >= 0.5 && (
              <Tarjeta variante="aviso">
                <strong>La foto se leyó con dificultad</strong>
                <p>Para la próxima: tiquete plano y completo, con buena luz y sin sombras, la cámara de frente y a un palmo. Si el tiquete es largo, tómelo por partes.</p>
              </Tarjeta>
            )}
            {items.filter(i => !i.quitado).map(it => (
              <FilaItem key={it.id} item={it} onElegir={p => confirmar(it, p)} productos={productos}
                onQuitar={() => setItems(xs => xs.map(x => (x.id === it.id ? { ...x, quitado: true } : x)))} />
            ))}
            {items.some(i => i.quitado && i.fresco) && (
              <Tarjeta variante="exito">
                <strong>Alimentos frescos: no llevan sellos ✓</strong>
                <p className="nota" style={{ color: 'var(--texto)' }}>Frutas, verduras, huevos y carnes sin empaque. No hace falta revisarlos.</p>
                {items.filter(i => i.quitado && i.fresco).map(it => (
                  <div key={it.id} className="encabezado-producto">
                    <span style={{ flex: 1, minWidth: 0 }}>{it.descripcion} · {colones(it.precio)}</span>
                    <button type="button" className="enlace" onClick={() => setItems(xs => xs.map(x => (x.id === it.id ? { ...x, quitado: false, fresco: false } : x)))}
                      aria-label={`${it.descripcion} no es fresco: revisarlo`}>No es fresco</button>
                  </div>
                ))}
              </Tarjeta>
            )}
            {items.some(i => i.quitado && i.noComida) && (
              <Tarjeta>
                <strong>No son comida: no se revisan</strong>
                <p className="nota">Se quitaron solos para que no tenga que hacerlo usted. Si alguno sí es comida, devuélvalo.</p>
                {items.filter(i => i.quitado && i.noComida).map(it => (
                  <div key={it.id} className="encabezado-producto">
                    <span style={{ flex: 1, minWidth: 0 }}>{it.descripcion} · {colones(it.precio)}</span>
                    <button type="button" className="enlace" onClick={() => setItems(xs => xs.map(x => (x.id === it.id ? { ...x, quitado: false, noComida: false } : x)))}
                      aria-label={`${it.descripcion} sí es comida: devolver a la lista`}>Sí es comida</button>
                  </div>
                ))}
              </Tarjeta>
            )}
          </>}
          {procedencia.origen === 'foto' && items.length > 0 && <>
            {avisoParte && <Tarjeta><p role="status">{avisoParte}</p></Tarjeta>}
            <label className="boton secundario">
              ¿Tiquete largo? Agregar otra parte
              <input type="file" accept="image/*" capture="environment" className="oculto-accesible" onChange={e => agregarParte(archivo(e))} />
            </label>
            <p className="nota">Tome la siguiente parte dejando una o dos líneas repetidas: la app las une sin contarlas dos veces.</p>
          </>}
          {hayServicio && prefs.aportar && !simulado && items.length > 0 && !procedencia.cadena && (
            <Tarjeta>
              <label htmlFor="cadena"><strong>¿Dónde compró?</strong> <span className="nota">(opcional, para aportar precios)</span></label>
              <select id="cadena" value="" onChange={e => setProcedencia(p => ({ ...p, cadena: e.target.value || undefined }))}>
                <option value="">No lo sé</option>
                {CADENAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </Tarjeta>
          )}
          {items.length > 0 && <Boton onClick={confirmarCompra} disabled={canasta.length === 0}>Todo está bien: ver mi canasta</Boton>}
          <details>
            <summary>Ver el texto que leyó la app</summary>
            <pre className="tiquete">{tiquete.texto}</pre>
            <p className="nota">{tiquete.lineas.length} líneas reconocidas como productos y {tiquete.ignoradas} descartadas (encabezado, pie, teléfonos, cédulas o ruido).</p>
          </details>
        </>}

        {pantalla === 'canasta' && <>
          <h1>Su canasta</h1>
          {oferta && <OfertaAporte envio={oferta.envio} nombres={oferta.nombres} estado={oferta.estado} onAportar={() => void aportar()} onRechazar={rechazarAporte} />}
          {avisoAporte && <p className="nota" role="status">{avisoAporte}</p>}
          {empacados.length === 0 ? (
            <Tarjeta><p>Ninguno de sus productos es empacado con sellos posibles: frutas, verduras, arroz, frijoles e ingredientes como aceite o azúcar no llevan sellos.</p></Tarjeta>
          ) : conSellos.length === 0 ? (
            <Tarjeta variante="exito">
              <EscenaExito />
              <strong style={{ fontSize: '1.25rem' }}>¡Buena compra!</strong>
              <p>Ninguno de sus {empacados.length} productos empacados tiene sellos.</p>
            </Tarjeta>
          ) : (
            <Tarjeta>
              <Anillo porcentaje={pctConSellos} texto={`${pctConSellos} %`} nivel={nivelSellos(pctConSellos)}
                descripcion={`El ${pctConSellos} % de lo que gastó en productos empacados fue en productos con sellos (${TEXTO_NIVEL[nivelSellos(pctConSellos)].toLowerCase()})`}>
                <div><Etiqueta tipo={nivelSellos(pctConSellos)}>{TEXTO_NIVEL[nivelSellos(pctConSellos)]}</Etiqueta></div>
                <p style={{ fontWeight: 700, fontSize: '1.25rem' }}>{conSellos.length} de {empacados.length} empacados con sellos</p>
                <p>Son el {pctConSellos} % de lo que gastó en productos empacados.</p>
              </Anillo>
              <p className="nota">Frutas, verduras, arroz, frijoles e ingredientes como aceite o azúcar no llevan sellos.</p>
            </Tarjeta>
          )}
          <GraficoAportes compra={lineasCompra} />
          <SeccionColorantes productos={canasta.map(i => i.producto!)} extra={ingredientesFoto} estado={estadoIngredientes} onFoto={(p, f) => void leerIngredientes(p, f)} />
          {conSellos.map(({ item, e }) => (
            <Tarjeta key={item.id} variante="borde">
              <div className="encabezado-producto"><IconoCategoria producto={item.producto!} /><strong>{item.producto!.nombre}{item.producto!.marca ? ` · ${item.producto!.marca}` : ''}</strong></div>
              <div className="sellos">{e.sellos.map(s => <Sello key={s} sello={s} />)}</div>
              <ExplicacionSellos producto={item.producto!} sellos={e.sellos} />
              {e.faltantes.some(f => f !== 'grasas trans' && !f.includes('dudoso')) && <p className="nota">Sin dato de {e.faltantes.filter(f => f !== 'grasas trans' && !f.includes('dudoso')).join(', ')}.</p>}
              {e.faltantes.some(f => f.includes('dudoso')) && <AvisoDudoso producto={item.producto!} faltantes={e.faltantes} permitido={puedeAvisar} />}
              {e.alcanceEstimado && <p className="nota">{e.motivo}.</p>}
            </Tarjeta>
          ))}
          {empacados.filter(x => x.e.sellos.length === 0 && x.e.faltantes.some(f => f.includes('dudoso'))).map(({ item, e }) => (
            <Tarjeta key={item.id} variante="borde">
              <div className="encabezado-producto"><IconoCategoria producto={item.producto!} /><strong>{item.producto!.nombre}{item.producto!.marca ? ` · ${item.producto!.marca}` : ''}</strong></div>
              <p className="nota">No se puede saber si lleva sellos: un dato de la base no es creíble.</p>
              <AvisoDudoso producto={item.producto!} faltantes={e.faltantes} permitido={puedeAvisar} />
            </Tarjeta>
          ))}
          {conSellos.length > 0 && <Boton onClick={() => setPantalla('cambios')}>Ver qué conviene cambiar</Boton>}
          <p className="nota">Sellos calculados con el modelo de perfil de nutrientes de la OPS (2016). Casi ningún producto declara grasas trans; sin ese dato no se marca ese sello.</p>
          <Boton tipo="secundario" onClick={() => setPantalla('inicio')}>Revisar otro tiquete</Boton>
        </>}

        {pantalla === 'cambios' && (
          <Sustituir items={paraSustituir} lista={lista} onCambiarLista={cambiarLista} perfil={perfil} ingredientesFoto={ingredientesFoto}
            onIrLista={() => setPantalla('lista')} onInicio={() => setPantalla('inicio')} />
        )}

        {pantalla === 'lista' && <MiLista lista={lista} onCambiar={cambiarLista} onIrInicio={() => setPantalla('inicio')} />}
        {pantalla === 'progreso' && <Progreso compras={compras} />}
        {pantalla === 'ajustes' && (
          <Ajustes perfil={perfil} onPerfil={cambiarPerfil} prefs={prefs} onPrefs={cambiarPrefs} hayServicio={hayServicio}
            comunidad={comunidad} estadoComunidad={estadoComunidad} onActualizar={() => void actualizarComunidad(true)}
            datos={{ precios: Object.keys(historial).length, alias: Object.keys(alias).length, compras: compras.length, lista: lista.length }}
            aprendidos={aprendidos(alias, productos)} onOlvidar={clave => { const n = olvidar(alias, clave); setAlias(n); guardarAlias(n); }}
            onBorrar={borrarDatos} onRestaurado={() => setTimeout(() => window.location.reload(), 1500)} base={{ productos: base.meta.productos ?? productos.length, descargado: base.meta.descargado }} />
        )}
      </div>
      {pantalla !== 'leyendo' && <Navegacion actual={seccion} enLista={lista.filter(x => !x.hecho).length} onIr={s => setPantalla(s)} />}
    </main>
  );
}

/** Dato dudoso de la base pública: se explica y, si hay servicio, la persona puede avisar con un toque
 *  (se envía solo el código del producto y qué dato es; nada de su compra). */
function AvisoDudoso({ producto, faltantes, permitido }: { producto: Producto; faltantes: string[]; permitido: boolean }) {
  const [estado, setEstado] = useState<'' | 'enviando' | 'ok' | { error: string }>('');
  const nombres = faltantes.filter(f => f.includes('dudoso')).map(f => f.replace(' (dato dudoso)', ''));
  const avisos = reportesDeDudosos(producto.ean, faltantes);
  async function avisar() {
    setEstado('enviando');
    try { for (const a of avisos) await enviarReporte(a); setEstado('ok'); }
    catch (e) { setEstado({ error: (e as Error).message }); }
  }
  return <>
    <p className="nota">Dato dudoso en la base de productos ({nombres.join(', ')}): no se usa para los sellos.</p>
    {permitido && avisos.length > 0 && (estado === 'ok'
      ? <p className="nota" role="status">Gracias por avisar. Solo se envió el código del producto y qué dato es dudoso.</p>
      : <button type="button" className="enlace" disabled={estado === 'enviando'} onClick={avisar}>{estado === 'enviando' ? 'Avisando…' : 'Avisar de este dato dudoso'}</button>)}
    {typeof estado === 'object' && <p className="nota" role="status">No se pudo avisar: {estado.error}.</p>}
  </>;
}

function FilaItem({ item, productos, onElegir, onQuitar }: { item: Item; productos: Producto[]; onElegir: (p: Producto) => void; onQuitar: () => void }) {
  const [codigo, setCodigo] = useState('');
  const [aviso, setAviso] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [falloCamara, setFalloCamara] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const listo = !!item.producto && !cambiando;
  // B-03: reconocido por un alias (una compra anterior) y no cambiado después. «Cambiar» abre las opciones.
  const porAlias = !!item.producto && item.ident.metodo === 'alias' && item.producto.ean === item.ident.producto?.ean;
  // Al cambiar, los candidatos salen del texto, sin el alias (que puede ser el equivocado).
  const candidatos = useMemo(() => (cambiando ? identificar(item.descripcion, productos, {}).candidatos.filter(p => p.ean !== item.producto?.ean) : item.ident.candidatos),
    [cambiando, item, productos]);
  const elegir = (p: Producto) => { onElegir(p); setCambiando(false); };
  // En vivo si el navegador tiene cámara y lector; si no (o si la cámara falla), la foto del código.
  const vivo = hayEscanerVivo() && !falloCamara;
  function buscar(ean: string) {
    const limpio = ean.replace(/\D/g, '');
    const p = productos.find(x => x.ean === limpio || x.ean === '0' + limpio || '0' + x.ean === limpio);
    if (p) { elegir(p); setAviso(''); } else setAviso(`No encontramos el código ${limpio || ean} en la base.`);
  }
  return (
    <div className={`fila ${listo ? '' : 'duda'}`}>
      {!!item.producto && !cambiando && <IconoCategoria producto={item.producto} />}
      <div className="datos">
        <span className="nombre">{listo ? item.producto!.nombre : item.descripcion}</span>
        <span className="detalle">{listo ? `${item.descripcion} · ` : cambiando ? `${item.descripcion} · ¿Cuál es? · ` : 'No estamos seguros de cuál es · '}{item.cantidad > 1 ? `${item.cantidad} unidades · ` : ''}{colones(item.precio)}</span>
        {porAlias && !cambiando && (
          <span className="detalle">Reconocido por una compra anterior · <button type="button" className="enlace" onClick={() => setCambiando(true)}
            aria-label={`Cambiar el producto de ${item.descripcion}`}>Cambiar</button></span>
        )}
      </div>
      <Etiqueta tipo={listo ? 'listo' : 'duda'}>{listo ? 'Listo' : '¿Cuál es?'}</Etiqueta>
      {!listo && (
        <div className="opciones">
          {candidatos.map(p => (
            <Boton key={p.ean} tipo="secundario" onClick={() => elegir(p)}>
              ¿Es {p.nombre}{p.marca ? ` · ${p.marca}` : ''}{p.cantidad ? ` · ${p.cantidad}` : ''}?
              <span className="nota" style={{ display: 'block', fontWeight: 400 }}>Código {p.ean}</span>
            </Boton>
          ))}
          {vivo && !escaneando && (
            <Boton tipo="secundario" onClick={() => { setAviso(''); setEscaneando(true); }}><Icono nombre="codigo" />Escanear el código con la cámara</Boton>
          )}
          {escaneando && (
            <EscanerCodigo nombre={item.descripcion}
              onCodigo={c => { setEscaneando(false); buscar(c); }}
              onCerrar={motivo => { setEscaneando(false); if (motivo) { setAviso(motivo); setFalloCamara(true); } }} />
          )}
          {hayLectorDeBarras() && !vivo && (
            <label className="boton secundario">
              <Icono nombre="camara" />Tomar foto del código de barras
              <input type="file" accept="image/*" capture="environment" className="oculto-accesible"
                onChange={async e => { const f = archivo(e); if (!f) return; const c = await leerCodigoDeBarras(f); if (c) buscar(c); else setAviso('No se pudo leer el código. Escríbalo abajo.'); }} />
            </label>
          )}
          <div className="campo">
            <input type="text" inputMode="numeric" placeholder="Código de barras" aria-label={`Código de barras de ${item.descripcion}`} value={codigo} onChange={e => setCodigo(e.target.value)} />
            <button type="button" className="boton secundario" style={{ width: 'auto' }} onClick={() => buscar(codigo)}>Buscar</button>
          </div>
          {aviso && <p className="nota" role="status">{aviso}</p>}
          {cambiando && <button type="button" className="enlace" onClick={() => { setCambiando(false); setAviso(''); }}>Dejar {item.producto!.nombre}</button>}
        </div>
      )}
      <button type="button" className="enlace" onClick={onQuitar} aria-label={`Quitar ${listo ? item.producto!.nombre : item.descripcion}`}>Quitar</button>
    </div>
  );
}
