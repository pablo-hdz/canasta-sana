// B-07 y D-29: avisos del paso 4 (D-23), solo con hechos del producto:
//  - SIEMPRE, haya niños o no (pedido de Pablo, D-29): si lleva edulcorantes o alguno de los colorantes de D-19;
//  - con una alergia marcada: «La etiqueta declara: leche», solo si el dato de alérgenos del producto la incluye.
// Nunca se dice que un producto NO contiene algo: la base puede no tener el dato.
// POR VERIFICAR: cualquier leyenda sobre niños que no venga del documento OPS 2016 (p. ej., «no recomendable en
// niños» de otras normas, o la advertencia de la UE sobre la atención de los niños). Por eso aquí no se muestra
// ninguna leyenda como norma: solo qué lleva el producto. La norma de cada colorante está en la sección Colorantes.
import type { Producto } from './tipos';
import type { Perfil } from './cambios';
import { edulcorantesEncontrados, tieneEdulcorantes } from './ops';
import { colorantesDe } from './colorantes';

export const NOMBRE_ALERGENO: Record<string, string> = {
  'en:peanuts': 'maní', 'en:milk': 'leche', 'en:gluten': 'gluten', 'en:soybeans': 'soya', 'en:eggs': 'huevo', 'en:nuts': 'frutos de cáscara',
};

/** Avisos de un producto del paso 4: edulcorantes y colorantes siempre; alérgenos, los que el hogar marcó. */
export function avisosHogar(p: Producto, perfil: Perfil, ingredientesExtra = ''): string[] {
  const avisos: string[] = [];
  if (tieneEdulcorantes(p)) {
    const cuales = edulcorantesEncontrados(p);
    avisos.push(`Lleva edulcorantes${cuales.length ? `: ${cuales.join(', ')}` : ''}.`);
  }
  const colorantes = colorantesDe(p, ingredientesExtra);
  if (colorantes.length) avisos.push(`Lleva colorantes de la lista: ${colorantes.map(c => `${c.nombre} (${c.codigo})`).join(', ')}.`);
  const declarados = perfil.alergenos.filter(a => p.alergenos.includes(a)).map(a => NOMBRE_ALERGENO[a] ?? a.replace(/^en:/, ''));
  if (declarados.length) avisos.push(`La etiqueta declara: ${declarados.join(', ')}.`);
  return avisos;
}
