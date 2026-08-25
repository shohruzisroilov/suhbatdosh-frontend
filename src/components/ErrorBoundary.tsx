import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '100vh',
              padding: 'var(--space-5)',
              textAlign: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <div style={{ color: 'var(--text-secondary)' }}>
              <AlertTriangle size={40} />
            </div>
            <h2 style={{ margin: 0 }}>Something went wrong</h2>
            <p style={{ opacity: 0.7, margin: 0 }}>Please try reloading the app.</p>
            <button
              onClick={this.handleReload}
              style={{
                marginTop: '8px',
                padding: 'var(--space-3) var(--space-5)',
                borderRadius: 'var(--space-3)',
                border: 'none',
                background: 'var(--tg-theme-button-color, #3390ec)',
                color: 'var(--tg-theme-button-text-color, #fff)',
                fontSize: 'var(--space-4)',
                fontWeight: 600,
              }}
            >
              Reload
            </button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
