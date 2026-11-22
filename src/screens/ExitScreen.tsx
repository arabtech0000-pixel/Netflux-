import React from 'react';
import { NetflixNLogo } from '../components/NetflixLogo';
import { ResilientImage } from '../components/ResilientImage';

interface ExitScreenProps {
  onDone: () => void;
  backdropUrl?: string;
}

export const ExitScreen: React.FC<ExitScreenProps> = ({ onDone, backdropUrl }) => {
  return (
    <div className="relative min-h-screen w-full bg-black flex flex-col justify-between items-center p-8 sm:p-12 select-none overflow-hidden">
      {/* Background cinematic vignette */}
      <div className="absolute inset-0 z-0 opacity-20">
        <ResilientImage
          src={backdropUrl}
          alt="Cinematic ambient background"
          className="w-full h-full object-cover filter blur-xs"
          fallbackGradient="from-[#2b0509] via-neutral-950 to-black"
        />
        <div className="absolute inset-0 bg-radial from-transparent to-black" />
      </div>

      <div className="w-full" />

      {/* Center Content */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto">
        <NetflixNLogo size={64} className="mb-6 drop-shadow-[0_10px_30px_rgba(229,9,20,0.5)]" />
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          Thanks for watching!
        </h1>
        <p className="text-sm text-neutral-400 font-medium">
          See you soon.
        </p>
      </div>

      {/* Bottom Red Done Button */}
      <div className="relative z-10 w-full max-w-xs pb-4">
        <button
          onClick={onDone}
          className="w-full h-12 bg-[#E50914] hover:bg-[#f40612] active:scale-[0.98] text-white font-bold text-sm rounded-md shadow-lg transition-all"
        >
          Done
        </button>
      </div>
    </div>
  );
};
