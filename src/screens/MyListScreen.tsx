import React from 'react';
import { Search, Play, Trash2, BookmarkX } from 'lucide-react';
import { Movie, WatchProgress } from '../types';
import { MovieCard } from '../components/MovieCard';
import { MoviePoster } from '../components/MoviePoster';
import { calculateProgressPercent } from '../services/logic';

interface MyListScreenProps {
  movieDirectory: Record<string, Movie>;
  watchlistIds: string[];
  continueWatching: WatchProgress[];
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie) => void;
  onRemoveFromList: (movieId: string) => void;
  onSearchClick: () => void;
  onBrowseMore: () => void;
}

export const MyListScreen: React.FC<MyListScreenProps> = ({
  movieDirectory,
  watchlistIds,
  continueWatching,
  onSelectMovie,
  onRemoveFromList,
  onSearchClick,
  onBrowseMore,
}) => {
  const savedMovies = watchlistIds
    .map((id) => movieDirectory[id])
    .filter((m): m is Movie => Boolean(m));

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col">
        {/* Top Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">My List</h1>
            <p className="text-xs text-neutral-400 mt-0.5">
              {savedMovies.length} saved {savedMovies.length === 1 ? 'title' : 'titles'}
            </p>
          </div>
          <button
            type="button"
            onClick={onSearchClick}
            className="p-2 text-neutral-400 hover:text-white rounded-full hover:bg-white/10 cursor-pointer"
            aria-label="Search"
          >
            <Search size={20} />
          </button>
        </div>

        {/* Saved Titles Grid */}
        {savedMovies.length > 0 ? (
          <div className="mb-8">
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3.5 sm:gap-4">
              {savedMovies.map((movie) => (
                <div key={movie.id} className="relative group">
                  <MovieCard
                    movie={movie}
                    onSelect={onSelectMovie}
                    onPlay={onSelectMovie}
                    fullWidth={true}
                    showTitle={true}
                    subtitle={`${movie.year} · ${movie.type === 'series' ? 'Series' : 'Movie'}`}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFromList(movie.id);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/80 text-white/80 hover:text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
                    title="Remove from My List"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-14 flex flex-col items-center justify-center text-center bg-neutral-950/60 border border-white/5 rounded-2xl mb-8">
            <BookmarkX size={44} className="text-neutral-600 mb-3" />
            <h3 className="text-base font-bold text-white mb-1">Your list is empty</h3>
            <p className="text-xs text-neutral-400 max-w-xs mb-5">
              Explore titles and tap the &quot;+ My List&quot; button to keep track of what you want to watch.
            </p>
            <button
              type="button"
              onClick={onBrowseMore}
              className="px-5 py-2.5 bg-[#E50914] hover:bg-[#f40612] text-xs font-semibold text-white rounded-lg transition-colors cursor-pointer"
            >
              Explore Titles
            </button>
          </div>
        )}

        {/* Continue Watching Section */}
        {continueWatching.length > 0 && (
          <div className="mt-2 border-t border-white/10 pt-5">
            <h2 className="text-sm sm:text-base font-bold text-white mb-3 tracking-tight">
              Continue Watching
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {continueWatching.map((item) => {
                const percent = calculateProgressPercent(item.currentTime, item.duration);
                const matchedMovie = movieDirectory[item.movieId];

                return (
                  <div
                    key={item.movieId}
                    className="rounded-lg overflow-hidden bg-neutral-900 border border-white/10 group cursor-pointer"
                    onClick={() => matchedMovie && onSelectMovie(matchedMovie)}
                  >
                    <div className="relative h-32 sm:h-36 w-full">
                      <MoviePoster
                        title={item.title}
                        posterUrl={item.posterUrl}
                        isOriginal={matchedMovie?.isOriginal}
                        genres={matchedMovie?.genres}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                        <div className="w-10 h-10 rounded-full bg-black/70 border border-white flex items-center justify-center text-white group-hover:scale-110 transition-transform">
                          <Play size={16} className="fill-white ml-0.5" />
                        </div>
                      </div>
                      <div className="absolute inset-x-0 bottom-0 h-1 bg-neutral-800 z-20">
                        <div className="h-full bg-[#E50914]" style={{ width: `${percent}%` }} />
                      </div>
                    </div>

                    <div className="p-2.5 bg-neutral-950 flex flex-col">
                      <span className="text-xs font-bold text-neutral-200 truncate">{item.title}</span>
                      <span className="text-[10px] text-neutral-400">{item.episodeInfo || 'In Progress'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
