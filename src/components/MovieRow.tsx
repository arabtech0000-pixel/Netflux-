import React, { useRef } from 'react';
import { Movie } from '../types';
import { MovieCard } from './MovieCard';
import { ChevronRight } from 'lucide-react';

interface MovieRowProps {
  title: string;
  movies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie?: (movie: Movie) => void;
  isTop10?: boolean;
  onSeeAll?: () => void;
  cardSize?: 'sm' | 'md' | 'lg';
}

export const MovieRow: React.FC<MovieRowProps> = ({
  title,
  movies,
  onSelectMovie,
  onPlayMovie,
  isTop10 = false,
  onSeeAll,
  cardSize = 'md',
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  if (!movies || movies.length === 0) return null;

  return (
    <section className="py-2.5 flex flex-col w-full">
      {/* Row Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 mb-2.5 select-none">
        <h2 className="text-sm sm:text-base md:text-lg font-bold text-white tracking-tight flex items-center gap-1">
          {title}
        </h2>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs text-neutral-400 hover:text-white flex items-center transition-colors cursor-pointer"
          >
            See all
            <ChevronRight size={14} />
          </button>
        )}
      </div>

      {/* Horizontal Carousel */}
      <div
        ref={rowRef}
        className="flex items-center gap-2.5 sm:gap-3.5 px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 overflow-x-auto no-scrollbar scroll-smooth"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {movies.map((movie, index) => (
          <div key={movie.id} style={{ scrollSnapAlign: 'start' }}>
            <MovieCard
              movie={movie}
              onSelect={onSelectMovie}
              onPlay={onPlayMovie}
              rankNumber={isTop10 ? index + 1 : undefined}
              size={cardSize}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
