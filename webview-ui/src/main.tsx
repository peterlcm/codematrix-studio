import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import BrowserApp from './BrowserApp';
import './styles/index.css';

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[CodeMatrix Webview] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[CodeMatrix Webview] Unhandled promise rejection:', event.reason);
});

// Check if running in VS Code webview or standalone browser
const isVSCodeWebview = typeof window.acquireVsCodeApi === 'function';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {isVSCodeWebview ? <App /> : <BrowserApp />}
  </React.StrictMode>,
);
