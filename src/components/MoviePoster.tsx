import React, { useState, useEffect } from 'react';
import { NetflixNLogo } from './NetflixLogo';
import { Film } from 'lucide-react';

interface MoviePosterProps {
  title: string;
  posterUrl?: string;
  isOriginal?: boolean;
  quality?: string;
  className?: string;
  genres?: string[];
}

const GENRE_GRADIENTS: Record<string, { bg: string; accent: string }> = {
  Action: { bg: 'from-[#290b08] via-[#1c1110] to-[#080808]', accent: '#E50914' },
  'Sci-Fi': { bg: 'from-[#071e2b] via-[#0f172a] to-[#06080c]', accent: '#38bdf8' },
  Horror: { bg: 'from-[#1a0513] via-[#1f0a12] to-[#080406]', accent: '#f43f5e' },
  Comedy: { bg: 'from-[#1f1606] via-[#1c1917] to-[#0a0a0a]', accent: '#f59e0b' },
  Drama: { bg: 'from-[#1c1917] via-[#262626] to-[#0a0a0a]', accent: '#a8a29e' },
  Thriller: { bg: 'from-[#1e0a0a] via-[#171717] to-[#050505]', accent: '#ef4444' },
  Romance: { bg: 'from-[#280817] via-[#1f1218] to-[#090507]', accent: '#fb7185' },
  Documentary: { bg: 'from-[#062119] via-[#0f1f1a] to-[#060a08]', accent: '#10b981' },
};

export const MoviePoster: React.FC<MoviePosterProps> = ({
  title,
  posterUrl,
  isOriginal = true,
  quality = '4K Ultra HD',
  className = '',
  genres = [],
}) => {
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    setLoadFailed(false);
  }, [posterUrl]);

  const primaryGenre = genres[0] || 'Drama';
  const theme = GENRE_GRADIENTS[primaryGenre] || {
    bg: 'from-[#141414] via-[#222222] to-[#0d0d0d]',
    accent: '#E50914',
  };

  if (posterUrl && !loadFailed) {
    return (
      <div className={`relative w-full h-full bg-neutral-900 overflow-hidden ${className}`}>
        <img
          src={posterUrl}
          alt={title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
          onError={() => setLoadFailed(true)}
          loading="lazy"
        />
        {isOriginal && (
          <div className="absolute top-1.5 left-1.5 z-20 drop-shadow-md pointer-events-none">
            <NetflixNLogo size={11} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={`relative w-full h-full bg-gradient-to-b ${theme.bg} p-2 flex flex-col justify-between select-none overflow-hidden border border-white/5 ${className}`}
    >
      <div className="flex items-start justify-between w-full z-10">
        {isOriginal ? (
          <NetflixNLogo size={12} />
        ) : (
          <Film size={12} className="text-white/40" />
        )}
        <span className="text-[8px] font-bold text-white/50 border border-white/20 px-1 rounded-xs">
          {quality === '4K Ultra HD' ? '4K' : 'HD'}
        </span>
      </div>

      <div className="flex flex-col items-center justify-center text-center my-auto px-1 z-10">
        <span
          className="font-bebas text-sm sm:text-base font-black tracking-wider text-white uppercase leading-tight line-clamp-2"
          style={{
            textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          }}
        >
          {title}
        </span>
        <span
          className="text-[8px] font-bold tracking-widest uppercase mt-0.5"
          style={{ color: theme.accent }}
        >
          {primaryGenre}
        </span>
      </div>

      <div className="w-full text-center z-10">
        <span className="text-[8px] text-neutral-400 font-medium truncate block">
          {genres.slice(0, 2).join(' · ')}
        </span>
      </div>

      <div
        className="absolute -bottom-6 -right-6 w-20 h-20 rounded-full blur-xl opacity-30 pointer-events-none"
        style={{ backgroundColor: theme.accent }}
      />
    </div>
  );
};
