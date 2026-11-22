import React, { useState, useEffect } from 'react';

interface ResilientImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackGradient?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = 'w-full h-full object-cover',
  fallbackGradient = 'from-red-950/80 via-neutral-900 to-black',
}) => {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`w-full h-full bg-gradient-to-br ${fallbackGradient} relative overflow-hidden`}
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#E50914]/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-red-900/20 blur-3xl pointer-events-none" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
};
