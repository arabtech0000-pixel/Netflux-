import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import {
  getDatabase,
  ref,
  get,
  set,
  update,
  onValue,
  type Unsubscribe,
} from 'firebase/database';
import {
  Profile,
  WatchProgress,
  DownloadItem,
  NotificationItem,
  AppSettings,
  PaymentMethodItem,
} from '../types';
import {
  toFirebaseAuthEmail,
  mapFirebaseAuthError,
  sanitizeUserDataForRtdb,
  shouldFallbackToGoogleRedirect,
  canOfferGoogleTabOrRedirectFallback,
} from './logic';

const firebaseConfig = {
  apiKey: 'AIzaSyAmx1I4mG4OQ1IzurqrFD-E56-OJv7ug5k',
  authDomain: 'munomoviess.firebaseapp.com',
  databaseURL: 'https://munomoviess-default-rtdb.firebaseio.com',
  projectId: 'munomoviess',
  storageBucket: 'munomoviess.firebasestorage.app',
  messagingSenderId: '86379072218',
  appId: '1:86379072218:web:05926637fc6c431d98b3e3',
  measurementId: 'G-9N36DX1Z48',
};

// Initialize Firebase App, Authentication, and Realtime Database (no Firestore)
export const firebaseApp = initializeApp(firebaseConfig);
export const auth = getAuth(firebaseApp);
export const rtdb = getDatabase(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('email');
googleProvider.addScope('profile');
googleProvider.setCustomParameters({ prompt: 'select_account' });

export type GoogleAuthFlow = 'login' | 'register';

const PENDING_GOOGLE_FLOW_KEY = 'netflux_pending_google_flow';

export interface ProfileScopedRtdbData {
  watchlist?: string[];
  continueWatching?: WatchProgress[];
  downloads?: DownloadItem[];
  recentSearches?: string[];
  reminders?: string[];
}

export interface RtdbUserData {
  account?: {
    uid: string;
    identifier: string;
    email: string | null;
    displayName: string;
    provider: string;
    createdAt: number;
    lastLoginAt: number;
  };
  profiles?: Profile[];
  activeProfileId?: string;
  profileData?: Record<string, ProfileScopedRtdbData>;
  watchlist?: string[];
  continueWatching?: WatchProgress[];
  downloads?: DownloadItem[];
  notifications?: NotificationItem[];
  settings?: AppSettings;
  recentSearches?: string[];
  planId?: string;
  paymentMethods?: PaymentMethodItem[];
  reminders?: string[];
}

export function subscribeToAuthState(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

const getCurrentHostname = (): string | undefined =>
  typeof window !== 'undefined' ? window.location.hostname : undefined;

export function isEmbeddedInIframe(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function getPendingGoogleAuthFlow(): GoogleAuthFlow | null {
  try {
    const val = sessionStorage.getItem(PENDING_GOOGLE_FLOW_KEY);
    return val === 'login' || val === 'register' ? val : null;
  } catch {
    return null;
  }
}

function setPendingGoogleAuthFlow(flow: GoogleAuthFlow | null): void {
  try {
    if (flow) {
      sessionStorage.setItem(PENDING_GOOGLE_FLOW_KEY, flow);
    } else {
      sessionStorage.removeItem(PENDING_GOOGLE_FLOW_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}

export class GoogleSignInError extends Error {
  code?: string;
  canOfferFallback: boolean;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'GoogleSignInError';
    this.code = code;
    this.canOfferFallback = canOfferGoogleTabOrRedirectFallback(code);
  }
}

export async function signUpWithEmailOrPhone(
  identifier: string,
  password: string
): Promise<{ user: User; displayName: string; identifier: string }> {
  const cleanIdentifier = identifier.trim();
  const authEmail = toFirebaseAuthEmail(cleanIdentifier);
  const displayName = cleanIdentifier.includes('@')
    ? cleanIdentifier.split('@')[0]
    : cleanIdentifier;

  try {
    const cred = await createUserWithEmailAndPassword(auth, authEmail, password);
    try {
      await updateProfile(cred.user, { displayName });
    } catch {
      // Non-critical profile display name update
    }

    await upsertAccountRecordBounded(cred.user, cleanIdentifier, 'password', true);
    return { user: cred.user, displayName, identifier: cleanIdentifier };
  } catch (err: any) {
    throw new Error(mapFirebaseAuthError(err?.code, err?.message, getCurrentHostname()));
  }
}

export async function signInWithEmailOrPhone(
  identifier: string,
  password: string
): Promise<{ user: User; identifier: string }> {
  const cleanIdentifier = identifier.trim();
  const authEmail = toFirebaseAuthEmail(cleanIdentifier);

  try {
    const cred = await signInWithEmailAndPassword(auth, authEmail, password);
    await upsertAccountRecordBounded(cred.user, cleanIdentifier, 'password', false);
    return { user: cred.user, identifier: cleanIdentifier };
  } catch (err: any) {
    throw new Error(mapFirebaseAuthError(err?.code, err?.message, getCurrentHostname()));
  }
}

export type GoogleSignInOutcome =
  | { status: 'signed-in'; user: User; displayName: string; email: string }
  | { status: 'redirecting' };

export async function startGoogleRedirectSignIn(flow: GoogleAuthFlow = 'login'): Promise<void> {
  setPendingGoogleAuthFlow(flow);
  try {
    await signInWithRedirect(auth, googleProvider);
  } catch (err: any) {
    setPendingGoogleAuthFlow(null);
    const code = err?.code as string | undefined;
    throw new GoogleSignInError(
      mapFirebaseAuthError(code, err?.message, getCurrentHostname()),
      code
    );
  }
}

export async function signInWithGoogleAccount(
  flow: GoogleAuthFlow = 'login'
): Promise<GoogleSignInOutcome> {
  const inIframe = isEmbeddedInIframe();
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    setPendingGoogleAuthFlow(null);
    const displayName = cred.user.displayName || 'Google User';
    const email = cred.user.email || 'google.user@munomoviess.app';
    await upsertAccountRecordBounded(cred.user, email, 'google', false);
    return { status: 'signed-in', user: cred.user, displayName, email };
  } catch (err: any) {
    const code = err?.code as string | undefined;
    if (shouldFallbackToGoogleRedirect({ errorCode: code, isInIframe: inIframe })) {
      await startGoogleRedirectSignIn(flow);
      return { status: 'redirecting' };
    }
    throw new GoogleSignInError(
      mapFirebaseAuthError(code, err?.message, getCurrentHostname()),
      code
    );
  }
}

export type GoogleRedirectOutcome =
  | { status: 'signed-in'; user: User; displayName: string; email: string; flow: GoogleAuthFlow }
  | { status: 'error'; message: string; flow: GoogleAuthFlow }
  | null;

export async function consumeGoogleRedirectResult(): Promise<GoogleRedirectOutcome> {
  const pendingFlow: GoogleAuthFlow = getPendingGoogleAuthFlow() || 'login';
  try {
    const cred = await getRedirectResult(auth);
    if (!cred?.user) {
      return null;
    }
    setPendingGoogleAuthFlow(null);
    const displayName = cred.user.displayName || 'Google User';
    const email = cred.user.email || 'google.user@munomoviess.app';
    await upsertAccountRecordBounded(cred.user, email, 'google', false);
    return {
      status: 'signed-in',
      user: cred.user,
      displayName,
      email,
      flow: pendingFlow,
    };
  } catch (err: any) {
    setPendingGoogleAuthFlow(null);
    const code = err?.code as string | undefined;
    return {
      status: 'error',
      message: mapFirebaseAuthError(code, err?.message, getCurrentHostname()),
      flow: pendingFlow,
    };
  }
}

export async function resetPasswordWithEmail(identifier: string): Promise<void> {
  const clean = identifier.trim();
  if (!clean || !clean.includes('@')) {
    throw new Error('Enter your account email address first to receive a reset link.');
  }
  try {
    await sendPasswordResetEmail(auth, clean.toLowerCase());
  } catch (err: any) {
    throw new Error(mapFirebaseAuthError(err?.code, err?.message));
  }
}

export async function signOutFirebase(): Promise<void> {
  setPendingGoogleAuthFlow(null);
  await signOut(auth);
}

async function upsertAccountRecordBounded(
  user: User,
  identifier: string,
  provider: string,
  isNew: boolean
): Promise<void> {
  await Promise.race([
    upsertAccountRecord(user, identifier, provider, isNew),
    new Promise<void>((resolve) => setTimeout(resolve, 2500)),
  ]);
}

async function upsertAccountRecord(
  user: User,
  identifier: string,
  provider: string,
  isNew: boolean
): Promise<void> {
  try {
    const accountRef = ref(rtdb, `users/${user.uid}/account`);
    const now = Date.now();
    const payload = sanitizeUserDataForRtdb({
      uid: user.uid,
      identifier,
      email: user.email || null,
      displayName: user.displayName || identifier,
      provider,
      lastLoginAt: now,
      ...(isNew ? { createdAt: now } : {}),
    });
    await update(accountRef, payload);
  } catch (err) {
    console.warn('Realtime Database account sync skipped:', err);
  }
}

export async function ensureUserRtdbSeeded(
  uid: string,
  defaults: Omit<RtdbUserData, 'account'>
): Promise<void> {
  try {
    const userRef = ref(rtdb, `users/${uid}`);
    const snapshot = await get(userRef);
    const existing = snapshot.val() as RtdbUserData | null;

    if (!existing || !existing.profiles) {
      await update(
        userRef,
        sanitizeUserDataForRtdb({
          ...defaults,
        })
      );
    }
  } catch (err) {
    console.warn('Realtime Database initial seed skipped:', err);
  }
}

export function subscribeToUserRtdb(
  uid: string,
  onData: (data: RtdbUserData) => void
): Unsubscribe {
  const userRef = ref(rtdb, `users/${uid}`);
  return onValue(
    userRef,
    (snapshot) => {
      const val = snapshot.val() as RtdbUserData | null;
      if (val) {
        onData(val);
      }
    },
    (error) => {
      console.warn('Realtime Database listener error:', error.message);
    }
  );
}

export async function writeUserRtdbField<K extends keyof RtdbUserData>(
  uid: string,
  field: K,
  value: RtdbUserData[K]
): Promise<void> {
  try {
    const fieldRef = ref(rtdb, `users/${uid}/${String(field)}`);
    await set(fieldRef, sanitizeUserDataForRtdb(value));
  } catch (err) {
    console.warn(`Realtime Database write failed for "${String(field)}":`, err);
  }
}

export async function writeProfileRtdbField<K extends keyof ProfileScopedRtdbData>(
  uid: string,
  profileId: string,
  field: K,
  value: ProfileScopedRtdbData[K]
): Promise<void> {
  const cleanProfileId = (profileId || 'p1').trim() || 'p1';
  try {
    const fieldRef = ref(rtdb, `users/${uid}/profileData/${cleanProfileId}/${String(field)}`);
    await set(fieldRef, sanitizeUserDataForRtdb(value));
  } catch (err) {
    console.warn(
      `Realtime Database profile write failed for "${cleanProfileId}/${String(field)}":`,
      err
    );
  }
}

export async function deleteProfileRtdbData(uid: string, profileId: string): Promise<void> {
  const cleanProfileId = (profileId || '').trim();
  if (!cleanProfileId) return;
  try {
    const profileRef = ref(rtdb, `users/${uid}/profileData/${cleanProfileId}`);
    await set(profileRef, null);
  } catch (err) {
    console.warn(`Realtime Database profile delete failed for "${cleanProfileId}":`, err);
  }
}

