import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Ban,
  CheckCircle2,
  Crown,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  Search,
  TrendingUp,
} from 'lucide-react';
import { AdminOverviewPayload, Movie } from '../types';
import {
  ADMIN_EMAIL,
  canBlockAdminUser,
  canDisplayAdminButton,
  computeAdminCatalogSummary,
  computeSubscriptionProfitSummary,
  filterAdminUsersByEmail,
  isAdminEmail,
  validateAdminConfirmationInput,
} from '../services/logic';
import {
  checkAdminTokenSession,
  exchangeFirebaseAdminSession,
  fetchAdminOverview,
  toggleAdminUserBlocked,
  toggleAdminUserPremium,
  verifyAdminCredentials,
} from '../services/admin';
import { auth } from '../services/firebase';
import { getStoredAdminToken } from '../services/storage';

interface AdminScreenProps {
  authEmail?: string | null;
  sessionIdentifier?: string | null;
  fallbackMovies: Movie[];
  onBack: () => void;
}

type UserStatusFilter = 'all' | 'premium' | 'blocked';

export const AdminScreen: React.FC<AdminScreenProps> = ({
  authEmail,
  sessionIdentifier,
  fallbackMovies,
  onBack,
}) => {
  const isEligibleEmail = canDisplayAdminButton({ authEmail, sessionIdentifier });

  const [isUnlocked, setIsUnlocked] = useState<boolean>(() =>
    Boolean(isEligibleEmail && getStoredAdminToken())
  );
  const [confirmEmail, setConfirmEmail] = useState(
    isEligibleEmail ? ADMIN_EMAIL : authEmail || sessionIdentifier || ''
  );
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [unlockLoading, setUnlockLoading] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [userFilterMode, setUserFilterMode] = useState<UserStatusFilter>('all');
  const [busyUserKey, setBusyUserKey] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const tryAutoExchangeFirebaseAdmin = useCallback(async (): Promise<boolean> => {
    const fbUser = auth.currentUser;
    if (!fbUser || !isAdminEmail(fbUser.email)) return false;
    try {
      const idToken = await fbUser.getIdToken();
      const ok = await exchangeFirebaseAdminSession(idToken);
      if (ok) {
        setIsUnlocked(true);
      }
      return ok;
    } catch {
      return false;
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      let data: AdminOverviewPayload;
      try {
        data = await fetchAdminOverview();
      } catch (err: any) {
        if (/verification|expired/i.test(err?.message || '')) {
          const recovered = await tryAutoExchangeFirebaseAdmin();
          if (recovered) {
            data = await fetchAdminOverview();
          } else {
            throw err;
          }
        } else {
          throw err;
        }
      }
      setOverview(data);
      setIsUnlocked(true);
    } catch (err: any) {
      const msg = err?.message || 'Unable to load admin dashboard.';
      setLoadError(msg);
      if (/verification|expired/i.test(msg)) {
        setIsUnlocked(false);
      }
    } finally {
      setLoading(false);
    }
  }, [tryAutoExchangeFirebaseAdmin]);

  useEffect(() => {
    if (!isEligibleEmail) {
      setIsUnlocked(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      if (getStoredAdminToken()) {
        const valid = await checkAdminTokenSession();
        if (cancelled) return;
        if (valid) {
          setIsUnlocked(true);
          void loadDashboard();
          return;
        }
      }

      const exchanged = await tryAutoExchangeFirebaseAdmin();
      if (!cancelled && exchanged) {
        setIsUnlocked(true);
        void loadDashboard();
      } else if (!cancelled && !getStoredAdminToken()) {
        setIsUnlocked(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isEligibleEmail, loadDashboard, tryAutoExchangeFirebaseAdmin]);

  const handleConfirmUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);

    const validationError = validateAdminConfirmationInput({
      email: confirmEmail,
      password: confirmPassword,
    });
    if (validationError) {
      setUnlockError(validationError);
      return;
    }

    setUnlockLoading(true);
    try {
      await verifyAdminCredentials(confirmEmail, confirmPassword);
      setConfirmPassword('');
      setIsUnlocked(true);
      void loadDashboard();
    } catch (err: any) {
      setUnlockError(err?.message || 'Incorrect admin email or password. Access denied.');
    } finally {
      setUnlockLoading(false);
    }
  };

  const handleTogglePremium = async (key: string, currentPremium: boolean) => {
    setBusyUserKey(key);
    setActionError(null);
    try {
      await toggleAdminUserPremium(key, !currentPremium);
      await loadDashboard();
    } catch (err: any) {
      setActionError(err?.message || 'Unable to update premium access.');
    } finally {
      setBusyUserKey(null);
    }
  };

  const handleToggleBlock = async (key: string, email: string, currentBlocked: boolean) => {
    if (!canBlockAdminUser(email)) {
      setActionError('The administrator account cannot be blocked.');
      return;
    }
    setBusyUserKey(key);
    setActionError(null);
    try {
      await toggleAdminUserBlocked(key, !currentBlocked);
      await loadDashboard();
    } catch (err: any) {
      setActionError(err?.message || 'Unable to update user status.');
    } finally {
      setBusyUserKey(null);
    }
  };

  const catalogFallbackSummary = useMemo(
    () => computeAdminCatalogSummary(fallbackMovies),
    [fallbackMovies]
  );

  const usersList = useMemo(() => overview?.users || [], [overview]);
  const filteredUsers = useMemo(
    () => filterAdminUsersByEmail(usersList, userSearchQuery, userFilterMode),
    [usersList, userSearchQuery, userFilterMode]
  );

  // Strict hard rejection if active user is not the authorized admin email
  if (!isEligibleEmail) {
    return (
      <div className="flex-1 w-full bg-black text-white px-4 sm:px-8 py-12 flex items-center justify-center">
        <div className="w-full max-w-md border border-neutral-800 bg-neutral-950 rounded-xl p-6 text-center flex flex-col items-center gap-3">
          <Lock size={32} className="text-[#DC2626]" />
          <h1 className="text-lg font-bold text-white">Restricted Area</h1>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Admin access is restricted strictly to the authorized administrator account.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="mt-2 min-h-[44px] px-5 rounded-lg bg-[#E50914] hover:bg-[#f40612] text-white text-sm font-semibold cursor-pointer whitespace-nowrap"
          >
            Return to App
          </button>
        </div>
      </div>
    );
  }

  // Secondary Credential Confirmation Gate (when token is absent, expired, or locked)
  if (!isUnlocked) {
    return (
      <div
        className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-24 py-8 flex flex-col justify-center items-center overflow-y-auto no-scrollbar pb-24"
        data-testid="admin-security-gate"
      >
        <div className="w-full max-w-md border border-neutral-800 bg-neutral-950 rounded-xl p-6 sm:p-7 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E50914]/15 border border-[#E50914]/30 text-[#E50914] flex items-center justify-center shrink-0">
                <KeyRound size={20} />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Confirm Admin Credentials
                </h1>
                <p className="text-xs text-neutral-400">
                  Verify exact admin email and password to open console
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onBack}
              aria-label="Back to My Netflux"
              className="min-w-[44px] min-h-[44px] rounded-lg border border-neutral-800 hover:bg-neutral-900 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
          </div>

          {unlockError && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/40 text-xs text-red-200 flex items-start gap-2"
            >
              <AlertCircle size={16} className="text-[#DC2626] shrink-0 mt-0.5" />
              <span>{unlockError}</span>
            </div>
          )}

          <form onSubmit={handleConfirmUnlock} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-confirm-email" className="text-xs font-semibold text-neutral-300">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Mail size={16} />
                </div>
                <input
                  id="admin-confirm-email"
                  type="email"
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  placeholder="Enter admin email"
                  autoComplete="email"
                  className="w-full h-11 pl-10 pr-3.5 bg-black border border-neutral-800 focus:border-white rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="admin-confirm-password" className="text-xs font-semibold text-neutral-300">
                Admin Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
                  <Lock size={16} />
                </div>
                <input
                  id="admin-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className="w-full h-11 pl-10 pr-11 bg-black border border-neutral-800 focus:border-white rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-white cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={unlockLoading}
              data-testid="admin-unlock-submit"
              className="w-full min-h-[44px] rounded-lg bg-[#E50914] hover:bg-[#f40612] text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {unlockLoading ? 'Verifying...' : 'Unlock Admin Console'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const displayStats = overview?.stats || {
    totalUsers: 0,
    activeUsersNow: 0,
    activeUsersToday: 0,
    moviesCount: catalogFallbackSummary.moviesCount,
    seriesCount: catalogFallbackSummary.seriesCount,
    totalVods: catalogFallbackSummary.totalTitles,
    uniqueVjsCount: catalogFallbackSummary.uniqueVjsCount,
    premiumUsersCount: 0,
    blockedUsersCount: 0,
  };

  const subscriptionSummary =
    overview?.subscriptionSummary || computeSubscriptionProfitSummary({ users: [] });
  const maxWeeklyDayUgx = Math.max(
    1000,
    ...subscriptionSummary.weeklyBreakdown.map((d) => d.profitUgx)
  );

  return (
    <div
      className="flex-1 w-full bg-black text-white px-4 sm:px-8 md:pl-24 md:pr-8 pt-6 pb-24 flex flex-col overflow-y-auto no-scrollbar"
      data-testid="admin-console-screen"
    >
      <div className="w-full max-w-7xl mx-auto flex flex-col gap-6">
        {/* Top Bar: Breadcrumb + Refresh Data */}
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-neutral-800 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              aria-label="Back"
              className="min-w-[44px] min-h-[44px] rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-neutral-300 hover:text-white flex items-center justify-center shrink-0 cursor-pointer"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                <span>Netflux</span>
                <span>/</span>
                <span className="text-neutral-200 font-medium">Admin Console</span>
              </div>
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-white truncate">
                Overview &amp; User Control
              </h1>
              <p className="text-xs text-neutral-400">
                Signed in as {overview?.adminEmail || ADMIN_EMAIL}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => void loadDashboard()}
              disabled={loading}
              className="min-h-[44px] px-4 rounded-lg border border-neutral-800 bg-neutral-950 hover:bg-neutral-900 text-xs sm:text-sm font-semibold text-neutral-200 flex items-center gap-2 transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh Data</span>
            </button>
          </div>
        </header>

        {(loadError || actionError) && (
          <div
            role="alert"
            className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/40 text-xs sm:text-sm text-red-200 flex items-center gap-2.5"
          >
            <AlertCircle size={16} className="text-[#DC2626] shrink-0" />
            <span>{actionError || loadError}</span>
          </div>
        )}

        {/* 1. Overview Dashboard: Active Users Right Now, Movies, Series, and VODs */}
        <section
          aria-label="Overview dashboard metrics"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
        >
          <div
            data-testid="admin-kpi-users"
            className="border border-neutral-800 bg-neutral-950 rounded-xl p-4 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-medium text-neutral-400">Active Users Right Now</span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                data-testid="admin-kpi-users-now"
                className="text-2xl font-extrabold text-white tabular-nums"
              >
                {displayStats.activeUsersNow}
              </span>
              <span
                data-testid="admin-kpi-users-count"
                className="text-xs text-[#16A34A] font-semibold tabular-nums"
              >
                {displayStats.totalUsers} registered
              </span>
            </div>
          </div>

          <div
            data-testid="admin-kpi-movies"
            className="border border-neutral-800 bg-neutral-950 rounded-xl p-4 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-medium text-neutral-400">Movies</span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                data-testid="admin-kpi-movies-count"
                className="text-2xl font-extrabold text-white tabular-nums"
              >
                {displayStats.moviesCount}
              </span>
              <span className="text-xs text-neutral-400 font-medium">Feature films</span>
            </div>
          </div>

          <div
            data-testid="admin-kpi-series"
            className="border border-neutral-800 bg-neutral-950 rounded-xl p-4 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-medium text-neutral-400">Series</span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                data-testid="admin-kpi-series-count"
                className="text-2xl font-extrabold text-white tabular-nums"
              >
                {displayStats.seriesCount}
              </span>
              <span className="text-xs text-neutral-400 font-medium">TV shows</span>
            </div>
          </div>

          <div
            data-testid="admin-kpi-vods"
            className="border border-neutral-800 bg-neutral-950 rounded-xl p-4 flex flex-col justify-between gap-2"
          >
            <span className="text-xs font-medium text-neutral-400">VODs</span>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span
                data-testid="admin-kpi-vods-count"
                className="text-2xl font-extrabold text-white tabular-nums"
              >
                {displayStats.totalVods}
              </span>
              <span className="text-xs text-neutral-400 font-semibold tabular-nums">
                {displayStats.uniqueVjsCount} VJs
              </span>
            </div>
          </div>
        </section>

        {/* 2. Subscription Bids & Weekly Profit Dashboard (Payments Inactive) */}
        <section
          data-testid="admin-subscription-profit-dashboard"
          aria-label="Subscription bids and weekly profit dashboard"
          className="border border-neutral-800 bg-neutral-950 rounded-xl p-5 flex flex-col gap-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-neutral-800 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-[#16A34A]/15 border border-[#16A34A]/30 text-[#16A34A] flex items-center justify-center shrink-0">
                <TrendingUp size={18} />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-white">
                  Subscription Bids &amp; Weekly Profit
                </h2>
                <p className="text-xs text-neutral-400">
                  Weekly profit forecast based on activated Premium users and plan bids
                </p>
              </div>
            </div>

            <span
              data-testid="admin-payments-inactive-badge"
              className="self-start sm:self-auto px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-semibold whitespace-nowrap"
            >
              Payments Inactive · Preview Mode
            </span>
          </div>

          {/* Revenue KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-neutral-800 bg-black p-3.5">
              <div className="text-[11px] font-medium text-neutral-400">Weekly Profit</div>
              <div
                data-testid="admin-weekly-profit-value"
                className="text-lg sm:text-xl font-extrabold text-[#16A34A] tabular-nums mt-1"
              >
                {subscriptionSummary.weeklyProfitUgx.toLocaleString()} UGX
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-black p-3.5">
              <div className="text-[11px] font-medium text-neutral-400">Projected Monthly</div>
              <div className="text-lg sm:text-xl font-extrabold text-white tabular-nums mt-1">
                {subscriptionSummary.projectedMonthlyUgx.toLocaleString()} UGX
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-black p-3.5">
              <div className="text-[11px] font-medium text-neutral-400">Premium Accounts</div>
              <div
                data-testid="admin-premium-users-count"
                className="text-lg sm:text-xl font-extrabold text-white tabular-nums mt-1"
              >
                {subscriptionSummary.premiumUsersCount}
              </div>
            </div>
            <div className="rounded-lg border border-neutral-800 bg-black p-3.5">
              <div className="text-[11px] font-medium text-neutral-400">Standard / Free</div>
              <div className="text-lg sm:text-xl font-extrabold text-neutral-300 tabular-nums mt-1">
                {subscriptionSummary.freeUsersCount}
              </div>
            </div>
          </div>

          {/* Plan Bids + 7-Day Profit Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            <div className="lg:col-span-5 flex flex-col gap-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                Subscription Plan Bids
              </h3>
              {subscriptionSummary.plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-lg border border-neutral-800 bg-black px-3.5 py-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-bold text-white">{plan.name}</div>
                    <div className="text-[11px] text-neutral-400">{plan.periodLabel}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs sm:text-sm font-extrabold text-white tabular-nums">
                      {plan.priceLabel}
                    </div>
                    <div className="text-[11px] text-neutral-500">Billing paused</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-7 rounded-lg border border-neutral-800 bg-black p-4 flex flex-col justify-between gap-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400">
                  7-Day Profit Breakdown (UGX)
                </h3>
                <span className="text-[11px] text-neutral-500">Mon – Sun</span>
              </div>

              <div className="grid grid-cols-7 gap-2 items-end h-36 pt-2">
                {subscriptionSummary.weeklyBreakdown.map((item) => {
                  const pct =
                    item.profitUgx > 0
                      ? Math.max(12, Math.round((item.profitUgx / maxWeeklyDayUgx) * 100))
                      : 6;
                  return (
                    <div
                      key={item.day}
                      className="flex flex-col items-center justify-end gap-1.5 h-full"
                    >
                      <span className="text-[10px] text-neutral-400 tabular-nums">
                        {item.profitUgx > 0 ? item.profitUgx.toLocaleString() : '0'}
                      </span>
                      <div className="w-full flex-1 flex items-end justify-center">
                        <div
                          className={`w-full max-w-[34px] rounded-t-md transition-all ${
                            item.profitUgx > 0
                              ? 'bg-[#16A34A]/80 border border-[#16A34A]'
                              : 'bg-neutral-800/80 border border-neutral-700'
                          }`}
                          style={{ height: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-neutral-300">
                        {item.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Users Management List (Email Only + Activate Premium + Block / Enable) */}
        <section
          data-testid="admin-users-section"
          aria-label="Registered users management"
          className="border border-neutral-800 bg-neutral-950 rounded-xl overflow-hidden"
        >
          <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Users ({usersList.length})
              </h2>
              <p className="text-xs text-neutral-400">
                Activate Premium access or Block / Enable accounts by email
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
                />
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Search user email..."
                  aria-label="Search user email"
                  className="w-full sm:w-64 h-10 pl-9 pr-3 bg-black border border-neutral-800 focus:border-white rounded-lg text-xs sm:text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
              </div>

              <div className="flex rounded-lg border border-neutral-800 bg-black p-1 gap-1">
                {(['all', 'premium', 'blocked'] as UserStatusFilter[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setUserFilterMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize cursor-pointer transition-colors ${
                      userFilterMode === mode
                        ? 'bg-neutral-800 text-white'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="divide-y divide-neutral-900 max-h-[540px] overflow-y-auto">
            {filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-xs sm:text-sm text-neutral-500">
                No matching user emails found.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isBusy = busyUserKey === user.key;
                const isSelfAdmin = !canBlockAdminUser(user.email);
                return (
                  <div
                    key={user.key}
                    data-testid={`admin-user-row-${user.email}`}
                    className="px-4 sm:px-5 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-neutral-900/40 transition-colors"
                  >
                    {/* Strictly Email Only */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        data-testid="admin-user-email"
                        className={`text-xs sm:text-sm font-medium truncate ${
                          user.isBlocked ? 'text-neutral-500 line-through' : 'text-white'
                        }`}
                      >
                        {user.email}
                      </span>
                      {user.isBlocked && (
                        <span className="text-[11px] font-semibold text-red-400 shrink-0">
                          Blocked
                        </span>
                      )}
                      {!user.isBlocked && user.isPremium && (
                        <span className="text-[11px] font-semibold text-amber-400 shrink-0">
                          Premium
                        </span>
                      )}
                    </div>

                    {/* Actions: Activate Premium + Block / Enable */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleTogglePremium(user.key, user.isPremium)}
                        data-testid="admin-user-premium-btn"
                        className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                          user.isPremium
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                            : 'bg-neutral-900 border-neutral-700 text-neutral-200 hover:bg-neutral-800'
                        }`}
                      >
                        <Crown size={14} />
                        <span>{user.isPremium ? 'Premium Active' : 'Activate Premium'}</span>
                      </button>

                      {isSelfAdmin ? (
                        <span className="min-h-[38px] px-3 rounded-lg text-xs font-semibold border border-neutral-800 bg-black text-neutral-400 flex items-center">
                          Admin
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() =>
                            void handleToggleBlock(user.key, user.email, user.isBlocked)
                          }
                          data-testid="admin-user-block-btn"
                          className={`min-h-[38px] px-3.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap ${
                            user.isBlocked
                              ? 'bg-[#16A34A]/15 border-[#16A34A]/40 text-emerald-300 hover:bg-[#16A34A]/25'
                              : 'bg-[#DC2626]/10 border-[#DC2626]/35 text-red-300 hover:bg-[#DC2626]/20'
                          }`}
                        >
                          {user.isBlocked ? (
                            <>
                              <CheckCircle2 size={14} />
                              <span>Enable</span>
                            </>
                          ) : (
                            <>
                              <Ban size={14} />
                              <span>Block</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
