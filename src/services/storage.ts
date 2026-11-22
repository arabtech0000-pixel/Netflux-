import {
  Profile,
  WatchProgress,
  DownloadItem,
  NotificationItem,
  AppSettings,
  PaymentMethodItem,
  SubscriptionPlan,
} from '../types';
import {
  INITIAL_PROFILES,
  INITIAL_SETTINGS,
  INITIAL_PAYMENT_METHODS,
  SUBSCRIPTION_PLANS,
} from '../data/mockData';
import {
  StoredSessionInfo,
  normalizeAccountScopeKey,
  buildScopedStorageKey,
} from './logic';

const KEYS = {
  USER: 'netflix_user',
  PROFILES: 'netflix_profiles',
  ACTIVE_PROFILE: 'netflix_active_profile',
  MY_LIST: 'netflix_my_list',
  CONTINUE_WATCHING: 'netflix_continue_watching',
  DOWNLOADS: 'netflix_downloads',
  NOTIFICATIONS: 'netflix_notifications',
  NOTIFICATIONS_CLEARED: 'netflix_notifications_cleared',
  SETTINGS: 'netflix_settings',
  RECENT_SEARCHES: 'netflix_recent_searches',
  PLAN: 'netflix_subscription_plan',
  PAYMENTS: 'netflix_payments',
  REMINDERS: 'netflix_reminders',
};

const ADMIN_TOKEN_KEY = 'netflux_admin_token';
const DISMISSED_NOTIFICATIONS_KEY = 'netflix_dismissed_notifications';

const safeGet = <T>(key: string, defaultValue: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch {
    return defaultValue;
  }
};

const safeSet = <T>(key: string, value: T): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // In-memory fallback
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

const cloneInitialProfiles = (): Profile[] => INITIAL_PROFILES.map((p) => ({ ...p }));

/**
 * Remove legacy pre-v2 unscoped keys so old shared device data never bleeds across users or profiles.
 */
export const purgeLegacyUnscopedStorage = (): void => {
  [
    KEYS.PROFILES,
    KEYS.ACTIVE_PROFILE,
    KEYS.MY_LIST,
    KEYS.CONTINUE_WATCHING,
    KEYS.DOWNLOADS,
    KEYS.NOTIFICATIONS,
    KEYS.NOTIFICATIONS_CLEARED,
    KEYS.SETTINGS,
    KEYS.RECENT_SEARCHES,
    KEYS.PLAN,
    KEYS.PAYMENTS,
    KEYS.REMINDERS,
    DISMISSED_NOTIFICATIONS_KEY,
  ].forEach(safeRemove);
};

export const getStoredUserSession = (): StoredSessionInfo | null => {
  return safeGet<StoredSessionInfo | null>(KEYS.USER, null);
};

export const resolveCurrentAccountKey = (overrideAccountKey?: string): string => {
  if (overrideAccountKey && overrideAccountKey.trim()) {
    return overrideAccountKey.trim();
  }
  const session = getStoredUserSession();
  return normalizeAccountScopeKey({
    uid: session?.uid,
    identifier: session?.identifier,
  });
};

export const getStoredProfiles = (accountKey?: string): Profile[] => {
  const scope = resolveCurrentAccountKey(accountKey);
  const stored = safeGet<Profile[] | null>(buildScopedStorageKey(KEYS.PROFILES, scope), null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored;
  }
  return cloneInitialProfiles();
};

export const saveProfiles = (profiles: Profile[], accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.PROFILES, scope), profiles);
};

export const getStoredActiveProfileId = (accountKey?: string): string => {
  const scope = resolveCurrentAccountKey(accountKey);
  const profiles = getStoredProfiles(scope);
  const fallbackId = profiles[0]?.id || 'p1';
  const stored = safeGet<string>(buildScopedStorageKey(KEYS.ACTIVE_PROFILE, scope), fallbackId);
  if (profiles.some((p) => p.id === stored)) {
    return stored;
  }
  return fallbackId;
};

export const saveActiveProfileId = (profileId: string, accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.ACTIVE_PROFILE, scope), profileId);
};

const resolveProfileScope = (accountKey?: string, profileId?: string): { accountKey: string; profileId: string } => {
  const acct = resolveCurrentAccountKey(accountKey);
  const prof = (profileId && profileId.trim()) || getStoredActiveProfileId(acct);
  return { accountKey: acct, profileId: prof };
};

export const getStoredMyList = (accountKey?: string, profileId?: string): string[] => {
  const scope = resolveProfileScope(accountKey, profileId);
  return safeGet<string[]>(buildScopedStorageKey(KEYS.MY_LIST, scope.accountKey, scope.profileId), []);
};

export const saveMyList = (list: string[], accountKey?: string, profileId?: string): void => {
  const scope = resolveProfileScope(accountKey, profileId);
  safeSet(buildScopedStorageKey(KEYS.MY_LIST, scope.accountKey, scope.profileId), list);
};

export const getStoredContinueWatching = (accountKey?: string, profileId?: string): WatchProgress[] => {
  const scope = resolveProfileScope(accountKey, profileId);
  const stored = safeGet<WatchProgress[]>(
    buildScopedStorageKey(KEYS.CONTINUE_WATCHING, scope.accountKey, scope.profileId),
    []
  );
  return stored.filter((item) => !item.posterUrl?.includes('images.unsplash.com'));
};

export const saveContinueWatching = (
  progressList: WatchProgress[],
  accountKey?: string,
  profileId?: string
): void => {
  const scope = resolveProfileScope(accountKey, profileId);
  safeSet(buildScopedStorageKey(KEYS.CONTINUE_WATCHING, scope.accountKey, scope.profileId), progressList);
};

