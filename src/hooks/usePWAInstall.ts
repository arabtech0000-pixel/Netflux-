import { useEffect, useState, useCallback } from 'react';
import { detectPwaPlatform, resolvePwaInstallAction, type PwaInstallAction } from '../services/logic';

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// Module-level store so a `beforeinstallprompt` fired before React mounts is never lost
let capturedPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();
let globalListenersAttached = false;

function attachGlobalPwaListeners() {
  if (globalListenersAttached || typeof window === 'undefined') return;
  globalListenersAttached = true;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    capturedPrompt = e as BeforeInstallPromptEvent;
    promptListeners.forEach((cb) => cb());
  });

  window.addEventListener('appinstalled', () => {
    capturedPrompt = null;
    promptListeners.forEach((cb) => cb());
  });
}

attachGlobalPwaListeners();

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(
    () => capturedPrompt
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isEmbeddedIframe, setIsEmbeddedIframe] = useState(false);

  useEffect(() => {
    attachGlobalPwaListeners();

    const syncPlatformState = () => {
      const displayStandalone =
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(display-mode: standalone)').matches;
      const navStandalone =
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      let inIframe = false;
      try {
        inIframe = window.self !== window.top;
      } catch {
        inIframe = true;
      }

      const info = detectPwaPlatform(
        window.navigator.userAgent,
        displayStandalone,
        navStandalone,
        inIframe
      );
      setIsInstalled(info.isStandalone);
      setIsIOS(info.isIOS);
      setIsEmbeddedIframe(info.isEmbeddedIframe);
      setDeferredPrompt(capturedPrompt);
    };

    syncPlatformState();

    const handlePromptSync = () => {
      setDeferredPrompt(capturedPrompt);
    };
    const handleAppInstalled = () => {
      setIsInstalled(true);
      capturedPrompt = null;
      setDeferredPrompt(null);
    };

    promptListeners.add(handlePromptSync);
    window.addEventListener('appinstalled', handleAppInstalled);

    const mediaQuery =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(display-mode: standalone)')
        : null;
    const handleDisplayChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setIsInstalled(true);
      }
    };
    mediaQuery?.addEventListener?.('change', handleDisplayChange);

    return () => {
      promptListeners.delete(handlePromptSync);
      window.removeEventListener('appinstalled', handleAppInstalled);
      mediaQuery?.removeEventListener?.('change', handleDisplayChange);
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    const promptEvent = deferredPrompt || capturedPrompt;
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      capturedPrompt = null;
      setDeferredPrompt(null);
      return true;
    }
    return false;
  }, [deferredPrompt]);

  const installAction: PwaInstallAction = resolvePwaInstallAction(
    isInstalled,
    Boolean(deferredPrompt),
    isIOS
  );

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isEmbeddedIframe,
    installAction,
    install,
  };
}
