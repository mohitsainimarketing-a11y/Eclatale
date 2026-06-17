import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Mail, Lock } from 'lucide-react';

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

  return (
    <div className="min-h-screen gradient-bg-hero flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Back link */}
        <a href="/" className="inline-flex items-center gap-2 text-purple-600 hover:text-purple-800 font-medium mb-8 transition-colors">
          <ArrowLeft size={18} />
          Back to home
        </a>

        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold gradient-text">Eclatale</h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isLogin ? 'Welcome back' : 'Start your growth journey'}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl shadow-purple-200/30 border border-purple-100">
          <h2 className="text-xl font-bold text-gray-900 mb-6">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>

          <div className="mb-4">
            <label className="text-sm text-gray-600 mb-2 block font-medium">Email</label>
            <div className="relative">
              <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-purple-100 bg-purple-50/30 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="text-sm text-gray-600 mb-2 block font-medium">Password</label>
            <div className="relative">
              <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-purple-100 bg-purple-50/30 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-purple-400 transition-all"
              />
            </div>
          </div>

          {message && (
            <div className={`mb-4 p-4 rounded-xl text-sm font-medium ${
              message.includes('Check your email')
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}>
              {message}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-3.5 rounded-xl font-semibold text-white gradient-bg hover:opacity-90 transition-all shadow-lg shadow-purple-400/25 disabled:opacity-50"
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-gray-500 mt-6">
            {isLogin ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setIsLogin(!isLogin); setMessage(''); }}
              className="text-purple-600 hover:text-purple-800 font-semibold"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
