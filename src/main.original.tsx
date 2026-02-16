
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('Main.tsx: Starting application...');

try {
  const root = ReactDOM.createRoot(document.getElementById('root')!);
  console.log('Main.tsx: Root created, rendering App...');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
  console.log('Main.tsx: Render called.');
} catch (error) {
  console.error('Main.tsx: Error rendering app:', error);
  document.body.innerHTML = `<div style="color: red; padding: 20px;">
    <h1>Application Error</h1>
    <pre>${error instanceof Error ? error.message : String(error)}</pre>
  </div>`;
}
