import type { CategoriaVisual } from './visual';

// «Mi lista»: los cambios que la persona quiere probar en su próxima compra. Se guarda en el teléfono
// y se comparte solo si la persona lo decide (hoja de compartir del teléfono o WhatsApp).

export interface ItemLista {
  ean: string;
  nombre: string;
  marca?: string;
  cantidad?: string;
  enVezDe?: string;     // producto que reemplaza
  precio?: string;      // texto ya formateado («₡1 050» o «≈ ₡1 050»)
  hecho: boolean;       // ya lo compró
  categoria?: CategoriaVisual;   // solo para el ícono
  accion?: 'sustituir';          // recordatorio: buscar una opción con menos sellos que este producto (D-22)
}

export function agregarOQuitar(lista: ItemLista[], item: ItemLista): ItemLista[] {
  return lista.some(x => x.ean === item.ean) ? lista.filter(x => x.ean !== item.ean) : [...lista, item];
}

export function marcar(lista: ItemLista[], ean: string): ItemLista[] {
  return lista.map(x => (x.ean === ean ? { ...x, hecho: !x.hecho } : x));
}

/** Texto plano para compartir: sin datos de salud del hogar ni del tiquete, solo los productos de la lista. */
export function textoLista(lista: ItemLista[]): string {
  const pendientes = lista.filter(x => !x.hecho);
  if (pendientes.length === 0) return '';
  const lineas = pendientes.map(x => {
    const nombre = [x.nombre, x.marca, x.cantidad].filter(Boolean).join(' · ');
    if (x.accion === 'sustituir') return `• Cambiar ${nombre} por una opción con menos sellos`;
    return `• ${nombre}${x.enVezDe ? ` (en vez de ${x.enVezDe})` : ''}`;
  });
  return ['Mi lista de compras (Canasta sana):', ...lineas].join('\n');
}

export const enlaceWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
