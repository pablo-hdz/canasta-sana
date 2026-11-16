import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Letra opcional para baja visión (Ajustes → «Más fácil de leer»), servida desde la app (sin Google Fonts):
// privacidad y uso sin conexión. El navegador solo descarga sus archivos si se usa. Por defecto, la letra del teléfono (D-20).
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import App from './App';
import { Proteccion } from './Proteccion';
import { DefinicionesIlustraciones } from './ilustraciones';
import { AvisoVersion, registrarServiceWorker } from './AvisoVersion';
import { aplicarAnimaciones, aplicarLetra, aplicarTema, leerPreferencias } from './almacen';
import './estilos.css';

// Tema y letra antes del primer dibujo, para que no parpadeen.
aplicarTema(leerPreferencias().tema);
aplicarLetra(leerPreferencias().letra);
aplicarAnimaciones(leerPreferencias().animaciones);

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    {/* Degradados de todas las ilustraciones, una sola vez en la página (v0.2.5). */}
    <DefinicionesIlustraciones />
    <Proteccion>
      <App />
      <AvisoVersion />
    </Proteccion>
  </StrictMode>,
);

// Funcionamiento sin internet (RNF-03). Solo en producción, para no interferir con la recarga en caliente.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => registrarServiceWorker(`${import.meta.env.BASE_URL}sw.js`));
}
