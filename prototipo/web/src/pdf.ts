// Texto de la representación gráfica (PDF) de una factura electrónica, dentro del navegador.
// Reconstruye las líneas agrupando los fragmentos por altura y ordenándolos de izquierda a derecha.
export async function textoDePdf(archivo: Blob): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  // isEvalSupported: false: solo se extrae texto y la política de seguridad (CSP) no permite eval.
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()), isEvalSupported: false }).promise;
  const salida: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const pagina = await pdf.getPage(i);
    const contenido = await pagina.getTextContent();
    const filas = new Map<number, { x: number; s: string }[]>();
    for (const it of contenido.items) {
      if (!('str' in it) || !it.str.trim()) continue;
      const y = Math.round(it.transform[5] / 3) * 3; // tolerancia de 3 puntos
      const fila = filas.get(y) ?? [];
      fila.push({ x: it.transform[4], s: it.str });
      filas.set(y, fila);
    }
    [...filas.entries()].sort((a, b) => b[0] - a[0])
      .forEach(([, f]) => salida.push(f.sort((a, b) => a.x - b.x).map(x => x.s).join('   ')));
  }
  return salida.join('\n');
}
