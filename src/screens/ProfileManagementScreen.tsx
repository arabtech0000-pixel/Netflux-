import React, { useState } from 'react';
import { ArrowLeft, Trash2, Check, X, ShieldAlert } from 'lucide-react';
import { Profile } from '../types';
import { AvatarIcon } from '../components/AvatarIcon';
import { AVATAR_OPTIONS } from '../data/mockData';

interface ProfileManagementScreenProps {
  profiles: Profile[];
  onSaveProfile: (profile: Profile) => void;
  onDeleteProfile: (profileId: string) => void;
  onBack: () => void;
  initialEditingProfile?: Profile | null;
}

export const ProfileManagementScreen: React.FC<ProfileManagementScreenProps> = ({
  profiles,
  onSaveProfile,
  onDeleteProfile,
  onBack,
  initialEditingProfile,
}) => {
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(
    initialEditingProfile || null
  );

  // Form states when editing or creating
  const [name, setName] = useState(selectedProfile?.name || '');
  const [color, setColor] = useState(selectedProfile?.avatarColor || '#1E88E5');
  const [isKids, setIsKids] = useState(selectedProfile?.isKids || false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startEdit = (p: Profile) => {
    setSelectedProfile(p);
    setName(p.name);
    setColor(p.avatarColor);
    setIsKids(p.isKids);
    setError(null);
  };

  const startCreateNew = () => {
    const newP: Profile = {
      id: `p-${Date.now()}`,
      name: '',
      avatarColor: '#43A047',
      avatarBg: 'bg-emerald-600',
      avatarIcon: 'smile-green',
      isKids: false,
    };
    setSelectedProfile(newP);
    setName('');
    setColor('#43A047');
    setIsKids(false);
    setError(null);
  };

  const handleSave = () => {
    if (!name.trim()) {
      setError('Profile name cannot be empty.');
      return;
    }

    const targetId = selectedProfile?.id || `p-${Date.now()}`;
    const matchedOption = AVATAR_OPTIONS.find((opt) => opt.color === color);

    const updated: Profile = {
      id: targetId,
      name: name.trim(),
      avatarColor: color,
      avatarBg: matchedOption?.bg || 'bg-blue-600',
      avatarIcon: matchedOption?.id || 'smile-blue',
      isKids: isKids,
    };

    onSaveProfile(updated);
    setSelectedProfile(null);
  };

  const handleDelete = (id: string) => {
    if (profiles.length <= 1) {
      setError('You must keep at least one profile.');
      setConfirmDeleteId(null);
      return;
    }
    onDeleteProfile(id);
    setConfirmDeleteId(null);
    setSelectedProfile(null);
  };

  // If currently editing/creating a single profile
  if (selectedProfile) {
    return (
      <div className="min-h-screen w-full bg-black px-6 py-8 flex flex-col justify-between overflow-y-auto no-scrollbar">
        <div>
          {/* Top Bar */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedProfile(null)}
              className="p-1 text-neutral-400 hover:text-white"
            >
              <ArrowLeft size={22} />
            </button>
            <h2 className="text-base font-bold text-white">
              {profiles.some((p) => p.id === selectedProfile.id) ? 'Edit Profile' : 'Create Profile'}
            </h2>
            <div className="w-6" />
          </div>

          {/* Avatar Preview */}
          <div className="flex flex-col items-center mb-6">
            <AvatarIcon
              color={color}
              isKids={isKids}
              size="xl"
              className="w-24 h-24 mb-3 rounded-2xl ring-4 ring-white/10"
            />
            <span className="text-xs text-neutral-400">Choose Profile Icon Color</span>
          </div>

          {/* Color/Avatar Palette */}
          <div className="flex items-center justify-center gap-2.5 mb-6 flex-wrap max-w-xs mx-auto">
            {AVATAR_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setColor(opt.color)}
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  color === opt.color ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                }`}
                style={{ backgroundColor: opt.color }}
                title={opt.label}
              >
                {color === opt.color && <Check size={16} className="text-white drop-shadow" />}
              </button>
            ))}
          </div>

          {/* Name Field */}
          <div className="mb-5 max-w-xs mx-auto">
            <label className="text-xs font-semibold text-neutral-300 block mb-1.5">
              Profile Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter name"
              maxLength={20}
              className="w-full h-11 px-3.5 bg-neutral-900 border border-neutral-700 focus:border-white rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none"
            />
          </div>

          {/* Kids Mode Toggle */}
          <div className="max-w-xs mx-auto bg-neutral-900/80 border border-white/10 rounded-xl p-3.5 flex items-center justify-between mb-6">
            <div>
              <div className="text-xs font-bold text-white">Kids Profile</div>
              <div className="text-[11px] text-neutral-400">Only titles rated for ages 12 & under</div>
            </div>
            <button
              type="button"
              onClick={() => setIsKids(!isKids)}
              className={`w-12 h-6 rounded-full transition-colors relative flex items-center p-0.5 ${
                isKids ? 'bg-[#E50914]' : 'bg-neutral-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  isKids ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {error && (
            <div className="max-w-xs mx-auto mb-4 text-xs text-red-400 text-center">
              {error}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-2.5 max-w-xs mx-auto w-full pt-4">
          <button
            onClick={handleSave}
            className="w-full h-11 bg-[#E50914] hover:bg-[#f40612] text-white font-bold text-sm rounded-lg transition-all"
          >
            Save Profile
          </button>

          <button
            onClick={() => setSelectedProfile(null)}
            className="w-full h-11 bg-neutral-900 text-neutral-300 hover:text-white font-semibold text-sm rounded-lg transition-all"
          >
            Cancel
          </button>

          {profiles.some((p) => p.id === selectedProfile.id) && (
            <button
              onClick={() => setConfirmDeleteId(selectedProfile.id)}
              className="w-full py-2 text-xs text-red-500 hover:text-red-400 font-medium flex items-center justify-center gap-1.5 transition-colors mt-2"
            >
              <Trash2 size={14} />
              Delete Profile
            </button>
          )}
        </div>

        {/* Delete Confirmation Modal */}
        {confirmDeleteId && (
          <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-neutral-900 border border-neutral-700 rounded-2xl p-5 max-w-xs w-full text-center">
              <ShieldAlert size={36} className="text-[#E50914] mx-auto mb-2" />
              <h3 className="font-bold text-white text-base mb-1">Delete this profile?</h3>
              <p className="text-xs text-neutral-400 mb-5">
                All watch history, My List, and ratings for this profile will be permanently deleted.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="flex-1 py-2 rounded-lg bg-neutral-800 text-neutral-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  className="flex-1 py-2 rounded-lg bg-[#E50914] text-white text-xs font-bold"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Manage Profiles Master Grid (with edit pen overlays)
  return (
    <div className="flex-1 w-full bg-black px-6 py-6 flex flex-col justify-between overflow-y-auto no-scrollbar">
      <div>
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onBack} aria-label="Back" className="p-1 text-neutral-400 hover:text-white">
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-base font-bold text-white">Manage Profiles</h1>
          <button
            onClick={onBack}
            className="text-xs font-bold text-[#E50914] hover:underline"
          >
            Done
          </button>
        </div>

        <p className="text-xs text-neutral-400 text-center mb-6">
          Tap any profile to edit avatar, rename, or delete.
        </p>

        {/* Grid of Profiles */}
        <div className="grid grid-cols-2 gap-y-7 gap-x-6 items-start justify-items-center max-w-xs mx-auto">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => startEdit(profile)}
              className="group flex flex-col items-center gap-2 relative active:scale-95 transition-transform"
            >
              <div className="relative rounded-xl overflow-hidden border border-white/20 shadow-md">
                <AvatarIcon
                  color={profile.avatarColor}
                  isKids={profile.isKids}
                  size="lg"
                  className="w-20 h-20 opacity-80 group-hover:opacity-100"
                />
                {/* Pencil icon overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-black/80 border border-white/30 flex items-center justify-center text-white">
                    <svg className="w-4 h-4 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </div>
                </div>
              </div>
              <span className="text-xs font-semibold text-neutral-200">
                {profile.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="pt-8 flex flex-col items-center gap-3">
        <button
          onClick={startCreateNew}
          className="w-full max-w-xs h-11 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <span>Add New Profile</span>
        </button>

        <button
          onClick={onBack}
          className="w-full max-w-xs h-11 bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white font-semibold text-xs rounded-lg transition-colors"
        >
          Done
        </button>
      </div>
    </div>
  );
};
