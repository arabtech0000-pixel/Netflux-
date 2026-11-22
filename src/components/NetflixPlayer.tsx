import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Cast,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Subtitles,
  Maximize2,
  Minimize2,
  SkipForward,
  Lock,
  Unlock,
  Layers,
  Check,
  X,
  Loader2,
  AlertCircle,
  Mic,
  Gauge,
} from 'lucide-react';
import { Movie, Episode, WatchProgress, VjStreamOption } from '../types';
import {
  formatTime,
  calculateProgressPercent,
  computeBufferedPercent,
  clampVolume,
  shouldRotateForLandscape,
  parseDurationToSeconds,
  getInitialStreamMode,
  resolveEffectiveVideoSrc,
} from '../services/logic';
import { ResilientImage } from './ResilientImage';
import { NetflixNLogo } from './NetflixLogo';

export interface NetflixPlayerProps {
  movie: Movie;
  episode?: Episode;
  episodes?: Episode[];
  initialTime?: number;
  initialAudioLang?: string;
  isPlaying: boolean;
  isFullscreen: boolean;
  variant?: 'banner' | 'fullscreen';
  onPlayPause: (nextPlaying: boolean) => void;
  onToggleFullscreen: (nextFullscreen: boolean) => void;
  onBack: () => void;
  onCastClick: () => void;
  onSelectEpisode?: (episode: Episode) => void;
  onNextEpisode?: () => void;
  onAudioLangChange?: (lang: string) => void;
  onSelectVjStream?: (option: VjStreamOption) => void;
  onProgressUpdate?: (progress: WatchProgress) => void;
}

