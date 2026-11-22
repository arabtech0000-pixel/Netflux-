import React from 'react';
import { Cast, Search, Bell } from 'lucide-react';
import { NetflixNLogo } from './NetflixLogo';
import { CategoryTab } from '../types';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onCastClick: () => void;
  unreadNotificationsCount?: number;
  activeCategory?: CategoryTab;
  onCategoryChange?: (category: CategoryTab) => void;
  showCategories?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onSearchClick,
  onNotificationsClick,
  onCastClick,
  unreadNotificationsCount = 2,
  activeCategory = 'Home',
  onCategoryChange,
  showCategories = true,
}) => {
  const categories: CategoryTab[] = ['Home', 'TV Shows', 'Movies', 'VJs'];

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-4 sm:px-7 pt-1.5 pb-3 transition-all">
      {/* 1. DESKTOP HEADER (Left N Logo | Centered Categories | Right 3 Icons: Stream, Search, Notification) */}
      <div className="hidden md:grid md:grid-cols-3 items-center h-14 w-full">
        {/* Left Corner: Netflux Logo */}
        <div className="flex items-center justify-self-start shrink-0">
          <button
            type="button"
            onClick={() => onCategoryChange?.('Home')}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Netflux Home"
          >
            <NetflixNLogo size={26} />
          </button>
        </div>

        {/* Centered Middle: Words (Home, TV Shows, Movies, VJs) */}
        <div className="justify-self-center flex items-center justify-center">
          {showCategories && (
            <nav
              aria-label="Desktop Content Categories"
              className="flex items-center justify-center gap-8 lg:gap-11 text-sm font-semibold select-none"
            >
              {categories.map((cat) => {
                const isActive = activeCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => onCategoryChange?.(cat)}
                    className={`relative py-1 whitespace-nowrap transition-all cursor-pointer ${
                      isActive
                        ? 'text-white font-bold drop-shadow-[0_2px_8px_rgba(255,255,255,0.4)]'
                        : 'text-neutral-300 hover:text-white'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    {cat}
                    {isActive && (
                      <span className="absolute -bottom-1 inset-x-0 h-[2.5px] bg-[#E50914] rounded-full shadow-[0_0_10px_rgba(229,9,20,0.9)]" />
                    )}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right Corner: Three Icons (Stream, Search, Notification) + PWA Install when promptable */}
        <div className="flex items-center gap-2 justify-self-end shrink-0">
          <PWAInstallButton variant="header" />
          <button
            type="button"
            onClick={onCastClick}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Connect to Cast Device"
            title="Stream to TV"
          >
            <Cast size={20} className="stroke-[1.8]" />
          </button>

          <button
            type="button"
            onClick={onSearchClick}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-all cursor-pointer"
            aria-label="Search movies and series"
            title="Search movies and series"
          >
            <Search size={20} className="stroke-[1.8]" />
          </button>

          <button
            type="button"
            onClick={onNotificationsClick}
            className="w-10 h-10 rounded-full hover:bg-white/10 flex items-center justify-center text-white/90 hover:text-white relative active:scale-95 transition-all cursor-pointer"
            aria-label="View notifications"
            title="Notifications"
          >
            <Bell size={20} className="stroke-[1.8]" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-[#E50914] ring-2 ring-black animate-pulse" />
            )}
          </button>
        </div>
      </div>

      {/* 2. MOBILE HEADER (Two-tier layout) */}
      <div className="md:hidden flex flex-col">
        <div className="flex items-center justify-between h-11 max-w-5xl mx-auto w-full">
          <div className="flex items-center">
            <NetflixNLogo size={20} />
          </div>

          <div className="flex items-center gap-1 sm:gap-2">
            <PWAInstallButton variant="header" />
            <button
              type="button"
              onClick={onCastClick}
              className="w-10 h-10 flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-transform cursor-pointer"
              aria-label="Connect to Cast Device"
            >
              <Cast size={20} className="stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={onSearchClick}
              className="w-10 h-10 flex items-center justify-center text-white/90 hover:text-white active:scale-95 transition-transform cursor-pointer"
              aria-label="Search movies and series"
            >
              <Search size={20} className="stroke-[1.8]" />
            </button>

            <button
              type="button"
              onClick={onNotificationsClick}
              className="w-10 h-10 flex items-center justify-center text-white/90 hover:text-white relative active:scale-95 transition-transform cursor-pointer"
              aria-label="View notifications"
            >
              <Bell size={20} className="stroke-[1.8]" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-[#E50914] ring-2 ring-black" />
              )}
            </button>
          </div>
        </div>

        {showCategories && (
          <nav
            aria-label="Content Categories"
            className="flex items-center justify-around sm:justify-center sm:gap-12 pt-1 text-sm font-medium border-b border-white/5 pb-1 select-none max-w-5xl mx-auto w-full"
          >
            {categories.map((cat) => {
              const isActive = activeCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onCategoryChange?.(cat)}
                  className={`relative px-2 py-1 text-xs sm:text-sm transition-colors whitespace-nowrap ${
                    isActive ? 'text-white font-semibold' : 'text-neutral-400 hover:text-neutral-200'
                  }`}
                >
                  {cat}
                  {isActive && (
                    <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-[#E50914] rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
};
