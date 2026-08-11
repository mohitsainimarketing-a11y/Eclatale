import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { trackEvent } from '../lib/analytics';
import { apiFetch } from '../lib/apiFetch';
import { loadGoogleIdentityScript, generateNonce } from '../lib/googleIdentity';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

// Set once the Google Cloud OAuth Client has eclatale.com registered as an
// Authorized JavaScript origin (Supabase Dashboard -> Authentication ->
// Providers -> Google has the matching Client ID). Until then this stays
// unset and the button below falls back to the old Supabase-hosted redirect
// flow (which shows the supabase.co domain on Google's consent screen).
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

type ViewMode = 'auth' | 'forgot' | 'forgot-sent';

export default function Auth({ defaultIsLogin = false }: { defaultIsLogin?: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [view, setView] = useState<ViewMode>(() => (
    new URLSearchParams(window.location.search).get('forgot') === '1' ? 'forgot' : 'auth'
  ));
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');

  const [googleLoading, setGoogleLoading] = useState(false);
  const [gisReady, setGisReady] = useState(false);
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const nonceRef = useRef<string | undefined>(undefined);

  // Runs after Google returns an ID token directly to this page (no redirect
  // through Supabase's domain) — hands it to Supabase to create the session,
  // then mirrors AuthCallback.tsx's new-vs-returning-user routing.
  const handleGoogleCredential = useCallback(async (response: { credential: string }) => {
    setGoogleLoading(true);
    setMessage('');
    try {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.credential,
        nonce: nonceRef.current,
      });
      if (error) throw error;
      if (!data.user) throw new Error('Could not sign in with Google.');

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, domain, goals')
        .eq('id', data.user.id)
        .single();
      const hasProfile = !!(profile?.role && profile?.domain && profile?.goals?.length);

      apiFetch(`${API_URL}/api/email/send-welcome`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: data.user.id }),
      }).catch(() => {});

      if (!hasProfile) trackEvent('signup_complete');

      const returnTo = new URLSearchParams(window.location.search).get('returnTo');
      if (hasProfile && returnTo && returnTo.startsWith('/')) window.location.href = returnTo;
      else window.location.href = hasProfile ? '/dashboard' : '/onboarding';
    } catch (error: any) {
      setMessage(error.message || 'Google sign-in failed.');
      setGoogleLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || view !== 'auth') return;
    let cancelled = false;
    loadGoogleIdentityScript().then(async () => {
      if (cancelled || !googleBtnRef.current) return;
      const google = (window as any).google;
      const { nonce, hashedNonce } = await generateNonce();
      nonceRef.current = nonce;
      google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        nonce: hashedNonce,
        use_fedcm_for_prompt: true,
      });
      google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard', theme: 'outline', size: 'large', shape: 'rectangular',
        text: 'continue_with', logo_alignment: 'left',
        width: googleBtnRef.current.offsetWidth || 360,
      });
      if (!cancelled) setGisReady(true);
    }).catch(() => setGisReady(false));
    return () => { cancelled = true; };
  }, [view, handleGoogleCredential]);

  // Fallback used only when GOOGLE_CLIENT_ID isn't configured yet, or GIS
  // failed to load — same Supabase-hosted redirect flow as before.
  const handleGoogleLoginFallback = async () => {
    setGoogleLoading(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: 'https://eclatale.com/auth/callback',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      setMessage(error.message);
      setGoogleLoading(false);
    }
    // On success, Supabase redirects the browser to Google immediately —
    // no further state change happens on this page.
  };

  const handleAuth = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const returnTo = new URLSearchParams(window.location.search).get('returnTo');
        window.location.href = returnTo && returnTo.startsWith('/') ? returnTo : '/dashboard';
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        trackEvent('signup_complete');
        if (data.session) {
          window.location.href = '/onboarding';
        } else {
          setMessage('Check your email to confirm your account! Then come back and login.');
        }
      }
    } catch (error: any) {
      setMessage(error.message);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password) handleAuth();
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetError('');
    setView('forgot');
  };

  const handleSendReset = async () => {
    if (!resetEmail) return;
    setResetLoading(true);
    setResetError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: 'https://eclatale.com/auth/reset-password',
      });
      if (error) throw error;
      trackEvent('password_reset_requested');
      setView('forgot-sent');
    } catch (error: any) {
      setResetError(error.message || 'Something went wrong sending the reset link.');
    }
    setResetLoading(false);
  };

  const handleResetKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && resetEmail) handleSendReset();
  };

  return (
    <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] animate-fadeIn">
        <a href="/" className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-purple font-medium mb-8 transition-colors text-sm">
          <ArrowLeft size={16} />
          Back to home
        </a>

        <div className="mb-8">
          <a href="/" className="text-2xl md:text-3xl font-extrabold gradient-text mb-2 block">Eclatale</a>
          <p className="text-brand-muted text-sm font-medium">
            {view === 'auth'
              ? (isLogin ? 'Welcome back. Sign in to continue.' : 'Create your account to start growing.')
              : view === 'forgot'
              ? "Enter your email and we'll send you a reset link"
              : 'Check your email for the reset link.'}
          </p>
        </div>

        <div className="card p-7 md:p-8 overflow-hidden">
          {view === 'auth' && (
            <div className="animate-fadeIn">
              {/* Real Google-rendered button (shown once GIS has initialized) —
                  runs the sign-in entirely from this page, so Google's account
                  chooser shows eclatale.com instead of the Supabase project domain. */}
              <div
                ref={googleBtnRef}
                className={GOOGLE_CLIENT_ID && gisReady && !googleLoading ? 'w-full flex justify-center' : 'hidden'}
              />
              {googleLoading && GOOGLE_CLIENT_ID && gisReady && (
                <div className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-brand-muted">
                  <Loader2 size={16} className="animate-spin" /> Signing in…
                </div>
              )}

              {/* Fallback: custom button using the old Supabase-hosted redirect
                  flow, shown until GOOGLE_CLIENT_ID is configured or if GIS fails to load. */}
              {(!GOOGLE_CLIENT_ID || !gisReady) && (
                <button
                  type="button"
                  onClick={handleGoogleLoginFallback}
                  disabled={googleLoading || loading}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[rgba(0,0,0,0.1)] bg-white text-[15px] font-semibold text-brand-dark hover:bg-[rgba(0,0,0,0.02)] hover:border-[rgba(0,0,0,0.16)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {googleLoading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"/>
                      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
                      <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
                      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                    </svg>
                  )}
                  {googleLoading ? 'Redirecting to Google…' : 'Continue with Google'}
                </button>
              )}

              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.08)]" />
                <span className="text-xs font-medium text-brand-muted">or</span>
                <div className="flex-1 h-px bg-[rgba(0,0,0,0.08)]" />
              </div>

              <div className="space-y-4" onKeyDown={handleKeyDown}>
                <div>
                  <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="input !pl-11"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide block">Password</label>
                  </div>
                  <div className="relative">
                    <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="input !pl-11"
                      autoComplete={isLogin ? 'current-password' : 'new-password'}
                    />
                  </div>
                  {isLogin && (
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={openForgotPassword}
                        className="text-xs font-medium text-[#6B7280] hover:text-brand-purple hover:underline transition-colors"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {message && (
                <div className={`mt-4 p-4 rounded-xl text-sm font-medium animate-fadeIn ${
                  message.includes('Check your email')
                    ? 'bg-[rgba(6,214,160,0.08)] text-[#06D6A0] border border-[rgba(6,214,160,0.2)]'
                    : 'bg-[rgba(239,68,68,0.06)] text-red-600 border border-red-100 animate-shake'
                }`}>
                  {message}
                </div>
              )}

              <button
                onClick={handleAuth}
                disabled={loading || !email || !password}
                className="btn-primary w-full mt-6 text-[15px]"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : null}
                {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </button>

              <p className="text-center text-sm text-brand-muted mt-5">
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
                <a
                  href={isLogin ? '/signup' : '/login'}
                  className="text-brand-purple font-semibold hover:underline"
                >
                  {isLogin ? 'Sign up' : 'Sign in'}
                </a>
              </p>
            </div>
          )}

          {view === 'forgot' && (
            <div className="animate-fadeIn">
              <button
                type="button"
                onClick={() => setView('auth')}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-muted hover:text-brand-purple transition-colors mb-5"
              >
                <ArrowLeft size={15} /> Back
              </button>

              <h2 className="h3 text-brand-dark mb-1.5">Reset your password</h2>
              <p className="text-sm text-brand-muted mb-6 leading-relaxed">
                Enter your email and we'll send you a reset link
              </p>

              <div onKeyDown={handleResetKeyDown}>
                <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="input !pl-11"
                    autoComplete="email"
                    autoFocus
                  />
                </div>
              </div>

              {resetError && (
                <div className="mt-4 p-4 rounded-xl text-sm font-medium bg-[rgba(239,68,68,0.06)] text-red-600 border border-red-100 animate-shake">
                  {resetError}
                </div>
              )}

              <button
                onClick={handleSendReset}
                disabled={resetLoading || !resetEmail}
                className="btn-primary w-full mt-6 text-[15px]"
              >
                {resetLoading ? <Loader2 size={18} className="animate-spin" /> : null}
                {resetLoading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <p className="text-center text-sm text-brand-muted mt-5">
                <button type="button" onClick={() => setView('auth')} className="text-brand-purple font-semibold hover:underline">
                  Back to sign in
                </button>
              </p>
            </div>
          )}

          {view === 'forgot-sent' && (
            <div className="animate-fadeIn text-center py-2">
              <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center mx-auto mb-5">
                <CheckCircle2 size={28} className="text-white" />
              </div>
              <h2 className="h3 text-brand-dark mb-2">Check your email</h2>
              <p className="text-sm text-brand-muted leading-relaxed mb-6">
                We've sent a reset link to <span className="font-semibold text-brand-dark">{resetEmail}</span>
              </p>
              <button
                type="button"
                onClick={handleSendReset}
                disabled={resetLoading}
                className="text-sm font-semibold text-brand-purple hover:underline disabled:opacity-50"
              >
                {resetLoading ? 'Resending...' : "Didn't receive it? Check spam or resend"}
              </button>
              <p className="text-center text-sm text-brand-muted mt-6">
                <button type="button" onClick={() => setView('auth')} className="text-brand-purple font-semibold hover:underline">
                  Back to sign in
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
