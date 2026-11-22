import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info, Play, Download, CheckCircle2 } from 'lucide-react';
import { Movie } from '../types';
import { NetflixNLogo } from './NetflixLogo';
import { ResilientImage } from './ResilientImage';

export type HeroSecondaryIconType = 'info' | 'download' | 'check' | 'loader';

interface HeroBannerProps {
  movies: Movie[];
  eyebrowLabel?: string;
  eyebrowBadge?: React.ReactNode;
  primaryButtonLabel?: string;
  secondaryButtonLabel?: string;
  secondaryButtonIcon?: HeroSecondaryIconType;
  getSecondaryButtonLabel?: (movie: Movie) => string;
  getSecondaryButtonIcon?: (movie: Movie) => HeroSecondaryIconType;
  primaryButtonVariant?: 'white' | 'red';
  customSubtitle?: string;
  onPrimaryAction: (movie: Movie) => void;
  onSecondaryAction: (movie: Movie) => void;
  heightClassName?: string;
  isLoading?: boolean;
  autoAdvanceMs?: number;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  movies,
  eyebrowLabel,
  eyebrowBadge,
  primaryButtonLabel = 'Watch Episode 1',
  secondaryButtonLabel = 'Episodes',
  secondaryButtonIcon = 'info',
  getSecondaryButtonLabel,
  getSecondaryButtonIcon,
  primaryButtonVariant = 'red',
  customSubtitle,
  onPrimaryAction,
  onSecondaryAction,
  heightClassName = 'h-[470px] sm:h-[540px] md:h-[580px] lg:h-[630px]',
  isLoading = false,
  autoAdvanceMs = 8000,
}) => {
  const validSlides = movies.filter((m) => Boolean(m && m.id));
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    setActiveIndex(0);
  }, [validSlides.length, validSlides[0]?.id]);

  useEffect(() => {
    if (validSlides.length <= 1 || autoAdvanceMs <= 0) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % validSlides.length);
    }, autoAdvanceMs);
    return () => clearInterval(timer);
  }, [validSlides.length, autoAdvanceMs]);

  if (isLoading || validSlides.length === 0) {
    return (
      <div className={`relative w-full ${heightClassName} shrink-0 overflow-hidden bg-neutral-950`}>
        <div className="w-full h-full bg-gradient-to-b from-neutral-900 via-neutral-950 to-black animate-pulse" />
        <div className="absolute inset-x-0 bottom-8 px-5 md:pl-22 lg:pl-26 flex flex-col items-center md:items-start gap-3 z-20">
          <div className="h-10 w-64 rounded-md bg-neutral-800/80 animate-pulse" />
          <div className="h-3 w-44 rounded bg-neutral-800/60 animate-pulse" />
          <div className="flex gap-3 w-full max-w-xs mt-1">
            <div className="flex-1 h-10 rounded-md bg-neutral-800/80 animate-pulse" />
            <div className="flex-1 h-10 rounded-md bg-neutral-800/60 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const safeIndex = activeIndex % validSlides.length;
  const activeMovie = validSlides[safeIndex];
  const hasMultiple = validSlides.length > 1;

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + validSlides.length) % validSlides.length);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % validSlides.length);
  };

  const primaryBtnClasses =
    primaryButtonVariant === 'red'
      ? 'bg-[#E50914] hover:bg-[#f40612] text-white shadow-lg shadow-red-950/60'
      : 'bg-white hover:bg-neutral-200 text-black shadow-lg';

  return (
    <section
      aria-label={`Featured banner: ${activeMovie.title}`}
      className={`relative w-full ${heightClassName} shrink-0 overflow-hidden group`}
    >
      {/* Full-bleed Widescreen Backdrop Image (right-biased framing on desktop keeps subject visible beside left text) */}
      <ResilientImage
        src={activeMovie.backdropUrl || activeMovie.posterUrl}
        alt={activeMovie.title}
        className="w-full h-full object-cover object-[50%_22%] md:object-[68%_20%] transition-all duration-700"
        fallbackGradient="from-[#2b0509] via-neutral-950 to-black"
      />

      {/* Cinematic Vignettes (top fade under header, left-to-right editorial scrim on desktop, bottom fade into black) */}
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none" />
      <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-black/95 via-black/55 to-transparent pointer-events-none" />
      <div className="md:hidden absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-black/45 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />

      {/* Carousel Prev/Next Controls */}
      {hasMultiple && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous featured banner"
            className="hidden md:flex absolute left-18 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 items-center justify-center text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next featured banner"
            className="hidden md:flex absolute right-6 top-1/2 -translate-y-1/2 z-30 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 border border-white/15 items-center justify-center text-white opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}

      {/* Hero Editorial Metadata & Action Block (centered on mobile, left-aligned on desktop clearing the left rail) */}
      <div className="absolute inset-x-0 md:inset-x-auto md:left-0 bottom-6 md:bottom-14 px-5 sm:px-8 md:pl-22 lg:pl-24 md:pr-8 flex flex-col items-center text-center md:items-start md:text-left z-20 max-w-2xl mx-auto md:mx-0">
        {eyebrowBadge ? (
          <div className="mb-1.5">{eyebrowBadge}</div>
        ) : (
          <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold tracking-[0.22em] text-neutral-200 uppercase">
            <NetflixNLogo size={14} />
            <span>{eyebrowLabel || (activeMovie.type === 'series' ? 'SERIES' : 'FILM')}</span>
          </div>
        )}

        <h1 className="font-bebas text-4xl sm:text-5xl md:text-6xl lg:text-[66px] font-black tracking-wider text-white uppercase leading-[0.94] line-clamp-2 drop-shadow-[0_4px_18px_rgba(0,0,0,0.95)]">
          {activeMovie.title}
        </h1>

        {customSubtitle ? (
          <p className="text-xs sm:text-sm text-neutral-300 max-w-lg line-clamp-2 mt-2 mb-4">
            {customSubtitle}
          </p>
        ) : (
          <>
            <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-neutral-200 mt-2.5 mb-3 flex-wrap justify-center md:justify-start">
              <span className="text-[#46d369] font-bold">{activeMovie.matchScore}% Match</span>
              <span className="text-neutral-500">·</span>
              <span>{activeMovie.year}</span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-900/90 border border-white/15 text-[10px] font-bold">
                {activeMovie.ageRating}
              </span>
              {activeMovie.genres.slice(0, 3).map((genre) => (
                <React.Fragment key={genre}>
                  <span className="text-neutral-500">·</span>
                  <span>{genre}</span>
                </React.Fragment>
              ))}
              {activeMovie.top10Rank && (
                <>
                  <span className="text-neutral-500">·</span>
                  <span className="text-[#E50914] font-bold">#{activeMovie.top10Rank} in Uganda Today</span>
                </>
              )}
            </div>

            {activeMovie.synopsis && (
              <p className="hidden md:line-clamp-3 text-sm text-neutral-300 leading-relaxed max-w-lg mb-5 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                {activeMovie.synopsis}
              </p>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-center md:justify-start gap-3 w-full max-w-xs sm:max-w-sm md:max-w-none md:w-auto">
          <button
            type="button"
            data-testid="hero-primary-button"
            onClick={() => onPrimaryAction(activeMovie)}
            className={`flex-1 md:flex-none md:px-7 h-10 sm:h-11 active:scale-95 font-bold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer px-4 ${primaryBtnClasses}`}
          >
            <Play size={16} className={primaryButtonVariant === 'red' ? 'fill-white' : 'fill-black'} />
            <span className="truncate">{primaryButtonLabel}</span>
          </button>

          {(() => {
            const resolvedLabel = getSecondaryButtonLabel
              ? getSecondaryButtonLabel(activeMovie)
              : secondaryButtonLabel;
            const resolvedIcon = getSecondaryButtonIcon
              ? getSecondaryButtonIcon(activeMovie)
              : secondaryButtonIcon;
            return (
              <button
                type="button"
                data-testid="hero-secondary-button"
                onClick={() => onSecondaryAction(activeMovie)}
                className="flex-1 md:flex-none md:px-6 h-10 sm:h-11 bg-neutral-900/85 hover:bg-neutral-800 active:scale-95 text-white font-semibold text-xs sm:text-sm rounded-lg backdrop-blur-sm transition-all flex items-center justify-center gap-2 border border-white/15 cursor-pointer px-4"
              >
                {resolvedIcon === 'loader' ? (
                  <Download size={16} className="text-[#E50914] shrink-0" />
                ) : resolvedIcon === 'check' ? (
                  <CheckCircle2 size={16} className="text-[#46d369] shrink-0" />
                ) : resolvedIcon === 'download' ? (
                  <Download size={16} className="shrink-0" />
                ) : (
                  <Info size={16} className="shrink-0" />
                )}
                <span className="truncate">{resolvedLabel}</span>
              </button>
            );
          })()}
        </div>

        {/* Slide Indicators */}
        {hasMultiple && (
          <div
            className="flex items-center justify-center md:justify-start gap-1.5 mt-4"
            role="tablist"
            aria-label="Featured banners"
          >
            {validSlides.map((slide, idx) => {
              const isActive = idx === safeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Banner slide ${idx + 1}: ${slide.title}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    isActive ? 'w-6 bg-[#E50914]' : 'w-1.5 bg-white/35 hover:bg-white/60'
                  }`}
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
