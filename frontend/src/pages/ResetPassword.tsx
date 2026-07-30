import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Lock, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export default function ResetPassword() {
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase redirects expired/already-used links back with
    // #error=access_denied&error_code=otp_expired&error_description=... —
    // most commonly caused by an email client's link-scanner pre-fetching
    // (and consuming) the one-time-use token before the user clicks it.
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorCode = hashParams.get('error_code');
    if (errorCode) {
      const description = hashParams.get('error_description');
      setLinkError(
        errorCode === 'otp_expired'
          ? "This reset link has expired or was already used. Request a new one below."
          : (description ? decodeURIComponent(description.replace(/\+/g, ' ')) : 'This reset link is invalid.')
      );
      return;
    }

    // Supabase's client auto-parses the recovery tokens from the URL hash
    // and fires PASSWORD_RECOVERY once the session is established.
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    const timeout = setTimeout(() => {
      setReady((r) => {
        if (!r) setLinkError('This reset link is invalid or has expired. Request a new one below.');
        return r;
      });
    }, 5000);

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async () => {
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm) { setError("Passwords don't match."); return; }
    setLoading(true);
    setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
      setTimeout(() => { window.location.href = '/dashboard'; }, 1800);
    } catch (err: any) {
      setError(err.message || 'Could not reset password.');
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && password && confirm) handleSubmit();
  };

  if (done) {
    return (
      <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5">
        <div className="card p-7 md:p-8 max-w-[420px] w-full text-center">
          <CheckCircle2 size={32} className="text-brand-teal mx-auto mb-4" />
          <h2 className="h2 text-brand-dark mb-2">Password updated</h2>
          <p className="body-text text-sm">Taking you to your dashboard...</p>
        </div>
      </div>
    );
  }

  if (linkError) {
    return (
      <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5">
        <div className="card p-7 md:p-8 max-w-[420px] w-full text-center">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
          <h2 className="h2 text-brand-dark mb-2">Link expired</h2>
          <p className="body-text text-sm mb-6">{linkError}</p>
          <a href="/login" className="btn-primary w-full text-[15px] inline-flex justify-center">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen gradient-bg-page flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={28} className="animate-spin text-brand-purple mx-auto mb-4" />
          <span className="text-sm font-medium text-brand-muted">Verifying your reset link...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] animate-fadeIn">
        <div className="mb-8">
          <a href="/" className="text-2xl md:text-3xl font-extrabold gradient-text mb-2 block">Eclatale</a>
          <p className="text-brand-muted text-sm font-medium">Choose a new password for your account.</p>
        </div>

        <div className="card p-7 md:p-8">
          <div className="space-y-4" onKeyDown={handleKeyDown}>
            <div>
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">New Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="input !pl-11"
                  autoComplete="new-password"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Confirm Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-muted" />
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  className="input !pl-11"
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-4 rounded-xl text-sm font-medium bg-[rgba(239,68,68,0.06)] text-red-600 border border-red-100 animate-shake flex items-center gap-2">
              <AlertCircle size={16} className="flex-shrink-0" /> {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={loading || !password || !confirm}
            className="btn-primary w-full mt-6 text-[15px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : null}
            {loading ? 'Updating...' : 'Set New Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
