import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Global error handler
window.addEventListener('error', (event) => {
  console.error('[CodeMatrix Webview] Uncaught error:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[CodeMatrix Webview] Unhandled promise rejection:', event.reason);
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);