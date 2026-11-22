import React from 'react';
import { Home, Tv, Download, Search, User, Plus, ShieldCheck } from 'lucide-react';
import { MainTabType, Profile, ScreenType } from '../types';

interface DesktopSideNavProps {
  activeTab: MainTabType;
  currentScreen: ScreenType;
  onTabChange: (tab: MainTabType) => void;
  onNavigateScreen: (screen: ScreenType) => void;
  currentProfile?: Profile;
  isAdminUser?: boolean;
}

export const DesktopSideNav: React.FC<DesktopSideNavProps> = ({
  activeTab,
  currentScreen,
  onTabChange,
  onNavigateScreen,
  isAdminUser = false,
}) => {
  const navItems: Array<{
    id: string;
    label: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    isActive: boolean;
    onClick: () => void;
  }> = [
    {
      id: 'search',
      label: 'Search',
      icon: Search,
      isActive: currentScreen === 'search',
      onClick: () => onNavigateScreen('search'),
    },
    {
      id: 'home',
      label: 'Home',
      icon: Home,
      isActive: currentScreen === 'home',
      onClick: () => onTabChange('home'),
    },
    {
      id: 'tv-shows',
      label: 'TV Shows',
      icon: Tv,
      isActive: currentScreen === 'tv-shows' || currentScreen === 'games',
      onClick: () => onTabChange('tv-shows'),
    },
    {
      id: 'my-netflix',
      label: 'My Netflux',
      icon: User,
      isActive:
        currentScreen === 'my-netflix' ||
        currentScreen === 'subscription' ||
        currentScreen === 'payment' ||
        currentScreen === 'settings',
      onClick: () => onTabChange('my-netflix'),
    },
    {
      id: 'downloads',
      label: 'Downloads',
      icon: Download,
      isActive: currentScreen === 'downloads',
      onClick: () => onTabChange('downloads'),
    },
    {
      id: 'my-list',
      label: 'My List',
      icon: Plus,
      isActive: currentScreen === 'my-list',
      onClick: () => onNavigateScreen('my-list'),
    },
    ...(isAdminUser
      ? [
          {
            id: 'admin',
            label: 'Admin Panel',
            icon: ShieldCheck,
            isActive: currentScreen === 'admin',
            onClick: () => onNavigateScreen('admin'),
          },
        ]
      : []),
  ];

  return (
    <aside
      aria-label="Desktop Side Navigation"
      className="hidden md:flex fixed left-3 lg:left-4 top-1/2 -translate-y-1/2 z-40 flex-col items-center gap-2 p-2 rounded-[26px] bg-neutral-950/90 backdrop-blur-md border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.85)] select-none"
    >
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            onClick={item.onClick}
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-150 cursor-pointer group ${
              item.isActive
                ? 'bg-[#E50914] text-white shadow-[0_4px_18px_rgba(229,9,20,0.65)] scale-105'
                : 'text-neutral-300 hover:text-white hover:bg-white/10'
            }`}
            aria-label={item.label}
            aria-current={item.isActive ? 'page' : undefined}
            title={item.label}
          >
            <Icon
              size={18}
              className={item.isActive ? 'stroke-[2.4]' : 'stroke-[1.9]'}
            />
          </button>
        );
      })}
    </aside>
  );
};
