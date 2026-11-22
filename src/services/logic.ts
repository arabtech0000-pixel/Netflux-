import { Movie, Episode, WatchProgress, DownloadItem, NotificationItem, Profile, AppSettings } from '../types';

/**
 * Filter movies matching query against title, genres, tags, cast, or director
 */
export const searchMovies = (movies: Movie[], query: string): Movie[] => {
  const clean = query.trim().toLowerCase();
  if (!clean) return [];

  return movies.filter((movie) => {
    const titleMatch = movie.title.toLowerCase().includes(clean);
    const genreMatch = movie.genres.some((g) => g.toLowerCase().includes(clean));
    const castMatch = movie.cast.some((c) => c.toLowerCase().includes(clean));
    const directorMatch = movie.director?.toLowerCase().includes(clean) ?? false;
    const tagMatch = movie.tags?.some((t) => t.toLowerCase().includes(clean)) ?? false;
    const vjMatch = movie.vjName?.toLowerCase().includes(clean) ?? false;
    return titleMatch || genreMatch || castMatch || directorMatch || tagMatch || vjMatch;
  });
};

/**
 * Filter movies by category/genre
 */
export const filterMoviesByGenre = (movies: Movie[], genre: string): Movie[] => {
  const clean = genre.trim().toLowerCase();
  if (!clean || clean === 'all') return movies;
  return movies.filter((m) => m.genres.some((g) => g.toLowerCase() === clean));
};

/**
 * Filter movies by type (movie or series)
 */
export const filterMoviesByType = (movies: Movie[], type: 'all' | 'movie' | 'series'): Movie[] => {
  if (type === 'all') return movies;
  return movies.filter((m) => m.type === type);
};

/**
 * Toggle a movie ID in the user's My List
 */
export const toggleMyList = (currentList: string[], movieId: string): string[] => {
  if (currentList.includes(movieId)) {
    return currentList.filter((id) => id !== movieId);
  }
  return [...currentList, movieId];
};

/**
 * Record or update watch progress for a movie or episode
 */
export const recordWatchProgress = (
  list: WatchProgress[],
  progress: WatchProgress
): WatchProgress[] => {
  const existingIndex = list.findIndex((p) => p.movieId === progress.movieId);
  if (existingIndex >= 0) {
    const updated = [...list];
    updated[existingIndex] = {
      ...updated[existingIndex],
      ...progress,
      lastWatchedAt: Date.now(),
    };
    return updated;
  }
  return [progress, ...list];
};

/**
 * Calculate completion percentage bounded [0, 100]
 */
export const calculateProgressPercent = (currentTime: number, duration: number): number => {
  if (!duration || duration <= 0) return 0;
  const ratio = (currentTime / duration) * 100;
  return Math.min(100, Math.max(0, Math.round(ratio)));
};

/**
 * Format seconds to MM:SS or HH:MM:SS
 */
export const formatTime = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
};

/**
 * Advance download progress simulation
 */
export const advanceDownload = (item: DownloadItem, step = 25): DownloadItem => {
  const newProgress = Math.min(100, item.progress + step);
  return {
    ...item,
    progress: newProgress,
    status: newProgress >= 100 ? 'completed' : 'downloading',
  };
};

/**
 * Validate whether an input string is a valid email address or mobile/phone number
 */
export const validateEmailOrPhone = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;

  // Check valid email format
  if (trimmed.includes('@')) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
  }

  // Check valid phone/mobile number format (7-15 digits, optional leading +, spaces/dashes/parens)
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15;
};

/**
 * Validate the 3-field registration form (Email/Phone Number, Password, Confirm Password)
 * Returns an error message string if invalid, or null if valid.
 */
export const validateRegistrationForm = (params: {
  identifier: string;
  password: string;
  confirmPassword: string;
}): string | null => {
  if (!validateEmailOrPhone(params.identifier)) {
    return 'Please enter a valid email address or mobile number.';
  }
  if (!params.password || params.password.length < 6) {
    return 'Password must be at least 6 characters long.';
  }
  if (params.password !== params.confirmPassword) {
    return 'Passwords do not match. Please verify.';
  }
  return null;
};

/**
 * Merge TMDB API details into an existing Movie while preserving local IDs and badges
 */
export const mergeTmdbMovieDetails = (baseMovie: Movie, tmdbData: Partial<Movie>): Movie => {
  const incomingEpisodes =
    tmdbData.episodes && tmdbData.episodes.length > 0 ? tmdbData.episodes : baseMovie.episodes;

  const mergedEpisodes = incomingEpisodes?.map((ep) => {
    if (ep.videoUrl) return ep;
    const baseMatch = baseMovie.episodes?.find(
      (b) => b.episodeNumber === ep.episodeNumber && b.seasonNumber === ep.seasonNumber
    );
    return baseMatch?.videoUrl
      ? { ...ep, videoUrl: baseMatch.videoUrl, vjName: baseMatch.vjName ?? ep.vjName }
      : ep;
  });

  return {
    ...baseMovie,
    tmdbId: tmdbData.tmdbId ?? baseMovie.tmdbId,
    title: tmdbData.title || baseMovie.title,
    type: tmdbData.type ?? baseMovie.type,
    year: tmdbData.year || baseMovie.year,
    ageRating: tmdbData.ageRating || baseMovie.ageRating,
    durationOrSeasons: tmdbData.durationOrSeasons || baseMovie.durationOrSeasons,
    seasonsCount: tmdbData.seasonsCount ?? baseMovie.seasonsCount,
    genres: tmdbData.genres && tmdbData.genres.length > 0 ? tmdbData.genres : baseMovie.genres,
    synopsis: tmdbData.synopsis || baseMovie.synopsis,
    tagline: tmdbData.tagline ?? baseMovie.tagline,
    matchScore: tmdbData.matchScore ?? baseMovie.matchScore,
    posterUrl: tmdbData.posterUrl || baseMovie.posterUrl,
    backdropUrl: tmdbData.backdropUrl || baseMovie.backdropUrl,
    cast: tmdbData.cast && tmdbData.cast.length > 0 ? tmdbData.cast : baseMovie.cast,
    director: tmdbData.director || baseMovie.director,
    trailerKey: tmdbData.trailerKey ?? baseMovie.trailerKey,
    trailerUrl: tmdbData.trailerUrl ?? baseMovie.trailerUrl,
    releaseDate: tmdbData.releaseDate ?? baseMovie.releaseDate,
    videoUrl: tmdbData.videoUrl || baseMovie.videoUrl,
    vjName: tmdbData.vjName || baseMovie.vjName,
    munoId: tmdbData.munoId ?? baseMovie.munoId,
    seriesCode: tmdbData.seriesCode || baseMovie.seriesCode,
    vjStreams:
      tmdbData.vjStreams && tmdbData.vjStreams.length > 0
        ? tmdbData.vjStreams
        : baseMovie.vjStreams,
    episodes: mergedEpisodes,
    similarMovies:
      tmdbData.similarMovies && tmdbData.similarMovies.length > 0
        ? tmdbData.similarMovies
        : baseMovie.similarMovies,
  };
};

/**
 * Convert an email or mobile/phone number into an email string compatible with Firebase Auth
 */
export const toFirebaseAuthEmail = (identifier: string): string => {
  const trimmed = identifier.trim();
  if (trimmed.includes('@')) {
    return trimmed.toLowerCase();
  }
  const digits = trimmed.replace(/\D/g, '');
  return `${digits}@phone.munomoviess.app`;
};

/**
 * Map Firebase Auth error codes to clean, user-friendly messages
 */
