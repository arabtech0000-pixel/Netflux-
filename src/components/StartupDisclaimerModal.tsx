import React from 'react';
import { MessageCircle, X, Zap } from 'lucide-react';
import { DEFAULT_DISCLAIMER_CONFIG, resolveWhatsappGroupUrl } from '../services/logic';

interface StartupDisclaimerModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  title?: string;
  message?: string;
  whatsappButtonLabel?: string;
  whatsappGroupUrl?: string;
  whatsappPrefillMessage?: string;
}

export const StartupDisclaimerModal: React.FC<StartupDisclaimerModalProps> = ({
  isOpen,
  onDismiss,
  title = DEFAULT_DISCLAIMER_CONFIG.disclaimerTitle,
  message = DEFAULT_DISCLAIMER_CONFIG.disclaimerMessage,
  whatsappButtonLabel = DEFAULT_DISCLAIMER_CONFIG.whatsappButtonLabel,
  whatsappGroupUrl = DEFAULT_DISCLAIMER_CONFIG.whatsappGroupUrl,
}) => {
  if (!isOpen) return null;

  const groupHref = resolveWhatsappGroupUrl(whatsappGroupUrl);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="startup-disclaimer-title"
      data-testid="startup-disclaimer-modal"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-2xl bg-zinc-50 text-zinc-950 border border-black/10 shadow-2xl p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#15803d] text-white flex items-center justify-center shrink-0">
              <MessageCircle size={19} />
            </div>
            <div>
              <h2
                id="startup-disclaimer-title"
                className="text-base sm:text-lg font-extrabold tracking-tight text-zinc-950"
              >
                {title || DEFAULT_DISCLAIMER_CONFIG.disclaimerTitle}
              </h2>
              <p className="text-xs text-[#15803d] font-bold flex items-center gap-1">
                <Zap size={12} className="shrink-0" />
                <span>{DEFAULT_DISCLAIMER_CONFIG.disclaimerBadge}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onDismiss}
            aria-label="Close disclaimer"
            data-testid="startup-disclaimer-close"
            className="min-w-[44px] min-h-[44px] -mt-1 -mr-1 rounded-xl text-zinc-500 hover:text-zinc-950 hover:bg-zinc-200/70 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <p
          data-testid="startup-disclaimer-message"
          className="text-sm sm:text-[15px] text-zinc-800 leading-relaxed font-medium"
        >
          {message || DEFAULT_DISCLAIMER_CONFIG.disclaimerMessage}
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          <a
            href={groupHref}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="startup-disclaimer-whatsapp-button"
            className="flex-1 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#15803d] hover:bg-[#166534] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm transition-colors whitespace-nowrap"
          >
            <MessageCircle size={17} className="shrink-0" />
            <span>{whatsappButtonLabel || DEFAULT_DISCLAIMER_CONFIG.whatsappButtonLabel}</span>
          </a>

          <button
            type="button"
            onClick={onDismiss}
            data-testid="startup-disclaimer-dismiss"
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-zinc-200 hover:bg-zinc-300 text-zinc-900 font-semibold text-xs sm:text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
};
