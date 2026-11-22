import React, { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  Tv,
  Subtitles,
  Wifi,
  PlayCircle,
  Bell,
  Shield,
  Globe,
  Lock,
  Info,
  Check,
} from 'lucide-react';
import { AppSettings } from '../types';
import { PWAInstallButton } from '../components/PWAInstallButton';

interface SettingsScreenProps {
  settings: AppSettings;
  onUpdateSettings: (settings: AppSettings) => void;
  onBack: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  settings,
  onUpdateSettings,
  onBack,
}) => {
  const [activeModal, setActiveModal] = useState<string | null>(null);

  const settingsItems = [
    { id: 'playback', label: 'Playback Settings', icon: Tv, value: settings.playbackQuality },
    { id: 'subtitles', label: 'Subtitle Appearance', icon: Subtitles, value: `${settings.subtitleSize}, ${settings.subtitleColor}` },
    { id: 'datasaver', label: 'Data Saver', icon: Wifi, value: settings.dataSaver },
    { id: 'autoplay', label: 'Auto-Play', icon: PlayCircle, value: settings.autoPlayNextEpisode ? 'On' : 'Off' },
    { id: 'notifications', label: 'Notifications', icon: Bell, value: settings.notificationsPush ? 'Enabled' : 'Disabled' },
    { id: 'privacy', label: 'Privacy & Data', icon: Shield, value: 'Protected' },
    { id: 'language', label: 'Language', icon: Globe, value: settings.appLanguage },
    { id: 'permissions', label: 'App Permissions', icon: Lock, value: 'Configured' },
    { id: 'about', label: 'About', icon: Info, value: 'v10.4.2' },
  ];

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-5xl mx-auto flex flex-col">
        {/* Top Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Settings</h1>
        </div>

        {/* Settings Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => setActiveModal(item.id)}
                className="p-4 flex items-center justify-between text-left group bg-neutral-950 hover:bg-neutral-900 border border-white/10 rounded-xl transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-9 h-9 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-300 group-hover:text-white">
                    <Icon size={18} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white">
                    {item.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-neutral-400">{item.value}</span>
                  <ChevronRight size={16} className="text-neutral-500 group-hover:text-white transition-colors" />
                </div>
              </button>
            );
          })}
          <PWAInstallButton variant="settings" />
        </div>
      </div>

      {/* Sub-setting Modals */}
      {activeModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in">
          <div className="w-full sm:max-w-md bg-neutral-900 border border-neutral-700 rounded-t-3xl sm:rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="font-bold text-white text-base">
                {settingsItems.find((s) => s.id === activeModal)?.label}
              </h3>
              <button onClick={() => setActiveModal(null)} className="text-xs text-neutral-400 hover:text-white">
                Done
              </button>
            </div>

            {/* Playback Settings Modal */}
            {activeModal === 'playback' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-neutral-400">Video Playback Quality</span>
                {(['Auto', 'Good', 'High', 'Ultra'] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      onUpdateSettings({ ...settings, playbackQuality: q });
                    }}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 text-xs font-semibold"
                  >
                    <span>{q}</span>
                    {settings.playbackQuality === q && <Check size={16} className="text-[#E50914]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Subtitles Appearance Modal */}
            {activeModal === 'subtitles' && (
              <div className="flex flex-col gap-3">
                <span className="text-xs text-neutral-400">Subtitle Size</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['Small', 'Medium', 'Large'] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateSettings({ ...settings, subtitleSize: s })}
                      className={`p-2 rounded-lg text-xs font-semibold border ${
                        settings.subtitleSize === s
                          ? 'border-[#E50914] bg-[#E50914]/20 text-white'
                          : 'border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                <span className="text-xs text-neutral-400 mt-2">Subtitle Color</span>
                <div className="grid grid-cols-3 gap-2">
                  {(['White', 'Yellow', 'Cyan'] as const).map((c) => (
                    <button
                      key={c}
                      onClick={() => onUpdateSettings({ ...settings, subtitleColor: c })}
                      className={`p-2 rounded-lg text-xs font-semibold border ${
                        settings.subtitleColor === c
                          ? 'border-[#E50914] bg-[#E50914]/20 text-white'
                          : 'border-neutral-700 text-neutral-400'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Data Saver Modal */}
            {activeModal === 'datasaver' && (
              <div className="flex flex-col gap-2">
                {(['Automatic', 'Wi-Fi Only', 'Save Data', 'Maximum'] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => onUpdateSettings({ ...settings, dataSaver: d })}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 text-xs font-semibold"
                  >
                    <span>{d}</span>
                    {settings.dataSaver === d && <Check size={16} className="text-[#E50914]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Auto Play Modal */}
            {activeModal === 'autoplay' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-xl">
                  <div>
                    <div className="text-xs font-bold text-white">Autoplay Next Episode</div>
                    <div className="text-[10px] text-neutral-400">Play next episode automatically</div>
                  </div>
                  <button
                    onClick={() =>
                      onUpdateSettings({ ...settings, autoPlayNextEpisode: !settings.autoPlayNextEpisode })
                    }
                    className={`w-10 h-5 rounded-full relative flex items-center p-0.5 ${
                      settings.autoPlayNextEpisode ? 'bg-[#E50914]' : 'bg-neutral-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.autoPlayNextEpisode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Notifications Modal */}
            {activeModal === 'notifications' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-3 bg-neutral-800 rounded-xl">
                  <div className="text-xs font-bold text-white">Push Notifications</div>
                  <button
                    onClick={() =>
                      onUpdateSettings({ ...settings, notificationsPush: !settings.notificationsPush })
                    }
                    className={`w-10 h-5 rounded-full relative flex items-center p-0.5 ${
                      settings.notificationsPush ? 'bg-[#E50914]' : 'bg-neutral-600'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-full bg-white transition-transform ${
                        settings.notificationsPush ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            )}

            {/* Language Modal */}
            {activeModal === 'language' && (
              <div className="flex flex-col gap-2">
                {['English', 'Luganda', 'Swahili', 'Español', 'Français'].map((lang) => (
                  <button
                    key={lang}
                    onClick={() => onUpdateSettings({ ...settings, appLanguage: lang })}
                    className="flex items-center justify-between p-3 rounded-xl bg-neutral-800 text-xs font-semibold"
                  >
                    <span>{lang}</span>
                    {settings.appLanguage === lang && <Check size={16} className="text-[#E50914]" />}
                  </button>
                ))}
              </div>
            )}

            {/* Privacy or About Modal */}
            {(activeModal === 'privacy' || activeModal === 'permissions' || activeModal === 'about') && (
              <div className="text-xs text-neutral-300 leading-relaxed p-2">
                <p className="mb-2">
                  Netflux Clone Application is designed for high-fidelity mobile streaming simulations.
                </p>
                <p className="text-neutral-500 text-[11px]">
                  Build 2026.11 · All rights reserved · End-to-end local storage active.
                </p>
              </div>
            )}

            <button
              onClick={() => setActiveModal(null)}
              className="w-full py-2.5 bg-[#E50914] text-white font-bold text-xs rounded-xl mt-2"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