export const mapFirebaseAuthError = (
  errorCode?: string,
  fallbackMessage?: string,
  currentHostname?: string
): string => {
  switch (errorCode) {
    case 'auth/email-already-in-use':
      return 'An account already exists with this email or mobile number.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address or mobile number.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Incorrect email/phone number or password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in popup was closed or interrupted before completing.';
    case 'auth/cancelled-popup-request':
      return 'Previous Google sign-in attempt was cancelled. Please try again.';
    case 'auth/popup-blocked':
      return 'Google sign-in popup was blocked by your browser.';
    case 'auth/web-storage-unsupported':
    case 'auth/operation-not-supported-in-this-environment':
      return 'Embedded browser storage is restricted here. Try opening in a browser tab or full-page sign-in.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using password sign-in. Please sign in with your password.';
    case 'auth/internal-error':
      return 'Google sign-in encountered a browser popup or storage restriction.';
    case 'auth/unauthorized-domain':
      return currentHostname
        ? `Domain "${currentHostname}" is not authorized in Firebase Authentication > Settings > Authorized domains.`
        : 'This domain is not authorized in Firebase Authentication settings.';
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication > Sign-in method yet.';
    case 'auth/network-request-failed':
      return 'Network error. Please check your internet connection.';
    default:
      return fallbackMessage || 'Authentication failed. Please try again.';
  }
};

export const shouldFallbackToGoogleRedirect = (params: {
  errorCode?: string;
  isInIframe: boolean;
}): boolean => {
  if (params.isInIframe) return false;
  return (
    params.errorCode === 'auth/popup-blocked' ||
    params.errorCode === 'auth/operation-not-supported-in-this-environment' ||
    params.errorCode === 'auth/web-storage-unsupported'
  );
};

export const canOfferGoogleTabOrRedirectFallback = (errorCode?: string): boolean => {
  return (
    errorCode === 'auth/popup-blocked' ||
    errorCode === 'auth/popup-closed-by-user' ||
    errorCode === 'auth/cancelled-popup-request' ||
    errorCode === 'auth/web-storage-unsupported' ||
    errorCode === 'auth/operation-not-supported-in-this-environment' ||
    errorCode === 'auth/internal-error'
  );
};

/**
 * Recursively strip undefined properties because Firebase Realtime Database rejects undefined values
 */
export const sanitizeUserDataForRtdb = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUserDataForRtdb(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (val !== undefined) {
        clean[key] = sanitizeUserDataForRtdb(val);
      }
    }
    return clean as T;
  }
  return value;
};

export type PuzzleEdgePolarity = -1 | 0 | 1;

export interface PuzzlePieceSpec {
  row: number;
  col: number;
  top: PuzzleEdgePolarity;
  right: PuzzleEdgePolarity;
  bottom: PuzzleEdgePolarity;
  left: PuzzleEdgePolarity;
}

/**
 * Generate a deterministic grid of interlocking jigsaw puzzle pieces.
 * Inner shared edges always have opposite polarities (tab +1 meets blank -1).
 */
export const generateJigsawGridSpecs = (rows: number, cols: number): PuzzlePieceSpec[] => {
  const pieces: PuzzlePieceSpec[] = [];
  const hEdges: PuzzleEdgePolarity[][] = [];
  const vEdges: PuzzleEdgePolarity[][] = [];

  for (let r = 0; r < rows - 1; r++) {
    const rowEdges: PuzzleEdgePolarity[] = [];
    for (let c = 0; c < cols; c++) {
      rowEdges.push((r + c) % 2 === 0 ? 1 : -1);
    }
    hEdges.push(rowEdges);
  }

  for (let r = 0; r < rows; r++) {
    const rowEdges: PuzzleEdgePolarity[] = [];
    for (let c = 0; c < cols - 1; c++) {
      rowEdges.push((r + c) % 2 === 0 ? -1 : 1);
    }
    vEdges.push(rowEdges);
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const top: PuzzleEdgePolarity = r === 0 ? 0 : (-hEdges[r - 1][c] as PuzzleEdgePolarity);
      const bottom: PuzzleEdgePolarity = r === rows - 1 ? 0 : hEdges[r][c];
      const left: PuzzleEdgePolarity = c === 0 ? 0 : (-vEdges[r][c - 1] as PuzzleEdgePolarity);
      const right: PuzzleEdgePolarity = c === cols - 1 ? 0 : vEdges[r][c];

      pieces.push({ row: r, col: c, top, right, bottom, left });
    }
  }

  return pieces;
};

/**
 * Build a closed SVG path string for a jigsaw puzzle piece of dimensions (width x height)
 * with interlocking tabs (+1), blanks (-1), or flat borders (0).
 */
export const buildJigsawPiecePath = (
  width: number,
  height: number,
  edges: Pick<PuzzlePieceSpec, 'top' | 'right' | 'bottom' | 'left'>,
  tabDepth = 18
): string => {
  const cmds: string[] = ['M 0 0'];

  // Top edge: (0,0) -> (width, 0), outward normal is -Y
  if (edges.top === 0) {
    cmds.push(`L ${width} 0`);
  } else {
    const dy = -edges.top * tabDepth;
    cmds.push(
      `L ${(width * 0.36).toFixed(2)} 0`,
      `C ${(width * 0.42).toFixed(2)} 0, ${(width * 0.37).toFixed(2)} ${(dy * 0.35).toFixed(2)}, ${(width * 0.39).toFixed(2)} ${(dy * 0.65).toFixed(2)}`,
      `C ${(width * 0.42).toFixed(2)} ${(dy * 1.05).toFixed(2)}, ${(width * 0.58).toFixed(2)} ${(dy * 1.05).toFixed(2)}, ${(width * 0.61).toFixed(2)} ${(dy * 0.65).toFixed(2)}`,
      `C ${(width * 0.63).toFixed(2)} ${(dy * 0.35).toFixed(2)}, ${(width * 0.58).toFixed(2)} 0, ${(width * 0.64).toFixed(2)} 0`,
      `L ${width} 0`
    );
  }

  // Right edge: (width, 0) -> (width, height), outward normal is +X
  if (edges.right === 0) {
    cmds.push(`L ${width} ${height}`);
  } else {
    const dx = edges.right * tabDepth;
    cmds.push(
      `L ${width} ${(height * 0.36).toFixed(2)}`,
      `C ${width} ${(height * 0.42).toFixed(2)}, ${(width + dx * 0.35).toFixed(2)} ${(height * 0.37).toFixed(2)}, ${(width + dx * 0.65).toFixed(2)} ${(height * 0.39).toFixed(2)}`,
      `C ${(width + dx * 1.05).toFixed(2)} ${(height * 0.42).toFixed(2)}, ${(width + dx * 1.05).toFixed(2)} ${(height * 0.58).toFixed(2)}, ${(width + dx * 0.65).toFixed(2)} ${(height * 0.61).toFixed(2)}`,
      `C ${(width + dx * 0.35).toFixed(2)} ${(height * 0.63).toFixed(2)}, ${width} ${(height * 0.58).toFixed(2)}, ${width} ${(height * 0.64).toFixed(2)}`,
      `L ${width} ${height}`
    );
  }

  // Bottom edge: (width, height) -> (0, height), outward normal is +Y
  if (edges.bottom === 0) {
    cmds.push(`L 0 ${height}`);
  } else {
    const dy = edges.bottom * tabDepth;
    cmds.push(
      `L ${(width * 0.64).toFixed(2)} ${height}`,
      `C ${(width * 0.58).toFixed(2)} ${height}, ${(width * 0.63).toFixed(2)} ${(height + dy * 0.35).toFixed(2)}, ${(width * 0.61).toFixed(2)} ${(height + dy * 0.65).toFixed(2)}`,
      `C ${(width * 0.58).toFixed(2)} ${(height + dy * 1.05).toFixed(2)}, ${(width * 0.42).toFixed(2)} ${(height + dy * 1.05).toFixed(2)}, ${(width * 0.39).toFixed(2)} ${(height + dy * 0.65).toFixed(2)}`,
      `C ${(width * 0.37).toFixed(2)} ${(height + dy * 0.35).toFixed(2)}, ${(width * 0.42).toFixed(2)} ${height}, ${(width * 0.36).toFixed(2)} ${height}`,
      `L 0 ${height}`
    );
  }

  // Left edge: (0, height) -> (0, 0), outward normal is -X
  if (edges.left === 0) {
    cmds.push('L 0 0');
  } else {
    const dx = -edges.left * tabDepth;
    cmds.push(
      `L 0 ${(height * 0.64).toFixed(2)}`,
      `C 0 ${(height * 0.58).toFixed(2)}, ${(dx * 0.35).toFixed(2)} ${(height * 0.63).toFixed(2)}, ${(dx * 0.65).toFixed(2)} ${(height * 0.61).toFixed(2)}`,
      `C ${(dx * 1.05).toFixed(2)} ${(height * 0.58).toFixed(2)}, ${(dx * 1.05).toFixed(2)} ${(height * 0.42).toFixed(2)}, ${(dx * 0.65).toFixed(2)} ${(height * 0.39).toFixed(2)}`,
      `C ${(dx * 0.35).toFixed(2)} ${(height * 0.37).toFixed(2)}, 0 ${(height * 0.42).toFixed(2)}, 0 ${(height * 0.36).toFixed(2)}`,
      'L 0 0'
    );
  }

  cmds.push('Z');
  return cmds.join(' ');
};