export const getStoredDownloads = (accountKey?: string, profileId?: string): DownloadItem[] => {
  const scope = resolveProfileScope(accountKey, profileId);
  return safeGet<DownloadItem[]>(
    buildScopedStorageKey(KEYS.DOWNLOADS, scope.accountKey, scope.profileId),
    []
  );
};

export const saveDownloads = (
  downloads: DownloadItem[],
  accountKey?: string,
  profileId?: string
): void => {
  const scope = resolveProfileScope(accountKey, profileId);
  safeSet(buildScopedStorageKey(KEYS.DOWNLOADS, scope.accountKey, scope.profileId), downloads);
};

export const getStoredRecentSearches = (accountKey?: string, profileId?: string): string[] => {
  const scope = resolveProfileScope(accountKey, profileId);
  return safeGet<string[]>(
    buildScopedStorageKey(KEYS.RECENT_SEARCHES, scope.accountKey, scope.profileId),
    []
  );
};

export const saveRecentSearches = (
  searches: string[],
  accountKey?: string,
  profileId?: string
): void => {
  const scope = resolveProfileScope(accountKey, profileId);
  safeSet(buildScopedStorageKey(KEYS.RECENT_SEARCHES, scope.accountKey, scope.profileId), searches);
};

export const getStoredReminders = (accountKey?: string, profileId?: string): string[] => {
  const scope = resolveProfileScope(accountKey, profileId);
  return safeGet<string[]>(
    buildScopedStorageKey(KEYS.REMINDERS, scope.accountKey, scope.profileId),
    []
  );
};

export const saveReminders = (
  reminders: string[],
  accountKey?: string,
  profileId?: string
): void => {
  const scope = resolveProfileScope(accountKey, profileId);
  safeSet(buildScopedStorageKey(KEYS.REMINDERS, scope.accountKey, scope.profileId), reminders);
};

export const clearProfileScopedStorage = (accountKey: string, profileId: string): void => {
  [
    KEYS.MY_LIST,
    KEYS.CONTINUE_WATCHING,
    KEYS.DOWNLOADS,
    KEYS.RECENT_SEARCHES,
    KEYS.REMINDERS,
  ].forEach((base) => safeRemove(buildScopedStorageKey(base, accountKey, profileId)));
};

export const getStoredNotifications = (accountKey?: string): NotificationItem[] => {
  const scope = resolveCurrentAccountKey(accountKey);
  const stored = safeGet<NotificationItem[]>(
    buildScopedStorageKey(KEYS.NOTIFICATIONS, scope),
    []
  );
  return stored.filter((n) => !n.thumbnailUrl?.includes('images.unsplash.com'));
};

export const saveNotifications = (notifications: NotificationItem[], accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.NOTIFICATIONS, scope), notifications);
};

export const getNotificationsCleared = (accountKey?: string): boolean => {
  const scope = resolveCurrentAccountKey(accountKey);
  return safeGet<boolean>(buildScopedStorageKey(KEYS.NOTIFICATIONS_CLEARED, scope), false);
};

export const saveNotificationsCleared = (cleared: boolean, accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.NOTIFICATIONS_CLEARED, scope), cleared);
};

export const getDismissedNotificationIds = (accountKey?: string): string[] => {
  const scope = resolveCurrentAccountKey(accountKey);
  return safeGet<string[]>(buildScopedStorageKey(DISMISSED_NOTIFICATIONS_KEY, scope), []);
};

export const saveDismissedNotificationIds = (ids: string[], accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(DISMISSED_NOTIFICATIONS_KEY, scope), ids.slice(-200));
};

export const getStoredSettings = (accountKey?: string): AppSettings => {
  const scope = resolveCurrentAccountKey(accountKey);
  return safeGet(buildScopedStorageKey(KEYS.SETTINGS, scope), { ...INITIAL_SETTINGS });
};

export const saveSettings = (settings: AppSettings, accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.SETTINGS, scope), settings);
};

export const getStoredPlan = (accountKey?: string): SubscriptionPlan => {
  const scope = resolveCurrentAccountKey(accountKey);
  const planId = safeGet(buildScopedStorageKey(KEYS.PLAN, scope), 'monthly');
  return SUBSCRIPTION_PLANS.find((p) => p.id === planId) || SUBSCRIPTION_PLANS[2];
};

export const savePlan = (planId: string, accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.PLAN, scope), planId);
};

export const getStoredPaymentMethods = (accountKey?: string): PaymentMethodItem[] => {
  const scope = resolveCurrentAccountKey(accountKey);
  return safeGet(buildScopedStorageKey(KEYS.PAYMENTS, scope), INITIAL_PAYMENT_METHODS);
};

export const savePaymentMethods = (methods: PaymentMethodItem[], accountKey?: string): void => {
  const scope = resolveCurrentAccountKey(accountKey);
  safeSet(buildScopedStorageKey(KEYS.PAYMENTS, scope), methods);
};

export const saveUserSession = (session: StoredSessionInfo): void => {
  safeSet(KEYS.USER, session);
};

export const markOnboardingComplete = (): void => {
  const existing = getStoredUserSession();
  if (existing) {
    saveUserSession({ ...existing, onboardingComplete: true });
  } else {
    saveUserSession({
      identifier: 'member',
      onboardingComplete: true,
      signedInAt: Date.now(),
    });
  }
};

export const clearSession = (): void => {
  safeRemove(KEYS.USER);
  clearAdminToken();
};

export const getStoredAdminToken = (): string | null => {
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY) || sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
};

export const saveAdminToken = (token: string): void => {
  try {
    localStorage.setItem(ADMIN_TOKEN_KEY, token);
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
  } catch {
    // ignore
  }
};

export const clearAdminToken = (): void => {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch {
    // ignore
  }
};
