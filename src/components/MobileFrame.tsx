import React from 'react';
import { ScreenType } from '../types';

interface MobileFrameProps {
  children: React.ReactNode;
  currentScreen?: ScreenType;
  onNavigate?: (screen: ScreenType) => void;
  showFrameByDefault?: boolean;
}

export const MobileFrame: React.FC<MobileFrameProps> = ({ children }) => {
  return (
    <div className="min-h-screen w-full bg-black text-white flex flex-col relative overflow-x-hidden selection:bg-[#E50914] selection:text-white">
      <main className="flex-1 w-full flex flex-col relative overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};
