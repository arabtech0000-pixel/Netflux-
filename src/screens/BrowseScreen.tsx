import React, { useState, useEffect } from 'react';
import { ChevronDown, ArrowLeft, Plus, Check } from 'lucide-react';
import { Movie, GenreBanner, CategoryTab } from '../types';
import { DEFAULT_GENRE_NAMES } from '../data/mockData';
import { Header } from '../components/Header';
import { MovieCard } from '../components/MovieCard';
import { ResilientImage } from '../components/ResilientImage';
import { filterMoviesByGenre, filterMoviesByType } from '../services/logic';

interface BrowseScreenProps {
  movies: Movie[];
  genreBanners: GenreBanner[];
  onSelectMovie: (movie: Movie) => void;
  onSelectGenre: (genreName: string) => void;
  onBack?: () => void;
  initialType?: 'all' | 'movie' | 'series';
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onCastClick?: () => void;
  onCategoryNavigate?: (category: CategoryTab) => void;
  unreadNotificationsCount?: number;
  watchlist?: string[];
  onToggleWatchlist?: (movieId: string) => void;
}

export const BrowseScreen: React.FC<BrowseScreenProps> = ({
  movies,
  genreBanners,
  onSelectMovie,
  onSelectGenre,
  onBack,
  initialType = 'all',
  onSearchClick,
  onNotificationsClick,
  onCastClick,
  onCategoryNavigate,
  unreadNotificationsCount = 0,
  watchlist = [],
  onToggleWatchlist,
}) => {
  const [selectedType, setSelectedType] = useState<'all' | 'movie' | 'series'>(initialType);
  const [activeGenreFilter, setActiveGenreFilter] = useState<string>('all');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isGenreDropdownOpen, setIsGenreDropdownOpen] = useState(false);

  useEffect(() => {
    setSelectedType(initialType);
  }, [initialType]);

  const genresList: GenreBanner[] =
    genreBanners.length > 0
      ? genreBanners
      : DEFAULT_GENRE_NAMES.map((name) => ({
          id: name.toLowerCase(),
          name,
          image: '',
        }));

  const filteredByType = filterMoviesByType(movies, selectedType);
  const filteredResults = filterMoviesByGenre(filteredByType, activeGenreFilter);

  const typeLabels = {
    all: 'All Categories',
    movie: 'Movies',
    series: 'TV Shows',
  };

  const activeHeaderCategory: CategoryTab = selectedType === 'series' ? 'TV Shows' : 'Movies';

  return (
    <div className="flex-1 w-full bg-black text-white flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      {/* Shared Desktop/Mobile Top Header */}
      {onCategoryNavigate && onSearchClick && onNotificationsClick && onCastClick && (
        <Header
          activeCategory={activeHeaderCategory}
          onCategoryChange={onCategoryNavigate}
          onSearchClick={onSearchClick}
          onNotificationsClick={onNotificationsClick}
          onCastClick={onCastClick}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      )}

      <div className="w-full px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 pt-22 sm:pt-24 flex flex-col">
        {/* Desktop Organized Header & Filter Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                aria-label="Back"
                className="md:hidden p-1.5 text-neutral-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white">
                {selectedType === 'movie'
                  ? 'Movies'
                  : selectedType === 'series'
                    ? 'TV Series'
                    : 'Movies & Series'}
              </h1>
              <p className="text-xs sm:text-sm text-neutral-400 mt-0.5">
                All {selectedType === 'movie' ? 'Movies' : selectedType === 'series' ? 'Series' : 'Movies and Series'} on Netflux ({filteredResults.length} titles)
              </p>
            </div>
          </div>

          {/* Filter Dropdowns aligned nicely on the right */}
          <div className="flex items-center gap-2.5 relative z-30">
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsGenreDropdownOpen(!isGenreDropdownOpen);
                  setIsTypeDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-lg text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
              >
                <span>{activeGenreFilter === 'all' ? 'All Genres' : activeGenreFilter}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isGenreDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isGenreDropdownOpen && (
                <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-1.5 w-48 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1.5 z-40">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveGenreFilter('all');
                      setIsGenreDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 text-xs hover:bg-neutral-800 ${
                      activeGenreFilter === 'all' ? 'text-[#E50914] font-bold' : 'text-neutral-300'
                    }`}
                  >
                    All Genres
                  </button>
                  {genresList.map((g) => (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => {
                        setActiveGenreFilter(g.name);
                        setIsGenreDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs hover:bg-neutral-800 ${
                        activeGenreFilter === g.name ? 'text-[#E50914] font-bold' : 'text-neutral-300'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsTypeDropdownOpen(!isTypeDropdownOpen);
                  setIsGenreDropdownOpen(false);
                }}
                className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 border border-neutral-700 hover:border-neutral-500 rounded-lg text-xs font-semibold text-neutral-200 transition-colors cursor-pointer"
              >
                <span>{typeLabels[selectedType]}</span>
                <ChevronDown
                  size={14}
                  className={`transition-transform ${isTypeDropdownOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isTypeDropdownOpen && (
                <div className="absolute top-full left-0 sm:right-0 sm:left-auto mt-1.5 w-40 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1.5 z-40">
                  {(['all', 'movie', 'series'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        setSelectedType(t);
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2 text-xs hover:bg-neutral-800 ${
                        selectedType === t ? 'text-[#E50914] font-bold' : 'text-neutral-300'
                      }`}
                    >
                      {typeLabels[t]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Genre Shortcuts Grid across full desktop width */}
        {activeGenreFilter === 'all' && (
          <div className="mb-7">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3">
              Browse by Genre
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-9 gap-2.5">
              {genresList.map((genre) => {
                const genreThemes: Record<string, { bg: string; accent: string }> = {
                  action: { bg: 'from-amber-950/90 via-red-950 to-black', accent: '#E50914' },
                  comedy: { bg: 'from-blue-950/90 via-indigo-950 to-black', accent: '#38bdf8' },
                  drama: { bg: 'from-neutral-900 via-stone-900 to-black', accent: '#a8a29e' },
                  horror: { bg: 'from-purple-950/90 via-neutral-950 to-black', accent: '#a855f7' },
                  'sci-fi': { bg: 'from-cyan-950/90 via-blue-950 to-black', accent: '#06b6d4' },
                  romance: { bg: 'from-pink-950/90 via-rose-950 to-black', accent: '#fb7185' },
                  thriller: { bg: 'from-red-950/90 via-neutral-950 to-black', accent: '#ef4444' },
                  documentary: { bg: 'from-emerald-950/90 via-teal-950 to-black', accent: '#10b981' },
                };
                const theme = genreThemes[genre.id] || {
                  bg: 'from-neutral-900 to-black',
                  accent: '#E50914',
                };

                return (
                  <button
                    key={genre.id}
                    type="button"
                    onClick={() => onSelectGenre(genre.name)}
                    className="group relative aspect-[16/10] rounded-xl overflow-hidden border border-white/10 hover:border-white/30 active:scale-95 transition-all text-left bg-neutral-950 shadow-md cursor-pointer"
                  >
                    <ResilientImage
                      src={genre.image}
                      alt={`${genre.name} banner`}
                      className="w-full h-full object-cover object-center opacity-80 group-hover:scale-105 transition-transform duration-300"
                      fallbackGradient={theme.bg}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/15" />
                    <div className="absolute bottom-2 left-2.5 right-2.5 flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-bold text-white group-hover:text-[#E50914] transition-colors drop-shadow truncate">
                        {genre.name}
                      </span>
                      <div
                        className="w-2 h-2 rounded-full ring-2 ring-black/50 shrink-0"
                        style={{ backgroundColor: theme.accent }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Dense Full-Width Desktop Poster Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
              {activeGenreFilter !== 'all' ? `${activeGenreFilter} Titles` : 'All Titles'}
            </h2>
            {activeGenreFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setActiveGenreFilter('all')}
                className="text-xs font-semibold text-[#E50914] hover:underline cursor-pointer"
              >
                Show All Genres
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3.5 sm:gap-4">
            {filteredResults.map((movie) => {
              const saved = watchlist.includes(movie.id);
              return (
                <div key={movie.id} className="relative group">
                  <MovieCard
                    movie={movie}
                    onSelect={onSelectMovie}
                    fullWidth={true}
                    showTitle={true}
                    subtitle={`${movie.year} · ${movie.type === 'series' ? 'Series' : 'Movie'}`}
                  />
                  {onToggleWatchlist && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleWatchlist(movie.id);
                      }}
                      aria-label={saved ? `Remove ${movie.title} from My List` : `Add ${movie.title} to My List`}
                      title={saved ? 'In My List' : 'Add to My List'}
                      className={`absolute top-2 right-2 z-20 w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer border ${
                        saved
                          ? 'bg-[#E50914] border-[#E50914] text-white opacity-100'
                          : 'bg-black/75 border-white/20 text-white opacity-0 group-hover:opacity-100 hover:bg-[#E50914] hover:border-[#E50914]'
                      }`}
                    >
                      {saved ? <Check size={13} /> : <Plus size={14} />}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
