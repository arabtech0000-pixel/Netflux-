import React from 'react';

interface AvatarIconProps {
  color?: string; // hex or bg class
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isKids?: boolean;
  className?: string;
  name?: string;
}

export const AvatarIcon: React.FC<AvatarIconProps> = ({
  color = '#1E88E5',
  size = 'md',
  isKids = false,
  className = '',
  name,
}) => {
  const sizeMap = {
    sm: 'w-7 h-7 rounded-md text-xs',
    md: 'w-12 h-12 rounded-lg text-sm',
    lg: 'w-20 h-20 rounded-xl text-base',
    xl: 'w-24 h-24 rounded-2xl text-lg',
  };

  const eyeSize = {
    sm: 'w-1 h-1',
    md: 'w-1.5 h-1.5',
    lg: 'w-2.5 h-2.5',
    xl: 'w-3 h-3',
  }[size];

  const smileWidth = {
    sm: 'w-3 h-1.5',
    md: 'w-5 h-2.5',
    lg: 'w-9 h-4',
    xl: 'w-11 h-5',
  }[size];

  // Kids profile has colorful rainbow block or 'KIDS' badge
  if (isKids) {
    return (
      <div
        className={`${sizeMap[size]} flex flex-col items-center justify-center font-bold text-white bg-gradient-to-tr from-yellow-400 via-pink-500 to-indigo-600 shadow-md ${className}`}
      >
        <span className="font-bebas tracking-wider text-xs md:text-sm">KIDS</span>
      </div>
    );
  }

  return (
    <div
      className={`${sizeMap[size]} relative flex items-center justify-center shrink-0 shadow-md select-none overflow-hidden ${className}`}
      style={{ backgroundColor: color }}
      title={name}
    >
      {/* Authentic Netflix smiley face */}
      <div className="flex flex-col items-center justify-center gap-1.5">
        <div className="flex items-center gap-2">
          {/* Eyes */}
          <div className={`${eyeSize} bg-white rounded-full`} />
          <div className={`${eyeSize} bg-white rounded-full`} />
        </div>
        {/* Smile curve */}
        <div
          className={`${smileWidth} border-b-[2px] md:border-b-[2.5px] border-white rounded-b-full`}
        />
      </div>
    </div>
  );
};
