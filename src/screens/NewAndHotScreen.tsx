import React, { useState } from 'react';
import { Flame, Bell, Check, Play } from 'lucide-react';
import { Movie, TmdbCatalog } from '../types';
import { ResilientImage } from '../components/ResilientImage';
import { MoviePoster } from '../components/MoviePoster';

interface NewAndHotScreenProps {
  catalog: TmdbCatalog | null;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie) => void;
  reminders: string[];
  onToggleReminder: (movieId: string) => void;
}

export const NewAndHotScreen: React.FC<NewAndHotScreenProps> = ({
  catalog,
  onSelectMovie,
  onPlayMovie,
  reminders,
  onToggleReminder,
}) => {
  const [subTab, setSubTab] = useState<'coming-soon' | 'everyones-watching' | 'top-10'>('coming-soon');

  const upcomingItems = catalog?.sections.upcoming || [];
  const trendingItems = catalog?.sections.trending || [];
  const top10Items = catalog?.sections.top10 || [];

  const formatReleaseBadge = (dateStr?: string) => {
    if (!dateStr) return { month: 'SOON', day: '••' };
    const parsed = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return { month: 'SOON', day: '••' };
    return {
      month: parsed.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(parsed.getDate()).padStart(2, '0'),
    };
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-6xl mx-auto flex flex-col">
      {/* Top Header */}
      <div className="flex items-center gap-2 mb-4">
        <Flame size={24} className="text-[#E50914]" />
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">New &amp; Hot</h1>
      </div>

      {/* Sub Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-5 border-b border-white/10">
        <button
          onClick={() => setSubTab('coming-soon')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'coming-soon'
              ? 'bg-white text-black font-bold'
              : 'bg-neutral-900 border border-neutral-700 text-neutral-300'
          }`}
        >
          Coming Soon
        </button>
        <button
          onClick={() => setSubTab('everyones-watching')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'everyones-watching'
              ? 'bg-white text-black font-bold'
              : 'bg-neutral-900 border border-neutral-700 text-neutral-300'
          }`}
        >
          Everyone&apos;s Watching
        </button>
        <button
          onClick={() => setSubTab('top-10')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'top-10'
              ? 'bg-white text-black font-bold'
              : 'bg-neutral-900 border border-neutral-700 text-neutral-300'
          }`}
        >
          Top 10
        </button>
      </div>

      {/* Coming Soon Feed */}
      {subTab === 'coming-soon' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {upcomingItems.slice(0, 8).map((item) => {
            const hasReminder = reminders.includes(item.id);
            const dateBadge = formatReleaseBadge(item.releaseDate);

            return (
              <div key={item.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1 w-10 shrink-0">
                  <span className="text-[10px] font-bold text-neutral-400 uppercase">{dateBadge.month}</span>
                  <span className="text-xl font-black text-white">{dateBadge.day}</span>
                </div>

                <div
                  className="flex-1 bg-neutral-950 border border-white/5 rounded-2xl overflow-hidden cursor-pointer"
                  onClick={() => onSelectMovie(item)}
                >
                  <div className="relative h-44 sm:h-56 w-full">
                    <ResilientImage
                      src={item.backdropUrl || item.posterUrl}
                      alt={item.title}
                      className="w-full h-full object-cover object-[50%_25%]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-transparent to-transparent" />
                  </div>

                  <div className="p-4 flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleReminder(item.id);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                          hasReminder
                            ? 'bg-[#E50914] text-white'
                            : 'bg-neutral-800 text-neutral-200 hover:bg-neutral-700'
                        }`}
                      >
                        {hasReminder ? <Check size={14} /> : <Bell size={14} />}
                        <span>{hasReminder ? 'Reminded' : 'Remind Me'}</span>
                      </button>
                    </div>

                    <p className="text-xs text-neutral-400 leading-relaxed line-clamp-3">
                      {item.synopsis}
                    </p>

                    <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-semibold pt-1">
                      {item.genres.map((g, i) => (
                        <React.Fragment key={g}>
                          {i > 0 && <span>·</span>}
                          <span>{g}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Everyone's Watching & Top 10 */}
      {subTab !== 'coming-soon' && (
        <div className="flex flex-col gap-3">
          {(subTab === 'top-10' ? top10Items : trendingItems).slice(0, 10).map((movie, idx) => (
            <div
              key={movie.id}
              className="p-3 bg-neutral-950 border border-white/5 rounded-xl flex items-center justify-between gap-3 group cursor-pointer"
              onClick={() => onSelectMovie(movie)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-bebas text-2xl text-neutral-500 font-bold w-6 text-center shrink-0">
                  #{idx + 1}
                </span>
                <div className="w-12 h-16 rounded-md overflow-hidden shrink-0 bg-neutral-800">
                  <MoviePoster
                    title={movie.title}
                    posterUrl={movie.posterUrl}
                    isOriginal={movie.isOriginal}
                    genres={movie.genres}
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-bold text-white group-hover:text-[#E50914] transition-colors truncate">
                    {movie.title}
                  </h4>
                  <span className="text-[10px] text-neutral-400">
                    {movie.genres.slice(0, 2).join(' · ')}
                  </span>
                  <span className="text-[10px] text-[#46d369] font-bold">
                    {movie.matchScore}% Match
                  </span>
                </div>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMovie(movie);
                }}
                className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center hover:bg-neutral-200 shadow-md shrink-0"
                aria-label={`View ${movie.title}`}
              >
                <Play size={14} className="fill-black ml-0.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};