export interface StoredSessionInfo {
  identifier: string;
  uid?: string;
  displayName?: string;
  onboardingComplete?: boolean;
  signedInAt: number;
}

/**
 * Decide which screen to show after splash based on whether the user already has an account session on this device.
 */
export const resolvePostSplashScreen = (params: {
  hasAuthUser: boolean;
  storedSession: StoredSessionInfo | null;
}): 'welcome' | 'profile-select' | 'home' => {
  if (!params.hasAuthUser && !params.storedSession) {
    return 'welcome';
  }
  if (params.hasAuthUser || params.storedSession?.onboardingComplete) {
    return 'home';
  }
  return 'profile-select';
};

export const ADMIN_WHATSAPP_NUMBER = '256755048870';
export const ADMIN_WHATSAPP_DISPLAY = '+256 755 048870';
export const WHATSAPP_GROUP_URL =
  'https://chat.whatsapp.com/EfjzgGyIIBJ1i017P0VlAB?s=cl&p=a&iam=2';

export const DEFAULT_DISCLAIMER_CONFIG = {
  disclaimerEnabled: true,
  disclaimerTitle: 'Join Our WhatsApp Group',
  disclaimerBadge: 'Instant Updates',
  disclaimerMessage:
    'Join our WhatsApp group for instant updates on newly translated Luganda movies, trending series, fresh VJ releases, and direct community support.',
  whatsappButtonLabel: 'Join our platform',
  whatsappGroupUrl: WHATSAPP_GROUP_URL,
  whatsappPrefillMessage: 'Hello Admin, I just joined via the platform WhatsApp link!',
};

/**
 * Validate a configured WhatsApp group URL and return a safe https:// link.
 */
export const resolveWhatsappGroupUrl = (rawUrl?: string | null): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return WHATSAPP_GROUP_URL;
  const trimmed = rawUrl.trim();
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
  } catch {
    // Fallback to verified default group link
  }
  return WHATSAPP_GROUP_URL;
};

/**
 * Build a direct WhatsApp wa.me link to the Netflux admin help line.
 */
export const buildAdminWhatsAppUrl = (
  customMessage = 'Hello Netflux Admin, I need help.'
): string => {
  const cleanMsg = customMessage.trim() || 'Hello Netflux Admin, I need help.';
  return `https://wa.me/${ADMIN_WHATSAPP_NUMBER}?text=${encodeURIComponent(cleanMsg)}`;
};

/**
 * Compute simulated buffered percentage [0, 100] always >= played percentage when duration > 0.
 */
export const computeBufferedPercent = (
  currentTime: number,
  duration: number,
  leadSeconds = 45
): number => {
  if (!duration || duration <= 0) return 0;
  const clampedCurrent = Math.max(0, Math.min(duration, currentTime));
  const bufferedTime = Math.min(duration, clampedCurrent + Math.max(0, leadSeconds));
  return Math.min(100, Math.max(0, Math.round((bufferedTime / duration) * 100)));
};

/**
 * Clamp player volume cleanly between 0 and 1.
 */
export const clampVolume = (volume: number): number => {
  if (Number.isNaN(volume)) return 1;
  return Math.min(1, Math.max(0, Number(volume.toFixed(2))));
};

/**
 * Cycle cleanly through supported Netflix player playback speeds.
 */
export const getNextPlaybackSpeed = (
  current: number,
  speeds: number[] = [0.5, 0.75, 1, 1.25, 1.5]
): number => {
  const idx = speeds.indexOf(current);
  if (idx === -1) return 1;
  return speeds[(idx + 1) % speeds.length];
};

/**
 * Decide whether CSS 90-degree landscape rotation should be applied on a portrait viewport.
 */
export const shouldRotateForLandscape = (
  viewportWidth: number,
  viewportHeight: number
): boolean => {
  if (viewportWidth <= 0 || viewportHeight <= 0) return false;
  return viewportWidth < viewportHeight;
};

const MUNO_HTTPS_CDN_HOSTS = ['b-cdn.net', 'r2.dev', 'pearlpix', 'munotech', 'munotek'];

/**
 * Sanitize MunoWatch stream URLs:
 * - Upgrades insecure http:// links on known CDNs to https://
 * - Encodes unescaped whitespace into %20
 * - Rejects dummy/corrupt URLs (e.g. "..mp4", "..m3u8", or non-HTTP links)
 */
export const sanitizeMunoStreamUrl = (rawUrl?: string | null): string | null => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  if (/\.\.(mp4|m3u8|mkv|webm)(\?|$)/i.test(trimmed)) return null;

  let normalized = trimmed;
  if (/^http:\/\//i.test(normalized)) {
    const lower = normalized.toLowerCase();
    if (MUNO_HTTPS_CDN_HOSTS.some((host) => lower.includes(host))) {
      normalized = `https://${normalized.slice(7)}`;
    }
  }

  return normalized.replace(/ /g, '%20');
};

/**
 * Standardize a VJ translator label (e.g. "Vj junior" -> "VJ Junior").
 */
export const normalizeVjName = (rawVj?: string | null): string => {
  if (!rawVj || typeof rawVj !== 'string') return 'Luganda Dubbed';
  const cleaned = rawVj.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'Luganda Dubbed';
  if (/^luganda\s+dubbed$/i.test(cleaned)) return 'Luganda Dubbed';

  const normalized = cleaned
    .split(' ')
    .map((part) => {
      if (/^vj$/i.test(part)) return 'VJ';
      if (/^[a-z]/i.test(part)) {
        return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
      }
      return part;
    })
    .join(' ');

  return normalized;
};

/**
 * Build a deterministic, collision-free Movie ID for a dual-verified TMDB + VJ/VOD entry.
 * Keeps entries for different VJs distinct even when they share the same TMDB banner.
 */
