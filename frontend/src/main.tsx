import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary label="la página">
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);

// Web estática (celular): guarda la app y los datos para abrirla sin conexión
if (import.meta.env.VITE_STATIC === '1' && 'serviceWorker' in navigator) {
  const cacheLoaded = () =>
    navigator.serviceWorker.ready.then((reg) => {
      const urls = [location.href.split('#')[0], ...performance.getEntriesByType('resource').map((r) => r.name)]
        .filter((u) => u.startsWith(location.origin));
      reg.active?.postMessage({ type: 'cache', urls });
    });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then(cacheLoaded).catch(() => {});
  });
  // Cuando terminan de bajar los datos del juego, también se guardan
  window.addEventListener('wh3-data-ready', () => { cacheLoaded().catch(() => {}); });
}
