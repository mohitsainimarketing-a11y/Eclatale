import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

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
        setMessage('Logged in successfully!');
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setMessage('Check your email to confirm your account!');
      }
    } catch (error: any) {
      setMessage(error.message);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        
        {/* Logo */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold" style={{color: '#7C5CFC'}}>Eclatale</h1>
          <p className="text-gray-400 mt-2">
            {isLogin ? 'Welcome back' : 'Start your growth journey'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border border-white/10" 
          style={{background: '#111118'}}>
          
          <h2 className="text-xl font-semibold mb-6">
            {isLogin ? 'Sign in to your account' : 'Create your account'}
          </h2>

          {/* Email */}
          <div className="mb-4">
            <label className="text-sm text-gray-400 mb-2 block">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Password */}
          <div className="mb-6">
            <label className="text-sm text-gray-400 mb-2 block">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-gray-600 focus:outline-none focus:border-purple-500 transition-all"
            />
          </div>

          {/* Message */}
          {message && (
            <div className="mb-4 p-3 rounded-xl text-sm"
              style={{background: '#7C5CFC20', color: '#A78BFA'}}>
              {message}
            </div>
          )}

          {/* Button */}
          <button
            onClick={handleAuth}
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-white transition-all"
            style={{background: loading ? '#555' : '#7C5CFC'}}
          >
            {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
          </button>

          {/* Toggle */}
          <p className="text-center text-sm text-gray-500 mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-purple-400 hover:text-purple-300"
            >
              {isLogin ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}