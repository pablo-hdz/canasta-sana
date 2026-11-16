// Tipos del dominio. Nutrientes por 100 g o 100 ml, como en la etiqueta y en Open Food Facts.

export interface Nutrientes {
  kcal?: number;
  azucares?: number;          // azúcares totales (g)
  azucaresAnadidos?: number;  // azúcares añadidos declarados (g)
  grasas?: number;            // grasas totales (g)
  saturadas?: number;         // g
  trans?: number;             // g
  sodioMg?: number;           // mg
  carbohidratos?: number;     // g
  proteinas?: number;         // g
}

export interface Producto {
  ean: string;
  nombre: string;
  marca: string;
  cantidad: string;
  cantidadNum?: number | null;
  unidad?: 'g' | 'ml' | null;
  categorias: string[];
  nova?: number | null;
  n: Nutrientes;
  ingredientes: string;
  aditivos: string[];
  alergenos: string[];
  tiendas: string[];
  simulado?: boolean;          // producto inventado para pruebas o demostración
  ia?: EstimacionIA;           // estimaciones de Jev sobre datos públicos (datos/enriquecer_jev.py)
}

export interface EstimacionIA {
  nova: number;
  novaConfianza: number;
  categoria: string;
  categoriaConfianza: number;
  modelo: string;
}

export const UMBRAL_IA = 0.8;  // SUPUESTO: por debajo de esta confianza no se usa la estimación

export type Sello = 'azucares' | 'sodio' | 'saturadas' | 'grasas' | 'trans' | 'edulcorantes';

// Orden de presentación y prioridad del «nutriente crítico».
export const ORDEN_SELLOS: Sello[] = ['azucares', 'sodio', 'saturadas', 'grasas', 'trans', 'edulcorantes'];

export const TEXTO_SELLO: Record<Sello, string> = {
  azucares: 'EXCESO\nAZÚCARES',
  sodio: 'EXCESO\nSODIO',
  saturadas: 'EXCESO\nGRASAS\nSATURADAS',
  grasas: 'EXCESO\nGRASAS\nTOTALES',
  trans: 'EXCESO\nGRASAS\nTRANS',
  edulcorantes: 'CONTIENE\nEDULCORANTES',
};

export interface Evaluacion {
  aplica: boolean;             // ¿el modelo OPS se aplica a este producto?
  motivo: string;              // por qué aplica o no aplica
  alcanceEstimado: boolean;    // true si se decidió sin dato NOVA
  sellos: Sello[];
  kcal?: number;
  kcalCalculada: boolean;
  azucaresLibres?: number;
  metodoAzucares: string;
  faltantes: string[];         // nutrientes sin dato (no se pueden evaluar)
  datosDudosos: boolean;       // falla el control de energía
}

export interface Precio {
  colones: number;
  // Reales: tiquete o factura actual, historial de compras de la persona, Open Prices y comunidad
  // (mediana de tiquetes reales aportados por otras personas, D-17).
  // No reales: estimado (por tamaño y categoría) y simulado (demostración).
  fuente: 'tiquete' | 'factura' | 'historial' | 'comunidad' | 'open-prices' | 'estimado' | 'simulado';
  fecha?: string;
  comercio?: string;
  n?: number;            // comunidad: cuántos aportes hay detrás de la mediana
}

export const esPrecioReal = (p?: Precio) => !!p && ['tiquete', 'factura', 'historial', 'comunidad', 'open-prices'].includes(p.fuente);
