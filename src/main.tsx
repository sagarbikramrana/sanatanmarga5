import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { HelmetProvider } from 'react-helmet-async';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry.ts';
import { initApiInterceptors } from './lib/apiConfig.ts';

// Initialize API interceptors for custom domains / split hosting
initApiInterceptors();

// Initialize Sentry Frontend Tracking
initSentry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.DEV) {
      // Development PWA Policy: Unregister active service workers and clear cache storage
      // to ensure Vite dependency chunks, HMR, and source assets are never served stale.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
    } else {
      // Production: Controlled migration and canonical service worker registration
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          const url = registration.active?.scriptURL || registration.installing?.scriptURL || registration.waiting?.scriptURL || '';
          if (url.endsWith('/sw.js')) {
            console.warn('[Service Worker Migration] Unregistering obsolete sw.js:', url);
            registration.unregister();
          }
        }
      });

      navigator.serviceWorker.register('/service-worker.js').catch((err) => {
        console.warn('[Service Worker] Primary registration notice:', err);
      });
    }
  });
}