export const buildDualVerifiedItemId = (
  mediaType: 'movie' | 'series',
  tmdbId: number,
  vjName?: string | null
): string => {
  const normalizedVj = normalizeVjName(vjName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = normalizedVj || 'dubbed';
  return `tmdb-${mediaType}-${tmdbId}-${suffix}`;
};

export interface MunoTitleClue {
  cleanTitle: string;
  vjName: string;
  isSeriesHint: boolean;
  seasonNumber?: number;
}

/**
 * Extract clean TMDB search title clue and VJ metadata from raw MunoWatch title strings.
 * Examples:
 * - "Terminal List Season 2:" -> { cleanTitle: "Terminal List", seasonNumber: 2, isSeriesHint: true }
 * - "AVENGERS DOOMSDAY VJ JUNIOR" -> { cleanTitle: "AVENGERS DOOMSDAY", vjName: "VJ Junior", isSeriesHint: false }
 */
export const extractMunoTitleClue = (rawTitle: string, explicitVj?: string | null): MunoTitleClue => {
  let working = (rawTitle || '').trim();
  let extractedVj = '';

  const vjMatch = working.match(/\b(VJ\s+[A-Za-z0-9\-]+|VJ\.[A-Za-z0-9\-]+)\b/i);
  if (vjMatch) {
    extractedVj = vjMatch[1];
    working = working.replace(vjMatch[0], ' ');
  }

  let seasonNumber: number | undefined;
  let isSeriesHint = false;

  const seasonMatch = working.match(/\b(?:season|s)\s*0*(\d{1,2})\b/i);
  if (seasonMatch) {
    seasonNumber = Number(seasonMatch[1]);
    isSeriesHint = true;
  }
  if (/\b(?:ep(?:isode)?\s*\d+|s\d{1,2}e\d{1,2})\b/i.test(working)) {
    isSeriesHint = true;
  }

  working = working
    .replace(/\(\s*(?:19|20)\d{2}\s*\)/g, ' ')
    .replace(/\[\s*(?:19|20)\d{2}\s*\]/g, ' ')
    .replace(/\b(?:season|s)\s*\d{1,2}(?:\s*e\d{1,2})?\b/gi, ' ')
    .replace(/\bep(?:isode)?\s*\d+\b/gi, ' ')
    .replace(/\bpart\s*\d+\b/gi, ' ')
    .replace(/\bluganda\s*(?:dubbed|translated)?\b/gi, ' ')
    .replace(/[:\-–|]+$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const vjSource = explicitVj && explicitVj.trim() ? explicitVj : extractedVj;

  return {
    cleanTitle: working || rawTitle.trim(),
    vjName: normalizeVjName(vjSource),
    isSeriesHint,
    seasonNumber,
  };
};

const normalizeTitleForComparison = (value: string): string =>
  value
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const stripLeadingArticles = (value: string): string =>
  value.replace(/^(?:the|a|an)\s+/i, '').trim();

/**
 * Pick the best TMDB search result matching the MunoWatch title clue.
 * Strict gate: NEVER returns an entry lacking a real TMDB `backdrop_path` banner.
 */
export const pickBestTmdbMatch = <
  T extends {
    id?: number;
    title?: string;
    name?: string;
    original_title?: string;
    original_name?: string;
    backdrop_path?: string | null;
    poster_path?: string | null;
    media_type?: string;
    popularity?: number;
    vote_count?: number;
  }
>(
  tmdbResults: T[],
  clueTitle: string
): T | null => {
  if (!Array.isArray(tmdbResults) || tmdbResults.length === 0) return null;

  const cleanClue = normalizeTitleForComparison(clueTitle);
  if (!cleanClue) return null;
  const clueNoArticle = stripLeadingArticles(cleanClue);
  const clueWords = clueNoArticle.split(' ').filter((w) => w.length > 1);

  // Strict requirement: TMDB must have an actual banner (backdrop_path)
  const withBanner = tmdbResults.filter(
    (item) =>
      item &&
      item.media_type !== 'person' &&
      Boolean(item.backdrop_path) &&
      Boolean(item.title || item.name)
  );
  if (withBanner.length === 0) return null;

  let bestItem: T | null = null;
  let bestScore = -1;

  for (const item of withBanner) {
    const candidates = [item.title, item.name, item.original_title, item.original_name].filter(
      (c): c is string => Boolean(c)
    );

    let itemBestMatchScore = -1;
    for (const candidateRaw of candidates) {
      const candidate = normalizeTitleForComparison(candidateRaw);
      const candidateNoArticle = stripLeadingArticles(candidate);

      let score = -1;
      if (candidate === cleanClue) {
        score = 120;
      } else if (candidateNoArticle === clueNoArticle && clueNoArticle.length > 0) {
        score = 105;
      } else if (
        candidateNoArticle.startsWith(clueNoArticle) ||
        clueNoArticle.startsWith(candidateNoArticle)
      ) {
        const minLen = Math.min(candidateNoArticle.length, clueNoArticle.length);
        const maxLen = Math.max(candidateNoArticle.length, clueNoArticle.length);
        if (minLen >= 3 && minLen / maxLen >= 0.45) {
          score = 75 + Math.round((minLen / maxLen) * 20);
        }
      } else if (clueWords.length > 0) {
        const candWords = candidateNoArticle.split(' ').filter((w) => w.length > 1);
        const shared = clueWords.filter((w) => candWords.includes(w));
        const ratio = shared.length / Math.max(clueWords.length, candWords.length);
        if (shared.length > 0 && ratio >= 0.5) {
          score = 45 + Math.round(ratio * 35);
        }
      }

      if (score > itemBestMatchScore) {
        itemBestMatchScore = score;
      }
    }

    if (itemBestMatchScore < 0) continue;

    const popularityBonus = Math.min(15, Math.log10(Math.max(1, item.popularity || 1)) * 5);
    const voteCountBonus = Math.min(12, Math.log10(Math.max(1, item.vote_count || 1)) * 3);
    const posterBonus = item.poster_path ? 8 : 0;
    const totalScore = itemBestMatchScore + popularityBonus + voteCountBonus + posterBonus;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestItem = item;
    }
  }

  return bestItem;
};

/**
 * Extract an episode number from a MunoWatch or TMDB episode record.
 */
export const extractEpisodeNumber = (raw: {
  episodeNumber?: number;
  episode_number?: number;
  title?: string;
  name?: string;
  streamUrl?: string | null;
}): number | null => {
  if (typeof raw.episodeNumber === 'number' && raw.episodeNumber > 0) return raw.episodeNumber;
  if (typeof raw.episode_number === 'number' && raw.episode_number > 0) return raw.episode_number;

  const text = `${raw.title || ''} ${raw.name || ''} ${raw.streamUrl || ''}`;
  const sxeMatch = text.match(/s\d{1,2}\s*e0*(\d{1,3})\b/i);
  if (sxeMatch) return Number(sxeMatch[1]);

  const epMatch = text.match(/\bep(?:isode)?\s*[-_:#]?\s*0*(\d{1,3})\b/i);
  if (epMatch) return Number(epMatch[1]);

  const partMatch = text.match(/\bpart\s*0*(\d{1,3})\b/i);
  if (partMatch) return Number(partMatch[1]);

  const trailingMatch = (raw.title || raw.name || '').trim().match(/\b0*(\d{1,3})$/);
  if (trailingMatch) return Number(trailingMatch[1]);

  return null;
};

export interface MunoEpisodeCandidate {
  title?: string;
  streamUrl?: string | null;
  playingurl?: string | null;
  episodeNumber?: number;
  vj?: string;
}

/**
 * Attach playable MunoWatch stream URLs onto TMDB episodes by episode number.
 */
export const attachMunoStreamsToEpisodes = (
  tmdbEpisodes: Episode[],
  munoEpisodes: MunoEpisodeCandidate[],
  fallbackStreamUrl?: string | null,
  defaultVj?: string
): Episode[] => {
  if (!Array.isArray(tmdbEpisodes) || tmdbEpisodes.length === 0) return [];

  const streamByEpNum = new Map<number, { url: string; vj?: string }>();
  for (const mep of munoEpisodes || []) {
    const cleanUrl = sanitizeMunoStreamUrl(mep.streamUrl || mep.playingurl);
    if (!cleanUrl) continue;
    const epNum = extractEpisodeNumber({
      episodeNumber: mep.episodeNumber,
      title: mep.title,
      streamUrl: cleanUrl,
    });
    if (epNum && !streamByEpNum.has(epNum)) {
      streamByEpNum.set(epNum, {
        url: cleanUrl,
        vj: mep.vj ? normalizeVjName(mep.vj) : defaultVj,
      });
    }
  }

  const sanitizedFallback = sanitizeMunoStreamUrl(fallbackStreamUrl);

  return tmdbEpisodes.map((ep) => {
    const matched = streamByEpNum.get(ep.episodeNumber);
    if (matched) {
      return {
        ...ep,
        videoUrl: matched.url,
        vjName: matched.vj || ep.vjName || defaultVj,
      };
    }
    if (sanitizedFallback) {
      return {
        ...ep,
        videoUrl: sanitizedFallback,
        vjName: ep.vjName || defaultVj,
      };
    }
    return ep;
  });
};

export const DEFAULT_STREAM_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB (safe under Cloud Run 32 MiB limit)

/**
 * Compute an HTTP Range header capped at `maxChunkBytes` so proxied video chunks
 * never exceed serverless proxy response limits (e.g. Cloud Run 32 MiB cap).
 */
export const computeCappedByteRange = (
  rangeHeader?: string | null,
  maxChunkBytes: number = DEFAULT_STREAM_CHUNK_BYTES
): string => {
  const safeMax = Math.max(1024, Math.floor(maxChunkBytes));
  if (!rangeHeader || typeof rangeHeader !== 'string') {
    return `bytes=0-${safeMax - 1}`;
  }

  const trimmed = rangeHeader.trim();
  const suffixMatch = trimmed.match(/^bytes=-(\d+)$/i);
  if (suffixMatch) {
    const len = Number(suffixMatch[1]);
    if (Number.isFinite(len) && len > 0) {
      return `bytes=-${Math.min(len, safeMax)}`;
    }
    return `bytes=0-${safeMax - 1}`;
  }

  const match = trimmed.match(/^bytes=(\d+)-(\d*)$/i);
  if (!match) {
    return `bytes=0-${safeMax - 1}`;
  }

  const start = Number(match[1]);
  if (!Number.isFinite(start) || start < 0) {
    return `bytes=0-${safeMax - 1}`;
  }

  const endStr = match[2];
  if (!endStr) {
    return `bytes=${start}-${start + safeMax - 1}`;
  }

  const requestedEnd = Number(endStr);
  if (!Number.isFinite(requestedEnd) || requestedEnd < start) {
    return `bytes=${start}-${start + safeMax - 1}`;
  }

  const cappedEnd = Math.min(requestedEnd, start + safeMax - 1);
  return `bytes=${start}-${cappedEnd}`;
};

/**
 * Parse runtime labels such as "2h 10m", "1h 45m", "95m", or "2 Seasons" into seconds.
 * Used as an initial estimate until <video> fires loadedmetadata with exact file duration.
 */
export const parseDurationToSeconds = (
  durationOrSeasons?: string | null,
  movieType: 'movie' | 'series' = 'movie'
): number => {
  if (durationOrSeasons && typeof durationOrSeasons === 'string') {
    const hrMatch = durationOrSeasons.match(/(\d+)\s*h/i);
    const minMatch = durationOrSeasons.match(/(\d+)\s*m(?!o)/i);
    const hrs = hrMatch ? Number(hrMatch[1]) : 0;
    const mins = minMatch ? Number(minMatch[1]) : 0;
    const total = hrs * 3600 + mins * 60;
    if (total > 0) {
      return total;
    }
  }
  return movieType === 'series' ? 2700 : 5400;
};

export interface PwaPlatformInfo {
  isStandalone: boolean;
  isIOS: boolean;
  isEmbeddedIframe: boolean;
}

/**
 * Pure platform detection helper for PWA install UI and standalone mode suppression.
 */
export const detectPwaPlatform = (
  userAgent: string,
  displayModeStandalone: boolean,
  navigatorStandalone: boolean = false,
  inIframe: boolean = false
): PwaPlatformInfo => {
  const ua = (userAgent || '').toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isStandalone = Boolean(displayModeStandalone || navigatorStandalone);
  return {
    isStandalone,
    isIOS,
    isEmbeddedIframe: Boolean(inIframe),
  };
};

export type PwaInstallAction = 'installed' | 'native-prompt' | 'ios-guide' | 'browser-guide';

/**
 * Resolve the appropriate install UX path from current platform & prompt availability.
 */
export const resolvePwaInstallAction = (
  isInstalled: boolean,
  hasDeferredPrompt: boolean,
  isIOS: boolean
): PwaInstallAction => {
  if (isInstalled) return 'installed';
  if (hasDeferredPrompt) return 'native-prompt';
  if (isIOS) return 'ios-guide';
  return 'browser-guide';
};

/**
 * Build a safe device filename (e.g. "Avengers Doomsday - S01E02.mp4") for downloaded videos.
 */
export const buildDownloadFileName = (
  title: string,
  episode?: Pick<Episode, 'seasonNumber' | 'episodeNumber'>
): string => {
  const cleanTitle = (title || 'Netflux Video')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || 'Netflux Video';

  if (episode && Number.isFinite(episode.seasonNumber) && Number.isFinite(episode.episodeNumber)) {
    const s = String(episode.seasonNumber).padStart(2, '0');
    const e = String(episode.episodeNumber).padStart(2, '0');
    return `${cleanTitle} - S${s}E${e}.mp4`;
  }
  return `${cleanTitle}.mp4`;
};

/**
 * Parse total file size in bytes from HTTP Content-Range (e.g. "bytes 0-0/456789") or Content-Length.
 */
export const parseContentRangeTotalBytes = (
  contentRange?: string | null,
  contentLength?: string | null,
  httpStatus?: number | null
): number | null => {
  if (contentRange && typeof contentRange === 'string') {
    const match = contentRange.match(/\/(\d+)\s*$/);
    if (match) {
      const total = Number(match[1]);
      if (Number.isFinite(total) && total > 0) return total;
    }
  }
  if (httpStatus === 206) {
    return null;
  }
  if (contentLength && typeof contentLength === 'string') {
    const len = Number(contentLength.trim());
    if (Number.isFinite(len) && len > 0) return len;
  }
  return null;
};

/**
 * Compute clamped integer percentage [0..100] from downloaded bytes and total bytes.
 */
export const computeDownloadProgress = (bytesDownloaded: number, totalBytes?: number | null): number => {
  if (!totalBytes || totalBytes <= 0) return 0;
  const pct = Math.floor((Math.max(0, bytesDownloaded) / totalBytes) * 100);
  return Math.min(100, Math.max(0, pct));
};

/**
 * Format byte sizes into clean MB/GB strings for UI display.
 */
export const formatBytesLabel = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  if (mb >= 1) {
    return `${Math.round(mb)} MB`;
  }
  const kb = Math.max(1, Math.round(bytes / 1024));
  return `${kb} KB`;
};

/**
 * Normalize persisted downloads loaded on startup so interrupted active downloads recover as paused.
 */
export const normalizeStoredDownloads = (items: DownloadItem[]): DownloadItem[] => {
  if (!Array.isArray(items)) return [];
  return items.map((d) =>
    d.status === 'pending' || d.status === 'downloading'
      ? { ...d, status: 'paused' as const }
      : d
  );
};

export const ADMIN_EMAIL = 'ashirafashes04@gmail.com';

/**
 * Normalize an email or identifier string for strict comparison.
 */
export const normalizeEmail = (value?: string | null): string => {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

/**
 * Strictly verify whether the provided email matches the authorized Admin email.
 */
export const isAdminEmail = (email?: string | null): boolean => {
  return normalizeEmail(email) === ADMIN_EMAIL;
};

/**
 * Decide whether the Admin Panel button can be displayed to the currently signed-in account.
 * Strictly requires an exact match to `ashirafashes04@gmail.com`. If Firebase Auth email is present,
 * it takes precedence so tampered localStorage values never unlock the button for another account.
 */
export const canDisplayAdminButton = (params: {
  authEmail?: string | null;
  sessionIdentifier?: string | null;
}): boolean => {
  const cleanAuth = normalizeEmail(params.authEmail);
  if (cleanAuth) {
    return isAdminEmail(cleanAuth);
  }
  const cleanSession = normalizeEmail(params.sessionIdentifier);
  if (!cleanSession) return false;
  return isAdminEmail(cleanSession);
};

/**
 * Validate admin credential confirmation form inputs (must match exact admin email and supply password).
 */
export const validateAdminConfirmationInput = (params: {
  email: string;
  password: string;
}): string | null => {
  if (!isAdminEmail(params.email)) {
    return `Access restricted: enter the authorized admin email (${ADMIN_EMAIL}).`;
  }
  if (!params.password || !params.password.trim()) {
    return 'Please enter the admin password to confirm access.';
  }
  return null;
};

export interface AdminCatalogSummary {
  totalTitles: number;
  moviesCount: number;
  seriesCount: number;
  uniqueVjsCount: number;
  vjBreakdown: Array<{ vjName: string; count: number }>;
}

/**
 * Compute aggregate catalog & VJ statistics for the Admin Console overview.
 */
export const computeAdminCatalogSummary = (movies: Movie[]): AdminCatalogSummary => {
  const list = Array.isArray(movies) ? movies : [];
  let moviesCount = 0;
  let seriesCount = 0;
  const vjCounts = new Map<string, number>();

  for (const item of list) {
    if (item.type === 'series') seriesCount++;
    else moviesCount++;
    const vj = normalizeVjName(item.vjName);
    vjCounts.set(vj, (vjCounts.get(vj) || 0) + 1);
  }

  const vjBreakdown = Array.from(vjCounts.entries())
    .map(([vjName, count]) => ({ vjName, count }))
    .sort((a, b) => b.count - a.count || a.vjName.localeCompare(b.vjName));

  return {
    totalTitles: list.length,
    moviesCount,
    seriesCount,
    uniqueVjsCount: vjBreakdown.length,
    vjBreakdown,
  };
};

/**
 * Filter catalog rows in Admin Console by search query, type, and VJ translator.
 */
export const filterAdminCatalog = (
  movies: Movie[],
  filters: {
    query?: string;
    type?: 'all' | 'movie' | 'series';
    vjName?: string;
  }
): Movie[] => {
  const list = Array.isArray(movies) ? movies : [];
  const cleanQuery = (filters.query || '').trim().toLowerCase();
  const cleanType = filters.type || 'all';
  const cleanVj = (filters.vjName || '').trim().toLowerCase();

  return list.filter((m) => {
    if (cleanType !== 'all' && m.type !== cleanType) return false;
    if (cleanVj && cleanVj !== 'all') {
      const mVj = normalizeVjName(m.vjName).toLowerCase();
      if (mVj !== cleanVj) return false;
    }
    if (cleanQuery) {
      const titleHit = m.title.toLowerCase().includes(cleanQuery);
      const vjHit = (m.vjName || '').toLowerCase().includes(cleanQuery);
      const genreHit = m.genres.some((g) => g.toLowerCase().includes(cleanQuery));
      if (!titleHit && !vjHit && !genreHit) return false;
    }
    return true;
  });
};

/**
 * Format a relative notification timestamp label (e.g. "Just now", "5m ago", "2h ago", "3d ago").
 */
export const formatNotificationTimeAgo = (
  createdAt?: number,
  fallbackLabel = 'Just now',
  now: number = Date.now()
): string => {
  if (!createdAt || !Number.isFinite(createdAt)) return fallbackLabel;
  const diffSec = Math.max(0, Math.floor((now - createdAt) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
};

/**
 * Merge newly uploaded / incoming movie notifications with existing notifications,
 * respecting previously cleared/dismissed IDs while ensuring new uploads always notify users.
 */
export const mergeIncomingNotifications = (params: {
  current: NotificationItem[];
  incoming: NotificationItem[];
  dismissedIds?: string[];
  maxItems?: number;
}): { merged: NotificationItem[]; newlyAdded: NotificationItem[] } => {
  const current = Array.isArray(params.current) ? params.current : [];
  const incoming = Array.isArray(params.incoming) ? params.incoming : [];
  const dismissedSet = new Set(Array.isArray(params.dismissedIds) ? params.dismissedIds : []);
  const maxItems = Math.max(10, params.maxItems || 40);

  const byId = new Map<string, NotificationItem>();
  for (const item of current) {
    if (item && item.id && !dismissedSet.has(item.id)) {
      byId.set(item.id, item);
    }
  }

  const newlyAdded: NotificationItem[] = [];
  for (const item of incoming) {
    if (!item || !item.id || dismissedSet.has(item.id)) continue;
    const existing = byId.get(item.id);
    if (!existing) {
      const normalized: NotificationItem = {
        ...item,
        read: Boolean(item.read),
        createdAt: item.createdAt || Date.now(),
      };
      byId.set(item.id, normalized);
      newlyAdded.push(normalized);
    }
  }

  const merged = Array.from(byId.values())
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, maxItems);

  return { merged, newlyAdded };
};

/**
 * Derive a deterministic storage namespace key for the currently signed-in account.
 * Prefers immutable Firebase `uid` when present, falling back to canonical normalized email/phone.
 */
export const normalizeAccountScopeKey = (params: {
  uid?: string | null;
  identifier?: string | null;
  email?: string | null;
}): string => {
  const cleanUid = typeof params.uid === 'string' ? params.uid.trim() : '';
  if (cleanUid) {
    return `uid:${cleanUid.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  }
  const rawCandidate =
    (typeof params.email === 'string' && params.email.trim()) ||
    (typeof params.identifier === 'string' && params.identifier.trim()) ||
    '';
  if (!rawCandidate) {
    return 'guest';
  }
  const canonical = toFirebaseAuthEmail(rawCandidate)
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '_');
  return canonical ? `acct:${canonical}` : 'guest';
};

/**
 * Build an isolated storage key scoped to an account and (for personal lists/downloads/history) a specific profile.
 */
export const buildScopedStorageKey = (
  baseKey: string,
  accountKey: string,
  profileId?: string | null
): string => {
  const cleanBase = (baseKey || 'data').trim();
  const cleanAcct = (accountKey || 'guest').trim() || 'guest';
  const cleanProfile = typeof profileId === 'string' ? profileId.trim() : '';
  if (cleanProfile) {
    return `netflux_v2:${cleanAcct}:profile:${cleanProfile}:${cleanBase}`;
  }
  return `netflux_v2:${cleanAcct}:${cleanBase}`;
};

/**
 * Build an isolated IndexedDB key for cached offline video blobs scoped by account and profile.
 */
export const buildScopedDownloadBlobKey = (
  accountKey: string,
  profileId: string,
  downloadId: string
): string => {
  const cleanAcct = (accountKey || 'guest').trim() || 'guest';
  const cleanProfile = (profileId || 'p1').trim() || 'p1';
  const cleanDl = (downloadId || '').trim();
  return `netflux_blob:${cleanAcct}:${cleanProfile}:${cleanDl}`;
};

/**
 * Generate pristine, empty initial data for a newly registered or first-time signed-in account.
 */
export const createFreshAccountSeedData = (
  defaultProfiles: Profile[],
  defaultSettings: AppSettings
) => {
  const clonedProfiles = defaultProfiles.map((p) => ({ ...p }));
  return {
    profiles: clonedProfiles,
    activeProfileId: clonedProfiles[0]?.id || 'p1',
    watchlist: [] as string[],
    continueWatching: [] as WatchProgress[],
    downloads: [] as DownloadItem[],
    notifications: [] as NotificationItem[],
    settings: { ...defaultSettings },
    recentSearches: [] as string[],
    planId: 'monthly',
    paymentMethods: [],
    reminders: [] as string[],
    profileData: {},
  };
};

export interface DirectoryUserEntry {
  key: string;
  uid: string;
  email: string | null;
  displayName: string;
  createdAt: number;
  lastSeenAt: number;
}

export const isSyntheticTestUser = (keyOrId?: string | null, email?: string | null): boolean => {
  const k = (keyOrId || '').trim().toLowerCase();
  const e = (email || '').trim().toLowerCase();
  if (
    k === 'browser_check_example_test' ||
    k === 'player_check_example_com' ||
    k === 'admin_ashiraf'
  ) {
    return true;
  }
  if (e.endsWith('@example.com') || e.endsWith('@example.test')) return true;
  if (/^member_\d{10,}@gmail\.com$/.test(e)) return true;
  if (k.startsWith('email:member_') && /@gmail\.com$/.test(k)) return true;
  return false;
};

export const reconstructLegacyEmailFromKey = (rawKey?: string | null): string | null => {
  const k = (rawKey || '').trim().toLowerCase();
  if (!k || /^[a-z0-9]{20,36}$/i.test(k)) return null;
  const match = k.match(/^(.+)_(gmail|yahoo|hotmail|outlook|icloud)_(com|co_uk|org|net)$/);
  if (!match) return null;
  const local = match[1].replace(/_/g, '.');
  const domain = `${match[2]}.${match[3].replace(/_/g, '.')}`;
  return `${local}@${domain}`;
};

/**
 * Merge user records from Firebase Realtime Database (`/users`) and the server's
 * `.registered-users.json` store into a deduplicated directory with accurate total and
 * 24-hour active counts, filtering out known automated test accounts.
 */
export const aggregateUserDirectoryStats = (params: {
  rtdbUsers?: Record<string, any> | null;
  localRecords?: Array<Partial<DirectoryUserEntry>>;
  nowMs?: number;
}): {
  totalUsers: number;
  activeUsersToday: number;
  records: DirectoryUserEntry[];
} => {
  const now = typeof params.nowMs === 'number' && Number.isFinite(params.nowMs) ? params.nowMs : Date.now();
  const cutoff24h = now - 24 * 60 * 60 * 1000;

  const byCanonical = new Map<string, DirectoryUserEntry>();
  const uidToCanonical = new Map<string, string>();

  const upsertEntry = (raw: {
    rawKey?: string;
    uid?: string;
    email?: string | null;
    displayName?: string;
    createdAt?: number;
    lastSeenAt?: number;
  }) => {
    const cleanUid = (raw.uid || '').trim();
    const candidateEmail =
      (typeof raw.email === 'string' && raw.email.includes('@') ? raw.email.trim().toLowerCase() : null) ||
      reconstructLegacyEmailFromKey(raw.rawKey);

    if (isSyntheticTestUser(raw.rawKey, candidateEmail) || isSyntheticTestUser(cleanUid, candidateEmail)) {
      return;
    }

    const mappedFromUid = cleanUid ? uidToCanonical.get(cleanUid) : undefined;
    const canonicalKey = candidateEmail
      ? `email:${candidateEmail}`
      : mappedFromUid || (cleanUid ? `uid:${cleanUid}` : raw.rawKey ? `key:${raw.rawKey.trim().toLowerCase()}` : '');
    if (!canonicalKey) return;

    // If a record previously existed only under uid:... and we now learned its email, migrate it
    if (candidateEmail && mappedFromUid && mappedFromUid !== canonicalKey && byCanonical.has(mappedFromUid)) {
      const prior = byCanonical.get(mappedFromUid)!;
      byCanonical.delete(mappedFromUid);
      const existingAtEmail = byCanonical.get(canonicalKey);
      byCanonical.set(canonicalKey, {
        key: canonicalKey,
        uid: cleanUid || prior.uid || existingAtEmail?.uid || canonicalKey,
        email: candidateEmail,
        displayName:
          raw.displayName?.trim() || existingAtEmail?.displayName || prior.displayName || candidateEmail,
        createdAt: Math.min(
          prior.createdAt || now,
          existingAtEmail?.createdAt || now,
          raw.createdAt || now
        ),
        lastSeenAt: Math.max(
          prior.lastSeenAt || 0,
          existingAtEmail?.lastSeenAt || 0,
          raw.lastSeenAt || 0
        ),
      });
    }

    const existing = byCanonical.get(canonicalKey);
    const createdVal =
      typeof raw.createdAt === 'number' && Number.isFinite(raw.createdAt) && raw.createdAt > 0
        ? raw.createdAt
        : now;
    const seenVal =
      typeof raw.lastSeenAt === 'number' && Number.isFinite(raw.lastSeenAt) && raw.lastSeenAt > 0
        ? raw.lastSeenAt
        : 0;

    if (existing) {
      byCanonical.set(canonicalKey, {
        ...existing,
        key: canonicalKey,
        uid: cleanUid || existing.uid,
        email: candidateEmail || existing.email,
        displayName: raw.displayName?.trim() || existing.displayName,
        createdAt: Math.min(existing.createdAt || createdVal, createdVal),
        lastSeenAt: Math.max(existing.lastSeenAt || 0, seenVal),
      });
    } else {
      byCanonical.set(canonicalKey, {
        key: canonicalKey,
        uid: cleanUid || canonicalKey,
        email: candidateEmail,
        displayName: raw.displayName?.trim() || candidateEmail || 'Netflux Member',
        createdAt: createdVal,
        lastSeenAt: seenVal,
      });
    }

    if (cleanUid) {
      uidToCanonical.set(cleanUid, canonicalKey);
    }
  };

  if (params.rtdbUsers && typeof params.rtdbUsers === 'object') {
    for (const [nodeKey, nodeVal] of Object.entries(params.rtdbUsers)) {
      if (!nodeVal || typeof nodeVal !== 'object') continue;
      const acct = (nodeVal as any).account;
      const uid =
        (typeof acct?.uid === 'string' && acct.uid.trim()) ||
        (/^[a-zA-Z0-9]{20,36}$/.test(nodeKey) ? nodeKey : '');
      const email =
        (typeof acct?.email === 'string' && acct.email.includes('@') ? acct.email : null) ||
        (typeof acct?.identifier === 'string' && acct.identifier.includes('@') ? acct.identifier : null);
      const createdAt = Number(acct?.createdAt) || Number(acct?.lastLoginAt) || now;
      const lastSeenAt = Number(acct?.lastLoginAt) || Number(acct?.createdAt) || 0;
      const displayName =
        (typeof acct?.displayName === 'string' && acct.displayName.trim()) ||
        (typeof acct?.identifier === 'string' && acct.identifier.trim()) ||
        undefined;

      upsertEntry({
        rawKey: nodeKey,
        uid,
        email,
        displayName,
        createdAt,
        lastSeenAt,
      });
    }
  }

  for (const local of params.localRecords || []) {
    if (!local) continue;
    upsertEntry({
      rawKey: local.key,
      uid: local.uid,
      email: local.email ?? null,
      displayName: local.displayName,
      createdAt: local.createdAt,
      lastSeenAt: local.lastSeenAt,
    });
  }

  const records = Array.from(byCanonical.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  let activeUsersToday = 0;
  for (const r of records) {
    if (r.lastSeenAt >= cutoff24h) {
      activeUsersToday++;
    }
  }

  return {
    totalUsers: records.length,
    activeUsersToday,
    records,
  };
};

/**
 * Determine whether a request path refers to a static asset/script rather than a SPA route,
 * preventing missing JS/CSS chunks from ever falling back to `index.html` (which triggers MIME white screens).
 */
export const isStaticAssetRequestPath = (reqPath?: string | null): boolean => {
  const clean = (reqPath || '').split('?')[0].trim().toLowerCase();
  if (!clean || clean === '/') return false;
  if (clean.startsWith('/assets/') || clean.startsWith('/workbox-')) return true;
  return /\.(?:js|mjs|css|map|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|json|webmanifest|txt|xml)$/i.test(
    clean
  );
};

export const ACTIVE_NOW_WINDOW_MS = 15 * 60 * 1000;

/**
 * Compute subscription tier bid summary and weekly profit analytics (with payments inactive).
 */
export const computeSubscriptionProfitSummary = (params: {
  users: Array<{ isPremium?: boolean; isBlocked?: boolean }>;
  weeklyBidUgx?: number;
  monthlyBidUgx?: number;
}) => {
  const list = Array.isArray(params.users) ? params.users : [];
  const activeList = list.filter((u) => !u.isBlocked);
  const premiumUsersCount = activeList.filter((u) => Boolean(u.isPremium)).length;
  const freeUsersCount = Math.max(0, activeList.length - premiumUsersCount);
  const weeklyBidUgx = params.weeklyBidUgx ?? 4000;
  const monthlyBidUgx = params.monthlyBidUgx ?? 8000;

  const weeklyProfitUgx = premiumUsersCount * weeklyBidUgx;
  const projectedMonthlyUgx = premiumUsersCount * monthlyBidUgx;

  const dayWeights = [0.1, 0.12, 0.14, 0.13, 0.17, 0.19, 0.15];
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weeklyBreakdown = dayNames.map((day, idx) => ({
    day,
    profitUgx: Math.round(weeklyProfitUgx * dayWeights[idx]),
    subscribers: premiumUsersCount,
  }));

  return {
    paymentsEnabled: false,
    weeklyProfitUgx,
    projectedMonthlyUgx,
    premiumUsersCount,
    freeUsersCount,
    plans: [
      {
        id: 'daily',
        name: 'Daily Pass',
        priceLabel: '1,000 UGX / day',
        amountUgx: 1000,
        periodLabel: '24 Hours',
        activeCount: 0,
      },
      {
        id: 'weekly',
        name: 'Weekly Pass',
        priceLabel: '4,000 UGX / week',
        amountUgx: 4000,
        periodLabel: '7 Days',
        activeCount: premiumUsersCount,
      },
      {
        id: 'monthly',
        name: 'Monthly VIP',
        priceLabel: '8,000 UGX / month',
        amountUgx: 8000,
        periodLabel: '30 Days',
        activeCount: premiumUsersCount,
      },
    ],
    weeklyBreakdown,
  };
};

/**
 * Filter admin user email list by email search query and status filter.
 */
export const filterAdminUsersByEmail = <
  T extends { email: string; isPremium: boolean; isBlocked: boolean }
>(
  users: T[],
  query: string,
  mode: 'all' | 'premium' | 'blocked'
): T[] => {
  const q = (query || '').trim().toLowerCase();
  return (Array.isArray(users) ? users : []).filter((u) => {
    if (mode === 'premium' && !u.isPremium) return false;
    if (mode === 'blocked' && !u.isBlocked) return false;
    if (q && !u.email.toLowerCase().includes(q)) return false;
    return true;
  });
};

/**
 * Prevent administrator account from being accidentally blocked/disabled.
 */
export const canBlockAdminUser = (email?: string | null): boolean => {
  return Boolean(normalizeEmail(email)) && !isAdminEmail(email);
};

const MUNO_DIRECT_SAFE_HTTPS_HOSTS = ['r2.dev', 'pearlpix'];

/**
 * Determine whether an HTTPS video stream URL should play directly from edge CDN
 * without triggering hotlink Referer 403 rejections (`b-cdn.net` requires proxy Referer stripping).
 */
export const shouldPreferDirectHttpsStream = (rawUrl?: string | null): boolean => {
  if (!rawUrl || typeof rawUrl !== 'string') return false;
  const trimmed = rawUrl.trim();
  if (!/^https:\/\//i.test(trimmed)) return false;
  const lower = trimmed.toLowerCase();
  if (lower.includes('b-cdn.net')) return false;
  return MUNO_DIRECT_SAFE_HTTPS_HOSTS.some((host) => lower.includes(host));
};

/**
 * Resolve initial playback mode (`direct` for non-hotlink HTTPS CDNs, `proxy` otherwise).
 */
export const getInitialStreamMode = (rawUrl?: string | null): 'direct' | 'proxy' => {
  return shouldPreferDirectHttpsStream(rawUrl) ? 'direct' : 'proxy';
};

/**
 * Resolve the `<video>` src URL for the given stream URL and mode.
 */
export const resolveEffectiveVideoSrc = (
  rawUrl?: string | null,
  mode: 'direct' | 'proxy' = 'direct'
): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  if (/^blob:/i.test(trimmed) || (mode === 'direct' && /^https:\/\//i.test(trimmed))) {
    return trimmed;
  }
  return `/api/stream?url=${encodeURIComponent(trimmed)}`;
};

/**
 * Verify whether a MunoWatch series payload title belongs to the expected series
 * (guards against upstream series_code ID collisions such as My Strange Hero vs Nemesis 6).
 */
export const isMatchingSeriesTitle = (
  expectedTitle?: string | null,
  candidateTitle?: string | null
): boolean => {
  if (!expectedTitle || !candidateTitle) return true;
  const cleanExpected = stripLeadingArticles(
    normalizeTitleForComparison(extractMunoTitleClue(expectedTitle).cleanTitle)
  );
  const cleanCandidate = stripLeadingArticles(
    normalizeTitleForComparison(extractMunoTitleClue(candidateTitle).cleanTitle)
  );
  if (!cleanExpected || !cleanCandidate) return true;
  if (cleanExpected === cleanCandidate) return true;
  if (cleanExpected.includes(cleanCandidate) || cleanCandidate.includes(cleanExpected)) {
    return true;
  }
  const expWords = cleanExpected.split(' ').filter((w) => w.length > 2);
  const candWords = cleanCandidate.split(' ').filter((w) => w.length > 2);
  if (expWords.length === 0 || candWords.length === 0) return true;
  const shared = expWords.filter((w) => candWords.includes(w));
  return shared.length > 0;
};

/**
 * Merge multiple MunoWatch episode candidate arrays without losing episodes or duplicating streams.
 */
export const mergeMunoEpisodesPool = (
  ...lists: Array<MunoEpisodeCandidate[] | undefined>
): MunoEpisodeCandidate[] => {
  const seen = new Set<string>();
  const merged: MunoEpisodeCandidate[] = [];
  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item) continue;
      const cleanUrl = sanitizeMunoStreamUrl(item.streamUrl || item.playingurl);
      if (!cleanUrl) continue;
      const epNum = extractEpisodeNumber({
        episodeNumber: item.episodeNumber,
        title: item.title,
        streamUrl: cleanUrl,
      });
      const dedupKey = `${epNum ?? 'x'}::${cleanUrl}`;
      if (seen.has(dedupKey)) continue;
      seen.add(dedupKey);
      merged.push({
        ...item,
        episodeNumber: epNum ?? item.episodeNumber,
        streamUrl: cleanUrl,
        playingurl: cleanUrl,
      });
    }
  }
  return merged.sort((a, b) => (a.episodeNumber || 9999) - (b.episodeNumber || 9999));
};




