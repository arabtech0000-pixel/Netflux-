import React, { useState } from 'react';
import { Movie, Episode, CategoryTab, TmdbCatalog } from '../types';
import { Header } from '../components/Header';
import { HeroBanner } from '../components/HeroBanner';
import { MovieRow } from '../components/MovieRow';

interface TVShowsScreenProps {
  catalog: TmdbCatalog | null;
  catalogLoading: boolean;
  onSelectMovie: (movie: Movie) => void;
  onPlayMovie: (movie: Movie, episode?: Episode) => void;
  onSearchClick: () => void;
  onNotificationsClick: () => void;
  onCastClick: () => void;
  onCategoryNavigate: (category: CategoryTab) => void;
  unreadNotificationsCount?: number;
}

export const TVShowsScreen: React.FC<TVShowsScreenProps> = ({
  catalog,
  catalogLoading,
  onSelectMovie,
  onPlayMovie,
  onSearchClick,
  onNotificationsClick,
  onCastClick,
  onCategoryNavigate,
  unreadNotificationsCount = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryTab>('TV Shows');

  const seriesFromSections = catalog?.sections.tvShows || [];
  const allSeriesMap = new Map<string, Movie>();
  [...seriesFromSections, ...(catalog?.all.filter((m) => m.type === 'series') || [])].forEach((m) => {
    if (!allSeriesMap.has(m.id)) allSeriesMap.set(m.id, m);
  });
  const seriesList = Array.from(allSeriesMap.values());

  const featuredSeries = seriesList.filter((m) => Boolean(m.backdropUrl)).slice(0, 5);
  const heroSlides = catalog?.tvHero
    ? [catalog.tvHero, ...featuredSeries.filter((m) => m.id !== catalog.tvHero?.id)].slice(0, 5)
    : featuredSeries;

  const top10Series = seriesList.slice(0, 10);
  const trendingSeries = seriesList.filter((m) => m.isTrending);
  const dramaSeries = seriesList.filter((m) => m.genres.includes('Drama'));
  const actionMysterySeries = seriesList.filter(
    (m) => m.genres.includes('Action') || m.genres.includes('Mystery') || m.genres.includes('Crime')
  );
  const sciFiSeries = seriesList.filter((m) => m.genres.includes('Sci-Fi') || m.genres.includes('Fantasy'));
  const comedySeries = seriesList.filter((m) => m.genres.includes('Comedy'));

  const handleCategorySelect = (cat: CategoryTab) => {
    setActiveCategory(cat);
    onCategoryNavigate(cat);
  };

  return (
    <div className="flex-1 w-full bg-black text-white flex flex-col relative select-none pb-24">
      <Header
        activeCategory={activeCategory}
        onCategoryChange={handleCategorySelect}
        onSearchClick={onSearchClick}
        onNotificationsClick={onNotificationsClick}
        onCastClick={onCastClick}
        unreadNotificationsCount={unreadNotificationsCount}
      />

      <HeroBanner
        movies={heroSlides}
        eyebrowLabel="SERIES"
        primaryButtonLabel="Watch Episode 1"
        secondaryButtonLabel="Episodes"
        secondaryButtonIcon="info"
        primaryButtonVariant="red"
        isLoading={catalogLoading && heroSlides.length === 0}
        onPrimaryAction={(show) => onPlayMovie(show, show.episodes?.[0])}
        onSecondaryAction={(show) => onSelectMovie(show)}
      />

      <div className="flex flex-col gap-3 relative z-20 -mt-3 sm:mt-0">
        {catalogLoading && seriesList.length === 0 && (
          <div className="px-4 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 flex flex-col gap-5 w-full py-2">
            {[1, 2].map((row) => (
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

        <MovieRow
          title="Trending TV Shows"
          movies={trendingSeries.length > 0 ? trendingSeries : seriesList}
          onSelectMovie={onSelectMovie}
        />

        <MovieRow
          title="Top 10 Series Today"
          movies={top10Series}
          onSelectMovie={onSelectMovie}
          isTop10={true}
        />

        <MovieRow title="Popular Series" movies={seriesList} onSelectMovie={onSelectMovie} />

        <MovieRow title="Award-Winning TV Dramas" movies={dramaSeries} onSelectMovie={onSelectMovie} />

        <MovieRow
          title="Binge-Worthy Crime & Action"
          movies={actionMysterySeries}
          onSelectMovie={onSelectMovie}
        />

        <MovieRow title="Sci-Fi & Fantasy Series" movies={sciFiSeries} onSelectMovie={onSelectMovie} />

        <MovieRow title="Comedy Series" movies={comedySeries} onSelectMovie={onSelectMovie} />
      </div>
    </div>
  );
};
