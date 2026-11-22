import { Movie, Episode, TmdbCatalog } from '../types';
import { mergeTmdbMovieDetails } from './logic';

const detailsCache = new Map<string, Movie>();
let catalogCache: TmdbCatalog | null = null;
let catalogPromise: Promise<TmdbCatalog> | null = null;

export function invalidateTmdbCatalogCache(): void {
  catalogCache = null;
}

export async function fetchTmdbCatalog(forceRefresh = false): Promise<TmdbCatalog> {
  if (!forceRefresh && catalogCache) {
    return catalogCache;
  }
  if (!forceRefresh && catalogPromise) {
    return catalogPromise;
  }

  const loadWithRetry = async (): Promise<TmdbCatalog> => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch('/api/tmdb/catalog');
        if (!res.ok) {
          throw new Error(`TMDB catalog request failed (${res.status})`);
        }
        const data = (await res.json()) as TmdbCatalog;
        catalogCache = data;
        return data;
      } catch (err) {
        lastError = err;
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error('TMDB catalog request failed');
  };

  catalogPromise = loadWithRetry().finally(() => {
    catalogPromise = null;
  });

  return catalogPromise;
}

export async function fetchTmdbMovieDetails(movie: Movie): Promise<Movie> {
  const cacheKey = `${movie.id}::${movie.vjName || ''}::${movie.tmdbId || ''}`;
  const cached = detailsCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const params = new URLSearchParams({
    id: movie.id,
    title: movie.title,
    type: movie.type,
  });
  if (movie.tmdbId) {
    params.set('tmdbId', String(movie.tmdbId));
  }
  if (movie.munoId !== undefined) {
    params.set('munoId', String(movie.munoId));
  }
  if (movie.seriesCode) {
    params.set('seriesCode', movie.seriesCode);
  }
  if (movie.videoUrl) {
    params.set('videoUrl', movie.videoUrl);
  }
  if (movie.vjName) {
    params.set('vjName', movie.vjName);
  }

  const res = await fetch(`/api/tmdb/details?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TMDB details request failed (${res.status})`);
  }

  const data = (await res.json()) as { movie?: Partial<Movie> };
  if (!data.movie) {
    return movie;
  }

  const merged = mergeTmdbMovieDetails(movie, data.movie);
  detailsCache.set(cacheKey, merged);
  return merged;
}

export async function fetchTmdbSeasonEpisodes(
  tmdbId: number,
  seasonNumber: number,
  fallbackBackdrop: string,
  seriesCode?: string
): Promise<Episode[]> {
  const params = new URLSearchParams({
    tmdbId: String(tmdbId),
    season: String(seasonNumber),
    backdrop: fallbackBackdrop,
  });
  if (seriesCode) {
    params.set('seriesCode', seriesCode);
  }
  const res = await fetch(`/api/tmdb/season?${params.toString()}`);
  if (!res.ok) {
    throw new Error(`TMDB season request failed (${res.status})`);
  }
  const data = (await res.json()) as { episodes?: Episode[] };
  return data.episodes || [];
}

export async function searchTmdbTitles(
  query: string,
  type: 'all' | 'movie' | 'series' = 'all'
): Promise<Movie[]> {
  const clean = query.trim();
  if (!clean) return [];
  const params = new URLSearchParams({
    q: clean,
    type,
  });
  const res = await fetch(`/api/tmdb/search?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Movie[] };
  return data.results || [];
}

export async function fetchTmdbTrending(
  type: 'all' | 'movie' | 'tv' = 'all'
): Promise<Movie[]> {
  const params = new URLSearchParams({ type });
  const res = await fetch(`/api/tmdb/trending?${params.toString()}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: Movie[] };
  return data.results || [];
}
