// Si algo falla de forma inesperada, la persona ve qué pasó y cómo seguir, en vez de una pantalla en blanco.
import { Component, type ReactNode } from 'react';

interface Estado { error?: Error }

export class Proteccion extends Component<{ children: ReactNode }, Estado> {
  state: Estado = {};

  static getDerivedStateFromError(error: Error): Estado { return { error }; }

  componentDidCatch(error: Error) { console.error('Canasta sana — error inesperado:', error); }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main className="app">
        <header className="barra"><span className="marca">Canasta sana</span></header>
        <div className="contenido">
          <section className="tarjeta aviso" role="alert">
            <strong style={{ fontSize: '1.25rem' }}>Algo salió mal</strong>
            <p>La app tuvo un error inesperado. Sus datos siguen guardados en este teléfono.</p>
            <p className="nota">Detalle técnico: {this.state.error.message}</p>
          </section>
          <button type="button" className="boton primario" onClick={() => window.location.reload()}>Volver a abrir la app</button>
        </div>
      </main>
    );
  }
}
