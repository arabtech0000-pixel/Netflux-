import React from 'react';
import { Bell, X, Play } from 'lucide-react';
import { NotificationItem } from '../types';
import { ResilientImage } from './ResilientImage';

interface UploadNotificationToastProps {
  notification: NotificationItem | null;
  onOpen: (notification: NotificationItem) => void;
  onDismiss: () => void;
}

export const UploadNotificationToast: React.FC<UploadNotificationToastProps> = ({
  notification,
  onOpen,
  onDismiss,
}) => {
  if (!notification) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="upload-notification-toast"
      className="fixed bottom-20 md:bottom-6 right-4 left-4 sm:left-auto sm:w-96 z-50 border border-neutral-700 bg-neutral-950/95 backdrop-blur-md rounded-xl p-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-bottom-3"
    >
      <div className="relative w-12 h-14 rounded-lg overflow-hidden bg-neutral-900 shrink-0 border border-neutral-800">
        <ResilientImage
          src={notification.thumbnailUrl}
          alt={notification.title}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-1 left-1 w-2 h-2 rounded-full bg-[#E50914] ring-1 ring-black" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#E50914] mb-0.5">
          <Bell size={11} />
          <span>New Movie Alert</span>
        </div>
        <h4 className="text-xs sm:text-sm font-bold text-white truncate">
          {notification.title}
        </h4>
        <p className="text-[11px] text-neutral-300 line-clamp-1">
          {notification.message}
        </p>
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpen(notification)}
            className="min-h-[32px] px-3 rounded-md bg-[#E50914] hover:bg-[#f40612] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Play size={11} className="fill-white" />
            <span>Watch Now</span>
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[32px] px-2.5 rounded-md border border-neutral-800 bg-black hover:bg-neutral-900 text-neutral-300 text-[11px] font-semibold cursor-pointer"
          >
            Later
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="min-w-[44px] min-h-[44px] -mr-1.5 -mt-1.5 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg cursor-pointer shrink-0"
      >
        <X size={16} />
      </button>
    </div>
  );
};
