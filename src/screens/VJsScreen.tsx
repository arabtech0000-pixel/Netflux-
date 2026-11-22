import React, { useState, useEffect } from 'react';
import { Mic, ChevronDown, ChevronRight, Check, Film } from 'lucide-react';
import { CategoryTab, Movie, TmdbCatalog } from '../types';
import { Header } from '../components/Header';
import { MovieCard } from '../components/MovieCard';
import { filterMoviesByGenre } from '../services/logic';
import { searchTmdbTitles } from '../services/tmdb';

interface VJsScreenProps {
  catalog: TmdbCatalog | null;
  movies: Movie[];
  catalogLoading: boolean;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie, vjAudioTrack?: string) => void;
  onBack?: () => void;
  onSearchClick?: () => void;
  onNotificationsClick?: () => void;
  onCastClick?: () => void;
  onCategoryNavigate?: (category: CategoryTab) => void;
  unreadNotificationsCount?: number;
}

export interface VJTranslator {
  id: string;
  name: string;
  alias: string;
  tagline: string;
  avatarColor: string;
}

export const VJ_TRANSLATORS: VJTranslator[] = [
  {
    id: 'vj-junior',
    name: 'VJ Junior',
    alias: 'The Supreme VJ',
    tagline: 'Luganda Action Commentary & Voiceovers',
    avatarColor: 'from-red-600 to-amber-500',
  },
  {
    id: 'vj-king',
    name: 'VJ King',
    alias: 'Royal Blockbusters',
    tagline: 'High-Energy Thriller & Sports Dubbing',
    avatarColor: 'from-amber-500 to-orange-600',
  },
  {
    id: 'vj-jingo',
    name: 'VJ Jingo',
    alias: 'Master of Martial Arts',
    tagline: 'Fast-Paced Luganda Translation & Humor',
    avatarColor: 'from-blue-600 to-cyan-500',
  },
  {
    id: 'vj-mark',
    name: 'VJ Mark',
    alias: 'The Drama Maestro',
    tagline: 'Deep Narrative & Suspense Translation',
    avatarColor: 'from-[#E50914] to-purple-600',
  },
  {
    id: 'vj-icep',
    name: 'VJ Ice P',
    alias: 'Sci-Fi Specialist',
    tagline: 'Futuristic Action & High Audio Clarity',
    avatarColor: 'from-emerald-600 to-teal-500',
  },
  {
    id: 'vj-emmy',
    name: 'VJ Emmy',
    alias: 'The Classics VJ',
    tagline: 'Classic Action & Adventure Dubbing',
    avatarColor: 'from-purple-600 to-pink-600',
  },
];

const VJ_GENRES = [
  'Action',
  'Sports',
  'Comedy',
  'Drama',
  'Horror',
  'Sci-Fi',
  'Thriller',
  'Romance',
  'Documentary',
];

