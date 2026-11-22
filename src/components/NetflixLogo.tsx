import React from 'react';

interface NetflixNProps {
  className?: string;
  size?: number;
}

export const NetflixNLogo: React.FC<NetflixNProps> = ({ className = '', size = 36 }) => {
  return (
    <svg
      width={size}
      height={size * 1.8}
      viewBox="0 0 111 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
      aria-label="Netflux"
    >
      {/* Left vertical ribbon */}
      <path
        d="M0 0H33.3V200H0V0Z"
        fill="#B81D24"
      />
      {/* Right vertical ribbon */}
      <path
        d="M77.7 0H111V200H77.7V0Z"
        fill="#B81D24"
      />
      {/* Center diagonal ribbon (front with shadow and bright red) */}
      <path
        d="M0 0L77.7 200H111L33.3 0H0Z"
        fill="#E50914"
      />
      {/* Shadow overlay on the diagonal ribbon for 3D depth */}
      <path
        d="M0 0L77.7 200H111L33.3 0H0Z"
        fill="url(#netflix-n-shadow)"
        opacity="0.35"
      />
      <defs>
        <linearGradient
          id="netflix-n-shadow"
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#000000" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#000000" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.8" />
        </linearGradient>
      </defs>
    </svg>
  );
};

export const NetflixWordmark: React.FC<{ className?: string; width?: number }> = ({
  className = '',
  width = 110,
}) => {
  return (
    <span
      className={`font-bebas tracking-[0.22em] text-[#E50914] select-none text-2xl font-bold uppercase leading-none ${className}`}
      style={{ letterSpacing: '0.18em' }}
    >
      NETFLUX
    </span>
  );
};
