import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Mail, Lock, Loader2, CheckCircle2 } from 'lucide-react';
import { trackEvent } from '../lib/analytics';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

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

  const handleAuth = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/dashboard';
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
