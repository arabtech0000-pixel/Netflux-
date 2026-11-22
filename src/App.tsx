/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  ScreenType,
  MainTabType,
  Movie,
  Episode,
  Profile,
  WatchProgress,
  DownloadItem,
  NotificationItem,
  AppSettings,
  PaymentMethodItem,
  SubscriptionPlan,
  CategoryTab,
  TmdbCatalog,
  SitePublicConfig,
} from './types';
import {
  getStoredProfiles,
  saveProfiles,
  getStoredActiveProfileId,
  saveActiveProfileId,
  getStoredMyList,
  saveMyList,
  getStoredContinueWatching,
  saveContinueWatching,
  getStoredDownloads,
  saveDownloads,
  getStoredNotifications,
  saveNotifications,
  saveNotificationsCleared,
  getDismissedNotificationIds,
  saveDismissedNotificationIds,
  getStoredSettings,
  saveSettings,
  getStoredRecentSearches,
  saveRecentSearches,
  getStoredPlan,
  savePlan,
  getStoredPaymentMethods,
  savePaymentMethods,
  getStoredReminders,
  saveReminders,
  getStoredUserSession,
  saveUserSession,
  markOnboardingComplete,
  clearSession,
  clearProfileScopedStorage,
  purgeLegacyUnscopedStorage,
  getStoredAdminToken,
} from './services/storage';
import {
  toggleMyList,
  recordWatchProgress,
  resolvePostSplashScreen,
  normalizeStoredDownloads,
  buildDownloadFileName,
  canDisplayAdminButton,
  mergeIncomingNotifications,
  isAdminEmail,
  normalizeAccountScopeKey,
  buildScopedDownloadBlobKey,
  createFreshAccountSeedData,
  DEFAULT_DISCLAIMER_CONFIG,
} from './services/logic';
import {
  exchangeFirebaseAdminSession,
  fetchActiveNotifications,
  fetchPublicSiteConfig,
  syncUserDirectorySession,
} from './services/admin';
import {
  startRealDownloadTask,
  pauseDownloadTask,
  pauseAllActiveDownloads,
  cancelDownloadTask,
  saveCompletedDownloadToDevice,
  getDownloadedBlobUrl,
} from './services/downloadManager';
import {
  fetchTmdbCatalog,
  fetchTmdbMovieDetails,
  invalidateTmdbCatalogCache,
} from './services/tmdb';
import {
  subscribeToAuthState,
  ensureUserRtdbSeeded,
  subscribeToUserRtdb,
  writeUserRtdbField,
  writeProfileRtdbField,
  deleteProfileRtdbData,
  signOutFirebase,
  consumeGoogleRedirectResult,
  getPendingGoogleAuthFlow,
  type RtdbUserData,
} from './services/firebase';
import type { User } from 'firebase/auth';
import { INITIAL_PROFILES, INITIAL_SETTINGS, SUBSCRIPTION_PLANS } from './data/mockData';

// Components
import { MobileFrame } from './components/MobileFrame';
import { BottomNav } from './components/BottomNav';
import { DesktopSideNav } from './components/DesktopSideNav';
import { CastModal } from './components/CastModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { StartupDisclaimerModal } from './components/StartupDisclaimerModal';

// Screens
import { SplashScreen } from './screens/SplashScreen';
import { WelcomeScreen } from './screens/WelcomeScreen';
import { LoginScreen } from './screens/LoginScreen';
import { RegisterScreen } from './screens/RegisterScreen';
import { ProfileSelectionScreen } from './screens/ProfileSelectionScreen';
import { ProfileManagementScreen } from './screens/ProfileManagementScreen';
import { HomeScreen } from './screens/HomeScreen';
import { BrowseScreen } from './screens/BrowseScreen';
import { GenresScreen } from './screens/GenresScreen';
import { SearchScreen } from './screens/SearchScreen';
import { MovieDetailsScreen } from './screens/MovieDetailsScreen';
import { VideoPlayerScreen } from './screens/VideoPlayerScreen';
import { MyListScreen } from './screens/MyListScreen';
import { DownloadsScreen } from './screens/DownloadsScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { MyNetflixScreen } from './screens/MyNetflixScreen';
import { SubscriptionScreen } from './screens/SubscriptionScreen';
import { PaymentScreen } from './screens/PaymentScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ExitScreen } from './screens/ExitScreen';
import { GamesScreen } from './screens/GamesScreen';
import { NewAndHotScreen } from './screens/NewAndHotScreen';
import { TVShowsScreen } from './screens/TVShowsScreen';
import { VJsScreen } from './screens/VJsScreen';
import { AdminScreen } from './screens/AdminScreen';

