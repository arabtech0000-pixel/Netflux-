import React from 'react';
import { Plus } from 'lucide-react';
import { Profile } from '../types';
import { NetflixNLogo } from '../components/NetflixLogo';
import { AvatarIcon } from '../components/AvatarIcon';

interface ProfileSelectionScreenProps {
  profiles: Profile[];
  onSelectProfile: (profile: Profile) => void;
  onAddProfile: () => void;
  onManageProfiles: () => void;
}

export const ProfileSelectionScreen: React.FC<ProfileSelectionScreenProps> = ({
  profiles,
  onSelectProfile,
  onAddProfile,
  onManageProfiles,
}) => {
  return (
    <div className="min-h-screen w-full bg-black px-6 py-10 flex flex-col items-center justify-between select-none">
      {/* Top Netflix N Logo */}
      <div className="w-full flex items-center justify-center pt-2">
        <NetflixNLogo size={42} />
      </div>

      {/* Center Profiles Grid */}
      <div className="w-full max-w-md flex flex-col items-center my-auto py-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-10 tracking-tight text-center">
          Who&apos;s watching?
        </h1>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-8 gap-x-6 items-start justify-items-center w-full">
          {profiles.map((profile) => (
            <button
              key={profile.id}
              onClick={() => onSelectProfile(profile)}
              className="group flex flex-col items-center gap-2.5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="relative rounded-xl overflow-hidden border-2 border-transparent group-hover:border-white transition-all shadow-lg">
                <AvatarIcon
                  color={profile.avatarColor}
                  isKids={profile.isKids}
                  size="lg"
                  className="w-20 h-20 sm:w-24 sm:h-24"
                />
              </div>
              <span className="text-xs sm:text-sm font-medium text-neutral-300 group-hover:text-white transition-colors">
                {profile.name}
              </span>
            </button>
          ))}

          {/* Add Profile Tile */}
          <button
            onClick={onAddProfile}
            className="group flex flex-col items-center gap-2.5 active:scale-95 transition-transform cursor-pointer"
          >
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border-2 border-dashed border-neutral-700 group-hover:border-white bg-neutral-900/60 flex items-center justify-center text-neutral-400 group-hover:text-white transition-all shadow-md">
              <Plus size={32} className="stroke-[1.8]" />
            </div>
            <span className="text-xs sm:text-sm font-medium text-neutral-400 group-hover:text-white transition-colors">
              Add Profile
            </span>
          </button>
        </div>
      </div>

      {/* Bottom Manage Profiles Pill Button */}
      <div className="w-full flex justify-center pb-2">
        <button
          onClick={onManageProfiles}
          className="px-6 py-2 rounded-full border border-neutral-700 hover:border-neutral-400 text-xs sm:text-sm font-semibold text-neutral-300 hover:text-white active:scale-95 transition-all bg-neutral-900/50"
        >
          Manage Profiles
        </button>
      </div>
    </div>
  );
};
