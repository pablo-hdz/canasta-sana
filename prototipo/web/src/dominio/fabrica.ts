// Productos de prueba (SIMULADO) para las pruebas unitarias.
import type { Producto } from './tipos';

export function prod(o: Partial<Producto>): Producto {
  return {
    ean: '0000000000000', nombre: 'Producto de prueba', marca: '', cantidad: '', cantidadNum: null, unidad: null,
    categorias: ['en:snacks'], nova: 4, n: {}, ingredientes: 'harina', aditivos: [], alergenos: [], tiendas: [],
    simulado: true, ...o,
  };
}
