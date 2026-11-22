import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import { RootErrorBoundary } from './components/RootErrorBoundary.tsx';
import './index.css';

interface NativeBridgeApi {
  apiRequestAsync?: (
    reqId: string,
    pathAndQuery: string,
    method: string,
    headersJson: string,
    body: string
  ) => void;
}

const nativeBridge: NativeBridgeApi | undefined =
  typeof window !== 'undefined' ? (window as any).NetfluxBridge : undefined;
const isAndroidApkWebView = Boolean(nativeBridge?.apiRequestAsync);

if (isAndroidApkWebView && nativeBridge?.apiRequestAsync) {
  const pendingNativeCalls = new Map<
    string,
    { resolve: (res: Response) => void; reject: (err: unknown) => void }
  >();
  let nativeReqCounter = 0;

  (window as any).__netfluxResolveNativeApi = (
    reqId: string,
    status: number,
    bodyText: string
  ) => {
    const entry = pendingNativeCalls.get(reqId);
    if (!entry) return;
    pendingNativeCalls.delete(reqId);
    entry.resolve(
      new Response(bodyText ?? '', {
        status: Number(status) || 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const rawUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    let parsedUrl: URL | null = null;
    try {
      parsedUrl = new URL(rawUrl, window.location.origin);
    } catch {
      parsedUrl = null;
    }

    const method = (
      init?.method ||
      (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET') ||
      'GET'
    ).toUpperCase();

    const isSameOriginApi =
      parsedUrl !== null &&
      parsedUrl.origin === window.location.origin &&
      parsedUrl.pathname.startsWith('/api/');

    const needsBridge =
      isSameOriginApi &&
      parsedUrl !== null &&
      (method !== 'GET' && method !== 'HEAD' ||
        parsedUrl.pathname.startsWith('/api/admin/') ||
        parsedUrl.pathname.startsWith('/api/users/'));

    if (!needsBridge || !parsedUrl) {
      return originalFetch(input, init);
    }

    const headersObj: Record<string, string> = {};
    if (typeof Request !== 'undefined' && input instanceof Request) {
      input.headers.forEach((value, key) => {
        headersObj[key] = value;
      });
    }
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => {
        headersObj[key] = value;
      });
    }

    let bodyText = '';
    if (typeof init?.body === 'string') {
      bodyText = init.body;
    } else if (typeof Request !== 'undefined' && input instanceof Request && !init?.body) {
      try {
        bodyText = await input.clone().text();
      } catch {
        bodyText = '';
      }
    }

    const reqId = `apk_${++nativeReqCounter}_${Date.now()}`;
    const pathAndQuery = `${parsedUrl.pathname}${parsedUrl.search}`;

    return new Promise<Response>((resolve, reject) => {
      pendingNativeCalls.set(reqId, { resolve, reject });
      try {
        nativeBridge.apiRequestAsync!(
          reqId,
          pathAndQuery,
          method,
          JSON.stringify(headersObj),
          bodyText
        );
      } catch (err) {
        pendingNativeCalls.delete(reqId);
        reject(err);
      }
    });
  };
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (isAndroidApkWebView) {
    // Ensure APK bundled assets load cleanly without Service Worker interception
    void navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  } else {
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
