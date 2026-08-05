import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { AlertCircle } from 'lucide-react';
import { apiFetch } from '../lib/apiFetch';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

const API_URL = (process.env.REACT_APP_API_URL || 'http://localhost:3001').trim();

export default function AuthCallback() {
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      try {
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const params = new URLSearchParams(window.location.search);

        // Password-recovery links can land on /auth/callback (rather than the
        // root) depending on how the link was generated — hand off to the
        // reset-password screen instead of treating this as account
        // confirmation, preserving the hash so it can parse the recovery session itself.
        if (hash.get('type') === 'recovery') {
          window.location.replace(`/auth/reset-password${window.location.hash}`);
          return;
        }

        const accessToken = hash.get('access_token');
        const refreshToken = hash.get('refresh_token');
        const code = params.get('code');

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
        } else if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) throw new Error('No confirmation token found in the URL.');
        }

        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error('Could not load user after confirmation.');

        const { data: profile } = await supabase
          .from('profiles')
          .select('role, domain, goals')
          .eq('id', userData.user.id)
          .single();

        // Fire-and-forget: send-welcome is idempotent (checks welcome_email_sent),
        // safe to call on every confirmation callback without awaiting the result.
        apiFetch(`${API_URL}/api/email/send-welcome`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userData.user.id }),
        }).catch(() => {});

        const hasProfile = !!(profile?.role && profile?.domain && profile?.goals?.length);
        window.location.href = hasProfile ? '/dashboard' : '/onboarding';
      } catch (err: any) {
        setError(err.message || 'Something went wrong confirming your account.');
      }
    };
    run();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5">
        <div className="card p-7 md:p-8 max-w-[420px] w-full text-center">
          <AlertCircle size={32} className="text-red-500 mx-auto mb-4" />
          <h2 className="h2 text-brand-dark mb-2">Confirmation failed</h2>
          <p className="body-text text-sm mb-6">{error}</p>
          <a href="/login" className="btn-primary w-full text-[15px] inline-flex justify-center">
            Back to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg-page flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 rounded-full gradient-primary animate-spin mx-auto mb-4" style={{ borderTop: '3px solid transparent' }} />
        <span className="text-sm font-medium text-brand-muted">Confirming your account...</span>
      </div>
    </div>
  );
}
