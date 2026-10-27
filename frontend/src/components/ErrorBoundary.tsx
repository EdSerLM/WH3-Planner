import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Al cambiar (p. ej. de página o pestaña) se vuelve a intentar dibujar */
  resetKey?: unknown;
  label?: string;
}

interface State { error: Error | null; stack?: string }

/**
 * Si un componente falla al dibujarse, React quita toda la página y solo queda el fondo negro.
 * Esto atrapa el error, muestra qué pasó y deja seguir usando el resto de la app sin recargar.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[WH3 Planner] Error al dibujar', this.props.label ?? '', error, info.componentStack);
    this.setState({ stack: info.componentStack ?? undefined });
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null, stack: undefined });
  }

  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    const where = stack?.match(/at (\w+)/)?.[1];
    return (
      <div className="error">
        <b>Algo falló al dibujar {this.props.label ?? 'esta parte'}</b>{where ? ` (en ${where})` : ''}: {error.message}
        <div className="small muted">El resto de la app sigue funcionando. Si se repite, copia este mensaje para revisarlo.</div>
        <button onClick={() => this.setState({ error: null, stack: undefined })}>Reintentar</button>
      </div>
    );
  }
}
