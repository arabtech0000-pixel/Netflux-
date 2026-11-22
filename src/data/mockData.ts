import { Profile, SubscriptionPlan, PaymentMethodItem, AppSettings } from '../types';

export const INITIAL_PROFILES: Profile[] = [
  {
    id: 'p1',
    name: 'Ashraf',
    avatarColor: '#1E88E5',
    avatarBg: 'bg-blue-600',
    avatarIcon: 'smile-blue',
    isKids: false,
    language: 'English',
  },
  {
    id: 'p2',
    name: 'Faith',
    avatarColor: '#E53935',
    avatarBg: 'bg-red-600',
    avatarIcon: 'smile-red',
    isKids: false,
    language: 'English',
  },
  {
    id: 'p3',
    name: 'David',
    avatarColor: '#FB8C00',
    avatarBg: 'bg-amber-500',
    avatarIcon: 'smile-amber',
    isKids: false,
    language: 'English',
  },
  {
    id: 'p4',
    name: 'Grace',
    avatarColor: '#8E24AA',
    avatarBg: 'bg-purple-600',
    avatarIcon: 'smile-purple',
    isKids: false,
    language: 'English',
  },
];

export const AVATAR_OPTIONS = [
  { id: 'blue', color: '#1E88E5', bg: 'bg-blue-600', label: 'Blue Classic' },
  { id: 'red', color: '#E53935', bg: 'bg-red-600', label: 'Red Bold' },
  { id: 'amber', color: '#FB8C00', bg: 'bg-amber-500', label: 'Amber Joy' },
  { id: 'purple', color: '#8E24AA', bg: 'bg-purple-600', label: 'Purple Cool' },
  { id: 'green', color: '#43A047', bg: 'bg-emerald-600', label: 'Emerald Fresh' },
  { id: 'pink', color: '#D81B60', bg: 'bg-pink-600', label: 'Rose Chic' },
  { id: 'cyan', color: '#00ACC1', bg: 'bg-cyan-600', label: 'Cyan Chill' },
  { id: 'slate', color: '#546E7A', bg: 'bg-slate-700', label: 'Dark Sleek' },
];

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'daily',
    name: 'Daily Pass',
    price: '1,000 UGX / day',
    quality: 'HD',
    resolution: '720p HD Stream',
    devices: 1,
    downloads: 1,
    features: ['Full access for 24 hours', 'Ad-free movies & TV shows', 'Watch on 1 supported device'],
  },
  {
    id: 'weekly',
    name: 'Weekly Pass',
    price: '4,000 UGX / week',
    quality: 'Full HD',
    resolution: '1080p Full HD',
    devices: 2,
    downloads: 2,
    features: ['Full access for 7 days', 'Unlimited ad-free movies & series', 'Watch on 2 devices at once', 'Download on 2 devices'],
    isPopular: true,
  },
  {
    id: 'monthly',
    name: 'Monthly VIP',
    price: '8,000 UGX / month',
    quality: '4K Ultra HD',
    resolution: '4K (Ultra HD) + HDR',
    devices: 4,
    downloads: 6,
    features: [
      'Full access for 30 days',
      'Ultra HD (4K) + Spatial Audio',
      'Watch on 4 supported devices simultaneously',
      'Download on 6 devices',
      'Priority VJ Audio Tracks',
    ],
  },
];

export const INITIAL_PAYMENT_METHODS: PaymentMethodItem[] = [];

export const INITIAL_SETTINGS: AppSettings = {
  playbackQuality: 'Auto',
  autoPlayNextEpisode: true,
  autoPlayPreviews: true,
  dataSaver: 'Automatic',
  downloadsWifiOnly: true,
  smartDownloads: true,
  downloadQuality: 'High',
  subtitleSize: 'Medium',
  subtitleColor: 'White',
  subtitleBg: 'Semi-Transparent',
  notificationsPush: true,
  notificationsEmail: false,
  appLanguage: 'English',
};

export const DEFAULT_GENRE_NAMES = [
  'Action',
  'Comedy',
  'Drama',
  'Horror',
  'Sci-Fi',
  'Romance',
  'Thriller',
  'Documentary',
] as const;
