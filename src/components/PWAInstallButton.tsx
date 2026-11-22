import React, { useState } from 'react';
import { Download, MonitorDown, Share, PlusSquare, ChevronRight, X, Smartphone } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card' | 'settings';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'card' }) => {
  const { isInstallable, isInstalled, isIOS, isEmbeddedIframe, installAction, install } =
    usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Never display install controls when already running inside installed standalone app
  if (isInstalled) {
    return null;
  }

  // In header, only show when native install prompt or iOS Safari install flow is directly applicable
  if (variant === 'header' && !isInstallable && !isIOS) {
    return null;
  }

  const handleInstallClick = async () => {
    if (installAction === 'native-prompt') {
      const accepted = await install();
      if (!accepted) {
        return;
      }
      return;
    }
    setShowGuideModal(true);
  };

  return (
    <>
      {variant === 'header' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="h-8 px-2.5 sm:px-3 rounded-lg bg-[#E50914] hover:bg-[#f40612] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-red-950/50 active:scale-95 transition-all cursor-pointer"
          aria-label="Install Netflux App"
          title="Install App"
        >
          <Download size={14} className="shrink-0" />
          <span className="hidden sm:inline">Install App</span>
        </button>
      )}

      {variant === 'card' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
          data-testid="pwa-install-card-button"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#E50914]/20 text-[#E50914] flex items-center justify-center shrink-0">
              <Download size={18} />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                Install App
              </span>
              <span className="text-[11px] text-neutral-400">
                {isInstallable
                  ? 'Add Netflux to your device home screen'
                  : isIOS
                    ? 'Add to iPhone / iPad Home Screen'
                    : 'Install Netflux as a standalone web app'}
              </span>
            </div>
          </div>
          <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
        </button>
      )}

      {variant === 'settings' && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="p-4 flex items-center justify-between text-left group bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-colors cursor-pointer"
          data-testid="pwa-install-settings-button"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-9 h-9 rounded-lg bg-[#E50914]/20 flex items-center justify-center text-[#E50914]">
              <Download size={18} />
            </div>
            <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
              Install Web App
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-400">
              {isInstallable ? 'Ready' : isIOS ? 'iOS Safari' : 'Guide'}
            </span>
            <ChevronRight
              size={16}
              className="text-neutral-500 group-hover:text-white transition-colors"
            />
          </div>
        </button>
      )}

      {showGuideModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-guide-title"
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in"
        >
          <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2.5">
                <img
                  src="/pwa-192x192.png"
                  alt="Netflux"
                  className="w-8 h-8 rounded-lg object-cover border border-white/15 shrink-0"
                />
                <h3 id="pwa-install-guide-title" className="font-bold text-white text-base">
                  {isIOS ? 'Install on iPhone / iPad' : 'Install Netflux App'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {isIOS ? (
              <div className="flex flex-col gap-3 text-xs sm:text-sm text-neutral-200">
                <p className="text-neutral-400 text-xs">
                  Safari installs web apps directly from your Share menu:
                </p>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/80 border border-white/5">
                  <Share size={18} className="text-[#E50914] shrink-0" />
                  <span>
                    1. Tap the <strong className="text-white">Share</strong> button in your Safari toolbar.
                  </span>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/80 border border-white/5">
                  <PlusSquare size={18} className="text-[#E50914] shrink-0" />
                  <span>
                    2. Scroll down and tap <strong className="text-white">Add to Home Screen</strong>, then tap <strong className="text-white">Add</strong>.
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-xs sm:text-sm text-neutral-200">
                <p className="text-neutral-400 text-xs">
                  {isEmbeddedIframe
                    ? 'Preview frames block native install prompts. Open the published app URL directly in its own browser tab to install:'
                    : 'Install Netflux to launch full-screen from your home screen or desktop app dock:'}
                </p>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-800/80 border border-white/5">
                  <MonitorDown size={18} className="text-[#E50914] shrink-0 mt-0.5" />
                  <span>
                    On Desktop Chrome / Edge: click the <strong className="text-white">Install</strong> icon on the right side of your address bar, or open browser menu → <strong className="text-white">Cast, save, and share → Install Netflux</strong>.
                  </span>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-xl bg-neutral-800/80 border border-white/5">
                  <Smartphone size={18} className="text-[#E50914] shrink-0 mt-0.5" />
                  <span>
                    On Android Chrome: tap the browser <strong className="text-white">⋮ menu</strong> and select <strong className="text-white">Install app</strong> or <strong className="text-white">Add to Home screen</strong>.
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="w-full py-2.5 bg-[#E50914] hover:bg-[#f40612] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
