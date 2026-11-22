import React, { useState } from 'react';
import { ArrowLeft, Search } from 'lucide-react';
import { Movie, TmdbCatalog } from '../types';
import { MovieRow } from '../components/MovieRow';
import { filterMoviesByGenre } from '../services/logic';

interface GenresScreenProps {
  catalog: TmdbCatalog | null;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie?: (movie: Movie) => void;
  onBack: () => void;
  onSearchClick: () => void;
  initialGenre?: string;
}

export const GenresScreen: React.FC<GenresScreenProps> = ({
  catalog,
  onSelectMovie,
  onBack,
  onSearchClick,
  initialGenre = 'Action',
}) => {
  const [activeGenre, setActiveGenre] = useState<string>(initialGenre);

  const genreChips = ['Action', 'Comedy', 'Drama', 'Horror', 'Sci-Fi', 'Romance', 'Thriller', 'Documentary'];

  const allMovies = catalog?.all || [];
  const genreDiscoverMovies = catalog?.sections.byGenre?.[activeGenre] || [];
  const combinedGenreMovies =
    genreDiscoverMovies.length > 0
      ? genreDiscoverMovies
      : filterMoviesByGenre(allMovies, activeGenre);
  const top10Movies = catalog?.sections.top10 || [];

  return (
    <div className="flex-1 w-full bg-black text-white py-5 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 mb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10 cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Genres</h1>
        </div>
        <button
          type="button"
          onClick={onSearchClick}
          className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
          aria-label="Search genres"
        >
          <Search size={20} />
        </button>
      </div>

      {/* Genre Filter Strip */}
      <div className="flex items-center gap-2 px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 overflow-x-auto no-scrollbar py-2 mb-3">
        {genreChips.map((chip) => {
          const isActive = activeGenre.toLowerCase() === chip.toLowerCase();
          return (
            <button
              key={chip}
              type="button"
              onClick={() => setActiveGenre(chip)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#E50914] text-white shadow-md'
                  : 'bg-neutral-900 border border-neutral-700 text-neutral-300 hover:text-white hover:border-neutral-500'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Section 1: Popular in [Genre] */}
      <div className="mt-2">
        <MovieRow
          title={`Popular in ${activeGenre}`}
          movies={combinedGenreMovies.length > 0 ? combinedGenreMovies : allMovies.slice(0, 8)}
          onSelectMovie={onSelectMovie}
        />
      </div>

      {/* Section 2: Top 10 in Uganda Today */}
      <div className="mt-2">
        <MovieRow
          title="Top 10 in Uganda Today"
          movies={top10Movies}
          onSelectMovie={onSelectMovie}
          isTop10={true}
        />
      </div>

      {/* Section 3: Trending in [Genre] */}
      <div className="mt-2">
        <MovieRow
          title={`Trending ${activeGenre} Picks`}
          movies={[...combinedGenreMovies].reverse()}
          onSelectMovie={onSelectMovie}
        />
      </div>
    </div>
  );
};
