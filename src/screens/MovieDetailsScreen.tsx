import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Cast,
  Play,
  Pause,
  Plus,
  Check,
  Download,
  Share2,
  ChevronDown,
  Clock,
  ThumbsUp,
  Mic,
  Pause as PauseIcon,
  RotateCw,
  CheckCircle2,
} from 'lucide-react';
import { Movie, Episode, WatchProgress, VjStreamOption, DownloadItem } from '../types';
import { NetflixNLogo } from '../components/NetflixLogo';
import { MovieCard } from '../components/MovieCard';
import { ResilientImage } from '../components/ResilientImage';
import { NetflixPlayer } from '../components/NetflixPlayer';
import { fetchTmdbSeasonEpisodes } from '../services/tmdb';

interface MovieDetailsScreenProps {
  movie: Movie;
  catalogMovies?: Movie[];
  initialAudioLang?: string;
  autoPlay?: boolean;
  onBack: () => void;
  onCastClick: () => void;
  isInWatchlist: boolean;
  onToggleWatchlist: (movieId: string) => void;
  onDownload: (movie: Movie, episode?: Episode) => void;
  downloads?: DownloadItem[];
  isDownloaded?: boolean;
  onPauseDownload?: (downloadId: string) => void;
  onResumeDownload?: (downloadId: string) => void;
  onOpenDownloads?: () => void;
  isLoadingDetails?: boolean;
  onProgressUpdate?: (progress: WatchProgress) => void;
  onSelectSimilarMovie?: (movie: Movie) => void;
}

