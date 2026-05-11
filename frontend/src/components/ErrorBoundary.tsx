import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '1rem',
          fontFamily: 'system-ui, sans-serif', background: '#f8fafc', padding: '2rem',
        }}>
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h2 style={{ margin: 0, color: '#1e293b', fontSize: '1.5rem', fontWeight: 600 }}>
            Algo salió mal
          </h2>
          <p style={{ color: '#64748b', margin: 0, textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message ?? 'Error inesperado en la aplicación.'}
          </p>
          <button
            onClick={this.handleReset}
            style={{
              padding: '0.65rem 1.5rem', background: '#3b82f6', color: '#fff',
              border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600,
              fontSize: '0.95rem',
            }}
          >
            Volver al inicio
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
