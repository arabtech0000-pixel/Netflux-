import React from 'react';
import { Bell, ChevronRight, Trash2, ArrowLeft } from 'lucide-react';
import { NotificationItem, Movie } from '../types';
import { ResilientImage } from '../components/ResilientImage';
import { formatNotificationTimeAgo } from '../services/logic';

interface NotificationsScreenProps {
  movieDirectory: Record<string, Movie>;
  notifications: NotificationItem[];
  onSelectMovie: (movie: Movie) => void;
  onOpenNotification?: (item: NotificationItem) => void;
  onMarkAllAsRead: () => void;
  onClearNotifications: () => void;
  onBack?: () => void;
}

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  movieDirectory,
  notifications,
  onSelectMovie,
  onOpenNotification,
  onMarkAllAsRead,
  onClearNotifications,
  onBack,
}) => {
  const handleItemClick = (item: NotificationItem) => {
    if (onOpenNotification) {
      onOpenNotification(item);
      return;
    }
    if (item.movieId) {
      const match = movieDirectory[item.movieId];
      if (match) onSelectMovie(match);
    }
  };

  return (
    <div
      data-testid="notifications-screen"
      className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24"
    >
      <div className="w-full max-w-5xl mx-auto flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <Bell size={22} className="text-[#E50914]" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
              Notifications
            </h1>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="min-h-[44px] px-3 text-xs font-semibold text-neutral-300 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
                title="Mark all as read"
              >
                Mark Read
              </button>
              <button
                type="button"
                onClick={onClearNotifications}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-red-500 rounded-lg hover:bg-white/10 cursor-pointer"
                title="Clear all"
                aria-label="Clear all notifications"
              >
                <Trash2 size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Notifications Grid */}
        {notifications.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {notifications.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={`text-left p-3.5 rounded-xl border border-white/10 hover:border-white/25 flex items-center justify-between gap-3.5 group cursor-pointer transition-all ${
                  !item.read ? 'bg-white/[0.04]' : 'bg-neutral-950/70'
                }`}
              >
                <div className="relative w-18 h-18 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                  <ResilientImage
                    src={item.thumbnailUrl}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                  {!item.read && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#E50914] ring-1 ring-black" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-bold text-neutral-100 group-hover:text-white mb-0.5 truncate">
                    {item.title}
                  </h4>
                  <p className="text-[11px] sm:text-xs text-neutral-400 line-clamp-2 leading-snug">
                    {item.message}
                  </p>
                  <span className="text-[10px] text-neutral-500 mt-1 block">
                    {formatNotificationTimeAgo(item.createdAt, item.timeAgo)}
                  </span>
                </div>

                <ChevronRight size={18} className="text-neutral-500 group-hover:text-white shrink-0" />
              </button>
            ))}
          </div>
        ) : (
          <div className="py-20 flex flex-col items-center justify-center text-center bg-neutral-950/60 border border-white/5 rounded-2xl">
            <Bell size={40} className="text-neutral-600 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">No notifications</h3>
            <p className="text-xs text-neutral-400 max-w-xs">
              We&apos;ll let you know when new seasons, movies, or recommendations arrive.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
