import React from 'react';
import { Home, Tv, Download } from 'lucide-react';
import { MainTabType, Profile } from '../types';
import { AvatarIcon } from './AvatarIcon';

interface BottomNavProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  currentProfile?: Profile;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  currentProfile,
}) => {
  const tabs = [
    {
      id: 'home' as MainTabType,
      label: 'Home',
      icon: Home,
    },
    {
      id: 'tv-shows' as MainTabType,
      label: 'TV Shows',
      icon: Tv,
    },
    {
      id: 'downloads' as MainTabType,
      label: 'Download',
      icon: Download,
    },
    {
      id: 'my-netflix' as MainTabType,
      label: 'My Netflux',
      isAvatar: true,
    },
  ];

  return (
    <nav
      aria-label="Application Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-black/95 backdrop-blur-md border-t border-white/10 px-4 pt-2 pb-2 shrink-0 select-none shadow-[0_-10px_25px_rgba(0,0,0,0.8)]"
    >
      <div className="grid grid-cols-4 items-center justify-between max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive =
            activeTab === tab.id ||
            (tab.id === 'tv-shows' && activeTab === 'games');
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-1 transition-all group relative ${
                isActive ? 'text-[#E50914]' : 'text-neutral-400 hover:text-white'
              }`}
              aria-label={tab.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {tab.isAvatar ? (
                <div
                  className={`p-0.5 rounded transition-transform ${
                    isActive ? 'ring-2 ring-[#E50914] scale-105' : 'opacity-80 group-hover:opacity-100'
                  }`}
                >
                  <AvatarIcon
                    color={currentProfile?.avatarColor || '#1E88E5'}
                    isKids={currentProfile?.isKids}
                    size="sm"
                    className="w-5 h-5 rounded-xs"
                  />
                </div>
              ) : (
                Icon && (
                  <Icon
                    size={20}
                    className={`transition-transform ${
                      isActive ? 'stroke-[2.5] scale-105' : 'stroke-[1.8]'
                    }`}
                  />
                )
              )}
              <span
                className={`text-[10px] tracking-tight leading-tight whitespace-nowrap ${
                  isActive ? 'font-bold text-[#E50914]' : 'font-medium'
                }`}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