export const VJsScreen: React.FC<VJsScreenProps> = ({
  catalog,
  movies,
  catalogLoading,
  onSelectMovie,
  onSearchClick,
  onNotificationsClick,
  onCastClick,
  onCategoryNavigate,
  unreadNotificationsCount = 0,
}) => {
  const [openMenu, setOpenMenu] = useState<'vjs' | 'genre' | null>(null);
  const [selectedVjId, setSelectedVjId] = useState<string>('all');
  const [selectedGenre, setSelectedGenre] = useState<string>('all');
  const [remoteVjResults, setRemoteVjResults] = useState<Movie[]>([]);

  const dynamicVjs: VJTranslator[] = React.useMemo(() => {
    const map = new Map<string, VJTranslator>();
    VJ_TRANSLATORS.forEach((v) => map.set(v.name.toLowerCase(), v));

    const palette = [
      'from-red-600 to-amber-500',
      'from-blue-600 to-cyan-500',
      'from-emerald-600 to-teal-500',
      'from-purple-600 to-pink-600',
      'from-amber-500 to-orange-600',
    ];
    let pIdx = 0;

    [...movies, ...remoteVjResults].forEach((m) => {
      if (!m.vjName) return;
      const key = m.vjName.toLowerCase();
      if (!map.has(key)) {
        const slug = key.replace(/[^a-z0-9]+/g, '-');
        map.set(key, {
          id: slug,
          name: m.vjName,
          alias: 'MunoWatch Translator',
          tagline: `Luganda Dubbed & Translated by ${m.vjName}`,
          avatarColor: palette[pIdx++ % palette.length],
        });
      }
    });

    return Array.from(map.values()).filter(
      (vj) =>
        movies.length === 0 ||
        [...movies, ...remoteVjResults].some(
          (m) => (m.vjName || '').toLowerCase() === vj.name.toLowerCase()
        ) ||
        VJ_TRANSLATORS.some((base) => base.id === vj.id)
    );
  }, [movies, remoteVjResults]);

  const selectedVj = dynamicVjs.find((v) => v.id === selectedVjId);

  useEffect(() => {
    const clean = selectedVj ? selectedVj.name : '';
    if (clean.length < 2) {
      setRemoteVjResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      searchTmdbTitles(clean)
        .then((items) => {
          if (!cancelled) setRemoteVjResults(items);
        })
        .catch(() => {
          if (!cancelled) setRemoteVjResults([]);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [selectedVj?.name]);

  // Merge catalog genre pool with any remote VJ search results
  const combinedSource = React.useMemo(() => {
    const basePool =
      selectedGenre !== 'all'
        ? catalog?.sections.byGenre?.[selectedGenre] && catalog.sections.byGenre[selectedGenre].length > 0
          ? catalog.sections.byGenre[selectedGenre]
          : filterMoviesByGenre(movies, selectedGenre)
        : movies;

    if (selectedVjId === 'all' || remoteVjResults.length === 0) {
      return basePool;
    }

    const seen = new Set(basePool.map((m) => m.id));
    const extras =
      selectedGenre === 'all'
        ? remoteVjResults
        : filterMoviesByGenre(remoteVjResults, selectedGenre);
    return [...basePool, ...extras.filter((m) => !seen.has(m.id))];
  }, [catalog, movies, remoteVjResults, selectedGenre, selectedVjId]);

  const vjMovies = combinedSource.map((movie, idx) => {
    const matchedVj = movie.vjName
      ? dynamicVjs.find((v) => v.name.toLowerCase() === movie.vjName?.toLowerCase())
      : undefined;
    const vj = matchedVj || {
      id: (movie.vjName || VJ_TRANSLATORS[idx % VJ_TRANSLATORS.length].name)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-'),
      name: movie.vjName || VJ_TRANSLATORS[idx % VJ_TRANSLATORS.length].name,
      alias: 'Luganda Dubbed',
      tagline: 'Luganda Translated Release',
      avatarColor: VJ_TRANSLATORS[idx % VJ_TRANSLATORS.length].avatarColor,
    };
    return {
      ...movie,
      vjInfo: vj,
    };
  });

  const filteredMovies = vjMovies.filter((item) => {
    if (selectedVjId !== 'all' && item.vjInfo.id !== selectedVjId) return false;
    return true;
  });

  return (
    <div className="flex-1 w-full bg-black text-white flex flex-col relative select-none pb-24">
      {onCategoryNavigate && onSearchClick && onNotificationsClick && onCastClick && (
        <Header
          activeCategory="VJs"
          onCategoryChange={onCategoryNavigate}
          onSearchClick={onSearchClick}
          onNotificationsClick={onNotificationsClick}
          onCastClick={onCastClick}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      )}

      <div className="w-full px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 pt-24 md:pt-20 flex flex-col">
        {/* Dual Selectors Row (Extended to the top below header) */}
        <div className="grid grid-cols-2 md:flex md:items-center gap-3 w-full md:w-auto mb-5">
          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'vjs' ? null : 'vjs'))}
            aria-expanded={openMenu === 'vjs'}
            className={`h-11 px-4 md:min-w-[170px] rounded-xl border font-bold text-sm flex items-center justify-between gap-3 transition-all cursor-pointer ${
              openMenu === 'vjs' || selectedVjId !== 'all'
                ? 'bg-[#E50914] border-[#E50914] text-white shadow-lg shadow-red-950/50'
                : 'bg-neutral-900 border-neutral-700 text-white hover:border-neutral-500'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Mic size={16} className="shrink-0" />
              <span className="truncate">{selectedVj ? selectedVj.name : 'VJs'}</span>
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${openMenu === 'vjs' ? 'rotate-180' : ''}`}
            />
          </button>

          <button
            type="button"
            onClick={() => setOpenMenu((prev) => (prev === 'genre' ? null : 'genre'))}
            aria-expanded={openMenu === 'genre'}
            className={`h-11 px-4 md:min-w-[170px] rounded-xl border font-bold text-sm flex items-center justify-between gap-3 transition-all cursor-pointer ${
              openMenu === 'genre' || selectedGenre !== 'all'
                ? 'bg-white border-white text-black shadow-lg'
                : 'bg-neutral-900 border-neutral-700 text-white hover:border-neutral-500'
            }`}
          >
            <span className="flex items-center gap-2 truncate">
              <Film size={16} className="shrink-0" />
              <span className="truncate">{selectedGenre !== 'all' ? selectedGenre : 'Genre'}</span>
            </span>
            <ChevronDown
              size={16}
              className={`shrink-0 transition-transform ${openMenu === 'genre' ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {/* Vertical List of VJs (Clean Name-Only Rows) */}
        {openMenu === 'vjs' && (
          <div
            role="region"
            aria-label="VJs List"
            className="w-full max-w-2xl mb-6 bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedVjId('all');
                setOpenMenu(null);
              }}
              className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                selectedVjId === 'all' ? 'bg-white/10 text-white' : 'hover:bg-neutral-900 text-neutral-200'
              }`}
            >
              <span className="text-sm font-bold">All VJs</span>
              {selectedVjId === 'all' ? (
                <Check size={18} className="text-[#E50914]" />
              ) : (
                <ChevronRight size={16} className="text-neutral-500" />
              )}
            </button>

            {dynamicVjs.map((vj) => {
              const isSelected = selectedVjId === vj.id;
              return (
                <button
                  key={vj.id}
                  type="button"
                  onClick={() => {
                    setSelectedVjId(vj.id);
                    setOpenMenu(null);
                  }}
                  className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-white/10 text-white' : 'hover:bg-neutral-900 text-neutral-200'
                  }`}
                >
                  <span className="text-sm font-bold">{vj.name}</span>
                  {isSelected ? (
                    <Check size={18} className="text-[#E50914]" />
                  ) : (
                    <ChevronRight size={16} className="text-neutral-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Vertical List of Genres */}
        {openMenu === 'genre' && (
          <div
            role="region"
            aria-label="Genres List"
            className="w-full max-w-2xl mb-6 bg-neutral-950 border border-white/10 rounded-2xl overflow-hidden divide-y divide-white/5 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedGenre('all');
                setOpenMenu(null);
              }}
              className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors ${
                selectedGenre === 'all' ? 'bg-white/10 text-white' : 'hover:bg-neutral-900 text-neutral-200'
              }`}
            >
              <span className="text-sm font-bold">All Genres</span>
              {selectedGenre === 'all' ? (
                <Check size={18} className="text-[#E50914]" />
              ) : (
                <ChevronRight size={16} className="text-neutral-500" />
              )}
            </button>

            {VJ_GENRES.map((genre) => {
              const isSelected = selectedGenre === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => {
                    setSelectedGenre(genre);
                    setOpenMenu(null);
                  }}
                  className={`w-full px-4 py-3.5 flex items-center justify-between text-left transition-colors ${
                    isSelected ? 'bg-white/10 text-white' : 'hover:bg-neutral-900 text-neutral-200'
                  }`}
                >
                  <span className="text-sm font-bold">{genre}</span>
                  {isSelected ? (
                    <Check size={18} className="text-[#E50914]" />
                  ) : (
                    <ChevronRight size={16} className="text-neutral-500" />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Filtered VJ Movies Full Desktop Grid */}
        <div className="mt-1">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <span>
                {selectedVj ? selectedVj.name : 'All VJs'}
                {selectedGenre !== 'all' ? ` · ${selectedGenre}` : ''}
              </span>
              <span className="text-xs text-neutral-400">({filteredMovies.length} Titles)</span>
            </h2>

            {(selectedVjId !== 'all' || selectedGenre !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSelectedVjId('all');
                  setSelectedGenre('all');
                }}
                className="text-xs text-[#E50914] hover:underline font-semibold cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>

          {catalogLoading && filteredMovies.length === 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3.5">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                <div
                  key={idx}
                  className="w-full aspect-[2/3] rounded-md bg-neutral-900 animate-pulse border border-white/5"
                />
              ))}
            </div>
          ) : filteredMovies.length === 0 ? (
            <div className="py-12 text-center bg-neutral-950/60 border border-white/5 rounded-2xl">
              <p className="text-sm font-semibold text-white mb-1">No movies matched your VJ filter</p>
              <p className="text-xs text-neutral-400">
                Select another VJ or genre from the dropdowns above.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3.5 sm:gap-4">
              {filteredMovies.map((movie) => (
                <MovieCard
                  key={movie.id}
                  movie={movie}
                  onSelect={onSelectMovie}
                  onPlay={onSelectMovie}
                  fullWidth={true}
                  showTitle={true}
                  subtitle={`${movie.year} · ${movie.type === 'series' ? 'Series' : 'Movie'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
