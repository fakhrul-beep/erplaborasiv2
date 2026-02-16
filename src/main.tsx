
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Simple Error Boundary to catch rendering errors
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', fontFamily: 'system-ui' }}>
          <h1>Application Crashed</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            <summary>Error Details</summary>
            {this.state.error?.toString()}
            <br/>
            {this.state.error?.stack}
          </details>
          <button 
            onClick={() => window.location.reload()}
            style={{ marginTop: 20, padding: '8px 16px', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children; 
  }
}

console.log('Main.tsx: Starting application...');

const rootElement = document.getElementById('root');

if (!rootElement) {
  console.error('Failed to find the root element');
  document.body.innerHTML = '<h1 style="color: red">Error: Root element not found</h1>';
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    console.log('Main.tsx: Root created, rendering App...');
    
    root.render(
      <React.StrictMode>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </React.StrictMode>,
    );
    console.log('Main.tsx: Render called.');
  } catch (error) {
    console.error('Main.tsx: Error rendering app:', error);
    document.body.innerHTML = `<div style="color: red; padding: 20px;">
      <h1>Application Error (Root)</h1>
      <pre>${error instanceof Error ? error.message : String(error)}</pre>
    </div>`;
  }
}
