import React, { useState } from 'react';
import {
  Users,
  Crown,
  HelpCircle,
  LogOut,
  Settings,
  ChevronRight,
  Bookmark,
  MessageCircle,
  ShieldCheck,
} from 'lucide-react';
import { Profile, SubscriptionPlan } from '../types';
import { AvatarIcon } from '../components/AvatarIcon';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { buildAdminWhatsAppUrl } from '../services/logic';

interface MyNetflixScreenProps {
  currentProfile: Profile;
  profiles: Profile[];
  currentPlan: SubscriptionPlan;
  watchlistCount?: number;
  isAdminUser?: boolean;
  onOpenAdmin?: () => void;
  onOpenMyList: () => void;
  onSwitchProfile: (profile: Profile) => void;
  onManageProfiles: () => void;
  onOpenSubscription: () => void;
  onOpenPaymentMethods: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
}

export const MyNetflixScreen: React.FC<MyNetflixScreenProps> = ({
  currentProfile,
  profiles,
  currentPlan,
  watchlistCount = 0,
  isAdminUser = false,
  onOpenAdmin,
  onOpenMyList,
  onSwitchProfile,
  onManageProfiles,
  onOpenSubscription,
  onOpenSettings,
  onSignOut,
}) => {
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showProfileSwitcher, setShowProfileSwitcher] = useState(false);

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-6xl mx-auto flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">My Netflux</h1>
        </div>

        {/* Desktop 2-Column Organized Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          {/* Left Column: Profile Card & Switcher */}
          <div className="lg:col-span-4 bg-neutral-950/90 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center text-center">
            <button
              type="button"
              onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
              className="relative group cursor-pointer focus:outline-none"
            >
              <AvatarIcon
                color={currentProfile.avatarColor}
                isKids={currentProfile.isKids}
                size="xl"
                className="w-24 h-24 rounded-2xl ring-4 ring-white/10 group-hover:ring-[#E50914] transition-all shadow-xl"
              />
            </button>
            <h2 className="text-lg font-bold text-white mt-3 tracking-tight flex items-center gap-1.5">
              <span>{currentProfile.name}</span>
              {currentProfile.isKids && (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-bold px-1.5 py-0.5 rounded">
                  KIDS
                </span>
              )}
            </h2>
            <p className="text-xs text-amber-400 font-semibold mt-1">{currentPlan.name}</p>
            <button
              type="button"
              onClick={() => setShowProfileSwitcher(!showProfileSwitcher)}
              className="text-xs text-neutral-400 hover:text-white mt-2 transition-colors cursor-pointer"
            >
              Switch profile ▾
            </button>

            {showProfileSwitcher && (
              <div className="flex items-center justify-center flex-wrap gap-3.5 mt-4 p-3 bg-neutral-900 border border-white/10 rounded-2xl w-full animate-in fade-in">
                {profiles.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onSwitchProfile(p);
                      setShowProfileSwitcher(false);
                    }}
                    className="flex flex-col items-center gap-1.5 cursor-pointer"
                  >
                    <div
                      className={`relative rounded-lg overflow-hidden ${
                        p.id === currentProfile.id ? 'ring-2 ring-[#E50914]' : 'opacity-70 hover:opacity-100'
                      }`}
                    >
                      <AvatarIcon color={p.avatarColor} isKids={p.isKids} size="sm" />
                    </div>
                    <span className="text-[10px] text-neutral-300 truncate max-w-[56px]">{p.name}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="text-center text-[10px] text-neutral-500 mt-6 pt-4 border-t border-white/5 w-full">
              <span>Netflux Streaming · Uganda</span>
            </div>
          </div>

          {/* Right Column: Account & Community List + Conditional Admin Button + Sign Out */}
          <div className="lg:col-span-8 flex flex-col gap-2">
            {isAdminUser && onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                data-testid="my-netflix-admin-button"
                className="w-full flex items-center justify-between p-4 bg-[#E50914]/15 hover:bg-[#E50914]/25 border border-[#E50914]/40 rounded-xl transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-[#E50914] text-white flex items-center justify-center shrink-0">
                    <ShieldCheck size={18} />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="text-xs sm:text-sm font-bold text-white">
                      Admin Panel
                    </span>
                    <span className="text-[11px] text-neutral-300">
                      Catalog, VJs & site configuration
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-300 group-hover:text-white" />
              </button>
            )}

            {/* 1. My List */}
            <button
              type="button"
              onClick={onOpenMyList}
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#E50914]/20 text-[#E50914] flex items-center justify-center">
                  <Bookmark size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                    My List
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {watchlistCount} {watchlistCount === 1 ? 'saved title' : 'saved titles'}
                  </span>
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </button>

            {/* 2. Manage Profiles */}
            <button
              type="button"
              onClick={onManageProfiles}
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 group-hover:text-white">
                  <Users size={18} />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                  Manage Profiles
                </span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </button>

            {/* 3. Your Plan */}
            <button
              type="button"
              onClick={onOpenSubscription}
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Crown size={18} />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                    Your Plan
                  </span>
                  <span className="text-[11px] text-amber-400 font-medium">{currentPlan.name}</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </button>

            {/* 4. Settings */}
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 group-hover:text-white">
                  <Settings size={18} />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                  Settings
                </span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </button>

            {/* Install App (PWA) */}
            <PWAInstallButton variant="card" />

            {/* 5. Help Center (Direct 1-Click WhatsApp Admin Support) */}
            <a
              href={buildAdminWhatsAppUrl('Hello Netflux Admin, I need help.')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
              data-testid="help-center-whatsapp-link"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/15 text-[#25D366] flex items-center justify-center shrink-0">
                  <HelpCircle size={18} />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                  Help Center
                </span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </a>

            {/* 6. Join WhatsApp Channel */}
            <a
              href="https://whatsapp.com/channel/0029VazB22oEFeXpRzIEEL1q"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/20 text-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="fill-[#25D366]/30" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-[#25D366] transition-colors">
                  Join WhatsApp Channel
                </span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </a>

            {/* 7. Join WhatsApp Group */}
            <a
              href="https://chat.whatsapp.com/EfjzgGyIIBJ1i017P0VlAB?s=cl&p=a&iam=2"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-[#25D366]/20 text-[#25D366] flex items-center justify-center shrink-0">
                  <MessageCircle size={18} className="fill-[#25D366]/30" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-[#25D366] transition-colors">
                  Join WhatsApp Group
                </span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-white" />
            </a>

            {/* Sign Out */}
            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="w-full flex items-center justify-between p-4 bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-all group text-red-500 hover:text-red-400 mt-2 cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-lg bg-red-950/40 text-red-500 flex items-center justify-center">
                  <LogOut size={18} />
                </div>
                <span className="text-xs sm:text-sm font-semibold">Sign Out</span>
              </div>
              <ChevronRight size={16} className="text-neutral-500 group-hover:text-red-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 max-w-xs w-full text-center">
            <LogOut size={36} className="text-[#E50914] mx-auto mb-2" />
            <h3 className="font-bold text-white text-base mb-1">Sign Out of Netflux?</h3>
            <p className="text-xs text-neutral-400 mb-5">
              You will need to sign back in with your email or phone number to resume watching.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSignOut}
                className="flex-1 py-2 rounded-lg bg-[#E50914] text-white text-xs font-bold cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
