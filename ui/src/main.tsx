import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { JARVIS_CONFIG } from './utils/jarvisConfig';
import './index.css';

declare global {
  interface Window {
    __JARVIS_INSTALL_PROMPT__?: any;
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__JARVIS_INSTALL_PROMPT__ = e;
    window.dispatchEvent(new Event('jarvis-pwa-installable'));
  });

  if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(JARVIS_CONFIG.offlineMode.serviceWorkerPath || './sw.js')
        .catch(() => {
          // Ignore service worker registration warnings in restricted WebViews
        });
    });
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
