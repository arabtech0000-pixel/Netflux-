import React, { useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { Movie } from '../types';
import { ResilientImage } from '../components/ResilientImage';

interface GamesScreenProps {
  movies?: Movie[];
}

export const GamesScreen: React.FC<GamesScreenProps> = ({ movies = [] }) => {
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [playingGame, setPlayingGame] = useState<string | null>(null);

  const gameTitles = movies.slice(0, 4).map((m, idx) => ({
    id: `interactive-${m.id}`,
    title: `${m.title}: Interactive Story`,
    genre: m.genres[0] || 'Action Adventure',
    size: `${180 + idx * 95} MB`,
    rating: `${(m.matchScore / 20).toFixed(1)} ★`,
    banner: m.backdropUrl || m.posterUrl,
  }));

  const toggleInstall = (gameId: string) => {
    setInstalledIds((prev) =>
      prev.includes(gameId) ? prev.filter((id) => id !== gameId) : [...prev, gameId]
    );
  };

  return (
    <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 py-6 flex flex-col overflow-y-auto no-scrollbar select-none pb-24">
      <div className="w-full max-w-6xl mx-auto flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Gamepad2 size={24} className="text-[#E50914]" />
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">Interactive Experiences</h1>
      </div>

      <p className="text-xs sm:text-sm text-neutral-400 mb-5">
        Included with your membership. Play interactive story editions inspired by TMDB trending titles.
      </p>

      {gameTitles[0] && (
        <div className="relative h-56 sm:h-72 rounded-2xl overflow-hidden border border-white/10 mb-6 group cursor-pointer">
          <ResilientImage
            src={gameTitles[0].banner}
            alt={gameTitles[0].title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
            <div>
              <span className="text-[10px] font-bold text-[#E50914] uppercase tracking-wider block">Featured</span>
              <h3 className="text-base sm:text-xl font-bold text-white leading-tight">{gameTitles[0].title}</h3>
              <span className="text-xs text-neutral-300">{gameTitles[0].genre} · {gameTitles[0].rating}</span>
            </div>
            <button
              onClick={() => setPlayingGame(gameTitles[0].title)}
              className="px-5 py-2.5 bg-white text-black font-bold text-xs rounded-lg active:scale-95 shadow-md"
            >
              Play Now
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <h2 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
          Available Stories
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {gameTitles.map((game) => {
          const isInstalled = installedIds.includes(game.id);
          return (
            <div
              key={game.id}
              className="p-3 bg-neutral-950 border border-white/5 rounded-xl flex items-center justify-between gap-3 group hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-neutral-800">
                  <ResilientImage
                    src={game.banner}
                    alt={game.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <h4 className="text-xs font-bold text-neutral-100 group-hover:text-white truncate">
                    {game.title}
                  </h4>
                  <span className="text-[11px] text-neutral-400">{game.genre}</span>
                  <div className="flex items-center gap-2 text-[10px] text-neutral-400 mt-0.5">
                    <span className="text-amber-400 font-semibold">{game.rating}</span>
                    <span>·</span>
                    <span>{game.size}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  if (isInstalled) {
                    setPlayingGame(game.title);
                  } else {
                    toggleInstall(game.id);
                  }
                }}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 ${
                  isInstalled
                    ? 'bg-white text-black hover:bg-neutral-200'
                    : 'bg-neutral-800 text-white hover:bg-neutral-700'
                }`}
              >
                {isInstalled ? 'Play' : 'Get'}
              </button>
            </div>
          );
        })}
        </div>
      </div>

      {playingGame && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-6 text-center animate-in zoom-in-95">
          <div className="bg-neutral-900 border border-neutral-700 p-6 rounded-3xl max-w-xs w-full flex flex-col items-center">
            <Gamepad2 size={44} className="text-[#E50914] mb-3 animate-bounce" />
            <h3 className="text-base font-bold text-white mb-1">Launching {playingGame}...</h3>
            <p className="text-xs text-neutral-400 mb-5">
              Syncing cloud saves with your account profile.
            </p>
            <button
              onClick={() => setPlayingGame(null)}
              className="w-full py-2 bg-[#E50914] text-white font-bold text-xs rounded-xl"
            >
              Exit
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};