export const MovieDetailsScreen: React.FC<MovieDetailsScreenProps> = ({
  movie,
  catalogMovies = [],
  initialAudioLang = 'English [Original]',
  autoPlay = false,
  onBack,
  onCastClick,
  isInWatchlist,
  onToggleWatchlist,
  onDownload,
  downloads = [],
  isDownloaded = false,
  onPauseDownload,
  onResumeDownload,
  onOpenDownloads,
  isLoadingDetails = false,
  onProgressUpdate,
  onSelectSimilarMovie,
}) => {
  const [activeTab, setActiveTab] = useState<'episodes' | 'trailers' | 'more-like-this'>(
    movie.type === 'series' ? 'episodes' : 'more-like-this'
  );
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<Episode[]>(movie.episodes || []);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | undefined>(
    movie.episodes ? movie.episodes[0] : undefined
  );
  const [isLoadingSeason, setIsLoadingSeason] = useState<boolean>(false);
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false);
  const [showYoutubeTrailer, setShowYoutubeTrailer] = useState(false);
  const [sharedToast, setSharedToast] = useState(false);
  const [liked, setLiked] = useState(false);

  const defaultAudioLabel = movie.vjName ? `Luganda (${movie.vjName})` : initialAudioLang;

  // In-place Banner / Landscape Video Player State
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);
  const [audioLang, setAudioLang] = useState<string>(defaultAudioLabel);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeVjStream, setActiveVjStream] = useState<VjStreamOption | null>(null);

  const bannerRef = useRef<HTMLDivElement>(null);
  const seasonCacheRef = useRef<Map<string, Episode[]>>(new Map());

  useEffect(() => {
    setActiveTab(movie.type === 'series' ? 'episodes' : 'more-like-this');
    setSelectedSeason(1);
    const initialEps = movie.episodes || [];
    if (initialEps.length > 0) {
      seasonCacheRef.current.set(`${movie.id}::S1`, initialEps);
    }
    setSeasonEpisodes(initialEps);
    setSelectedEpisode(initialEps[0]);
    setIsSeasonDropdownOpen(false);
    setShowYoutubeTrailer(false);
    setIsPlaying(autoPlay);
    setActiveVjStream(null);
    setAudioLang(movie.vjName ? `Luganda (${movie.vjName})` : initialAudioLang);
    setIsFullscreen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.id, autoPlay]);

  // Update episodes seamlessly when background hydration completes for the active title
  useEffect(() => {
    if (movie.episodes && movie.episodes.length > 0) {
      seasonCacheRef.current.set(`${movie.id}::S1`, movie.episodes);
      if (selectedSeason === 1) {
        setSeasonEpisodes(movie.episodes);
      }
      setSelectedEpisode((prev) => {
        if (!prev) return movie.episodes?.[0];
        const refreshed = movie.episodes?.find(
          (ep) => ep.id === prev.id || (ep.seasonNumber === prev.seasonNumber && ep.episodeNumber === prev.episodeNumber)
        );
        return refreshed || prev;
      });
    }
  }, [movie.id, movie.episodes, selectedSeason]);

  const effectiveMovie: Movie = React.useMemo(() => {
    if (!activeVjStream) return movie;
    return {
      ...movie,
      videoUrl: activeVjStream.videoUrl,
      vjName: activeVjStream.vjName,
      munoId: activeVjStream.munoId ?? movie.munoId,
      seriesCode: activeVjStream.seriesCode ?? movie.seriesCode,
    };
  }, [movie, activeVjStream]);

  const handleSelectVjVersion = (opt: VjStreamOption) => {
    setActiveVjStream(opt);
    setAudioLang(`Luganda (${opt.vjName})`);
  };

  const handleStartPlayback = () => {
    setIsPlaying(true);
    if (bannerRef.current) {
      bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleTogglePlay = () => {
    if (!isPlaying) {
      handleStartPlayback();
    } else {
      setIsPlaying(false);
    }
  };

  const handleSelectSeason = async (season: number) => {
    setSelectedSeason(season);
    setIsSeasonDropdownOpen(false);

    const cacheKey = `${movie.id}::S${season}`;
    const cached = seasonCacheRef.current.get(cacheKey);
    if (cached && cached.length > 0) {
      setSeasonEpisodes(cached);
      return;
    }

    if (!movie.tmdbId) return;

    setIsLoadingSeason(true);
    try {
      const eps = await fetchTmdbSeasonEpisodes(
        movie.tmdbId,
        season,
        movie.backdropUrl,
        movie.seriesCode
      );
      if (eps.length > 0) {
        seasonCacheRef.current.set(cacheKey, eps);
        setSeasonEpisodes(eps);
      }
    } catch {
      // Retain current episodes if season fetch fails
    } finally {
      setIsLoadingSeason(false);
    }
  };

  const handleSelectEpisode = (ep: Episode) => {
    setSelectedEpisode(ep);
    setIsPlaying(true);
    if (bannerRef.current && !isFullscreen) {
      bannerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href).catch(() => {});
    }
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 2400);
  };

  const episodes = seasonEpisodes.length > 0 ? seasonEpisodes : movie.episodes || [];
  const targetEpisode = selectedEpisode || episodes[0];
  const targetDownloadId = targetEpisode ? `dl-${targetEpisode.id}` : `dl-${movie.id}`;
  const activeDownloadItem =
    downloads.find((d) => d.id === targetDownloadId) ||
    downloads.find((d) => d.movieId === movie.id);

  const seasonsList = Array.from(
    { length: Math.min(12, Math.max(1, movie.seasonsCount || 4)) },
    (_, i) => i + 1
  );

  const similarMovies =
    movie.similarMovies && movie.similarMovies.length > 0
      ? movie.similarMovies
      : catalogMovies
          .filter((m) => m.id !== movie.id && m.genres.some((g) => movie.genres.includes(g)))
          .slice(0, 12);

  return (
    <div className="flex-1 w-full bg-black text-white flex flex-col overflow-y-auto no-scrollbar select-none pb-24 md:pl-22 lg:pl-24 md:pr-8 md:pt-5">
      <div className="w-full max-w-[1400px] mx-auto flex flex-col">
        {/* 1. WIDESCREEN CINEMATIC BANNER / IN-PLACE NETFLIX VIDEO PLAYER */}
        <div
          ref={bannerRef}
          className={
            isFullscreen
              ? 'fixed inset-0 z-50 bg-black'
              : `relative w-full ${
                  isPlaying
                    ? 'h-[270px] sm:h-96 md:h-[460px] lg:h-[520px]'
                    : 'h-64 sm:h-96 md:h-[460px] lg:h-[520px]'
                } md:rounded-2xl md:border md:border-white/10 shrink-0 overflow-hidden bg-neutral-950 transition-all select-none shadow-2xl`
          }
        >
          {/* STATE A: NOT PLAYING HERO BANNER */}
          {!isPlaying && !isFullscreen && (
            <>
              <div className="absolute inset-0 z-0 bg-neutral-950 flex items-center justify-center overflow-hidden">
                <ResilientImage
                  src={selectedEpisode?.thumbnail || movie.backdropUrl || movie.posterUrl}
                  alt={movie.title}
                  className="w-full h-full object-cover object-[50%_22%] scale-100 filter brightness-90"
                  fallbackGradient="from-[#2b0509] via-neutral-900 to-black"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-transparent pointer-events-none" />
                <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent pointer-events-none" />
              </div>

              <div className="absolute top-3.5 inset-x-0 px-4 sm:px-6 flex items-center justify-between z-30">
                <button
                  type="button"
                  onClick={onBack}
                  className="w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border border-white/15 shadow-lg cursor-pointer"
                  aria-label="Back"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={onCastClick}
                    className="w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border border-white/15 shadow-lg cursor-pointer"
                    aria-label="Stream to TV"
                    title="Stream to TV"
                  >
                    <Cast size={19} />
                  </button>
                  <button
                    type="button"
                    onClick={handleShare}
                    className="w-10 h-10 rounded-full bg-black/65 hover:bg-black/85 backdrop-blur-md flex items-center justify-center text-white transition-all active:scale-95 border border-white/15 shadow-lg cursor-pointer"
                    aria-label="Share title"
                    title="Share"
                  >
                    <Share2 size={19} />
                  </button>
                </div>
              </div>

              <div className="absolute inset-0 flex items-center justify-center z-20">
                <button
                  type="button"
                  onClick={handleStartPlayback}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 border-2 border-white/90 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 active:scale-95 transition-all shadow-2xl cursor-pointer group"
                  aria-label={`Play ${movie.title}`}
                >
                  <Play size={28} className="fill-white ml-1 group-hover:scale-105 transition-transform" />
                </button>
              </div>

              <div className="absolute inset-x-0 md:inset-x-auto md:left-0 bottom-5 md:bottom-8 px-4 sm:px-8 flex flex-col items-center text-center md:items-start md:text-left z-20 pointer-events-none">
                <div className="flex items-center gap-1.5 mb-1 text-[11px] font-bold tracking-[0.22em] text-neutral-200 uppercase drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                  {movie.isOriginal && <NetflixNLogo size={13} />}
                  <span>{movie.type === 'series' ? 'NETFLUX SERIES' : 'NETFLUX FILM'}</span>
                </div>
                <h2 className="font-bebas text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black text-white uppercase tracking-wider drop-shadow-[0_4px_16px_rgba(0,0,0,0.95)] line-clamp-2 max-w-2xl">
                  {movie.title}
                </h2>
              </div>
            </>
          )}

          {/* STATE B: NETFLIX PLAYER (PLAYING IN BANNER OR LANDSCAPE FULLSCREEN) */}
          {(isPlaying || isFullscreen) && (
            <NetflixPlayer
              movie={effectiveMovie}
              episode={selectedEpisode}
              episodes={episodes}
              initialAudioLang={audioLang}
              isPlaying={isPlaying}
              isFullscreen={isFullscreen}
              variant="banner"
              onPlayPause={setIsPlaying}
              onToggleFullscreen={setIsFullscreen}
              onBack={() => {
                setIsPlaying(false);
                onBack();
              }}
              onCastClick={onCastClick}
              onSelectEpisode={(ep) => {
                setSelectedEpisode(ep);
                setIsPlaying(true);
              }}
              onAudioLangChange={setAudioLang}
              onSelectVjStream={handleSelectVjVersion}
              onProgressUpdate={onProgressUpdate}
            />
          )}
        </div>

        {/* 2. DESKTOP 2-COLUMN DETAILS & ACTIONS SECTION */}
        <div className="px-4 md:px-1 pt-5 flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 mb-6">
            {/* Left Primary Column */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {movie.isOriginal && <NetflixNLogo size={16} />}
                  <h1 className="font-bebas text-3xl sm:text-4xl lg:text-5xl font-black tracking-wide text-white uppercase leading-none truncate">
                    {movie.title}
                  </h1>
                </div>
                {isLoadingDetails && (
                  <span className="text-[11px] font-semibold text-neutral-400 animate-pulse shrink-0">
                    Updating details...
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2.5 text-xs sm:text-sm text-neutral-300 font-medium mb-4 flex-wrap">
                <span className="text-[#46d369] font-bold">{movie.matchScore}% Match</span>
                <span>{movie.year}</span>
                <span className="px-1.5 py-0.5 rounded bg-neutral-800 border border-neutral-700 text-[10px] text-neutral-300 font-bold">
                  {movie.ageRating}
                </span>
                <span>{movie.durationOrSeasons}</span>
                <span className="px-1.5 py-0.5 rounded border border-neutral-600 text-[10px] font-bold text-neutral-300">
                  {movie.quality}
                </span>
                {effectiveMovie.vjName && (
                  <span className="px-2 py-0.5 rounded bg-emerald-600/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300">
                    {effectiveMovie.vjName}
                  </span>
                )}
                {movie.top10Rank && (
                  <span className="text-[#E50914] font-bold">#{movie.top10Rank} in Uganda Today</span>
                )}
              </div>

              {/* Multi-VJ / VOD Stream Switcher (shown whenever multiple VJs share this TMDB title) */}
              {movie.vjStreams && movie.vjStreams.length > 1 && (
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 mr-1">
                    VJ Versions:
                  </span>
                  {movie.vjStreams.map((opt) => {
                    const isCurrent =
                      (effectiveMovie.vjName || '').toLowerCase() === opt.vjName.toLowerCase();
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectVjVersion(opt)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[#E50914] border-[#E50914] text-white shadow'
                            : 'bg-neutral-900 border-white/15 text-neutral-300 hover:border-white/40 hover:text-white'
                        }`}
                      >
                        <Mic size={11} />
                        <span>{opt.vjName}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Action Buttons Row (Stacked on Mobile, Inline on Desktop) */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3 mb-5">
                <button
                  type="button"
                  onClick={handleTogglePlay}
                  className="w-full sm:w-auto sm:min-w-[165px] h-11 px-6 bg-white hover:bg-neutral-200 active:scale-[0.99] text-black font-bold text-sm rounded-lg transition-all flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  {isPlaying ? (
                    <>
                      <Pause size={18} className="fill-black" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play size={18} className="fill-black" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    data-testid="details-download-button"
                    onClick={() => {
                      if (!activeDownloadItem) {
                        onDownload(effectiveMovie, targetEpisode);
                      } else if (
                        activeDownloadItem.status === 'pending' ||
                        activeDownloadItem.status === 'downloading'
                      ) {
                        onPauseDownload?.(activeDownloadItem.id);
                      } else if (
                        activeDownloadItem.status === 'paused' ||
                        activeDownloadItem.status === 'failed'
                      ) {
                        onResumeDownload?.(activeDownloadItem.id);
                      } else {
                        onDownload(effectiveMovie, targetEpisode);
                      }
                    }}
                    className="relative overflow-hidden flex-1 sm:flex-initial sm:min-w-[185px] h-11 px-5 bg-neutral-800 hover:bg-neutral-700 active:scale-[0.99] text-white font-semibold text-xs sm:text-sm rounded-lg transition-all flex items-center justify-center gap-2 border border-white/10 cursor-pointer"
                  >
                    {activeDownloadItem?.status === 'downloading' && (
                      <span
                        className="absolute bottom-0 left-0 h-0.5 bg-[#E50914] transition-all duration-300"
                        style={{ width: `${Math.max(5, activeDownloadItem.progress)}%` }}
                      />
                    )}
                    {activeDownloadItem?.status === 'pending' ? (
                      <>
                        <Clock size={16} className="text-amber-400" />
                        <span className="tabular-nums">Pending · 0% / 100%</span>
                      </>
                    ) : activeDownloadItem?.status === 'downloading' ? (
                      <>
                        <Download size={16} className="text-[#E50914]" />
                        <span className="tabular-nums">Downloading · {activeDownloadItem.progress}% / 100%</span>
                      </>
                    ) : activeDownloadItem?.status === 'paused' ? (
                      <>
                        <RotateCw size={15} className="text-neutral-300" />
                        <span className="tabular-nums">Paused · {activeDownloadItem.progress}% / 100%</span>
                      </>
                    ) : activeDownloadItem?.status === 'failed' ? (
                      <>
                        <RotateCw size={15} className="text-red-400" />
                        <span>Retry Download</span>
                      </>
                    ) : activeDownloadItem?.status === 'completed' || isDownloaded ? (
                      <>
                        <CheckCircle2 size={16} className="text-[#46d369]" />
                        <span className="tabular-nums">Downloaded · 100%</span>
                      </>
                    ) : (
                      <>
                        <Download size={16} />
                        <span>Download</span>
                      </>
                    )}
                  </button>

                  {activeDownloadItem && onOpenDownloads && (
                    <button
                      type="button"
                      onClick={onOpenDownloads}
                      data-testid="details-view-downloads-button"
                      className="h-11 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-white/10 text-xs font-semibold text-neutral-300 hover:text-white transition-colors shrink-0 cursor-pointer"
                      title="Open Downloads"
                    >
                      Downloads
                    </button>
                  )}
                </div>

                {/* Inline Icon Actions on Desktop (Centered strip on mobile) */}
                <div className="flex items-center justify-around sm:justify-start gap-2 sm:gap-5 pt-2 sm:pt-0 sm:pl-3 border-t sm:border-t-0 border-white/10 text-xs text-neutral-400">
                  <button
                    type="button"
                    onClick={() => onToggleWatchlist(movie.id)}
                    className={`flex flex-col items-center gap-1 transition-colors cursor-pointer px-2 ${
                      isInWatchlist ? 'text-[#E50914]' : 'hover:text-white'
                    }`}
                  >
                    {isInWatchlist ? <Check size={19} /> : <Plus size={19} />}
                    <span className="text-[10px] font-medium">My List</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLiked(!liked)}
                    className={`flex flex-col items-center gap-1 transition-colors cursor-pointer px-2 ${
                      liked ? 'text-blue-400' : 'hover:text-white'
                    }`}
                  >
                    <ThumbsUp size={19} className={liked ? 'fill-blue-400' : ''} />
                    <span className="text-[10px] font-medium">{liked ? 'Rated' : 'Rate'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShare}
                    className="flex flex-col items-center gap-1 hover:text-white transition-colors cursor-pointer px-2"
                  >
                    <Share2 size={19} />
                    <span className="text-[10px] font-medium">Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={onCastClick}
                    className="flex flex-col items-center gap-1 hover:text-white transition-colors cursor-pointer px-2"
                  >
                    <Cast size={19} />
                    <span className="text-[10px] font-medium">Cast</span>
                  </button>
                </div>
              </div>

              {sharedToast && (
                <div className="mb-4 py-2 px-3 bg-neutral-800 text-neutral-200 text-xs rounded-lg text-center border border-white/10 max-w-sm">
                  Link copied to clipboard!
                </div>
              )}

              {movie.tagline && (
                <p className="text-xs sm:text-sm italic text-neutral-400 mb-2">
                  &ldquo;{movie.tagline}&rdquo;
                </p>
              )}

              <p className="text-xs sm:text-sm text-neutral-200 leading-relaxed max-w-3xl">
                {movie.synopsis}
              </p>
            </div>

            {/* Right Metadata Card Column */}
            <div className="lg:col-span-4">
              <div className="bg-neutral-950/90 border border-white/10 rounded-xl p-4 sm:p-5 flex flex-col gap-3 text-xs text-neutral-400">
                {movie.cast && movie.cast.length > 0 && (
                  <div>
                    <span className="text-neutral-500 font-semibold block mb-0.5 uppercase text-[10px] tracking-wider">
                      Cast
                    </span>
                    <span className="text-neutral-200 leading-relaxed">{movie.cast.join(', ')}</span>
                  </div>
                )}
                {movie.director && (
                  <div>
                    <span className="text-neutral-500 font-semibold block mb-0.5 uppercase text-[10px] tracking-wider">
                      Creator / Director
                    </span>
                    <span className="text-neutral-200">{movie.director}</span>
                  </div>
                )}
                <div>
                  <span className="text-neutral-500 font-semibold block mb-0.5 uppercase text-[10px] tracking-wider">
                    Genres
                  </span>
                  <span className="text-neutral-200">{movie.genres.join(', ')}</span>
                </div>
                <div>
                  <span className="text-neutral-500 font-semibold block mb-0.5 uppercase text-[10px] tracking-wider">
                    Audio Tracks
                  </span>
                  <span className="text-neutral-200">{audioLang} · Luganda VJ Options</span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. FULL-WIDTH SUB-NAVIGATION TABS */}
          <div className="flex items-center gap-6 sm:gap-8 border-b border-white/10 pb-2.5 mb-5 text-xs sm:text-sm font-semibold select-none">
            {movie.type === 'series' && (
              <button
                type="button"
                onClick={() => setActiveTab('episodes')}
                className={`relative pb-1 transition-colors cursor-pointer ${
                  activeTab === 'episodes' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                Episodes
                {activeTab === 'episodes' && (
                  <span className="absolute bottom-[-11px] inset-x-0 h-[2.5px] bg-[#E50914] rounded-full" />
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setActiveTab('trailers')}
              className={`relative pb-1 transition-colors cursor-pointer ${
                activeTab === 'trailers' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              Trailers &amp; More
              {activeTab === 'trailers' && (
                <span className="absolute bottom-[-11px] inset-x-0 h-[2.5px] bg-[#E50914] rounded-full" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('more-like-this')}
              className={`relative pb-1 transition-colors cursor-pointer ${
                activeTab === 'more-like-this' ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              More Like This
              {activeTab === 'more-like-this' && (
                <span className="absolute bottom-[-11px] inset-x-0 h-[2.5px] bg-[#E50914] rounded-full" />
              )}
            </button>
          </div>

          {/* Tab 1: Episodes Grid */}
          {activeTab === 'episodes' && movie.type === 'series' && (
            <div className="flex flex-col gap-4">
              <div className="relative flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                  className="flex items-center gap-2 px-3.5 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-xs font-semibold text-neutral-200 hover:border-neutral-500 cursor-pointer"
                >
                  <span>Season {selectedSeason}</span>
                  <ChevronDown size={14} className={isSeasonDropdownOpen ? 'rotate-180' : ''} />
                </button>
                {isLoadingSeason && (
                  <span className="text-[11px] text-neutral-400 animate-pulse">Loading episodes...</span>
                )}

                {isSeasonDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1.5 w-40 bg-neutral-900 border border-neutral-700 rounded-xl shadow-2xl py-1 z-30 max-h-56 overflow-y-auto">
                    {seasonsList.map((season) => (
                      <button
                        key={season}
                        type="button"
                        onClick={() => handleSelectSeason(season)}
                        className={`w-full text-left px-3.5 py-2 text-xs hover:bg-neutral-800 ${
                          selectedSeason === season ? 'text-[#E50914] font-bold' : 'text-neutral-300'
                        }`}
                      >
                        Season {season}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {episodes.map((ep) => {
                  const isSelected = selectedEpisode?.id === ep.id;
                  return (
                    <div
                      key={ep.id}
                      className={`flex flex-col gap-2.5 p-3 rounded-xl border transition-all cursor-pointer group ${
                        isSelected
                          ? 'bg-neutral-900/90 border-[#E50914]/60 ring-1 ring-[#E50914]/40'
                          : 'bg-neutral-950/80 border-white/10 hover:border-white/25'
                      }`}
                      onClick={() => handleSelectEpisode(ep)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-neutral-800 shrink-0">
                          <ResilientImage
                            src={ep.thumbnail}
                            alt={ep.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full bg-black/70 border border-white flex items-center justify-center text-white">
                              <Play size={12} className="fill-white ml-0.5" />
                            </div>
                          </div>
                        </div>

                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-100 line-clamp-1 group-hover:text-[#E50914] transition-colors">
                            {ep.episodeNumber}. {ep.title}
                          </h4>
                          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 mt-1">
                            <Clock size={11} />
                            <span>{ep.duration}</span>
                          </div>
                        </div>

                        {(() => {
                          const epDl = downloads.find((d) => d.id === `dl-${ep.id}`);
                          return (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (epDl?.status === 'downloading' || epDl?.status === 'pending') {
                                  onPauseDownload?.(epDl.id);
                                } else if (epDl?.status === 'paused' || epDl?.status === 'failed') {
                                  onResumeDownload?.(epDl.id);
                                } else {
                                  onDownload(effectiveMovie, ep);
                                }
                              }}
                              className="p-2 text-neutral-400 hover:text-white cursor-pointer"
                              title={
                                epDl?.status === 'completed'
                                  ? 'Saved to Device'
                                  : epDl?.status === 'downloading'
                                    ? `Downloading ${epDl.progress}%`
                                    : epDl?.status === 'pending'
                                      ? 'Pending...'
                                      : 'Download Episode'
                              }
                            >
                              {epDl?.status === 'downloading' || epDl?.status === 'pending' ? (
                                <span className="text-[11px] font-bold text-[#E50914] tabular-nums">
                                  {epDl.status === 'pending' ? '0%' : `${epDl.progress}%`}
                                </span>
                              ) : epDl?.status === 'completed' ? (
                                <CheckCircle2 size={16} className="text-[#46d369]" />
                              ) : (
                                <Download size={16} />
                              )}
                            </button>
                          );
                        })()}
                      </div>

                      <p className="text-xs text-neutral-400 line-clamp-2 leading-relaxed">
                        {ep.synopsis}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: Trailers & More */}
          {activeTab === 'trailers' && (
            <div className="max-w-3xl flex flex-col gap-3">
              <div className="p-3 rounded-xl bg-neutral-950 border border-white/10">
                {showYoutubeTrailer && movie.trailerKey ? (
                  <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black mb-3">
                    <iframe
                      title={`Official Trailer: ${movie.title}`}
                      src={`https://www.youtube.com/embed/${movie.trailerKey}?autoplay=1`}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  <div
                    className="relative w-full h-48 sm:h-64 md:h-80 rounded-lg overflow-hidden bg-neutral-800 mb-3 cursor-pointer group"
                    onClick={() => {
                      if (movie.trailerKey) {
                        setShowYoutubeTrailer(true);
                      } else {
                        handleStartPlayback();
                      }
                    }}
                  >
                    <ResilientImage
                      src={movie.backdropUrl}
                      alt="Official Trailer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-full bg-black/70 border border-white flex items-center justify-center text-white">
                        <Play size={22} className="fill-white ml-0.5" />
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 px-1">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-0.5">
                      Official Trailer: {movie.title}
                    </h4>
                    <span className="text-xs text-neutral-400">
                      {movie.trailerKey ? 'YouTube HD Trailer' : '2m 14s · 4K Ultra HD'}
                    </span>
                  </div>
                  {showYoutubeTrailer && (
                    <button
                      type="button"
                      onClick={() => setShowYoutubeTrailer(false)}
                      className="text-xs text-neutral-300 hover:text-white px-3 py-1.5 rounded-lg bg-neutral-900 cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: More Like This */}
          {activeTab === 'more-like-this' && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-3.5 sm:gap-4">
              {similarMovies.map((simMovie) => (
                <MovieCard
                  key={simMovie.id}
                  movie={simMovie}
                  onSelect={(m) => {
                    if (onSelectSimilarMovie) {
                      onSelectSimilarMovie(m);
                    }
                  }}
                  fullWidth={true}
                  showTitle={true}
                  subtitle={`${simMovie.year} · ${simMovie.type === 'series' ? 'Series' : 'Movie'}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
