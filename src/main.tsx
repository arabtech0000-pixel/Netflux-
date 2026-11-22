import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { RootErrorBoundary } from './components/RootErrorBoundary.tsx';
import './index.css';

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  // Clean up any legacy dev-sw.js service workers that could trap browsers on stale assets
  void navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      for (const reg of regs) {
        const scriptUrl = reg.active?.scriptURL || reg.waiting?.scriptURL || reg.installing?.scriptURL || '';
        if (scriptUrl.includes('dev-sw.js')) {
          void reg.unregister();
        }
      }
    })
    .catch(() => {});

  if (import.meta.env.PROD) {
    registerSW({
      immediate: true,
      onRegisterError() {
        // Non-fatal if browser or embedded iframe blocks service worker registration
      },
    });
  }
}

try {
  sessionStorage.removeItem('netflux_chunk_recover');
} catch {
  // Ignore sessionStorage restrictions
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);
