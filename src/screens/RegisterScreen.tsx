import React, { useState, useEffect } from 'react';
import { Mail, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';
import { NetflixWordmark } from '../components/NetflixLogo';
import { validateRegistrationForm, isAdminEmail } from '../services/logic';
import { exchangeFirebaseAdminSession } from '../services/admin';
import { clearAdminToken } from '../services/storage';
import {
  signUpWithEmailOrPhone,
  signInWithGoogleAccount,
  startGoogleRedirectSignIn,
  isEmbeddedInIframe,
  GoogleSignInError,
} from '../services/firebase';

interface RegisterScreenProps {
  onSuccess: (name: string, emailOrPhone: string, uid?: string) => void;
  onSignIn: () => void;
  initialError?: string | null;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({
  onSuccess,
  onSignIn,
  initialError = null,
}) => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [showGoogleFallback, setShowGoogleFallback] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inIframe = isEmbeddedInIframe();

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setShowGoogleFallback(false);

    if (isAdminEmail(identifier)) {
      setError('This administrator email cannot be self-registered. Please use Sign In.');
      return;
    }

    const validationError = validateRegistrationForm({
      identifier,
      password,
      confirmPassword,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    clearAdminToken();
    setLoading(true);
    try {
      const result = await signUpWithEmailOrPhone(identifier, password);
      setSuccessMessage('Account created with Firebase! Preparing profiles...');
      onSuccess(result.displayName, result.identifier, result.user.uid);
    } catch (err: any) {
      setError(err?.message || 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError(null);
    setShowGoogleFallback(false);
    setLoading(true);
    try {
      const result = await signInWithGoogleAccount('register');
      if (result.status === 'redirecting') {
        setSuccessMessage('Redirecting to Google Sign-In...');
        return;
      }
      if (isAdminEmail(result.email)) {
        const idToken = await result.user.getIdToken();
        await exchangeFirebaseAdminSession(idToken);
      } else {
        clearAdminToken();
      }
      setSuccessMessage('Signed in with Google! Preparing profiles...');
      onSuccess(result.displayName, result.email, result.user.uid);
    } catch (err: any) {
      setError(err?.message || 'Google sign-in failed. Please try again.');
      if (err instanceof GoogleSignInError && err.canOfferFallback) {
        setShowGoogleFallback(true);
      }
      setLoading(false);
    }
  };

  const handleGoogleRedirectFallback = async () => {
    setError(null);
    setShowGoogleFallback(false);
    setLoading(true);
    setSuccessMessage('Redirecting to Google Sign-In...');
    try {
      await startGoogleRedirectSignIn('register');
    } catch (err: any) {
      setSuccessMessage(null);
      setError(err?.message || 'Google sign-in failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-black px-6 py-8 flex flex-col justify-between overflow-y-auto no-scrollbar">
      {/* Top Header */}
      <div className="w-full flex items-center justify-between mb-4">
        <NetflixWordmark className="text-2xl" />
        <button
          onClick={onSignIn}
          className="text-xs text-neutral-300 hover:text-white font-medium"
        >
          Sign In
        </button>
      </div>

      <div className="w-full max-w-sm mx-auto flex flex-col my-auto py-2">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
          Create Account
        </h1>
        <p className="text-xs text-neutral-400 mb-6">
          Use your email or mobile number to get started.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#E50914]/15 border border-[#E50914]/40 flex flex-col gap-2 text-xs text-red-200 animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertCircle size={16} className="text-[#E50914] shrink-0" />
              <span>{error}</span>
            </div>
            {showGoogleFallback && (
              inIframe ? (
                <a
                  href={typeof window !== 'undefined' ? window.location.href : '/'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 mt-1 py-2 px-3 rounded-md bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
                >
                  <ExternalLink size={13} />
                  <span>Open Netflux in Browser Tab to Sign In</span>
                </a>
              ) : (
                <button
                  type="button"
                  onClick={handleGoogleRedirectFallback}
                  className="inline-flex items-center justify-center gap-1.5 mt-1 py-2 px-3 rounded-md bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
                >
                  <span>Continue with Google (Full Page)</span>
                </button>
              )
            )}
          </div>
        )}

        {successMessage && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center gap-2.5 text-xs text-emerald-200 animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
          {/* 1. Email / Phone Number */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Mail size={16} />
            </div>
            <input
              type="text"
              inputMode="email"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Email or phone number"
              aria-label="Email or phone number"
              className="w-full h-12 pl-10 pr-4 bg-neutral-900 border border-neutral-700 focus:border-white rounded-md text-sm text-white placeholder-neutral-400 focus:outline-none transition-colors"
            />
          </div>

          {/* 2. Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Lock size={16} />
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password (min 6 characters)"
              aria-label="Password"
              className="w-full h-12 pl-10 pr-11 bg-neutral-900 border border-neutral-700 focus:border-white rounded-md text-sm text-white placeholder-neutral-400 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-white"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* 3. Confirm Password */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-400">
              <Lock size={16} />
            </div>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              aria-label="Confirm password"
              className="w-full h-12 pl-10 pr-11 bg-neutral-900 border border-neutral-700 focus:border-white rounded-md text-sm text-white placeholder-neutral-400 focus:outline-none transition-colors"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-neutral-400 hover:text-white"
              aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
            >
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || Boolean(successMessage)}
            className="w-full h-12 mt-1 bg-[#E50914] hover:bg-[#f40612] active:scale-[0.98] text-white font-bold text-sm rounded-md transition-all flex items-center justify-center shadow-md disabled:opacity-50"
          >
            {loading && !successMessage ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        {/* OR Divider */}
        <div className="relative my-5 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-neutral-800" />
          </div>
          <span className="relative px-3 bg-black text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
            OR
          </span>
        </div>

        {/* Google Sign Up / Continue */}
        <button
          type="button"
          disabled={loading || Boolean(successMessage)}
          onClick={handleGoogleSignUp}
          className="w-full h-11 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 rounded-md text-xs font-semibold text-white flex items-center justify-center gap-3 active:scale-[0.99] transition-all disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="mt-6 text-center text-xs text-neutral-400">
          <span>Already have an account? </span>
          <button
            onClick={onSignIn}
            className="text-[#E50914] hover:underline font-bold"
          >
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
