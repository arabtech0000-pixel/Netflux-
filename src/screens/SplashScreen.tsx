import React, { useEffect } from 'react';
import { NetflixNLogo, NetflixWordmark } from '../components/NetflixLogo';

interface SplashScreenProps {
  onFinish: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish }) => {
  const onFinishRef = React.useRef(onFinish);
  onFinishRef.current = onFinish;

  useEffect(() => {
    const timer = setTimeout(() => {
      onFinishRef.current();
    }, 1800);
    return () => clearTimeout(timer);
  }, []);

  const handleContinue = () => onFinishRef.current();

  return (
    <div
      onClick={handleContinue}
      className="min-h-screen w-full bg-black flex flex-col items-center justify-between p-8 sm:p-12 select-none cursor-pointer"
      title="Tap to continue"
    >
      <div className="w-full flex justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleContinue();
          }}
          className="text-xs text-white/40 hover:text-white px-2 py-1 rounded transition-colors"
        >
          Skip
        </button>
      </div>

      {/* Center Netflix N and NETFLIX wordmark */}
      <div className="flex flex-col items-center justify-center gap-6 animate-in zoom-in-95 duration-700">
        <NetflixNLogo size={70} className="drop-shadow-[0_10px_35px_rgba(229,9,20,0.45)]" />
        <NetflixWordmark className="text-3xl tracking-[0.25em]" />
      </div>

      {/* Bottom Red Loading Spinner */}
      <div className="flex flex-col items-center gap-4 pb-6">
        <div className="w-6 h-6 border-2 border-red-950 border-t-[#E50914] rounded-full animate-spin" />
      </div>

      {/* Subtle bottom vignette matching reference image */}
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#E50914]/15 to-transparent pointer-events-none" />
    </div>
  );
};