const SUBTITLE_TRACKS = ['Off', 'English [CC]', 'Luganda', 'Swahili', 'French'];
const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const NetflixPlayer: React.FC<NetflixPlayerProps> = ({
  movie,
  episode,
  episodes = [],
  initialTime = 0,
  initialAudioLang = 'English [Original]',
  isPlaying,
  isFullscreen,
  variant = 'banner',
  onPlayPause,
  onToggleFullscreen,
  onBack,
  onCastClick,
  onSelectEpisode,
  onNextEpisode,
  onAudioLangChange,
  onSelectVjStream,
  onProgressUpdate,
}) => {
  const [selectedVjOption, setSelectedVjOption] = useState<VjStreamOption | null>(null);

  // Build available VJ stream tracks for this title
  const vjStreamOptions = useMemo<VjStreamOption[]>(() => {
    const baseList = Array.isArray(movie.vjStreams) ? [...movie.vjStreams] : [];
    if (movie.videoUrl && !baseList.some((v) => v.videoUrl === movie.videoUrl)) {
      baseList.unshift({
        id: movie.id,
        vjName: movie.vjName || 'Luganda Dubbed',
        videoUrl: movie.videoUrl,
        munoId: movie.munoId,
        seriesCode: movie.seriesCode,
      });
    }
    return baseList;
  }, [movie.id, movie.videoUrl, movie.vjName, movie.munoId, movie.seriesCode, movie.vjStreams]);

  const activeStreamUrl =
    episode?.videoUrl || selectedVjOption?.videoUrl || movie.videoUrl || '';
  const activeVjName =
    episode?.vjName || selectedVjOption?.vjName || movie.vjName || 'Luganda Dubbed';

  const streamTrackId = `${movie.id}::${episode?.id || 'main'}::${selectedVjOption?.id || ''}::${activeStreamUrl}`;
  const [fallbackOverride, setFallbackOverride] = useState<{
    trackId: string;
    mode: 'proxy' | 'direct';
  } | null>(null);

  const streamMode: 'proxy' | 'direct' =
    fallbackOverride && fallbackOverride.trackId === streamTrackId
      ? fallbackOverride.mode
      : getInitialStreamMode(activeStreamUrl);

  const effectiveVideoSrc = resolveEffectiveVideoSrc(activeStreamUrl, streamMode);

  const fallbackDuration = episode
    ? episode.durationSeconds
    : parseDurationToSeconds(movie.durationOrSeasons, movie.type);

  const [videoDuration, setVideoDuration] = useState<number>(fallbackDuration);
  const [currentTime, setCurrentTime] = useState<number>(initialTime);
  const [videoBufferedPercent, setVideoBufferedPercent] = useState<number>(0);
  const [isBuffering, setIsBuffering] = useState<boolean>(Boolean(activeStreamUrl));
  const [videoError, setVideoError] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [audioLang, setAudioLang] = useState<string>(
    activeVjName ? `Luganda (${activeVjName})` : initialAudioLang
  );
  const [subtitles, setSubtitles] = useState<string>('Off');
  const [activePopover, setActivePopover] = useState<'none' | 'audio' | 'episodes' | 'speed'>(
    'none'
  );
  const [seekFeedback, setSeekFeedback] = useState<'rewind' | 'forward' | null>(null);
  const [hoverScrub, setHoverScrub] = useState<{ percent: number; timeSeconds: number } | null>(
    null
  );
  const [viewport, setViewport] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  const totalDuration = videoDuration > 0 ? videoDuration : fallbackDuration;

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isHoveringControlsRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number | null>(null);
  const attemptedModesRef = useRef<Set<'direct' | 'proxy'>>(new Set());
  const isPlayingRef = useRef<boolean>(isPlaying);
  isPlayingRef.current = isPlaying;
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;
  const isMutedRef = useRef<boolean>(isMuted);
  isMutedRef.current = isMuted;
  const playbackSpeedRef = useRef<number>(playbackSpeed);
  playbackSpeedRef.current = playbackSpeed;
  const onProgressUpdateRef = useRef(onProgressUpdate);
  onProgressUpdateRef.current = onProgressUpdate;

  const abortCurrentVideoLoad = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    try {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    } catch {
      // Safe no-op
    }
  }, []);

  // Reset timeline and stream fallback tracker when switching movie or episode
  useEffect(() => {
    setSelectedVjOption(null);
    setFallbackOverride(null);
    pendingSeekTimeRef.current = initialTime > 0 ? initialTime : null;
    attemptedModesRef.current = new Set();
    setCurrentTime(initialTime);
    setVideoDuration(fallbackDuration);
    setVideoBufferedPercent(0);
    setVideoError(false);
    const nextUrl = episode?.videoUrl || movie.videoUrl || '';
    setIsBuffering(Boolean(nextUrl));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movie.id, episode?.id, episode?.videoUrl, movie.videoUrl, initialTime]);

  // Instant source swap: synchronously abort previous episode download & start new episode immediately
  const activeTrackKey = `${streamTrackId}::${streamMode}`;
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    // Immediately abort any active buffer/connection from previous episode
    try {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    } catch {
      // Safe no-op
    }

    if (!effectiveVideoSrc || videoError) {
      setIsBuffering(false);
      return;
    }

    setIsBuffering(true);
    try {
      vid.setAttribute('referrerpolicy', 'no-referrer');
      vid.src = effectiveVideoSrc;
      vid.volume = volumeRef.current;
      vid.muted = isMutedRef.current;
      vid.playbackRate = playbackSpeedRef.current;
      const startAt =
        pendingSeekTimeRef.current && pendingSeekTimeRef.current > 0
          ? pendingSeekTimeRef.current
          : 0;
      if (startAt === 0) {
        vid.currentTime = 0;
      }
      vid.load();
      if (isPlayingRef.current) {
        const p = vid.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            // Browser gesture policy fallback
          });
        }
      }
    } catch {
      // Handled by media onError
    }

    return () => {
      try {
        vid.pause();
        vid.removeAttribute('src');
        vid.load();
      } catch {
        // Safe cleanup
      }
    };
  }, [activeTrackKey, effectiveVideoSrc, videoError]);

  useEffect(() => {
    if (selectedVjOption) {
      setAudioLang(`Luganda (${selectedVjOption.vjName})`);
    } else if (episode?.vjName) {
      setAudioLang(`Luganda (${episode.vjName})`);
    } else if (movie.vjName) {
      setAudioLang(`Luganda (${movie.vjName})`);
    } else {
      setAudioLang(initialAudioLang);
    }
  }, [selectedVjOption, episode?.vjName, movie.vjName, initialAudioLang]);

  // Sync HTML5 <video> play / pause state
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || !effectiveVideoSrc || videoError) return;
    if (isPlaying) {
      const p = vid.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {
          // Browser gesture policy fallback
        });
      }
    } else {
      vid.pause();
    }
  }, [isPlaying, effectiveVideoSrc, videoError]);

  // Sync volume, mute, playback speed, and no-referrer policy
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.setAttribute('referrerpolicy', 'no-referrer');
    vid.volume = volume;
    vid.muted = isMuted;
  }, [volume, isMuted, effectiveVideoSrc]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.playbackRate = playbackSpeed;
  }, [playbackSpeed, effectiveVideoSrc]);

  // Track viewport resize
  useEffect(() => {
    const handleResize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Sync Escape exit from native fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isFullscreen && variant === 'banner') {
        onToggleFullscreen(false);
        setIsLocked(false);
        try {
          (screen.orientation as unknown as { unlock?: () => void })?.unlock?.();
        } catch {
          // Safe no-op
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [isFullscreen, onToggleFullscreen, variant]);

  const resetControlsTimeout = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    setShowControls(true);
    if (isPlaying && !isLocked && activePopover === 'none' && !isHoveringControlsRef.current) {
      controlsTimeoutRef.current = setTimeout(() => {
        if (!isHoveringControlsRef.current) {
          setShowControls(false);
        }
      }, 4500);
    }
  }, [isPlaying, isLocked, activePopover]);

  useEffect(() => {
    if (!isPlaying || activePopover !== 'none') {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
    } else {
      resetControlsTimeout();
    }
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [isPlaying, activePopover, resetControlsTimeout]);

  // Simulated fallback timer ONLY when no playable stream is present
  useEffect(() => {
    if (!isPlaying) return;
    if (activeStreamUrl && !videoError) return;
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + playbackSpeed;
        if (next >= totalDuration) {
          onPlayPause(false);
          return totalDuration;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalDuration, onPlayPause, activeStreamUrl, videoError]);

  // Save watch progress periodically
  useEffect(() => {
    if (!isPlaying && currentTime === 0) return;
    if (!onProgressUpdateRef.current) return;

    const timer = setInterval(() => {
      onProgressUpdateRef.current?.({
        movieId: movie.id,
        episodeId: episode?.id,
        title: movie.title,
        episodeInfo: episode ? `S${episode.seasonNumber}:E${episode.episodeNumber}` : undefined,
        currentTime,
        duration: totalDuration,
        posterUrl: movie.posterUrl,
        lastWatchedAt: Date.now(),
      });
    }, 5000);

    return () => clearInterval(timer);
  }, [isPlaying, currentTime, movie.id, movie.title, movie.posterUrl, episode, totalDuration]);

  const triggerSeekFeedback = (dir: 'rewind' | 'forward') => {
    setSeekFeedback(dir);
    if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = setTimeout(() => setSeekFeedback(null), 600);
  };

  const seekToTime = useCallback(
    (targetSeconds: number) => {
      const clamped = Math.min(totalDuration, Math.max(0, targetSeconds));
      setCurrentTime(clamped);
      const vid = videoRef.current;
      if (vid && activeStreamUrl && !videoError && Number.isFinite(clamped)) {
        try {
          vid.currentTime = clamped;
        } catch {
          // Ignore seek before metadata ready
        }
      }
    },
    [totalDuration, activeStreamUrl, videoError]
  );

  const handleRewind10 = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      seekToTime(currentTime - 10);
      triggerSeekFeedback('rewind');
      resetControlsTimeout();
    },
    [currentTime, seekToTime, resetControlsTimeout]
  );

  const handleForward10 = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      seekToTime(currentTime + 10);
      triggerSeekFeedback('forward');
      resetControlsTimeout();
    },
    [currentTime, seekToTime, resetControlsTimeout]
  );

  const handleEnterLandscape = useCallback(async () => {
    onToggleFullscreen(true);
    try {
      const el = containerRef.current;
      if (el && el.requestFullscreen && !document.fullscreenElement) {
        await el.requestFullscreen().catch(() => {});
      }
      const orientation = screen.orientation as unknown as {
        lock?: (mode: string) => Promise<void>;
      };
      if (orientation?.lock) {
        await orientation.lock('landscape').catch(() => {});
      }
    } catch {
      // Fallback CSS landscape framing works seamlessly inside iframes/portrait devices
    }
    resetControlsTimeout();
  }, [onToggleFullscreen, resetControlsTimeout]);

  const handleExitLandscape = useCallback(async () => {
    setIsLocked(false);
    setActivePopover('none');
    onToggleFullscreen(false);
    try {
      const orientation = screen.orientation as unknown as { unlock?: () => void };
      orientation?.unlock?.();
      if (document.fullscreenElement) {
        await document.exitFullscreen().catch(() => {});
      }
    } catch {
      // Safe no-op
    }
    if (variant === 'fullscreen') {
      onBack();
    }
  }, [onToggleFullscreen, variant, onBack]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onPlayPause(!isPlaying);
        resetControlsTimeout();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleRewind10();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleForward10();
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setIsMuted((m) => !m);
        resetControlsTimeout();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (isFullscreen) {
          handleExitLandscape();
        } else {
          handleEnterLandscape();
        }
      } else if (e.key === 'Escape') {
        if (activePopover !== 'none') {
          setActivePopover('none');
        } else if (isFullscreen) {
          handleExitLandscape();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isPlaying,
    isFullscreen,
    activePopover,
    onPlayPause,
    resetControlsTimeout,
    handleRewind10,
    handleForward10,
    handleEnterLandscape,
    handleExitLandscape,
  ]);

  const handleScrubPointer = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rawPct = ((e.clientX - rect.left) / rect.width) * 100;
    const pct = Math.min(100, Math.max(0, rawPct));
    setHoverScrub({
      percent: pct,
      timeSeconds: Math.round((pct / 100) * totalDuration),
    });
  };

  const handleScrubClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const rawRatio = (e.clientX - rect.left) / rect.width;
    const ratio = Math.min(1, Math.max(0, rawRatio));
    seekToTime(Math.round(ratio * totalDuration));
    resetControlsTimeout();
  };

  const handleSelectVjOption = (option: VjStreamOption) => {
    pendingSeekTimeRef.current = currentTime;
    attemptedModesRef.current = new Set();
    setFallbackOverride(null);
    setSelectedVjOption(option);
    setVideoError(false);
    setIsBuffering(true);
    const label = `Luganda (${option.vjName})`;
    setAudioLang(label);
    onAudioLangChange?.(label);
    onSelectVjStream?.(option);
    setActivePopover('none');
    onPlayPause(true);
    resetControlsTimeout();
  };

  const progressPercent = calculateProgressPercent(currentTime, totalDuration);
  const bufferedPercent =
    activeStreamUrl && !videoError && videoBufferedPercent > 0
      ? Math.max(progressPercent, videoBufferedPercent)
      : computeBufferedPercent(currentTime, totalDuration, 55);
  const rotateLandscape =
    isFullscreen && shouldRotateForLandscape(viewport.width, viewport.height);

  const hasNextEpisode =
    episodes.length > 1 &&
    episode &&
    episodes.findIndex((e) => e.id === episode.id) < episodes.length - 1;

  const titlePrimary = episode
    ? `S${episode.seasonNumber}:E${episode.episodeNumber} · ${episode.title}`
    : movie.title;

  const handleBackAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isFullscreen) {
      handleExitLandscape();
    } else {
      onBack();
    }
  };

  const shellClass = isFullscreen
    ? 'fixed inset-0 z-50 bg-black overflow-hidden select-none'
    : 'relative w-full h-full bg-black overflow-hidden select-none';

  const playerSurfaceClass = rotateLandscape
    ? 'absolute top-0 left-full origin-top-left rotate-90 w-[100dvh] h-[100dvw] flex flex-col justify-between overflow-hidden bg-black select-none'
    : 'relative w-full h-full flex flex-col justify-between overflow-hidden bg-black select-none';

  return (
    <div
      ref={containerRef}
      data-testid="netflix-player"
      data-landscape={isFullscreen ? 'true' : 'false'}
      data-rotated={rotateLandscape ? 'true' : 'false'}
      data-has-video={activeStreamUrl && !videoError ? 'true' : 'false'}
      data-stream-url={activeStreamUrl || undefined}
      className={shellClass}
    >
      <div
        onMouseMove={() => {
          if (isPlaying && !isLocked && activePopover === 'none') {
            resetControlsTimeout();
          }
        }}
        onClick={() => {
          if (activePopover !== 'none') {
            setActivePopover('none');
            return;
          }
          if (showControls && isPlaying && !isLocked) {
            setShowControls(false);
          } else {
            resetControlsTimeout();
          }
        }}
        className={playerSurfaceClass}
      >
        {/* LAYER 0: UNOBSTRUCTED VIDEO SURFACE */}
        <div className="absolute inset-0 z-0 bg-neutral-950 flex items-center justify-center overflow-hidden">
          {effectiveVideoSrc && !videoError ? (
            <video
              ref={videoRef}
              poster={episode?.thumbnail || movie.backdropUrl || movie.posterUrl}
              playsInline
              preload="auto"
              autoPlay={isPlaying}
              className="w-full h-full object-contain bg-black"
              onLoadedMetadata={(e) => {
                const vid = e.currentTarget;
                if (Number.isFinite(vid.duration) && vid.duration > 0) {
                  setVideoDuration(Math.round(vid.duration));
                  const seekTarget = pendingSeekTimeRef.current;
                  if (seekTarget !== null && seekTarget > 0 && seekTarget < vid.duration) {
                    vid.currentTime = seekTarget;
                  }
                  pendingSeekTimeRef.current = null;
                }
                vid.volume = volume;
                vid.muted = isMuted;
                vid.playbackRate = playbackSpeed;
                setIsBuffering(false);
                setVideoError(false);
              }}
              onLoadedData={() => {
                setIsBuffering(false);
                setVideoError(false);
              }}
              onDurationChange={(e) => {
                const vid = e.currentTarget;
                if (Number.isFinite(vid.duration) && vid.duration > 0) {
                  setVideoDuration(Math.round(vid.duration));
                }
              }}
              onTimeUpdate={(e) => {
                const vid = e.currentTarget;
                setCurrentTime(Math.floor(vid.currentTime));
                if (vid.buffered.length > 0 && vid.duration > 0) {
                  const bufferedEnd = vid.buffered.end(vid.buffered.length - 1);
                  setVideoBufferedPercent(
                    Math.min(100, Math.round((bufferedEnd / vid.duration) * 100))
                  );
                }
              }}
              onProgress={(e) => {
                const vid = e.currentTarget;
                if (vid.buffered.length > 0 && vid.duration > 0) {
                  const bufferedEnd = vid.buffered.end(vid.buffered.length - 1);
                  setVideoBufferedPercent(
                    Math.min(100, Math.round((bufferedEnd / vid.duration) * 100))
                  );
                }
              }}
              onWaiting={() => setIsBuffering(true)}
              onCanPlay={() => setIsBuffering(false)}
              onCanPlayThrough={() => setIsBuffering(false)}
              onPlaying={() => {
                setIsBuffering(false);
                setVideoError(false);
              }}
              onEnded={() => onPlayPause(false)}
              onError={() => {
                // Ignore empty-src abort resets during fast episode switching
                if (!videoRef.current?.getAttribute('src')) return;
                attemptedModesRef.current.add(streamMode);
                if (streamMode === 'direct' && !attemptedModesRef.current.has('proxy')) {
                  setFallbackOverride({ trackId: streamTrackId, mode: 'proxy' });
                  setIsBuffering(true);
                  return;
                }
                if (
                  streamMode === 'proxy' &&
                  /^https:\/\//i.test(activeStreamUrl) &&
                  !attemptedModesRef.current.has('direct')
                ) {
                  setFallbackOverride({ trackId: streamTrackId, mode: 'direct' });
                  setIsBuffering(true);
                  return;
                }
                setIsBuffering(false);
                setVideoError(true);
              }}
            />
          ) : (
            <ResilientImage
              src={episode?.thumbnail || movie.backdropUrl || movie.posterUrl}
              alt={movie.title}
              className={`w-full h-full object-cover object-[50%_25%] transition-all duration-700 ${
                isPlaying ? 'brightness-95' : 'brightness-75'
              }`}
              fallbackGradient="from-[#2a0407] via-neutral-950 to-black"
            />
          )}

          {/* Buffering Spinner (Only while buffering) */}
          {isBuffering && activeStreamUrl && !videoError && isPlaying && (
            <div className="absolute inset-0 z-15 flex items-center justify-center pointer-events-none">
              <div className="w-12 h-12 rounded-full bg-black/70 border border-white/15 flex items-center justify-center">
                <Loader2 size={24} className="text-[#E50914] animate-spin" />
              </div>
            </div>
          )}

          {/* Error Pill */}
          {videoError && activeStreamUrl && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/85 border border-white/15 text-xs text-neutral-200 shadow-xl">
              <AlertCircle size={14} className="text-[#E50914] shrink-0" />
              <span>Stream unavailable right now</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  attemptedModesRef.current = new Set();
                  setFallbackOverride(null);
                  setVideoError(false);
                  setIsBuffering(true);
                  onPlayPause(true);
                }}
                className="ml-1 text-[#E50914] font-bold hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          )}

          {/* Double-Tap / Double-Click Seek Zones (Left -10s / Right +10s) */}
          {!isLocked && activePopover === 'none' && (
            <div className="absolute inset-0 z-10 grid grid-cols-2 pointer-events-auto">
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleRewind10();
                }}
                className="h-full"
              />
              <div
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  handleForward10();
                }}
                className="h-full"
              />
            </div>
          )}

          {/* Center Play Button ONLY when Paused (Zero clutter while playing) */}
          {!isPlaying && !isBuffering && !isLocked && activePopover === 'none' && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause(true);
                resetControlsTimeout();
              }}
              aria-label="Resume playback"
              className="absolute z-20 w-15 h-15 sm:w-18 sm:h-18 rounded-full bg-black/70 hover:bg-[#E50914] border-2 border-white/90 flex items-center justify-center text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Play size={26} className="fill-white ml-1" />
            </button>
          )}

          {/* Transient Seek Feedback Ripple */}
          {seekFeedback && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 z-20 px-3.5 py-2 rounded-full bg-black/80 border border-white/20 backdrop-blur-md text-white text-xs font-extrabold flex items-center gap-1.5 shadow-xl pointer-events-none ${
                seekFeedback === 'rewind' ? 'left-6 sm:left-14' : 'right-6 sm:right-14'
              }`}
            >
              {seekFeedback === 'rewind' ? <RotateCcw size={15} /> : <RotateCw size={15} />}
              <span>{seekFeedback === 'rewind' ? '-10s' : '+10s'}</span>
            </div>
          )}
        </div>

        {/* LAYER 1: SUBTLE EDGE GRADIENTS */}
        <div
          className={`absolute inset-0 z-10 pointer-events-none transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/85 via-black/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/95 via-black/75 to-transparent" />
        </div>

        {/* LOCKED OVERLAY PILL */}
        {isLocked && showControls && (
          <div className="relative z-30 flex-1 flex items-end justify-center pb-6 pointer-events-none">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsLocked(false);
                resetControlsTimeout();
              }}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 rounded-full bg-black/85 hover:bg-black border border-white/25 text-white text-xs font-bold shadow-2xl cursor-pointer"
            >
              <Lock size={14} className="text-[#E50914]" />
              <span>Controls Locked · Tap to Unlock</span>
            </button>
          </div>
        )}

        {/* LAYER 2: CLEAN STANDARD PLAYER CHROME (TOP + SINGLE BOTTOM DECK) */}
        {!isLocked && (
          <div
            className={`relative z-30 flex-1 flex flex-col justify-between pointer-events-none transition-opacity duration-300 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* TOP BAR */}
            <div
              onMouseEnter={() => {
                isHoveringControlsRef.current = true;
                resetControlsTimeout();
              }}
              onMouseLeave={() => {
                isHoveringControlsRef.current = false;
                resetControlsTimeout();
              }}
              className="flex items-center justify-between gap-3 px-3.5 sm:px-5 pt-3 sm:pt-4 pointer-events-auto"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={handleBackAction}
                  className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white active:scale-95 transition-all shrink-0 cursor-pointer"
                  aria-label={isFullscreen ? 'Exit landscape player' : 'Back to title banner'}
                  title={isFullscreen ? 'Exit Landscape' : 'Back'}
                >
                  <ArrowLeft size={18} />
                </button>

                <div className="flex items-center gap-2 min-w-0">
                  <div className="hidden sm:flex shrink-0">
                    <NetflixNLogo size={13} />
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs sm:text-sm md:text-base font-bold text-white truncate drop-shadow">
                      {titlePrimary}
                    </span>
                    <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-white/12 border border-white/15 text-[10px] font-semibold text-neutral-200 shrink-0">
                      <Mic size={10} className="text-emerald-400" />
                      {activeVjName}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isFullscreen && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsLocked(true);
                    }}
                    className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer"
                    aria-label="Lock player controls"
                    title="Lock Screen"
                  >
                    <Unlock size={16} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCastClick();
                  }}
                  className="w-9 h-9 rounded-full bg-black/60 hover:bg-black/85 border border-white/15 flex items-center justify-center text-white transition-all cursor-pointer"
                  aria-label="Cast to TV"
                  title="Cast to TV"
                >
                  <Cast size={16} />
                </button>
              </div>
            </div>

            {/* SINGLE UNIFIED BOTTOM CONTROL BAR */}
            <div
              className="px-3.5 sm:px-5 pb-3 sm:pb-4 pt-4 pointer-events-auto flex flex-col gap-1.5"
              onClick={(e) => e.stopPropagation()}
              onMouseEnter={() => {
                isHoveringControlsRef.current = true;
                resetControlsTimeout();
              }}
              onMouseLeave={() => {
                isHoveringControlsRef.current = false;
                resetControlsTimeout();
              }}
            >
              {/* ROW 1: FULL-WIDTH TIMELINE SCRUBBER */}
              <div
                role="slider"
                tabIndex={0}
                aria-label="Seek timeline"
                aria-valuemin={0}
                aria-valuemax={totalDuration}
                aria-valuenow={Math.round(currentTime)}
                onMouseMove={handleScrubPointer}
                onMouseLeave={() => setHoverScrub(null)}
                onClick={handleScrubClick}
                className="group relative w-full h-4 flex items-center cursor-pointer"
              >
                {hoverScrub && (
                  <div
                    className="flex flex-col items-center absolute bottom-5 -translate-x-1/2 pointer-events-none z-30"
                    style={{
                      left: `${Math.min(93, Math.max(7, hoverScrub.percent))}%`,
                    }}
                  >
                    {isFullscreen && (
                      <div className="hidden md:block w-28 h-16 rounded-md overflow-hidden border border-white/75 bg-neutral-900 shadow-2xl mb-1">
                        <ResilientImage
                          src={episode?.thumbnail || movie.backdropUrl || movie.posterUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <span className="px-2 py-0.5 rounded bg-black/90 border border-white/15 text-[10px] font-mono font-bold text-white tabular-nums shadow">
                      {formatTime(hoverScrub.timeSeconds)}
                    </span>
                  </div>
                )}

                <div className="relative w-full h-1 group-hover:h-2 bg-white/25 rounded-full overflow-hidden transition-all">
                  <div
                    className="absolute inset-y-0 left-0 bg-white/40 rounded-full transition-all duration-300"
                    style={{ width: `${bufferedPercent}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 bg-[#E50914] rounded-full transition-all duration-100"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#E50914] ring-2 ring-white shadow opacity-90 group-hover:scale-125 transition-transform pointer-events-none"
                  style={{ left: `${progressPercent}%` }}
                />
              </div>

              {/* ROW 2: STANDARD NON-OVERLAPPING MEDIA BAR */}
              <div className="flex items-center justify-between gap-2 text-xs text-neutral-200 min-w-0">
                {/* Left Transport & Volume Cluster */}
                <div className="flex items-center gap-0.5 sm:gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      onPlayPause(!isPlaying);
                      resetControlsTimeout();
                    }}
                    className="w-8 h-8 rounded-md hover:bg-white/12 flex items-center justify-center text-white transition-colors cursor-pointer shrink-0"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                    title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
                  >
                    {isPlaying ? (
                      <Pause size={18} className="fill-white" />
                    ) : (
                      <Play size={18} className="fill-white" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRewind10}
                    className="w-8 h-8 rounded-md hover:bg-white/12 flex items-center justify-center text-neutral-200 hover:text-white transition-colors cursor-pointer shrink-0"
                    aria-label="Rewind 10 seconds"
                    title="Rewind 10s"
                  >
                    <RotateCcw size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={handleForward10}
                    className="w-8 h-8 rounded-md hover:bg-white/12 flex items-center justify-center text-neutral-200 hover:text-white transition-colors cursor-pointer shrink-0"
                    aria-label="Forward 10 seconds"
                    title="Forward 10s"
                  >
                    <RotateCw size={16} />
                  </button>

                  <div className="flex items-center gap-1 ml-0.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMuted((prev) => !prev);
                        resetControlsTimeout();
                      }}
                      className="w-8 h-8 rounded-md hover:bg-white/12 flex items-center justify-center text-neutral-200 hover:text-white transition-colors cursor-pointer"
                      aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                      title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX size={17} className="text-neutral-400" />
                      ) : volume < 0.5 ? (
                        <Volume1 size={17} />
                      ) : (
                        <Volume2 size={17} />
                      )}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isMuted ? 0 : volume}
                      onChange={(e) => {
                        const nextVol = clampVolume(Number(e.target.value));
                        setVolume(nextVol);
                        if (nextVol > 0 && isMuted) setIsMuted(false);
                        resetControlsTimeout();
                      }}
                      aria-label="Volume"
                      className="hidden md:block w-16 lg:w-20 h-1 accent-[#E50914] bg-white/30 rounded-full cursor-pointer"
                    />
                  </div>

                  <div className="ml-1.5 text-[11px] font-mono font-medium text-neutral-200 tabular-nums whitespace-nowrap truncate">
                    <span>{formatTime(currentTime)}</span>
                    <span className="text-neutral-500 mx-1">/</span>
                    <span className="text-neutral-400">{formatTime(totalDuration)}</span>
                  </div>
                </div>

                {/* Right Utility Cluster */}
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  {(hasNextEpisode || onNextEpisode) && (
                    <button
                      type="button"
                      onClick={() => {
                        abortCurrentVideoLoad();
                        if (episodes.length > 1 && episode && onSelectEpisode) {
                          const idx = episodes.findIndex((e) => e.id === episode.id);
                          if (idx >= 0 && idx + 1 < episodes.length) {
                            onSelectEpisode(episodes[idx + 1]);
                          } else if (onNextEpisode) {
                            onNextEpisode();
                          }
                        } else if (onNextEpisode) {
                          onNextEpisode();
                        }
                        onPlayPause(true);
                        resetControlsTimeout();
                      }}
                      className="flex items-center gap-1 h-8 px-2 rounded-md hover:bg-white/15 text-neutral-100 font-semibold text-[11px] transition-colors cursor-pointer"
                      title="Next Episode"
                    >
                      <SkipForward size={15} />
                      <span className="hidden lg:inline">Next Ep</span>
                    </button>
                  )}

                  {episodes.length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActivePopover(activePopover === 'episodes' ? 'none' : 'episodes')
                      }
                      className={`flex items-center gap-1 h-8 px-2 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                        activePopover === 'episodes'
                          ? 'bg-white/20 text-white'
                          : 'hover:bg-white/12 text-neutral-200 hover:text-white'
                      }`}
                      aria-label="Episodes"
                      title="Episodes"
                    >
                      <Layers size={15} />
                      <span className="hidden lg:inline">Episodes</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActivePopover(activePopover === 'speed' ? 'none' : 'speed')}
                    className={`flex items-center gap-1 h-8 px-2 rounded-md text-[11px] font-bold transition-colors cursor-pointer ${
                      activePopover === 'speed'
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/12 text-neutral-200 hover:text-white'
                    }`}
                    aria-label="Playback speed"
                    title="Playback Speed"
                  >
                    <Gauge size={14} className="sm:hidden" />
                    <span>{playbackSpeed}x</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActivePopover(activePopover === 'audio' ? 'none' : 'audio')}
                    className={`flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      activePopover === 'audio'
                        ? 'bg-white/20 text-white'
                        : 'hover:bg-white/12 text-neutral-200 hover:text-white'
                    }`}
                    aria-label="Audio and Subtitles"
                    title="VJ Audio & Subtitles"
                  >
                    <Subtitles size={15} />
                    <span className="hidden sm:inline max-w-[105px] truncate">
                      {vjStreamOptions.length > 1 ? activeVjName : 'Audio'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isFullscreen) {
                        handleExitLandscape();
                      } else {
                        handleEnterLandscape();
                      }
                    }}
                    data-testid="toggle-landscape-btn"
                    className="flex items-center gap-1 h-8 px-2 sm:px-2.5 rounded-md bg-white/12 hover:bg-[#E50914] text-white font-semibold text-[11px] transition-colors cursor-pointer"
                    aria-label={isFullscreen ? 'Exit Landscape Fullscreen' : 'Enter Landscape Fullscreen'}
                    title={isFullscreen ? 'Return to Banner (F)' : 'Watch in Landscape (F)'}
                  >
                    {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
                    <span className="hidden sm:inline">
                      {isFullscreen ? 'Banner' : 'Landscape'}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANCHORED POPOVER 1: VJ STREAMS & SUBTITLES (Does not block video) */}
        {activePopover === 'audio' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-20 right-3 sm:right-5 z-40 w-72 sm:w-80 max-h-[calc(100%-9.5rem)] overflow-y-auto bg-neutral-950/95 border border-white/15 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <h3 className="font-bold text-white text-xs sm:text-sm">VJ Audio &amp; Subtitles</h3>
              <button
                type="button"
                onClick={() => setActivePopover('none')}
                className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Close Audio & Subtitles"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <span className="font-bold text-neutral-400 uppercase text-[10px] tracking-wider block mb-1.5">
                  VJ / VOD Stream ({vjStreamOptions.length > 0 ? vjStreamOptions.length : 1})
                </span>
                <div className="flex flex-col gap-1">
                  {vjStreamOptions.map((opt) => {
                    const isSelected =
                      activeVjName.toLowerCase() === opt.vjName.toLowerCase() &&
                      activeStreamUrl === opt.videoUrl;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectVjOption(opt)}
                        className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#E50914]/20 text-white border border-[#E50914]/50'
                            : 'hover:bg-white/10 text-neutral-200'
                        }`}
                      >
                        <span className="flex items-center gap-2 font-medium truncate">
                          <Mic size={12} className={isSelected ? 'text-[#E50914]' : 'text-emerald-400'} />
                          <span className="truncate">Luganda ({opt.vjName})</span>
                        </span>
                        {isSelected && <Check size={14} className="text-[#E50914] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-white/10 pt-2.5">
                <span className="font-bold text-neutral-400 uppercase text-[10px] tracking-wider block mb-1.5">
                  Subtitles
                </span>
                <div className="grid grid-cols-2 gap-1">
                  {SUBTITLE_TRACKS.map((sub) => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setSubtitles(sub)}
                      className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-left transition-colors cursor-pointer ${
                        subtitles === sub
                          ? 'bg-white/15 text-white font-semibold'
                          : 'hover:bg-white/10 text-neutral-300'
                      }`}
                    >
                      <span className="truncate">{sub}</span>
                      {subtitles === sub && <Check size={13} className="text-[#E50914] shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ANCHORED POPOVER 2: PLAYBACK SPEED */}
        {activePopover === 'speed' && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-20 right-3 sm:right-5 z-40 w-48 max-h-[calc(100%-9.5rem)] overflow-y-auto bg-neutral-950/95 border border-white/15 rounded-xl p-2.5 shadow-2xl backdrop-blur-md"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-1.5 mb-1.5 px-1">
              <h3 className="text-xs font-bold text-white">Playback Speed</h3>
              <button
                type="button"
                onClick={() => setActivePopover('none')}
                className="text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Close Playback Speed"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex flex-col gap-1">
              {SPEED_OPTIONS.map((spd) => (
                <button
                  key={spd}
                  type="button"
                  onClick={() => {
                    setPlaybackSpeed(spd);
                    setActivePopover('none');
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    playbackSpeed === spd
                      ? 'bg-[#E50914] text-white'
                      : 'hover:bg-white/10 text-neutral-300 hover:text-white'
                  }`}
                >
                  <span>
                    {spd}x {spd === 1 ? '(Normal)' : ''}
                  </span>
                  {playbackSpeed === spd && <Check size={13} />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ANCHORED POPOVER 3: EPISODES LIST */}
        {activePopover === 'episodes' && episodes.length > 0 && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute bottom-20 right-3 sm:right-5 z-40 w-72 sm:w-80 max-h-[calc(100%-9.5rem)] overflow-y-auto bg-neutral-950/95 border border-white/15 rounded-xl p-3 shadow-2xl backdrop-blur-md flex flex-col gap-2"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <h3 className="font-bold text-white text-xs sm:text-sm">Episodes ({episodes.length})</h3>
              <button
                type="button"
                onClick={() => setActivePopover('none')}
                className="w-6 h-6 rounded-full hover:bg-white/15 flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer"
                aria-label="Close Episodes"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {episodes.map((ep) => {
                const isSelected = episode?.id === ep.id;
                return (
                  <button
                    key={ep.id}
                    type="button"
                    onClick={() => {
                      abortCurrentVideoLoad();
                      onSelectEpisode?.(ep);
                      setActivePopover('none');
                      onPlayPause(true);
                      resetControlsTimeout();
                    }}
                    className={`flex items-center gap-2.5 p-2 rounded-lg text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#E50914]/20 border border-[#E50914]/50'
                        : 'hover:bg-white/10 border border-transparent'
                    }`}
                  >
                    <div className="w-20 h-12 rounded-md overflow-hidden bg-neutral-800 shrink-0">
                      <ResilientImage
                        src={ep.thumbnail}
                        alt={ep.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white line-clamp-1">
                        {ep.episodeNumber}. {ep.title}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">{ep.duration}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
