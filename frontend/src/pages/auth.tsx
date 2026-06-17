import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Mail, Lock, Loader2 } from 'lucide-react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLogin, setIsLogin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async () => {
    setLoading(true);
    setMessage('');
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = '/onboarding';
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account! Then come back and login.');
      }
    } catch (error: any) {
      setMessage(error.message);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && email && password) handleAuth();
  };

  return (
    <div className="min-h-screen gradient-hero dot-grid flex items-center justify-center px-5 py-10">
      <div className="w-full max-w-[420px] animate-fadeIn">
        <a href="/" className="inline-flex items-center gap-2 text-brand-muted hover:text-brand-purple font-medium mb-8 transition-colors text-sm">
          <ArrowLeft size={16} />
          Back to home
        </a>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-extrabold gradient-text mb-2">Eclatale</h1>
          <p className="text-brand-muted text-sm font-medium">
            {isLogin ? 'Welcome back. Sign in to continue.' : 'Create your account to start growing.'}
          </p>
        </div>

        <div className="card p-7 md:p-8">
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
              <label className="text-xs font-semibold text-brand-dark uppercase tracking-wide mb-2 block">Password</label>
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
            <button
              onClick={() => { setIsLogin(!isLogin); setMessage(''); }}
              className="text-brand-purple font-semibold hover:underline"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
