import React from 'react';
import { Movie } from '../types';
import { MoviePoster } from './MoviePoster';
import { Play } from 'lucide-react';

interface MovieCardProps {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  onPlay?: (movie: Movie) => void;
  rankNumber?: number;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  showTitle?: boolean;
  subtitle?: string;
}

export const MovieCard: React.FC<MovieCardProps> = ({
  movie,
  onSelect,
  rankNumber,
  size = 'md',
  fullWidth = false,
  showTitle = false,
  subtitle,
}) => {
  const dimensions = fullWidth
    ? 'w-full aspect-[2/3]'
    : {
        sm: 'w-24 h-36 min-w-[96px]',
        md: 'w-28 h-42 min-w-[112px] sm:w-34 sm:h-50 sm:min-w-[136px] md:w-38 md:h-56 md:min-w-[152px]',
        lg: 'w-36 h-54 min-w-[144px] sm:w-42 sm:h-62 sm:min-w-[168px]',
      }[size];

  if (rankNumber !== undefined && rankNumber > 0) {
    return (
      <div
        className="relative flex items-end shrink-0 cursor-pointer group select-none pr-1"
        role="button"
        tabIndex={0}
        aria-label={`Movie: ${movie.title}`}
        data-movie-title={movie.title}
        onClick={() => onSelect(movie)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(movie);
          }
        }}
      >
        <div
          className="relative text-[95px] sm:text-[115px] md:text-[128px] font-black leading-[0.75] font-bebas text-black select-none z-0 translate-x-2.5 sm:translate-x-3"
          style={{
            WebkitTextStroke: '3.5px #595959',
            textShadow: '0 4px 12px rgba(0,0,0,0.8)',
          }}
          aria-hidden="true"
        >
          {rankNumber}
        </div>

        <div
          className={`${dimensions} relative z-10 rounded-md overflow-hidden bg-neutral-900 shadow-lg border border-white/10 group-hover:border-white/40 transition-all duration-200 group-active:scale-95`}
        >
          <MoviePoster
            title={movie.title}
            posterUrl={movie.posterUrl}
            isOriginal={movie.isOriginal}
            quality={movie.quality}
            genres={movie.genres}
          />
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative cursor-pointer group select-none flex flex-col ${
        fullWidth ? 'w-full' : 'shrink-0'
      } ${showTitle || subtitle ? 'gap-1.5' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Movie: ${movie.title}`}
      data-movie-title={movie.title}
      onClick={() => onSelect(movie)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(movie);
        }
      }}
    >
      <div
        className={`${dimensions} relative rounded-md overflow-hidden bg-neutral-900 shadow-md border border-white/10 group-hover:border-white/40 transition-all duration-200 group-active:scale-95`}
      >
        <MoviePoster
          title={movie.title}
          posterUrl={movie.posterUrl}
          isOriginal={movie.isOriginal}
          quality={movie.quality}
          genres={movie.genres}
        />

        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
          <div
            className="w-9 h-9 rounded-full bg-white/90 text-black flex items-center justify-center shadow-md transition-transform"
            aria-hidden="true"
          >
            <Play size={15} className="fill-black ml-0.5" />
          </div>
        </div>
      </div>

      {showTitle && (
        <div className={`flex flex-col ${fullWidth ? 'w-full' : 'max-w-[112px] sm:max-w-[136px] md:max-w-[152px]'}`}>
          <span className="text-xs text-neutral-200 font-semibold truncate group-hover:text-white transition-colors">
            {movie.title}
          </span>
          <span className="text-[11px] text-neutral-400 truncate">
            {subtitle || `${movie.year} · ${movie.type === 'series' ? 'Series' : 'Movie'}`}
          </span>
        </div>
      )}
    </div>
  );
};
