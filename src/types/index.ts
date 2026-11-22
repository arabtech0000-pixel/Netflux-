export type ScreenType =
  | 'splash'
  | 'welcome'
  | 'login'
  | 'register'
  | 'profile-select'
  | 'profile-manage'
  | 'profile-edit'
  | 'home'
  | 'browse'
  | 'genres'
  | 'search'
  | 'details'
  | 'player'
  | 'my-list'
  | 'downloads'
  | 'notifications'
  | 'my-netflix'
  | 'subscription'
  | 'payment'
  | 'settings'
  | 'exit'
  | 'tv-shows'
  | 'vjs'
  | 'games'
  | 'new-and-hot'
  | 'admin';

export type MainTabType = 'home' | 'tv-shows' | 'vjs' | 'downloads' | 'my-netflix' | 'games' | 'new-and-hot';

export type CategoryTab = 'Home' | 'TV Shows' | 'Movies' | 'VJs' | 'New & Hot';

export interface Episode {
  id: string;
  seasonNumber: number;
  episodeNumber: number;
  title: string;
  duration: string;
  durationSeconds: number;
  synopsis: string;
  thumbnail: string;
  videoUrl?: string;
  vjName?: string;
}

export interface VjStreamOption {
  id: string;
  vjName: string;
  videoUrl: string;
  munoId?: number | string;
  seriesCode?: string;
}

export interface Movie {
  id: string;
  title: string;
  type: 'movie' | 'series';
  year: number;
  ageRating: string;
  quality: 'HD' | '4K Ultra HD';
  durationOrSeasons: string;
  genres: string[];
  synopsis: string;
  matchScore: number;
  posterUrl: string;
  backdropUrl: string;
  logoUrl?: string;
  cast: string[];
  director?: string;
  isOriginal?: boolean;
  isTrending?: boolean;
  top10Rank?: number; // 1 to 10
  tags?: string[];
  episodes?: Episode[];
  trailerUrl?: string;
  releaseDate?: string;
  tmdbId?: number;
  seasonsCount?: number;
  trailerKey?: string;
  tagline?: string;
  similarMovies?: Movie[];
  videoUrl?: string;
  vjName?: string;
  munoId?: number | string;
  seriesCode?: string;
  vjStreams?: VjStreamOption[];
}

export interface Profile {
  id: string;
  name: string;
  avatarColor: string; // hex or color identifier
  avatarBg: string;
  avatarIcon: string;
  isKids: boolean;
  language?: string;
}

export interface WatchProgress {
  movieId: string;
  episodeId?: string;
  title: string;
  episodeInfo?: string; // e.g. "S1:E4"
  currentTime: number; // in seconds
  duration: number; // in seconds
  posterUrl: string;
  lastWatchedAt: number;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'failed';

export interface DownloadItem {
  id: string;
  movieId: string;
  episodeId?: string;
  title: string;
  subTitle?: string;
  posterUrl: string;
  fileSizeMb: number;
  bytesDownloaded?: number;
  totalBytes?: number;
  videoUrl?: string;
  fileName?: string;
  errorMessage?: string;
  savedToDevice?: boolean;
  status: DownloadStatus;
  progress: number; // 0 - 100
  downloadedAt: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  movieId?: string;
  timeAgo: string;
  createdAt?: number;
  read: boolean;
  thumbnailUrl: string;
  type: 'new-arrival' | 'recommendation' | 'coming-soon';
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: string;
  quality: string;
  resolution: string;
  devices: number;
  downloads: number;
  features: string[];
  isPopular?: boolean;
}

export interface PaymentMethodItem {
  id: string;
  type: 'card' | 'paypal' | 'mobile_money';
  name: string;
  details: string;
  isDefault: boolean;
  brand?: string;
}

export interface AppSettings {
  playbackQuality: 'Auto' | 'Good' | 'High' | 'Ultra';
  autoPlayNextEpisode: boolean;
  autoPlayPreviews: boolean;
  dataSaver: 'Automatic' | 'Wi-Fi Only' | 'Save Data' | 'Maximum';
  downloadsWifiOnly: boolean;
  smartDownloads: boolean;
  downloadQuality: 'Standard' | 'High';
  subtitleSize: 'Small' | 'Medium' | 'Large';
  subtitleColor: 'White' | 'Yellow' | 'Cyan';
  subtitleBg: 'None' | 'Shadow' | 'Semi-Transparent' | 'Solid Black';
  notificationsPush: boolean;
  notificationsEmail: boolean;
  appLanguage: string;
}

export interface GenreBanner {
  id: string;
  name: string;
  image: string;
}

export interface TmdbCatalog {
  hero: Movie | null;
  tvHero: Movie | null;
  featuredBanners: Movie[];
  all: Movie[];
  sections: {
    trending: Movie[];
    top10: Movie[];
    tvShows: Movie[];
    movies: Movie[];
    upcoming: Movie[];
    byGenre: Record<string, Movie[]>;
  };
  genreBanners: GenreBanner[];
  notifications: NotificationItem[];
}

export interface SitePublicConfig {
  disclaimerEnabled: boolean;
  disclaimerTitle: string;
  disclaimerMessage: string;
  whatsappButtonLabel: string;
  whatsappGroupUrl?: string;
  whatsappPrefillMessage: string;
  siteAnnouncement: string;
  pinnedFeaturedMovieId?: string;
  updatedAt: number;
}

export interface AdminUserListItem {
  key: string;
  email: string;
  isPremium: boolean;
  isBlocked: boolean;
  activeNow: boolean;
  lastSeenAt: number;
}

export interface AdminSubscriptionPlanMetric {
  id: string;
  name: string;
  priceLabel: string;
  amountUgx: number;
  periodLabel: string;
  activeCount: number;
}

export interface AdminWeeklyProfitDay {
  day: string;
  profitUgx: number;
  subscribers: number;
}

export interface AdminSubscriptionSummary {
  paymentsEnabled: boolean;
  weeklyProfitUgx: number;
  projectedMonthlyUgx: number;
  premiumUsersCount: number;
  freeUsersCount: number;
  plans: AdminSubscriptionPlanMetric[];
  weeklyBreakdown: AdminWeeklyProfitDay[];
}

export interface AdminOverviewPayload {
  adminEmail: string;
  stats: {
    totalUsers: number;
    activeUsersNow: number;
    activeUsersToday: number;
    moviesCount: number;
    seriesCount: number;
    totalVods: number;
    uniqueVjsCount: number;
    premiumUsersCount: number;
    blockedUsersCount: number;
  };
  subscriptionSummary: AdminSubscriptionSummary;
  users: AdminUserListItem[];
}