export default function App() {
  // Navigation State
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('splash');
  const [activeTab, setActiveTab] = useState<MainTabType>('home');
  const [screenHistory, setScreenHistory] = useState<ScreenType[]>([]);

  // Live TMDB Catalog State (zero mock movie data)
  const [catalog, setCatalog] = useState<TmdbCatalog | null>(null);
  const [catalogLoading, setCatalogLoading] = useState<boolean>(true);
  const [extraMovieCache, setExtraMovieCache] = useState<Record<string, Movie>>({});

  // Selected Entities
  const [selectedMovie, setSelectedMovie] = useState<Movie | null>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<Episode | undefined>(undefined);
  const [isLoadingDetails, setIsLoadingDetails] = useState<boolean>(false);
  const detailRequestIdRef = useRef<number>(0);
  const [playerAudioLang, setPlayerAudioLang] = useState<string>('English [Original]');
  const [activeGenreParam, setActiveGenreParam] = useState<string>('Action');
  const [browseTypeParam, setBrowseTypeParam] = useState<'all' | 'movie' | 'series'>('all');
  const [detailsAutoPlay, setDetailsAutoPlay] = useState<boolean>(false);

  // Firebase Auth User & Session Identifier
  const [authUser, setAuthUser] = useState<User | null>(null);
  const authUserRef = useRef<User | null>(null);
  authUserRef.current = authUser;
  const [sessionIdentifier, setSessionIdentifier] = useState<string | null>(
    () => getStoredUserSession()?.identifier || null
  );
  const [sessionUid, setSessionUid] = useState<string | null>(
    () => getStoredUserSession()?.uid || null
  );
  const accountKey = useMemo(
    () =>
      normalizeAccountScopeKey({
        uid: authUser?.uid || sessionUid,
        email: authUser?.email,
        identifier: sessionIdentifier,
      }),
    [authUser?.uid, authUser?.email, sessionUid, sessionIdentifier]
  );
  const accountKeyRef = useRef<string>(accountKey);
  accountKeyRef.current = accountKey;

  const currentScreenRef = useRef<ScreenType>(currentScreen);
  currentScreenRef.current = currentScreen;
  const [authErrorBanner, setAuthErrorBanner] = useState<string | null>(null);
  const redirectHandledRef = useRef<boolean>(false);
  const rtdbUserDataRef = useRef<RtdbUserData | null>(null);

  const isAdminUser = useMemo(
    () =>
      canDisplayAdminButton({
        authEmail: authUser?.email,
        sessionIdentifier,
      }),
    [authUser?.email, sessionIdentifier]
  );

  // Persistent Domain States (strictly scoped by accountKey & activeProfileId)
  const [profiles, setProfiles] = useState<Profile[]>(() => getStoredProfiles(accountKey));
  const [activeProfileId, setActiveProfileId] = useState<string>(() =>
    getStoredActiveProfileId(accountKey)
  );
  const activeProfileIdRef = useRef<string>(activeProfileId);
  activeProfileIdRef.current = activeProfileId;

  const [watchlist, setWatchlist] = useState<string[]>(() =>
    getStoredMyList(accountKey, activeProfileId)
  );
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>(() =>
    getStoredContinueWatching(accountKey, activeProfileId)
  );
  const [downloads, setDownloads] = useState<DownloadItem[]>(() =>
    normalizeStoredDownloads(getStoredDownloads(accountKey, activeProfileId))
  );
  const downloadsRef = useRef<DownloadItem[]>(downloads);
  downloadsRef.current = downloads;
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    getStoredNotifications(accountKey)
  );
  const notificationsRef = useRef<NotificationItem[]>(notifications);
  notificationsRef.current = notifications;
  const [accountBlocked, setAccountBlocked] = useState<boolean>(false);
  const [settings, setSettings] = useState<AppSettings>(() => getStoredSettings(accountKey));
  const settingsRef = useRef<AppSettings>(settings);
  settingsRef.current = settings;
  const [recentSearches, setRecentSearches] = useState<string[]>(() =>
    getStoredRecentSearches(accountKey, activeProfileId)
  );
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPlan>(() =>
    getStoredPlan(accountKey)
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(() =>
    getStoredPaymentMethods(accountKey)
  );
  const [reminders, setReminders] = useState<string[]>(() =>
    getStoredReminders(accountKey, activeProfileId)
  );

  // Preserved Search State (restored on back navigation)
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchTmdbResults, setSearchTmdbResults] = useState<Movie[]>([]);

  // Remove any legacy pre-v2 unscoped keys on mount so accounts never inherit shared device state
  useEffect(() => {
    purgeLegacyUnscopedStorage();
  }, []);

  const loadProfileScopeIntoState = useCallback((targetAccountKey: string, targetProfileId: string) => {
    const rtdbProf = rtdbUserDataRef.current?.profileData?.[targetProfileId];

    const nextWatchlist = Array.isArray(rtdbProf?.watchlist)
      ? rtdbProf.watchlist
      : getStoredMyList(targetAccountKey, targetProfileId);
    setWatchlist(nextWatchlist);
    saveMyList(nextWatchlist, targetAccountKey, targetProfileId);

    const nextCwRaw = Array.isArray(rtdbProf?.continueWatching)
      ? rtdbProf.continueWatching
      : getStoredContinueWatching(targetAccountKey, targetProfileId);
    const nextCw = nextCwRaw.filter(
      (item: WatchProgress) => !item.posterUrl?.includes('images.unsplash.com')
    );
    setContinueWatching(nextCw);
    saveContinueWatching(nextCw, targetAccountKey, targetProfileId);

    const nextDownloads = normalizeStoredDownloads(
      Array.isArray(rtdbProf?.downloads)
        ? rtdbProf.downloads
        : getStoredDownloads(targetAccountKey, targetProfileId)
    );
    setDownloads(nextDownloads);
    downloadsRef.current = nextDownloads;
    saveDownloads(nextDownloads, targetAccountKey, targetProfileId);

    const nextSearches = Array.isArray(rtdbProf?.recentSearches)
      ? rtdbProf.recentSearches
      : getStoredRecentSearches(targetAccountKey, targetProfileId);
    setRecentSearches(nextSearches);
    saveRecentSearches(nextSearches, targetAccountKey, targetProfileId);

    const nextReminders = Array.isArray(rtdbProf?.reminders)
      ? rtdbProf.reminders
      : getStoredReminders(targetAccountKey, targetProfileId);
    setReminders(nextReminders);
    saveReminders(nextReminders, targetAccountKey, targetProfileId);

    setSearchQuery('');
    setSearchTmdbResults([]);
  }, []);

  const loadAccountScopeIntoState = useCallback(
    (targetAccountKey: string) => {
      const nextProfiles = getStoredProfiles(targetAccountKey);
      const nextActiveId = getStoredActiveProfileId(targetAccountKey);
      setProfiles(nextProfiles);
      setActiveProfileId(nextActiveId);
      activeProfileIdRef.current = nextActiveId;

      const nextSettings = getStoredSettings(targetAccountKey);
      setSettings(nextSettings);
      settingsRef.current = nextSettings;
      setCurrentPlan(getStoredPlan(targetAccountKey));
      setPaymentMethods(getStoredPaymentMethods(targetAccountKey));

      const nextNotifs = getStoredNotifications(targetAccountKey);
      setNotifications(nextNotifs);
      notificationsRef.current = nextNotifs;

      loadProfileScopeIntoState(targetAccountKey, nextActiveId);
    },
    [loadProfileScopeIntoState]
  );

  // Reload isolated state whenever active accountKey changes
  useEffect(() => {
    accountKeyRef.current = accountKey;
    loadAccountScopeIntoState(accountKey);
  }, [accountKey, loadAccountScopeIntoState]);

  // Modals & Live Public Config
  const [isCastOpen, setIsCastOpen] = useState(false);
  const [connectedCastDevice, setConnectedCastDevice] = useState<string | null>(null);
  const [showStartupDisclaimer, setShowStartupDisclaimer] = useState(true);
  const [siteConfig, setSiteConfig] = useState<SitePublicConfig>({
    disclaimerEnabled: DEFAULT_DISCLAIMER_CONFIG.disclaimerEnabled,
    disclaimerTitle: DEFAULT_DISCLAIMER_CONFIG.disclaimerTitle,
    disclaimerMessage: DEFAULT_DISCLAIMER_CONFIG.disclaimerMessage,
    whatsappButtonLabel: DEFAULT_DISCLAIMER_CONFIG.whatsappButtonLabel,
    whatsappGroupUrl: DEFAULT_DISCLAIMER_CONFIG.whatsappGroupUrl,
    whatsappPrefillMessage: DEFAULT_DISCLAIMER_CONFIG.whatsappPrefillMessage,
    siteAnnouncement: '',
    pinnedFeaturedMovieId: '',
    updatedAt: 0,
  });

  const registerMoviesInCache = useCallback((moviesToCache: Movie[]) => {
    if (!moviesToCache || moviesToCache.length === 0) return;
    setExtraMovieCache((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of moviesToCache) {
        if (m && m.id && !next[m.id]) {
          next[m.id] = m;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const movieDirectoryRef = useRef<Record<string, Movie>>({});

  const syncIncomingNotifications = useCallback(
    (incoming: NotificationItem[], _options?: { showToastForNew?: boolean }) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      const scope = accountKeyRef.current;
      const dismissedIds = getDismissedNotificationIds(scope);
      const { merged, newlyAdded } = mergeIncomingNotifications({
        current: notificationsRef.current,
        incoming,
        dismissedIds,
        maxItems: 40,
      });

      if (newlyAdded.length > 0 || merged.length !== notificationsRef.current.length) {
        notificationsRef.current = merged;
        setNotifications(merged);
        saveNotifications(merged, scope);
        if (authUserRef.current) {
          writeUserRtdbField(authUserRef.current.uid, 'notifications', merged);
        }
      }

      if (newlyAdded.length > 0) {
        const missingMovie = newlyAdded.some(
          (n) => n.movieId && !movieDirectoryRef.current[n.movieId]
        );
        if (missingMovie) {
          invalidateTmdbCatalogCache();
          void fetchTmdbCatalog(true)
            .then((fresh) => {
              setCatalog(fresh);
              if (fresh.all.length > 0) registerMoviesInCache(fresh.all);
            })
            .catch(() => {});
        }
      }
    },
    [registerMoviesInCache]
  );

  // Load Live TMDB Catalog & Active Notifications on Startup
  useEffect(() => {
    let active = true;
    setCatalogLoading(true);
    fetchTmdbCatalog()
      .then((data) => {
        if (!active) return;
        setCatalog(data);
        if (data.all.length > 0) {
          registerMoviesInCache(data.all);
        }
        setSelectedMovie((prev) => prev || data.hero || data.all[0] || null);

        if (data.notifications && data.notifications.length > 0) {
          syncIncomingNotifications(data.notifications, { showToastForNew: false });
        }
      })
      .catch(() => {
        // Catalog stays null if TMDB fails
      })
      .finally(() => {
        if (active) setCatalogLoading(false);
      });

    void fetchActiveNotifications().then((activeNotifs) => {
      if (active && activeNotifs.length > 0) {
        syncIncomingNotifications(activeNotifs, { showToastForNew: false });
      }
    });

    return () => {
      active = false;
    };
  }, [registerMoviesInCache, syncIncomingNotifications]);

  // Poll /api/notifications periodically so newly uploaded movies notify active users automatically
  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchActiveNotifications().then((list) => {
        if (list.length > 0) {
          syncIncomingNotifications(list, { showToastForNew: true });
        }
      });
    }, 20000);
    return () => window.clearInterval(interval);
  }, [syncIncomingNotifications]);

  // Load Public Site Config (Startup Disclaimer & Featured Pin) on Startup
  useEffect(() => {
    let active = true;
    fetchPublicSiteConfig().then((cfg) => {
      if (active && cfg) {
        setSiteConfig(cfg);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Redirect away cleanly if a non-admin session lands on admin screen
  useEffect(() => {
    if (currentScreen === 'admin' && !isAdminUser) {
      setCurrentScreen('home');
      setActiveTab('home');
    }
  }, [currentScreen, isAdminUser]);

  // Apply Admin Pinned Featured Title override cleanly if configured
  const effectiveCatalog = useMemo<TmdbCatalog | null>(() => {
    if (!catalog) return null;
    const pinnedId = siteConfig.pinnedFeaturedMovieId?.trim();
    if (!pinnedId) return catalog;
    const pinnedMovie = catalog.all.find((m) => m.id === pinnedId);
    if (!pinnedMovie) return catalog;
    const filteredBanners = catalog.featuredBanners.filter((b) => b.id !== pinnedMovie.id);
    return {
      ...catalog,
      hero: pinnedMovie,
      featuredBanners: [pinnedMovie, ...filteredBanners].slice(0, 5),
    };
  }, [catalog, siteConfig.pinnedFeaturedMovieId]);

  // Unified directory lookup for all TMDB movies seen across catalog, search, details, and lists
  const movieDirectory = useMemo<Record<string, Movie>>(() => {
    const map: Record<string, Movie> = { ...extraMovieCache };
    if (catalog) {
      for (const m of catalog.all) {
        map[m.id] = m;
      }
      if (catalog.hero) map[catalog.hero.id] = catalog.hero;
      if (catalog.tvHero) map[catalog.tvHero.id] = catalog.tvHero;
    }
    if (selectedMovie) {
      map[selectedMovie.id] = selectedMovie;
    }
    movieDirectoryRef.current = map;
    return map;
  }, [catalog, extraMovieCache, selectedMovie]);

  // Complete Google Sign-In redirect flow if returning from accounts.google.com
  useEffect(() => {
    let active = true;
    consumeGoogleRedirectResult().then(async (outcome) => {
      if (!active || !outcome) return;
      if (outcome.status === 'signed-in') {
        redirectHandledRef.current = true;
        if (isAdminEmail(outcome.email)) {
          try {
            const idToken = await outcome.user.getIdToken();
            await exchangeFirebaseAdminSession(idToken);
          } catch {
            // Best-effort token exchange
          }
        }
        const alreadyOnboarded = Boolean(getStoredUserSession()?.onboardingComplete);
        const shouldSelectProfile = outcome.flow === 'register' && !alreadyOnboarded;
        saveUserSession({
          identifier: outcome.email,
          uid: outcome.user.uid,
          displayName: outcome.displayName,
          onboardingComplete: !shouldSelectProfile,
          signedInAt: Date.now(),
        });
        setSessionIdentifier(outcome.email);
        setSessionUid(outcome.user.uid);
        setAuthErrorBanner(null);
        setCurrentScreen(shouldSelectProfile ? 'profile-select' : 'home');
        if (!shouldSelectProfile) {
          setActiveTab('home');
        }
      } else if (outcome.status === 'error') {
        setAuthErrorBanner(outcome.message);
        setCurrentScreen(outcome.flow === 'register' ? 'register' : 'login');
      }
    });
    return () => {
      active = false;
    };
  }, []);

  // Sync Firebase Auth & Realtime Database (isolated per uid AND per profileId)
  useEffect(() => {
    let unsubRtdb: (() => void) | null = null;

    const unsubAuth = subscribeToAuthState((user) => {
      setAuthUser(user);
      authUserRef.current = user;

      if (unsubRtdb) {
        unsubRtdb();
        unsubRtdb = null;
      }

      if (user) {
        const pendingFlow = getPendingGoogleAuthFlow();
        const isRegistering =
          pendingFlow === 'register' ||
          currentScreenRef.current === 'register' ||
          currentScreenRef.current === 'profile-select' ||
          currentScreenRef.current === 'profile-manage';

        if (!getStoredUserSession() && !isRegistering) {
          const fallbackId = user.email || user.displayName || user.uid;
          saveUserSession({
            identifier: fallbackId,
            uid: user.uid,
            displayName: user.displayName || undefined,
            onboardingComplete: true,
            signedInAt: Date.now(),
          });
          setSessionIdentifier(fallbackId);
          setSessionUid(user.uid);
        } else {
          if (user.email) setSessionIdentifier(user.email);
          setSessionUid(user.uid);
        }

        void user
          .getIdToken()
          .then(async (idToken) => {
            const status = await syncUserDirectorySession(idToken);
            if (status) {
              setAccountBlocked(status.isBlocked && !isAdminEmail(user.email));
              if (status.isPremium) {
                const vip = SUBSCRIPTION_PLANS.find((p) => p.id === 'monthly');
                if (vip) setCurrentPlan(vip);
              }
            }
            if (isAdminEmail(user.email) && !getStoredAdminToken()) {
              return exchangeFirebaseAdminSession(idToken);
            }
            return false;
          })
          .catch(() => {});

        if (currentScreenRef.current === 'welcome' && !redirectHandledRef.current) {
          setCurrentScreen('home');
          setActiveTab('home');
        }

        // Seed brand-new Firebase account strictly with clean empty personal defaults (never copy device leftovers)
        void ensureUserRtdbSeeded(
          user.uid,
          createFreshAccountSeedData(INITIAL_PROFILES, INITIAL_SETTINGS)
        );

        const targetScope = normalizeAccountScopeKey({
          uid: user.uid,
          email: user.email,
        });

        unsubRtdb = subscribeToUserRtdb(user.uid, (data) => {
          if (authUserRef.current?.uid !== user.uid) return;
          rtdbUserDataRef.current = data;

          if (Array.isArray(data.profiles) && data.profiles.length > 0) {
            setProfiles(data.profiles);
            saveProfiles(data.profiles, targetScope);
          }

          let effectiveProfileId = activeProfileIdRef.current || 'p1';
          if (
            data.activeProfileId &&
            currentScreenRef.current !== 'profile-select' &&
            currentScreenRef.current !== 'profile-manage'
          ) {
            effectiveProfileId = data.activeProfileId;
            setActiveProfileId(data.activeProfileId);
            activeProfileIdRef.current = data.activeProfileId;
            saveActiveProfileId(data.activeProfileId, targetScope);
          }

          const profileNode = data.profileData?.[effectiveProfileId];
          const allowLegacyRootFallback = !data.profileData && effectiveProfileId === 'p1';

          const rtdbWatchlist = Array.isArray(profileNode?.watchlist)
            ? profileNode.watchlist
            : allowLegacyRootFallback && Array.isArray(data.watchlist)
              ? data.watchlist
              : null;
          if (rtdbWatchlist) {
            setWatchlist(rtdbWatchlist);
            saveMyList(rtdbWatchlist, targetScope, effectiveProfileId);
          }

          const rtdbCw = Array.isArray(profileNode?.continueWatching)
            ? profileNode.continueWatching
            : allowLegacyRootFallback && Array.isArray(data.continueWatching)
              ? data.continueWatching
              : null;
          if (rtdbCw) {
            const cleanCw = rtdbCw.filter(
              (item: WatchProgress) => !item.posterUrl?.includes('images.unsplash.com')
            );
            setContinueWatching(cleanCw);
            saveContinueWatching(cleanCw, targetScope, effectiveProfileId);
          }

          const rtdbDownloads = Array.isArray(profileNode?.downloads)
            ? profileNode.downloads
            : allowLegacyRootFallback && Array.isArray(data.downloads)
              ? data.downloads
              : null;
          if (rtdbDownloads) {
            const normalized = normalizeStoredDownloads(rtdbDownloads);
            setDownloads(normalized);
            downloadsRef.current = normalized;
            saveDownloads(normalized, targetScope, effectiveProfileId);
          }

          const rtdbSearches = Array.isArray(profileNode?.recentSearches)
            ? profileNode.recentSearches
            : allowLegacyRootFallback && Array.isArray(data.recentSearches)
              ? data.recentSearches
              : null;
          if (rtdbSearches) {
            setRecentSearches(rtdbSearches);
            saveRecentSearches(rtdbSearches, targetScope, effectiveProfileId);
          }

          const rtdbReminders = Array.isArray(profileNode?.reminders)
            ? profileNode.reminders
            : allowLegacyRootFallback && Array.isArray(data.reminders)
              ? data.reminders
              : null;
          if (rtdbReminders) {
            setReminders(rtdbReminders);
            saveReminders(rtdbReminders, targetScope, effectiveProfileId);
          }

          if (Array.isArray(data.notifications)) {
            const cleanNotifs = data.notifications.filter(
              (n: NotificationItem) => !n.thumbnailUrl?.includes('images.unsplash.com')
            );
            if (cleanNotifs.length > 0) {
              const dismissed = getDismissedNotificationIds(targetScope);
              const { merged } = mergeIncomingNotifications({
                current: notificationsRef.current,
                incoming: cleanNotifs,
                dismissedIds: dismissed,
                maxItems: 40,
              });
              setNotifications(merged);
              saveNotifications(merged, targetScope);
            }
          }
          if (data.settings) {
            setSettings(data.settings);
            saveSettings(data.settings, targetScope);
          }
          if (data.planId) {
            const matched = SUBSCRIPTION_PLANS.find((p) => p.id === data.planId);
            if (matched) {
              setCurrentPlan(matched);
              savePlan(data.planId, targetScope);
            }
          }
          if (Array.isArray(data.paymentMethods)) {
            setPaymentMethods(data.paymentMethods);
            savePaymentMethods(data.paymentMethods, targetScope);
          }
        });
      }
    });

    return () => {
      unsubAuth();
      if (unsubRtdb) unsubRtdb();
    };
  }, []);

  const currentProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  const syncActiveTab = useCallback((screen: ScreenType) => {
    if (screen === 'home') setActiveTab('home');
    else if (screen === 'tv-shows') setActiveTab('tv-shows');
    else if (screen === 'vjs') setActiveTab('vjs');
    else if (screen === 'games') setActiveTab('tv-shows');
    else if (screen === 'new-and-hot') setActiveTab('vjs');
    else if (screen === 'downloads') setActiveTab('downloads');
    else if (screen === 'my-netflix') setActiveTab('my-netflix');
  }, []);

  // Sync browser / mobile hardware back button with in-app screen history
  useEffect(() => {
    try {
      window.history.replaceState({ screen: 'splash' }, '', window.location.href);
    } catch {
      // Safe no-op
    }

    const handlePopState = () => {
      setScreenHistory((prev) => {
        if (prev.length > 0) {
          const target = prev[prev.length - 1];
          setCurrentScreen(target);
          syncActiveTab(target);
          return prev.slice(0, -1);
        }
        setCurrentScreen('home');
        setActiveTab('home');
        return [];
      });
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [syncActiveTab]);

  const navigateTo = (screen: ScreenType) => {
    if (screen === currentScreen) return;
    try {
      window.history.pushState({ screen }, '', window.location.href);
    } catch {
      // Safe no-op
    }
    setScreenHistory((prev) => [...prev, currentScreen]);
    setCurrentScreen(screen);
    syncActiveTab(screen);
  };

  const handleBack = () => {
    if (screenHistory.length > 0) {
      const prev = screenHistory[screenHistory.length - 1];
      setScreenHistory((prevHist) => prevHist.slice(0, -1));
      setCurrentScreen(prev);
      syncActiveTab(prev);
    } else {
      navigateTo('home');
    }
  };

  const handleTabChange = (tab: MainTabType) => {
    setActiveTab(tab);
    if (tab === 'home') navigateTo('home');
    if (tab === 'tv-shows') navigateTo('tv-shows');
    if (tab === 'vjs') navigateTo('vjs');
    if (tab === 'games') navigateTo('tv-shows');
    if (tab === 'new-and-hot') navigateTo('vjs');
    if (tab === 'downloads') navigateTo('downloads');
    if (tab === 'my-netflix') navigateTo('my-netflix');
  };

  const handleToggleWatchlist = (movieId: string) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const updated = toggleMyList(watchlist, movieId);
    setWatchlist(updated);
    saveMyList(updated, scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'watchlist', updated);
    }
  };

  const handleProgressUpdate = useCallback((progress: WatchProgress) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const fbUid = authUserRef.current?.uid;
    setContinueWatching((prev) => {
      const updated = recordWatchProgress(prev, progress);
      saveContinueWatching(updated, scope, profileId);
      if (fbUid) {
        void writeProfileRtdbField(fbUid, profileId, 'continueWatching', updated);
      }
      return updated;
    });
  }, []);

  const handleSaveProfile = (profile: Profile) => {
    const scope = accountKeyRef.current;
    const exists = profiles.some((p) => p.id === profile.id);
    const updated = exists
      ? profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...profiles, profile];
    setProfiles(updated);
    saveProfiles(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'profiles', updated);
  };

  const handleDeleteProfile = (profileId: string) => {
    const scope = accountKeyRef.current;
    const updated = profiles.filter((p) => p.id !== profileId);
    clearProfileScopedStorage(scope, profileId);
    setProfiles(updated);
    saveProfiles(updated, scope);
    if (authUserRef.current) {
      void writeUserRtdbField(authUserRef.current.uid, 'profiles', updated);
      void deleteProfileRtdbData(authUserRef.current.uid, profileId);
    }
    if (activeProfileIdRef.current === profileId && updated.length > 0) {
      const nextId = updated[0].id;
      setActiveProfileId(nextId);
      activeProfileIdRef.current = nextId;
      saveActiveProfileId(nextId, scope);
      loadProfileScopeIntoState(scope, nextId);
      if (authUserRef.current) {
        void writeUserRtdbField(authUserRef.current.uid, 'activeProfileId', nextId);
      }
    }
  };

  const handleSelectProfile = (profile: Profile) => {
    const scope = accountKeyRef.current;
    setActiveProfileId(profile.id);
    activeProfileIdRef.current = profile.id;
    saveActiveProfileId(profile.id, scope);
    markOnboardingComplete();
    loadProfileScopeIntoState(scope, profile.id);
    if (authUserRef.current) {
      void writeUserRtdbField(authUserRef.current.uid, 'activeProfileId', profile.id);
    }
    navigateTo('home');
  };

  const patchDownloadItemForScope = useCallback(
    (
      targetAccountKey: string,
      targetProfileId: string,
      targetUid: string | undefined,
      downloadId: string,
      patch: Partial<DownloadItem>
    ) => {
      const isCurrentScope =
        accountKeyRef.current === targetAccountKey &&
        activeProfileIdRef.current === targetProfileId;

      if (isCurrentScope) {
        setDownloads((prev) => {
          let exists = false;
          const updated = prev.map((d) => {
            if (d.id === downloadId) {
              exists = true;
              return { ...d, ...patch };
            }
            return d;
          });
          if (!exists) return prev;
          downloadsRef.current = updated;
          saveDownloads(updated, targetAccountKey, targetProfileId);
          if (targetUid) {
            void writeProfileRtdbField(targetUid, targetProfileId, 'downloads', updated);
          }
          return updated;
        });
      } else {
        // Safely update that background scope without touching active user's React state
        const stored = getStoredDownloads(targetAccountKey, targetProfileId);
        let exists = false;
        const updated = stored.map((d) => {
          if (d.id === downloadId) {
            exists = true;
            return { ...d, ...patch };
          }
          return d;
        });
        if (!exists) return;
        saveDownloads(updated, targetAccountKey, targetProfileId);
        if (targetUid) {
          void writeProfileRtdbField(targetUid, targetProfileId, 'downloads', updated);
        }
      }
    },
    []
  );

  const handleDownloadMovie = (movie: Movie, episode?: Episode) => {
    registerMoviesInCache([movie]);
    const targetAccountKey = accountKeyRef.current;
    const targetProfileId = activeProfileIdRef.current;
    const targetUid = authUserRef.current?.uid;
    const downloadId = episode ? `dl-${episode.id}` : `dl-${movie.id}`;
    const blobStorageKey = buildScopedDownloadBlobKey(
      targetAccountKey,
      targetProfileId,
      downloadId
    );
    const existing = downloadsRef.current.find((d) => d.id === downloadId);

    if (existing) {
      if (existing.status === 'completed') {
        void saveCompletedDownloadToDevice(existing, blobStorageKey);
        return;
      }
      if (existing.status === 'paused' || existing.status === 'failed') {
        handleResumeDownload(downloadId);
      }
      return;
    }

    const streamUrl = episode?.videoUrl || movie.videoUrl || '';
    const fileName = buildDownloadFileName(movie.title, episode);
    const willHydrateForStream = !streamUrl && !episode;

    const newItem: DownloadItem = {
      id: downloadId,
      movieId: movie.id,
      episodeId: episode?.id,
      title: movie.title,
      subTitle: episode
        ? `S${episode.seasonNumber}:E${episode.episodeNumber} · ${episode.title}`
        : movie.vjName
          ? `${movie.durationOrSeasons} · ${movie.vjName}`
          : movie.durationOrSeasons,
      posterUrl: movie.posterUrl,
      fileSizeMb: 0,
      bytesDownloaded: 0,
      videoUrl: streamUrl,
      fileName,
      status: streamUrl || willHydrateForStream ? 'pending' : 'failed',
      errorMessage: streamUrl || willHydrateForStream ? undefined : 'Stream URL unavailable for this title.',
      progress: 0,
      downloadedAt: Date.now(),
    };

    const newDownloads = [newItem, ...downloadsRef.current];
    setDownloads(newDownloads);
    downloadsRef.current = newDownloads;
    saveDownloads(newDownloads, targetAccountKey, targetProfileId);
    if (targetUid) {
      void writeProfileRtdbField(targetUid, targetProfileId, 'downloads', newDownloads);
    }

    if (streamUrl) {
      void startRealDownloadTask({
        id: downloadId,
        storageKey: blobStorageKey,
        videoUrl: streamUrl,
        fileName,
        onPatch: (patch) =>
          patchDownloadItemForScope(
            targetAccountKey,
            targetProfileId,
            targetUid,
            downloadId,
            patch
          ),
      });
    } else if (willHydrateForStream) {
      fetchTmdbMovieDetails(movie)
        .then((hydrated) => {
          registerMoviesInCache([hydrated]);
          const resolvedEp = hydrated.episodes?.[0];
          const resolvedUrl = resolvedEp?.videoUrl || hydrated.videoUrl || '';
          if (!resolvedUrl) {
            patchDownloadItemForScope(
              targetAccountKey,
              targetProfileId,
              targetUid,
              downloadId,
              {
                status: 'failed',
                errorMessage: 'Stream URL unavailable for this title.',
              }
            );
            return;
          }
          const resolvedFileName = buildDownloadFileName(hydrated.title, resolvedEp);
          patchDownloadItemForScope(
            targetAccountKey,
            targetProfileId,
            targetUid,
            downloadId,
            {
              videoUrl: resolvedUrl,
              fileName: resolvedFileName,
            }
          );
          void startRealDownloadTask({
            id: downloadId,
            storageKey: blobStorageKey,
            videoUrl: resolvedUrl,
            fileName: resolvedFileName,
            onPatch: (patch) =>
              patchDownloadItemForScope(
                targetAccountKey,
                targetProfileId,
                targetUid,
                downloadId,
                patch
              ),
          });
        })
        .catch(() => {
          patchDownloadItemForScope(
            targetAccountKey,
            targetProfileId,
            targetUid,
            downloadId,
            {
              status: 'failed',
              errorMessage: 'Could not load stream details for download.',
            }
          );
        });
    }
  };

  const handlePauseDownload = (id: string) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const uid = authUserRef.current?.uid;
    pauseDownloadTask(buildScopedDownloadBlobKey(scope, profileId, id));
    patchDownloadItemForScope(scope, profileId, uid, id, { status: 'paused' });
  };

  const handleResumeDownload = (id: string) => {
    const targetAccountKey = accountKeyRef.current;
    const targetProfileId = activeProfileIdRef.current;
    const targetUid = authUserRef.current?.uid;
    const item = downloadsRef.current.find((d) => d.id === id);
    if (!item) return;
    const fallbackMovie = movieDirectory[item.movieId];
    const fallbackEp =
      item.episodeId && fallbackMovie?.episodes
        ? fallbackMovie.episodes.find((ep) => ep.id === item.episodeId)
        : undefined;
    const streamUrl = item.videoUrl || fallbackEp?.videoUrl || fallbackMovie?.videoUrl || '';
    const fileName = item.fileName || buildDownloadFileName(item.title, fallbackEp);

    if (!streamUrl) {
      patchDownloadItemForScope(targetAccountKey, targetProfileId, targetUid, id, {
        status: 'failed',
        errorMessage: 'Stream URL unavailable. Open title details to refresh.',
      });
      return;
    }

    const blobStorageKey = buildScopedDownloadBlobKey(targetAccountKey, targetProfileId, id);
    void startRealDownloadTask({
      id,
      storageKey: blobStorageKey,
      videoUrl: streamUrl,
      fileName,
      onPatch: (patch) =>
        patchDownloadItemForScope(targetAccountKey, targetProfileId, targetUid, id, patch),
    });
  };

  const handleSaveDownloadToDevice = (item: DownloadItem) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const uid = authUserRef.current?.uid;
    const blobStorageKey = buildScopedDownloadBlobKey(scope, profileId, item.id);
    void saveCompletedDownloadToDevice(item, blobStorageKey).then((ok) => {
      if (ok && !item.savedToDevice) {
        patchDownloadItemForScope(scope, profileId, uid, item.id, { savedToDevice: true });
      }
    });
  };

  const handleDeleteDownload = (id: string) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    cancelDownloadTask(buildScopedDownloadBlobKey(scope, profileId, id));
    const updated = downloadsRef.current.filter((d) => d.id !== id);
    setDownloads(updated);
    downloadsRef.current = updated;
    saveDownloads(updated, scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'downloads', updated);
    }
  };

  const handleAddRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const filtered = recentSearches.filter((s) => s.toLowerCase() !== query.toLowerCase());
    const updated = [query.trim(), ...filtered].slice(0, 10);
    setRecentSearches(updated);
    saveRecentSearches(updated, scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'recentSearches', updated);
    }
  };

  const handleClearRecentSearches = () => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    setRecentSearches([]);
    saveRecentSearches([], scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'recentSearches', []);
    }
  };

  const handleRemoveRecentSearch = (query: string) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const updated = recentSearches.filter((s) => s !== query);
    setRecentSearches(updated);
    saveRecentSearches(updated, scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'recentSearches', updated);
    }
  };

  const handleUpdatePlan = (planId: string) => {
    const scope = accountKeyRef.current;
    const matched = SUBSCRIPTION_PLANS.find((p) => p.id === planId);
    if (matched) {
      setCurrentPlan(matched);
      savePlan(planId, scope);
      if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'planId', planId);
    }
  };

  const handleAddPaymentMethod = (method: PaymentMethodItem) => {
    const scope = accountKeyRef.current;
    const updated = [...paymentMethods, method];
    setPaymentMethods(updated);
    savePaymentMethods(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'paymentMethods', updated);
  };

  const handleDeletePaymentMethod = (id: string) => {
    const scope = accountKeyRef.current;
    const updated = paymentMethods.filter((m) => m.id !== id);
    setPaymentMethods(updated);
    savePaymentMethods(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'paymentMethods', updated);
  };

  const handleSetDefaultPaymentMethod = (id: string) => {
    const scope = accountKeyRef.current;
    const updated = paymentMethods.map((m) => ({
      ...m,
      isDefault: m.id === id,
    }));
    setPaymentMethods(updated);
    savePaymentMethods(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'paymentMethods', updated);
  };

  const handleMarkAllRead = () => {
    const scope = accountKeyRef.current;
    const updated = notificationsRef.current.map((n) => ({ ...n, read: true }));
    notificationsRef.current = updated;
    setNotifications(updated);
    saveNotifications(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'notifications', updated);
  };

  const handleMarkNotificationRead = (notificationId: string) => {
    const scope = accountKeyRef.current;
    const updated = notificationsRef.current.map((n) =>
      n.id === notificationId ? { ...n, read: true } : n
    );
    notificationsRef.current = updated;
    setNotifications(updated);
    saveNotifications(updated, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'notifications', updated);
  };

  const handleClearNotifications = () => {
    const scope = accountKeyRef.current;
    const currentIds = notificationsRef.current.map((n) => n.id);
    if (currentIds.length > 0) {
      const prevDismissed = getDismissedNotificationIds(scope);
      saveDismissedNotificationIds([...prevDismissed, ...currentIds], scope);
    }
    notificationsRef.current = [];
    setNotifications([]);
    saveNotifications([], scope);
    saveNotificationsCleared(true, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'notifications', []);
  };

  const handleToggleReminder = (movieId: string) => {
    const scope = accountKeyRef.current;
    const profileId = activeProfileIdRef.current;
    const updated = reminders.includes(movieId)
      ? reminders.filter((id) => id !== movieId)
      : [...reminders, movieId];
    setReminders(updated);
    saveReminders(updated, scope, profileId);
    if (authUserRef.current) {
      void writeProfileRtdbField(authUserRef.current.uid, profileId, 'reminders', updated);
    }
  };

  const handleUpdateSettings = (newSettings: AppSettings) => {
    const scope = accountKeyRef.current;
    setSettings(newSettings);
    saveSettings(newSettings, scope);
    if (authUserRef.current) writeUserRtdbField(authUserRef.current.uid, 'settings', newSettings);
  };

  const handleSignOut = async () => {
    pauseAllActiveDownloads();
    try {
      await signOutFirebase();
    } catch {
      // Ignore signOut network errors on exit
    }
    clearSession();
    rtdbUserDataRef.current = null;
    setAuthUser(null);
    authUserRef.current = null;
    setSessionIdentifier(null);
    setSessionUid(null);
    setSearchQuery('');
    setSearchTmdbResults([]);
    navigateTo('exit');
  };

  const handleSelectMovie = (movie: Movie, audioLang?: string, autoPlay = false) => {
    registerMoviesInCache([movie]);
    setSelectedMovie(movie);
    setSelectedEpisode(movie.episodes ? movie.episodes[0] : undefined);
    setPlayerAudioLang(
      audioLang || (movie.vjName ? `Luganda (${movie.vjName})` : 'English [Original]')
    );
    setDetailsAutoPlay(autoPlay);
    setIsLoadingDetails(true);
    navigateTo('details');

    const reqId = ++detailRequestIdRef.current;
    fetchTmdbMovieDetails(movie)
      .then((hydrated) => {
        if (reqId !== detailRequestIdRef.current) return;
        setSelectedMovie(hydrated);
        if (!audioLang && hydrated.vjName) {
          setPlayerAudioLang(`Luganda (${hydrated.vjName})`);
        }
        registerMoviesInCache([hydrated, ...(hydrated.similarMovies || [])]);
        if (hydrated.episodes && hydrated.episodes.length > 0) {
          setSelectedEpisode((prev) => {
            if (!prev) return hydrated.episodes![0];
            const match = hydrated.episodes!.find(
              (ep) =>
                ep.id === prev.id ||
                (ep.seasonNumber === prev.seasonNumber && ep.episodeNumber === prev.episodeNumber)
            );
            return match || prev;
          });
        }
      })
      .catch(() => {
        // Keep summary metadata if details request fails
      })
      .finally(() => {
        if (reqId === detailRequestIdRef.current) {
          setIsLoadingDetails(false);
        }
      });
  };

  const handlePlayMovie = (movie: Movie, episode?: Episode, audioLang?: string) => {
    registerMoviesInCache([movie]);
    setSelectedMovie(movie);
    setSelectedEpisode(episode || (movie.episodes ? movie.episodes[0] : undefined));
    setPlayerAudioLang(
      audioLang || (movie.vjName ? `Luganda (${movie.vjName})` : 'English [Original]')
    );
    setDetailsAutoPlay(true);
    navigateTo('details');
  };

  const handleOpenNotification = async (item: NotificationItem) => {
    handleMarkNotificationRead(item.id);

    if (!item.movieId) {
      navigateTo('notifications');
      return;
    }

    const cached = movieDirectoryRef.current[item.movieId];
    if (cached) {
      handleSelectMovie(cached);
      return;
    }

    try {
      invalidateTmdbCatalogCache();
      const freshCatalog = await fetchTmdbCatalog(true);
      setCatalog(freshCatalog);
      if (freshCatalog.all.length > 0) registerMoviesInCache(freshCatalog.all);
      const found = freshCatalog.all.find((m) => m.id === item.movieId);
      if (found) {
        handleSelectMovie(found);
        return;
      }
    } catch {
      // Fallback below
    }

    const cleanTitle = item.title.replace(/^New Upload:\s*/i, '').trim() || item.title;
    handleSelectMovie({
      id: item.movieId,
      title: cleanTitle,
      type: 'movie',
      year: new Date().getFullYear(),
      ageRating: '13+',
      quality: '4K Ultra HD',
      durationOrSeasons: 'Feature',
      genres: ['Action'],
      synopsis: item.message,
      matchScore: 98,
      posterUrl: item.thumbnailUrl,
      backdropUrl: item.thumbnailUrl,
      cast: [],
    });
  };

  const handleCategoryNavigate = (category: CategoryTab) => {
    if (category === 'Home') {
      navigateTo('home');
    } else if (category === 'TV Shows') {
      navigateTo('tv-shows');
    } else if (category === 'Movies') {
      setBrowseTypeParam('movie');
      navigateTo('browse');
    } else if (category === 'VJs') {
      navigateTo('vjs');
    }
  };

  const unreadNotificationsCount = notifications.filter((n) => !n.read).length;

  const showBottomNav = [
    'home',
    'tv-shows',
    'vjs',
    'games',
    'new-and-hot',
    'downloads',
    'my-netflix',
    'browse',
    'genres',
    'search',
    'my-list',
  ].includes(currentScreen);

  const showDesktopSideNav = [
    ...['home', 'tv-shows', 'vjs', 'games', 'new-and-hot', 'downloads', 'my-netflix', 'browse', 'genres', 'search', 'my-list'],
    'details',
    'notifications',
    'subscription',
    'payment',
    'settings',
    ...(isAdminUser ? ['admin'] : []),
  ].includes(currentScreen);

  return (
    <MobileFrame>
      {/* 1. Splash Screen */}
      {currentScreen === 'splash' && (
        <SplashScreen
          onFinish={() =>
            navigateTo(
              resolvePostSplashScreen({
                hasAuthUser: Boolean(authUserRef.current),
                storedSession: getStoredUserSession(),
              })
            )
          }
        />
      )}

      {/* 2. Welcome Screen */}
      {currentScreen === 'welcome' && (
        <WelcomeScreen
          onGetStarted={() => {
            setAuthErrorBanner(null);
            navigateTo('register');
          }}
          onSignIn={() => {
            setAuthErrorBanner(null);
            navigateTo('login');
          }}
          backdropPosters={Array.from(
            new Set(
              (catalog?.all || [])
                .map((m) => m.backdropUrl || m.posterUrl)
                .filter(Boolean)
            )
          ).slice(0, 24)}
        />
      )}

      {/* 3. Sign In Screen */}
      {currentScreen === 'login' && (
        <LoginScreen
          initialError={authErrorBanner}
          onSuccess={(identifier, uid) => {
            setAuthErrorBanner(null);
            rtdbUserDataRef.current = null;
            const nextScope = normalizeAccountScopeKey({ uid, identifier });
            saveUserSession({
              identifier,
              uid,
              onboardingComplete: true,
              signedInAt: Date.now(),
            });
            setSessionIdentifier(identifier);
            setSessionUid(uid || null);
            loadAccountScopeIntoState(nextScope);
            navigateTo('home');
          }}
          onSignUp={() => {
            setAuthErrorBanner(null);
            navigateTo('register');
          }}
        />
      )}

      {/* 4. Registration Screen */}
      {currentScreen === 'register' && (
        <RegisterScreen
          initialError={authErrorBanner}
          onSuccess={(name, emailOrPhone, uid) => {
            setAuthErrorBanner(null);
            rtdbUserDataRef.current = null;
            const nextScope = normalizeAccountScopeKey({ uid, identifier: emailOrPhone });
            const fresh = createFreshAccountSeedData(INITIAL_PROFILES, INITIAL_SETTINGS);
            saveProfiles(fresh.profiles, nextScope);
            saveActiveProfileId(fresh.activeProfileId, nextScope);
            saveUserSession({
              identifier: emailOrPhone,
              uid,
              displayName: name,
              onboardingComplete: false,
              signedInAt: Date.now(),
            });
            setSessionIdentifier(emailOrPhone);
            setSessionUid(uid || null);
            loadAccountScopeIntoState(nextScope);
            navigateTo('profile-select');
          }}
          onSignIn={() => {
            setAuthErrorBanner(null);
            navigateTo('login');
          }}
        />
      )}

      {/* 5. Who's Watching Profile Selection */}
      {currentScreen === 'profile-select' && (
        <ProfileSelectionScreen
          profiles={profiles}
          onSelectProfile={handleSelectProfile}
          onAddProfile={() => navigateTo('profile-manage')}
          onManageProfiles={() => navigateTo('profile-manage')}
        />
      )}

      {/* 6. Profile Management & Creation */}
      {currentScreen === 'profile-manage' && (
        <ProfileManagementScreen
          profiles={profiles}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
          onBack={() => navigateTo('profile-select')}
        />
      )}

      {/* 7. Main Home Page */}
      {currentScreen === 'home' && (
        <>
          {siteConfig.siteAnnouncement && (
            <div className="w-full bg-neutral-950 border-b border-neutral-800 px-4 py-2 text-center text-xs text-neutral-200 font-medium md:pl-20">
              {siteConfig.siteAnnouncement}
            </div>
          )}
          <HomeScreen
            catalog={effectiveCatalog}
            catalogLoading={catalogLoading}
            onSelectMovie={handleSelectMovie}
            onPlayMovie={handlePlayMovie}
            onDownloadMovie={handleDownloadMovie}
            downloads={downloads}
            onSearchClick={() => navigateTo('search')}
            onNotificationsClick={() => navigateTo('notifications')}
            onCastClick={() => setIsCastOpen(true)}
            onCategoryNavigate={handleCategoryNavigate}
            watchlist={watchlist}
            onToggleWatchlist={handleToggleWatchlist}
            unreadNotificationsCount={unreadNotificationsCount}
          />
        </>
      )}

      {/* 8. Browse Movies & TV Shows Screen */}
      {currentScreen === 'browse' && (
        <BrowseScreen
          movies={catalog?.all || []}
          genreBanners={catalog?.genreBanners || []}
          onSelectMovie={handleSelectMovie}
          onSelectGenre={(genre) => {
            setActiveGenreParam(genre);
            navigateTo('genres');
          }}
          onBack={handleBack}
          initialType={browseTypeParam}
          onSearchClick={() => navigateTo('search')}
          onNotificationsClick={() => navigateTo('notifications')}
          onCastClick={() => setIsCastOpen(true)}
          onCategoryNavigate={handleCategoryNavigate}
          unreadNotificationsCount={unreadNotificationsCount}
          watchlist={watchlist}
          onToggleWatchlist={handleToggleWatchlist}
        />
      )}

      {/* 9. Genres Dedicated Page */}
      {currentScreen === 'genres' && (
        <GenresScreen
          catalog={catalog}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
          onBack={handleBack}
          onSearchClick={() => navigateTo('search')}
          initialGenre={activeGenreParam}
        />
      )}

      {/* 10. Search Screen */}
      {currentScreen === 'search' && (
        <SearchScreen
          catalogMovies={Object.values(movieDirectory)}
          trendingMovies={catalog?.sections.trending || []}
          onSelectMovie={handleSelectMovie}
          onBack={handleBack}
          recentSearches={recentSearches}
          onAddRecentSearch={handleAddRecentSearch}
          onClearRecentSearches={handleClearRecentSearches}
          onRemoveRecentSearch={handleRemoveRecentSearch}
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          cachedSearchResults={searchTmdbResults}
          onSearchResultsChange={(results) => {
            setSearchTmdbResults(results);
            registerMoviesInCache(results);
          }}
        />
      )}

      {/* 11. Movie & Series Details Page */}
      {currentScreen === 'details' && selectedMovie && (
        <MovieDetailsScreen
          movie={selectedMovie}
          catalogMovies={catalog?.all || []}
          initialAudioLang={playerAudioLang}
          autoPlay={detailsAutoPlay}
          onSelectSimilarMovie={handleSelectMovie}
          onBack={handleBack}
          onCastClick={() => setIsCastOpen(true)}
          isInWatchlist={watchlist.includes(selectedMovie.id)}
          onToggleWatchlist={handleToggleWatchlist}
          onDownload={handleDownloadMovie}
          downloads={downloads}
          isDownloaded={downloads.some(
            (d) => d.movieId === selectedMovie.id && d.status === 'completed'
          )}
          onPauseDownload={handlePauseDownload}
          onResumeDownload={handleResumeDownload}
          onOpenDownloads={() => navigateTo('downloads')}
          isLoadingDetails={isLoadingDetails}
          onProgressUpdate={handleProgressUpdate}
        />
      )}

      {/* 12. Full-Screen Video Player */}
      {currentScreen === 'player' && selectedMovie && (
        <VideoPlayerScreen
          key={`${selectedMovie.id}-${playerAudioLang}`}
          movie={selectedMovie}
          episode={selectedEpisode}
          initialAudioLang={playerAudioLang}
          onBack={handleBack}
          onProgressUpdate={handleProgressUpdate}
          onCastClick={() => setIsCastOpen(true)}
          onSelectEpisode={(ep) => {
            setSelectedEpisode(ep);
          }}
          onNextEpisode={() => {
            if (selectedMovie.episodes && selectedMovie.episodes.length > 1) {
              const nextIndex = selectedMovie.episodes.findIndex((e) => e.id === selectedEpisode?.id) + 1;
              if (nextIndex < selectedMovie.episodes.length) {
                setSelectedEpisode(selectedMovie.episodes[nextIndex]);
              }
            }
          }}
        />
      )}

      {/* 13. My List Screen */}
      {currentScreen === 'my-list' && (
        <MyListScreen
          movieDirectory={movieDirectory}
          watchlistIds={watchlist}
          continueWatching={continueWatching}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
          onRemoveFromList={handleToggleWatchlist}
          onSearchClick={() => navigateTo('search')}
          onBrowseMore={() => navigateTo('home')}
        />
      )}

      {/* 14. Downloads Screen */}
      {currentScreen === 'downloads' && (
        <DownloadsScreen
          downloads={downloads}
          onPlayDownloaded={(movieId, episodeId) => {
            const downloadId = episodeId ? `dl-${episodeId}` : `dl-${movieId}`;
            const dlItem = downloads.find((d) => d.id === downloadId || d.movieId === movieId);
            const baseMovie: Movie | undefined =
              movieDirectory[movieId] ||
              (dlItem
                ? {
                    id: dlItem.movieId,
                    title: dlItem.title,
                    type: dlItem.episodeId ? 'series' : 'movie',
                    year: new Date().getFullYear(),
                    ageRating: '16+',
                    quality: 'HD',
                    durationOrSeasons: dlItem.subTitle || 'Downloaded',
                    genres: ['Downloaded'],
                    synopsis: 'Saved offline on your device.',
                    matchScore: 95,
                    posterUrl: dlItem.posterUrl,
                    backdropUrl: dlItem.posterUrl,
                    cast: [],
                    videoUrl: dlItem.videoUrl,
                  }
                : undefined);

            if (!baseMovie) return;
            const targetEp = episodeId
              ? baseMovie.episodes?.find((ep) => ep.id === episodeId)
              : undefined;

            const blobStorageKey = buildScopedDownloadBlobKey(
              accountKeyRef.current,
              activeProfileIdRef.current,
              downloadId
            );
            void getDownloadedBlobUrl(blobStorageKey).then((blobUrl) => {
              if (blobUrl) {
                if (targetEp) {
                  handlePlayMovie(baseMovie, { ...targetEp, videoUrl: blobUrl });
                } else {
                  handlePlayMovie({ ...baseMovie, videoUrl: blobUrl });
                }
              } else {
                handlePlayMovie(baseMovie, targetEp);
              }
            });
          }}
          onPauseDownload={handlePauseDownload}
          onResumeDownload={handleResumeDownload}
          onSaveToDevice={handleSaveDownloadToDevice}
          onDeleteDownload={handleDeleteDownload}
          onFindMore={() => navigateTo('browse')}
          onOpenSettings={() => navigateTo('settings')}
        />
      )}

      {/* 15. Notifications Screen */}
      {currentScreen === 'notifications' && (
        <NotificationsScreen
          movieDirectory={movieDirectory}
          notifications={notifications}
          onSelectMovie={handleSelectMovie}
          onOpenNotification={(item) => void handleOpenNotification(item)}
          onMarkAllAsRead={handleMarkAllRead}
          onClearNotifications={handleClearNotifications}
          onBack={handleBack}
        />
      )}

      {/* 16. My Netflix Profile Screen */}
      {currentScreen === 'my-netflix' && (
        <MyNetflixScreen
          currentProfile={currentProfile}
          profiles={profiles}
          currentPlan={currentPlan}
          watchlistCount={watchlist.length}
          isAdminUser={isAdminUser}
          onOpenAdmin={() => navigateTo('admin')}
          onOpenMyList={() => navigateTo('my-list')}
          onSwitchProfile={(p) => {
            const scope = accountKeyRef.current;
            setActiveProfileId(p.id);
            activeProfileIdRef.current = p.id;
            saveActiveProfileId(p.id, scope);
            loadProfileScopeIntoState(scope, p.id);
            if (authUserRef.current) {
              void writeUserRtdbField(authUserRef.current.uid, 'activeProfileId', p.id);
            }
          }}
          onManageProfiles={() => navigateTo('profile-manage')}
          onOpenSubscription={() => navigateTo('subscription')}
          onOpenPaymentMethods={() => navigateTo('payment')}
          onOpenSettings={() => navigateTo('settings')}
          onSignOut={handleSignOut}
        />
      )}

      {/* 17. Subscription Plan Page */}
      {currentScreen === 'subscription' && (
        <SubscriptionScreen
          currentPlan={currentPlan}
          onUpdatePlan={handleUpdatePlan}
          onBack={handleBack}
        />
      )}

      {/* 18. Payment Method Page */}
      {currentScreen === 'payment' && (
        <PaymentScreen
          paymentMethods={paymentMethods}
          onAddPaymentMethod={handleAddPaymentMethod}
          onDeletePaymentMethod={handleDeletePaymentMethod}
          onSetDefaultPaymentMethod={handleSetDefaultPaymentMethod}
          onBack={handleBack}
        />
      )}

      {/* 19. Settings Screen */}
      {currentScreen === 'settings' && (
        <SettingsScreen
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          onBack={handleBack}
        />
      )}

      {/* 20. Exit Screen ("Thanks for watching!") */}
      {currentScreen === 'exit' && (
        <ExitScreen
          onDone={() => navigateTo('welcome')}
          backdropUrl={catalog?.hero?.backdropUrl}
        />
      )}

      {/* Main Upgraded Tab: TV Shows */}
      {currentScreen === 'tv-shows' && (
        <TVShowsScreen
          catalog={catalog}
          catalogLoading={catalogLoading}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
          onSearchClick={() => navigateTo('search')}
          onNotificationsClick={() => navigateTo('notifications')}
          onCastClick={() => setIsCastOpen(true)}
          onCategoryNavigate={handleCategoryNavigate}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      )}

      {/* Main Upgraded Tab: VJs (Translated Luganda) */}
      {currentScreen === 'vjs' && (
        <VJsScreen
          catalog={catalog}
          movies={catalog?.all || []}
          catalogLoading={catalogLoading}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={(movie, vjAudio) => handlePlayMovie(movie, undefined, vjAudio)}
          onBack={handleBack}
          onSearchClick={() => navigateTo('search')}
          onNotificationsClick={() => navigateTo('notifications')}
          onCastClick={() => setIsCastOpen(true)}
          onCategoryNavigate={handleCategoryNavigate}
          unreadNotificationsCount={unreadNotificationsCount}
        />
      )}

      {/* Extra Tab: Games */}
      {currentScreen === 'games' && <GamesScreen movies={catalog?.all || []} />}

      {/* Extra Tab: New & Hot */}
      {currentScreen === 'new-and-hot' && (
        <NewAndHotScreen
          catalog={catalog}
          onSelectMovie={handleSelectMovie}
          onPlayMovie={handlePlayMovie}
          reminders={reminders}
          onToggleReminder={handleToggleReminder}
        />
      )}

      {/* Restricted Admin Console (accessible strictly to verified admin account) */}
      {currentScreen === 'admin' && isAdminUser && (
        <AdminScreen
          authEmail={authUser?.email}
          sessionIdentifier={sessionIdentifier}
          fallbackMovies={catalog?.all || []}
          onBack={handleBack}
        />
      )}

      {/* Navigation Bars: Bottom Navigation on Mobile, Folded Side Rail on Desktop */}
      {showBottomNav && (
        <BottomNav
          activeTab={activeTab}
          onTabChange={handleTabChange}
          currentProfile={currentProfile}
        />
      )}
      {showDesktopSideNav && (
        <DesktopSideNav
          activeTab={activeTab}
          currentScreen={currentScreen}
          onTabChange={handleTabChange}
          onNavigateScreen={navigateTo}
          currentProfile={currentProfile}
          isAdminUser={isAdminUser}
        />
      )}

      {/* Cast Device Modal */}
      <CastModal
        isOpen={isCastOpen}
        onClose={() => setIsCastOpen(false)}
        connectedDevice={connectedCastDevice}
        onConnect={(dev) => setConnectedCastDevice(dev)}
      />

      {/* Startup WhatsApp Group & Instant Updates Notice */}
      <StartupDisclaimerModal
        isOpen={
          showStartupDisclaimer &&
          siteConfig.disclaimerEnabled &&
          currentScreen !== 'splash'
        }
        onDismiss={() => setShowStartupDisclaimer(false)}
        title={siteConfig.disclaimerTitle}
        message={siteConfig.disclaimerMessage}
        whatsappButtonLabel={siteConfig.whatsappButtonLabel}
        whatsappGroupUrl={siteConfig.whatsappGroupUrl}
        whatsappPrefillMessage={siteConfig.whatsappPrefillMessage}
      />

      {/* Blocked Account Overlay (enforced when admin disables a user account) */}
      {accountBlocked && !isAdminUser && (
        <div
          role="dialog"
          aria-modal="true"
          data-testid="blocked-account-overlay"
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-6"
        >
          <div className="w-full max-w-sm rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-center flex flex-col items-center gap-3">
            <div className="text-xl font-black tracking-widest text-[#E50914]">NETFLUX</div>
            <h2 className="text-lg font-bold text-white">Account Disabled</h2>
            <p className="text-xs text-neutral-400 leading-relaxed">
              This account has been temporarily disabled by an administrator. Please contact support to restore access.
            </p>
            <button
              type="button"
              onClick={() => {
                setAccountBlocked(false);
                void handleSignOut();
              }}
              className="mt-2 w-full min-h-[44px] rounded-xl bg-[#E50914] hover:bg-[#f40612] text-white text-sm font-bold cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator />
    </MobileFrame>
  );
}
