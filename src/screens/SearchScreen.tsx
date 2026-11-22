import React, { useState, useEffect, useRef } from 'react';
import { Search, X, ArrowUpRight, Film, ArrowLeft } from 'lucide-react';
import { Movie } from '../types';
import { MovieCard } from '../components/MovieCard';
import { MoviePoster } from '../components/MoviePoster';
import { searchMovies } from '../services/logic';
import { searchTmdbTitles } from '../services/tmdb';

interface SearchScreenProps {
  catalogMovies: Movie[];
  trendingMovies: Movie[];
  onSelectMovie: (movie: Movie) => void;
  onBack?: () => void;
  recentSearches: string[];
  onAddRecentSearch: (query: string) => void;
  onClearRecentSearches: () => void;
  onRemoveRecentSearch: (query: string) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  cachedSearchResults?: Movie[];
  onSearchResultsChange?: (results: Movie[]) => void;
}

export const SearchScreen: React.FC<SearchScreenProps> = ({
  catalogMovies,
  trendingMovies,
  onSelectMovie,
  onBack,
  recentSearches,
  onAddRecentSearch,
  onClearRecentSearches,
  onRemoveRecentSearch,
  searchQuery = '',
  onSearchQueryChange,
  cachedSearchResults = [],
  onSearchResultsChange,
}) => {
  const [query, setQuery] = useState(searchQuery);
  const [tmdbResults, setTmdbResults] = useState<Movie[]>(cachedSearchResults);
  const [isSearchingTmdb, setIsSearchingTmdb] = useState(false);
  const prevQueryRef = useRef(searchQuery);

  // Sync internal query if prop changes externally
  useEffect(() => {
    if (searchQuery !== query && searchQuery !== prevQueryRef.current) {
      setQuery(searchQuery);
      prevQueryRef.current = searchQuery;
    }
  }, [searchQuery]);

  useEffect(() => {
    onSearchQueryChange?.(query);
    prevQueryRef.current = query;
    const clean = query.trim();
    if (clean.length < 2) {
      setTmdbResults([]);
      setIsSearchingTmdb(false);
      onSearchResultsChange?.([]);
      return;
    }

    // If we already have cached results for this exact query upon remounting, skip redundant fetch
    if (query === searchQuery && cachedSearchResults.length > 0 && tmdbResults.length > 0) {
      return;
    }

    let cancelled = false;
    setIsSearchingTmdb(true);
    const timer = setTimeout(() => {
      searchTmdbTitles(clean)
        .then((items) => {
          if (!cancelled) {
            setTmdbResults(items);
            onSearchResultsChange?.(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setTmdbResults([]);
            onSearchResultsChange?.([]);
          }
        })
        .finally(() => {
          if (!cancelled) setIsSearchingTmdb(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const localResults = searchMovies(catalogMovies, query);
  const seenIds = new Set(localResults.map((m) => m.id));
  const searchResults = [
    ...localResults,
    ...tmdbResults.filter((m) => !seenIds.has(m.id)),
  ];

  const trendingList = trendingMovies.slice(0, 8);

  const handleSearchSubmit = (searchTerm: string) => {
    setQuery(searchTerm);
    onAddRecentSearch(searchTerm);
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 mb-6">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="w-10 h-11 flex items-center justify-center text-neutral-400 hover:text-white rounded-lg hover:bg-neutral-900 transition-colors shrink-0 cursor-pointer"
              aria-label="Go Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="relative flex-1 max-w-3xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search for movies, TV shows, genres..."
              className="w-full h-12 pl-10 pr-10 bg-neutral-900 border border-neutral-700 focus:border-white rounded-xl text-sm text-white placeholder-neutral-400 focus:outline-none transition-colors"
              autoFocus
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Clear search input"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* Empty Query State: Desktop 2-Column Recent & Trending Searches */}
        {!query.trim() ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {recentSearches.length > 0 && (
              <div className="lg:col-span-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-white tracking-tight">Recent Searches</h2>
                  <button
                    type="button"
                    onClick={onClearRecentSearches}
                    className="text-xs text-neutral-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Clear all
                  </button>
                </div>

                <div className="flex flex-col divide-y divide-white/5 bg-neutral-950/60 border border-white/5 rounded-xl px-4">
                  {recentSearches.map((item) => {
                    const matchedMovie = catalogMovies.find(
                      (m) => m.title.toLowerCase() === item.toLowerCase()
                    );

                    return (
                      <div
                        key={item}
                        className="flex items-center justify-between py-2.5 group cursor-pointer"
                        onClick={() => handleSearchSubmit(item)}
                      >
                        <div className="flex items-center gap-3">
                          {matchedMovie ? (
                            <div className="w-8 h-11 rounded overflow-hidden shrink-0 bg-neutral-900 border border-white/10">
                              <MoviePoster
                                title={matchedMovie.title}
                                posterUrl={matchedMovie.posterUrl}
                                isOriginal={matchedMovie.isOriginal}
                                genres={matchedMovie.genres}
                              />
                            </div>
                          ) : (
                            <div className="w-8 h-11 rounded bg-neutral-800 flex items-center justify-center text-neutral-400">
                              <Film size={14} />
                            </div>
                          )}
                          <span className="text-xs sm:text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
                            {item}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveRecentSearch(item);
                            }}
                            className="p-1 text-neutral-500 hover:text-neutral-300 opacity-60 group-hover:opacity-100"
                            title="Remove from history"
                            aria-label={`Remove ${item} from recent searches`}
                          >
                            <X size={14} />
                          </button>
                          <ArrowUpRight size={16} className="text-neutral-400 group-hover:text-white" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className={recentSearches.length > 0 ? 'lg:col-span-7' : 'lg:col-span-12'}>
              <h2 className="text-sm font-bold text-white tracking-tight mb-3">
                Trending Searches
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {trendingList.map((movie) => (
                  <div
                    key={movie.id}
                    className="flex items-center justify-between p-2.5 bg-neutral-950/70 hover:bg-neutral-900 border border-white/5 rounded-xl group cursor-pointer transition-colors"
                    onClick={() => {
                      onAddRecentSearch(movie.title);
                      onSelectMovie(movie);
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-14 rounded overflow-hidden shrink-0 bg-neutral-900 border border-white/10">
                        <MoviePoster
                          title={movie.title}
                          posterUrl={movie.posterUrl}
                          isOriginal={movie.isOriginal}
                          genres={movie.genres}
                        />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-semibold text-neutral-200 group-hover:text-white transition-colors truncate">
                          {movie.title}
                        </span>
                        <span className="text-[11px] text-neutral-500">
                          {movie.type === 'series' ? 'TV Series' : 'Movie'} · {movie.year}
                        </span>
                      </div>
                    </div>
                    <ArrowUpRight size={16} className="text-neutral-400 group-hover:text-white shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
                {searchResults.length} {searchResults.length === 1 ? 'Result' : 'Results'} for &quot;{query}&quot;
              </h2>
              {isSearchingTmdb && (
                <span className="text-[11px] text-neutral-400 animate-pulse">Searching TMDB...</span>
              )}
            </div>

            {searchResults.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3.5 sm:gap-4">
                {searchResults.map((movie) => (
                  <MovieCard
                    key={movie.id}
                    movie={movie}
                    onSelect={(m) => {
                      onAddRecentSearch(m.title);
                      onSelectMovie(m);
                    }}
                    fullWidth={true}
                    showTitle={true}
                    subtitle={`${movie.year} · ${movie.type === 'series' ? 'Series' : 'Movie'}`}
                  />
                ))}
              </div>
            ) : isSearchingTmdb ? (
              <div className="py-14 flex flex-col items-center justify-center text-center">
                <p className="text-xs text-neutral-400 animate-pulse">Searching The Movie Database...</p>
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center justify-center text-center">
                <Film size={44} className="text-neutral-600 mb-3" />
                <h3 className="text-base font-bold text-white mb-1">Oh, darn. We don&apos;t have that.</h3>
                <p className="text-xs text-neutral-400 max-w-xs">
                  Try searching for another movie, television show, actor, director, or genre.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
