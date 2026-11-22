import { AdminOverviewPayload, Movie, NotificationItem, SitePublicConfig } from '../types';
import { getStoredAdminToken, saveAdminToken, clearAdminToken } from './storage';

export interface AdminVerifyResponse {
  ok: boolean;
  admin: boolean;
  email?: string;
  token?: string;
  error?: string;
}

export interface AdminUploadMoviePayload {
  title: string;
  type: 'movie' | 'series';
  year?: number;
  vjName: string;
  genres: string[];
  durationOrSeasons?: string;
  videoUrl: string;
  posterUrl?: string;
  backdropUrl?: string;
  synopsis?: string;
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminVerifyResponse> {
  const res = await fetch('/api/admin/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password }),
  });

  const data = (await res.json().catch(() => ({}))) as AdminVerifyResponse;
  if (!res.ok || !data.ok || !data.token) {
    clearAdminToken();
    throw new Error(data.error || 'Incorrect admin email or password. Access denied.');
  }

  saveAdminToken(data.token);
  return data;
}

export async function exchangeFirebaseAdminSession(idToken: string): Promise<boolean> {
  if (!idToken) return false;
  try {
    const res = await fetch('/api/admin/firebase-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return false;
    const data = (await res.json().catch(() => ({}))) as AdminVerifyResponse;
    if (data?.ok && data?.admin && data?.token) {
      saveAdminToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function checkAdminTokenSession(): Promise<boolean> {
  const token = getStoredAdminToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/admin/session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      if (res.status === 401) clearAdminToken();
      return false;
    }
    const data = await res.json();
    return Boolean(data?.ok && data?.admin);
  } catch {
    return false;
  }
}

export async function fetchAdminOverview(): Promise<AdminOverviewPayload> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin email and password confirmation required.');
  }
  const res = await fetch('/api/admin/overview', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin verification required. Please confirm your email and password.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to load admin dashboard.');
  }
  return (await res.json()) as AdminOverviewPayload;
}

export async function saveAdminSiteConfig(
  payload: Partial<SitePublicConfig>
): Promise<SitePublicConfig> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin verification required.');
  }
  const res = await fetch('/api/admin/config', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin session expired. Please confirm your email and password again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save configuration.');
  }
  const data = (await res.json()) as { config: SitePublicConfig };
  return data.config;
}

export async function uploadAdminMovie(
  payload: AdminUploadMoviePayload
): Promise<{ movie: Movie; notification: NotificationItem }> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin verification required.');
  }
  const res = await fetch('/api/admin/movies', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin session expired. Please confirm your email and password again.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload movie.');
  }
  const data = (await res.json()) as {
    ok: boolean;
    movie: Movie;
    notification: NotificationItem;
  };
  return { movie: data.movie, notification: data.notification };
}

export async function deleteAdminMovie(movieId: string): Promise<void> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin verification required.');
  }
  const res = await fetch(`/api/admin/movies/${encodeURIComponent(movieId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin session expired.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to remove uploaded movie.');
  }
}

export async function fetchPublicSiteConfig(): Promise<SitePublicConfig | null> {
  try {
    const res = await fetch('/api/public/config');
    if (!res.ok) return null;
    const data = (await res.json()) as { config?: SitePublicConfig };
    return data.config || null;
  } catch {
    return null;
  }
}

export async function fetchActiveNotifications(): Promise<NotificationItem[]> {
  try {
    const res = await fetch('/api/notifications');
    if (!res.ok) return [];
    const data = (await res.json()) as { notifications?: NotificationItem[] };
    return Array.isArray(data.notifications) ? data.notifications : [];
  } catch {
    return [];
  }
}

export interface SyncedUserStatus {
  totalUsers: number;
  activeUsersNow: number;
  isPremium: boolean;
  isBlocked: boolean;
}

export async function syncUserDirectorySession(idToken: string): Promise<SyncedUserStatus | null> {
  if (!idToken) return null;
  try {
    const res = await fetch('/api/users/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      totalUsers: Number(data?.totalUsers) || 0,
      activeUsersNow: Number(data?.activeUsersNow) || 0,
      isPremium: Boolean(data?.isPremium),
      isBlocked: Boolean(data?.isBlocked),
    };
  } catch {
    return null;
  }
}

export async function toggleAdminUserPremium(
  key: string,
  isPremium: boolean
): Promise<{ ok: boolean }> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin verification required.');
  }
  const res = await fetch('/api/admin/users/premium', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, isPremium }),
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin session expired.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user premium status.');
  }
  return (await res.json()) as { ok: boolean };
}

export async function toggleAdminUserBlocked(
  key: string,
  isBlocked: boolean
): Promise<{ ok: boolean }> {
  const token = getStoredAdminToken();
  if (!token) {
    throw new Error('Admin verification required.');
  }
  const res = await fetch('/api/admin/users/block', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ key, isBlocked }),
  });
  if (res.status === 401) {
    clearAdminToken();
    throw new Error('Admin session expired.');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user block status.');
  }
  return (await res.json()) as { ok: boolean };
}

