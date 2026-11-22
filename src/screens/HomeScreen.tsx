import React, { useState } from 'react';
import { Movie, Episode, CategoryTab, TmdbCatalog, DownloadItem } from '../types';
import { Header } from '../components/Header';
import { HeroBanner, HeroSecondaryIconType } from '../components/HeroBanner';
import { MovieRow } from '../components/MovieRow';

interface HomeScreenProps {
  catalog: TmdbCatalog | null;
  catalogLoading: boolean;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie, episode?: Episode) => void;
  onDownloadMovie: (movie: Movie, episode?: Episode) => void;
  downloads?: DownloadItem[];
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onCastClick: () => void;
  onCategoryNavigate: (category: CategoryTab) => void;
  watchlist: string[];
  onToggleWatchlist: (movieId: string) => void;
  unreadNotificationsCount?: number;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  catalog,
  catalogLoading,
  onSelectMovie,
  onPlayMovie,
  onDownloadMovie,
  downloads = [],
  onSearchClick,
  onNotificationsClick,
  onCastClick,
  onCategoryNavigate,
  watchlist,
  unreadNotificationsCount = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('Home');

  const featuredBanners =
    catalog?.featuredBanners && catalog.featuredBanners.length > 0
      ? catalog.featuredBanners
      : catalog?.hero
        ? [catalog.hero]
        : [];

  const allMovies = catalog?.all || [];
  const trendingMovies = catalog?.sections.trending || [];
  const top10Movies = catalog?.sections.top10 || [];
  const popularTvShows = catalog?.sections.tvShows || [];
  const popularMovies = catalog?.sections.movies || [];
  const actionMovies = catalog?.sections.byGenre?.Action || [];
  const sciFiMovies = catalog?.sections.byGenre?.['Sci-Fi'] || [];
  const dramaMovies = catalog?.sections.byGenre?.Drama || [];
  const comedyMovies = catalog?.sections.byGenre?.Comedy || [];
  const myListMovies = allMovies.filter((m) => watchlist.includes(m.id));

  const handleCategorySelect = (cat: CategoryTab) => {
    setActiveCategory(cat);
    onCategoryNavigate(cat);
  };

  const findHeroDownload = (movie: Movie) =>
    downloads.find((d) => d.movieId === movie.id || d.id === `dl-${movie.id}`);

  const getHeroDownloadLabel = (movie: Movie): string => {
    const item = findHeroDownload(movie);
    if (!item) return 'Download';
    if (item.status === 'pending') return 'Pending · 0%';
    if (item.status === 'downloading') return `Downloading · ${item.progress}%`;
    if (item.status === 'paused') return `Paused · ${item.progress}%`;
    if (item.status === 'failed') return 'Retry Download';
    return 'Downloaded · 100%';
  };

  const getHeroDownloadIcon = (movie: Movie): HeroSecondaryIconType => {
    const item = findHeroDownload(movie);
    if (!item) return 'download';
    if (item.status === 'pending' || item.status === 'downloading') return 'loader';
    if (item.status === 'completed') return 'check';
    return 'download';
  };

  return (
    <div className="flex-1 w-full bg-black text-white flex flex-col relative select-none pb-24">
      {/* Transparent Top Header Overlay */}
      <Header
        activeCategory={activeCategory}
        onCategoryChange={handleCategorySelect}
        onSearchClick={onSearchClick}
        onNotificationsClick={onNotificationsClick}
        onCastClick={onCastClick}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      {/* Full-bleed Widescreen Hero Banner (Play + Download on Home) */}
      <HeroBanner
        movies={featuredBanners}
        primaryButtonLabel="Play"
        secondaryButtonLabel="Download"
        secondaryButtonIcon="download"
        getSecondaryButtonLabel={getHeroDownloadLabel}
        getSecondaryButtonIcon={getHeroDownloadIcon}
        primaryButtonVariant="red"
        isLoading={catalogLoading && featuredBanners.length === 0}
        onPrimaryAction={(movie) => onPlayMovie(movie)}
        onSecondaryAction={(movie) => onDownloadMovie(movie)}
      />

      {/* Content Rows - Trending Now is always the first category */}
      <div className="flex flex-col gap-3 relative z-20 -mt-3 sm:mt-0">
        {catalogLoading && allMovies.length === 0 && (
          <div className="px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 flex flex-col gap-5 w-full py-2">
            {[1, 2, 3].map((row) => (
              <div key={row} className="flex flex-col gap-2">
                <div className="h-4 w-36 bg-neutral-800/80 rounded animate-pulse" />
                <div className="flex gap-3 overflow-hidden">
                  {[1, 2, 3, 4, 5, 6, 7].map((card) => (
                    <div
                      key={card}
                      className="w-28 h-42 sm:w-34 sm:h-50 md:w-38 md:h-56 shrink-0 rounded-md bg-neutral-900 animate-pulse border border-white/5"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <MovieRow title="Trending Now" movies={trendingMovies} onSelectMovie={onSelectMovie} />

        <MovieRow
          title="Top 10 in Uganda Today"
          movies={top10Movies}
          onSelectMovie={onSelectMovie}
          isTop10={true}
        />

        <MovieRow title="Popular TV Series" movies={popularTvShows} onSelectMovie={onSelectMovie} />

        <MovieRow title="Popular Movies" movies={popularMovies} onSelectMovie={onSelectMovie} />

        <MovieRow title="Action & Adventure" movies={actionMovies} onSelectMovie={onSelectMovie} />

        <MovieRow title="Sci-Fi & Fantasy" movies={sciFiMovies} onSelectMovie={onSelectMovie} />

        <MovieRow title="Drama & Suspense" movies={dramaMovies} onSelectMovie={onSelectMovie} />

        <MovieRow title="Comedies" movies={comedyMovies} onSelectMovie={onSelectMovie} />

        {myListMovies.length > 0 && (
          <MovieRow title="My List" movies={myListMovies} onSelectMovie={onSelectMovie} />
        )}
      </div>
    </div>
  );
};
