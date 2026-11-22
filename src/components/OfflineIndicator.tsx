import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-5 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600/95 backdrop-blur-sm border border-amber-400/30 px-3.5 py-2 text-xs font-semibold text-white shadow-xl"
    >
      <WifiOff size={14} className="shrink-0" />
      <span>Offline Mode — Cached content available</span>
    </div>
  );
};
