import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Without this, any uncaught render error anywhere in the app unmounts the
 * entire screen to blank white with zero feedback — impossible to debug from
 * a screenshot. This catches it and shows the actual error instead. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, maxWidth: 700, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#b64545' }}>Something went wrong rendering this page</h2>
          <p style={{ fontFamily: '-apple-system, sans-serif' }}>
            This is the actual error, instead of a blank screen — please copy this and share it:
          </p>
          <pre style={{ background: '#f6dede', padding: 16, borderRadius: 8, overflowX: 'auto', whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}
          >
            Back to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}